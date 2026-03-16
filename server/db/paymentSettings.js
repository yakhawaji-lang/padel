/**
 * Platform payment gateways - read/write from platform_payment_gateways table
 * Fallback to app_settings when table doesn't exist
 */
import { query } from './pool.js'

/** Build frontend format from DB rows */
function rowsToFrontendFormat(rows) {
  const enabledChannels = {}
  const stripe = { publishableKey: '', secretKey: '', webhookSecret: '' }
  const mada = { merchantId: '', apiKey: '', gatewayId: '' }
  const split = { deadlineMinutes: 30 }

  for (const r of rows || []) {
    const key = r.gateway_key
    enabledChannels[key] = !!r.enabled
    try {
      const cfg = typeof r.config_json === 'string' ? JSON.parse(r.config_json || '{}') : (r.config_json || {})
      if (key === 'credit_card') {
        stripe.publishableKey = cfg.publishableKey || ''
        stripe.secretKey = cfg.secretKey ? '••••••••' : ''
        stripe.webhookSecret = cfg.webhookSecret ? '••••••••' : ''
      } else if (key === 'mada') {
        mada.merchantId = cfg.merchantId || ''
        mada.apiKey = cfg.apiKey ? '••••••••' : ''
        mada.gatewayId = cfg.gatewayId || ''
      } else if (key === 'split') {
        split.deadlineMinutes = cfg.deadlineMinutes ?? 30
      }
    } catch (_) {}
  }

  return {
    enabledChannels,
    stripe,
    mada,
    split
  }
}

/** Get payment gateways from platform_payment_gateways table */
export async function getPaymentGatewaysFromTable() {
  try {
    const { rows } = await query(
      'SELECT gateway_key, enabled, config_json FROM platform_payment_gateways ORDER BY sort_order, id'
    )
    if (rows?.length) return rowsToFrontendFormat(rows)
  } catch (e) {
    if (!e?.message?.includes("doesn't exist") && !e?.message?.includes('Unknown table')) {
      console.warn('paymentSettings getPaymentGatewaysFromTable:', e?.message)
    }
  }
  return null
}

const MASK = '••••••••'

/** Save payment gateways to platform_payment_gateways table */
export async function savePaymentGatewaysToTable(data) {
  if (!data || typeof data !== 'object') return false
  const { enabledChannels = {}, stripe = {}, mada = {}, split = {} } = data

  try {
    const { rows: existing } = await query('SELECT gateway_key, config_json FROM platform_payment_gateways')
    const byKey = new Map((existing || []).map(r => [r.gateway_key, r]))

    const mergeConfig = (key, newCfg) => {
      const old = byKey.get(key)
      let oldCfg = {}
      try { oldCfg = typeof old?.config_json === 'string' ? JSON.parse(old.config_json || '{}') : (old?.config_json || {}) } catch (_) {}
      const merged = { ...oldCfg }
      for (const [k, v] of Object.entries(newCfg || {})) {
        if (v !== MASK && v !== undefined && v !== null) merged[k] = v
      }
      return merged
    }

    const gateways = [
      { key: 'at_club', enabled: enabledChannels.at_club !== false, config: {} },
      { key: 'credit_card', enabled: !!enabledChannels.credit_card, config: mergeConfig('credit_card', { publishableKey: stripe.publishableKey, secretKey: stripe.secretKey, webhookSecret: stripe.webhookSecret }) },
      { key: 'mada', enabled: !!enabledChannels.mada, config: mergeConfig('mada', { merchantId: mada.merchantId, apiKey: mada.apiKey, gatewayId: mada.gatewayId }) },
      { key: 'split', enabled: enabledChannels.split !== false, config: { deadlineMinutes: split.deadlineMinutes ?? 30 } }
    ]

    for (const g of gateways) {
      await query(
        `INSERT INTO platform_payment_gateways (gateway_key, enabled, config_json, updated_at)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), config_json = VALUES(config_json), updated_at = NOW()`,
        [g.key, g.enabled ? 1 : 0, JSON.stringify(g.config)]
      )
    }
    return true
  } catch (e) {
    console.warn('paymentSettings savePaymentGatewaysToTable:', e?.message)
    return false
  }
}

/** Get all gateways as raw rows (for PaymentSettingsPage tabs) */
export async function getPaymentGatewaysRaw() {
  try {
    const { rows } = await query(
      'SELECT id, gateway_key, enabled, config_json, display_name, display_name_ar, sort_order FROM platform_payment_gateways ORDER BY sort_order, id'
    )
    return rows || []
  } catch (e) {
    if (!e?.message?.includes("doesn't exist") && !e?.message?.includes('Unknown table')) {
      console.warn('paymentSettings getPaymentGatewaysRaw:', e?.message)
    }
    return []
  }
}
