/**
 * Storage - كل البيانات من u502561206_padel_db فقط
 * لا localStorage، لا IndexedDB — API فقط → MySQL
 */
import { saveMembers, getMergedMembersRaw } from './storage/adminStorage.js'
import { getAppLanguage } from './storage/languageStorage.js'

// ==================== الحالة الحالية (من club.tournamentData في DB) ====================
export const saveToLocalStorage = {
  kingState: (_state, _clubId = null) => { /* يُحفظ في club.tournamentData عبر App */ },
  kingStateByTournament: (_stateByTournament, _clubId = null) => { /* يُحفظ في club.tournamentData عبر App */ },
  socialState: (_state, _clubId = null) => { /* يُحفظ في club.tournamentData عبر App */ },
  socialStateByTournament: (_stateByTournament, _clubId = null) => { /* يُحفظ في club.tournamentData عبر App */ },
  members: (members) => {
    try {
      if (!Array.isArray(members)) return
      const existing = getMergedMembersRaw()
      const byId = new Map()
      existing.forEach(m => { if (m?.id) byId.set(String(m.id), m) })
      members.forEach(m => { if (m?.id) byId.set(String(m.id), { ...byId.get(m.id), ...m }) })
      saveMembers(Array.from(byId.values())).catch(e => console.error('saveMembers:', e))
    } catch (error) {
      console.error('Error saving members:', error)
    }
  },
  currentTournamentId: (_id, _clubId = null) => { /* يُحفظ في club.tournamentData عبر App */ },
  activeTab: (_tab) => { /* يُحفظ في club.tournamentData عبر App */ },
  language: (lang) => {
    try {
      import('./storage/appSettingsStorage.js').then(({ setAppLanguage }) => setAppLanguage(lang))
    } catch (error) {
      console.error('Error saving language:', error)
    }
  },
  contentTab: (_tab) => { /* يُحفظ في club.tournamentData عبر App */ },
  memberTab: (_tab) => { /* يُحفظ في club.tournamentData عبر App */ }
}

export const loadFromLocalStorage = {
  kingState: () => null,
  kingStateByTournament: () => null,
  socialState: () => null,
  socialStateByTournament: () => null,
  members: () => {
    try {
      const merged = getMergedMembersRaw()
      return merged.length > 0 ? merged : null
    } catch (error) {
      console.error('Error loading members:', error)
      return null
    }
  },
  currentTournamentId: () => 1,
  activeTab: () => 'king',
  language: () => getAppLanguage(),
  contentTab: () => 'standings',
  memberTab: () => 'members'
}

// ==================== المباريات والإحصائيات — من u502561206_padel_db فقط ====================
export const initIndexedDB = () => Promise.resolve(null)

export const saveMatchToIndexedDB = async (match, tournamentType, tournamentId, clubId) => {
  if (!clubId) return false
  try {
    const { saveMatch } = await import('./api/dbClient.js')
    await saveMatch({ ...match, clubId }, tournamentType, tournamentId)
    return true
  } catch (e) {
    console.error('Error saving match to DB:', e)
    return false
  }
}

export const getAllMatchesFromIndexedDB = async (clubId) => {
  try {
    const { getMatches } = await import('./api/dbClient.js')
    return await getMatches({ clubId })
  } catch (e) {
    console.error('Error loading matches from DB:', e)
    return []
  }
}

export const getMatchesByDateRange = async (startDate, endDate) => {
  const { getMatches } = await import('./api/dbClient.js')
  const all = await getMatches({})
  return all.filter(m => {
    const t = m.savedAt || m.timestamp || 0
    return t >= startDate && t <= endDate
  })
}

export const getMatchesByTournamentType = async (tournamentType, clubId) => {
  const { getMatches } = await import('./api/dbClient.js')
  return await getMatches({ clubId, tournamentType })
}

export const getMatchesByTournamentId = async (tournamentId, clubId, tournamentType) => {
  const { getMatches } = await import('./api/dbClient.js')
  return await getMatches({ clubId, tournamentId, tournamentType })
}

export const deleteMatchesByTournament = async (tournamentId, tournamentType, clubId) => {
  if (!clubId) return false
  try {
    const api = await import('./api/dbClient.js')
    await api.deleteMatchesByTournament(clubId, tournamentId, tournamentType)
    return true
  } catch (e) {
    console.error('Error deleting matches from DB:', e)
    return false
  }
}

export const deleteMatchesByDateAndType = async (date, tournamentType, clubId) => {
  if (!clubId) return 0
  try {
    const api = await import('./api/dbClient.js')
    await api.deleteMatchesByDateAndType(clubId, date, tournamentType)
    return 1
  } catch (e) {
    console.error('Error deleting matches by date:', e)
    return 0
  }
}

export const saveMemberStatsToIndexedDB = async (memberId, stats, tournamentId, clubId) => {
  try {
    const { saveMemberStats } = await import('./api/dbClient.js')
    await saveMemberStats({ clubId, memberId, tournamentId, ...stats })
    return true
  } catch (e) {
    console.error('Error saving member stats to DB:', e)
    return false
  }
}

export const getMemberStatsHistory = async (memberId, clubId) => {
  try {
    const { getMemberStats } = await import('./api/dbClient.js')
    return await getMemberStats({ memberId, clubId })
  } catch (e) {
    console.error('Error loading member stats from DB:', e)
    return []
  }
}

export const saveTournamentToIndexedDB = async (tournamentData, clubId) => {
  try {
    const { saveTournamentSummary } = await import('./api/dbClient.js')
    await saveTournamentSummary(clubId, tournamentData)
    return true
  } catch (e) {
    console.error('Error saving tournament to DB:', e)
    return false
  }
}

export const getAllTournamentsFromIndexedDB = async (clubId) => {
  if (!clubId) return []
  try {
    const { getTournamentSummaries } = await import('./api/dbClient.js')
    return await getTournamentSummaries(clubId)
  } catch (e) {
    console.error('Error loading tournaments from DB:', e)
    return []
  }
}

export const getTournamentById = async (tournamentId, clubId) => {
  const all = await getAllTournamentsFromIndexedDB(clubId)
  return all.find(t => t.tournamentId === tournamentId) || null
}

export const clearAllData = async () => {
  return true
}
