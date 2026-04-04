// Platform user (visitor who registered on the site) - uses database via appSettingsStorage
// Reads members from backend cache only — avoids static import of adminStorage (heavy graph) on first paint.

import backendStorage from './backendStorage.js'
import { getCurrentMemberId, setCurrentMemberId } from './appSettingsStorage.js'

function readMergedMembersFromCache() {
  try {
    let members = []
    let allMembers = []
    try {
      const pm = backendStorage.getCache?.('padel_members')
      if (Array.isArray(pm)) members = pm
    } catch (_) {}
    try {
      const am = backendStorage.getCache?.('all_members')
      if (Array.isArray(am)) allMembers = am
    } catch (_) {}
    const byId = new Map()
    members.forEach(m => { if (m && m.id) byId.set(m.id, m) })
    allMembers.forEach(m => {
      if (!m || m.id === undefined || m.id === null) return
      try {
        const prev = byId.get(m.id)
        byId.set(m.id, prev ? { ...prev, ...m } : { ...m })
      } catch (_) {}
    })
    return Array.from(byId.values())
  } catch {
    return []
  }
}

export const getCurrentPlatformUser = () => {
  try {
    const id = getCurrentMemberId()
    if (id === null || id === undefined || id === '') return null
    const members = readMergedMembersFromCache()
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
    const { getMergedMembersRaw, saveMembers } = await import('./adminStorage.js')
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
