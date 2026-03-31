import { useEffect } from 'react'
import { postClubPresence } from '../../api/dbClient'

function getOrCreatePresenceSession() {
  try {
    let s = sessionStorage.getItem('playtix_presence_sid')
    if (!s) {
      s = `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      sessionStorage.setItem('playtix_presence_sid', s)
    }
    return s
  } catch {
    return `p-${Date.now()}`
  }
}

const PRESENCE_MS = 35000

/** Ping server so club admin sees live visitor count (no UI). */
export default function ClubPresenceBeacon({ clubId }) {
  useEffect(() => {
    if (!clubId) return undefined
    const sid = getOrCreatePresenceSession()
    const ping = () => {
      postClubPresence(clubId, sid).catch(() => {})
    }
    ping()
    const iv = setInterval(ping, PRESENCE_MS)
    return () => clearInterval(iv)
  }, [clubId])
  return null
}
