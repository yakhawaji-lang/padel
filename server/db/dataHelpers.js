/**
 * Helpers for reading/writing entities and app_settings (DB-only source of truth)
 */
import { query } from './pool.js'

export async function getEntities(type) {
  const { rows } = await query(
    'SELECT entity_id, data FROM entities WHERE entity_type = ?',
    [type]
  )
  return rows.map(r => {
    const d = typeof r.data === 'object' ? r.data : JSON.parse(r.data || '{}')
    return { ...d, id: r.entity_id }
  })
}

export async function setEntities(type, items) {
  await query('DELETE FROM entities WHERE entity_type = ?', [type])
  for (const item of Array.isArray(items) ? items : []) {
    const id = (item?.id || 'item-' + Date.now()).toString()
    await query(
      'INSERT INTO entities (entity_type, entity_id, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = NOW()',
      [type, id, JSON.stringify(item)]
    )
  }
}

export async function getSetting(key) {
  const { rows } = await query('SELECT value FROM app_settings WHERE `key` = ?', [key])
  const raw = rows[0]?.value
  return raw === undefined || raw === null
    ? null
    : (typeof raw === 'object' ? raw : JSON.parse(raw || 'null'))
}

export async function setSetting(key, value) {
  await query(
    'INSERT INTO app_settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()',
    [key, JSON.stringify(value)]
  )
}
