/**
 * Vercel Serverless: GET /api/store?keys=... and POST /api/store
 */
import { query } from './lib/db.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    if (req.method === 'GET') {
      const keysParam = req.query.keys
      if (!keysParam) return res.status(400).json({ error: 'Missing keys query param' })
      const keys = keysParam.split(',').map(k => k.trim()).filter(Boolean)
      if (keys.length === 0) return res.json({})
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(',')
      const { rows } = await query(
        `SELECT key, value FROM app_store WHERE key IN (${placeholders})`,
        keys
      )
      const result = {}
      rows.forEach(r => { result[r.key] = r.value })
      return res.json(result)
    }
    if (req.method === 'POST') {
      const { key, value } = req.body
      if (!key) return res.status(400).json({ error: 'Missing key' })
      await query(
        `INSERT INTO app_store (key, value, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, JSON.stringify(value ?? null)]
      )
      return res.json({ ok: true })
    }
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    console.error('store error:', e)
    const msg = e.message || 'Database error'
    const hint = msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')
      ? ' Check DATABASE_URL in Vercel env and redeploy.'
      : ''
    return res.status(500).json({ error: msg + hint })
  }
}
