/**
 * PostgreSQL-backed storage. Replaces localStorage for app_store keys.
 * Uses in-memory cache; bootstrap() must be awaited before app uses data.
 */

import * as api from '../api/dbClient.js'

const cache = new Map()
let bootstrapped = false

export async function bootstrap() {
  if (bootstrapped) return
  try {
    api.configureDataActor?.(() => {
      const pa = cache.get('platform_admin_session')
      if (pa?.id) return { actorType: 'platform_admin', actorId: pa.id, actorName: pa.email }
      const ca = cache.get('club_admin_session')
      if (ca?.userId) return { actorType: 'club_admin', actorId: ca.userId, actorName: ca.email, clubId: ca.clubId }
      return null
    })
    const keys = [
      'admin_clubs', 'all_members', 'padel_members', 'admin_settings', 'platform_admins',
      'app_language', 'current_member_id', 'admin_current_club_id', 'bookings',
      'platform_admin_session', 'club_admin_session', 'current_club_admin_id'
    ]
    const data = await api.getStoreBatch(keys)
    if (data && typeof data === 'object') {
      Object.entries(data).forEach(([k, v]) => {
        if ((k === 'admin_clubs' || k === 'all_members' || k === 'padel_members' || k === 'platform_admins' || k === 'bookings') && !Array.isArray(v)) {
          v = (typeof v === 'string' ? (() => { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } })() : [])
        }
        if (v !== null && v !== undefined) cache.set(k, v)
      })
    }
    // Ensure admin_clubs exists and is always an array — النظام يبدأ فارغاً بدون نوادي افتراضية
    let clubs = cache.get('admin_clubs')
    if (!Array.isArray(clubs)) clubs = []
    cache.set('admin_clubs', clubs)
    bootstrapped = true
  } catch (e) {
    console.warn('Backend bootstrap failed, using empty cache:', e.message)
    if (!cache.has('admin_clubs')) cache.set('admin_clubs', [])
    bootstrapped = true
  }
}

export function getCache(key) {
  return cache.get(key)
}

export function setCache(key, value) {
  cache.set(key, value)
}

export async function getStore(key) {
  try {
    const v = await api.getStore(key)
    if (v !== null && v !== undefined) cache.set(key, v)
    return v
  } catch (e) {
    return cache.get(key)
  }
}

export async function setStore(key, value) {
  cache.set(key, value)
  try {
    await api.setStore(key, value)
  } catch (e) {
    console.error('setStore failed:', e)
    throw e
  }
}

/** Refresh specific keys from API and update cache. Use for cross-device sync. */
export async function refreshStoreKeys(keys) {
  if (!keys?.length) return
  try {
    const data = await api.getStoreBatch(keys)
    Object.entries(data || {}).forEach(([k, v]) => {
      if (v === null || v === undefined) return
      if ((k === 'admin_clubs' || k === 'all_members' || k === 'padel_members') && !Array.isArray(v)) {
        v = (typeof v === 'string' ? (() => { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } })() : [])
      }
      cache.set(k, v)
    })
  } catch (e) {
    console.warn('refreshStoreKeys failed:', e)
  }
}

/** Get any key (fetches from API if not in cache) */
export async function fetchKey(key) {
  try {
    const v = await api.getStore(key)
    if (v !== null && v !== undefined) cache.set(key, v)
    return v
  } catch (_) {
    return cache.get(key)
  }
}

export function isBootstrapped() {
  return bootstrapped
}

export { api }

export default { bootstrap, getCache, setCache, setStore, refreshStoreKeys, isBootstrapped, api }
