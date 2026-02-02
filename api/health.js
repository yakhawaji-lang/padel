/**
 * Vercel Serverless: GET /api/health
 */
import { isConnected } from './lib/db.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(204).end()
  res.json({ ok: true, db: isConnected() })
}
