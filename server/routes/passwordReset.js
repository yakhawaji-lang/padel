import { Router } from 'express'
import { query } from '../db/pool.js'

const router = Router()
const RESEND_API_URL = 'https://api.resend.com/emails'

function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function handleRequest(req, res) {
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return res.status(503).json({ error: 'Email service not configured' })
    }

    const { email } = req.body || {}
    const em = (email || '').trim().toLowerCase()
    if (!em) {
      return res.status(400).json({ error: 'Email is required' })
    }

    const { rows: storeRows } = await query(
      `SELECT key, value FROM app_store WHERE key IN ('all_members', 'padel_members')`
    )
    const allMembersRaw = storeRows.find(r => r.key === 'all_members')?.value
    const padelRaw = storeRows.find(r => r.key === 'padel_members')?.value

    let members = []
    try {
      const am = Array.isArray(allMembersRaw) ? allMembersRaw : (typeof allMembersRaw === 'string' ? JSON.parse(allMembersRaw) : [])
      if (Array.isArray(am)) members = am
    } catch (_) {}
    try {
      const pm = Array.isArray(padelRaw) ? padelRaw : (typeof padelRaw === 'string' ? JSON.parse(padelRaw) : [])
      if (Array.isArray(pm)) {
        const byId = new Map(members.map(m => [m.id, m]))
        pm.forEach(m => { if (m?.id) byId.set(m.id, { ...byId.get(m.id), ...m }) })
        members = Array.from(byId.values())
      }
    } catch (_) {}

    const member = members.find(m => (m.email || '').toLowerCase() === em)
    if (!member) {
      return res.json({ ok: true })
    }

    const token = randomToken()
    const expiresAt = Date.now() + 60 * 60 * 1000

    const { rows: tokenRows } = await query(
      `SELECT value FROM app_store WHERE key = 'password_reset_tokens'`
    )
    let tokens = {}
    try {
      const raw = tokenRows[0]?.value
      tokens = raw && typeof raw === 'object' ? raw : (typeof raw === 'string' ? JSON.parse(raw) : {})
    } catch (_) {}
    tokens[token] = { email: em, expiresAt }
    await query(
      `INSERT INTO app_store (key, value, updated_at) VALUES ('password_reset_tokens', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [JSON.stringify(tokens)]
    )

    const baseUrl = process.env.BASE_URL || 'http://localhost:3000'
    const resetUrl = `${baseUrl}/reset-password?token=${token}`

    const emailRes = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'Padel Platform <onboarding@resend.dev>',
        to: em,
        subject: 'استعادة كلمة المرور / Password Reset',
        html: `<div dir="ltr" style="font-family:sans-serif;max-width:480px;margin:0 auto;"><h2>Password Reset</h2><p>You requested a password reset. Click the link below:</p><p><a href="${resetUrl}" style="color:#2196f3;">Reset password</a></p><p style="color:#666;font-size:12px;">Link expires in 1 hour.</p><hr style="margin:24px 0;" /><h2 dir="rtl">استعادة كلمة المرور</h2><p dir="rtl"><a href="${resetUrl}" style="color:#2196f3;">استعادة كلمة المرور</a></p></div>`
      })
    })

    if (!emailRes.ok) {
      const errText = await emailRes.text()
      console.error('Resend error:', emailRes.status, errText)
      return res.status(502).json({ error: 'Failed to send email' })
    }

    return res.json({ ok: true })
  } catch (e) {
    console.error('password-reset request error:', e)
    return res.status(500).json({ error: e.message || 'Server error' })
  }
}

async function handleConfirm(req, res) {
  try {
    const { token, newPassword } = req.body || {}
    const t = (token || '').trim()
    const pw = typeof newPassword === 'string' ? newPassword : ''
    if (!t || !pw || pw.length < 6) {
      return res.status(400).json({ error: 'Valid token and password (min 6 chars) required' })
    }

    const { rows: tokenRows } = await query(
      `SELECT value FROM app_store WHERE key = 'password_reset_tokens'`
    )
    let tokens = {}
    try {
      const raw = tokenRows[0]?.value
      tokens = raw && typeof raw === 'object' ? raw : (typeof raw === 'string' ? JSON.parse(raw) : {})
    } catch (_) {}

    const entry = tokens[t]
    if (!entry || entry.expiresAt < Date.now()) {
      return res.status(400).json({ error: 'Invalid or expired token' })
    }
    const email = (entry.email || '').toLowerCase()

    const { rows: storeRows } = await query(
      `SELECT key, value FROM app_store WHERE key IN ('all_members', 'padel_members')`
    )
    const allMembersRaw = storeRows.find(r => r.key === 'all_members')?.value
    const padelRaw = storeRows.find(r => r.key === 'padel_members')?.value

    let allMembers = []
    let padelMembers = []
    try {
      const am = Array.isArray(allMembersRaw) ? allMembersRaw : (typeof allMembersRaw === 'string' ? JSON.parse(allMembersRaw) : [])
      if (Array.isArray(am)) allMembers = am
    } catch (_) {}
    try {
      const pm = Array.isArray(padelRaw) ? padelRaw : (typeof padelRaw === 'string' ? JSON.parse(padelRaw) : [])
      if (Array.isArray(pm)) padelMembers = pm
    } catch (_) {}

    const byId = new Map()
    allMembers.forEach(m => { if (m?.id) byId.set(m.id, m) })
    padelMembers.forEach(m => { if (m?.id) byId.set(m.id, { ...byId.get(m.id), ...m }) })
    const members = Array.from(byId.values())

    const member = members.find(m => (m.email || '').toLowerCase() === email)
    if (!member) {
      delete tokens[t]
      await query(
        `INSERT INTO app_store (key, value, updated_at) VALUES ('password_reset_tokens', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
        [JSON.stringify(tokens)]
      )
      return res.status(400).json({ error: 'Member not found' })
    }

    member.password = pw
    const updated = members.map(m => (m.id === member.id ? member : m))
    const json = JSON.stringify(updated)

    await query(
      `INSERT INTO app_store (key, value, updated_at) VALUES ('all_members', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [json]
    )
    await query(
      `INSERT INTO app_store (key, value, updated_at) VALUES ('padel_members', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [json]
    )

    delete tokens[t]
    await query(
      `INSERT INTO app_store (key, value, updated_at) VALUES ('password_reset_tokens', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [JSON.stringify(tokens)]
    )

    return res.json({ ok: true })
  } catch (e) {
    console.error('password-reset confirm error:', e)
    return res.status(500).json({ error: e.message || 'Server error' })
  }
}

router.post('/request', handleRequest)
router.post('/confirm', handleConfirm)

export default router
