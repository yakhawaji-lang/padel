import { config } from 'dotenv'
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
import { isConnected } from './db/pool.js'

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '10mb' }))

app.use('/api/store', storeRouter)
app.use('/api/matches', matchesRouter)
app.use('/api/member-stats', memberStatsRouter)
app.use('/api/tournament-summaries', tournamentSummariesRouter)
app.use('/api/password-reset', passwordResetRouter)
app.use('/api/whatsapp-webhook', whatsappWebhookRouter)

app.get('/api/health', (req, res) => {
  res.json({ ok: true, db: isConnected() })
})

app.listen(PORT, () => {
  console.log(`Padel API running on http://localhost:${PORT}`)
  if (!isConnected()) {
    console.warn('Database not configured. Set DATABASE_URL or POSTGRES_URL.')
  }
})
