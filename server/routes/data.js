/**
 * Data API - reads/writes from entities and app_settings tables.
 * Single source of truth: database only.
 */
import { Router } from 'express'
import { query } from '../db/pool.js'

const router = Router()

const ENTITY_KEYS = ['admin_clubs', 'all_members', 'padel_members', 'platform_admins']
const ENTITY_TYPE_MAP = {
  admin_clubs: 'club',
  all_members: 'member',
  padel_members: 'member',
  platform_admins: 'platform_admin'
}

/** GET /api/data?keys=admin_clubs,all_members,... - Batch get from DB (must be before /:key) */
router.get('/', async (req, res) => {
  try {
    const keysParam = req.query.keys
    if (!keysParam) return res.status(400).json({ error: 'Missing keys' })
    const keys = keysParam.split(',').map(k => k.trim()).filter(Boolean)
    if (!keys.length) return res.json({})

    const result = {}
    for (const key of keys) {
      if (ENTITY_KEYS.includes(key)) {
        const type = ENTITY_TYPE_MAP[key]
        const { rows } = await query(
          'SELECT entity_id, data FROM entities WHERE entity_type = ?',
          [type]
        )
        result[key] = rows.map(r => {
          const d = typeof r.data === 'object' ? r.data : JSON.parse(r.data || '{}')
          return { ...d, id: r.entity_id }
        })
      } else {
        const { rows } = await query('SELECT value FROM app_settings WHERE `key` = ?', [key])
        const raw = rows[0]?.value
        result[key] = raw === undefined || raw === null
          ? null
          : (typeof raw === 'object' ? raw : JSON.parse(raw || 'null'))
      }
    }
    res.json(result)
  } catch (e) {
    console.error('data get error:', e)
    res.status(500).json({ error: e.message })
  }
})

/** GET /api/data/:key - Single key get */
router.get('/:key', async (req, res) => {
  try {
    const key = req.params.key
    if (ENTITY_KEYS.includes(key)) {
      const type = ENTITY_TYPE_MAP[key]
      const { rows } = await query('SELECT entity_id, data FROM entities WHERE entity_type = ?', [type])
      const arr = rows.map(r => {
        const d = typeof r.data === 'object' ? r.data : JSON.parse(r.data || '{}')
        return { ...d, id: r.entity_id }
      })
      return res.json(arr)
    }
    const { rows } = await query('SELECT value FROM app_settings WHERE `key` = ?', [key])
    const raw = rows[0]?.value
    const val = raw === undefined || raw === null ? null : (typeof raw === 'object' ? raw : JSON.parse(raw || 'null'))
    res.json(val)
  } catch (e) {
    console.error('data get single error:', e)
    res.status(500).json({ error: e.message })
  }
})

/** POST /api/data - Set key(s). Body: { key, value } or { items: [{ key, value }] } */
router.post('/', async (req, res) => {
  try {
    let items = req.body.items
    if (Array.isArray(items) && items.length > 0) {
      // batch
    } else if (req.body.key !== undefined) {
      items = [{ key: req.body.key, value: req.body.value }]
    } else {
      return res.status(400).json({ error: 'Missing key or items' })
    }

    for (const { key, value } of items) {
      if (!key) continue
      if (ENTITY_KEYS.includes(key)) {
        const type = ENTITY_TYPE_MAP[key]
        const arr = Array.isArray(value) ? value : []
        await query('DELETE FROM entities WHERE entity_type = ?', [type])
        for (const item of arr) {
          const id = (item?.id || item?.entity_id || 'item-' + Date.now() + '-' + Math.random().toString(36).slice(2)).toString()
          const data = JSON.stringify(item)
          await query(
            'INSERT INTO entities (entity_type, entity_id, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = NOW()',
            [type, id, data]
          )
        }
      } else {
        await query(
          'INSERT INTO app_settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()',
          [key, JSON.stringify(value)]
        )
      }
    }
    res.json({ ok: true })
  } catch (e) {
    console.error('data post error:', e)
    res.status(500).json({ error: e.message })
  }
})

export default router
