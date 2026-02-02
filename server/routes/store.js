import { Router } from 'express'
import { query } from '../db/pool.js'

const router = Router()

/** GET /api/store/:key - Get single key */
router.get('/:key', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT value FROM app_store WHERE key = $1',
      [req.params.key]
    )
    if (rows.length === 0) {
      return res.json(null)
    }
    res.json(rows[0].value)
  } catch (e) {
    console.error('store get error:', e)
    res.status(500).json({ error: e.message })
  }
})

/** GET /api/store - Get multiple keys. Query: ?keys=admin_clubs,all_members */
router.get('/', async (req, res) => {
  try {
    const keysParam = req.query.keys
    if (!keysParam) {
      return res.status(400).json({ error: 'Missing keys query param' })
    }
    const keys = keysParam.split(',').map(k => k.trim()).filter(Boolean)
    if (keys.length === 0) return res.json({})
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',')
    const { rows } = await query(
      `SELECT key, value FROM app_store WHERE key IN (${placeholders})`,
      keys
    )
    const result = {}
    rows.forEach(r => { result[r.key] = r.value })
    res.json(result)
  } catch (e) {
    console.error('store get batch error:', e)
    res.status(500).json({ error: e.message })
  }
})

/** POST /api/store - Set single key. Body: { key, value } */
router.post('/', async (req, res) => {
  try {
    const { key, value } = req.body
    if (!key) return res.status(400).json({ error: 'Missing key' })
    await query(
      `INSERT INTO app_store (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, JSON.stringify(value ?? null)]
    )
    res.json({ ok: true })
  } catch (e) {
    console.error('store set error:', e)
    res.status(500).json({ error: e.message })
  }
})

/** POST /api/store/batch - Set multiple keys. Body: { items: [{ key, value }] } */
router.post('/batch', async (req, res) => {
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
    res.json({ ok: true })
  } catch (e) {
    console.error('store batch error:', e)
    res.status(500).json({ error: e.message })
  }
})

export default router
