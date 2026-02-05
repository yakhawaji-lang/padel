// Storage utility - always uses database (no localStorage for data)

import { saveMembers, getMergedMembersRaw } from './storage/adminStorage.js'
import { getAppLanguage } from './storage/languageStorage.js'

const USE_POSTGRES = true

// ==================== LOCALSTORAGE (Current State) ====================

const STORAGE_KEYS = {
  KING_STATE: 'padel_king_state',
  KING_STATE_BY_TOURNAMENT: 'padel_king_state_by_tournament',
  SOCIAL_STATE: 'padel_social_state',
  SOCIAL_STATE_BY_TOURNAMENT: 'padel_social_state_by_tournament',
  MEMBERS: 'padel_members',
  CURRENT_TOURNAMENT_ID: 'padel_current_tournament_id',
  ACTIVE_TAB: 'padel_active_tab',
  LANGUAGE: 'padel_language',
  CONTENT_TAB: 'padel_content_tab',
  MEMBER_TAB: 'padel_member_tab'
}

// Save current state - persisted via club.tournamentData (DB) or appSettingsStorage
export const saveToLocalStorage = {
  kingState: (_state, _clubId = null) => { /* Saved in club.tournamentData via App */ },
  kingStateByTournament: (_stateByTournament, _clubId = null) => { /* Saved in club.tournamentData via App */ },
  socialState: (_state, _clubId = null) => { /* Saved in club.tournamentData via App */ },
  socialStateByTournament: (_stateByTournament, _clubId = null) => { /* Saved in club.tournamentData via App */ },
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
  currentTournamentId: (_id, _clubId = null) => { /* Saved in club.tournamentData via App */ },
  activeTab: (_tab) => { /* Saved in club.tournamentData via App */ },
  language: (lang) => {
    try {
      import('./storage/appSettingsStorage.js').then(({ setAppLanguage }) => setAppLanguage(lang))
    } catch (error) {
      console.error('Error saving language:', error)
    }
  },
  contentTab: (_tab) => { /* Saved in club.tournamentData via App */ },
  memberTab: (_tab) => { /* Saved in club.tournamentData via App */ }
}

// Load current state - from club.tournamentData (DB) or defaults (no localStorage)
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

// ==================== INDEXEDDB (Historical Records) ====================

const DB_NAME = 'PadelTournamentDB'
const DB_VERSION = 1
const STORES = {
  MATCHES: 'matches',
  MEMBER_STATS: 'member_stats',
  TOURNAMENTS: 'tournaments'
}

let dbInstance = null

// Initialize IndexedDB (no-op when using Postgres)
export const initIndexedDB = () => {
  if (USE_POSTGRES) return Promise.resolve(null)
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance)
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      console.error('IndexedDB error:', request.error)
      reject(request.error)
    }

    request.onsuccess = () => {
      dbInstance = request.result
      resolve(dbInstance)
    }

    request.onupgradeneeded = (event) => {
      const db = event.target.result

      // Create matches store
      if (!db.objectStoreNames.contains(STORES.MATCHES)) {
        const matchesStore = db.createObjectStore(STORES.MATCHES, { keyPath: 'id', autoIncrement: true })
        matchesStore.createIndex('timestamp', 'timestamp', { unique: false })
        matchesStore.createIndex('tournamentId', 'tournamentId', { unique: false })
        matchesStore.createIndex('tournamentType', 'tournamentType', { unique: false })
      }

      // Create member_stats store
      if (!db.objectStoreNames.contains(STORES.MEMBER_STATS)) {
        const memberStatsStore = db.createObjectStore(STORES.MEMBER_STATS, { keyPath: 'id', autoIncrement: true })
        memberStatsStore.createIndex('memberId', 'memberId', { unique: false })
        memberStatsStore.createIndex('timestamp', 'timestamp', { unique: false })
        memberStatsStore.createIndex('tournamentId', 'tournamentId', { unique: false })
      }

      // Create tournaments store
      if (!db.objectStoreNames.contains(STORES.TOURNAMENTS)) {
        const tournamentsStore = db.createObjectStore(STORES.TOURNAMENTS, { keyPath: 'id', autoIncrement: true })
        tournamentsStore.createIndex('timestamp', 'timestamp', { unique: false })
        tournamentsStore.createIndex('type', 'type', { unique: false })
      }
    }
  })
}

// Save match to IndexedDB or PostgreSQL. Pass clubId when using Postgres.
export const saveMatchToIndexedDB = async (match, tournamentType, tournamentId, clubId) => {
  if (USE_POSTGRES && clubId) {
    try {
      const { saveMatch } = await import('./api/dbClient.js')
      await saveMatch({ ...match, clubId }, tournamentType, tournamentId)
      return true
    } catch (e) {
      console.error('Error saving match to API:', e)
      return false
    }
  }
  try {
    const db = await initIndexedDB()
    const transaction = db.transaction([STORES.MATCHES], 'readwrite')
    const store = transaction.objectStore(STORES.MATCHES)

    const matchRecord = {
      ...match,
      tournamentType,
      tournamentId,
      savedAt: Date.now(),
      timestamp: Date.now() // Also set timestamp for index compatibility
    }

    await new Promise((resolve, reject) => {
      const request = store.add(matchRecord)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    return true
  } catch (error) {
    console.error('Error saving match to IndexedDB:', error)
    return false
  }
}

// Get all matches from IndexedDB or PostgreSQL. Pass clubId when using Postgres.
export const getAllMatchesFromIndexedDB = async (clubId) => {
  if (USE_POSTGRES && clubId) {
    try {
      const { getMatches } = await import('./api/dbClient.js')
      return await getMatches({ clubId })
    } catch (e) {
      console.error('Error loading matches from API:', e)
      return []
    }
  }
  try {
    const db = await initIndexedDB()
    if (!db) return []
    const transaction = db.transaction([STORES.MATCHES], 'readonly')
    const store = transaction.objectStore(STORES.MATCHES)

    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Error loading matches from IndexedDB:', error)
    return []
  }
}

// Get matches by date range
export const getMatchesByDateRange = async (startDate, endDate) => {
  try {
    const db = await initIndexedDB()
    const transaction = db.transaction([STORES.MATCHES], 'readonly')
    const store = transaction.objectStore(STORES.MATCHES)
    const index = store.index('timestamp')

    const range = IDBKeyRange.bound(startDate, endDate)

    return new Promise((resolve, reject) => {
      const request = index.getAll(range)
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Error loading matches by date range:', error)
    return []
  }
}

// Get matches by tournament type
export const getMatchesByTournamentType = async (tournamentType) => {
  try {
    const db = await initIndexedDB()
    const transaction = db.transaction([STORES.MATCHES], 'readonly')
    const store = transaction.objectStore(STORES.MATCHES)
    const index = store.index('tournamentType')

    return new Promise((resolve, reject) => {
      const request = index.getAll(tournamentType)
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Error loading matches by tournament type:', error)
    return []
  }
}

// Get matches by tournament ID
export const getMatchesByTournamentId = async (tournamentId) => {
  try {
    const db = await initIndexedDB()
    const transaction = db.transaction([STORES.MATCHES], 'readonly')
    const store = transaction.objectStore(STORES.MATCHES)
    const index = store.index('tournamentId')

    return new Promise((resolve, reject) => {
      const request = index.getAll(tournamentId)
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Error loading matches by tournament ID:', error)
    return []
  }
}

// Delete matches by tournament ID and type. Pass clubId when using Postgres.
export const deleteMatchesByTournament = async (tournamentId, tournamentType, clubId) => {
  if (USE_POSTGRES && clubId) {
    try {
      const api = await import('./api/dbClient.js')
      await api.deleteMatchesByTournament(clubId, tournamentId, tournamentType)
      return true
    } catch (e) {
      console.error('Error deleting matches from API:', e)
      return false
    }
  }
  try {
    const db = await initIndexedDB()
    const transaction = db.transaction([STORES.MATCHES], 'readwrite')
    const store = transaction.objectStore(STORES.MATCHES)
    
    // Get all matches for this tournament
    const allMatches = await getMatchesByTournamentId(tournamentId)
    const matchesToDelete = allMatches.filter(m => m.tournamentType === tournamentType)
    
    // Delete each match
    const deletePromises = matchesToDelete.map(match => {
      return new Promise((resolve, reject) => {
        const request = store.delete(match.id)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    })
    
    await Promise.all(deletePromises)
    return true
  } catch (error) {
    console.error('Error deleting matches by tournament:', error)
    return false
  }
}

// Delete matches by date and tournament type
export const deleteMatchesByDateAndType = async (date, tournamentType) => {
  try {
    const db = await initIndexedDB()
    const transaction = db.transaction([STORES.MATCHES], 'readwrite')
    const store = transaction.objectStore(STORES.MATCHES)
    
    // Get start and end of the selected date
    const selectedDateObj = new Date(date)
    const startOfDay = new Date(selectedDateObj)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(selectedDateObj)
    endOfDay.setHours(23, 59, 59, 999)
    
    // Get all matches from IndexedDB
    const allMatches = await getAllMatchesFromIndexedDB()
    
    // Filter matches by date and tournament type
    // Use savedAt or timestamp for date comparison
    const matchesToDelete = allMatches.filter(match => {
      const matchDate = new Date(match.savedAt || match.timestamp || 0)
      const matchDateOnly = new Date(matchDate.getFullYear(), matchDate.getMonth(), matchDate.getDate())
      const selectedDateOnly = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), selectedDateObj.getDate())
      
      // Check if dates match and tournament type matches
      return matchDateOnly.getTime() === selectedDateOnly.getTime() && 
             match.tournamentType === tournamentType
    })
    
    console.log('Matches to delete:', matchesToDelete.length, 'for date:', date, 'type:', tournamentType)
    
    if (matchesToDelete.length === 0) {
      return 0
    }
    
    // Delete each match
    const deletePromises = matchesToDelete.map(match => {
      return new Promise((resolve, reject) => {
        const request = store.delete(match.id)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    })
    
    await Promise.all(deletePromises)
    console.log('Successfully deleted', matchesToDelete.length, 'matches')
    return matchesToDelete.length
  } catch (error) {
    console.error('Error deleting matches by date and type:', error)
    return 0
  }
}

// Save member stats snapshot to IndexedDB
export const saveMemberStatsToIndexedDB = async (memberId, stats, tournamentId) => {
  try {
    const db = await initIndexedDB()
    const transaction = db.transaction([STORES.MEMBER_STATS], 'readwrite')
    const store = transaction.objectStore(STORES.MEMBER_STATS)

    const statsRecord = {
      memberId,
      tournamentId,
      stats: { ...stats },
      timestamp: Date.now()
    }

    await new Promise((resolve, reject) => {
      const request = store.add(statsRecord)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    return true
  } catch (error) {
    console.error('Error saving member stats to IndexedDB:', error)
    return false
  }
}

// Get member stats history from IndexedDB
export const getMemberStatsHistory = async (memberId) => {
  try {
    const db = await initIndexedDB()
    const transaction = db.transaction([STORES.MEMBER_STATS], 'readonly')
    const store = transaction.objectStore(STORES.MEMBER_STATS)
    const index = store.index('memberId')

    return new Promise((resolve, reject) => {
      const request = index.getAll(memberId)
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Error loading member stats history:', error)
    return []
  }
}

// Save tournament summary to IndexedDB
export const saveTournamentToIndexedDB = async (tournamentData) => {
  try {
    const db = await initIndexedDB()
    const transaction = db.transaction([STORES.TOURNAMENTS], 'readwrite')
    const store = transaction.objectStore(STORES.TOURNAMENTS)

    const tournamentRecord = {
      ...tournamentData,
      timestamp: Date.now()
    }

    await new Promise((resolve, reject) => {
      const request = store.add(tournamentRecord)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    return true
  } catch (error) {
    console.error('Error saving tournament to IndexedDB:', error)
    return false
  }
}

// Get all tournaments from IndexedDB
export const getAllTournamentsFromIndexedDB = async () => {
  try {
    const db = await initIndexedDB()
    const transaction = db.transaction([STORES.TOURNAMENTS], 'readonly')
    const store = transaction.objectStore(STORES.TOURNAMENTS)

    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => {
        const tournaments = request.result || []
        // Sort by timestamp descending (newest first)
        tournaments.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        resolve(tournaments)
      }
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Error loading tournaments from IndexedDB:', error)
    return []
  }
}

// Get tournament by ID
export const getTournamentById = async (tournamentId) => {
  try {
    const db = await initIndexedDB()
    const transaction = db.transaction([STORES.TOURNAMENTS], 'readonly')
    const store = transaction.objectStore(STORES.TOURNAMENTS)

    return new Promise((resolve, reject) => {
      const request = store.get(tournamentId)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Error loading tournament by ID:', error)
    return null
  }
}

// Clear all data (for testing/reset) - DB is source of truth; this clears IndexedDB only if used
export const clearAllData = async () => {
  try {
    // No localStorage - data is in DB

    // Clear IndexedDB
    const db = await initIndexedDB()
    const transaction = db.transaction([STORES.MATCHES, STORES.MEMBER_STATS, STORES.TOURNAMENTS], 'readwrite')
    
    await Promise.all([
      new Promise((resolve, reject) => {
        const request = transaction.objectStore(STORES.MATCHES).clear()
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      }),
      new Promise((resolve, reject) => {
        const request = transaction.objectStore(STORES.MEMBER_STATS).clear()
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      }),
      new Promise((resolve, reject) => {
        const request = transaction.objectStore(STORES.TOURNAMENTS).clear()
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    ])

    return true
  } catch (error) {
    console.error('Error clearing all data:', error)
    return false
  }
}

