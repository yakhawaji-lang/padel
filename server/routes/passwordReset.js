import { Router } from 'express'
import { getEntities, setEntities, getSetting, setSetting } from '../db/dataHelpers.js'

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

    const [membersArr, platformAdmins, clubs] = await Promise.all([
      getEntities('member'),
      getEntities('platform_admin'),
      getEntities('club')
    ])
    const byId = new Map()
    membersArr.forEach(m => { if (m?.id) byId.set(m.id, m) })
    const members = Array.from(byId.values())

    let userType = null
    let extra = {}
    const member = members.find(m => (m.email || '').toLowerCase() === em)
    if (member) {
      userType = 'member'
    } else {
      const platformAdmin = platformAdmins.find(a => (a.email || '').toLowerCase() === em)
      if (platformAdmin) {
        userType = 'platform_admin'
        extra = { adminId: platformAdmin.id }
      } else {
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

    let tokens = (await getSetting('password_reset_tokens')) || {}
    if (typeof tokens !== 'object') tokens = {}
    tokens[token] = { email: em, expiresAt, userType, ...extra }
    await setSetting('password_reset_tokens', tokens)

    const baseUrl = process.env.BASE_URL || 'https://playtix.app/app'
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

    let tokens = (await getSetting('password_reset_tokens')) || {}
    if (typeof tokens !== 'object') tokens = {}

    const entry = tokens[t]
    if (!entry || entry.expiresAt < Date.now()) {
      return res.status(400).json({ error: 'Invalid or expired token' })
    }
    const email = (entry.email || '').toLowerCase()
    const userType = entry.userType || 'member'

    const members = await getEntities('member')

    if (userType === 'platform_admin') {
      const platformAdmins = await getEntities('platform_admin')
      const admin = platformAdmins.find(a => (a.email || '').toLowerCase() === email)
      if (!admin) {
        delete tokens[t]
        await setSetting('password_reset_tokens', tokens)
        return res.status(400).json({ error: 'Admin not found' })
      }
      admin.password = pw
      await setEntities('platform_admin', platformAdmins)
    } else if (userType === 'club_admin') {
      const clubs = await getEntities('club')
      const clubId = entry.clubId
      const isOwner = entry.isOwner
      const userId = entry.userId
      const club = clubs.find(c => c.id === clubId)
      if (!club) {
        delete tokens[t]
        await setSetting('password_reset_tokens', tokens)
        return res.status(400).json({ error: 'Club not found' })
      }
      if (isOwner) {
        club.adminPassword = pw
      } else {
        const users = club.adminUsers || []
        const u = users.find(au => au.id === userId)
        if (u) u.password = pw
      }
      await setEntities('club', clubs)
    } else {
      const member = members.find(m => (m.email || '').toLowerCase() === email)
      if (!member) {
        delete tokens[t]
        await setSetting('password_reset_tokens', tokens)
        return res.status(400).json({ error: 'Member not found' })
      }
      member.password = pw
      const updated = members.map(m => (m.id === member.id ? member : m))
      await setEntities('member', updated)
    }

    delete tokens[t]
    await setSetting('password_reset_tokens', tokens)

    return res.json({ ok: true })
  } catch (e) {
    console.error('password-reset confirm error:', e)
    return res.status(500).json({ error: e.message || 'Server error' })
  }
}

async function handleChange(req, res) {
  try {
    const { memberId, currentPassword, newPassword } = req.body || {}
    const id = (memberId || '').toString().trim()
    const current = typeof currentPassword === 'string' ? currentPassword : ''
    const newPw = typeof newPassword === 'string' ? newPassword : ''
    if (!id || !current || !newPw || newPw.length < 6) {
      return res.status(400).json({ error: 'memberId, current password and new password (min 6 chars) required' })
    }

    const members = await getEntities('member')
    const member = members.find(m => (m.id || '').toString() === id)
    if (!member) {
      return res.status(404).json({ error: 'Member not found' })
    }
    const stored = (member.password || member.password_hash || '').toString()
    if (stored !== current) {
      return res.status(400).json({ error: 'Current password is incorrect' })
    }

    member.password = newPw
    if (member.password_hash !== undefined) member.password_hash = newPw
    const updated = members.map(m => (m.id === member.id || (m.id || '').toString() === id ? member : m))
    await setEntities('member', updated)

    return res.json({ ok: true })
  } catch (e) {
    console.error('password-reset change error:', e)
    return res.status(500).json({ error: e.message || 'Server error' })
  }
}

router.post('/request', handleRequest)
router.post('/confirm', handleConfirm)
router.post('/change', handleChange)

export default router
