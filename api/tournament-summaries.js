/**
 * Vercel Serverless: /api/tournament-summaries
 */
import { query } from './lib/db.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    if (req.method === 'GET') {
      const { clubId } = req.query
      if (!clubId) return res.status(400).json({ error: 'Missing clubId' })
      const { rows } = await query(
        'SELECT id, data, saved_at FROM tournament_summaries WHERE club_id = $1 ORDER BY saved_at DESC',
        [clubId]
      )
      return res.json(rows.map(r => ({ ...r.data, id: r.id })))
    }
    if (req.method === 'POST') {
      const { clubId, ...data } = req.body
      if (!clubId) return res.status(400).json({ error: 'Missing clubId' })
      const savedAt = Date.now()
      const { rows } = await query(
        'INSERT INTO tournament_summaries (club_id, data, saved_at) VALUES ($1, $2, $3) RETURNING id',
        [clubId, JSON.stringify(data), savedAt]
      )
      return res.json({ id: rows[0].id })
    }
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    console.error('tournament-summaries error:', e)
    return res.status(500).json({ error: e.message })
  }
}
