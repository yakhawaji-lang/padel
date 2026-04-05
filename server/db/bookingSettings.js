/**
 * Booking settings - fetch club-specific booking configuration from DB
 */
import { query } from './pool.js'
import { ensureClubSettingsBookingColumns } from './normalizedData.js'

const DEFAULTS = {
  lockMinutes: 10,
  paymentDeadlineMinutes: 10,
  splitManageMinutes: 15,
  splitPaymentDeadlineMinutes: 30,
  tournamentKingSplitPaymentDeadlineMinutes: 30,
  tournamentSocialSplitPaymentDeadlineMinutes: 30,
  refundDays: 3,
  allowIncompleteBookings: false,
  rescheduleFeeMode: 'none',
  rescheduleFeeValue: 0,
  freeRescheduleCount: 1,
  cancelRefundHoursBefore: 24,
  cancelFeeMode: 'none',
  cancelFeeValue: 0,
  cancelPolicyOverrides: {},
}

function parseCancelPolicyOverrides(raw) {
  if (raw == null || raw === '') return {}
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw)
      return p && typeof p === 'object' && !Array.isArray(p) ? p : {}
    } catch {
      return {}
    }
  }
  return {}
}

/**
 * Get booking settings for a club
 */
export async function getBookingSettings(clubId) {
  if (!clubId) return { ...DEFAULTS }
  try {
    await ensureClubSettingsBookingColumns()
    const { rows } = await query(
      `SELECT lock_minutes, payment_deadline_minutes, split_manage_minutes, split_payment_deadline_minutes,
       tournament_king_split_payment_deadline_minutes, tournament_social_split_payment_deadline_minutes,
       refund_days, allow_incomplete_bookings,
       reschedule_fee_mode, reschedule_fee_value, free_reschedule_count, cancel_refund_hours_before, cancel_fee_mode, cancel_fee_value,
       cancel_policy_overrides
       FROM club_settings WHERE club_id = ?`,
      [clubId]
    )
    const r = rows[0]
    if (!r) return { ...DEFAULTS }
    return {
      lockMinutes: r.lock_minutes ?? DEFAULTS.lockMinutes,
      paymentDeadlineMinutes: r.payment_deadline_minutes ?? DEFAULTS.paymentDeadlineMinutes,
      splitManageMinutes: r.split_manage_minutes ?? DEFAULTS.splitManageMinutes,
      splitPaymentDeadlineMinutes: r.split_payment_deadline_minutes ?? DEFAULTS.splitPaymentDeadlineMinutes,
      tournamentKingSplitPaymentDeadlineMinutes:
        r.tournament_king_split_payment_deadline_minutes ?? DEFAULTS.tournamentKingSplitPaymentDeadlineMinutes,
      tournamentSocialSplitPaymentDeadlineMinutes:
        r.tournament_social_split_payment_deadline_minutes ?? DEFAULTS.tournamentSocialSplitPaymentDeadlineMinutes,
      refundDays: r.refund_days ?? DEFAULTS.refundDays,
      allowIncompleteBookings: !!r.allow_incomplete_bookings,
      rescheduleFeeMode: r.reschedule_fee_mode || DEFAULTS.rescheduleFeeMode,
      rescheduleFeeValue: parseFloat(r.reschedule_fee_value) || 0,
      freeRescheduleCount: parseInt(r.free_reschedule_count, 10) || DEFAULTS.freeRescheduleCount,
      cancelRefundHoursBefore: parseInt(r.cancel_refund_hours_before, 10) || DEFAULTS.cancelRefundHoursBefore,
      cancelFeeMode: r.cancel_fee_mode || DEFAULTS.cancelFeeMode,
      cancelFeeValue: parseFloat(r.cancel_fee_value) || 0,
      cancelPolicyOverrides: parseCancelPolicyOverrides(r.cancel_policy_overrides),
    }
  } catch (e) {
    if (e?.message?.includes('cancel_policy_overrides')) {
      try {
        const { rows } = await query(
          `SELECT lock_minutes, payment_deadline_minutes, split_manage_minutes, split_payment_deadline_minutes,
           tournament_king_split_payment_deadline_minutes, tournament_social_split_payment_deadline_minutes,
           refund_days, allow_incomplete_bookings,
           reschedule_fee_mode, reschedule_fee_value, free_reschedule_count, cancel_refund_hours_before, cancel_fee_mode, cancel_fee_value
           FROM club_settings WHERE club_id = ?`,
          [clubId]
        )
        const r = rows[0]
        if (!r) return { ...DEFAULTS }
        return {
          lockMinutes: r.lock_minutes ?? DEFAULTS.lockMinutes,
          paymentDeadlineMinutes: r.payment_deadline_minutes ?? DEFAULTS.paymentDeadlineMinutes,
          splitManageMinutes: r.split_manage_minutes ?? DEFAULTS.splitManageMinutes,
          splitPaymentDeadlineMinutes: r.split_payment_deadline_minutes ?? DEFAULTS.splitPaymentDeadlineMinutes,
          tournamentKingSplitPaymentDeadlineMinutes:
            r.tournament_king_split_payment_deadline_minutes ?? DEFAULTS.tournamentKingSplitPaymentDeadlineMinutes,
          tournamentSocialSplitPaymentDeadlineMinutes:
            r.tournament_social_split_payment_deadline_minutes ?? DEFAULTS.tournamentSocialSplitPaymentDeadlineMinutes,
          refundDays: r.refund_days ?? DEFAULTS.refundDays,
          allowIncompleteBookings: !!r.allow_incomplete_bookings,
          rescheduleFeeMode: r.reschedule_fee_mode || DEFAULTS.rescheduleFeeMode,
          rescheduleFeeValue: parseFloat(r.reschedule_fee_value) || 0,
          freeRescheduleCount: parseInt(r.free_reschedule_count, 10) || DEFAULTS.freeRescheduleCount,
          cancelRefundHoursBefore: parseInt(r.cancel_refund_hours_before, 10) || DEFAULTS.cancelRefundHoursBefore,
          cancelFeeMode: r.cancel_fee_mode || DEFAULTS.cancelFeeMode,
          cancelFeeValue: parseFloat(r.cancel_fee_value) || 0,
          cancelPolicyOverrides: {},
        }
      } catch (e2) {
        if (!e2?.message?.includes("doesn't exist") && !e2?.message?.includes('Unknown column')) {
          console.warn('getBookingSettings:', e2?.message)
        }
        return { ...DEFAULTS }
      }
    }
    if (!e?.message?.includes("doesn't exist") && !e?.message?.includes('Unknown column')) {
      console.warn('getBookingSettings:', e?.message)
    }
    return { ...DEFAULTS }
  }
}
