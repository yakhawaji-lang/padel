// Admin Storage - Multi-club management
// Uses PostgreSQL (via API) when VITE_USE_POSTGRES=true, else localStorage

const USE_POSTGRES = (typeof import.meta === 'undefined' || import.meta.env?.VITE_USE_POSTGRES !== 'false')

const ADMIN_STORAGE_KEYS = {
  CLUBS: 'admin_clubs',
  SETTINGS: 'admin_settings',
  CURRENT_CLUB: 'admin_current_club_id',
  PLATFORM_ADMINS: 'platform_admins'
}

const MEMBER_STORAGE_KEYS = {
  ALL: 'all_members',
  PADEL: 'padel_members'
}

let _clubsCache = null
let _backendStorage = null

export function initBackendStorage(backend) {
  _backendStorage = backend
}

function _read(key) {
  if (USE_POSTGRES && _backendStorage) return _backendStorage.getCache(key) ?? null
  try {
    const v = localStorage.getItem(key)
    return v != null ? JSON.parse(v) : null
  } catch (_) { return null }
}

function _write(key, value) {
  if (USE_POSTGRES && _backendStorage) {
    _backendStorage.setCache(key, value)
    _backendStorage.setStore(key, value).catch(e => console.error('_write:', e))
    return
  }
  try { localStorage.setItem(key, JSON.stringify(value)) } catch (_) {}
}

/**
 * Load and merge members from both all_members and padel_members.
 * all_members takes precedence for platform registrations.
 */
export function getMergedMembersRaw() {
  let members = []
  let allMembers = []
  try {
    const pm = _read(MEMBER_STORAGE_KEYS.PADEL)
    if (Array.isArray(pm)) members = pm
  } catch (_) {}
  try {
    const am = _read(MEMBER_STORAGE_KEYS.ALL)
    if (Array.isArray(am)) allMembers = am
  } catch (_) {}
  const byId = new Map()
  members.forEach(m => { if (m && m.id) byId.set(m.id, m) })
  allMembers.forEach(m => { if (m && m.id) byId.set(m.id, { ...byId.get(m.id), ...m }) })
  return Array.from(byId.values())
}

/**
 * Save members to BOTH all_members and padel_members. Single source of truth.
 * Call after any member add/update. Triggers clubs sync and clubs-synced event.
 */
export function saveMembers(members) {
  if (!Array.isArray(members)) return false
  try {
    _write(MEMBER_STORAGE_KEYS.ALL, members)
    _write(MEMBER_STORAGE_KEYS.PADEL, members)
    const clubs = loadClubs()
    syncMembersToClubs(clubs)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('clubs-synced'))
    }
    return true
  } catch (e) {
    console.error('saveMembers error:', e)
    if (e?.name === 'QuotaExceededError') {
      try { _write(MEMBER_STORAGE_KEYS.ALL, members) } catch (_) {}
    }
    return false
  }
}

/**
 * Add or update a member. Merges with existing. Saves to both storages.
 */
export function upsertMember(member) {
  if (!member || !member.id) return null
  const members = getMergedMembersRaw()
  const idx = members.findIndex(m => m.id === member.id)
  const merged = { ...(idx >= 0 ? members[idx] : {}), ...member }
  if (idx >= 0) members[idx] = merged
  else members.push(merged)
  return saveMembers(members) ? merged : null
}

/**
 * Add a member to one or more clubs. Saves to both storages; syncMembersToClubs updates clubs.
 */
export function addMemberToClub(memberId, clubIdOrIds) {
  const clubIds = Array.isArray(clubIdOrIds) ? clubIdOrIds : [clubIdOrIds]
  const members = getMergedMembersRaw()
  const member = members.find(m => m.id === memberId)
  if (!member) return false
  const currentIds = member.clubIds || (member.clubId ? [member.clubId] : [])
  let changed = false
  clubIds.forEach(cid => {
    if (!currentIds.includes(cid)) {
      currentIds.push(cid)
      changed = true
    }
  })
  if (!changed) return true
  member.clubIds = currentIds
  member.clubId = currentIds[0]
  return saveMembers(members)
}

/**
 * Deduplicate clubs: keep one per id, remove pending when approved exists (same adminEmail),
 * and for approved clubs keep only one per adminEmail (prefer by name match)
 */
function deduplicateClubs(clubs) {
  if (!Array.isArray(clubs)) return clubs
  const byId = new Map()
  const approvedEmails = new Set()
  const seenApprovedEmails = new Map()
  clubs.forEach(c => {
    if (!c?.id) return
    if (c.status === 'approved' || !c.status) {
      const email = (c.adminEmail || c.email || '').toLowerCase()
      if (email) approvedEmails.add(email)
    }
  })
  clubs.forEach(c => {
    if (!c?.id) return
    if (byId.has(c.id)) return
    if (c.status === 'pending') {
      const email = (c.adminEmail || c.email || '').toLowerCase()
      if (email && approvedEmails.has(email)) return
    }
    if (c.status === 'approved' || !c.status) {
      const email = (c.adminEmail || c.email || '').toLowerCase()
      if (email && seenApprovedEmails.has(email)) return
      if (email) seenApprovedEmails.set(email, c.id)
    }
    byId.set(c.id, c)
  })
  return Array.from(byId.values())
}

/**
 * Merge remote clubs with local, preserving court images and local-only courts
 * (remote may not have images due to size limits, or may be stale)
 */
function mergeClubsPreservingLocalImages(remote, local) {
  if (!Array.isArray(remote)) return remote
  if (!Array.isArray(local) || local.length === 0) return deduplicateClubs(remote)
  const merged = remote
    .filter(rc => {
      if (rc.status !== 'pending') return true
      const email = (rc.adminEmail || rc.email || '').toLowerCase()
      const hasApproved = local.some(lc => (lc.status === 'approved' || !lc.status) && (lc.adminEmail || lc.email || '').toLowerCase() === email)
      return !hasApproved
    })
    .map(remoteClub => {
      const localClub = local.find(c => c.id === remoteClub.id)
      if (!localClub?.courts?.length) return remoteClub
      const remoteCourts = remoteClub.courts || []
      const mergedCourts = remoteCourts.map(remoteCourt => {
        const localCourt = localClub.courts.find(c => c.id === remoteCourt.id)
        if (localCourt?.image && !remoteCourt?.image) {
          return { ...remoteCourt, image: localCourt.image }
        }
        return remoteCourt
      })
      const localOnlyCourts = localClub.courts.filter(
        lc => !mergedCourts.some(mc => mc.id === lc.id)
      )
      return { ...remoteClub, courts: [...mergedCourts, ...localOnlyCourts] }
    })
  const localOnlyClubs = local.filter(lc => !remote.some(rc => rc.id === lc.id))
  return deduplicateClubs([...merged, ...localOnlyClubs])
}

/**
 * Load clubs from backend (PostgreSQL) or Supabase. Call once at app bootstrap.
 */
export async function loadClubsAsync() {
  if (USE_POSTGRES && _backendStorage) {
    try {
      await _backendStorage.bootstrap()
      const clubs = _backendStorage.getCache(ADMIN_STORAGE_KEYS.CLUBS) || []
      _clubsCache = deduplicateClubs(clubs)
      syncMembersToClubs(_clubsCache)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('clubs-synced'))
      }
    } catch (e) {
      console.warn('loadClubsAsync (Postgres) failed:', e)
    }
    return
  }
  try {
    const { getRemoteClubs } = await import('./supabaseSync.js')
    const remote = await getRemoteClubs()
    if (remote === null || !Array.isArray(remote)) return
    let local = _read(ADMIN_STORAGE_KEYS.CLUBS) || []
    let merged = mergeClubsPreservingLocalImages(remote, local)
    if (!merged.length || !merged.some(c => c.id === 'hala-padel')) {
      const hala = createExampleHalaPadel()
      if (!merged.length) merged = [hala]
      else if (!merged.some(c => c.id === 'hala-padel')) merged = [hala, ...merged]
    }
    syncMembersToClubs(merged)
    _write(ADMIN_STORAGE_KEYS.CLUBS, merged)
    _clubsCache = merged
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('clubs-synced'))
    }
  } catch (e) {
    console.warn('loadClubsAsync failed:', e)
  }
}

/**
 * Refresh clubs from API (PostgreSQL). Call periodically so admin sees new pending registrations from other devices.
 */
export async function refreshClubsFromApi() {
  if (!USE_POSTGRES || !_backendStorage) return
  try {
    await _backendStorage.refreshStoreKeys([ADMIN_STORAGE_KEYS.CLUBS])
    const clubs = _backendStorage.getCache(ADMIN_STORAGE_KEYS.CLUBS) || []
    _clubsCache = deduplicateClubs(clubs)
    syncMembersToClubs(_clubsCache)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('clubs-synced'))
    }
  } catch (e) {
    console.warn('refreshClubsFromApi failed:', e)
  }
}

/**
 * Apply clubs received from another device (real-time sync). Updates cache and storage.
 * No-op when using Postgres (data comes from API).
 */
export function applyRemoteClubs(clubs) {
  if (USE_POSTGRES) return
  if (!Array.isArray(clubs)) return
  try {
    let local = _read(ADMIN_STORAGE_KEYS.CLUBS) || []
    let merged = mergeClubsPreservingLocalImages(clubs, local)
    if (!merged.length || !merged.some(c => c.id === 'hala-padel')) {
      const hala = createExampleHalaPadel()
      if (!merged.length) merged = [hala]
      else if (!merged.some(c => c.id === 'hala-padel')) merged = [hala, ...merged]
    }
    syncMembersToClubs(merged)
    _write(ADMIN_STORAGE_KEYS.CLUBS, merged)
    _clubsCache = merged
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('clubs-synced'))
    }
  } catch (e) {
    console.warn('applyRemoteClubs failed:', e)
  }
}

// Clubs Management
export const loadClubs = () => {
  try {
    if (_clubsCache != null) {
      syncMembersToClubs(_clubsCache)
      return deduplicateClubs(_clubsCache)
    }
    const clubs = _read(ADMIN_STORAGE_KEYS.CLUBS)
    if (clubs && Array.isArray(clubs)) {
      // Ensure Hala Padel exists if clubs array is empty or doesn't contain it
      if (clubs.length === 0 || !clubs.some(c => c.id === 'hala-padel')) {
        const halaPadel = createExampleHalaPadel()
        if (clubs.length === 0) {
          saveClubs([halaPadel])
          _clubsCache = [halaPadel]
          return [halaPadel]
        } else {
          // Add Hala Padel at the beginning if it doesn't exist
          clubs.unshift(halaPadel)
          saveClubs(clubs)
          _clubsCache = clubs
          return clubs
        }
      }
      
      // Sync members from localStorage to clubs
      syncMembersToClubs(clubs)
      // Migrate: ensure store/storeEnabled and club hours exist
      let storeMigration = false
      clubs.forEach(club => {
        if (club.storeEnabled === undefined) {
          club.storeEnabled = false
          storeMigration = true
        }
        if (!club.store || !Array.isArray(club.store.categories)) {
          club.store = club.store && typeof club.store === 'object'
            ? { name: club.store.name || '', nameAr: club.store.nameAr || '', categories: club.store.categories || [], products: club.store.products || [], sales: club.store.sales || [], inventoryMovements: club.store.inventoryMovements || [], offers: club.store.offers || [], coupons: club.store.coupons || [], minStockAlert: club.store.minStockAlert ?? 5 }
            : { name: '', nameAr: '', categories: [], products: [], sales: [], inventoryMovements: [], offers: [], coupons: [], minStockAlert: 5 }
          storeMigration = true
        }
        if (!Array.isArray(club.store.offers)) {
          club.store.offers = club.store.offers || []
          storeMigration = true
        }
        if (!Array.isArray(club.store.coupons)) {
          club.store.coupons = club.store.coupons || []
          storeMigration = true
        }
        if (!Array.isArray(club.store.sales)) {
          club.store.sales = club.store.sales || []
          storeMigration = true
        }
        if (!Array.isArray(club.store.inventoryMovements)) {
          club.store.inventoryMovements = club.store.inventoryMovements || []
          storeMigration = true
        }
        if (club.store.minStockAlert === undefined) {
          club.store.minStockAlert = 5
          storeMigration = true
        }
        if (!club.settings) club.settings = {}
        if (club.settings.openingTime === undefined) {
          club.settings.openingTime = '06:00'
          storeMigration = true
        }
        if (club.settings.closingTime === undefined) {
          club.settings.closingTime = '23:00'
          storeMigration = true
        }
        if (!Array.isArray(club.offers)) {
          club.offers = []
          storeMigration = true
        }
      })
      if (storeMigration) saveClubs(clubs)
      const deduped = deduplicateClubs(clubs)
      if (deduped.length !== clubs.length) saveClubs(deduped)
      _clubsCache = deduped
      return deduped
    }
    const halaPadel = createExampleHalaPadel()
    saveClubs([halaPadel])
    _clubsCache = [halaPadel]
    return [halaPadel]
  } catch (error) {
    console.error('Error loading clubs:', error)
    // Even on error, try to create Hala Padel
    try {
      const halaPadel = createExampleHalaPadel()
      saveClubs([halaPadel])
      _clubsCache = [halaPadel]
      return [halaPadel]
    } catch (e) {
      return []
    }
  }
}

// Sync members from localStorage to clubs
export const syncMembersToClubs = (clubs) => {
  try {
    const mergedMembers = getMergedMembersRaw()
    // For each club, sync members
    let hasChanges = false
    clubs.forEach(club => {
      if (!club.members) {
        club.members = []
      }
      
      // Find members that belong to this club
      // Support both old format (clubId) and new format (clubIds array)
      const clubMembers = mergedMembers.filter(member => {
        // New format: member has clubIds array
        if (member.clubIds && Array.isArray(member.clubIds)) {
          return member.clubIds.includes(club.id)
        }
        
        // Old format: member has clubId (single club) - convert to array format
        if (member.clubId) {
          // If member belongs to this club, add it
          if (member.clubId === club.id) {
            // Convert old format to new format
            if (!member.clubIds) {
              member.clubIds = [member.clubId]
            } else if (!member.clubIds.includes(member.clubId)) {
              member.clubIds.push(member.clubId)
            }
            return true
          }
          return false
        }
        
        // If no clubId/clubIds, assign to hala-padel by default (for backward compatibility)
        if (club.id === 'hala-padel') {
          // Initialize clubIds for this member
          if (!member.clubIds) {
            member.clubIds = ['hala-padel']
          } else if (!member.clubIds.includes('hala-padel')) {
            member.clubIds.push('hala-padel')
          }
          return true
        }
        
        return false
      })
      
      // Update club members if different
      const currentMemberIds = new Set(club.members.map(m => m.id))
      const newMemberIds = new Set(clubMembers.map(m => m.id))
      
      if (currentMemberIds.size !== newMemberIds.size || 
          !Array.from(currentMemberIds).every(id => newMemberIds.has(id))) {
        club.members = clubMembers.map(m => ({
          id: m.id,
          name: m.name,
          email: m.email,
          avatar: m.avatar,
          mobile: m.mobile || m.phone,
          totalGames: m.totalGames || 0,
          totalWins: m.totalWins || 0,
          totalPoints: m.totalPoints || 0,
          clubIds: m.clubIds || (m.clubId ? [m.clubId] : []) // Preserve clubIds
        }))
        hasChanges = true
      }
    })
    
    // Save updated members back to localStorage with clubIds format
    if (hasChanges) {
      try {
        // Update members in localStorage to include clubIds
        const updatedMembersMap = new Map()
        mergedMembers.forEach(member => {
          if (member.id) {
            // Ensure clubIds exists
            if (!member.clubIds) {
              if (member.clubId) {
                member.clubIds = [member.clubId]
              } else {
                member.clubIds = ['hala-padel'] // Default
              }
            }
            updatedMembersMap.set(member.id, member)
          }
        })
        
        const updatedMembers = Array.from(updatedMembersMap.values())
        try {
          _write(MEMBER_STORAGE_KEYS.ALL, updatedMembers)
          _write(MEMBER_STORAGE_KEYS.PADEL, updatedMembers)
        } catch (e) {
          console.error('syncMembersToClubs save error:', e)
        }
      } catch (error) {
        console.error('Error updating members with clubIds:', error)
      }
    }
    
    // Save if there were changes
    if (hasChanges) {
      saveClubs(clubs)
      console.log('Synced members to clubs:', clubs.map(c => ({ name: c.name, members: c.members.length })))
    }
  } catch (error) {
    console.error('Error syncing members to clubs:', error)
  }
}

// Create Hala Padel as example club
const createExampleHalaPadel = () => {
  return {
    id: 'hala-padel',
    name: 'Hala Padel',
    nameAr: 'هلا بادل',
    tagline: 'Indoor courts • King of the Court & Social tournaments • For all levels',
    taglineAr: 'ملاعب داخلية • بطولات ملك الملعب وسوشيال • لجميع المستويات',
    address: 'Arid District, 11234, Riyadh',
    addressAr: 'حي العارض، 11234، الرياض',
    phone: '',
    email: '',
    website: 'https://playtomic.com/clubs/hala-padel',
    playtomicVenueId: 'hala-padel',
    playtomicApiKey: '',
    courts: [
      { id: 'court-1', name: 'Court 1', nameAr: 'الملعب 1', type: 'indoor' },
      { id: 'court-2', name: 'Court 2', nameAr: 'الملعب 2', type: 'indoor' },
      { id: 'court-3', name: 'Court 3', nameAr: 'الملعب 3', type: 'indoor' },
      { id: 'court-4', name: 'Court 4', nameAr: 'الملعب 4', type: 'indoor' }
    ],
    settings: {
      defaultLanguage: 'en',
      timezone: 'Asia/Riyadh',
      currency: 'SAR',
      bookingDuration: 60,
      maxBookingAdvance: 30,
      cancellationPolicy: 24,
      openingTime: '06:00',
      closingTime: '23:00'
    },
    tournaments: [],
    tournamentTypes: [
      {
        id: 'king-of-court',
        name: 'King of the Court',
        nameAr: 'ملك الملعب',
        description: 'Winners stay on court',
        descriptionAr: 'الفائزون يبقون على الملعب'
      },
      {
        id: 'social',
        name: 'Social Tournament',
        nameAr: 'بطولة سوشيال',
        description: 'Round-robin format',
        descriptionAr: 'نظام دوري'
      }
    ],
    members: [],
    bookings: [],
    offers: [],
    accounting: [],
    storeEnabled: false,
    store: {
      name: '',
      nameAr: '',
      categories: [],
      products: [],
      sales: [],
      inventoryMovements: [],
      offers: [],
      coupons: [],
      minStockAlert: 5
    },
    tournamentData: {
      // Club-specific tournament data (King of Court, Social Tournament states)
      kingState: null,
      socialState: null,
      currentTournamentId: 1
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}

// Helper function to create example club (optional - for demo purposes)
export const createExampleClub = () => {
  return {
    id: 'example-club-' + Date.now(),
    name: 'Example Club',
    nameAr: 'نادي مثال',
    logo: '',
    tagline: '',
    taglineAr: '',
    address: '',
    addressAr: '',
    phone: '',
    email: '',
    website: '',
    playtomicVenueId: '',
    playtomicApiKey: '',
    courts: [
      { id: 'court-1', name: 'Court 1', nameAr: 'الملعب 1', type: 'indoor' },
      { id: 'court-2', name: 'Court 2', nameAr: 'الملعب 2', type: 'indoor' },
      { id: 'court-3', name: 'Court 3', nameAr: 'الملعب 3', type: 'indoor' },
      { id: 'court-4', name: 'Court 4', nameAr: 'الملعب 4', type: 'indoor' }
    ],
    settings: {
      defaultLanguage: 'en',
      timezone: 'Asia/Riyadh',
      currency: 'SAR',
      bookingDuration: 60, // minutes
      maxBookingAdvance: 30, // days
      cancellationPolicy: 24, // hours before booking
      openingTime: '06:00',
      closingTime: '23:00'
    },
    tournaments: [],
    tournamentTypes: [
      {
        id: 'king-of-court',
        name: 'King of the Court',
        nameAr: 'ملك الملعب',
        description: 'Winners stay on court',
        descriptionAr: 'الفائزون يبقون على الملعب'
      },
      {
        id: 'social',
        name: 'Social Tournament',
        nameAr: 'بطولة سوشيال',
        description: 'Round-robin format',
        descriptionAr: 'نظام دوري'
      }
    ],
    members: [],
    bookings: [],
    offers: [],
    accounting: [],
    storeEnabled: false,
    store: {
      name: '',
      nameAr: '',
      categories: [],
      products: [],
      sales: [],
      inventoryMovements: [],
      offers: [],
      coupons: [],
      minStockAlert: 5
    },
    tournamentData: {
      // Club-specific tournament data (King of Court, Social Tournament states)
      kingState: null,
      socialState: null,
      currentTournamentId: 1
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}

export const saveClubs = (clubs) => {
  try {
    _write(ADMIN_STORAGE_KEYS.CLUBS, clubs)
    _clubsCache = clubs
    if (!USE_POSTGRES) {
      import('./supabaseSync.js').then(({ setRemoteClubs }) => setRemoteClubs(clubs)).catch(() => {})
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('clubs-synced'))
    }
  } catch (error) {
    console.error('Error saving clubs:', error)
    if (error?.name === 'QuotaExceededError' || error?.code === 22) {
      alert('Storage limit reached. Court images may be too large. Try using image URLs instead of uploads.')
    }
  }
}

/** Async save for Postgres - awaits API persistence before returning. */
export async function saveClubsAsync(clubs) {
  try {
    if (USE_POSTGRES && _backendStorage) {
      _backendStorage.setCache(ADMIN_STORAGE_KEYS.CLUBS, clubs)
      _clubsCache = clubs
      await _backendStorage.setStore(ADMIN_STORAGE_KEYS.CLUBS, clubs)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('clubs-synced'))
      }
      return true
    }
    saveClubs(clubs)
    return true
  } catch (e) {
    console.error('saveClubsAsync failed:', e)
    return false
  }
}

export const getClubById = (clubId, forceFromStorage = false) => {
  let clubs
  if (forceFromStorage) {
    clubs = _read(ADMIN_STORAGE_KEYS.CLUBS) || []
    if (!Array.isArray(clubs)) clubs = []
  } else {
    clubs = loadClubs()
  }
  return clubs?.find(club => club.id === clubId)
}

export const updateClub = (clubId, updates) => {
  const clubs = loadClubs()
  const updatedClubs = clubs.map(club => 
    club.id === clubId 
      ? { ...club, ...updates, updatedAt: new Date().toISOString() }
      : club
  )
  saveClubs(updatedClubs)
  return updatedClubs.find(club => club.id === clubId)
}

/** Pending club registration - requires admin approval. Returns Promise when using Postgres. */
export async function addPendingClub(clubData) {
  const clubs = loadClubs()
  const existing = clubs.find(c => (c.adminEmail || c.email || '').toLowerCase() === (clubData.adminEmail || clubData.email || '').toLowerCase())
  if (existing) return { error: 'EMAIL_EXISTS' }
  const newClub = {
    id: 'club-pending-' + Date.now(),
    name: clubData.name || '',
    nameAr: clubData.nameAr || '',
    address: clubData.address || clubData.location?.address || '',
    addressAr: clubData.addressAr || clubData.location?.address || '',
    location: clubData.location || null,
    phone: clubData.phone || '',
    email: clubData.email || '',
    website: clubData.website || '',
    commercialRegister: clubData.commercialRegister || '',
    commercialRegisterImage: clubData.commercialRegisterImage || '',
    adminEmail: clubData.adminEmail || clubData.email || '',
    adminPassword: clubData.adminPassword || '',
    courts: (clubData.courts || []).length ? clubData.courts : [
      { id: 'court-1', name: 'Court 1', nameAr: 'الملعب 1', type: 'indoor' },
      { id: 'court-2', name: 'Court 2', nameAr: 'الملعب 2', type: 'indoor' },
      { id: 'court-3', name: 'Court 3', nameAr: 'الملعب 3', type: 'indoor' },
      { id: 'court-4', name: 'Court 4', nameAr: 'الملعب 4', type: 'indoor' }
    ],
    settings: clubData.settings || { defaultLanguage: 'en', timezone: 'Asia/Riyadh', currency: 'SAR', bookingDuration: 60, maxBookingAdvance: 30, cancellationPolicy: 24, openingTime: '06:00', closingTime: '23:00' },
    tournaments: [],
    tournamentTypes: clubData.tournamentTypes || [
      { id: 'king-of-court', name: 'King of the Court', nameAr: 'ملك الملعب', description: 'Winners stay on court', descriptionAr: 'الفائزون يبقون على الملعب' },
      { id: 'social', name: 'Social Tournament', nameAr: 'بطولة سوشيال', description: 'Round-robin format', descriptionAr: 'نظام دوري' }
    ],
    members: [],
    bookings: [],
    offers: [],
    accounting: [],
    storeEnabled: false,
    store: { name: '', nameAr: '', categories: [], products: [], sales: [], inventoryMovements: [], offers: [], coupons: [], minStockAlert: 5 },
    tournamentData: { kingState: null, socialState: null, currentTournamentId: 1 },
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  clubs.push(newClub)
  if (USE_POSTGRES && _backendStorage) {
    const ok = await saveClubsAsync(clubs)
    if (!ok) return { error: 'SAVE_FAILED' }
  } else {
    saveClubs(clubs)
  }
  return { club: newClub }
}

/** Approve a pending club - sets status to approved and assigns proper id */
export const approveClub = (clubId) => {
  const clubs = loadClubs()
  const club = clubs.find(c => c.id === clubId)
  if (!club || club.status !== 'pending') return null
  let slug = (club.name || 'club').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  if (!slug) slug = 'club'
  const newId = `${slug}-${Date.now()}`
  const updatedClub = { ...club, id: newId, status: 'approved', updatedAt: new Date().toISOString() }
  const updatedClubs = clubs.map(c => c.id === clubId ? updatedClub : c)
  saveClubs(updatedClubs)
  return updatedClub
}

/** Reject/remove a pending club */
export const rejectClub = (clubId) => {
  const clubs = loadClubs()
  const club = clubs.find(c => c.id === clubId)
  if (!club || club.status !== 'pending') return false
  const updatedClubs = clubs.filter(c => c.id !== clubId)
  saveClubs(updatedClubs)
  return true
}

/** Find club by admin email/password for club login */
export const getClubByAdminCredentials = (email, password) => {
  const clubs = loadClubs()
  const club = clubs.find(c =>
    (c.adminEmail || c.email || '').toLowerCase() === (email || '').toLowerCase() &&
    (c.adminPassword || '') === (password || '') &&
    (c.status === 'approved' || !c.status)
  )
  if (club) return club
  const em = (email || '').trim().toLowerCase()
  for (const c of clubs) {
    if ((c.status !== 'approved' && c.status) ? false : true) {
      const users = c.adminUsers || []
      const u = users.find(au => (au.email || '').toLowerCase() === em && (au.password || '') === (password || ''))
      if (u) return c
    }
  }
  return null
}

/** Get club admin session from credentials - returns { club, isOwner, permissions } for setClubAdminSession */
export const getClubAdminSessionFromCredentials = (email, password) => {
  const clubs = loadClubs()
  const em = (email || '').trim().toLowerCase()
  for (const club of clubs) {
    if (club.status && club.status !== 'approved') continue
    if ((club.adminEmail || club.email || '').toLowerCase() === em && (club.adminPassword || '') === (password || '')) {
      return { club, isOwner: true, clubId: club.id, userId: 'owner', permissions: ['dashboard', 'members', 'offers', 'store', 'accounting', 'settings', 'users'] }
    }
    const users = club.adminUsers || []
    const u = users.find(au => (au.email || '').toLowerCase() === em && (au.password || '') === (password || ''))
    if (u) {
      return { club, isOwner: false, clubId: club.id, userId: u.id, permissions: u.permissions || [] }
    }
  }
  return null
}

// Function to manually sync members (can be called from UI)
export const syncMembersToClubsManually = () => {
  const clubs = loadClubs()
  syncMembersToClubs(clubs)
  return clubs
}

/** Get all members that belong to a club (from storage sources) - for admin display */
export const getClubMembersFromStorage = (clubId) => {
  try {
    if (!clubId) return []
    const merged = getMergedMembersRaw()
    return merged.filter(m => {
      if (m.clubIds && Array.isArray(m.clubIds)) return m.clubIds.includes(clubId)
      if (m.clubId) return m.clubId === clubId
      return clubId === 'hala-padel'
    }).map(m => ({
      id: m.id,
      name: m.name,
      email: m.email,
      avatar: m.avatar,
      mobile: m.mobile || m.phone,
      totalGames: m.totalGames || 0,
      totalWins: m.totalWins || 0,
      totalPoints: m.totalPoints || 0,
      clubIds: m.clubIds || (m.clubId ? [m.clubId] : [])
    }))
  } catch (e) {
    console.error('getClubMembersFromStorage error:', e)
    return []
  }
}

/** Get all members from storage (merged from padel_members and all_members) with their clubIds */
export const getAllMembersFromStorage = () => {
  try {
    return getMergedMembersRaw().map(m => ({
      id: m.id,
      name: m.name,
      email: m.email,
      avatar: m.avatar,
      mobile: m.mobile || m.phone,
      clubIds: m.clubIds || (m.clubId ? [m.clubId] : [])
    }))
  } catch (e) {
    console.error('getAllMembersFromStorage error:', e)
    return []
  }
}

/** Add member to additional club(s) - delegates to addMemberToClub */
export const addMemberToClubs = (memberId, clubIds) => {
  return addMemberToClub(memberId, clubIds)
}

/** Remove member from club(s). Uses centralized saveMembers; sync updates clubs. */
export const removeMemberFromClubs = (memberId, clubIds) => {
  try {
    const members = getMergedMembersRaw()
    const member = members.find(m => m.id === memberId)
    if (!member) return false
    const toRemove = Array.isArray(clubIds) ? clubIds : [clubIds]
    const currentIds = member.clubIds || (member.clubId ? [member.clubId] : [])
    member.clubIds = currentIds.filter(id => !toRemove.includes(id))
    member.clubId = member.clubIds[0]
    return saveMembers(members)
  } catch (e) {
    console.error('removeMemberFromClubs error:', e)
    return false
  }
}

// Admin Settings
export const loadAdminSettings = () => {
  try {
    const data = _read(ADMIN_STORAGE_KEYS.SETTINGS)
    return data || { theme: 'light', language: 'en', defaultView: 'dashboard' }
  } catch (error) {
    console.error('Error loading admin settings:', error)
    return {}
  }
}

export const saveAdminSettings = (settings) => {
  try {
    _write(ADMIN_STORAGE_KEYS.SETTINGS, settings)
  } catch (error) {
    console.error('Error saving admin settings:', error)
  }
}

// ----- Platform Admin (Main Admin Panel) -----
export const loadPlatformAdmins = () => {
  try {
    const raw = _read(ADMIN_STORAGE_KEYS.PLATFORM_ADMINS)
    if (Array.isArray(raw)) return raw
    return []
  } catch (_) { return [] }
}

function _savePlatformAdmins(admins) {
  _write(ADMIN_STORAGE_KEYS.PLATFORM_ADMINS, admins)
}

export async function savePlatformAdminsAsync(admins) {
  if (!Array.isArray(admins)) return false
  try {
    if (USE_POSTGRES && _backendStorage) {
      _backendStorage.setCache(ADMIN_STORAGE_KEYS.PLATFORM_ADMINS, admins)
      await _backendStorage.setStore(ADMIN_STORAGE_KEYS.PLATFORM_ADMINS, admins)
      return true
    }
    _savePlatformAdmins(admins)
    return true
  } catch (e) {
    console.error('savePlatformAdminsAsync failed:', e)
    return false
  }
}

export const createPlatformOwner = (email, password) => {
  const admins = loadPlatformAdmins()
  if (admins.some(a => a.role === 'owner')) return null
  const owner = {
    id: 'platform-owner-' + Date.now(),
    email: (email || '').trim().toLowerCase(),
    password: password || '',
    role: 'owner',
    permissions: ['all-clubs', 'manage-clubs', 'all-members', 'admin-users'],
    createdAt: new Date().toISOString()
  }
  admins.push(owner)
  _savePlatformAdmins(admins)
  return owner
}

export const getPlatformAdminByCredentials = (email, password) => {
  const admins = loadPlatformAdmins()
  return admins.find(a =>
    (a.email || '').toLowerCase() === (email || '').trim().toLowerCase() &&
    (a.password || '') === (password || '')
  ) || null
}

export const addPlatformAdmin = (email, password, permissions = []) => {
  const admins = loadPlatformAdmins()
  const em = (email || '').trim().toLowerCase()
  if (admins.some(a => (a.email || '').toLowerCase() === em)) return { error: 'EMAIL_EXISTS' }
  const admin = {
    id: 'platform-admin-' + Date.now(),
    email: em,
    password: password || '',
    role: 'admin',
    permissions: Array.isArray(permissions) ? permissions : [],
    createdAt: new Date().toISOString()
  }
  admins.push(admin)
  _savePlatformAdmins(admins)
  return { admin }
}

export const removePlatformAdmin = (id) => {
  const admins = loadPlatformAdmins()
  const filtered = admins.filter(a => a.id !== id)
  if (filtered.length === admins.length) return false
  _savePlatformAdmins(filtered)
  return true
}

export const updatePlatformAdmin = (id, updates) => {
  const admins = loadPlatformAdmins()
  const idx = admins.findIndex(a => a.id === id)
  if (idx < 0) return null
  const current = admins[idx]
  if (current.role === 'owner' && updates.role && updates.role !== 'owner') return null
  const updated = { ...current, ...updates, updatedAt: new Date().toISOString() }
  admins[idx] = updated
  _savePlatformAdmins(admins)
  return updated
}

/** Delete member entirely from platform (all_members + padel_members) */
export function deleteMember(memberId) {
  const members = getMergedMembersRaw().filter(m => m.id !== memberId)
  return saveMembers(members)
}
