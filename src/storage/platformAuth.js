// Platform user (visitor who registered on the site) - uses database via appSettingsStorage

import { getMergedMembersRaw, saveMembers } from './adminStorage.js'
import { getCurrentMemberId, setCurrentMemberId } from './appSettingsStorage.js'

export const getCurrentPlatformUser = () => {
  try {
    const id = getCurrentMemberId()
    if (id === null || id === undefined || id === '') return null
    const members = getMergedMembersRaw()
    return members.find(m => String(m?.id) === String(id)) || null
  } catch (e) {
    return null
  }
}

export const setCurrentPlatformUser = (memberId) => {
  return setCurrentMemberId(memberId)
}

/** Update platform member profile - uses centralized save */
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
