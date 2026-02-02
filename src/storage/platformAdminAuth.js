/**
 * Platform admin authentication - for Main Admin Panel (all-clubs, manage-clubs).
 * Separate from club auth (club owners/admins).
 */

const KEY = 'platform_admin_session'

const PLATFORM_PAGES = ['all-clubs', 'manage-clubs', 'all-members', 'admin-users']

export function getPlatformAdminSession() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw)
    if (!s?.id || !s?.email) return null
    return s
  } catch (_) {
    return null
  }
}

export function setPlatformAdminSession(admin) {
  if (admin) {
    localStorage.setItem(KEY, JSON.stringify({
      id: admin.id,
      email: admin.email,
      role: admin.role || 'admin',
      permissions: admin.permissions || PLATFORM_PAGES
    }))
  } else {
    localStorage.removeItem(KEY)
  }
}

export function clearPlatformAdminSession() {
  localStorage.removeItem(KEY)
}

export function hasPlatformPermission(session, page) {
  if (!session) return false
  if (session.role === 'owner') return true
  return Array.isArray(session.permissions) && session.permissions.includes(page)
}

export function canAccessPlatformAdmin() {
  return !!getPlatformAdminSession()
}
