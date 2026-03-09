/**
 * Platform admin authentication - uses database via appSettingsStorage.
 * No localStorage.
 */

import * as appSettings from './appSettingsStorage.js'

const PLATFORM_PAGE_IDS = ['all-clubs', 'manage-clubs', 'all-members', 'admin-users']

export function getPlatformAdminSession() {
  return appSettings.getPlatformAdminSession()
}

export function setPlatformAdminSession(admin) {
  const perms = admin?.role === 'owner' ? PLATFORM_PAGE_IDS : (admin?.permissions || PLATFORM_PAGE_IDS)
  return appSettings.setPlatformAdminSession(admin ? { ...admin, permissions: perms } : null)
}

export function clearPlatformAdminSession() {
  return appSettings.setPlatformAdminSession(null)
}

export function hasPlatformPermission(session, page) {
  if (!session) return false
  if (session.role === 'owner') return true
  return Array.isArray(session.permissions) && session.permissions.includes(page)
}

export function canAccessPlatformAdmin() {
  return !!appSettings.getPlatformAdminSession()
}
