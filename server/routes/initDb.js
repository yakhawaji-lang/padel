import { Router } from 'express'
import { query } from '../db/pool.js'

const router = Router()

const STMTS = [
  `CREATE TABLE IF NOT EXISTS app_store (\`key\` VARCHAR(255) PRIMARY KEY, value JSON NOT NULL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS matches (id INT AUTO_INCREMENT PRIMARY KEY, club_id VARCHAR(255) NOT NULL, tournament_type VARCHAR(255) NOT NULL, tournament_id INT NOT NULL, data JSON NOT NULL, saved_at BIGINT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, INDEX idx_matches_club (club_id), INDEX idx_matches_tournament (club_id, tournament_type, tournament_id), INDEX idx_matches_saved_at (saved_at))`,
  `CREATE TABLE IF NOT EXISTS member_stats (id INT AUTO_INCREMENT PRIMARY KEY, club_id VARCHAR(255) NOT NULL, member_id VARCHAR(255) NOT NULL, tournament_id INT NOT NULL, data JSON NOT NULL, saved_at BIGINT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, INDEX idx_member_stats_club (club_id), INDEX idx_member_stats_member (member_id))`,
  `CREATE TABLE IF NOT EXISTS tournament_summaries (id INT AUTO_INCREMENT PRIMARY KEY, club_id VARCHAR(255) NOT NULL, data JSON NOT NULL, saved_at BIGINT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, INDEX idx_tournament_summaries_club (club_id))`,
  `INSERT IGNORE INTO app_store (\`key\`, value) VALUES ('admin_clubs', '[]')`
]

router.get('/', (req, res) => {
  const hasDb = !!process.env.DATABASE_URL
  res.json({
    configured: hasDb,
    hint: !hasDb ? 'Add DATABASE_URL in Hostinger Environment Variables' : 'Use POST to initialize tables'
  })
})

router.post('/', async (req, res) => {
  const secret = process.env.INIT_DB_SECRET
  if (secret && req.headers['x-init-secret'] !== secret) {
    return res.status(403).json({ error: 'Invalid or missing X-Init-Secret' })
  }
  try {
    for (let i = 0; i < STMTS.length; i++) {
      try {
        await query(STMTS[i])
      } catch (stmtErr) {
        console.error('init-db stmt', i, 'failed:', stmtErr.message)
        throw new Error(`Statement ${i + 1} failed: ${stmtErr.message}`)
      }
    }
    res.json({ ok: true, message: 'Database initialized successfully' })
  } catch (e) {
    console.error('init-db error:', e)
    res.status(500).json({
      error: e.message || 'Database init failed',
      hint: !process.env.DATABASE_URL ? 'Set DATABASE_URL in Hostinger env' : 'Check MySQL credentials and that DB exists'
    })
  }
})

export default router
