// Admin Storage - Multi-club management

import { getRemoteClubs, setRemoteClubs, subscribeToClubs } from './supabaseSync.js'

const ADMIN_STORAGE_KEYS = {
  CLUBS: 'admin_clubs',
  SETTINGS: 'admin_settings',
  CURRENT_CLUB: 'admin_current_club_id'
}

let _clubsCache = null

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
 * Load clubs from Supabase into localStorage so the next loadClubs() uses them.
 * Call once at app bootstrap. Merges with local to preserve court images.
 */
export async function loadClubsAsync() {
  try {
    const remote = await getRemoteClubs()
    if (remote === null || !Array.isArray(remote)) return
    let local = []
    try {
      const data = localStorage.getItem(ADMIN_STORAGE_KEYS.CLUBS)
      if (data) local = JSON.parse(data)
    } catch (_) {}
    const merged = mergeClubsPreservingLocalImages(remote, local)
    localStorage.setItem(ADMIN_STORAGE_KEYS.CLUBS, JSON.stringify(merged))
    _clubsCache = merged
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('clubs-synced'))
    }
  } catch (e) {
    console.warn('loadClubsAsync failed:', e)
  }
}

/**
 * Apply clubs received from another device (real-time sync). Updates cache and localStorage
 * and dispatches 'clubs-synced' so the UI refreshes without reload.
 * Preserves local court images when remote doesn't have them.
 */
export function applyRemoteClubs(clubs) {
  if (!Array.isArray(clubs)) return
  try {
    let local = []
    try {
      const data = localStorage.getItem(ADMIN_STORAGE_KEYS.CLUBS)
      if (data) local = JSON.parse(data)
    } catch (_) {}
    const merged = mergeClubsPreservingLocalImages(clubs, local)
    localStorage.setItem(ADMIN_STORAGE_KEYS.CLUBS, JSON.stringify(merged))
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
    const data = localStorage.getItem(ADMIN_STORAGE_KEYS.CLUBS)
    if (data) {
      const clubs = JSON.parse(data)
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
    // Initialize with Hala Padel as example club
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
    // Load members from localStorage (from App.jsx)
    const membersData = localStorage.getItem('padel_members')
    if (!membersData) return
    
    const members = JSON.parse(membersData)
    if (!Array.isArray(members) || members.length === 0) return
    
    // Also check all_members (from Login.jsx)
    const allMembersData = localStorage.getItem('all_members')
    let allMembers = []
    if (allMembersData) {
      try {
        allMembers = JSON.parse(allMembersData)
      } catch (e) {
        console.error('Error parsing all_members:', e)
      }
    }
    
    // Merge both sources
    const allMembersMap = new Map()
    members.forEach(m => {
      if (m && m.id) {
        allMembersMap.set(m.id, m)
      }
    })
    allMembers.forEach(m => {
      if (m && m.id) {
        allMembersMap.set(m.id, m)
      }
    })
    
    const mergedMembers = Array.from(allMembersMap.values())
    
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
        
        // Save to both storage locations
        localStorage.setItem('padel_members', JSON.stringify(updatedMembers))
        if (localStorage.getItem('all_members')) {
          localStorage.setItem('all_members', JSON.stringify(updatedMembers))
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
    const json = JSON.stringify(clubs)
    localStorage.setItem(ADMIN_STORAGE_KEYS.CLUBS, json)
    _clubsCache = clubs
    setRemoteClubs(clubs)
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

export const getClubById = (clubId, forceFromStorage = false) => {
  let clubs
  if (forceFromStorage) {
    try {
      const data = localStorage.getItem(ADMIN_STORAGE_KEYS.CLUBS)
      clubs = data ? JSON.parse(data) : []
    } catch (e) {
      clubs = []
    }
  } else {
    clubs = loadClubs()
  }
  return clubs.find(club => club.id === clubId)
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

/** Pending club registration - requires admin approval */
export const addPendingClub = (clubData) => {
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
  saveClubs(clubs)
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
  return clubs.find(c => 
    (c.adminEmail || c.email || '').toLowerCase() === (email || '').toLowerCase() &&
    (c.adminPassword || '') === (password || '') &&
    (c.status === 'approved' || !c.status)
  ) || null
}

// Function to manually sync members (can be called from UI)
export const syncMembersToClubsManually = () => {
  const clubs = loadClubs()
  syncMembersToClubs(clubs)
  saveClubs(clubs)
  return clubs
}

// Add member to additional club(s)
export const addMemberToClubs = (memberId, clubIds) => {
  try {
    // Load members from localStorage
    const membersData = localStorage.getItem('padel_members')
    const allMembersData = localStorage.getItem('all_members')
    
    let members = []
    if (membersData) {
      try {
        members = JSON.parse(membersData)
      } catch (e) {
        console.error('Error parsing padel_members:', e)
      }
    }
    
    if (allMembersData) {
      try {
        const allMembers = JSON.parse(allMembersData)
        // Merge with existing members
        const membersMap = new Map()
        members.forEach(m => {
          if (m && m.id) membersMap.set(m.id, m)
        })
        allMembers.forEach(m => {
          if (m && m.id) {
            const existing = membersMap.get(m.id)
            if (existing) {
              // Merge data
              membersMap.set(m.id, { ...existing, ...m })
            } else {
              membersMap.set(m.id, m)
            }
          }
        })
        members = Array.from(membersMap.values())
      } catch (e) {
        console.error('Error parsing all_members:', e)
      }
    }
    
    // Find member
    const member = members.find(m => m.id === memberId)
    if (!member) {
      console.error('Member not found:', memberId)
      return false
    }
    
    // Ensure clubIds is an array
    if (!member.clubIds) {
      member.clubIds = member.clubId ? [member.clubId] : []
    }
    
    // Add new club IDs (avoid duplicates)
    const clubIdsArray = Array.isArray(clubIds) ? clubIds : [clubIds]
    clubIdsArray.forEach(clubId => {
      if (!member.clubIds.includes(clubId)) {
        member.clubIds.push(clubId)
      }
    })
    
    // Update member in array
    const memberIndex = members.findIndex(m => m.id === memberId)
    if (memberIndex !== -1) {
      members[memberIndex] = member
    }
    
    // Save updated members
    localStorage.setItem('padel_members', JSON.stringify(members))
    localStorage.setItem('all_members', JSON.stringify(members))
    
    // Update clubs
    const clubs = loadClubs()
    clubIdsArray.forEach(clubId => {
      const club = clubs.find(c => c.id === clubId)
      if (club) {
        club.members = club.members || []
        if (!club.members.find(m => m.id === memberId)) {
          club.members.push({
            id: member.id,
            name: member.name,
            email: member.email,
            mobile: member.mobile || member.phone,
            totalGames: member.totalGames || 0,
            totalWins: member.totalWins || 0,
            totalPoints: member.totalPoints || 0,
            clubIds: member.clubIds
          })
        }
      }
    })
    saveClubs(clubs)
    
    return true
  } catch (error) {
    console.error('Error adding member to clubs:', error)
    return false
  }
}

// Remove member from club(s)
export const removeMemberFromClubs = (memberId, clubIds) => {
  try {
    // Load members
    const membersData = localStorage.getItem('padel_members')
    const allMembersData = localStorage.getItem('all_members')
    
    let members = []
    if (membersData) {
      try {
        members = JSON.parse(membersData)
      } catch (e) {
        console.error('Error parsing padel_members:', e)
      }
    }
    
    if (allMembersData) {
      try {
        const allMembers = JSON.parse(allMembersData)
        const membersMap = new Map()
        members.forEach(m => {
          if (m && m.id) membersMap.set(m.id, m)
        })
        allMembers.forEach(m => {
          if (m && m.id) {
            const existing = membersMap.get(m.id)
            if (existing) {
              membersMap.set(m.id, { ...existing, ...m })
            } else {
              membersMap.set(m.id, m)
            }
          }
        })
        members = Array.from(membersMap.values())
      } catch (e) {
        console.error('Error parsing all_members:', e)
      }
    }
    
    // Find member
    const member = members.find(m => m.id === memberId)
    if (!member) {
      console.error('Member not found:', memberId)
      return false
    }
    
    // Remove club IDs
    if (member.clubIds && Array.isArray(member.clubIds)) {
      const clubIdsArray = Array.isArray(clubIds) ? clubIds : [clubIds]
      member.clubIds = member.clubIds.filter(id => !clubIdsArray.includes(id))
    }
    
    // Update member
    const memberIndex = members.findIndex(m => m.id === memberId)
    if (memberIndex !== -1) {
      members[memberIndex] = member
    }
    
    // Save updated members
    localStorage.setItem('padel_members', JSON.stringify(members))
    localStorage.setItem('all_members', JSON.stringify(members))
    
    // Update clubs
    const clubs = loadClubs()
    const clubIdsArray = Array.isArray(clubIds) ? clubIds : [clubIds]
    clubIdsArray.forEach(clubId => {
      const club = clubs.find(c => c.id === clubId)
      if (club && club.members) {
        club.members = club.members.filter(m => m.id !== memberId)
      }
    })
    saveClubs(clubs)
    
    return true
  } catch (error) {
    console.error('Error removing member from clubs:', error)
    return false
  }
}

// Admin Settings
export const loadAdminSettings = () => {
  try {
    const data = localStorage.getItem(ADMIN_STORAGE_KEYS.SETTINGS)
    return data ? JSON.parse(data) : {
      theme: 'light',
      language: 'en',
      defaultView: 'dashboard'
    }
  } catch (error) {
    console.error('Error loading admin settings:', error)
    return {}
  }
}

export const saveAdminSettings = (settings) => {
  try {
    localStorage.setItem(ADMIN_STORAGE_KEYS.SETTINGS, JSON.stringify(settings))
  } catch (error) {
    console.error('Error saving admin settings:', error)
  }
}
