/**
 * Member (platform) login — verifies password_hash on server (bcrypt or legacy plain text).
 * Client-side-only login breaks when passwords are bcrypt or when cached members omit hashes.
 */
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import { query } from '../db/pool.js'
import { hasNormalizedTables } from '../db/normalizedData.js'

const router = Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
})

function normIdentifier(raw) {
  const t = String(raw || '').trim()
  if (!t) return { kind: 'empty', email: null, phoneKey: null, nameKey: null }
  if (t.includes('@')) return { kind: 'email', email: t.toLowerCase(), phoneKey: null, nameKey: null }
  const digits = t.replace(/\D/g, '')
  if (digits.length >= 8) {
    const phoneKey = digits.replace(/^966/, '').replace(/^0/, '') || digits
    return { kind: 'phone', email: null, phoneKey, nameKey: null }
  }
  return { kind: 'name', email: null, phoneKey: null, nameKey: t.toLowerCase() }
}

function phoneDigits(s) {
  return String(s || '').replace(/\D/g, '')
}

function mobileMatchesRow(mobile, phoneKey) {
  const d = phoneDigits(mobile)
  if (!d || !phoneKey) return false
  const norm = d.replace(/^966/, '').replace(/^0/, '') || d
  const key = String(phoneKey).replace(/^966/, '').replace(/^0/, '') || phoneKey
  return norm === key || norm.endsWith(key) || key.endsWith(norm)
}

async function verifyStoredPassword(stored, plain) {
  if (stored == null || plain == null || String(plain) === '') return false
  const s = String(stored)
  if (/^\$2[aby]\$\d{2}\$/.test(s)) {
    try {
      return await bcrypt.compare(String(plain), s)
    } catch {
      return false
    }
  }
  return s === String(plain)
}

/** Find single member row by email, phone, or exact name (same idea as client Login.jsx). */
async function findMemberRow(identifier) {
  const n = normIdentifier(identifier)
  if (n.kind === 'empty') return null

  if (n.kind === 'email') {
    const { rows } = await query(
      `SELECT id, name, email, mobile, password_hash FROM members WHERE deleted_at IS NULL AND LOWER(TRIM(COALESCE(email,''))) = ? LIMIT 2`,
      [n.email]
    )
    if (!rows?.length) return null
    if (rows.length > 1) return null
    return rows[0]
  }

  if (n.kind === 'name') {
    const { rows } = await query(
      `SELECT id, name, email, mobile, password_hash FROM members WHERE deleted_at IS NULL AND LOWER(TRIM(COALESCE(name,''))) = ? LIMIT 2`,
      [n.nameKey]
    )
    if (!rows?.length) return null
    if (rows.length > 1) return null
    return rows[0]
  }

  // phone: narrow with last 9 digits then verify in JS
  const tail = String(n.phoneKey).slice(-9)
  if (tail.length < 8) return null
  const { rows } = await query(
    `SELECT id, name, email, mobile, password_hash FROM members
     WHERE deleted_at IS NULL AND mobile IS NOT NULL AND TRIM(mobile) <> ''
     AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(mobile,' ',''),'-',''),'+',''),'(',''),')','') LIKE ?`,
    [`%${tail}`]
  )
  const matches = (rows || []).filter((r) => mobileMatchesRow(r.mobile, n.phoneKey))
  if (matches.length !== 1) return null
  return matches[0]
}

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const normalized = await hasNormalizedTables().catch(() => false)
    if (!normalized) {
      return res.status(503).json({ error: 'Database not ready', code: 'NO_DB' })
    }

    const { identifier, password } = req.body || {}
    const idRaw = identifier != null ? String(identifier).trim() : ''
    const pw = password != null ? String(password) : ''
    if (!idRaw || !pw) {
      return res.status(400).json({ error: 'identifier and password required' })
    }

    const row = await findMemberRow(idRaw)
    if (!row) {
      return res.status(401).json({ error: 'Invalid email or password', code: 'AUTH_FAILED' })
    }

    const stored = row.password_hash
    if (stored == null || String(stored).trim() === '') {
      return res.status(401).json({ error: 'Invalid email or password', code: 'AUTH_FAILED' })
    }

    const ok = await verifyStoredPassword(stored, pw)
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password', code: 'AUTH_FAILED' })
    }

    res.json({
      ok: true,
      memberId: row.id,
      name: row.name || '',
      email: row.email || null,
      mobile: row.mobile || null,
    })
  } catch (e) {
    console.error('member-auth login error:', e)
    res.status(500).json({ error: e?.message || 'Server error' })
  }
})

export default router
