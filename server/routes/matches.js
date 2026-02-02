import { Router } from 'express'
import { query } from '../db/pool.js'

const router = Router()

/** GET /api/matches - Get all matches. Query: ?clubId=&tournamentType=&tournamentId= */
router.get('/', async (req, res) => {
  try {
    const { clubId, tournamentType, tournamentId } = req.query
    let q = 'SELECT id, club_id, tournament_type, tournament_id, data, saved_at FROM matches WHERE 1=1'
    const params = []
    let i = 1
    if (clubId) { q += ` AND club_id = $${i++}`; params.push(clubId) }
    if (tournamentType) { q += ` AND tournament_type = $${i++}`; params.push(tournamentType) }
    if (tournamentId != null) { q += ` AND tournament_id = $${i++}`; params.push(parseInt(tournamentId, 10)) }
    q += ' ORDER BY saved_at ASC'
    const { rows } = await query(q, params)
    const result = rows.map(r => ({
      id: r.id,
      ...r.data,
      tournamentType: r.tournament_type,
      tournamentId: r.tournament_id,
      savedAt: Number(r.saved_at),
      timestamp: Number(r.saved_at)
    }))
    res.json(result)
  } catch (e) {
    console.error('matches get error:', e)
    res.status(500).json({ error: e.message })
  }
})

/** POST /api/matches - Add match. Body: { clubId, tournamentType, tournamentId, ...matchData } */
router.post('/', async (req, res) => {
  try {
    const { clubId, tournamentType, tournamentId, ...rest } = req.body
    if (!clubId || !tournamentType || tournamentId == null) {
      return res.status(400).json({ error: 'Missing clubId, tournamentType or tournamentId' })
    }
    const savedAt = Date.now()
    const data = { ...rest }
    const { rows } = await query(
      `INSERT INTO matches (club_id, tournament_type, tournament_id, data, saved_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [clubId, tournamentType, parseInt(tournamentId, 10), JSON.stringify(data), savedAt]
    )
    res.json({ id: rows[0].id, savedAt })
  } catch (e) {
    console.error('matches post error:', e)
    res.status(500).json({ error: e.message })
  }
})

/** DELETE /api/matches - Delete by tournament. Query: ?clubId=&tournamentId=&tournamentType= */
router.delete('/', async (req, res) => {
  try {
    const { clubId, tournamentId, tournamentType } = req.query
    if (!clubId || tournamentId == null || !tournamentType) {
      return res.status(400).json({ error: 'Missing clubId, tournamentId or tournamentType' })
    }
    await query(
      'DELETE FROM matches WHERE club_id = $1 AND tournament_id = $2 AND tournament_type = $3',
      [clubId, parseInt(tournamentId, 10), tournamentType]
    )
    res.json({ ok: true })
  } catch (e) {
    console.error('matches delete error:', e)
    res.status(500).json({ error: e.message })
  }
})

/** DELETE /api/matches/by-date - Delete by date and type. Query: ?clubId=&date=&tournamentType= */
router.delete('/by-date', async (req, res) => {
  try {
    const { clubId, date, tournamentType } = req.query
    if (!clubId || !date || !tournamentType) {
      return res.status(400).json({ error: 'Missing clubId, date or tournamentType' })
    }
    const d = new Date(date)
    const start = d.setHours(0, 0, 0, 0)
    const end = d.setHours(23, 59, 59, 999)
    await query(
      'DELETE FROM matches WHERE club_id = $1 AND tournament_type = $2 AND saved_at >= $3 AND saved_at <= $4',
      [clubId, tournamentType, start, end]
    )
    res.json({ ok: true })
  } catch (e) {
    console.error('matches delete by date error:', e)
    res.status(500).json({ error: e.message })
  }
})

export default router
