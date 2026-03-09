/**
 * POST /api/password-reset/confirm
 * Body: { token, newPassword }
 * Validates token and updates member password.
 */
import { query } from '../lib/db.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

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
    const userType = entry.userType || 'member'

    const { rows: storeRows } = await query(
      `SELECT key, value FROM app_store WHERE key IN ('all_members', 'padel_members', 'platform_admins', 'admin_clubs')`
    )
    const allMembersRaw = storeRows.find(r => r.key === 'all_members')?.value
    const padelRaw = storeRows.find(r => r.key === 'padel_members')?.value

    let allMembers = []
    let padelMembers = []
    try {
      const am = typeof allMembersRaw === 'string' ? JSON.parse(allMembersRaw) : allMembersRaw
      if (Array.isArray(am)) allMembers = am
    } catch (_) {}
    try {
      const pm = typeof padelRaw === 'string' ? JSON.parse(padelRaw) : padelRaw
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
        await query(`INSERT INTO app_store (key, value, updated_at) VALUES ('password_reset_tokens', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`, [JSON.stringify(tokens)])
        return res.status(400).json({ error: 'Admin not found' })
      }
      admin.password = pw
      await query(`INSERT INTO app_store (key, value, updated_at) VALUES ('platform_admins', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`, [JSON.stringify(platformAdmins)])
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
        await query(`INSERT INTO app_store (key, value, updated_at) VALUES ('password_reset_tokens', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`, [JSON.stringify(tokens)])
        return res.status(400).json({ error: 'Club not found' })
      }
      if (isOwner) {
        club.adminPassword = pw
      } else {
        const users = club.adminUsers || []
        const u = users.find(au => au.id === userId)
        if (u) u.password = pw
      }
      await query(`INSERT INTO app_store (key, value, updated_at) VALUES ('admin_clubs', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`, [JSON.stringify(clubs)])
    } else {
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
    }

    delete tokens[t]
    await query(
      `INSERT INTO app_store (key, value, updated_at) VALUES ('password_reset_tokens', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [JSON.stringify(tokens)]
    )

    return res.json({ ok: true })
  } catch (e) {
    console.error('password-reset/confirm error:', e)
    return res.status(500).json({ error: e.message || 'Server error' })
  }
}
