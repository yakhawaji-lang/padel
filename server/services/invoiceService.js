/**
 * Club invoicing: numbered invoices, lines, payment ledger.
 * Skips silently if migration tables are not present.
 */
import crypto from 'crypto'
import { logAudit } from '../db/audit.js'
import { query, getPool } from '../db/pool.js'

let _tablesCached = null

export async function invoicingTablesExist() {
  if (_tablesCached !== null) return _tablesCached
  try {
    const { rows } = await query(
      `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'club_invoices'`,
      []
    )
    _tablesCached = Number(rows?.[0]?.c) > 0
    return _tablesCached
  } catch {
    _tablesCached = false
    return false
  }
}

function uuid() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return crypto.randomBytes(16).toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5')
}

/**
 * فاتورة بمبلغ محصّل بالكامل + بند واحد + حركة قبض
 */
export async function issuePaidInvoice({
  clubId,
  currency = 'SAR',
  total,
  customerMemberId = null,
  customerName = null,
  customerPhone = null,
  sourceType,
  sourceRef,
  idempotencyKey,
  paymentMethod = 'electronic',
  externalRef = null,
  lineDescriptionEn,
  lineDescriptionAr = null,
}) {
  if (!(await invoicingTablesExist())) return null
  const amt = Math.round((parseFloat(total) || 0) * 100) / 100
  if (amt <= 0 || !clubId || !sourceType || !idempotencyKey) return null

  const { rows: exist } = await query(
    'SELECT id, invoice_number FROM club_invoices WHERE idempotency_key = ? AND deleted_at IS NULL LIMIT 1',
    [idempotencyKey]
  )
  if (exist?.length) {
    return { ok: true, duplicate: true, invoiceId: exist[0].id, invoiceNumber: exist[0].invoice_number }
  }

  const pool = getPool()
  if (!pool) return null
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const period = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}`
    await conn.execute(
      `INSERT INTO club_invoice_seq (club_id, period, last_seq) VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE last_seq = last_seq + 1`,
      [clubId, period]
    )
    const [seqRows] = await conn.execute(
      'SELECT last_seq FROM club_invoice_seq WHERE club_id = ? AND period = ?',
      [clubId, period]
    )
    const seq = seqRows?.[0]?.last_seq ?? 1
    const shortClub = String(clubId).replace(/[^a-zA-Z0-9]/g, '').slice(-6) || 'club'
    const invoiceNumber = `INV-${shortClub}-${period}-${String(seq).padStart(5, '0')}`
    const publicId = uuid()
    const subtotal = amt
    const taxTotal = 0

    const [invRes] = await conn.execute(
      `INSERT INTO club_invoices (
        public_id, club_id, invoice_number, status, currency, subtotal, tax_total, total,
        amount_paid, balance_due, customer_member_id, customer_name, customer_phone,
        source_type, source_ref, idempotency_key, paid_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, NOW())`,
      [
        publicId,
        clubId,
        invoiceNumber,
        'paid',
        currency || 'SAR',
        subtotal,
        taxTotal,
        amt,
        amt,
        0,
        customerMemberId,
        customerName,
        customerPhone,
        sourceType,
        sourceRef,
        idempotencyKey,
      ]
    )
    const invoiceId = invRes.insertId
    const payIdem = `pay:${idempotencyKey}`.slice(0, 190)
    await conn.execute(
      `INSERT INTO club_invoice_lines (invoice_id, line_no, description, description_ar, quantity, unit_price, tax_rate, tax_amount, line_total)
       VALUES (?, 1, ?, ?, 1, ?, 0, 0, ?)`,
      [invoiceId, lineDescriptionEn, lineDescriptionAr, amt, amt]
    )
    await conn.execute(
      `INSERT INTO club_payments (club_id, invoice_id, amount, currency, method, external_ref, idempotency_key, member_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [clubId, invoiceId, amt, currency || 'SAR', paymentMethod, externalRef, payIdem, customerMemberId]
    )
    await conn.commit()
    return { ok: true, invoiceId, invoiceNumber, publicId }
  } catch (e) {
    await conn.rollback()
    console.error('[invoiceService] issuePaidInvoice', e?.message)
    return null
  } finally {
    conn.release()
  }
}

export async function issueInvoiceForPaidShare({
  clubId,
  bookingId,
  shareId,
  amount,
  currency,
  memberId,
  memberName,
  phone,
  paymentMethod,
  paymentReference,
}) {
  const method = (paymentMethod || 'electronic').toString()
  const idem = `bps:${clubId}:${shareId}:paid`
  const descEn = `Court booking share — booking ${bookingId}`
  const descAr = `مشاركة دفع حجز ملعب — الحجز ${bookingId}`
  return issuePaidInvoice({
    clubId,
    currency: currency || 'SAR',
    total: amount,
    customerMemberId: memberId || null,
    customerName: memberName || null,
    customerPhone: phone || null,
    sourceType: 'booking_share',
    sourceRef: `${bookingId}:${shareId}`,
    idempotencyKey: idem,
    paymentMethod: method === 'at_club' ? 'at_club' : method === 'electronic' ? 'electronic' : 'other',
    externalRef: paymentReference || null,
    lineDescriptionEn: descEn,
    lineDescriptionAr: descAr,
  })
}

/**
 * أنشئ فواتير الحصص المدفوعة الناقصة (آمن للاستدعاء المتكرر — مفاتيح idempotency لكل حصة).
 * يُستدعى بعد إعادة حساب الدفع لضمان ظهور الفواتير في المحاسبة حتى لو فُات الإصدار سابقاً.
 */
export async function syncInvoicesForAllPaidSharesOnBooking({ clubId, bookingId }) {
  if (!(await invoicingTablesExist())) return { ok: true, skipped: true, primaryForUi: null }
  if (!clubId || bookingId == null || bookingId === '') return { ok: false, primaryForUi: null }
  let rows
  try {
    const res = await query(
      `SELECT bps.id, bps.amount, bps.member_id, bps.member_name, bps.phone,
              bps.payment_method, bps.payment_reference,
              COALESCE(cs.currency, 'SAR') AS currency
       FROM booking_payment_shares bps
       LEFT JOIN club_settings cs ON cs.club_id = bps.club_id
       WHERE bps.booking_id = ? AND bps.club_id = ?
         AND bps.paid_at IS NOT NULL
         AND (bps.refunded_at IS NULL)
         AND (bps.removed_at IS NULL)`,
      [bookingId, clubId]
    )
    rows = res?.rows || []
  } catch (e) {
    if (!e?.message?.includes('refunded_at') && !e?.message?.includes('removed_at')) throw e
    const res = await query(
      `SELECT bps.id, bps.amount, bps.member_id, bps.member_name, bps.phone,
              bps.payment_method, bps.payment_reference,
              COALESCE(cs.currency, 'SAR') AS currency
       FROM booking_payment_shares bps
       LEFT JOIN club_settings cs ON cs.club_id = bps.club_id
       WHERE bps.booking_id = ? AND bps.club_id = ?
         AND bps.paid_at IS NOT NULL`,
      [bookingId, clubId]
    )
    rows = (res?.rows || []).filter((r) => r)
  }

  let primaryForUi = null
  for (const r of rows) {
    try {
      const inv = await issueInvoiceForPaidShare({
        clubId,
        bookingId,
        shareId: r.id,
        amount: r.amount,
        currency: r.currency,
        memberId: r.member_id,
        memberName: r.member_name,
        phone: r.phone,
        paymentMethod: r.payment_method || 'at_club',
        paymentReference: r.payment_reference || null,
      })
      if (inv?.invoiceNumber && !primaryForUi) primaryForUi = inv
    } catch (err) {
      console.warn('[invoiceService] syncInvoicesForAllPaidSharesOnBooking share', r?.id, err?.message)
    }
  }
  return { ok: true, primaryForUi: primaryForUi || null, shareCount: rows.length }
}

/** Mark paid booking_full invoices as void after member refund is fulfilled at the club. */
export async function voidClubInvoicesForBookingRefund(clubId, bookingId) {
  if (!(await invoicingTablesExist())) return { ok: true, skipped: true }
  await query(
    `UPDATE club_invoices SET status = 'void', updated_at = NOW() WHERE club_id = ? AND source_type = 'booking_full' AND source_ref = ? AND deleted_at IS NULL`,
    [String(clubId), String(bookingId)]
  )
  return { ok: true }
}

/** قيمة method المناسبة لجدول club_payments (electronic | at_club | wallet | other) */
export function normalizeClubPaymentMethodForInvoice(paymentMethod) {
  const m = (paymentMethod || 'electronic').toString().toLowerCase().trim()
  if (m === 'at_club') return 'at_club'
  if (m === 'wallet') return 'wallet'
  if (m === 'credit_card' || m === 'mada' || m === 'electronic') return 'electronic'
  return 'other'
}

export async function issueInvoiceForFullBookingPayment({ clubId, bookingId, amount, currency, memberId, memberName, paymentMethod = 'electronic' }) {
  const idem = `cbf:${clubId}:${bookingId}:full`
  const method = normalizeClubPaymentMethodForInvoice(paymentMethod)
  return issuePaidInvoice({
    clubId,
    currency: currency || 'SAR',
    total: amount,
    customerMemberId: memberId || null,
    customerName: memberName || null,
    customerPhone: null,
    sourceType: 'booking_full',
    sourceRef: String(bookingId),
    idempotencyKey: idem,
    paymentMethod: method,
    externalRef: null,
    lineDescriptionEn: `Court booking — ${bookingId}`,
    lineDescriptionAr: `حجز ملعب — ${bookingId}`,
  })
}

/**
 * Hard-delete invoice: lines, payments, then header (club admin / platform admin only — caller must enforce).
 */
export async function purgeInvoiceHard(clubId, publicId, actor = {}) {
  if (!(await invoicingTablesExist())) return { ok: false, error: 'not_installed' }
  const cid = String(clubId)
  const pid = String(publicId)
  const pool = getPool()
  if (!pool) return { ok: false, error: 'no_pool' }
  const conn = await pool.getConnection()
  try {
    const [rows] = await conn.execute(
      'SELECT id, invoice_number FROM club_invoices WHERE public_id = ? AND club_id = ? LIMIT 1',
      [pid, cid]
    )
    if (!rows?.length) return { ok: true, missing: true }
    const invoiceId = rows[0].id
    const invNo = rows[0].invoice_number
    await conn.beginTransaction()
    await conn.execute('DELETE FROM club_payments WHERE invoice_id = ?', [invoiceId])
    await conn.execute('DELETE FROM club_invoice_lines WHERE invoice_id = ?', [invoiceId])
    await conn.execute('DELETE FROM club_invoices WHERE id = ? AND club_id = ?', [invoiceId, cid])
    await conn.commit()
    await logAudit({
      tableName: 'club_invoices',
      recordId: String(invoiceId),
      action: 'DELETE',
      actorType: actor.actorType || 'system',
      actorId: actor.actorId,
      actorName: actor.actorName,
      clubId: cid,
      oldValue: { public_id: pid, invoice_number: invNo },
      ipAddress: actor.ipAddress,
    })
    return { ok: true }
  } catch (e) {
    try {
      await conn.rollback()
    } catch {
      /* ignore */
    }
    console.error('[invoiceService] purgeInvoiceHard', e?.message)
    throw e
  } finally {
    conn.release()
  }
}
