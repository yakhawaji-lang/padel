/**
 * Vercel Serverless: /api/member-stats
 */
import { query } from './lib/db.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    if (req.method === 'GET') {
      const { memberId, clubId } = req.query
      let sql = 'SELECT id, club_id, member_id, tournament_id, data, saved_at FROM member_stats WHERE 1=1'
      const params = []
      let i = 1
      if (memberId) { sql += ` AND member_id = $${i++}`; params.push(memberId) }
      if (clubId) { sql += ` AND club_id = $${i++}`; params.push(clubId) }
      sql += ' ORDER BY saved_at DESC'
      const { rows } = await query(sql, params)
      return res.json(rows.map(r => ({ ...r.data, id: r.id })))
    }
    if (req.method === 'POST') {
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
      return res.json({ id: rows[0].id })
    }
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    console.error('member-stats error:', e)
    return res.status(500).json({ error: e.message })
  }
}
