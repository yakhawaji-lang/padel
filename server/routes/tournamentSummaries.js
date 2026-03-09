import { Router } from 'express'
import { query } from '../db/pool.js'

const router = Router()

/** GET /api/tournament-summaries?clubId= */
router.get('/', async (req, res) => {
  try {
    const { clubId } = req.query
    if (!clubId) return res.status(400).json({ error: 'Missing clubId' })
    const { rows } = await query(
      'SELECT id, data, saved_at FROM tournament_summaries WHERE club_id = ? ORDER BY saved_at DESC',
      [clubId]
    )
    res.json(rows.map(r => ({ ...r.data, id: r.id })))
  } catch (e) {
    console.error('tournament-summaries get error:', e)
    res.status(500).json({ error: e.message })
  }
})

/** POST /api/tournament-summaries */
router.post('/', async (req, res) => {
  try {
    const { clubId, ...data } = req.body
    if (!clubId) return res.status(400).json({ error: 'Missing clubId' })
    const savedAt = Date.now()
    const { insertId } = await query(
      'INSERT INTO tournament_summaries (club_id, data, saved_at) VALUES (?, ?, ?)',
      [clubId, JSON.stringify(data), savedAt]
    )
    res.json({ id: insertId })
  } catch (e) {
    console.error('tournament-summaries post error:', e)
    res.status(500).json({ error: e.message })
  }
})

export default router
