/**
 * Vercel Serverless: POST /api/store/batch
 */
import { query } from '../lib/db.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { items } = req.body
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Missing items array' })
    }
    for (const { key, value } of items) {
      if (!key) continue
      await query(
        `INSERT INTO app_store (key, value, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, JSON.stringify(value ?? null)]
      )
    }
    return res.json({ ok: true })
  } catch (e) {
    console.error('store batch error:', e)
    return res.status(500).json({ error: e.message })
  }
}
