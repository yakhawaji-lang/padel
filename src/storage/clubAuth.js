const CLUB_ADMIN_KEY = 'current_club_admin_id'
const CLUB_SESSION_KEY = 'club_admin_session'
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours

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
    if (s._ts && Date.now() - s._ts > SESSION_MAX_AGE_MS) {
      setClubAdminSession(null)
      return null
    }
    return s
  } catch (_) {
    return null
  }
}

export function setClubAdminSession(session) {
  if (session) {
    const withTs = { ...session, _ts: Date.now() }
    localStorage.setItem(CLUB_SESSION_KEY, JSON.stringify(withTs))
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
