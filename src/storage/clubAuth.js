const CLUB_ADMIN_KEY = 'current_club_admin_id'
const CLUB_SESSION_KEY = 'club_admin_session'

const CLUB_PAGES = ['dashboard', 'members', 'offers', 'store', 'accounting', 'settings', 'users']

export const getCurrentClubAdmin = () => {
  return localStorage.getItem(CLUB_ADMIN_KEY)
}

export const setCurrentClubAdmin = (clubId) => {
  if (clubId) localStorage.setItem(CLUB_ADMIN_KEY, clubId)
  else localStorage.removeItem(CLUB_ADMIN_KEY)
}

export function getClubAdminSession() {
  try {
    const raw = localStorage.getItem(CLUB_SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw)
    if (!s?.clubId) return null
    return s
  } catch (_) {
    return null
  }
}

export function setClubAdminSession(session) {
  if (session) {
    localStorage.setItem(CLUB_SESSION_KEY, JSON.stringify(session))
    setCurrentClubAdmin(session.clubId)
  } else {
    localStorage.removeItem(CLUB_SESSION_KEY)
    setCurrentClubAdmin(null)
  }
}

export function clearClubAdminSession() {
  setClubAdminSession(null)
}

export function hasClubPermission(session, page) {
  if (!session) return false
  if (session.isOwner) return true
  return Array.isArray(session.permissions) && session.permissions.includes(page)
}
