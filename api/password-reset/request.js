/**
 * POST /api/password-reset/request
 * Body: { email }
 * Sends password reset email via Resend.
 */
import { query } from '../lib/db.js'

const RESEND_API_URL = 'https://api.resend.com/emails'

function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

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

    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : (process.env.BASE_URL || 'http://localhost:3000')
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
        html: `
          <div dir="ltr" style="font-family:sans-serif;max-width:480px;margin:0 auto;">
            <h2>Password Reset</h2>
            <p>You requested a password reset. Click the link below to set a new password:</p>
            <p><a href="${resetUrl}" style="color:#2196f3;">Reset password</a></p>
            <p style="color:#666;font-size:12px;">Link expires in 1 hour. If you didn't request this, ignore this email.</p>
            <hr style="margin:24px 0;border:none;border-top:1px solid #eee;" />
            <h2 dir="rtl">استعادة كلمة المرور</h2>
            <p dir="rtl">طلبتم استعادة كلمة المرور. اضغط الرابط أدناه لتعيين كلمة مرور جديدة:</p>
            <p dir="rtl"><a href="${resetUrl}" style="color:#2196f3;">استعادة كلمة المرور</a></p>
            <p dir="rtl" style="color:#666;font-size:12px;">الرابط صالح لمدة ساعة.</p>
          </div>
        `
      })
    })

    if (!emailRes.ok) {
      const errText = await emailRes.text()
      console.error('Resend error:', emailRes.status, errText)
      return res.status(502).json({ error: 'Failed to send email' })
    }

    return res.json({ ok: true })
  } catch (e) {
    console.error('password-reset/request error:', e)
    return res.status(500).json({ error: e.message || 'Server error' })
  }
}
