import { config } from 'dotenv'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env.local') })
config({ path: join(__dirname, '..', '.env') })

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
