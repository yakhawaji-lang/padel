/**
 * Normalize Arabic-Indic (٠–٩) and Persian (۰–۹) digits to Western 0-9 so parseFloat/parseInt work.
 */

export function normalizeDigitsToWestern(value) {
  if (value == null) return ''
  let out = ''
  for (const ch of String(value)) {
    const cp = ch.codePointAt(0)
    if (cp >= 0x0660 && cp <= 0x0669) out += String(cp - 0x0660)
    else if (cp >= 0x06f0 && cp <= 0x06f9) out += String(cp - 0x06f0)
    else out += ch
  }
  return out
}

export function parseLocaleInt(value, radix = 10, fallback = 0) {
  const w = normalizeDigitsToWestern(value).trim()
  if (w === '' || w === '-') return fallback
  const n = parseInt(w, radix)
  return Number.isNaN(n) ? fallback : n
}

export function parseLocaleFloat(value, fallback = 0) {
  const w = normalizeDigitsToWestern(value).trim().replace(/,/g, '.')
  if (w === '' || w === '-' || w === '.') return fallback
  const n = parseFloat(w)
  return Number.isNaN(n) ? fallback : n
}
