/**
 * App settings storage - always uses database (u502561206_padel_db) via API.
 * Replaces localStorage for: app_language, admin_current_club_id, current_member_id,
 * platform_admin_session, club_admin_session, club_X_language, etc.
 */

let _backend = null

export function initAppSettingsStorage(backend) {
  _backend = backend
}

async function get(key) {
  if (!_backend) return null
  try {
    const v = _backend.getCache?.(key)
    if (v !== undefined && v !== null) return v
    const fetched = await _backend.getStore?.(key)
    if (fetched !== undefined && fetched !== null) {
      _backend.setCache?.(key, fetched)
      return fetched
    }
    return null
  } catch (_) {
    return _backend.getCache?.(key) ?? null
  }
}

async function set(key, value) {
  if (!_backend) return
  _backend.setCache?.(key, value)
  try {
    await _backend.setStore?.(key, value)
  } catch (e) {
    console.error('appSettingsStorage set failed:', key, e)
  }
}

// Sync get from cache (must be called after bootstrap)
export function getCached(key) {
  return _backend?.getCache?.(key) ?? null
}

// App language
export async function getAppLanguageAsync() {
  const v = await get('app_language')
  return (v === 'ar' || v === 'en') ? v : 'en'
}

export function getAppLanguage() {
  const v = getCached('app_language')
  return (v === 'ar' || v === 'en') ? v : 'en'
}

export async function setAppLanguage(lang) {
  if (lang === 'en' || lang === 'ar') {
    await set('app_language', lang)
    if (typeof document !== 'undefined') {
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
      document.documentElement.lang = lang
    }
  }
}

// Admin current club
export async function getAdminCurrentClubIdAsync() {
  return await get('admin_current_club_id')
}

export function getAdminCurrentClubId() {
  return getCached('admin_current_club_id') || null
}

export async function setAdminCurrentClubId(clubId) {
  await set('admin_current_club_id', clubId || null)
}

// Current platform member
export async function getCurrentMemberIdAsync() {
  return await get('current_member_id')
}

export function getCurrentMemberId() {
  return getCached('current_member_id') || null
}

export async function setCurrentMemberId(memberId) {
  await set('current_member_id', memberId || null)
}

// Platform admin session
export async function getPlatformAdminSessionAsync() {
  const raw = await get('platform_admin_session')
  if (!raw || typeof raw !== 'object') return null
  const SESSION_MAX_MS = 24 * 60 * 60 * 1000
  if (raw._ts && Date.now() - raw._ts > SESSION_MAX_MS) {
    await set('platform_admin_session', null)
    return null
  }
  return raw
}

export function getPlatformAdminSession() {
  const raw = getCached('platform_admin_session')
  if (!raw || typeof raw !== 'object') return null
  const SESSION_MAX_MS = 24 * 60 * 60 * 1000
  if (raw._ts && Date.now() - raw._ts > SESSION_MAX_MS) return null
  return raw
}

export async function setPlatformAdminSession(admin) {
  await set('platform_admin_session', admin ? { ...admin, _ts: Date.now() } : null)
}

// Club admin session
export async function getClubAdminSessionAsync() {
  const raw = await get('club_admin_session')
  if (!raw || typeof raw !== 'object') return null
  const SESSION_MAX_MS = 24 * 60 * 60 * 1000
  if (raw._ts && Date.now() - raw._ts > SESSION_MAX_MS) {
    await set('club_admin_session', null)
    await set('current_club_admin_id', null)
    return null
  }
  return raw
}

export function getClubAdminSession() {
  const raw = getCached('club_admin_session')
  if (!raw || typeof raw !== 'object') return null
  const SESSION_MAX_MS = 24 * 60 * 60 * 1000
  if (raw._ts && Date.now() - raw._ts > SESSION_MAX_MS) return null
  return raw
}

export async function setClubAdminSession(session) {
  await set('club_admin_session', session ? { ...session, _ts: Date.now() } : null)
  await set('current_club_admin_id', session?.clubId || null)
}

export function getCurrentClubAdminId() {
  return getCached('current_club_admin_id') || getClubAdminSession()?.clubId || null
}

export async function setCurrentClubAdminId(clubId) {
  await set('current_club_admin_id', clubId || null)
}

// Club language preference (per club)
export function getClubLanguageCached(clubId) {
  if (!clubId) return null
  return getCached(`club_${clubId}_language`) || null
}

export async function getClubLanguage(clubId) {
  if (!clubId) return null
  const v = await get(`club_${clubId}_language`)
  return v || null
}

export async function setClubLanguage(clubId, lang) {
  if (!clubId) return
  await set(`club_${clubId}_language`, lang)
}

// Generic get/set for dynamic keys (tournament state, tabs, etc.)
export async function getSetting(key) {
  return await get(key)
}

export async function setSetting(key, value) {
  await set(key, value)
}
