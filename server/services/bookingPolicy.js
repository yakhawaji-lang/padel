/**
 * سياسات رسوم تعديل/إلغاء الحجز
 */

/** نوع الحجز لسياسة الإلغاء: ملعب، تدريب، أو بطولة */
export function bookingKindForCancelPolicy(data = {}) {
  if (!data || typeof data !== 'object') return 'court'
  if (data.type === 'training') return 'training'
  if (data.isTournament === true || data.tournamentType != null) return 'tournament'
  return 'court'
}

/**
 * دمج سياسة الإلغاء الافتراضية مع overrides من club_settings.cancel_policy_overrides
 * الشكل: { training?: { cancelRefundHoursBefore?, cancelFeeMode?, cancelFeeValue? }, tournament?: { ... } }
 */
export function resolveCancelPolicy(settings, bookingData = {}) {
  const base = {
    cancelRefundHoursBefore: Math.max(0, parseInt(settings?.cancelRefundHoursBefore, 10) || 24),
    cancelFeeMode: (settings?.cancelFeeMode || 'none').toString().toLowerCase(),
    cancelFeeValue: parseFloat(settings?.cancelFeeValue) || 0,
  }
  const kind = bookingKindForCancelPolicy(bookingData)
  if (kind === 'court') return base
  const root = settings?.cancelPolicyOverrides && typeof settings.cancelPolicyOverrides === 'object'
    ? settings.cancelPolicyOverrides
    : {}
  const ov = kind === 'training' ? root.training : root.tournament
  if (!ov || typeof ov !== 'object') return base
  return {
    cancelRefundHoursBefore:
      ov.cancelRefundHoursBefore != null && ov.cancelRefundHoursBefore !== ''
        ? Math.max(0, parseInt(ov.cancelRefundHoursBefore, 10) || 0)
        : base.cancelRefundHoursBefore,
    cancelFeeMode:
      ov.cancelFeeMode != null && String(ov.cancelFeeMode).trim() !== ''
        ? String(ov.cancelFeeMode).toLowerCase()
        : base.cancelFeeMode,
    cancelFeeValue:
      ov.cancelFeeValue != null && ov.cancelFeeValue !== ''
        ? parseFloat(ov.cancelFeeValue) || 0
        : base.cancelFeeValue,
  }
}

export function computePolicyFee(mode, value, baseAmount) {
  const m = (mode || 'none').toString().toLowerCase()
  const base = Math.max(0, parseFloat(baseAmount) || 0)
  const v = parseFloat(value) || 0
  if (m === 'none' || !m) return 0
  if (m === 'percent') return Math.round(base * Math.min(100, Math.max(0, v)) / 100 * 100) / 100
  if (m === 'fixed') return Math.round(Math.max(0, v) * 100) / 100
  return 0
}

export function hoursUntilBookingStart(bookingDateYmd, startTimeHHMM) {
  if (!bookingDateYmd || !startTimeHHMM) return null
  const [H, M] = String(startTimeHHMM).split(':').map((x) => parseInt(x, 10) || 0)
  const [y, mo, d] = String(bookingDateYmd).split('-').map((x) => parseInt(x, 10))
  if (!y || !mo || !d) return null
  const start = new Date(y, mo - 1, d, H, M, 0, 0)
  const ms = start.getTime() - Date.now()
  return ms / (3600 * 1000)
}
