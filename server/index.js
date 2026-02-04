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

// Serve React static build (for Hostinger deployment)
const distPath = join(__dirname, '..', 'dist')
const distIndex = join(distPath, 'index.html')
if (existsSync(distIndex)) {
  app.use(express.static(distPath, { index: false }))
}
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next()
  if (existsSync(distIndex)) {
    return res.sendFile(distIndex)
  }
  res.status(503).send('Frontend not built. Run: npm run build')
})

app.listen(PORT, HOST, () => {
  console.log(`Padel API running on http://${HOST}:${PORT}`)
  if (!isConnected()) {
    console.warn('Database not configured. Set DATABASE_URL (mysql://...).')
  }
})
