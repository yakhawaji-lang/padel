import { Router } from 'express'
import { query } from '../db/pool.js'

const router = Router()

const STMTS = [
  `CREATE TABLE IF NOT EXISTS app_store (key TEXT PRIMARY KEY, value JSONB NOT NULL DEFAULT '[]'::jsonb, updated_at TIMESTAMPTZ DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS matches (id SERIAL PRIMARY KEY, club_id TEXT NOT NULL, tournament_type TEXT NOT NULL, tournament_id INTEGER NOT NULL, data JSONB NOT NULL, saved_at BIGINT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())`,
  `CREATE INDEX IF NOT EXISTS idx_matches_club ON matches(club_id)`,
  `CREATE INDEX IF NOT EXISTS idx_matches_tournament ON matches(club_id, tournament_type, tournament_id)`,
  `CREATE INDEX IF NOT EXISTS idx_matches_saved_at ON matches(saved_at)`,
  `CREATE TABLE IF NOT EXISTS member_stats (id SERIAL PRIMARY KEY, club_id TEXT NOT NULL, member_id TEXT NOT NULL, tournament_id INTEGER NOT NULL, data JSONB NOT NULL, saved_at BIGINT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())`,
  `CREATE INDEX IF NOT EXISTS idx_member_stats_club ON member_stats(club_id)`,
  `CREATE INDEX IF NOT EXISTS idx_member_stats_member ON member_stats(member_id)`,
  `CREATE TABLE IF NOT EXISTS tournament_summaries (id SERIAL PRIMARY KEY, club_id TEXT NOT NULL, data JSONB NOT NULL, saved_at BIGINT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())`,
  `CREATE INDEX IF NOT EXISTS idx_tournament_summaries_club ON tournament_summaries(club_id)`,
  `INSERT INTO app_store (key, value) VALUES ('admin_clubs', '[]'::jsonb) ON CONFLICT (key) DO NOTHING`
]

router.post('/', async (req, res) => {
  const secret = process.env.INIT_DB_SECRET
  if (secret && req.headers['x-init-secret'] !== secret) {
    return res.status(403).json({ error: 'Invalid or missing X-Init-Secret' })
  }
  try {
    for (const stmt of STMTS) {
      await query(stmt)
    }
    res.json({ ok: true, message: 'Database initialized successfully' })
  } catch (e) {
    console.error('init-db error:', e)
    res.status(500).json({ error: e.message || 'Database init failed' })
  }
})

export default router
