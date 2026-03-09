/**
 * Vercel Serverless: /api/matches - GET, POST, DELETE
 */
import { query } from './lib/db.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    if (req.method === 'DELETE') {
      const { clubId, tournamentId, tournamentType } = req.query
      if (!clubId || tournamentId == null || !tournamentType) {
        return res.status(400).json({ error: 'Missing clubId, tournamentId or tournamentType' })
      }
      await query(
        'DELETE FROM matches WHERE club_id = $1 AND tournament_id = $2 AND tournament_type = $3',
        [clubId, parseInt(tournamentId, 10), tournamentType]
      )
      return res.json({ ok: true })
    }
    if (req.method === 'GET') {
      const { clubId, tournamentType, tournamentId } = req.query
      let sql = 'SELECT id, club_id, tournament_type, tournament_id, data, saved_at FROM matches WHERE 1=1'
      const params = []
      let i = 1
      if (clubId) { sql += ` AND club_id = $${i++}`; params.push(clubId) }
      if (tournamentType) { sql += ` AND tournament_type = $${i++}`; params.push(tournamentType) }
      if (tournamentId != null) { sql += ` AND tournament_id = $${i++}`; params.push(parseInt(tournamentId, 10)) }
      sql += ' ORDER BY saved_at ASC'
      const { rows } = await query(sql, params)
      const result = rows.map(r => ({
        id: r.id,
        ...r.data,
        tournamentType: r.tournament_type,
        tournamentId: r.tournament_id,
        savedAt: Number(r.saved_at),
        timestamp: Number(r.saved_at)
      }))
      return res.json(result)
    }
    if (req.method === 'POST') {
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
      return res.json({ id: rows[0].id, savedAt })
    }
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    console.error('matches error:', e)
    return res.status(500).json({ error: e.message })
  }
}
