/**
 * Member club wallet — balance + ledger (requires migration member_wallet, member_wallet_ledger)
 */
import { query, getPool } from '../db/pool.js'

let _tablesOk = null

export async function walletTablesExist() {
  if (_tablesOk !== null) return _tablesOk
  try {
    const { rows } = await query(
      `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'member_wallet'`,
      []
    )
    _tablesOk = Number(rows?.[0]?.c) > 0
    return _tablesOk
  } catch {
    _tablesOk = false
    return false
  }
}

export async function getWalletBalance(clubId, memberId) {
  if (!(await walletTablesExist()) || !clubId || !memberId) return 0
  const { rows } = await query(
    'SELECT balance FROM member_wallet WHERE club_id = ? AND member_id = ?',
    [String(clubId), String(memberId)]
  )
  return rows?.length ? Math.round((parseFloat(rows[0].balance) || 0) * 100) / 100 : 0
}

/**
 * @returns {{ ok: boolean, balanceAfter?: number, error?: string }}
 */
export async function creditWallet(clubId, memberId, amount, { reason, refType, refId } = {}) {
  const amt = Math.round((parseFloat(amount) || 0) * 100) / 100
  if (!(await walletTablesExist()) || !clubId || !memberId || amt <= 0) {
    return { ok: false, error: 'Invalid credit' }
  }
  const pool = getPool()
  if (!pool) return { ok: false, error: 'Database not configured' }
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.execute(
      `INSERT INTO member_wallet (club_id, member_id, balance) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE balance = balance + VALUES(balance)`,
      [String(clubId), String(memberId), amt]
    )
    const [balRows] = await conn.execute(
      'SELECT balance FROM member_wallet WHERE club_id = ? AND member_id = ? FOR UPDATE',
      [String(clubId), String(memberId)]
    )
    const bal = Math.round((parseFloat(balRows?.[0]?.balance) || 0) * 100) / 100
    await conn.execute(
      `INSERT INTO member_wallet_ledger (club_id, member_id, amount, direction, balance_after, reason, ref_type, ref_id)
       VALUES (?, ?, ?, 'credit', ?, ?, ?, ?)`,
      [String(clubId), String(memberId), amt, bal, reason || 'credit', refType || null, refId || null]
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
  if (!(await walletTablesExist()) || !clubId || !memberId || amt <= 0) {
    return { ok: false, error: 'Invalid debit' }
  }
  const pool = getPool()
  if (!pool) return { ok: false, error: 'Database not configured' }
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.execute(
      `INSERT INTO member_wallet (club_id, member_id, balance) VALUES (?, ?, 0)
       ON DUPLICATE KEY UPDATE club_id = club_id`,
      [String(clubId), String(memberId)]
    )
    const [balRows] = await conn.execute(
      'SELECT balance FROM member_wallet WHERE club_id = ? AND member_id = ? FOR UPDATE',
      [String(clubId), String(memberId)]
    )
    const current = Math.round((parseFloat(balRows?.[0]?.balance) || 0) * 100) / 100
    if (current + 1e-9 < amt) {
      await conn.rollback()
      return { ok: false, error: 'Insufficient wallet balance' }
    }
    const next = Math.round((current - amt) * 100) / 100
    await conn.execute(
      'UPDATE member_wallet SET balance = ? WHERE club_id = ? AND member_id = ?',
      [next, String(clubId), String(memberId)]
    )
    await conn.execute(
      `INSERT INTO member_wallet_ledger (club_id, member_id, amount, direction, balance_after, reason, ref_type, ref_id)
       VALUES (?, ?, ?, 'debit', ?, ?, ?, ?)`,
      [String(clubId), String(memberId), amt, next, reason || 'debit', refType || null, refId || null]
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
