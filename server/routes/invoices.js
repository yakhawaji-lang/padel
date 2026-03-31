/**
 * Club-scoped invoices API (requires clubId query/body).
 */
import { Router } from 'express'
import { getActorFromRequest } from '../db/audit.js'
import { query } from '../db/pool.js'
import * as invoiceService from '../services/invoiceService.js'

const router = Router()

function num(v, d, max) {
  const n = parseInt(String(v), 10)
  if (Number.isNaN(n) || n < 0) return d
  return Math.min(n, max ?? n)
}

/** GET /api/invoices?clubId=&from=&to=&limit=&offset= */
router.get('/', async (req, res) => {
  try {
    const { clubId, from, to } = req.query
    if (!clubId) return res.status(400).json({ error: 'clubId required' })
    if (!(await invoiceService.invoicingTablesExist())) {
      return res.json({ ok: true, invoices: [], invoicingEnabled: false })
    }
    const limit = num(req.query.limit, 50, 200)
    const offset = num(req.query.offset, 0, 100000)
    let sql = `
      SELECT ci.public_id, ci.invoice_number, ci.status, ci.currency, ci.total, ci.amount_paid, ci.balance_due,
        ci.paid_at, ci.issued_at,
        COALESCE(
          NULLIF(TRIM(ci.customer_name), ''),
          NULLIF(TRIM(bps.member_name), ''),
          CASE
            WHEN bps.member_id IS NULL AND bps.phone IS NOT NULL AND bps.phone <> '' AND (
              SELECT COUNT(*)
              FROM members mcnt
              WHERE mcnt.deleted_at IS NULL
                AND RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(mcnt.mobile, mcnt.phone, ''), '+', ''), ' ', ''), '-', ''), '(', ''), ')', ''), 9) =
                    RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(bps.phone, ''), '+', ''), ' ', ''), '-', ''), '(', ''), ')', ''), 9)
            ) = 1
            THEN (
              SELECT NULLIF(TRIM(mname.name), '')
              FROM members mname
              WHERE mname.deleted_at IS NULL
                AND RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(mname.mobile, mname.phone, ''), '+', ''), ' ', ''), '-', ''), '(', ''), ')', ''), 9) =
                    RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(bps.phone, ''), '+', ''), ' ', ''), '-', ''), '(', ''), ')', ''), 9)
              LIMIT 1
            )
            ELSE NULL
          END,
          NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(cb.data, '$.customerName'))), ''),
          NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(cb.data, '$.customer'))), ''),
          NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(cb.data, '$.memberName'))), '')
        ) AS customer_name,
        COALESCE(
          NULLIF(TRIM(ci.customer_phone), ''),
          NULLIF(TRIM(bps.phone), ''),
          NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(cb.data, '$.phone'))), ''),
          NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(cb.data, '$.customerPhone'))), '')
        ) AS customer_phone,
        COALESCE(
          NULLIF(TRIM(ci.customer_member_id), ''),
          NULLIF(TRIM(bps.member_id), ''),
          CASE
            WHEN bps.member_id IS NULL AND bps.phone IS NOT NULL AND bps.phone <> '' AND (
              SELECT COUNT(*)
              FROM members mcnt
              WHERE mcnt.deleted_at IS NULL
                AND RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(mcnt.mobile, mcnt.phone, ''), '+', ''), ' ', ''), '-', ''), '(', ''), ')', ''), 9) =
                    RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(bps.phone, ''), '+', ''), ' ', ''), '-', ''), '(', ''), ')', ''), 9)
            ) = 1
            THEN (
              SELECT MIN(mid.id)
              FROM members mid
              WHERE mid.deleted_at IS NULL
                AND RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(mid.mobile, mid.phone, ''), '+', ''), ' ', ''), '-', ''), '(', ''), ')', ''), 9) =
                    RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(bps.phone, ''), '+', ''), ' ', ''), '-', ''), '(', ''), ')', ''), 9)
            )
            ELSE NULL
          END,
          NULLIF(TRIM(cb.member_id), '')
        ) AS customer_member_id,
        bps.participant_type AS share_participant_type,
        ci.source_type, ci.source_ref
      FROM club_invoices ci
      LEFT JOIN booking_payment_shares bps ON ci.club_id = bps.club_id
        AND ci.source_type = 'booking_share'
        AND ci.source_ref = CONCAT(bps.booking_id, ':', bps.id)
      LEFT JOIN club_bookings cb ON ci.club_id = cb.club_id
        AND ci.source_type = 'booking_full'
        AND ci.source_ref = cb.id
        AND cb.deleted_at IS NULL
      WHERE ci.club_id = ? AND ci.deleted_at IS NULL`
    const params = [clubId]
    if (from) {
      sql += ' AND ci.issued_at >= ?'
      params.push(from)
    }
    if (to) {
      sql += ' AND ci.issued_at < DATE_ADD(?, INTERVAL 1 DAY)'
      params.push(to)
    }
    sql += ' ORDER BY ci.issued_at DESC, ci.id DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)
    let rows = []
    try {
      const r = await query(sql, params)
      rows = r.rows || []
    } catch (qErr) {
      const msg = String(qErr?.message || '')
      // بعض البيئات القديمة لا تحتوي members.deleted_at — نعيد المحاولة بدون هذا الشرط.
      if (!msg.includes('deleted_at')) throw qErr
      const sqlNoMembersDeletedAt = sql
        .replace(/mcnt\.deleted_at IS NULL\s+AND\s+/g, '')
        .replace(/mname\.deleted_at IS NULL\s+AND\s+/g, '')
        .replace(/mid\.deleted_at IS NULL\s+AND\s+/g, '')
      const r2 = await query(sqlNoMembersDeletedAt, params)
      rows = r2.rows || []
    }
    res.json({ ok: true, invoices: rows || [], invoicingEnabled: true })
  } catch (e) {
    console.error('invoices list error:', e)
    res.status(500).json({ error: e?.message || 'Database error' })
  }
})

/** POST /api/invoices/purge — club or platform admin: hard-delete invoice + lines + payments */
router.post('/purge', async (req, res) => {
  try {
    const { clubId, publicId } = req.body || {}
    if (!clubId || !publicId) return res.status(400).json({ error: 'clubId and publicId required' })
    if (!(await invoiceService.invoicingTablesExist())) {
      return res.status(400).json({ error: 'Invoicing tables not installed' })
    }
    const actor = getActorFromRequest(req)
    const at = String(actor.actorType || '').toLowerCase()
    if (at === 'club_admin') {
      if (!actor.clubId || String(actor.clubId) !== String(clubId)) {
        return res.status(403).json({ error: 'Forbidden' })
      }
    } else if (at !== 'platform_admin') {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const act = {
      actorType: actor.actorType || 'system',
      actorId: actor.actorId,
      actorName: actor.actorName,
      clubId: String(clubId),
      ipAddress: actor.ipAddress,
    }
    const r = await invoiceService.purgeInvoiceHard(clubId, publicId, act)
    if (!r.ok && r.error === 'not_installed') {
      return res.status(400).json({ error: 'Invoicing not available' })
    }
    res.json({ ok: true, missing: !!r.missing })
  } catch (e) {
    console.error('invoices purge error:', e)
    res.status(500).json({ error: e?.message || 'Database error' })
  }
})

/** GET /api/invoices/:publicId?clubId= */
router.get('/:publicId', async (req, res) => {
  try {
    const { publicId } = req.params
    const { clubId } = req.query
    if (!clubId || !publicId) return res.status(400).json({ error: 'clubId and publicId required' })
    if (!(await invoiceService.invoicingTablesExist())) {
      return res.status(404).json({ error: 'Invoicing tables not installed' })
    }
    const { rows } = await query(
      `SELECT id, public_id, club_id, invoice_number, status, currency, subtotal, tax_total, total,
       amount_paid, balance_due, customer_member_id, customer_name, customer_phone,
       source_type, source_ref, issued_at, paid_at, created_at
       FROM club_invoices WHERE public_id = ? AND club_id = ? AND deleted_at IS NULL`,
      [publicId, clubId]
    )
    if (!rows?.length) return res.status(404).json({ error: 'Invoice not found' })
    const inv = rows[0]
    const { rows: lines } = await query(
      'SELECT line_no, description, description_ar, quantity, unit_price, tax_rate, tax_amount, line_total FROM club_invoice_lines WHERE invoice_id = ? ORDER BY line_no',
      [inv.id]
    )
    const { rows: payments } = await query(
      'SELECT amount, currency, method, external_ref, recorded_at, member_id FROM club_payments WHERE invoice_id = ? ORDER BY recorded_at, id',
      [inv.id]
    )
    res.json({ ok: true, invoice: inv, lines: lines || [], payments: payments || [] })
  } catch (e) {
    console.error('invoices detail error:', e)
    res.status(500).json({ error: e?.message || 'Database error' })
  }
})

export default router
