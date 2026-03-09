/**
 * Payment Idempotency - prevents duplicate charges for same key
 */
import { query } from './pool.js'

const TTL_HOURS = 24

export async function checkIdempotency(key) {
  if (!key || typeof key !== 'string') return null
  try {
    const { rows } = await query(
      'SELECT booking_id FROM payment_idempotency WHERE idempotency_key = ? AND created_at > DATE_SUB(NOW(), INTERVAL ? HOUR)',
      [key.trim(), TTL_HOURS]
    )
    return rows[0]?.booking_id || null
  } catch {
    return null
  }
}

export async function storeIdempotency(key, bookingId) {
  if (!key || typeof key !== 'string') return
  try {
    await query(
      'INSERT INTO payment_idempotency (idempotency_key, booking_id) VALUES (?, ?)',
      [key.trim(), bookingId]
    )
  } catch (e) {
    if (!e?.message?.includes('Duplicate')) console.warn('idempotency store:', e?.message)
  }
}
