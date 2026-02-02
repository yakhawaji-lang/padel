/**
 * Vercel Serverless: DELETE /api/matches/by-date
 */
import { query } from '../lib/db.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' })

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
    return res.json({ ok: true })
  } catch (e) {
    console.error('matches by-date error:', e)
    return res.status(500).json({ error: e.message })
  }
}
