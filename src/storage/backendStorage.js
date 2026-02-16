/**
 * PostgreSQL-backed storage. Replaces localStorage for app_store keys.
 * Session keys (current_member_id, *_session) are per-browser only (localStorage), not from API.
 */

import * as api from '../api/dbClient.js'
import { LOCAL_ONLY_KEYS } from './appSettingsStorage.js'

const cache = new Map()
let bootstrapped = false
const LOCAL_PREFIX = 'playtix_'

function fromLocal(key) {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(LOCAL_PREFIX + key)
    if (raw === null) return null
    return JSON.parse(raw)
  } catch {
    return localStorage.getItem(LOCAL_PREFIX + key)
  }
}

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
      'app_language', 'admin_current_club_id', 'bookings'
    ]
    const data = await api.getStoreBatch(keys)
    if (data && typeof data === 'object') {
      Object.entries(data).forEach(([k, v]) => {
        if (LOCAL_ONLY_KEYS.includes(k)) return
        if ((k === 'admin_clubs' || k === 'all_members' || k === 'padel_members' || k === 'platform_admins' || k === 'bookings') && !Array.isArray(v)) {
          v = (typeof v === 'string' ? (() => { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } })() : [])
        }
        if (v !== null && v !== undefined) cache.set(k, v)
      })
    }
    // Per-browser session: from localStorage only (each device has its own login)
    LOCAL_ONLY_KEYS.forEach(k => {
      const local = fromLocal(k)
      if (local !== null && local !== undefined) cache.set(k, local)
    })
    // Ensure admin_clubs exists and is always an array — النظام يبدأ فارغاً بدون نوادي افتراضية
    let clubs = cache.get('admin_clubs')
    if (!Array.isArray(clubs)) clubs = []
    cache.set('admin_clubs', clubs)
    bootstrapped = true
  } catch (e) {
    console.warn('Backend bootstrap failed, using empty cache:', e.message)
    if (!cache.has('admin_clubs')) cache.set('admin_clubs', [])
    LOCAL_ONLY_KEYS.forEach(k => {
      const local = fromLocal(k)
      if (local !== null && local !== undefined) cache.set(k, local)
    })
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
  if (LOCAL_ONLY_KEYS.includes(key)) return
  try {
    await api.setStore(key, value)
  } catch (e) {
    console.error('setStore failed:', e)
    throw e
  }
}

const REFRESH_COOLDOWN_MS = 2000
const RESOURCE_ERROR_BACKOFF_MS = 15000
let _lastRefreshTime = 0
let _lastRefreshPromise = null
let _refreshBackoffUntil = 0

function isResourceExhaustionError(e) {
  const msg = (e?.message || String(e)).toLowerCase()
  return /insufficient_resources|failed to fetch|load failed|networkerror|network error/i.test(msg)
}

/** Refresh specific keys from API and update cache. Use for cross-device sync. Cooldown to avoid request storms. */
export async function refreshStoreKeys(keys) {
  if (!keys?.length) return
  const now = Date.now()
  if (now < _refreshBackoffUntil) return
  if (now - _lastRefreshTime < REFRESH_COOLDOWN_MS && _lastRefreshPromise) {
    return _lastRefreshPromise
  }
  _lastRefreshTime = now
  _lastRefreshPromise = (async () => {
    try {
      const data = await api.getStoreBatch(keys)
      Object.entries(data || {}).forEach(([k, v]) => {
        if (LOCAL_ONLY_KEYS.includes(k)) return
        if (v === null || v === undefined) return
        if ((k === 'admin_clubs' || k === 'all_members' || k === 'padel_members') && !Array.isArray(v)) {
          v = (typeof v === 'string' ? (() => { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } })() : [])
        }
        cache.set(k, v)
      })
    } catch (e) {
      console.warn('refreshStoreKeys failed:', e)
      if (isResourceExhaustionError(e)) _refreshBackoffUntil = Date.now() + RESOURCE_ERROR_BACKOFF_MS
    } finally {
      _lastRefreshPromise = null
    }
  })()
  return _lastRefreshPromise
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
