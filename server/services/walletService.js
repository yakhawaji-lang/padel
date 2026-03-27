/**
 * Member club wallet — balance + ledger (tables auto-created when missing)
 */
import { query, getPool } from '../db/pool.js'

let _walletSchemaReady = false

function normalizeMemberId(memberId) {
  if (memberId == null) return ''
  const s = String(memberId).trim()
  if (!s || s === 'undefined' || s === 'null') return ''
  return s
}

/** Create member_wallet + ledger if needed (idempotent). */
export async function ensureMemberWalletTables() {
  if (_walletSchemaReady) return true
  try {
    await query(
      `CREATE TABLE IF NOT EXISTS member_wallet (
        club_id VARCHAR(255) NOT NULL,
        member_id VARCHAR(255) NOT NULL,
        balance DECIMAL(14,2) NOT NULL DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (club_id, member_id),
        INDEX idx_mw_club (club_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      []
    )
    await query(
      `CREATE TABLE IF NOT EXISTS member_wallet_ledger (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        club_id VARCHAR(255) NOT NULL,
        member_id VARCHAR(255) NOT NULL,
        amount DECIMAL(14,2) NOT NULL,
        direction ENUM('credit','debit') NOT NULL,
        balance_after DECIMAL(14,2) NOT NULL,
        reason VARCHAR(64) NOT NULL,
        ref_type VARCHAR(32) NULL,
        ref_id VARCHAR(255) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_mwl_member (club_id, member_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      []
    )
    _walletSchemaReady = true
    return true
  } catch (e) {
    console.error('[wallet] ensureMemberWalletTables:', e?.message)
    return false
  }
}

export async function walletTablesExist() {
  return ensureMemberWalletTables()
}

/** Idempotency: already credited this booking refund to wallet? */
export async function hasBookingRefundCredit(clubId, memberId, bookingId) {
  const mid = normalizeMemberId(memberId)
  if (!clubId || !mid || !bookingId) return false
  if (!(await ensureMemberWalletTables())) return false
  try {
    const { rows } = await query(
      `SELECT 1 AS ok FROM member_wallet_ledger
       WHERE club_id = ? AND member_id = ? AND ref_type = 'booking' AND ref_id = ?
         AND direction = 'credit' AND reason = 'booking_refund_club_confirmed' LIMIT 1`,
      [String(clubId), mid, String(bookingId)]
    )
    return rows?.length > 0
  } catch {
    return false
  }
}

/** True if any wallet credit exists for this booking refund (any member). Avoids double-crediting when repairing. */
export async function hasAnyBookingRefundWalletCreditForBooking(clubId, bookingId) {
  if (!clubId || !bookingId) return false
  if (!(await ensureMemberWalletTables())) return false
  try {
    const { rows } = await query(
      `SELECT 1 AS ok FROM member_wallet_ledger
       WHERE club_id = ? AND ref_type = 'booking' AND ref_id = ?
         AND direction = 'credit' AND reason = 'booking_refund_club_confirmed' LIMIT 1`,
      [String(clubId), String(bookingId)]
    )
    return rows?.length > 0
  } catch {
    return false
  }
}

function parseRowData(raw) {
  if (!raw) return {}
  if (typeof raw === 'object') return { ...raw }
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

/**
 * Idempotent: if booking is marked club wallet refund fulfilled but ledger credit is missing, apply it.
 * Called when the member opens wallet balance so past bugs (wrong member id / skipped credit) self-heal safely.
 */
export async function repairMissingWalletCreditsForMember(clubId, memberId) {
  const mid = normalizeMemberId(memberId)
  if (!clubId || !mid) return { repaired: 0 }
  if (!(await ensureMemberWalletTables())) return { repaired: 0 }
  const cid = String(clubId)
  let repaired = 0
  try {
    const { rows: fromBooker } = await query(
      `SELECT id, data FROM club_bookings
       WHERE club_id = ? AND deleted_at IS NULL AND LOWER(COALESCE(status,'')) = 'cancelled'
         AND (member_id = ? OR initiator_member_id = ?)`,
      [cid, mid, mid]
    )
    const { rows: fromRefund } = await query(
      `SELECT cb.id, cb.data FROM club_bookings cb
       INNER JOIN booking_refunds br ON br.booking_id = cb.id AND br.club_id = cb.club_id
       WHERE cb.club_id = ? AND cb.deleted_at IS NULL AND LOWER(COALESCE(cb.status,'')) = 'cancelled'
         AND br.member_id = ?`,
      [cid, mid]
    )
    const byId = new Map()
    for (const r of [...(fromBooker || []), ...(fromRefund || [])]) {
      if (r?.id != null) byId.set(String(r.id), r)
    }
    const maxOps = 40
    for (const row of byId.values()) {
      if (repaired >= maxOps) break
      const bid = row.id
      const d = parseRowData(row.data)
      const ff = String(d.clubRefundFulfillment || '').toLowerCase()
      if (ff !== 'wallet' || !d.clubRefundFulfilledAt) continue
      if (await hasAnyBookingRefundWalletCreditForBooking(cid, bid)) continue
      let net = parseFloat(d.clubRefundAmount)
      if (!Number.isFinite(net) || net < 0.01) net = parseFloat(d.memberRefundNet)
      if (!Number.isFinite(net) || net < 0.01) {
        try {
          const { rows: nr } = await query(
            `SELECT net_amount, amount FROM booking_refunds WHERE booking_id = ? AND club_id = ? ORDER BY id DESC LIMIT 1`,
            [bid, cid]
          )
          const n = parseFloat(nr?.[0]?.net_amount)
          const g = parseFloat(nr?.[0]?.amount)
          net = Number.isFinite(n) && n >= 0.01 ? n : (Number.isFinite(g) ? g : 0)
        } catch {
          net = 0
        }
      }
      net = Math.round(net * 100) / 100
      if (net < 0.01) continue
      const cr = await creditWallet(cid, mid, net, {
        reason: 'booking_refund_club_confirmed',
        refType: 'booking',
        refId: String(bid),
      })
      if (cr.ok) repaired += 1
      else console.warn('[wallet] repair credit failed booking', bid, cr.error)
    }
  } catch (e) {
    console.warn('[wallet] repairMissingWalletCreditsForMember:', e?.message)
  }
  return { repaired }
}

export async function getWalletBalance(clubId, memberId, { skipRepair = false } = {}) {
  const mid = normalizeMemberId(memberId)
  if (!clubId || !mid) return 0
  if (!(await ensureMemberWalletTables())) return 0
  if (!skipRepair) {
    await repairMissingWalletCreditsForMember(clubId, mid)
  }
  const { rows } = await query(
    'SELECT balance FROM member_wallet WHERE club_id = ? AND member_id = ?',
    [String(clubId), mid]
  )
  return rows?.length ? Math.round((parseFloat(rows[0].balance) || 0) * 100) / 100 : 0
}

/**
 * @returns {{ ok: boolean, balanceAfter?: number, error?: string }}
 */
export async function creditWallet(clubId, memberId, amount, { reason, refType, refId } = {}) {
  const amt = Math.round((parseFloat(amount) || 0) * 100) / 100
  const mid = normalizeMemberId(memberId)
  if (!clubId || !mid || amt <= 0) {
    return { ok: false, error: 'Invalid credit' }
  }
  if (!(await ensureMemberWalletTables())) {
    return { ok: false, error: 'Wallet tables unavailable' }
  }
  const pool = getPool()
  if (!pool) return { ok: false, error: 'Database not configured' }
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.execute(
      `INSERT INTO member_wallet (club_id, member_id, balance) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE balance = balance + ?`,
      [String(clubId), mid, amt, amt]
    )
    const [balRows] = await conn.execute(
      'SELECT balance FROM member_wallet WHERE club_id = ? AND member_id = ? FOR UPDATE',
      [String(clubId), mid]
    )
    const bal = Math.round((parseFloat(balRows?.[0]?.balance) || 0) * 100) / 100
    await conn.execute(
      `INSERT INTO member_wallet_ledger (club_id, member_id, amount, direction, balance_after, reason, ref_type, ref_id)
       VALUES (?, ?, ?, 'credit', ?, ?, ?, ?)`,
      [String(clubId), mid, amt, bal, reason || 'credit', refType || null, refId || null]
    )
    await conn.commit()
    return { ok: true, balanceAfter: bal }
  } catch (e) {
    await conn.rollback()
    console.error('[wallet] credit:', e?.message)
    return { ok: false, error: e?.message || 'credit failed' }
  } finally {
    conn.release()
  }
}

export async function debitWallet(clubId, memberId, amount, { reason, refType, refId } = {}) {
  const amt = Math.round((parseFloat(amount) || 0) * 100) / 100
  const mid = normalizeMemberId(memberId)
  if (!clubId || !mid || amt <= 0) {
    return { ok: false, error: 'Invalid debit' }
  }
  if (!(await ensureMemberWalletTables())) {
    return { ok: false, error: 'Wallet tables unavailable' }
  }
  const pool = getPool()
  if (!pool) return { ok: false, error: 'Database not configured' }
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.execute(
      `INSERT INTO member_wallet (club_id, member_id, balance) VALUES (?, ?, 0)
       ON DUPLICATE KEY UPDATE club_id = club_id`,
      [String(clubId), mid]
    )
    const [balRows] = await conn.execute(
      'SELECT balance FROM member_wallet WHERE club_id = ? AND member_id = ? FOR UPDATE',
      [String(clubId), mid]
    )
    const current = Math.round((parseFloat(balRows?.[0]?.balance) || 0) * 100) / 100
    if (current + 1e-9 < amt) {
      await conn.rollback()
      return { ok: false, error: 'Insufficient wallet balance' }
    }
    const next = Math.round((current - amt) * 100) / 100
    await conn.execute(
      'UPDATE member_wallet SET balance = ? WHERE club_id = ? AND member_id = ?',
      [next, String(clubId), mid]
    )
    await conn.execute(
      `INSERT INTO member_wallet_ledger (club_id, member_id, amount, direction, balance_after, reason, ref_type, ref_id)
       VALUES (?, ?, ?, 'debit', ?, ?, ?, ?)`,
      [String(clubId), mid, amt, next, reason || 'debit', refType || null, refId || null]
    )
    await conn.commit()
    return { ok: true, balanceAfter: next }
  } catch (e) {
    await conn.rollback()
    console.error('[wallet] debit:', e?.message)
    return { ok: false, error: e?.message || 'debit failed' }
  } finally {
    conn.release()
  }
}
