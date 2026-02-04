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
import { isConnected } from './db/pool.js'

const app = express()
const PORT = process.env.PORT || 4000
const HOST = process.env.HOST || '0.0.0.0'

app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '10mb' }))

app.use('/api/store', storeRouter)
app.use('/api/matches', matchesRouter)
app.use('/api/member-stats', memberStatsRouter)
app.use('/api/tournament-summaries', tournamentSummariesRouter)
app.use('/api/password-reset', passwordResetRouter)
app.use('/api/whatsapp-webhook', whatsappWebhookRouter)
app.use('/api/init-db', initDbRouter)

app.get('/api/health', (req, res) => {
  res.json({ ok: true, db: isConnected() })
})
app.get('/api/ping', (req, res) => {
  res.json({ pong: true })
})
// Debug: verify DATABASE_URL reaches the app (no secrets exposed)
app.get('/api/db-check', (req, res) => {
  const url = process.env.DATABASE_URL || process.env.MYSQL_URL || ''
  const hasUrl = !!url.trim()
  const looksMysql = url.trim().startsWith('mysql')
  const paths = [join(root, '.env'), join(cwd, '.env')]
  const envFiles = paths.map((p) => ({ path: p, exists: existsSync(p) }))
  res.json({
    hasUrl,
    looksMysql,
    db: isConnected(),
    cwd,
    envFiles,
    hint: !hasUrl ? 'Add .env with DATABASE_URL to one of the paths above' : !looksMysql ? 'URL should start with mysql://' : 'Check Remote MySQL + credentials'
  })
})

// Redirect / to /app when request reaches Node
app.get('/', (req, res) => res.redirect(302, '/app/'))

// Serve SPA at /app (base path for Hostinger when Nginx serves root)
const distPath = join(__dirname, '..', 'dist')
const distIndex = join(distPath, 'index.html')
if (existsSync(distIndex)) {
  app.use('/app', express.static(distPath, {
    index: 'index.html',
    setHeaders: (res, path) => {
      if (path.endsWith('.js') || path.endsWith('.mjs')) {
        res.setHeader('Content-Type', 'application/javascript')
      }
    }
  }))
  app.get('/app', (req, res) => res.sendFile(distIndex))
  app.get('/app/*', (req, res, next) => {
    if (/\.(js|mjs|css|ico|png|jpg|jpeg|gif|svg|woff2?|ttf|eot)(\?.*)?$/i.test(req.path)) return next()
    res.sendFile(distIndex)
  })
}

app.listen(PORT, HOST, () => {
  console.log(`Padel API running on http://${HOST}:${PORT}`)
  if (!isConnected()) {
    console.warn('Database not configured. Set DATABASE_URL (mysql://...).')
  }
})
