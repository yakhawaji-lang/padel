import { Router } from 'express'
import { query } from '../db/pool.js'

const router = Router()

/** GET /api/member-stats - Get by memberId or clubId */
router.get('/', async (req, res) => {
  try {
    const { memberId, clubId } = req.query
    let q = 'SELECT id, club_id, member_id, tournament_id, data, saved_at FROM member_stats WHERE 1=1'
    const params = []
    let i = 1
    if (memberId) { q += ` AND member_id = $${i++}`; params.push(memberId) }
    if (clubId) { q += ` AND club_id = $${i++}`; params.push(clubId) }
    q += ' ORDER BY saved_at DESC'
    const { rows } = await query(q, params)
    res.json(rows.map(r => ({ ...r.data, id: r.id })))
  } catch (e) {
    console.error('member-stats get error:', e)
    res.status(500).json({ error: e.message })
  }
})

/** POST /api/member-stats */
router.post('/', async (req, res) => {
  try {
    const { clubId, memberId, tournamentId, ...data } = req.body
    if (!clubId || !memberId || tournamentId == null) {
      return res.status(400).json({ error: 'Missing clubId, memberId or tournamentId' })
    }
    const savedAt = Date.now()
    const { rows } = await query(
      `INSERT INTO member_stats (club_id, member_id, tournament_id, data, saved_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [clubId, memberId, parseInt(tournamentId, 10), JSON.stringify(data), savedAt]
    )
    res.json({ id: rows[0].id })
  } catch (e) {
    console.error('member-stats post error:', e)
    res.status(500).json({ error: e.message })
  }
})

export default router
