/**
 * Vercel Serverless: GET /api/store/:key
 */
import { query } from '../lib/db.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const key = req.query.key
    if (!key) return res.status(400).json({ error: 'Missing key' })
    const { rows } = await query('SELECT value FROM app_store WHERE key = $1', [key])
    if (rows.length === 0) return res.json(null)
    return res.json(rows[0].value)
  } catch (e) {
    console.error('store get error:', e)
    return res.status(500).json({ error: e.message })
  }
}
