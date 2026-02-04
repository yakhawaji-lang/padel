// Platform user (visitor who registered on the site) - used for "Join club" flow

import { getMergedMembersRaw, saveMembers } from './adminStorage.js'

const CURRENT_MEMBER_KEY = 'current_member_id'

export const getCurrentPlatformUser = () => {
  try {
    const id = localStorage.getItem(CURRENT_MEMBER_KEY)
    if (!id) return null
    const members = getMergedMembersRaw()
    return members.find(m => m.id === id) || null
  } catch (e) {
    return null
  }
}

export const setCurrentPlatformUser = (memberId) => {
  if (memberId) localStorage.setItem(CURRENT_MEMBER_KEY, memberId)
  else localStorage.removeItem(CURRENT_MEMBER_KEY)
}

/** Update platform member profile (name, email, avatar) - uses centralized save */
export const updatePlatformMember = async (memberId, updates) => {
  try {
    const members = getMergedMembersRaw()
    const member = members.find(m => m.id === memberId)
    if (!member) return false
    const merged = { ...member, ...updates }
    const idx = members.findIndex(m => m.id === memberId)
    if (idx >= 0) members[idx] = merged
    const ok = await saveMembers(members)
    if (ok && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('member-updated', { detail: { memberId } }))
    }
    return ok
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
