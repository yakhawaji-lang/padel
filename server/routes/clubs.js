/**
 * Clubs API - Join club (persist membership to member_clubs in DB)
 */
import { Router } from 'express'
import { query } from '../db/pool.js'
import { hasNormalizedTables } from '../db/normalizedData.js'
import { getActorFromRequest, logAudit } from '../db/audit.js'
import { addMemberToClub } from '../services/membershipService.js'
import { sendPlatformMessage } from '../services/messageSend.js'
import { getClubWelcomeMessage } from '../services/whatsappSend.js'

const router = Router()

function assertClubAdminOrPlatform(actor, clubId) {
  const at = String(actor.actorType || '').toLowerCase()
  if (at === 'platform_admin') return true
  if (at === 'club_admin') {
    return actor.clubId && String(actor.clubId) === String(clubId)
  }
  return false
}

/** POST /api/clubs/join - Add member to club, persist to member_clubs (u502561206_padel_db) */
router.post('/join', async (req, res) => {
  try {
    const { clubId, memberId } = req.body || {}
    if (!clubId || !memberId) {
      return res.status(400).json({ error: 'clubId and memberId required' })
    }
    const normalized = await hasNormalizedTables()
    if (!normalized) {
      return res.status(400).json({ error: 'Normalized tables required. Run migrations first.' })
    }
    const cid = String(clubId).trim()
    const mid = String(memberId).trim()
    const { rows: clubRows } = await query('SELECT id FROM clubs WHERE id = ? AND deleted_at IS NULL', [cid])
    if (!clubRows?.length) {
      return res.status(404).json({ error: 'Club not found' })
    }
    const { rows: memberRows } = await query('SELECT id FROM members WHERE id = ? AND deleted_at IS NULL', [mid])
    if (!memberRows?.length) {
      const { rows: storeRows } = await query(
        "SELECT value FROM app_store WHERE `key` IN ('all_members', 'padel_members')"
      )
      let memberData = null
      for (const r of storeRows || []) {
        const arr = Array.isArray(r.value) ? r.value : (typeof r.value === 'string' ? (() => { try { return JSON.parse(r.value || '[]') } catch { return [] } })() : [])
        const m = arr.find(x => String(x?.id) === mid)
        if (m) { memberData = m; break }
      }
      if (memberData) {
        const mobileVal = memberData.mobile ?? memberData.phone ?? null
        const pwVal = memberData.password ?? memberData.password_hash ?? null
        try {
          await query(
            `INSERT INTO members (id, name, name_ar, email, avatar, mobile, password_hash, total_points, total_games, total_wins, points_history)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [mid, memberData.name || '', memberData.nameAr || null, memberData.email || null, memberData.avatar || null,
             mobileVal, pwVal, memberData.totalPoints ?? 0, memberData.totalGames ?? 0, memberData.totalWins ?? 0,
             JSON.stringify(memberData.pointsHistory || [])]
          )
        } catch (e) {
          if (e?.message?.includes('Unknown column') && (e?.message?.includes('password_hash') || e?.message?.includes('mobile'))) {
            await query(
              `INSERT INTO members (id, name, name_ar, email, avatar, total_points, total_games, total_wins, points_history)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [mid, memberData.name || '', memberData.nameAr || null, memberData.email || null, memberData.avatar || null,
               memberData.totalPoints ?? 0, memberData.totalGames ?? 0, memberData.totalWins ?? 0,
               JSON.stringify(memberData.pointsHistory || [])]
            )
          } else if (!e?.message?.includes('Duplicate')) throw e
        }
      } else {
        return res.status(404).json({ error: 'Member not found. Register first.' })
      }
    }
    await addMemberToClub(mid, cid)

    // Send club welcome WhatsApp (fire-and-forget)
    try {
      const { rows: memberRows2 } = await query('SELECT mobile FROM members WHERE id = ? AND deleted_at IS NULL', [mid])
      const phone = memberRows2?.[0]?.mobile
      if (phone && String(phone).replace(/\D/g, '').length >= 9) {
        const { rows: clubRows2 } = await query('SELECT name, name_ar FROM clubs WHERE id = ? AND deleted_at IS NULL', [cid])
        const clubName = clubRows2?.[0]?.name_ar || clubRows2?.[0]?.name || ''
        const msg = getClubWelcomeMessage(clubName)
        sendPlatformMessage(phone, msg).catch(e => console.warn('[Platform message club welcome]', e?.message))
      }
    } catch (waErr) {
      console.warn('[Platform message club welcome]', waErr?.message)
    }

    res.json({ ok: true })
  } catch (e) {
    console.error('clubs join error:', e)
    res.status(500).json({ error: e?.message || 'Database error' })
  }
})

/**
 * POST /api/clubs/directory-favorites
 * يضيف عضواً إلى «مفضلة دليل النادي» (مالك/أدمن النادي أو منصة)
 */
router.post('/directory-favorites', async (req, res) => {
  try {
    const normalized = await hasNormalizedTables()
    if (!normalized) return res.status(400).json({ error: 'Normalized tables required' })
    const { clubId, memberId } = req.body || {}
    if (!clubId || !memberId) return res.status(400).json({ error: 'clubId and memberId required' })
    const cid = String(clubId).trim()
    const mid = String(memberId).trim()
    const actor = getActorFromRequest(req)
    if (!assertClubAdminOrPlatform(actor, cid)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const { rows: mc } = await query(
      'SELECT 1 FROM member_clubs WHERE club_id = ? AND member_id = ? LIMIT 1',
      [cid, mid]
    )
    if (!mc?.length) return res.status(400).json({ error: 'Member is not in this club directory' })
    await query(
      `INSERT INTO club_directory_favorites (club_id, member_id, created_by_actor_id) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE created_by_actor_id = VALUES(created_by_actor_id)`,
      [cid, mid, actor.actorId || null]
    )
    await logAudit({
      tableName: 'club_directory_favorites',
      recordId: `${cid}:${mid}`,
      action: 'INSERT',
      actorType: actor.actorType || 'system',
      actorId: actor.actorId,
      actorName: actor.actorName,
      clubId: cid,
      ipAddress: actor.ipAddress,
      newValue: { memberId: mid },
    })
    res.json({ ok: true })
  } catch (e) {
    const msg = e?.message || ''
    if (msg.includes("doesn't exist") || msg.includes('Unknown table')) {
      return res.status(503).json({ error: 'club_directory_favorites table missing — run SQL migration' })
    }
    console.error('clubs directory-favorites POST:', e)
    res.status(500).json({ error: msg || 'Database error' })
  }
})

/**
 * DELETE /api/clubs/directory-favorites?clubId=&memberId=
 */
router.delete('/directory-favorites', async (req, res) => {
  try {
    const normalized = await hasNormalizedTables()
    if (!normalized) return res.status(400).json({ error: 'Normalized tables required' })
    const clubId = req.query.clubId || req.body?.clubId
    const memberId = req.query.memberId || req.body?.memberId
    if (!clubId || !memberId) return res.status(400).json({ error: 'clubId and memberId required' })
    const cid = String(clubId).trim()
    const mid = String(memberId).trim()
    const actor = getActorFromRequest(req)
    if (!assertClubAdminOrPlatform(actor, cid)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    await query('DELETE FROM club_directory_favorites WHERE club_id = ? AND member_id = ?', [cid, mid])
    await logAudit({
      tableName: 'club_directory_favorites',
      recordId: `${cid}:${mid}`,
      action: 'DELETE',
      actorType: actor.actorType || 'system',
      actorId: actor.actorId,
      actorName: actor.actorName,
      clubId: cid,
      ipAddress: actor.ipAddress,
      oldValue: { memberId: mid },
    })
    res.json({ ok: true })
  } catch (e) {
    const msg = e?.message || ''
    if (msg.includes("doesn't exist") || msg.includes('Unknown table')) {
      return res.status(503).json({ error: 'club_directory_favorites table missing — run SQL migration' })
    }
    console.error('clubs directory-favorites DELETE:', e)
    res.status(500).json({ error: msg || 'Database error' })
  }
})

export default router
