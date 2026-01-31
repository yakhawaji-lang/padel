// Storage utility for hybrid localStorage + IndexedDB approach

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

// Save current state to localStorage
export const saveToLocalStorage = {
  kingState: (state, clubId = null) => {
    try {
      const key = clubId ? `${STORAGE_KEYS.KING_STATE}_${clubId}` : STORAGE_KEYS.KING_STATE
      localStorage.setItem(key, JSON.stringify(state))
    } catch (error) {
      console.error('Error saving king state:', error)
    }
  },

  kingStateByTournament: (stateByTournament, clubId = null) => {
    try {
      const key = clubId ? `${STORAGE_KEYS.KING_STATE_BY_TOURNAMENT}_${clubId}` : STORAGE_KEYS.KING_STATE_BY_TOURNAMENT
      localStorage.setItem(key, JSON.stringify(stateByTournament))
    } catch (error) {
      console.error('Error saving king state by tournament:', error)
    }
  },
  
  socialState: (state, clubId = null) => {
    try {
      const key = clubId ? `${STORAGE_KEYS.SOCIAL_STATE}_${clubId}` : STORAGE_KEYS.SOCIAL_STATE
      localStorage.setItem(key, JSON.stringify(state))
    } catch (error) {
      console.error('Error saving social state:', error)
    }
  },

  socialStateByTournament: (stateByTournament, clubId = null) => {
    try {
      const key = clubId ? `${STORAGE_KEYS.SOCIAL_STATE_BY_TOURNAMENT}_${clubId}` : STORAGE_KEYS.SOCIAL_STATE_BY_TOURNAMENT
      localStorage.setItem(key, JSON.stringify(stateByTournament))
    } catch (error) {
      console.error('Error saving social state by tournament:', error)
    }
  },
  
  members: (members) => {
    try {
      localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members))
    } catch (error) {
      console.error('Error saving members:', error)
    }
  },
  
  currentTournamentId: (id, clubId = null) => {
    try {
      const key = clubId ? `${STORAGE_KEYS.CURRENT_TOURNAMENT_ID}_${clubId}` : STORAGE_KEYS.CURRENT_TOURNAMENT_ID
      localStorage.setItem(key, JSON.stringify(id))
      // Also save to club data (will be handled by App.jsx)
    } catch (error) {
      console.error('Error saving tournament ID:', error)
    }
  },
  
  activeTab: (tab) => {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, tab)
    } catch (error) {
      console.error('Error saving active tab:', error)
    }
  },
  
  language: (lang) => {
    try {
      localStorage.setItem(STORAGE_KEYS.LANGUAGE, lang)
    } catch (error) {
      console.error('Error saving language:', error)
    }
  },
  
  contentTab: (tab) => {
    try {
      localStorage.setItem(STORAGE_KEYS.CONTENT_TAB, tab)
    } catch (error) {
      console.error('Error saving content tab:', error)
    }
  },
  
  memberTab: (tab) => {
    try {
      localStorage.setItem(STORAGE_KEYS.MEMBER_TAB, tab)
    } catch (error) {
      console.error('Error saving member tab:', error)
    }
  }
}

// Load current state from localStorage
export const loadFromLocalStorage = {
  kingState: (clubId = null) => {
    try {
      if (clubId) {
        const clubKey = `${STORAGE_KEYS.KING_STATE}_${clubId}`
        const clubData = localStorage.getItem(clubKey)
        if (clubData) return JSON.parse(clubData)
      }
      const data = localStorage.getItem(STORAGE_KEYS.KING_STATE)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error('Error loading king state:', error)
      return null
    }
  },

  kingStateByTournament: (clubId = null) => {
    try {
      const key = clubId ? `${STORAGE_KEYS.KING_STATE_BY_TOURNAMENT}_${clubId}` : STORAGE_KEYS.KING_STATE_BY_TOURNAMENT
      const data = localStorage.getItem(key)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error('Error loading king state by tournament:', error)
      return null
    }
  },
  
  socialState: (clubId = null) => {
    try {
      if (clubId) {
        const clubKey = `${STORAGE_KEYS.SOCIAL_STATE}_${clubId}`
        const clubData = localStorage.getItem(clubKey)
        if (clubData) return JSON.parse(clubData)
      }
      const data = localStorage.getItem(STORAGE_KEYS.SOCIAL_STATE)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error('Error loading social state:', error)
      return null
    }
  },

  socialStateByTournament: (clubId = null) => {
    try {
      const key = clubId ? `${STORAGE_KEYS.SOCIAL_STATE_BY_TOURNAMENT}_${clubId}` : STORAGE_KEYS.SOCIAL_STATE_BY_TOURNAMENT
      const data = localStorage.getItem(key)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error('Error loading social state by tournament:', error)
      return null
    }
  },
  
  members: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MEMBERS)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error('Error loading members:', error)
      return null
    }
  },
  
  currentTournamentId: (clubId = null) => {
    try {
      // Try club-specific first
      if (clubId) {
        // Try from localStorage with club key
        const clubKey = `${STORAGE_KEYS.CURRENT_TOURNAMENT_ID}_${clubId}`
        const clubData = localStorage.getItem(clubKey)
        if (clubData) {
          return JSON.parse(clubData)
        }
      }
      // Fallback to global (for backward compatibility)
      const data = localStorage.getItem(STORAGE_KEYS.CURRENT_TOURNAMENT_ID)
      return data ? JSON.parse(data) : 1
    } catch (error) {
      console.error('Error loading tournament ID:', error)
      return 1
    }
  },
  
  activeTab: () => {
    try {
      return localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB) || 'king'
    } catch (error) {
      console.error('Error loading active tab:', error)
      return 'king'
    }
  },
  
  language: () => {
    try {
      return localStorage.getItem(STORAGE_KEYS.LANGUAGE) || 'en'
    } catch (error) {
      console.error('Error loading language:', error)
      return 'en'
    }
  },
  
  contentTab: () => {
    try {
      return localStorage.getItem(STORAGE_KEYS.CONTENT_TAB) || 'standings'
    } catch (error) {
      console.error('Error loading content tab:', error)
      return 'standings'
    }
  },
  
  memberTab: () => {
    try {
      return localStorage.getItem(STORAGE_KEYS.MEMBER_TAB) || 'members'
    } catch (error) {
      console.error('Error loading member tab:', error)
      return 'members'
    }
  }
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

// Initialize IndexedDB
export const initIndexedDB = () => {
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

// Save match to IndexedDB
export const saveMatchToIndexedDB = async (match, tournamentType, tournamentId) => {
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

// Get all matches from IndexedDB
export const getAllMatchesFromIndexedDB = async () => {
  try {
    const db = await initIndexedDB()
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

// Delete matches by tournament ID and type
export const deleteMatchesByTournament = async (tournamentId, tournamentType) => {
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

// Clear all data (for testing/reset)
export const clearAllData = async () => {
  try {
    // Clear localStorage
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key)
    })

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

