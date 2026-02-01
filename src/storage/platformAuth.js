// Platform user (visitor who registered on the site) - used for "Join club" flow

const CURRENT_MEMBER_KEY = 'current_member_id'
const ALL_MEMBERS_KEY = 'all_members'

export const getCurrentPlatformUser = () => {
  try {
    const id = localStorage.getItem(CURRENT_MEMBER_KEY)
    if (!id) return null
    const members = JSON.parse(localStorage.getItem(ALL_MEMBERS_KEY) || '[]')
    return members.find(m => m.id === id) || null
  } catch (e) {
    return null
  }
}

export const setCurrentPlatformUser = (memberId) => {
  if (memberId) localStorage.setItem(CURRENT_MEMBER_KEY, memberId)
  else localStorage.removeItem(CURRENT_MEMBER_KEY)
}

/** Update platform member profile (name, email, avatar) - syncs to all_members, padel_members, and club members */
export const updatePlatformMember = (memberId, updates) => {
  try {
    const members = JSON.parse(localStorage.getItem(ALL_MEMBERS_KEY) || '[]')
    const idx = members.findIndex(m => m.id === memberId)
    if (idx < 0) return false
    members[idx] = { ...members[idx], ...updates }
    localStorage.setItem(ALL_MEMBERS_KEY, JSON.stringify(members))
    if (localStorage.getItem('padel_members')) {
      const pm = JSON.parse(localStorage.getItem('padel_members') || '[]')
      const pi = pm.findIndex(m => m.id === memberId)
      if (pi >= 0) {
        pm[pi] = { ...pm[pi], ...updates }
        localStorage.setItem('padel_members', JSON.stringify(pm))
      }
    }
    try {
      const clubsData = localStorage.getItem('admin_clubs')
      if (clubsData) {
        const clubs = JSON.parse(clubsData)
        let changed = false
        clubs.forEach(club => {
          if (!club.members) return
          const mi = club.members.findIndex(m => m.id === memberId)
          if (mi >= 0) {
            club.members[mi] = { ...club.members[mi], ...updates }
            changed = true
          }
        })
        if (changed) {
          localStorage.setItem('admin_clubs', JSON.stringify(clubs))
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('clubs-synced'))
          }
        }
      }
    } catch (_) {}
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('member-updated', { detail: { memberId } }))
    }
    return true
  } catch (e) {
    return false
  }
}

export const logoutPlatformUser = () => {
  setCurrentPlatformUser(null)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('member-logged-out'))
  }
}
