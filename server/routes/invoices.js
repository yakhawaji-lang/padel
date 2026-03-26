/**
 * Club-scoped invoices API (requires clubId query/body).
 */
import { Router } from 'express'
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
    let sql = `SELECT public_id, invoice_number, status, currency, total, amount_paid, balance_due,
      paid_at, issued_at, customer_name, customer_phone, source_type, source_ref
      FROM club_invoices WHERE club_id = ? AND deleted_at IS NULL`
    const params = [clubId]
    if (from) {
      sql += ' AND issued_at >= ?'
      params.push(from)
    }
    if (to) {
      sql += ' AND issued_at < DATE_ADD(?, INTERVAL 1 DAY)'
      params.push(to)
    }
    sql += ' ORDER BY issued_at DESC, id DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)
    const { rows } = await query(sql, params)
    res.json({ ok: true, invoices: rows || [], invoicingEnabled: true })
  } catch (e) {
    console.error('invoices list error:', e)
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
