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
    // Ensure admin_clubs exists and is always an array
    let clubs = cache.get('admin_clubs')
    if (!Array.isArray(clubs)) clubs = []
    if (clubs.length === 0) {
      const hala = createHalaPadel()
      clubs = [hala]
      cache.set('admin_clubs', clubs)
      await api.setStore('admin_clubs', clubs)
    }
    bootstrapped = true
  } catch (e) {
    console.warn('Backend bootstrap failed, using empty cache:', e.message)
    // Ensure minimal cache so app loads; data will not persist until DATABASE_URL is configured
    const hala = createHalaPadel()
    cache.set('admin_clubs', [hala])
    bootstrapped = true
  }
}

function createHalaPadel() {
  return {
    id: 'hala-padel',
    name: 'Hala Padel',
    nameAr: 'هلا بادل',
    logo: '',
    banner: '',
    tagline: 'Indoor courts • King of the Court & Social tournaments • For all levels',
    taglineAr: 'ملاعب داخلية • بطولات ملك الملعب وسوشيال • لجميع المستويات',
    address: 'Arid District, 11234, Riyadh',
    addressAr: 'حي العارض، 11234، الرياض',
    phone: '',
    email: '',
    website: 'https://playtomic.com/clubs/hala-padel',
    playtomicVenueId: 'hala-padel',
    playtomicApiKey: '',
    courts: [
      { id: 'court-1', name: 'Court 1', nameAr: 'الملعب 1', type: 'indoor', maintenance: false, image: '' },
      { id: 'court-2', name: 'Court 2', nameAr: 'الملعب 2', type: 'indoor', maintenance: false, image: '' },
      { id: 'court-3', name: 'Court 3', nameAr: 'الملعب 3', type: 'indoor', maintenance: false, image: '' },
      { id: 'court-4', name: 'Court 4', nameAr: 'الملعب 4', type: 'indoor', maintenance: false, image: '' }
    ],
    settings: {
      defaultLanguage: 'en',
      timezone: 'Asia/Riyadh',
      currency: 'SAR',
      bookingDuration: 60,
      maxBookingAdvance: 30,
      cancellationPolicy: 24,
      openingTime: '06:00',
      closingTime: '23:00',
      headerBgColor: '#ffffff',
      headerTextColor: '#0f172a',
      heroBgColor: '#ffffff',
      heroBgOpacity: 85,
      heroTitleColor: '#0f172a',
      heroTextColor: '#475569',
      heroStatsColor: '#0f172a',
      socialLinks: []
    },
    tournaments: [],
    members: [],
    bookings: [],
    offers: [],
    accounting: [],
    adminUsers: [],
    tournamentTypes: [
      { id: 'king-of-court', name: 'King of the Court', nameAr: 'ملك الملعب', description: 'Winners stay on court', descriptionAr: 'الفائزون يبقون على الملعب' },
      { id: 'social', name: 'Social Tournament', nameAr: 'بطولة سوشيال', description: 'Round-robin format', descriptionAr: 'نظام دوري' }
    ],
    storeEnabled: false,
    store: { name: '', nameAr: '', categories: [], products: [], sales: [], inventoryMovements: [], offers: [], coupons: [], minStockAlert: 5 },
    tournamentData: { kingState: null, socialState: null, currentTournamentId: 1 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
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
