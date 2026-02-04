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
      `SELECT key, value FROM app_store WHERE \`key\` IN ('all_members', 'padel_members', 'platform_admins', 'admin_clubs')`
    )
    const getVal = (key) => {
      const r = storeRows.find(x => x.key === key)?.value
      if (Array.isArray(r)) return r
      if (typeof r === 'string') {
        try { return JSON.parse(r) } catch (_) { return [] }
      }
      return []
    }
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

    let userType = null
    let extra = {}
    const member = members.find(m => (m.email || '').toLowerCase() === em)
    if (member) {
      userType = 'member'
    } else {
      const platformAdmins = getVal('platform_admins')
      const platformAdmin = platformAdmins.find(a => (a.email || '').toLowerCase() === em)
      if (platformAdmin) {
        userType = 'platform_admin'
        extra = { adminId: platformAdmin.id }
      } else {
        const clubsRaw = storeRows.find(r => r.key === 'admin_clubs')?.value
        let clubs = []
        try {
          clubs = Array.isArray(clubsRaw) ? clubsRaw : (typeof clubsRaw === 'string' ? JSON.parse(clubsRaw) : [])
        } catch (_) {}
        for (const c of clubs) {
          if ((c.adminEmail || c.email || '').toLowerCase() === em) {
            userType = 'club_admin'
            extra = { clubId: c.id, isOwner: true }
            break
          }
          const users = c.adminUsers || []
          const u = users.find(au => (au.email || '').toLowerCase() === em)
          if (u) {
            userType = 'club_admin'
            extra = { clubId: c.id, isOwner: false, userId: u.id }
            break
          }
        }
      }
    }

    if (!userType) {
      return res.json({ ok: true })
    }

    const token = randomToken()
    const expiresAt = Date.now() + 60 * 60 * 1000

    const { rows: tokenRows } = await query(
      `SELECT value FROM app_store WHERE \`key\` = 'password_reset_tokens'`
    )
    let tokens = {}
    try {
      const raw = tokenRows[0]?.value
      tokens = raw && typeof raw === 'object' ? raw : (typeof raw === 'string' ? JSON.parse(raw) : {})
    } catch (_) {}
    tokens[token] = { email: em, expiresAt, userType, ...extra }
    await query(
      `INSERT INTO app_store (\`key\`, value, updated_at) VALUES ('password_reset_tokens', ?, NOW())
       ON DUPLICATE KEY UPDATE value = ?, updated_at = NOW()`,
      [JSON.stringify(tokens), JSON.stringify(tokens)]
    )

    const baseUrl = process.env.BASE_URL || 'http://localhost:3000'
    const resetUrl = `${baseUrl}/reset-password?token=${token}${userType !== 'member' ? '&type=' + userType : ''}`

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
      let errJson = {}
      try { errJson = JSON.parse(errText) } catch (_) {}
      const msg = errJson?.message || errText || 'Failed to send email'
      console.error('Resend error:', emailRes.status, msg)
      if (emailRes.status === 403 && /own email|verify.*domain/i.test(msg)) {
        return res.status(403).json({
          error: 'Resend requires a verified domain to send to this email. Add and verify your domain at resend.com/domains'
        })
      }
      return res.status(502).json({ error: msg || 'Failed to send email' })
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
      `SELECT value FROM app_store WHERE \`key\` = 'password_reset_tokens'`
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
    const userType = entry.userType || 'member'

    const { rows: storeRows } = await query(
      `SELECT key, value FROM app_store WHERE \`key\` IN ('all_members', 'padel_members', 'platform_admins', 'admin_clubs')`
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

    if (userType === 'platform_admin') {
      const platformAdminsRaw = storeRows.find(r => r.key === 'platform_admins')?.value
      let platformAdmins = []
      try {
        platformAdmins = Array.isArray(platformAdminsRaw) ? platformAdminsRaw : (typeof platformAdminsRaw === 'string' ? JSON.parse(platformAdminsRaw) : [])
      } catch (_) {}
      const admin = platformAdmins.find(a => (a.email || '').toLowerCase() === email)
      if (!admin) {
        delete tokens[t]
        await query(`INSERT INTO app_store (\`key\`, value, updated_at) VALUES ('password_reset_tokens', ?, NOW()) ON DUPLICATE KEY UPDATE value = ?, updated_at = NOW()`, [JSON.stringify(tokens), JSON.stringify(tokens)])
        return res.status(400).json({ error: 'Admin not found' })
      }
      admin.password = pw
      await query(`INSERT INTO app_store (\`key\`, value, updated_at) VALUES ('platform_admins', ?, NOW()) ON DUPLICATE KEY UPDATE value = ?, updated_at = NOW()`, [JSON.stringify(platformAdmins), JSON.stringify(platformAdmins)])
    } else if (userType === 'club_admin') {
      const clubsRaw = storeRows.find(r => r.key === 'admin_clubs')?.value
      let clubs = []
      try {
        clubs = Array.isArray(clubsRaw) ? clubsRaw : (typeof clubsRaw === 'string' ? JSON.parse(clubsRaw) : [])
      } catch (_) {}
      const clubId = entry.clubId
      const isOwner = entry.isOwner
      const userId = entry.userId
      const club = clubs.find(c => c.id === clubId)
      if (!club) {
        delete tokens[t]
        await query(`INSERT INTO app_store (\`key\`, value, updated_at) VALUES ('password_reset_tokens', ?, NOW()) ON DUPLICATE KEY UPDATE value = ?, updated_at = NOW()`, [JSON.stringify(tokens), JSON.stringify(tokens)])
        return res.status(400).json({ error: 'Club not found' })
      }
      if (isOwner) {
        club.adminPassword = pw
      } else {
        const users = club.adminUsers || []
        const u = users.find(au => au.id === userId)
        if (u) u.password = pw
      }
      await query(`INSERT INTO app_store (\`key\`, value, updated_at) VALUES ('admin_clubs', ?, NOW()) ON DUPLICATE KEY UPDATE value = ?, updated_at = NOW()`, [JSON.stringify(clubs), JSON.stringify(clubs)])
    } else {
      const member = members.find(m => (m.email || '').toLowerCase() === email)
      if (!member) {
        delete tokens[t]
        await query(
          `INSERT INTO app_store (key, value, updated_at) VALUES ('password_reset_tokens', $1, NOW())
           ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
          [JSON.stringify(tokens), JSON.stringify(tokens)]
        )
        return res.status(400).json({ error: 'Member not found' })
      }
      member.password = pw
      const updated = members.map(m => (m.id === member.id ? member : m))
      const json = JSON.stringify(updated)
      await query(`INSERT INTO app_store (\`key\`, value, updated_at) VALUES ('all_members', ?, NOW()) ON DUPLICATE KEY UPDATE value = ?, updated_at = NOW()`, [json, json])
      await query(`INSERT INTO app_store (\`key\`, value, updated_at) VALUES ('padel_members', ?, NOW()) ON DUPLICATE KEY UPDATE value = ?, updated_at = NOW()`, [json, json])
    }

    delete tokens[t]
    await query(
      `INSERT INTO app_store (\`key\`, value, updated_at) VALUES ('password_reset_tokens', ?, NOW())
       ON DUPLICATE KEY UPDATE value = ?, updated_at = NOW()`,
      [JSON.stringify(tokens), JSON.stringify(tokens)]
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
