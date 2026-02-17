import { config } from 'dotenv'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const cwd = process.cwd()
;[
  join(root, '.env.local'),
  join(root, '.env'),
  join(cwd, '.env.local'),
  join(cwd, '.env'),
  join(cwd, '..', '.env'),
].forEach((p) => { if (existsSync(p)) config({ path: p }) })

import express from 'express'
import cors from 'cors'
import storeRouter from './routes/store.js'
import matchesRouter from './routes/matches.js'
import memberStatsRouter from './routes/memberStats.js'
import tournamentSummariesRouter from './routes/tournamentSummaries.js'
import passwordResetRouter from './routes/passwordReset.js'
import whatsappWebhookRouter from './routes/whatsappWebhook.js'
import initDbRouter from './routes/initDb.js'
import dataRouter from './routes/data.js'
import bookingsRouter from './routes/bookings.js'
import clubsRouter from './routes/clubs.js'
import settingsUploadRouter from './routes/settingsUpload.js'
import { isConnected, getDbDiagnostics, getCurrentDatabase } from './db/pool.js'
import { startBookingJobs } from './jobs/bookingJobs.js'

const app = express()
const PORT = process.env.PORT || 4000
const HOST = process.env.HOST || '0.0.0.0'

app.use(cors({ origin: true, credentials: true }))
// Settings upload uses large base64 bodies; must be before global json parser
app.use('/api/settings', express.json({ limit: '50mb' }), settingsUploadRouter)
app.use(express.json({ limit: '10mb' }))

app.use('/api/store', storeRouter)
app.use('/api/matches', matchesRouter)
app.use('/api/member-stats', memberStatsRouter)
app.use('/api/tournament-summaries', tournamentSummariesRouter)
app.use('/api/password-reset', passwordResetRouter)
app.use('/api/whatsapp-webhook', whatsappWebhookRouter)
app.use('/api/init-db', initDbRouter)
app.use('/api/data', dataRouter)
app.use('/api/bookings', bookingsRouter)
app.use('/api/clubs', clubsRouter)

app.get('/api/health', (req, res) => {
  res.json({ ok: true, db: isConnected() })
})
app.get('/api/health/integrity', async (req, res) => {
  const { query } = await import('./db/pool.js')
  const issues = []
  const checks = []
  try {
    const { rows: mcRows } = await query(`
      SELECT mc.member_id, mc.club_id FROM member_clubs mc
      LEFT JOIN members m ON m.id = mc.member_id AND m.deleted_at IS NULL
      LEFT JOIN clubs c ON c.id = mc.club_id AND c.deleted_at IS NULL
      WHERE m.id IS NULL OR c.id IS NULL
    `)
    if (mcRows.length > 0) issues.push({ table: 'member_clubs', message: 'عضوية تشير لعضو أو نادي محذوف', count: mcRows.length })
    else checks.push({ table: 'member_clubs', ok: true })
    const { rows: cbOrphan } = await query(`
      SELECT cb.id FROM club_bookings cb
      LEFT JOIN clubs c ON c.id = cb.club_id AND c.deleted_at IS NULL
      WHERE c.id IS NULL AND cb.deleted_at IS NULL
    `)
    if (cbOrphan.length > 0) issues.push({ table: 'club_bookings', message: 'حجوزات لنوادي محذوفة', count: cbOrphan.length })
    else checks.push({ table: 'club_bookings', ok: true })
    res.json({ ok: issues.length === 0, issues, checks })
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'Integrity check failed' })
  }
})
app.get('/api/ping', (req, res) => {
  res.json({ pong: true })
})
// Debug: verify DATABASE_URL reaches the app (no secrets exposed)
app.get('/api/db-check', async (req, res) => {
  const diag = getDbDiagnostics()
  let testError = null
  let currentDatabase = null
  if (isConnected()) {
    try {
      const poolModule = await import('./db/pool.js')
      await poolModule.query('SELECT 1')
      currentDatabase = await poolModule.getCurrentDatabase()
    } catch (e) {
      testError = e.message
    }
  }
  res.json({
    ...diag,
    currentDatabase,
    db: isConnected() && !testError,
    testError: testError || null,
    hint: !diag.hasConnectionString
      ? 'Create database.config.json in domains/playtix.app (outside public_html) or set DATABASE_URL'
      : testError
        ? 'Connection string found but MySQL rejected: ' + testError
        : diag.db
          ? (currentDatabase ? `OK — data is read/written from database: ${currentDatabase}` : 'OK')
          : 'Check config file path or MySQL host/credentials'
  })
})

// Redirect / to /app when request reaches Node
app.get('/', (req, res) => res.redirect(302, '/app/'))

// Serve SPA at /app (base path for Hostinger when Nginx serves root)
const distPath = join(__dirname, '..', 'dist')
const distIndex = join(distPath, 'index.html')
if (existsSync(distIndex)) {
  const staticOpts = {
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
        res.setHeader('Content-Type', 'application/javascript')
      }
    }
  }
  app.use('/app', express.static(distPath, staticOpts))
  app.get(/^\/app(\/.*)?$/, (req, res, next) => {
    const p = req.path || ''
    if (/\.(js|mjs|css|ico|png|jpg|jpeg|gif|svg|woff2?|ttf|eot)(\?.*)?$/i.test(p)) return next()
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.sendFile(distIndex)
  })
}

app.listen(PORT, HOST, async () => {
  console.log(`Padel API running on http://${HOST}:${PORT}`)
  if (!isConnected()) {
    console.warn('Database not configured. Set DATABASE_URL (mysql://...).')
  } else {
    const dbName = await getCurrentDatabase()
    console.log(`Database: ${dbName || '(unknown)'} — all data is read from and written to this database`)
    startBookingJobs()
  }
}).on('error', (err) => {
  console.error('[Express] listen error:', err.message)
  process.exit(1)
})
