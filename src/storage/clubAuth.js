const CLUB_ADMIN_KEY = 'current_club_admin_id'

export const getCurrentClubAdmin = () => {
  return localStorage.getItem(CLUB_ADMIN_KEY)
}

export const setCurrentClubAdmin = (clubId) => {
  if (clubId) localStorage.setItem(CLUB_ADMIN_KEY, clubId)
  else localStorage.removeItem(CLUB_ADMIN_KEY)
}
