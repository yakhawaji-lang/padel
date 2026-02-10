/**
 * Clubs API - Join club (persist membership to member_clubs in DB)
 */
import { Router } from 'express'
import { query } from '../db/pool.js'
import { hasNormalizedTables } from '../db/normalizedData.js'

const router = Router()

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
    await query('INSERT IGNORE INTO member_clubs (member_id, club_id) VALUES (?, ?)', [mid, cid])
    res.json({ ok: true })
  } catch (e) {
    console.error('clubs join error:', e)
    res.status(500).json({ error: e?.message || 'Database error' })
  }
})

export default router
