import { config } from 'dotenv'
import { existsSync, readFileSync } from 'fs'
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
import smsWebhookRouter from './routes/smsWebhook.js'
import initDbRouter from './routes/initDb.js'
import dataRouter from './routes/data.js'
import bookingsRouter from './routes/bookings.js'
import invoicesRouter from './routes/invoices.js'
import clubsRouter from './routes/clubs.js'
import settingsUploadRouter from './routes/settingsUpload.js'
import galleryRouter from './routes/gallery.js'
import emailRouter from './routes/email.js'
import notificationsRouter from './routes/notifications.js'
import pushRouter from './routes/push.js'
import { isConnected, getDbDiagnostics, getCurrentDatabase } from './db/pool.js'
import { startBookingJobs } from './jobs/bookingJobs.js'
import { startPushNotificationJob } from './jobs/pushNotificationsJob.js'

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
app.use('/api/sms-webhook', smsWebhookRouter)
app.use('/api/init-db', initDbRouter)
app.use('/api/data', dataRouter)
app.use('/api/bookings', bookingsRouter)
app.use('/api/invoices', invoicesRouter)
app.use('/api/clubs', clubsRouter)
app.use('/api/gallery', galleryRouter)
app.use('/api/email', emailRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/push', pushRouter)

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

const redirectLandingPath = join(root, 'index.redirect.html')

/** Always return real HTML for bare domain — some proxies/clients mishandle 302-only root. */
function sendRootLandingHtml(res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0')
  try {
    const html = readFileSync(redirectLandingPath, 'utf8')
    res.status(200).type('text/html; charset=utf-8').send(html)
  } catch {
    const fallback =
      '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>' +
      '<meta name="viewport" content="width=device-width,initial-scale=1"/>' +
      '<meta http-equiv="refresh" content="0;url=/app/"/><title>PlayTix</title></head><body style="font-family:system-ui,sans-serif;padding:2rem;text-align:center">' +
      '<p>Redirecting to <a href="/app/">PlayTix</a>…</p>' +
      '<script>try{location.replace("/app/"+(location.search||"")+(location.hash||""))}catch(e){}</script></body></html>'
    res.status(200).type('text/html; charset=utf-8').send(fallback)
  }
}

app.get('/', (req, res) => sendRootLandingHtml(res))
app.get('/index.html', (req, res) => sendRootLandingHtml(res))

// Serve SPA at /app (base path for Hostinger when Nginx serves root)
const distPath = join(__dirname, '..', 'dist')
const distIndex = join(distPath, 'index.html')
const publicHomepageDir = join(root, 'public', 'homepage')

app.get('/app', (req, res) => res.redirect(301, '/app/'))

/** Homepage banner/gallery — must be before /app static so uploads in public/homepage win over dist. */
if (existsSync(publicHomepageDir)) {
  app.use(
    '/app/homepage',
    express.static(publicHomepageDir, {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      setHeaders: (res, filePath) => {
        const fp = String(filePath || '').toLowerCase()
        if (fp.endsWith('.png')) res.setHeader('Content-Type', 'image/png')
        else if (fp.endsWith('.jpg') || fp.endsWith('.jpeg')) res.setHeader('Content-Type', 'image/jpeg')
        else if (fp.endsWith('.webp')) res.setHeader('Content-Type', 'image/webp')
      },
    })
  )
}

if (existsSync(distIndex)) {
  const staticOpts = {
    index: 'index.html',
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
} else {
  app.get(/^\/app(\/.*)?$/, (req, res) => {
    res.status(503).type('text/html; charset=utf-8').send(
      '<!DOCTYPE html><html><head><meta charset="utf-8"/><title>PlayTix</title></head><body style="padding:2rem;font-family:sans-serif">' +
      '<h1>PlayTix</h1><p>Frontend build is missing on the server. Run <code>npm run build</code> and deploy the <code>dist</code> folder under <code>/app</code>.</p></body></html>'
    )
  })
}

app.listen(PORT, HOST, async () => {
  console.log(`Padel API running on http://${HOST}:${PORT}`)
  if (!isConnected()) {
    console.warn('Database not configured. Set DATABASE_URL (mysql://...).')
  } else {
    try {
      const { runMigration } = await import('./db/bookingMigration.js')
      await runMigration()
    } catch (mErr) {
      console.warn('[bookingMigration]', mErr?.message || mErr)
    }
    const dbName = await getCurrentDatabase()
    console.log(`Database: ${dbName || '(unknown)'} — all data is read from and written to this database`)
    startBookingJobs()
    startPushNotificationJob()
  }
}).on('error', (err) => {
  console.error('[Express] listen error:', err.message)
  process.exit(1)
})
