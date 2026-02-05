/**
 * Club admin authentication - uses database via appSettingsStorage.
 * No localStorage.
 */

import * as appSettings from './appSettingsStorage.js'

export const getCurrentClubAdmin = () => {
  return appSettings.getCurrentClubAdminId()
}

export const setCurrentClubAdmin = (clubId) => {
  appSettings.setCurrentClubAdminId(clubId)
}

export function getClubAdminSession() {
  return appSettings.getClubAdminSession()
}

export function setClubAdminSession(session) {
  return appSettings.setClubAdminSession(session)
}

export function clearClubAdminSession() {
  return appSettings.setClubAdminSession(null)
}

export function hasClubPermission(session, page) {
  if (!session) return false
  if (session.isOwner) return true
  return Array.isArray(session.permissions) && session.permissions.includes(page)
}
