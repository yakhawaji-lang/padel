/**
 * عدّادات ملخص إشعارات النادي — مشتركة بين HTTP ووظيفة Web Push.
 */
import { query } from '../db/pool.js'

async function safeCount(sql, params) {
  try {
    const { rows } = await query(sql, params)
    return Number(rows?.[0]?.c || 0) || 0
  } catch {
    return 0
  }
}

/**
 * @param {string} clubId
 * @param {number} viewersCount — من ذاكرة الحضور (للطلب HTTP) أو 0 للـ Push حتى لا يعتمد على الزوار
 */
export async function computeClubNotificationCounts(clubId, viewersCount) {
  const cid = String(clubId || '').trim()
  if (!cid) {
    return {
      counts: {
        viewers: 0,
        locksActive: 0,
        bookingsActiveNow: 0,
        completedBookingsToday: 0,
        bookingCompleteFlow: 0,
        bookingAwaitingPayments: 0,
        bookingExpiredWithPayment: 0,
        refundRequests: 0,
        storeSalesRecent: 0,
        storeLowStock: 0,
        newMembers: 0,
      },
    }
  }

  const viewers = Number(viewersCount) || 0

  const locksActive = await safeCount(
    `SELECT COUNT(*) AS c FROM booking_slot_locks WHERE club_id = ? AND expires_at > NOW()`,
    [cid]
  )

  const bookingsActiveNow = await safeCount(
    `SELECT COUNT(*) AS c FROM club_bookings 
     WHERE club_id = ? AND deleted_at IS NULL 
     AND booking_date = CURDATE()
     AND start_time IS NOT NULL AND TRIM(start_time) <> ''
     AND end_time IS NOT NULL AND TRIM(end_time) <> ''
     AND TIME(NOW()) >= CAST(TRIM(start_time) AS TIME)
     AND TIME(NOW()) < CAST(TRIM(end_time) AS TIME)
     AND LOWER(COALESCE(status,'')) IN ('confirmed','partially_paid','pending_payments')`,
    [cid]
  )

  const completedBookingsToday = await safeCount(
    `SELECT COUNT(*) AS c FROM club_bookings 
     WHERE club_id = ? AND deleted_at IS NULL 
     AND booking_date = CURDATE()
     AND start_time IS NOT NULL AND TRIM(start_time) <> ''
     AND end_time IS NOT NULL AND TRIM(end_time) <> ''
     AND TIME(NOW()) < CAST(TRIM(end_time) AS TIME)
     AND LOWER(COALESCE(status,'')) IN ('confirmed','partially_paid')`,
    [cid]
  )

  const bookingCompleteFlow = await safeCount(
    `SELECT COUNT(*) AS c FROM club_bookings 
     WHERE club_id = ? AND deleted_at IS NULL 
     AND LOWER(COALESCE(status,'')) IN ('initiated','locked','pending_payment')`,
    [cid]
  )

  const bookingAwaitingPayments = await safeCount(
    `SELECT COUNT(*) AS c FROM club_bookings 
     WHERE club_id = ? AND deleted_at IS NULL 
     AND LOWER(COALESCE(status,'')) IN ('pending_payments','partially_paid')`,
    [cid]
  )

  const bookingExpiredWithPayment = await safeCount(
    `SELECT COUNT(*) AS c FROM club_bookings 
     WHERE club_id = ? AND deleted_at IS NULL 
     AND LOWER(COALESCE(status,'')) = 'expired' 
     AND COALESCE(paid_amount,0) > 0.01`,
    [cid]
  )

  let refundRequests = await safeCount(
    `SELECT COUNT(*) AS c FROM booking_payment_shares 
     WHERE club_id = ? 
     AND member_refund_requested_at IS NOT NULL 
     AND refunded_at IS NULL 
     AND removed_at IS NULL`,
    [cid]
  )
  const refundRowsBooking = await safeCount(
    `SELECT COUNT(*) AS c FROM booking_refunds WHERE club_id = ? AND LOWER(COALESCE(status,'')) = 'pending'`,
    [cid]
  )
  refundRequests += refundRowsBooking

  const storeSalesRecent = await safeCount(
    `SELECT COUNT(*) AS c FROM store_sales 
     WHERE club_id = ? AND deleted_at IS NULL 
     AND created_at > DATE_SUB(NOW(), INTERVAL 48 HOUR)`,
    [cid]
  )

  const storeLowStock = await safeCount(
    `SELECT COUNT(*) AS c FROM store_products 
     WHERE club_id = ? AND deleted_at IS NULL AND stock IS NOT NULL AND stock <= 2`,
    [cid]
  )

  const newMembers = await safeCount(
    `SELECT COUNT(*) AS c FROM member_clubs 
     WHERE club_id = ? AND joined_at > DATE_SUB(NOW(), INTERVAL 7 DAY)`,
    [cid]
  )

  const counts = {
    viewers,
    locksActive,
    bookingsActiveNow,
    completedBookingsToday,
    bookingCompleteFlow,
    bookingAwaitingPayments,
    bookingExpiredWithPayment,
    refundRequests,
    storeSalesRecent,
    storeLowStock,
    newMembers,
  }

  return { counts, fingerprint: JSON.stringify(counts) }
}
