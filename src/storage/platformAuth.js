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
