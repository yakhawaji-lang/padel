import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import './App.css'
import { translations } from './translations'
import {
  saveToLocalStorage,
  loadFromLocalStorage,
  initIndexedDB,
  saveMatchToIndexedDB,
  getAllMatchesFromIndexedDB,
  getMatchesByDateRange,
  getMatchesByTournamentType,
  getMatchesByTournamentId,
  deleteMatchesByTournament,
  deleteMatchesByDateAndType
} from './storage'
import { loadClubs, getClubById, saveClubs, upsertMember, addMemberToClub, deleteMember } from './storage/adminStorage'
import { getClubAdminSession } from './storage/clubAuth'
import { getAppLanguage, setAppLanguage } from './storage/languageStorage'
import LanguageIcon from './components/LanguageIcon'
import playtomicApi from './services/playtomicApi'

function App({ currentUser }) {
  const { clubId } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('king') // 'king', 'social', 'members', 'oldTournaments', 'bookings', or 'accounting'
  const [language, setLanguage] = useState(() => getAppLanguage())
  const [currentClub, setCurrentClub] = useState(null) // Current club data loaded from URL
  const [isLoadingClub, setIsLoadingClub] = useState(true) // Loading state for club data
  
  // Members state (persistent across tournaments)
  const [members, setMembers] = useState([])
  const [currentTournamentId, setCurrentTournamentId] = useState(1) // Track current tournament session
  const [memberSearchQuery, setMemberSearchQuery] = useState('') // Search query for members
  const [openMemberSelectorForTeam, setOpenMemberSelectorForTeam] = useState(null) // Team ID for which member selector is open
  const [memberSelectorSearch, setMemberSelectorSearch] = useState('') // Search query in member selector modal
  const [showMemberPointsHistory, setShowMemberPointsHistory] = useState(false) // Show/hide member points history
  const [selectedMemberForHistory, setSelectedMemberForHistory] = useState(null) // Selected member ID for viewing history
  const [contentTab, setContentTab] = useState('standings') // Tab for main content: 'standings', 'teams', 'courts', 'history', 'schedule'
  const [memberTab, setMemberTab] = useState('members') // Tab for members section: 'members', 'statistics'
  const [memberToDelete, setMemberToDelete] = useState(null) // Member to be deleted (for confirmation)
  const [deletedMember, setDeletedMember] = useState(null) // Recently deleted member (for undo)
  const [undoTimeout, setUndoTimeout] = useState(null) // Timeout for undo functionality
  const [showMembersList, setShowMembersList] = useState(false) // Show/hide members list
  const [memberFormModal, setMemberFormModal] = useState(null) // null, 'add', or member object for editing
  const [statisticsSearchQuery, setStatisticsSearchQuery] = useState('') // Search query for statistics table
  const [historicalMatches, setHistoricalMatches] = useState([]) // Historical matches from IndexedDB
  const [showHistoricalRecords, setShowHistoricalRecords] = useState(false) // Show/hide historical records
  const [oldTournamentTab, setOldTournamentTab] = useState('king') // 'king' or 'social' for old tournaments sub-tabs
  const [selectedDate, setSelectedDate] = useState('') // Selected date for viewing old tournament
  const [oldTournamentMatches, setOldTournamentMatches] = useState([]) // Matches for selected date
  const [showOldTournamentMatches, setShowOldTournamentMatches] = useState(false) // Show/hide matches for old tournament
  const [datesWithTournaments, setDatesWithTournaments] = useState(new Set()) // Dates that have tournaments
  const [calendarMonth, setCalendarMonth] = useState(new Date()) // Current month being displayed in calendar
  const [showCalendar, setShowCalendar] = useState(false) // Show/hide custom calendar
  const [overallTournamentStats, setOverallTournamentStats] = useState({
    totalTournaments: 0,
    totalMatches: 0,
    totalTeams: 0,
    totalGames: 0,
    lastTournamentDate: null,
    firstTournamentDate: null
  }) // Overall statistics for all old tournaments
  const [showTournamentBookingModal, setShowTournamentBookingModal] = useState(false) // Show/hide tournament booking modal
  const [tournamentBookingData, setTournamentBookingData] = useState({
    date: '',
    startTime: '09:00',
    endTime: '18:00',
    tournamentType: 'king' // 'king' or 'social'
  })
  const [viewedTournamentBooking, setViewedTournamentBooking] = useState(null) // { id, date, startTime, endTime, tournamentType } - which scheduled tournament is being viewed (shows its tabs)

  const [sidebarOpen, setSidebarOpen] = useState(false) // Mobile: sidebar drawer open
  const [showResetConfirm, setShowResetConfirm] = useState(false) // Show/hide reset confirmation modal
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false) // Show/hide delete confirmation modal
  const [matchToEdit, setMatchToEdit] = useState(null) // Match being edited
  // Booking state
  const [bookings, setBookings] = useState([]) // Array of booking objects (merged local + Playtomic)
  const [localBookings, setLocalBookings] = useState([]) // Local bookings only
  const [playtomicBookings, setPlaytomicBookings] = useState([]) // Playtomic bookings only
  const [isLoadingPlaytomic, setIsLoadingPlaytomic] = useState(false) // Loading state for Playtomic API
  const [playtomicLastSync, setPlaytomicLastSync] = useState(null) // Last sync timestamp
  const [showBookingModal, setShowBookingModal] = useState(false) // Show/hide booking form modal
  const [bookingFormData, setBookingFormData] = useState(null) // Form data for creating/editing booking
  const [dragSelection, setDragSelection] = useState(null) // Drag selection state {startCell, endCell, startTime, endTime}
  const [hoveredBooking, setHoveredBooking] = useState(null) // Booking ID being hovered for tooltip
  const [currentWeek, setCurrentWeek] = useState(new Date()) // Current week being displayed
  const [bookingView, setBookingView] = useState('weekly') // 'weekly' or 'courts' for booking calendar view
  const [selectedDateForCourtView, setSelectedDateForCourtView] = useState(new Date().toISOString().split('T')[0]) // Selected date for court view
  const [weeklyViewDays, setWeeklyViewDays] = useState(7) // Number of days to show in weekly view (7, 6, 5, 4, 3, 2, 1)
  const [selectedDays, setSelectedDays] = useState([0, 1, 2, 3, 4, 5, 6]) // Array of day indices (0-6) to show in weekly view
  // Accounting state
  const [accountingDateFrom, setAccountingDateFrom] = useState('') // Filter: from date
  const [accountingDateTo, setAccountingDateTo] = useState('') // Filter: to date
  const [accountingStatusFilter, setAccountingStatusFilter] = useState('all') // Filter: 'all', 'paid', 'partially_paid', 'not_paid'
  const [accountingCourtFilter, setAccountingCourtFilter] = useState('all') // Filter: 'all', 'Court 1', 'Court 2', etc.
  const isInitialMount = useRef(true) // Track if this is the first mount
  const isSavingRef = useRef(false) // Prevent save loops
  
  // Helper function to get available courts count (excluding maintenance)
  const getAvailableCourtsCount = () => {
    if (!currentClub?.courts) return 4 // Default to 4 if no courts defined
    return currentClub.courts.filter(court => !court.maintenance).length
  }

  // Helper function to initialize courts array based on available courts
  const initializeCourtsArray = () => {
    const count = getAvailableCourtsCount()
    return new Array(count).fill(null)
  }

  // حالة افتراضية لبطولة ملك الملعب (كل بطولة لها بياناتها)
  const getDefaultKingState = () => ({
    teams: [],
    matches: [],
    courts: initializeCourtsArray(),
    matchTimers: {},
    courtWinners: {},
    showMatchHistory: false,
    showMatchSchedule: false
  })

  // حالة ملك الملعب لكل بطولة مجدولة (مفتاح = معرف الحجز)
  const [kingStateByTournamentId, setKingStateByTournamentId] = useState({})
  
  // حالة افتراضية لبطولة السوشيال (كل بطولة لها بياناتها)
  const getDefaultSocialState = () => ({
    teams: [],
    matches: [],
    courts: initializeCourtsArray(),
    matchTimers: {},
    groupStage: {},
    qualifiedTeams: [],
    tournamentStage: 'group',
    semiFinals: [],
    finals: [],
    showMatchHistory: false
  })

  // حالة السوشيال لكل بطولة مجدولة (مفتاح = معرف الحجز)
  const [socialStateByTournamentId, setSocialStateByTournamentId] = useState({})
  
  const t = translations[language]
  const isRTL = language === 'ar'

  // Initialize IndexedDB and load saved data on mount
  useEffect(() => {
    const loadSavedData = async () => {
      try {
        setIsLoadingClub(true)
        
        // Initialize IndexedDB
        await initIndexedDB()
        
        // Load club data from admin storage using clubId from URL params
        const clubs = loadClubs()
        let club = null
        
        if (clubId) {
          club = getClubById(clubId)
          if (!club) {
            // Club not found, redirect to login
            console.error('Club not found:', clubId)
            navigate('/login')
            return
          }
        } else {
          // No clubId in URL, redirect to login
          console.error('No clubId in URL')
          navigate('/login')
          return
        }
        
        setCurrentClub(club)
        setIsLoadingClub(false)
        
        // Initialize courts array based on available courts (excluding maintenance)
        const availableCourtsCount = club?.courts ? club.courts.filter(c => !c.maintenance).length : 4
        const initialCourtsArray = new Array(availableCourtsCount).fill(null)

        // Load from localStorage (club-specific)
        // Try from club.tournamentData first, then localStorage
        let savedKingStateByTournament = club?.tournamentData?.kingStateByTournamentId || loadFromLocalStorage.kingStateByTournament(clubId)
        // ترحيل قديم: إذا وُجد kingState قديم فقط، نضعه تحت مفتاح 'legacy'
        if (!savedKingStateByTournament) {
          const oldKingState = club?.tournamentData?.kingState || loadFromLocalStorage.kingState(clubId)
          if (oldKingState && typeof oldKingState === 'object') {
            savedKingStateByTournament = { legacy: oldKingState }
          } else {
            savedKingStateByTournament = {}
          }
        }
        let savedSocialStateByTournament = club?.tournamentData?.socialStateByTournamentId || loadFromLocalStorage.socialStateByTournament(clubId)
        // ترحيل قديم: إذا وُجد socialState قديم فقط، نضعه تحت مفتاح 'legacy'
        if (!savedSocialStateByTournament) {
          const oldSocialState = club?.tournamentData?.socialState || loadFromLocalStorage.socialState(clubId)
          if (oldSocialState && typeof oldSocialState === 'object') {
            savedSocialStateByTournament = { legacy: oldSocialState }
          } else {
            savedSocialStateByTournament = {}
          }
        }
        if (savedSocialStateByTournament && typeof savedSocialStateByTournament === 'object') {
          const normalized = {}
          Object.keys(savedSocialStateByTournament).forEach(tid => {
            let s = savedSocialStateByTournament[tid]
            if (s && s.courts && s.courts.length !== availableCourtsCount) {
              s = { ...s, courts: s.courts.length > availableCourtsCount ? s.courts.slice(0, availableCourtsCount) : [...s.courts, ...new Array(availableCourtsCount - s.courts.length).fill(null)] }
            } else if (!s || !s.courts) {
              s = s || {}
              s = { ...s, courts: initialCourtsArray }
            }
            normalized[tid] = s
          })
          savedSocialStateByTournament = normalized
        } else {
          savedSocialStateByTournament = {}
        }
        let savedTournamentId = club?.tournamentData?.currentTournamentId || loadFromLocalStorage.currentTournamentId(clubId)
        
        // تطبيع مصفوفات الملاعب داخل كل بطولة ملك
        if (savedKingStateByTournament && typeof savedKingStateByTournament === 'object') {
          const normalized = {}
          Object.keys(savedKingStateByTournament).forEach(tid => {
            let s = savedKingStateByTournament[tid]
            if (s && s.courts) {
              if (s.courts.length !== availableCourtsCount) {
                s = { ...s, courts: s.courts.length > availableCourtsCount ? s.courts.slice(0, availableCourtsCount) : [...s.courts, ...new Array(availableCourtsCount - s.courts.length).fill(null)] }
              }
            } else {
              s = s || {}
              s = { ...s, courts: initialCourtsArray }
            }
            normalized[tid] = s
          })
          savedKingStateByTournament = normalized
        } else {
          savedKingStateByTournament = {}
        }
        
        const savedMembers = loadFromLocalStorage.members()
        const savedActiveTab = club?.tournamentData?.activeTab || loadFromLocalStorage.activeTab()
        const savedLanguage = getAppLanguage()
        const savedContentTab = club?.tournamentData?.contentTab || loadFromLocalStorage.contentTab()
        const savedMemberTab = club?.tournamentData?.memberTab || loadFromLocalStorage.memberTab()
        
        // Members: prefer club.members (synced from platform joins) merged with savedMembers
        const clubMembers = club?.members && Array.isArray(club.members) ? club.members : []
        const savedList = Array.isArray(savedMembers) ? savedMembers : []
        const mergedById = new Map()
        clubMembers.forEach(m => { if (m?.id) mergedById.set(String(m.id), m) })
        savedList.forEach(m => { if (m?.id && !mergedById.has(String(m.id))) mergedById.set(String(m.id), m) })
        const initialMembers = Array.from(mergedById.values())
        setMembers(initialMembers.length > 0 ? initialMembers : (savedList.length > 0 ? savedList : []))
        
        // Set language first (before restoring other state)
        setLanguage(savedLanguage)
        
        // Restore state per tournament for King
        setKingStateByTournamentId(savedKingStateByTournament || {})
        // Restore state per tournament for Social
        setSocialStateByTournamentId(savedSocialStateByTournament || {})
        
        if (savedTournamentId) {
          setCurrentTournamentId(savedTournamentId)
        } else {
          setCurrentTournamentId(1)
        }
        
        if (savedActiveTab) {
          setActiveTab(savedActiveTab)
        }
        
        if (savedContentTab) {
          setContentTab(savedContentTab)
        }
        
        if (savedMemberTab) {
          setMemberTab(savedMemberTab)
        }

        // Load bookings from club (DB)
        const clubBookings = club?.bookings && Array.isArray(club.bookings) ? club.bookings : []
        const localOnly = clubBookings.filter(b => !b.source || b.source !== 'playtomic')
        let maxId = 0
        const withIds = localOnly.map(b => {
          if (b.isTournament && b.id != null) return b
          if (b.id != null && b.id > 0 && !String(b.id).startsWith('playtomic_')) {
            maxId = Math.max(maxId, typeof b.id === 'number' ? b.id : 0)
            return b
          }
          maxId += 1
          return { ...b, id: maxId, source: 'local' }
        })
        setLocalBookings(withIds)
        mergeBookings(withIds, playtomicBookings)
        
        isInitialMount.current = false
      } catch (error) {
        console.error('Error loading saved data:', error)
        setIsLoadingClub(false)
      }
    }
    
    if (clubId) {
      loadSavedData()
    } else {
      navigate('/login')
    }
  }, [clubId, navigate])

  // Refresh club and members when clubs are synced (e.g. after member joins from public page)
  useEffect(() => {
    if (!clubId) return
    const onSynced = () => {
      const clubs = loadClubs()
      const club = clubs.find(c => c.id === clubId)
      if (club) {
        setCurrentClub(club)
        if (club.members?.length > 0) {
          setMembers(prev => {
            const merged = new Map()
            club.members.forEach(m => { if (m?.id) merged.set(String(m.id), m) })
            prev.forEach(m => { if (m?.id && !merged.has(String(m.id))) merged.set(String(m.id), m) })
            return Array.from(merged.values())
          })
        }
      }
    }
    window.addEventListener('clubs-synced', onSynced)
    return () => window.removeEventListener('clubs-synced', onSynced)
  }, [clubId])

  // Update document direction and persist language
  useEffect(() => {
    setAppLanguage(language)
  }, [language])

  // Load dates with tournaments when oldTournamentTab changes
  useEffect(() => {
    if (activeTab === 'oldTournaments') {
      loadDatesWithTournaments(oldTournamentTab)
    } else {
      setShowCalendar(false)
    }
  }, [oldTournamentTab, activeTab])

  // Update calendar month when selected date changes
  useEffect(() => {
    if (selectedDate) {
      const date = new Date(selectedDate)
      if (!isNaN(date.getTime())) {
        setCalendarMonth(date)
      }
    }
  }, [selectedDate])

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showCalendar && !event.target.closest('.custom-calendar') && !event.target.closest('input[readonly]')) {
        setShowCalendar(false)
      }
    }

    if (showCalendar) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showCalendar])

  // Save to localStorage whenever state changes (but not on initial mount)
  useEffect(() => {
    if (isInitialMount.current || isSavingRef.current || !currentClub?.id) return
    
    isSavingRef.current = true
    const clubId = currentClub.id
    
    // Save club-specific tournament data (ملك + سوشيال: حفظ بيانات كل بطولة)
    saveToLocalStorage.kingStateByTournament(kingStateByTournamentId, clubId)
    saveToLocalStorage.socialStateByTournament(socialStateByTournamentId, clubId)
    saveToLocalStorage.members(members)
    saveToLocalStorage.currentTournamentId(currentTournamentId, clubId)
    saveToLocalStorage.activeTab(activeTab)
    saveToLocalStorage.language(language)
    import('./storage/appSettingsStorage.js').then(({ setClubLanguage }) => setClubLanguage(clubId, language))
    saveToLocalStorage.contentTab(contentTab)
    saveToLocalStorage.memberTab(memberTab)
    
    // Save to club data in adminStorage (DB)
    const clubs = loadClubs()
    const club = clubs.find(c => c.id === clubId)
    if (club) {
      club.tournamentData = club.tournamentData || {}
      club.tournamentData.kingStateByTournamentId = kingStateByTournamentId
      club.tournamentData.socialStateByTournamentId = socialStateByTournamentId
      club.tournamentData.currentTournamentId = currentTournamentId
      club.tournamentData.activeTab = activeTab
      club.tournamentData.contentTab = contentTab
      club.tournamentData.memberTab = memberTab
      saveClubs(clubs).catch(e => console.error('saveClubs:', e))
    }
    
    setTimeout(() => {
      isSavingRef.current = false
    }, 100)
  }, [kingStateByTournamentId, socialStateByTournamentId, members, currentTournamentId, activeTab, language, contentTab, memberTab, currentClub])

  // Get current state based on active tab (للملك/السوشيال: حسب البطولة المعروضة)
  const currentState = activeTab === 'king'
    ? (kingStateByTournamentId[viewedTournamentBooking?.id] ?? getDefaultKingState())
    : activeTab === 'social'
      ? (socialStateByTournamentId[viewedTournamentBooking?.id] ?? getDefaultSocialState())
      : getDefaultKingState() // fallback (members, etc.)

  // معرف البطولة الفعلي للحفظ (حجز معروض أو currentTournamentId)
  const effectiveTournamentId = (activeTab === 'king' || activeTab === 'social') && viewedTournamentBooking?.id ? viewedTournamentBooking.id : currentTournamentId

  // Helper to update current state (للملك/السوشيال: تحديث بيانات البطولة المعروضة فقط)
  const updateCurrentState = (updater) => {
    if (activeTab === 'king') {
      const tid = viewedTournamentBooking?.id
      if (!tid) return
      setKingStateByTournamentId(prev => {
        const current = prev[tid] ?? getDefaultKingState()
        return { ...prev, [tid]: updater(current) }
      })
    } else if (activeTab === 'social') {
      const tid = viewedTournamentBooking?.id
      if (!tid) return
      setSocialStateByTournamentId(prev => {
        const current = prev[tid] ?? getDefaultSocialState()
        return { ...prev, [tid]: updater(current) }
      })
    }
  }

  // Switch tab (preserves state; clear viewed tournament when switching between king/social)
  const switchTab = (tab) => {
    if (tab !== activeTab && (tab === 'king' || tab === 'social' || activeTab === 'king' || activeTab === 'social')) {
      setViewedTournamentBooking(null)
    }
    setActiveTab(tab)
  }

  // Toggle language
  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'ar' : 'en')
  }

  // Reset tournament (clears current state but preserves all records in IndexedDB)
  const resetTournament = () => {
    // Increment tournament ID to ensure clean separation
    setCurrentTournamentId(prev => prev + 1)
    
    if (activeTab === 'king' && viewedTournamentBooking?.id) {
      setKingStateByTournamentId(prev => {
        const next = { ...prev }
        next[viewedTournamentBooking.id] = getDefaultKingState()
        return next
      })
    } else if (activeTab === 'social' && viewedTournamentBooking?.id) {
      setSocialStateByTournamentId(prev => {
        const next = { ...prev }
        next[viewedTournamentBooking.id] = getDefaultSocialState()
        return next
      })
    }
    // Reset content tab to standings
    setContentTab('standings')
    // Close confirmation modal
    setShowResetConfirm(false)
  }

  // Delete tournament (removes all related data including matches, member points, etc.)
  const deleteTournament = async () => {
    const tournamentType = activeTab === 'king' ? 'king' : 'social'
    const tid = (activeTab === 'king' || activeTab === 'social') && viewedTournamentBooking?.id ? viewedTournamentBooking.id : currentTournamentId
    
    try {
      // Step 1: Delete matches from IndexedDB
      await deleteMatchesByTournament(tid, tournamentType, currentClub?.id)
      
      // Step 2: Remove member points and history related to this tournament
      const updatedMembers = members.map(member => {
        const filteredHistory = (member.pointsHistory || []).filter(
          entry => !(entry.tournamentId === tid && entry.tournamentType === tournamentType)
        )
        
        // Recalculate stats from remaining history entries
        let totalGames = 0
        let totalWins = 0
        let totalLosses = 0
        let totalDraws = 0
        let totalPoints = 0
        let tournamentsPlayed = 0
        const tournamentIds = new Set()
        const tournamentWins = new Set()
        
        filteredHistory.forEach(entry => {
          // Count points
          totalPoints += entry.pointsEarned || 0
          
          if (entry.stage === 'join') {
            // Tournament join entry
            if (entry.tournamentId && !tournamentIds.has(entry.tournamentId)) {
              tournamentIds.add(entry.tournamentId)
              tournamentsPlayed++
            }
          } else {
            // Match entry
            totalGames++
            
            // Determine win/loss/draw from result
            if (entry.result === t.wins || entry.result === 'wins') {
              totalWins++
            } else if (entry.result === t.losses || entry.result === 'losses') {
              totalLosses++
            } else if (entry.result === t.draw || entry.result === 'draw') {
              totalDraws++
            }
            
            // Check if this is a tournament win (final match with 30 points)
            if (entry.stage === 'final' && entry.pointsEarned === 30 && entry.tournamentId) {
              tournamentWins.add(entry.tournamentId)
            }
          }
        })
        
        const tournamentsWon = tournamentWins.size
        
        // Reset lastTournamentId if it matches this tournament
        const newLastTournamentId = member.lastTournamentId === tid 
          ? undefined 
          : member.lastTournamentId
        
        return {
          ...member,
          totalGames,
          totalWins,
          totalLosses,
          totalDraws,
          totalPoints,
          tournamentsPlayed,
          tournamentsWon,
          lastTournamentId: newLastTournamentId,
          pointsHistory: filteredHistory
        }
      })
      
      // Step 3: Update members
      setMembers(updatedMembers)
      
      // Step 4: Clear current tournament state
      if (activeTab === 'king' && viewedTournamentBooking?.id) {
        setKingStateByTournamentId(prev => {
          const next = { ...prev }
          delete next[viewedTournamentBooking.id]
          return next
        })
        setViewedTournamentBooking(null)
      } else if (activeTab === 'social' && viewedTournamentBooking?.id) {
        setSocialStateByTournamentId(prev => {
          const next = { ...prev }
          delete next[viewedTournamentBooking.id]
          return next
        })
        setViewedTournamentBooking(null)
      }
      
      // Step 5: Reset content tab to standings
      setContentTab('standings')
      
      // Step 6: Increment tournament ID for next tournament
      setCurrentTournamentId(prev => prev + 1)
      
      // Step 7: Reload historical matches
      getAllMatchesFromIndexedDB(currentClub?.id).then(historical => {
        setHistoricalMatches(historical)
      })
      
      // Step 8: Close confirmation modal
      setShowDeleteConfirm(false)
    } catch (error) {
      console.error('Error deleting tournament:', error)
      alert(language === 'en' 
        ? 'Error deleting tournament. Please try again.' 
        : 'خطأ في حذف البطولة. يرجى المحاولة مرة أخرى.')
    }
  }

  // Delete a points history entry for a member and recalculate stats
  const deleteMemberPointsEntry = (memberId, entryId) => {
    if (!window.confirm(language === 'en' 
      ? 'Are you sure you want to delete this points entry? This action cannot be undone.'
      : 'هل أنت متأكد من حذف هذا السجل؟ لا يمكن التراجع عن هذا الإجراء.')) {
      return
    }

    const updatedMembers = members.map(member => {
      if (member.id !== memberId) return member

      // Filter out the deleted entry
      const filteredHistory = (member.pointsHistory || []).filter(
        entry => entry.id !== entryId
      )

      // Recalculate stats from remaining history
      let totalGames = 0
      let totalWins = 0
      let totalLosses = 0
      let totalDraws = 0
      let totalPoints = 0
      let tournamentsPlayed = 0
      const tournamentIds = new Set()
      const tournamentWins = new Set()

      filteredHistory.forEach(entry => {
        totalPoints += entry.pointsEarned || 0

        if (entry.stage === 'join') {
          if (entry.tournamentId && !tournamentIds.has(entry.tournamentId)) {
            tournamentIds.add(entry.tournamentId)
            tournamentsPlayed++
          }
        } else {
          totalGames++
          if (entry.result === t.wins || entry.result === 'wins') {
            totalWins++
          } else if (entry.result === t.losses || entry.result === 'losses') {
            totalLosses++
          } else if (entry.result === t.draw || entry.result === 'draw') {
            totalDraws++
          }
          if (entry.stage === 'final' && entry.pointsEarned === 30 && entry.tournamentId) {
            tournamentWins.add(entry.tournamentId)
          }
        }
      })

      const tournamentsWon = tournamentWins.size

      return {
        ...member,
        totalGames,
        totalWins,
        totalLosses,
        totalDraws,
        totalPoints,
        tournamentsPlayed,
        tournamentsWon,
        pointsHistory: filteredHistory
      }
    })

    setMembers(updatedMembers)
  }

  // Reset all statistics for a member
  const resetMemberStats = (memberId) => {
    if (!window.confirm(language === 'en' 
      ? 'Are you sure you want to reset all statistics for this member? This will clear all points, games, wins, losses, and history. This action cannot be undone.'
      : 'هل أنت متأكد من إعادة تعيين جميع الإحصائيات لهذا العضو؟ سيتم حذف جميع النقاط والألعاب والانتصارات والخسائر والسجل. لا يمكن التراجع عن هذا الإجراء.')) {
      return
    }

    const updatedMembers = members.map(member => {
      if (member.id !== memberId) return member

      return {
        ...member,
        totalGames: 0,
        totalWins: 0,
        totalLosses: 0,
        totalDraws: 0,
        totalPoints: 0,
        tournamentsPlayed: 0,
        tournamentsWon: 0,
        lastTournamentId: undefined,
        pointsHistory: []
      }
    })

    setMembers(updatedMembers)
  }

  // Add team
  const addTeam = () => {
    const newTeam = {
      id: (currentState.teams?.length || 0) + 1,
      name: language === 'ar' ? `فريق ${(currentState.teams?.length || 0) + 1}` : `Team ${(currentState.teams?.length || 0) + 1}`,
      wins: 0,
      losses: 0,
      draws: 0,
      gamesWon: 0,
      gamesLost: 0,
      matchesPlayed: 0,
      memberIds: [] // Array of member IDs linked to this team
    }
    updateCurrentState(state => ({
      ...state,
      teams: [...(state.teams || []), newTeam]
    }))
  }

  // Remove team
  const removeTeam = (teamId) => {
    const teams = currentState.teams || []
    if (teams.length <= 2) {
      alert(t.needTwoTeams)
      return
    }
    updateCurrentState(state => ({
      ...state,
      teams: teams.filter(t => t.id !== teamId),
      courts: (state.courts || [null, null, null, null]).map(c => 
        c && (c.team1.id === teamId || c.team2.id === teamId) ? null : c
      )
    }))
  }

  // Update team name
  const updateTeamName = (teamId, newName) => {
    updateCurrentState(state => ({
      ...state,
      teams: (state.teams || []).map(t => t.id === teamId ? { ...t, name: newName } : t)
    }))
  }

  // Check if two teams have already played
  const havePlayed = (team1Id, team2Id) => {
    const matches = currentState.matches || []
    return matches.some(m => 
      (m.team1.id === team1Id && m.team2.id === team2Id) ||
      (m.team1.id === team2Id && m.team2.id === team1Id)
    )
  }

  // Generate fair match schedule ensuring each team plays exactly 7 matches (King of Court)
  // ABSOLUTELY NO DUPLICATE MATCHUPS - each team pair can only appear once
  // NO TEAM ON MULTIPLE COURTS - each team can only play on one court at a time
  const generateFairSchedule = (updatedMatchesParam = null, updatedCourtsParam = null) => {
    const teams = currentState.teams || []
    const matches = updatedMatchesParam !== null ? updatedMatchesParam : (currentState.matches || [])
    const courts = updatedCourtsParam !== null ? updatedCourtsParam : (currentState.courts || [])
    const courtWinners = currentState.courtWinners || {} // Winners staying on their courts
    
    console.log('generateFairSchedule called:', {
      teamsCount: teams.length,
      matchesCount: matches.length,
      courts: courts,
      courtWinners
    })
    
    // Helper to create a unique matchup key (sorted team IDs)
    const getMatchupKey = (team1Id, team2Id) => {
      return [team1Id, team2Id].sort().join('-')
    }
    
    // Track all matchups already played (using sorted IDs as key)
    const playedMatchups = new Set()
    matches.forEach(m => {
      playedMatchups.add(getMatchupKey(m.team1.id, m.team2.id))
    })
    
    // Track teams already assigned to courts - CRITICAL: no team can be on multiple courts
    const teamsInCourts = new Set()
    // Get available courts count (excluding maintenance)
    const availableCourtsCount = currentClub?.courts ? currentClub.courts.filter(c => !c.maintenance).length : 4
    const newCourts = new Array(availableCourtsCount).fill(null)
    
    // Step 1: Calculate team statistics for King of the Court logic
    const getTeamStats = (teamId) => {
      const teamMatches = matches.filter(m => m.team1.id === teamId || m.team2.id === teamId)
      let wins = 0
      let losses = 0
      let gamesWon = 0
      let gamesLost = 0
      
      teamMatches.forEach(match => {
        const isTeam1 = match.team1.id === teamId
        
        // For final matches, count games from sets only (not tiebreak points)
        let teamGames, opponentGames
        if (match.isFinal && match.set1Team1Games !== undefined) {
          teamGames = isTeam1 
            ? (match.set1Team1Games + (match.set2Team1Games || 0))
            : (match.set1Team2Games + (match.set2Team2Games || 0))
          opponentGames = isTeam1
            ? (match.set1Team2Games + (match.set2Team2Games || 0))
            : (match.set1Team1Games + (match.set2Team1Games || 0))
        } else {
          teamGames = isTeam1 ? match.team1Games : match.team2Games
          opponentGames = isTeam1 ? match.team2Games : match.team1Games
        }
        
        gamesWon += teamGames
        gamesLost += opponentGames
        
        if (match.winner && match.winner.id === teamId) {
          wins++
        } else if (match.winner) {
          losses++
        }
      })
      
      return {
        wins,
        losses,
        gamesWon,
        gamesLost,
        gamesDiff: gamesWon - gamesLost
      }
    }
    
    // Step 2: Check if two teams have played each other
    const havePlayed = (team1Id, team2Id) => {
      return playedMatchups.has(getMatchupKey(team1Id, team2Id))
    }
    
    // Step 3: PRIORITY 1 - Handle courts with stored winners FIRST (winners stay on their court)
    // CRITICAL: If there are ANY winners, we completely ignore existing courts to prevent conflicts
    const hasWinners = Object.values(courtWinners).some(winnerId => winnerId != null && winnerId !== undefined)
    
    // Track matchups assigned in Step 3 to prevent duplicates
    const assignedMatchupsInStep3 = new Set()
    
    for (let i = 0; i < availableCourtsCount; i++) {
      const winnerId = courtWinners[i] // Winner staying on this court
      
      if (winnerId) {
        // Find the winner team
        const winnerTeam = teams.find(t => t.id === winnerId)
        if (!winnerTeam) {
          continue
        }
        
        // Winner MUST stay on this specific court - reserve it immediately
        teamsInCourts.add(winnerId)
        
        // Find a challenger who hasn't played this winner yet
        // PRIORITY: Prefer teams that are NOT winners on other courts
        let challenger = null
        
        // Get teams that are winners on other courts
        const otherWinnerIds = new Set()
        for (let j = 0; j < availableCourtsCount; j++) {
          if (j !== i && courtWinners[j]) {
            otherWinnerIds.add(courtWinners[j])
          }
        }
        
        // First, try to find a non-winner team that hasn't played the winner AND isn't already in this round
        const nonWinnerTeams = teams.filter(t => 
          t.id !== winnerId && 
          !teamsInCourts.has(t.id) && 
          !otherWinnerIds.has(t.id)
        )
        
        for (const team of nonWinnerTeams) {
          const matchupKey = getMatchupKey(winnerId, team.id)
          if (!havePlayed(winnerId, team.id) && !assignedMatchupsInStep3.has(matchupKey)) {
            challenger = team
            break
          }
        }
        
        // If no non-winner found, try any available team that hasn't played the winner
        if (!challenger) {
          const availableTeams = teams.filter(t => 
            t.id !== winnerId && !teamsInCourts.has(t.id)
          )
          
          for (const team of availableTeams) {
            const matchupKey = getMatchupKey(winnerId, team.id)
            if (!havePlayed(winnerId, team.id) && !assignedMatchupsInStep3.has(matchupKey)) {
              challenger = team
              break
            }
          }
        }
        
        // If all teams have played the winner, use games difference logic (prefer non-winners)
        if (!challenger) {
          const availableTeams = teams.filter(t => 
            t.id !== winnerId && !teamsInCourts.has(t.id)
          )
          
          // Separate non-winners and winners
          const nonWinners = availableTeams.filter(t => !otherWinnerIds.has(t.id))
          const winners = availableTeams.filter(t => otherWinnerIds.has(t.id))
          
          // Try non-winners first
          const teamsToTry = nonWinners.length > 0 ? nonWinners : winners
          
          if (teamsToTry.length > 0) {
            const sortedTeams = teamsToTry
              .map(team => ({ team, stats: getTeamStats(team.id) }))
              .sort((a, b) => {
                if (b.stats.gamesDiff !== a.stats.gamesDiff) {
                  return b.stats.gamesDiff - a.stats.gamesDiff
                }
                return b.stats.wins - a.stats.wins
              })
            
            if (sortedTeams.length > 0) {
              challenger = sortedTeams[0].team
            }
          }
        }
        
        // If still no challenger but we have available teams, just pick the first non-winner
        if (!challenger) {
          const availableTeams = teams.filter(t => 
            t.id !== winnerId && !teamsInCourts.has(t.id)
          )
          
          // Prefer non-winners
          const nonWinners = availableTeams.filter(t => !otherWinnerIds.has(t.id))
          if (nonWinners.length > 0) {
            challenger = nonWinners[0]
          } else if (availableTeams.length > 0) {
            challenger = availableTeams[0]
          }
        }
        
        // If we found a challenger, create the match
        if (challenger) {
          newCourts[i] = {
            team1: winnerTeam,
            team2: challenger,
            courtNumber: i + 1,
            startTime: Date.now(),
            winner: null
          }
          teamsInCourts.add(challenger.id)
          // Track this matchup to prevent duplicates
          const matchupKey = getMatchupKey(winnerId, challenger.id)
          assignedMatchupsInStep3.add(matchupKey)
          console.log(`Court ${i + 1}: Winner ${winnerTeam.name} vs Challenger ${challenger.name}`)
        } else {
          console.warn(`Court ${i + 1}: Could not find challenger for winner ${winnerTeam.name}`, {
            availableTeams: availableTeams.length,
            teamsInCourts: Array.from(teamsInCourts)
          })
        }
      }
    }
    
    // Step 4: ONLY preserve existing courts if there are NO winners AND teams aren't already assigned
    // CRITICAL: If there are ANY winners, we MUST completely ignore existing courts to prevent conflicts
    // This ensures winners stay on their court and no team appears on multiple courts
    // Track matchups already assigned to prevent duplicates
    const assignedMatchupsInStep4 = new Set()
    for (let idx = 0; idx < availableCourtsCount; idx++) {
      if (newCourts[idx] && newCourts[idx].team1 && newCourts[idx].team2) {
        const matchupKey = getMatchupKey(newCourts[idx].team1.id, newCourts[idx].team2.id)
        assignedMatchupsInStep4.add(matchupKey)
      }
    }
    
    if (!hasWinners) {
      // Only preserve existing courts if there are no winners
      courts.forEach((c, index) => {
        if (c && c.team1 && c.team2 && !newCourts[index]) {
          // CRITICAL CHECK: Both teams must NOT be in teamsInCourts
          // Also check if either team is a winner on any court (double-check)
          const team1IsWinner = Object.values(courtWinners).includes(c.team1.id)
          const team2IsWinner = Object.values(courtWinners).includes(c.team2.id)
          
          if (teamsInCourts.has(c.team1.id) || 
              teamsInCourts.has(c.team2.id) || 
              team1IsWinner || 
              team2IsWinner) {
            return // Skip - one of the teams is already assigned or is a winner
          }
          
          const matchupKey = getMatchupKey(c.team1.id, c.team2.id)
          // Check both: haven't played before AND not already assigned in this round
          if (!playedMatchups.has(matchupKey) && !assignedMatchupsInStep4.has(matchupKey)) {
            newCourts[index] = c
            teamsInCourts.add(c.team1.id)
            teamsInCourts.add(c.team2.id)
            assignedMatchupsInStep4.add(matchupKey)
          }
        }
      })
    }
    // If hasWinners is true, we completely skip preserving existing courts
    // This is CRITICAL to prevent teams from appearing on multiple courts
    
    // Step 5: Fill remaining empty courts with teams that haven't played each other
    // CRITICAL: Always check teamsInCourts to prevent duplicates - NO EXCEPTIONS
    // Also track matchups assigned in this round to prevent same matchup on multiple courts
    const assignedMatchupsInStep5 = new Set()
    for (let idx = 0; idx < availableCourtsCount; idx++) {
      if (newCourts[idx] && newCourts[idx].team1 && newCourts[idx].team2) {
        const matchupKey = getMatchupKey(newCourts[idx].team1.id, newCourts[idx].team2.id)
        assignedMatchupsInStep5.add(matchupKey)
      }
    }
    
    for (let i = 0; i < availableCourtsCount; i++) {
      if (!newCourts[i]) {
        // Get all available teams (not in teamsInCourts)
        const availableTeams = teams.filter(t => !teamsInCourts.has(t.id))
        
        // First, try to find a matchup where teams haven't played each other AND aren't already in this round
        let foundMatchup = false
        for (let j = 0; j < availableTeams.length; j++) {
          for (let k = j + 1; k < availableTeams.length; k++) {
            const team1 = availableTeams[j]
            const team2 = availableTeams[k]
            
            // Double-check (should always pass since we filtered, but be safe)
            if (teamsInCourts.has(team1.id) || teamsInCourts.has(team2.id)) {
              continue // Skip this matchup - one team is already assigned
            }
            
            const matchupKey = getMatchupKey(team1.id, team2.id)
            // Check both: haven't played before AND not already assigned in this round
            if (!havePlayed(team1.id, team2.id) && !assignedMatchupsInStep5.has(matchupKey)) {
              newCourts[i] = {
                team1: team1,
                team2: team2,
                courtNumber: i + 1,
                startTime: Date.now(),
                winner: null
              }
              teamsInCourts.add(team1.id)
              teamsInCourts.add(team2.id)
              assignedMatchupsInStep5.add(matchupKey)
              foundMatchup = true
              break
            }
          }
          if (foundMatchup) break
        }
        
        // If no unique matchup found, try any matchup that hasn't been played (even if in this round)
        if (!foundMatchup) {
          for (let j = 0; j < availableTeams.length; j++) {
            for (let k = j + 1; k < availableTeams.length; k++) {
              const team1 = availableTeams[j]
              const team2 = availableTeams[k]
              
              // Double-check (should always pass since we filtered, but be safe)
              if (teamsInCourts.has(team1.id) || teamsInCourts.has(team2.id)) {
                continue
              }
              
              if (!havePlayed(team1.id, team2.id)) {
                newCourts[i] = {
                  team1: team1,
                  team2: team2,
                  courtNumber: i + 1,
                  startTime: Date.now(),
                  winner: null
                }
                teamsInCourts.add(team1.id)
                teamsInCourts.add(team2.id)
                const matchupKey = getMatchupKey(team1.id, team2.id)
                assignedMatchupsInStep5.add(matchupKey)
                foundMatchup = true
                break
              }
            }
            if (foundMatchup) break
          }
        }
        
        // If no unique matchup found, allow repeat matchup to ensure all courts are filled
        // (This should only happen if all teams have played each other)
        if (!foundMatchup && availableTeams.length >= 2) {
          // Use first two available teams (even if they've played before)
          const team1 = availableTeams[0]
          const team2 = availableTeams[1]
          
          if (!teamsInCourts.has(team1.id) && !teamsInCourts.has(team2.id)) {
            newCourts[i] = {
              team1: team1,
              team2: team2,
              courtNumber: i + 1,
              startTime: Date.now(),
              winner: null
            }
            teamsInCourts.add(team1.id)
            teamsInCourts.add(team2.id)
            const matchupKey = getMatchupKey(team1.id, team2.id)
            assignedMatchupsInStep5.add(matchupKey)
          }
        }
      }
    }
    
    // FINAL VALIDATION: Ensure no team appears on multiple courts
    // This is a critical safety check - if duplicates are detected, we rebuild the schedule
    const allTeamIds = []
    const teamToCourtMap = new Map() // Track which team is on which court
    for (let i = 0; i < availableCourtsCount; i++) {
      if (newCourts[i] && newCourts[i].team1 && newCourts[i].team2) {
        allTeamIds.push(newCourts[i].team1.id)
        allTeamIds.push(newCourts[i].team2.id)
        
        // Track team assignments
        if (teamToCourtMap.has(newCourts[i].team1.id)) {
          // Duplicate detected - clear the later court
          console.error(`DUPLICATE: Team ${newCourts[i].team1.id} on courts ${teamToCourtMap.get(newCourts[i].team1.id)} and ${i}`)
          newCourts[i] = null
          continue // Skip to next court - don't check team2 if court is cleared
        } else {
          teamToCourtMap.set(newCourts[i].team1.id, i)
        }
        
        // Check team2 only if court is still valid (not nulled above)
        if (newCourts[i] && newCourts[i].team2) {
          if (teamToCourtMap.has(newCourts[i].team2.id)) {
            // Duplicate detected - clear the later court
            console.error(`DUPLICATE: Team ${newCourts[i].team2.id} on courts ${teamToCourtMap.get(newCourts[i].team2.id)} and ${i}`)
            newCourts[i] = null
          } else {
            teamToCourtMap.set(newCourts[i].team2.id, i)
          }
        }
      }
    }
    
    // Refill any courts that were cleared due to duplicates
    // CRITICAL: If a court was cleared, we need to respect the winner-stays logic
    const finalTeamsInCourts = new Set(teamToCourtMap.keys())
    
    // Track matchups already assigned in the current newCourts array (to prevent duplicates in same round)
    const assignedMatchupsInRound = new Set()
    for (let idx = 0; idx < availableCourtsCount; idx++) {
      if (newCourts[idx] && newCourts[idx].team1 && newCourts[idx].team2) {
        const matchupKey = getMatchupKey(newCourts[idx].team1.id, newCourts[idx].team2.id)
        assignedMatchupsInRound.add(matchupKey)
      }
    }
    
    for (let i = 0; i < availableCourtsCount; i++) {
      if (!newCourts[i]) {
        // Check if this court should have a winner staying
        const winnerId = courtWinners[i]
        
        if (winnerId && !finalTeamsInCourts.has(winnerId)) {
          // This court should have a winner - find a challenger
          const winnerTeam = teams.find(t => t.id === winnerId)
          if (winnerTeam) {
            const availableTeams = teams.filter(t => 
              t.id !== winnerId && !finalTeamsInCourts.has(t.id)
            )
            
            // Prefer teams that haven't played the winner AND aren't already assigned in this round
            let challenger = null
            for (const team of availableTeams) {
              const matchupKey = getMatchupKey(winnerId, team.id)
              if (!havePlayed(winnerId, team.id) && !assignedMatchupsInRound.has(matchupKey)) {
                challenger = team
                break
              }
            }
            
            // If no unique matchup found, try any team that hasn't played (even if already in round)
            if (!challenger) {
              for (const team of availableTeams) {
                if (!havePlayed(winnerId, team.id)) {
                  challenger = team
                  break
                }
              }
            }
            
            // If all have played, pick first available
            if (!challenger && availableTeams.length > 0) {
              challenger = availableTeams[0]
            }
            
            if (challenger) {
              newCourts[i] = {
                team1: winnerTeam,
                team2: challenger,
                courtNumber: i + 1,
                startTime: Date.now(),
                winner: null
              }
              finalTeamsInCourts.add(winnerId)
              finalTeamsInCourts.add(challenger.id)
              // Track this matchup in the current round
              const matchupKey = getMatchupKey(winnerId, challenger.id)
              assignedMatchupsInRound.add(matchupKey)
              continue
            }
          }
        }
        
        // No winner for this court - find any available matchup
        const availableTeams = teams.filter(t => !finalTeamsInCourts.has(t.id))
        
        // First, try to find a matchup where teams haven't played each other AND aren't already in this round
        let foundMatchup = false
        for (let j = 0; j < availableTeams.length; j++) {
          for (let k = j + 1; k < availableTeams.length; k++) {
            const team1 = availableTeams[j]
            const team2 = availableTeams[k]
            const matchupKey = getMatchupKey(team1.id, team2.id)
            
            // Check both: haven't played before AND not already assigned in this round
            if (!havePlayed(team1.id, team2.id) && !assignedMatchupsInRound.has(matchupKey)) {
              newCourts[i] = {
                team1: team1,
                team2: team2,
                courtNumber: i + 1,
                startTime: Date.now(),
                winner: null
              }
              finalTeamsInCourts.add(team1.id)
              finalTeamsInCourts.add(team2.id)
              assignedMatchupsInRound.add(matchupKey)
              foundMatchup = true
              break
            }
          }
          if (foundMatchup) break
        }
        
        // If no unique matchup found, try any matchup that hasn't been played (even if in this round)
        if (!foundMatchup) {
          for (let j = 0; j < availableTeams.length; j++) {
            for (let k = j + 1; k < availableTeams.length; k++) {
              const team1 = availableTeams[j]
              const team2 = availableTeams[k]
              
              if (!havePlayed(team1.id, team2.id)) {
                newCourts[i] = {
                  team1: team1,
                  team2: team2,
                  courtNumber: i + 1,
                  startTime: Date.now(),
                  winner: null
                }
                finalTeamsInCourts.add(team1.id)
                finalTeamsInCourts.add(team2.id)
                const matchupKey = getMatchupKey(team1.id, team2.id)
                assignedMatchupsInRound.add(matchupKey)
                foundMatchup = true
                break
              }
            }
            if (foundMatchup) break
          }
        }
        
        // If still no matchup found, allow repeat matchup to ensure all courts are filled
        // (This should only happen if all teams have played each other)
        if (!foundMatchup && availableTeams.length >= 2) {
          const team1 = availableTeams[0]
          const team2 = availableTeams[1]
          
          newCourts[i] = {
            team1: team1,
            team2: team2,
            courtNumber: i + 1,
            startTime: Date.now(),
            winner: null
          }
          finalTeamsInCourts.add(team1.id)
          finalTeamsInCourts.add(team2.id)
          const matchupKey = getMatchupKey(team1.id, team2.id)
          assignedMatchupsInRound.add(matchupKey)
        }
      }
    }
    
    // Final validation: Check for duplicate matchups in the final newCourts array
    const finalMatchups = new Set()
    const duplicateMatchups = []
    for (let i = 0; i < availableCourtsCount; i++) {
      if (newCourts[i] && newCourts[i].team1 && newCourts[i].team2) {
        const matchupKey = getMatchupKey(newCourts[i].team1.id, newCourts[i].team2.id)
        if (finalMatchups.has(matchupKey)) {
          duplicateMatchups.push({ court: i + 1, matchup: matchupKey })
          console.error(`DUPLICATE MATCHUP DETECTED: ${matchupKey} on multiple courts!`)
          // Clear this court to prevent duplicate
          newCourts[i] = null
        } else {
          finalMatchups.add(matchupKey)
        }
      }
    }
    
    // If duplicates were found and cleared, try to refill those courts one more time
    if (duplicateMatchups.length > 0) {
      const finalTeamsInCourtsAfterCleanup = new Set()
      for (let idx = 0; idx < availableCourtsCount; idx++) {
        if (newCourts[idx] && newCourts[idx].team1 && newCourts[idx].team2) {
          finalTeamsInCourtsAfterCleanup.add(newCourts[idx].team1.id)
          finalTeamsInCourtsAfterCleanup.add(newCourts[idx].team2.id)
        }
      }
      
      // Try to refill cleared courts
      for (let i = 0; i < availableCourtsCount; i++) {
        if (!newCourts[i]) {
          const availableTeams = teams.filter(t => !finalTeamsInCourtsAfterCleanup.has(t.id))
          
          // Find any unique matchup
          let foundMatchup = false
          for (let j = 0; j < availableTeams.length; j++) {
            for (let k = j + 1; k < availableTeams.length; k++) {
              const team1 = availableTeams[j]
              const team2 = availableTeams[k]
              const matchupKey = getMatchupKey(team1.id, team2.id)
              
              // Must not have played AND not already in finalMatchups
              if (!havePlayed(team1.id, team2.id) && !finalMatchups.has(matchupKey)) {
                newCourts[i] = {
                  team1: team1,
                  team2: team2,
                  courtNumber: i + 1,
                  startTime: Date.now(),
                  winner: null
                }
                finalTeamsInCourtsAfterCleanup.add(team1.id)
                finalTeamsInCourtsAfterCleanup.add(team2.id)
                finalMatchups.add(matchupKey)
                foundMatchup = true
                break
              }
            }
            if (foundMatchup) break
          }
        }
      }
    }
    
    // Final check: If we have winners but no courts filled, something went wrong
    const hasWinnersCheck = Object.values(courtWinners).some(winnerId => winnerId != null && winnerId !== undefined)
    const courtsFilled = newCourts.filter(c => c !== null).length
    
    console.log('generateFairSchedule result:', {
      hasWinners: hasWinnersCheck,
      courtsFilled,
      newCourts,
      courtWinners,
      duplicateMatchupsFound: duplicateMatchups.length
    })
    
    if (hasWinnersCheck && courtsFilled === 0) {
      console.error('ERROR: Winners exist but no courts were filled!', {
        courtWinners,
        teams: teams.length,
        matches: matches.length
      })
    }
    
    return newCourts
  }

  // Initialize groups for drag and drop (Social) - بناءً على عدد الملاعب
  const initializeGroups = () => {
    const teams = currentState.teams || []
    const numCourts = getAvailableCourtsCount()
    const minTeams = numCourts * 3 // 3 فرق لكل مجموعة
    if (teams.length < minTeams) {
      alert(language === 'en'
        ? `Social Tournament requires at least ${minTeams} teams (3 teams per court × ${numCourts} courts). Currently ${teams.length} teams.`
        : `بطولة السوشيال تحتاج ${minTeams} فريقاً على الأقل (3 فرق لكل ملعب × ${numCourts} ملاعب). حالياً ${teams.length} فريق.`)
      return
    }
    const newGroups = {}
    for (let i = 1; i <= numCourts; i++) {
      newGroups[`court${i}`] = []
    }
    updateCurrentState(state => ({
      ...state,
      groupStage: newGroups,
      tournamentStage: 'group'
    }))
  }
  
  // Start group stage matches after teams are assigned (Social)
  const startGroupStage = () => {
    const groupStage = currentState.groupStage || {}
    const courts = currentState.courts || []
    const matches = currentState.matches || []
    
    console.log('startGroupStage called:', {
      groupStage,
      courts,
      matchesCount: matches.length
    })
    
    // Don't restart if matches are already in progress
    if (courts.some(c => c && c.isGroupStage)) {
      console.log('Matches already in progress, returning')
      return // Already started, matches will auto-progress
    }
    
    // Check if group stage is already complete (حسب عدد الملاعب)
    const availableCourtsCount = currentClub?.courts ? currentClub.courts.filter(c => !c.maintenance).length : 4
    const allGroupsComplete = Array.from({ length: availableCourtsCount }, (_, i) => i + 1).every(i => {
      const groupId = `court${i}`
      const groupTeams = groupStage[groupId] || []
      const groupMatches = matches.filter(m => m.groupId === groupId)
      return groupMatches.length >= 3 // 3 matches for 3 teams (round-robin)
    })
    
    if (allGroupsComplete) {
      console.log('All groups complete, checking for semi-finals...')
      // Groups are complete, check if we should move to semi-finals
      checkAllGroupsComplete()
      return
    }
    
    const allGroupsFull = Object.keys(groupStage).every(key => groupStage[key].length === 3)
    console.log('Groups full check:', {
      allGroupsFull,
      groupSizes: Object.keys(groupStage).map(key => ({ key, size: groupStage[key].length }))
    })
    
    if (!allGroupsFull) {
      alert(language === 'en' 
        ? 'Please assign 3 teams to each group before starting' 
        : 'يرجى تعيين 3 فرق لكل مجموعة قبل البدء')
      return
    }
    
    const newCourts = new Array(availableCourtsCount).fill(null)
    
    for (let i = 0; i < availableCourtsCount; i++) {
      const groupTeams = groupStage[`court${i + 1}`]
      if (groupTeams && groupTeams.length === 3) {
        // Start with first match: team1 vs team2
        newCourts[i] = {
          team1: groupTeams[0],
          team2: groupTeams[1],
          team3: groupTeams[2],
          courtNumber: i + 1,
          startTime: Date.now(),
          winner: null,
          isGroupStage: true,
          groupId: `court${i + 1}`
        }
        console.log(`Court ${i + 1} created: ${groupTeams[0].name} vs ${groupTeams[1].name}`)
      } else {
        console.log(`Court ${i + 1} not created - groupTeams:`, groupTeams)
      }
    }
    
    console.log('startGroupStage - Final courts:', newCourts)
    
    updateCurrentState(state => ({
      ...state,
      courts: newCourts,
      tournamentStage: 'group'
    }))
  }
  
  // Handle drag and drop (Social)
  const handleDragStart = (e, team) => {
    e.dataTransfer.setData('teamId', team.id.toString())
    e.dataTransfer.effectAllowed = 'move'
  }
  
  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    e.currentTarget.classList.add('drag-over')
  }
  
  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('drag-over')
  }
  
  const handleDrop = (e, groupId) => {
    e.preventDefault()
    const teamId = parseInt(e.dataTransfer.getData('teamId'))
    const teams = currentState.teams || []
    const team = teams.find(t => t.id === teamId)
    const groupStage = currentState.groupStage || {}
    
    if (!team) return
    
    // Check if team is already in a group
    const currentGroup = Object.keys(groupStage).find(key => 
      groupStage[key].some(t => t.id === teamId)
    )
    
    // Remove from current group if exists
    const updatedGroups = { ...groupStage }
    if (currentGroup) {
      updatedGroups[currentGroup] = updatedGroups[currentGroup].filter(t => t.id !== teamId)
    }
    
    // Add to new group if not full
    if (updatedGroups[groupId] && updatedGroups[groupId].length < 3) {
      updatedGroups[groupId] = [...updatedGroups[groupId], team]
    }
    
    updateCurrentState(state => ({
      ...state,
      groupStage: updatedGroups
    }))
  }
  
  const removeTeamFromGroup = (teamId, groupId) => {
    const groupStage = currentState.groupStage || {}
    const updatedGroups = { ...groupStage }
    updatedGroups[groupId] = (updatedGroups[groupId] || []).filter(t => t.id !== teamId)
    updateCurrentState(state => ({
      ...state,
      groupStage: updatedGroups
    }))
  }
  
  // Get unassigned teams (Social)
  const getUnassignedTeams = () => {
    const teams = currentState.teams || []
    const groupStage = currentState.groupStage || {}
    const assignedTeamIds = new Set()
    Object.values(groupStage).forEach(group => {
      group.forEach(team => assignedTeamIds.add(team.id))
    })
    return teams.filter(t => !assignedTeamIds.has(t.id))
  }
  
  // Get team's opponents list (King) - deduplicated to show each opponent only once
  const getTeamOpponents = (teamId) => {
    const matches = currentState.matches || []
    const opponentMap = new Map() // Use Map to track unique opponents
    
    matches.forEach(match => {
      let opponent = null
      if (match.team1.id === teamId) {
        opponent = match.team2
      } else if (match.team2.id === teamId) {
        opponent = match.team1
      }
      
      if (opponent) {
        // Only keep the first match with each opponent (deduplicate)
        if (!opponentMap.has(opponent.id)) {
          opponentMap.set(opponent.id, { team: opponent, match })
        }
      }
    })
    
    // Convert Map values to array
    return Array.from(opponentMap.values())
  }

  // Assign teams to courts
  const assignToCourts = () => {
    if (activeTab === 'social') {
      const groupStage = currentState.groupStage || {}
      const courts = currentState.courts || []
      const tournamentStage = currentState.tournamentStage || 'group'
      
      console.log('Social Tournament - Assign Matches clicked:', {
        groupStageKeys: Object.keys(groupStage).length,
        courts: courts,
        tournamentStage,
        hasActiveMatches: courts.some(c => c && c.isGroupStage)
      })
      
      // Only allow initialization if no groups exist
      if (Object.keys(groupStage).length === 0) {
        console.log('No groups exist, initializing...')
        initializeGroups()
        return
      }
      
      // If tournament is in semi or final stage, don't allow reassigning
      if (tournamentStage === 'semi' || tournamentStage === 'final') {
        console.log('Tournament in semi/final stage, cannot reassign')
        return
      }
      
      // If courts have active group stage matches, don't restart
      if (courts.some(c => c && c.isGroupStage)) {
        console.log('Active group stage matches exist, cannot restart')
        return
      }
      
      // Otherwise start group stage
      console.log('Starting group stage...')
      startGroupStage()
    } else {
      // For King of Court: Generate new schedule ensuring no team on multiple courts
      const availableCourtsCount = currentClub?.courts ? currentClub.courts.filter(c => !c.maintenance).length : 4
      const defaultCourts = new Array(availableCourtsCount).fill(null)
      const currentCourts = currentState.courts || defaultCourts
      const courtWinners = currentState.courtWinners || {}
      
      console.log('Assign Matches - Current state:', {
        courts: currentCourts,
        courtWinners,
        matches: currentState.matches?.length || 0,
        teams: currentState.teams?.length || 0
      })
      
      let newCourts = generateFairSchedule(currentState.matches, currentCourts)
      
      console.log('Assign Matches - Generated courts:', newCourts)
      
      // Check if any courts were generated
      const courtsGenerated = newCourts.some(c => c !== null)
      if (!courtsGenerated) {
        console.error('ERROR: No courts generated!', {
          courtWinners,
          matches: currentState.matches,
          teams: currentState.teams
        })
        alert(language === 'en' 
          ? 'Error: Could not generate matches. Please check that teams and matches are set up correctly.' 
          : 'خطأ: لم يتم إنشاء المباريات. يرجى التحقق من إعداد الفرق والمباريات بشكل صحيح.')
        return
      }
      
      // Final validation before updating state
      const allTeamIds = []
      const matchupKeys = new Set()
      const duplicateMatchups = []
      const cleanedCourts = [...newCourts]
      
      for (let i = 0; i < availableCourtsCount; i++) {
        if (cleanedCourts[i] && cleanedCourts[i].team1 && cleanedCourts[i].team2) {
          allTeamIds.push(cleanedCourts[i].team1.id)
          allTeamIds.push(cleanedCourts[i].team2.id)
          
          // Check for duplicate matchups
          const matchupKey = [cleanedCourts[i].team1.id, cleanedCourts[i].team2.id].sort().join('-')
          if (matchupKeys.has(matchupKey)) {
            duplicateMatchups.push({
              court: i + 1,
              team1: cleanedCourts[i].team1.name,
              team2: cleanedCourts[i].team2.name,
              matchupKey
            })
            console.error(`DUPLICATE MATCHUP: ${cleanedCourts[i].team1.name} vs ${cleanedCourts[i].team2.name} on multiple courts!`)
            // Clear this duplicate court
            cleanedCourts[i] = null
          } else {
            matchupKeys.add(matchupKey)
          }
        }
      }
      
      const uniqueTeamIds = new Set(allTeamIds)
      if (allTeamIds.length !== uniqueTeamIds.size) {
        console.error('CRITICAL: Duplicate teams detected in schedule!', {
          allTeamIds,
          uniqueTeamIds: Array.from(uniqueTeamIds),
          newCourts
        })
        // Don't update if there are duplicates - this should never happen with our logic
        alert(language === 'en' 
          ? 'Error: Duplicate teams detected. Please try again.' 
          : 'خطأ: تم اكتشاف فرق مكررة. يرجى المحاولة مرة أخرى.')
        return
      }
      
      if (duplicateMatchups.length > 0) {
        console.error('CRITICAL: Duplicate matchups detected and cleared!', duplicateMatchups)
        // Try to regenerate schedule one more time if duplicates were found
        const regeneratedCourts = generateFairSchedule(currentState.matches, currentCourts)
        const regeneratedMatchups = new Set()
        let hasDuplicates = false
        
        for (let i = 0; i < availableCourtsCount; i++) {
          if (regeneratedCourts[i] && regeneratedCourts[i].team1 && regeneratedCourts[i].team2) {
            const matchupKey = [regeneratedCourts[i].team1.id, regeneratedCourts[i].team2.id].sort().join('-')
            if (regeneratedMatchups.has(matchupKey)) {
              hasDuplicates = true
              break
            }
            regeneratedMatchups.add(matchupKey)
          }
        }
        
        if (hasDuplicates) {
          console.error('ERROR: Still have duplicates after regeneration!')
          alert(language === 'en' 
            ? 'Error: Could not generate unique matches. Please try again or reset the tournament.' 
            : 'خطأ: لم يتم إنشاء مباريات فريدة. يرجى المحاولة مرة أخرى أو إعادة تعيين البطولة.')
          return
        }
        
        // Use regenerated courts if they're valid
        newCourts = regeneratedCourts
      } else {
        // Use cleaned courts (with duplicates removed)
        newCourts = cleanedCourts
      }
      
      updateCurrentState(state => ({
        ...state,
        courts: newCourts
      }))
    }
  }
  
  // Get next match for a group in social tournament
  // NEW LOGIC: Loser stays on court, plays with waiting team
  // Example: Team 1 vs Team 2 → Team 2 wins → Team 1 (loser) stays, plays Team 3 → Then Team 3 vs Team 2
  const getNextGroupMatch = (groupId, allMatches, currentCourt) => {
    const groupStage = currentState.groupStage || {}
    const groupTeams = groupStage[groupId] || []
    if (groupTeams.length !== 3) return null
    
    const groupMatches = allMatches.filter(m => m.groupId === groupId)
    
    // If no matches played yet, first match is always Team 1 vs Team 2
    if (groupMatches.length === 0) {
      return { teams: [groupTeams[0], groupTeams[1]], keepLoserPosition: false } // Team 1 vs Team 2
    }
    
    // If one match played, loser stays and plays Team 3 (waiting team)
    if (groupMatches.length === 1) {
      const firstMatch = groupMatches[0]
      if (!firstMatch.winner) {
        // Tie in first match - can't determine loser, use round-robin
        return { teams: [groupTeams[0], groupTeams[2]], keepLoserPosition: false }
      }
      
      const loser = firstMatch.winner.id === firstMatch.team1.id ? firstMatch.team2 : firstMatch.team1
      const waitingTeam = groupTeams[2] // Team 3 is always the waiting team
      
      // Loser stays on court in their position from first match
      // Return both teams and flag to keep loser position
      return { 
        teams: [loser, waitingTeam], 
        keepLoserPosition: true,
        loserWasTeam1: firstMatch.team1.id === loser.id
      }
    }
    
    // If two matches played, final match is always: Team 3 (waiting) vs Team 2 (winner of match 1)
    if (groupMatches.length === 2) {
      const firstMatch = groupMatches[0]
      
      if (!firstMatch.winner) {
        // Tie in first match - can't determine winner, use round-robin fallback
        // Find the unplayed matchup
        const playedPairs = new Set()
        groupMatches.forEach(m => {
          playedPairs.add([m.team1.id, m.team2.id].sort().join('-'))
        })
        for (let i = 0; i < groupTeams.length; i++) {
          for (let j = i + 1; j < groupTeams.length; j++) {
            const pair = [groupTeams[i].id, groupTeams[j].id].sort().join('-')
            if (!playedPairs.has(pair)) {
              return { teams: [groupTeams[i], groupTeams[j]], keepLoserPosition: false }
            }
          }
        }
        return null
      }
      
      const firstMatchWinner = firstMatch.winner
      const waitingTeam = groupTeams[2] // Team 3 is always the waiting team
      
      // Final match is always: Team 3 (waiting) vs Team 2 (winner of match 1)
      // But we need to identify which team is "Team 2" - it's the winner of the first match
      // So: waitingTeam vs firstMatchWinner
      return { teams: [waitingTeam, firstMatchWinner], keepLoserPosition: false }
    }
    
    // All 3 matches completed
    return null
  }
  
  // Check if group stage is complete and get qualifier (Social)
  const checkGroupComplete = (groupId) => {
    const groupStage = currentState.groupStage || {}
    const matches = currentState.matches || []
    const teams = currentState.teams || []
    const groupTeams = groupStage[groupId] || []
    if (groupTeams.length === 0) return null
    
    const groupMatches = matches.filter(m => m.groupId === groupId)
    
    // Each team should play 2 matches in a group of 3 (round-robin)
    const expectedMatches = 3 // 3 teams = 3 matches (A vs B, A vs C, B vs C)
    if (groupMatches.length < expectedMatches) return null
    
    // Calculate standings for this group using current team data
    const groupStandings = groupTeams.map(teamId => {
      const team = teams.find(t => t.id === teamId.id) || teamId
      const teamMatches = groupMatches.filter(m => 
        m.team1.id === team.id || m.team2.id === team.id
      )
      let wins = 0
      let gamesWon = 0
      let gamesLost = 0
      
      teamMatches.forEach(match => {
        const isTeam1 = match.team1.id === team.id
        
        // For final matches, count games from sets only (not tiebreak points)
        let teamGames, opponentGames
        if (match.isFinal && match.set1Team1Games !== undefined) {
          teamGames = isTeam1 
            ? (match.set1Team1Games + (match.set2Team1Games || 0))
            : (match.set1Team2Games + (match.set2Team2Games || 0))
          opponentGames = isTeam1
            ? (match.set1Team2Games + (match.set2Team2Games || 0))
            : (match.set1Team1Games + (match.set2Team1Games || 0))
        } else {
          teamGames = isTeam1 ? match.team1Games : match.team2Games
          opponentGames = isTeam1 ? match.team2Games : match.team1Games
        }
        
        gamesWon += teamGames
        gamesLost += opponentGames
        
        if (match.winner && match.winner.id === team.id) {
          wins++
        }
      })
      
      return {
        ...team,
        wins,
        gamesWon,
        gamesLost,
        gamesDiff: gamesWon - gamesLost
      }
    })
    
    // Sort by wins, then games diff
    groupStandings.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins
      return b.gamesDiff - a.gamesDiff
    })
    
    return groupStandings[0] // Return first place
  }
  
  // Check all groups and move to semi-finals (Social)
  const checkAllGroupsComplete = (allMatches) => {
    const matches = allMatches || currentState.matches || []
    const groupStage = currentState.groupStage || {}
    const tournamentStage = currentState.tournamentStage || 'group'
    const teams = currentState.teams || []
    
    // Only check if we're still in group stage
    if (tournamentStage !== 'group') {
      return
    }
    
    // Check if all groups have completed their 3 matches (حسب عدد الملاعب)
    const numCourts = getAvailableCourtsCount()
    const allGroupsComplete = Array.from({ length: numCourts }, (_, i) => i + 1).every(i => {
      const groupId = `court${i}`
      const groupTeams = groupStage[groupId] || []
      if (groupTeams.length !== 3) return false
      const groupMatches = matches.filter(m => m.groupId === groupId)
      return groupMatches.length >= 3 // 3 matches for round-robin of 3 teams
    })
    
    if (!allGroupsComplete) {
      return
    }
    
    // Get qualifiers (first place from each group) using updated matches
    const qualifiers = []
    for (let i = 1; i <= numCourts; i++) {
      const groupId = `court${i}`
      const groupTeams = groupStage[groupId] || []
      if (groupTeams.length === 0) continue
      
      const groupMatches = matches.filter(m => m.groupId === groupId)
      if (groupMatches.length < 3) continue
      
      // Calculate standings for this group
      const groupStandings = groupTeams.map(team => {
        const teamData = teams.find(t => t.id === team.id) || team
        const teamMatches = groupMatches.filter(m => 
          m.team1.id === team.id || m.team2.id === team.id
        )
        let wins = 0
        let gamesWon = 0
        let gamesLost = 0
        
        teamMatches.forEach(match => {
          const isTeam1 = match.team1.id === team.id
          
          // For final matches, count games from sets only (not tiebreak points)
          let teamGames, opponentGames
          if (match.isFinal && match.set1Team1Games !== undefined) {
            teamGames = isTeam1 
              ? (match.set1Team1Games + (match.set2Team1Games || 0))
              : (match.set1Team2Games + (match.set2Team2Games || 0))
            opponentGames = isTeam1
              ? (match.set1Team2Games + (match.set2Team2Games || 0))
              : (match.set1Team1Games + (match.set2Team1Games || 0))
          } else {
            teamGames = isTeam1 ? match.team1Games : match.team2Games
            opponentGames = isTeam1 ? match.team2Games : match.team1Games
          }
          
          gamesWon += teamGames
          gamesLost += opponentGames
          
          if (match.winner && match.winner.id === team.id) {
            wins++
          }
        })
        
        return {
          ...teamData,
          wins,
          gamesWon,
          gamesLost,
          gamesDiff: gamesWon - gamesLost
        }
      })
      
      // Sort by wins, then games diff
      groupStandings.sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins
        return b.gamesDiff - a.gamesDiff
      })
      
      if (groupStandings[0]) {
        qualifiers.push(groupStandings[0])
      }
    }
    
    // نصف النهائي يتطلب 4 متأهلين (من 4 مجموعات)
    if (qualifiers.length === 4) {
      setupSemiFinals(qualifiers)
    } else if (qualifiers.length === numCourts && numCourts !== 4) {
      // إذا كان عدد الملاعب غير 4، ننتظر إعداد 4 مجموعات للمرحلة التالية أو نعرض رسالة
      console.log('Semi-finals require 4 qualifiers. Current qualifiers:', qualifiers.length)
    }
  }
  
  // Setup semi-finals (Social)
  const setupSemiFinals = (qualifiers) => {
    const semi1 = {
      team1: qualifiers[0],
      team2: qualifiers[1],
      courtNumber: 1,
      startTime: Date.now(),
      winner: null,
      isSemiFinal: true,
      semiNumber: 1
    }
    const semi2 = {
      team1: qualifiers[2],
      team2: qualifiers[3],
      courtNumber: 2,
      startTime: Date.now(),
      winner: null,
      isSemiFinal: true,
      semiNumber: 2
    }
    
    updateCurrentState(state => ({
      ...state,
      courts: [semi1, semi2, null, null],
      semiFinals: [semi1, semi2],
      tournamentStage: 'semi',
      qualifiedTeams: qualifiers
    }))
  }
  
  // Check semi-finals complete and setup final (Social)
  const checkSemiFinalsComplete = (allMatches) => {
    const matches = allMatches || currentState.matches || []
    const semiMatches = matches.filter(m => m.isSemiFinal && !m.isTie)
    if (semiMatches.length < 2) return
    
    const semi1Match = semiMatches.find(m => m.semiNumber === 1)
    const semi2Match = semiMatches.find(m => m.semiNumber === 2)
    
    if (!semi1Match?.winner || !semi2Match?.winner) return
    
    const semi1Winner = semi1Match.winner
    const semi2Winner = semi2Match.winner
    
    if (semi1Winner && semi2Winner) {
      const finalMatch = {
        team1: semi1Winner,
        team2: semi2Winner,
        courtNumber: 1,
        startTime: Date.now(),
        winner: null,
        isFinal: true,
        set1Team1Games: null,
        set1Team2Games: null,
        set2Team1Games: null,
        set2Team2Games: null,
        tiebreakTeam1Points: null,
        tiebreakTeam2Points: null,
        currentSet: 'set1' // 'set1', 'set2', 'tiebreak', 'complete'
      }
      
      updateCurrentState(state => ({
        ...state,
        courts: [finalMatch, null, null, null],
        finals: [finalMatch],
        tournamentStage: 'final'
      }))
    }
  }

  // Start match timer (15 minutes)
  const startMatchTimer = (courtNumber) => {
    const matchTimers = currentState.matchTimers || {}
    const timer = matchTimers[courtNumber]
    const initialElapsed = timer?.paused ? timer.elapsed : 0
    const startTime = Date.now()
    
    const timerId = setInterval(() => {
      updateCurrentState(state => {
        const timers = state.matchTimers || {}
        const currentTimer = timers[courtNumber]
        if (!currentTimer) return state
        
        if (!currentTimer.paused) {
          const elapsed = initialElapsed + Math.floor((Date.now() - startTime) / 1000)
          const newTimers = { ...timers }
          newTimers[courtNumber] = {
            ...currentTimer,
            elapsed: elapsed
          }
          
          if (elapsed >= 900 && !currentTimer.alerted) {
            newTimers[courtNumber].alerted = true
            alert(`${t.court} ${courtNumber}: ${t.timeUpAlert}`)
          }
          
          return { ...state, matchTimers: newTimers }
        }
        return state
      })
    }, 1000)

    updateCurrentState(state => ({
      ...state,
      matchTimers: {
        ...(state.matchTimers || {}),
        [courtNumber]: { 
          startTime, 
          elapsed: initialElapsed, 
          timerId, 
          alerted: timer?.alerted || false,
          paused: false
        }
      }
    }))
  }

  // Pause timer with confirmation
  const pauseTimer = (courtNumber) => {
    if (window.confirm(t.confirmPause)) {
      const matchTimers = currentState.matchTimers || {}
      const timer = matchTimers[courtNumber]
      if (timer?.timerId) {
        clearInterval(timer.timerId)
      }
      updateCurrentState(state => ({
        ...state,
        matchTimers: {
          ...(state.matchTimers || {}),
          [courtNumber]: {
            ...(state.matchTimers || {})[courtNumber],
            paused: true,
            timerId: null
          }
        }
      }))
    }
  }

  // Resume timer
  const resumeTimer = (courtNumber) => {
    startMatchTimer(courtNumber)
  }

  // Reset timer
  const resetTimer = (courtNumber) => {
    if (window.confirm(t.confirmReset)) {
      const matchTimers = currentState.matchTimers || {}
      const timer = matchTimers[courtNumber]
      if (timer?.timerId) {
        clearInterval(timer.timerId)
      }
      updateCurrentState(state => {
        const newTimers = { ...(state.matchTimers || {}) }
        delete newTimers[courtNumber]
        return { ...state, matchTimers: newTimers }
      })
    }
  }

  // Record match result - determines winner from scores
  // Record a set in the final match (Social Tournament)
  const recordFinalSet = (courtIndex, setType, team1Score, team2Score) => {
    const courts = currentState.courts || []
    const court = courts[courtIndex]
    if (!court || !court.isFinal) return

    // Validate scores based on set type
    if (setType === 'set1' || setType === 'set2') {
      // Sets: 6 games max, if 6-6 then tiebreak to 7-6
      if (team1Score > 7 || team2Score > 7) {
        alert(language === 'en' 
          ? 'Maximum 7 games (6 games + tiebreak). Please enter valid scores.'
          : 'الحد الأقصى 7 ألعاب (6 ألعاب + كسر التعادل). يرجى إدخال نتائج صحيحة.')
        return
      }
      if (team1Score === 6 && team2Score === 6) {
        alert(language === 'en' 
          ? 'If tied at 6-6, play tiebreak. Winner must be 7-6 or 6-7.'
          : 'إذا كانت النتيجة 6-6، قم بلعب كسر التعادل. يجب أن يكون الفائز 7-6 أو 6-7.')
        return
      }
      if ((team1Score === 7 && team2Score !== 6) || (team2Score === 7 && team1Score !== 6)) {
        alert(language === 'en' 
          ? 'Tiebreak score must be 7-6 or 6-7.'
          : 'نتيجة كسر التعادل يجب أن تكون 7-6 أو 6-7.')
        return
      }
    } else if (setType === 'tiebreak') {
      // Tiebreak: 7 points max
      if (team1Score > 7 || team2Score > 7) {
        alert(language === 'en' 
          ? 'Maximum 7 points in tiebreak. Please enter valid scores.'
          : 'الحد الأقصى 7 نقاط في كسر التعادل. يرجى إدخال نتائج صحيحة.')
        return
      }
      if (team1Score === team2Score) {
        alert(language === 'en' 
          ? 'Tiebreak cannot be tied. Please enter different scores.'
          : 'لا يمكن تعادل كسر التعادل. يرجى إدخال نتائج مختلفة.')
        return
      }
    }

    const updatedCourts = [...courts]
    const updatedCourt = { ...court }

    // Store the set scores
    if (setType === 'set1') {
      updatedCourt.set1Team1Games = team1Score
      updatedCourt.set1Team2Games = team2Score
      updatedCourt.currentSet = 'set2'
    } else if (setType === 'set2') {
      updatedCourt.set2Team1Games = team1Score
      updatedCourt.set2Team2Games = team2Score
      
      // Determine set winners
      const set1Team1Won = updatedCourt.set1Team1Games > updatedCourt.set1Team2Games
      const set2Team1Won = updatedCourt.set2Team1Games > updatedCourt.set2Team2Games
      
      if ((set1Team1Won && !set2Team1Won) || (!set1Team1Won && set2Team1Won)) {
        // Sets are 1-1, need tiebreak
        updatedCourt.currentSet = 'tiebreak'
      } else {
        // One team won both sets, match complete
        updatedCourt.currentSet = 'complete'
      }
    } else if (setType === 'tiebreak') {
      updatedCourt.tiebreakTeam1Points = team1Score
      updatedCourt.tiebreakTeam2Points = team2Score
      updatedCourt.currentSet = 'complete'
    }

    // If match is complete, record it
    if (updatedCourt.currentSet === 'complete') {
      // Calculate final winner and record match
      const set1Team1Won = updatedCourt.set1Team1Games > updatedCourt.set1Team2Games
      const set2Team1Won = updatedCourt.set2Team1Games > updatedCourt.set2Team2Games
      const tiebreakTeam1Won = updatedCourt.tiebreakTeam1Points > updatedCourt.tiebreakTeam2Points
      
      let finalWinner = null
      if (set1Team1Won && set2Team1Won) {
        finalWinner = updatedCourt.team1
      } else if (!set1Team1Won && !set2Team1Won) {
        finalWinner = updatedCourt.team2
      } else {
        // 1-1 in sets, tiebreak decides
        finalWinner = tiebreakTeam1Won ? updatedCourt.team1 : updatedCourt.team2
      }

      // Calculate sets won (not games)
      let team1SetsWon = 0
      let team2SetsWon = 0
      
      if (set1Team1Won) team1SetsWon++
      else team2SetsWon++
      
      if (set2Team1Won) team1SetsWon++
      else team2SetsWon++
      
      // If tiebreak was played, winner gets one more set
      if (updatedCourt.tiebreakTeam1Points !== null && updatedCourt.tiebreakTeam2Points !== null) {
        if (tiebreakTeam1Won) team1SetsWon++
        else team2SetsWon++
      }

      // Record the match (store sets won for display, and individual set scores for details)
      const matches = currentState.matches || []
      const newMatch = {
        id: matches.length + 1,
        team1: updatedCourt.team1,
        team2: updatedCourt.team2,
        winner: finalWinner,
        isTie: false,
        team1Games: team1SetsWon, // Store sets won in team1Games for display
        team2Games: team2SetsWon, // Store sets won in team2Games for display
        team1SetsWon: team1SetsWon,
        team2SetsWon: team2SetsWon,
        courtNumber: updatedCourt.courtNumber,
        timestamp: Date.now(),
        isFinal: true,
        set1Team1Games: updatedCourt.set1Team1Games,
        set1Team2Games: updatedCourt.set1Team2Games,
        set2Team1Games: updatedCourt.set2Team1Games,
        set2Team2Games: updatedCourt.set2Team2Games,
        tiebreakTeam1Points: updatedCourt.tiebreakTeam1Points,
        tiebreakTeam2Points: updatedCourt.tiebreakTeam2Points
      }

      // Update matches and clear court
      updatedCourts[courtIndex] = null
      
      // Update team stats (only count games from sets, not tiebreak points)
      const teams = currentState.teams || []
      const team1GamesFromSets = updatedCourt.set1Team1Games + updatedCourt.set2Team1Games
      const team2GamesFromSets = updatedCourt.set1Team2Games + updatedCourt.set2Team2Games
      
      const updatedTeams = teams.map(t => {
        if (t.id === updatedCourt.team1.id) {
          return {
            ...t,
            wins: finalWinner.id === t.id ? t.wins + 1 : t.wins,
            losses: finalWinner.id !== t.id ? t.losses + 1 : t.losses,
            gamesWon: t.gamesWon + team1GamesFromSets,
            gamesLost: t.gamesLost + team2GamesFromSets,
            matchesPlayed: t.matchesPlayed + 1
          }
        } else if (t.id === updatedCourt.team2.id) {
          return {
            ...t,
            wins: finalWinner.id === t.id ? t.wins + 1 : t.wins,
            losses: finalWinner.id !== t.id ? t.losses + 1 : t.losses,
            gamesWon: t.gamesWon + team2GamesFromSets,
            gamesLost: t.gamesLost + team1GamesFromSets,
            matchesPlayed: t.matchesPlayed + 1
          }
        }
        return t
      })

      // Update member statistics (final match - 30 points for winner)
      let updatedMembers = [...members]
      const team1MemberIds = updatedCourt.team1.memberIds || []
      const team2MemberIds = updatedCourt.team2.memberIds || []
      const allMemberIds = [...new Set([...team1MemberIds, ...team2MemberIds])]
      
      allMemberIds.forEach(memberId => {
        const memberIndex = updatedMembers.findIndex(m => m.id === memberId)
        if (memberIndex === -1) return
        
        const member = updatedMembers[memberIndex]
        const isTeam1 = team1MemberIds.includes(memberId)
        const isTeam2 = team2MemberIds.includes(memberId)
        const memberWon = (isTeam1 && finalWinner.id === updatedCourt.team1.id) || (isTeam2 && finalWinner.id === updatedCourt.team2.id)
        
        // Check if first match in tournament
        const isFirstMatchInTournament = member.lastTournamentId !== effectiveTournamentId
        
        const matchPoints = memberWon ? 30 : 0
        const result = memberWon ? t.wins : t.losses
        const opponentTeam = isTeam1 ? updatedCourt.team2 : updatedCourt.team1
        const teamName = isTeam1 ? updatedCourt.team1.name : updatedCourt.team2.name
        
        const historyEntries = []
        
        // Tournament join points
        let totalPointsToAdd = 0
        if (isFirstMatchInTournament) {
          const joinHistoryEntry = {
            id: Date.now() + Math.random() + 0.1,
            timestamp: Date.now(),
            matchId: null,
            team: teamName,
            opponent: null,
            result: 'Tournament Join',
            pointsEarned: 20,
            tournamentId: effectiveTournamentId,
            tournamentType: activeTab, // 'king' or 'social'
            stage: 'join'
          }
          historyEntries.push(joinHistoryEntry)
          totalPointsToAdd += 20
        }
        
        // Final match points
        if (matchPoints > 0) {
          const matchHistoryEntry = {
            id: Date.now() + Math.random(),
            timestamp: Date.now(),
            matchId: newMatch.id,
            team: teamName,
            opponent: opponentTeam.name,
            result: result,
            pointsEarned: matchPoints,
            tournamentId: effectiveTournamentId,
            tournamentType: activeTab, // 'king' or 'social'
            stage: 'final'
          }
          historyEntries.push(matchHistoryEntry)
          totalPointsToAdd += matchPoints
        }
        
        updatedMembers[memberIndex] = {
          ...member,
          totalGames: member.totalGames + 1,
          totalWins: memberWon ? member.totalWins + 1 : member.totalWins,
          totalLosses: memberWon ? member.totalLosses : member.totalLosses + 1,
          totalDraws: member.totalDraws,
          totalPoints: member.totalPoints + totalPointsToAdd,
          tournamentsPlayed: isFirstMatchInTournament ? member.tournamentsPlayed + 1 : member.tournamentsPlayed,
          lastTournamentId: effectiveTournamentId,
          tournamentsWon: memberWon ? (member.tournamentsWon || 0) + 1 : (member.tournamentsWon || 0),
          pointsHistory: [...(member.pointsHistory || []), ...historyEntries]
        }
      })

      updateCurrentState(state => ({
        ...state,
        teams: updatedTeams,
        matches: [...state.matches, newMatch],
        courts: updatedCourts
      }))

      // Save to IndexedDB
      saveMatchToIndexedDB(newMatch, activeTab, effectiveTournamentId, currentClub?.id).then(() => {
        getAllMatchesFromIndexedDB(currentClub?.id).then(historical => {
          setHistoricalMatches(historical)
        })
      })
      
      // Update members state
      setMembers(updatedMembers)
    } else {
      // Update court with new set data
      updatedCourts[courtIndex] = updatedCourt
      updateCurrentState(state => ({
        ...state,
        courts: updatedCourts
      }))
    }
  }

  const recordMatchResult = (courtIndex, team1Games, team2Games) => {
    const courts = currentState.courts || []
    const court = courts[courtIndex]
    if (!court) return

    const teams = currentState.teams || []
    const matches = currentState.matches || []

    // Validate scores for social tournament
    if (activeTab === 'social') {
      const maxScore = getMaxScoreForSocialTournament(court)
      
      // Validate max scores
      if (team1Games > maxScore || team2Games > maxScore) {
        alert(language === 'en' 
          ? `Maximum score for this stage is ${maxScore}. Please enter valid scores.`
          : `الحد الأقصى للنتيجة في هذه المرحلة هو ${maxScore}. يرجى إدخال نتائج صحيحة.`)
        return
      }
      
      // Validate specific rules
      if (court.isGroupStage || court.groupId) {
        // Group stage: 6 games max, if 6-6 then tiebreak to 7-6
        // Valid scores: 0-6, 1-6, ..., 6-0, 6-1, ..., 6-5, 7-6, 6-7
        if (team1Games > 7 || team2Games > 7) {
          alert(language === 'en' 
            ? 'Group stage: Maximum 7 games (6 games + tiebreak).'
            : 'مرحلة المجموعات: الحد الأقصى 7 ألعاب (6 ألعاب + كسر التعادل).')
          return
        }
        if (team1Games === 6 && team2Games === 6) {
          // 6-6 is not valid - must play tiebreak to 7-6 or 6-7
          alert(language === 'en' 
            ? 'Group stage: If tied at 6-6, play tiebreak. Winner must be 7-6 or 6-7.'
            : 'مرحلة المجموعات: إذا كانت النتيجة 6-6، قم بلعب كسر التعادل. يجب أن يكون الفائز 7-6 أو 6-7.')
          return
        }
        // If score > 6, must be exactly 7-6 or 6-7
        if ((team1Games === 7 && team2Games !== 6) || (team2Games === 7 && team1Games !== 6)) {
          alert(language === 'en' 
            ? 'Group stage: Tiebreak score must be 7-6 or 6-7.'
            : 'مرحلة المجموعات: نتيجة كسر التعادل يجب أن تكون 7-6 أو 6-7.')
          return
        }
      } else if (court.isSemiFinal) {
        // Semi-final: 9 games max, if 9-9 then tiebreak to 10-9
        // Valid scores: 0-9, 1-9, ..., 9-0, 9-1, ..., 9-8, 10-9, 9-10
        if (team1Games > 10 || team2Games > 10) {
          alert(language === 'en' 
            ? 'Semi-final: Maximum 10 games (9 games + tiebreak).'
            : 'نصف النهائي: الحد الأقصى 10 ألعاب (9 ألعاب + كسر التعادل).')
          return
        }
        if (team1Games === 9 && team2Games === 9) {
          // 9-9 is not valid - must play tiebreak to 10-9 or 9-10
          alert(language === 'en' 
            ? 'Semi-final: If tied at 9-9, play tiebreak. Winner must be 10-9 or 9-10.'
            : 'نصف النهائي: إذا كانت النتيجة 9-9، قم بلعب كسر التعادل. يجب أن يكون الفائز 10-9 أو 9-10.')
          return
        }
        // If score > 9, must be exactly 10-9 or 9-10
        if ((team1Games === 10 && team2Games !== 9) || (team2Games === 10 && team1Games !== 9)) {
          alert(language === 'en' 
            ? 'Semi-final: Tiebreak score must be 10-9 or 9-10.'
            : 'نصف النهائي: نتيجة كسر التعادل يجب أن تكون 10-9 أو 9-10.')
          return
        }
      } else if (court.isFinal) {
        // Final matches are handled by recordFinalSet, not recordMatchResult
        // This should not be reached, but if it is, return early
        return
      }
    }

    // Determine winner based on scores (or tie if equal)
    const isTie = team1Games === team2Games
    
    // Prevent ties in semi-finals and finals (knockout stages) - for King of Court
    if (activeTab === 'king' && isTie && (court.isSemiFinal || court.isFinal || court.isThirdPlace)) {
      alert(t.tiedScores + ' ' + (language === 'en' ? 'Please play a tiebreaker or enter different scores.' : 'يرجى لعب كسر التعادل أو إدخال نتائج مختلفة.'))
      return
    }
    
    // For social tournament, prevent ties in knockout stages (but not final - handled by recordFinalSet)
    if (activeTab === 'social' && isTie && (court.isSemiFinal || court.isThirdPlace)) {
      alert(language === 'en' 
        ? 'Ties are not allowed in knockout stages. Please enter different scores.'
        : 'التعادل غير مسموح في مراحل خروج المغلوب. يرجى إدخال نتائج مختلفة.')
      return
    }
    
    const winnerId = isTie ? null : (team1Games > team2Games ? court.team1.id : court.team2.id)
    const winner = isTie ? null : (winnerId === court.team1.id ? court.team1 : court.team2)
    const loser = isTie ? null : (winnerId === court.team1.id ? court.team2 : court.team1)

    // Update team stats
    const updatedTeams = teams.map(t => {
      if (isTie) {
        // Both teams get the same result for a tie
        if (t.id === court.team1.id) {
          return {
            ...t,
            draws: t.draws + 1,
            gamesWon: t.gamesWon + team1Games,
            gamesLost: t.gamesLost + team2Games,
            matchesPlayed: t.matchesPlayed + 1
          }
        } else if (t.id === court.team2.id) {
          return {
            ...t,
            draws: t.draws + 1,
            gamesWon: t.gamesWon + team2Games,
            gamesLost: t.gamesLost + team1Games,
            matchesPlayed: t.matchesPlayed + 1
          }
        }
      } else {
        // Normal win/loss
        if (t.id === winner.id) {
          const winnerGames = winnerId === court.team1.id ? team1Games : team2Games
          const loserGames = winnerId === court.team1.id ? team2Games : team1Games
          return {
            ...t,
            wins: t.wins + 1,
            gamesWon: t.gamesWon + winnerGames,
            gamesLost: t.gamesLost + loserGames,
            matchesPlayed: t.matchesPlayed + 1
          }
        } else if (t.id === loser.id) {
          const winnerGames = winnerId === court.team1.id ? team1Games : team2Games
          const loserGames = winnerId === court.team1.id ? team2Games : team1Games
          return {
            ...t,
            losses: t.losses + 1,
            gamesWon: t.gamesWon + loserGames,
            gamesLost: t.gamesLost + winnerGames,
            matchesPlayed: t.matchesPlayed + 1
          }
        }
      }
      return t
    })

    // Check for duplicate match before recording
    // For King of Court: prevent teams from playing each other more than once
    // For Social: allow same teams to play in different stages (group, semi, final)
    const isDuplicate = activeTab === 'king' 
      ? matches.some(m => {
          const matchTeam1Id = m.team1?.id
          const matchTeam2Id = m.team2?.id
          const courtTeam1Id = court.team1?.id
          const courtTeam2Id = court.team2?.id
          
          if (!matchTeam1Id || !matchTeam2Id || !courtTeam1Id || !courtTeam2Id) {
            return false
          }
          
          return (matchTeam1Id === courtTeam1Id && matchTeam2Id === courtTeam2Id) ||
                 (matchTeam1Id === courtTeam2Id && matchTeam2Id === courtTeam1Id)
        })
      : matches.some(m => {
          const matchTeam1Id = m.team1?.id
          const matchTeam2Id = m.team2?.id
          const courtTeam1Id = court.team1?.id
          const courtTeam2Id = court.team2?.id
          
          if (!matchTeam1Id || !matchTeam2Id || !courtTeam1Id || !courtTeam2Id) {
            return false
          }
          
          return ((matchTeam1Id === courtTeam1Id && matchTeam2Id === courtTeam2Id) ||
                  (matchTeam1Id === courtTeam2Id && matchTeam2Id === courtTeam1Id)) &&
                 m.groupId === court.groupId &&
                 m.isSemiFinal === court.isSemiFinal &&
                 m.isFinal === court.isFinal
        })
    
    if (isDuplicate) {
      console.warn('Duplicate match detected, skipping record', {
        court: {
          team1: court.team1?.name,
          team2: court.team2?.name,
          team1Id: court.team1?.id,
          team2Id: court.team2?.id
        },
        existingMatches: matches.filter(m => {
          if (activeTab === 'king') {
            return (m.team1?.id === court.team1?.id && m.team2?.id === court.team2?.id) ||
                   (m.team1?.id === court.team2?.id && m.team2?.id === court.team1?.id)
          } else {
            return ((m.team1?.id === court.team1?.id && m.team2?.id === court.team2?.id) ||
                    (m.team1?.id === court.team2?.id && m.team2?.id === court.team1?.id)) &&
                   m.groupId === court.groupId &&
                   m.isSemiFinal === court.isSemiFinal &&
                   m.isFinal === court.isFinal
          }
        })
      })
      alert(language === 'en' 
        ? 'This match has already been recorded. Please record a different match.' 
        : 'تم تسجيل هذه المباراة بالفعل. يرجى تسجيل مباراة مختلفة.')
      return // Prevent duplicate match from being recorded
    }
    
    // Record match (store before updating members to use match ID in history)
    const newMatch = {
      id: matches.length + 1,
      team1: court.team1,
      team2: court.team2,
      winner: winner,
      isTie: isTie,
      team1Games,
      team2Games,
      courtNumber: court.courtNumber,
      timestamp: Date.now(),
      groupId: court.groupId,
      isSemiFinal: court.isSemiFinal,
      semiNumber: court.semiNumber,
      isFinal: court.isFinal,
      isGroupStage: court.isGroupStage || false
    }
    const updatedMatches = [...matches, newMatch]
    
    // Save match to IndexedDB for historical records
    saveMatchToIndexedDB(newMatch, activeTab, effectiveTournamentId, currentClub?.id).then(() => {
      // Reload historical matches
      getAllMatchesFromIndexedDB(currentClub?.id).then(historical => {
        setHistoricalMatches(historical)
      })
    })

    // Update member statistics
    let updatedMembers = [...members]
    const team1MemberIds = court.team1.memberIds || []
    const team2MemberIds = court.team2.memberIds || []
    const allMemberIds = [...new Set([...team1MemberIds, ...team2MemberIds])] // Unique member IDs
    
    // Update members from both teams
    allMemberIds.forEach(memberId => {
      const memberIndex = updatedMembers.findIndex(m => m.id === memberId)
      if (memberIndex === -1) return
      
      const member = updatedMembers[memberIndex]
      const isTeam1 = team1MemberIds.includes(memberId)
      const isTeam2 = team2MemberIds.includes(memberId)
      
      // Determine if this member won, lost, or tied
      let memberWon = false
      let memberTied = false
      
      if (isTie) {
        memberTied = true
      } else if (isTeam1 && winnerId === court.team1.id) {
        memberWon = true
      } else if (isTeam2 && winnerId === court.team2.id) {
        memberWon = true
      }
      
      // Check if this is their first match in this tournament
      const isFirstMatchInTournament = member.lastTournamentId !== effectiveTournamentId
      
      // Determine match stage for points calculation
      let matchPoints = 0
      let matchStage = ''
      
      if (court.isFinal) {
        matchPoints = memberWon ? 30 : 0
        matchStage = 'final'
      } else if (court.isSemiFinal) {
        matchPoints = memberWon ? 20 : 0
        matchStage = 'semi'
      } else if (court.isGroupStage || activeTab === 'social') {
        matchPoints = memberWon ? 15 : 0
        matchStage = 'group'
      } else if (activeTab === 'king') {
        // For King of the Court, treat as group stage (15 points per win)
        matchPoints = memberWon ? 15 : 0
        matchStage = 'group'
      }
      
      const result = memberWon ? t.wins : memberTied ? t.draw : t.losses
      
      // Get opponent team name for history
      const opponentTeam = isTeam1 ? court.team2 : court.team1
      const teamName = isTeam1 ? court.team1.name : court.team2.name
      
      // Points history entries
      const historyEntries = []
      
      // If first match in tournament, award 20 points for joining
      let totalPointsToAdd = 0
      if (isFirstMatchInTournament) {
        const joinHistoryEntry = {
          id: Date.now() + Math.random() + 0.1,
          timestamp: Date.now(),
          matchId: null,
          team: teamName,
          opponent: null,
          result: 'Tournament Join',
          pointsEarned: 20,
          tournamentId: effectiveTournamentId,
          tournamentType: activeTab, // 'king' or 'social'
          stage: 'join'
        }
        historyEntries.push(joinHistoryEntry)
        totalPointsToAdd += 20
      }
      
      // Add match points history entry (only if points earned)
      if (matchPoints > 0) {
        const matchHistoryEntry = {
          id: Date.now() + Math.random(),
          timestamp: Date.now(),
          matchId: newMatch.id,
          team: teamName,
          opponent: opponentTeam.name,
          result: result,
          pointsEarned: matchPoints,
          tournamentId: effectiveTournamentId,
          tournamentType: activeTab, // 'king' or 'social'
          stage: matchStage
        }
        historyEntries.push(matchHistoryEntry)
        totalPointsToAdd += matchPoints
      } else if (!isFirstMatchInTournament) {
        // Still record the match even if no points (for history)
        const matchHistoryEntry = {
          id: Date.now() + Math.random(),
          timestamp: Date.now(),
          matchId: newMatch.id,
          team: teamName,
          opponent: opponentTeam.name,
          result: result,
          pointsEarned: 0,
          tournamentId: effectiveTournamentId,
          tournamentType: activeTab, // 'king' or 'social'
          stage: matchStage
        }
        historyEntries.push(matchHistoryEntry)
      }
      
      updatedMembers[memberIndex] = {
        ...member,
        totalGames: member.totalGames + 1,
        totalWins: memberWon ? member.totalWins + 1 : member.totalWins,
        totalLosses: (!memberWon && !memberTied) ? member.totalLosses + 1 : member.totalLosses,
        totalDraws: memberTied ? member.totalDraws + 1 : member.totalDraws,
        totalPoints: member.totalPoints + totalPointsToAdd,
        tournamentsPlayed: isFirstMatchInTournament ? member.tournamentsPlayed + 1 : member.tournamentsPlayed,
        lastTournamentId: effectiveTournamentId,
        tournamentsWon: member.tournamentsWon || 0, // Initialize if not present
        pointsHistory: [...(member.pointsHistory || []), ...historyEntries]
      }
    })

    // Handle social tournament logic
    if (activeTab === 'social') {
      if (court.isGroupStage) {
        // NEW LOGIC: Loser stays on court, plays with waiting team
        const updatedCourts = [...courts]
        const groupMatches = updatedMatches.filter(m => m.groupId === court.groupId)
        
        // Check if group has more matches
        const nextMatchData = getNextGroupMatch(court.groupId, updatedMatches, court)
        
        if (nextMatchData && nextMatchData.teams) {
          const nextMatch = nextMatchData.teams
          
          // If loser should stay in their position (second match)
          if (nextMatchData.keepLoserPosition && nextMatchData.loserWasTeam1 !== undefined) {
            // Loser stays in their position from first match
            if (nextMatchData.loserWasTeam1) {
              // Loser was team1, keep them as team1
              updatedCourts[courtIndex] = {
                ...court,
                team1: nextMatch[0], // loser
                team2: nextMatch[1], // waiting team
                winner: null
              }
            } else {
              // Loser was team2, keep them as team2
              updatedCourts[courtIndex] = {
                ...court,
                team1: nextMatch[1], // waiting team
                team2: nextMatch[0], // loser
                winner: null
              }
            }
          } else {
            // Normal match assignment (first or third match)
            updatedCourts[courtIndex] = {
              ...court,
              team1: nextMatch[0],
              team2: nextMatch[1],
              winner: null
            }
          }
          
          updateCurrentState(state => ({
            ...state,
            teams: updatedTeams,
            matches: updatedMatches,
            courts: updatedCourts
          }))
        } else {
          // Group stage complete for this court - clear it
          updatedCourts[courtIndex] = null
          updateCurrentState(state => ({
            ...state,
            teams: updatedTeams,
            matches: updatedMatches,
            courts: updatedCourts
          }))
          // Check if all groups are complete using updated matches
          checkAllGroupsComplete(updatedMatches)
        }
      } else if (court.isSemiFinal) {
        // Semi-final completed
        const updatedCourts = [...courts]
        updatedCourts[courtIndex] = null
        updateCurrentState(state => ({
          ...state,
          teams: updatedTeams,
          matches: updatedMatches,
          courts: updatedCourts
        }))
        // Check if both semi-finals are complete using updated matches
        setTimeout(() => {
          checkSemiFinalsComplete(updatedMatches)
        }, 0)
      } else if (court.isFinal) {
        // Final matches are handled by recordFinalSet, not recordMatchResult
        // This should not be reached
        return
      }
    } else {
      // King of the Court - winner stays, loser rotates
      const updatedCourts = [...courts]
      
      // Check if tournament is complete (all teams have played 7 matches)
      const allTeamsComplete = updatedTeams.every(team => {
        const teamMatches = updatedMatches.filter(m => 
          m.team1.id === team.id || m.team2.id === team.id
        )
        return teamMatches.length >= 7
      })
      
      if (allTeamsComplete) {
        // Tournament complete - award win and clear court
        const sortedStandings = [...updatedTeams].sort((a, b) => {
          if (b.wins !== a.wins) return b.wins - a.wins
          return b.gamesWon - a.gamesWon
        })
        const winningTeam = sortedStandings[0]
        if (winningTeam) {
          const winningTeamMemberIds = winningTeam.memberIds || []
          updatedMembers = updatedMembers.map(member => {
            if (winningTeamMemberIds.includes(member.id)) {
              return {
                ...member,
                tournamentsWon: (member.tournamentsWon || 0) + 1
              }
            }
            return member
          })
        }
        updatedCourts[courtIndex] = null
      } else {
        // King of the Court: Store winner on this court, then clear the court
        // The winner will stay when "Assign Matches" is clicked next time
        const courtWinners = currentState.courtWinners || {}
        if (winner && !isTie) {
          courtWinners[courtIndex] = winner.id
        } else {
          // If tie or no winner, remove the winner for this court
          delete courtWinners[courtIndex]
        }
        
        // Clear only this court after match is recorded (don't regenerate schedule)
        updatedCourts[courtIndex] = null
        
        // Update members state before updating other state
        setMembers(updatedMembers)
        
        // Update state without regenerating schedule
        // User will click "Assign Matches" to fill empty courts for next round
        updateCurrentState(state => ({
          ...state,
          teams: updatedTeams,
          matches: updatedMatches,
          courts: updatedCourts,
          courtWinners: courtWinners
        }))
        return // Exit early to avoid double update
      }
      
      // Update members state (for tournament complete case)
      setMembers(updatedMembers)
      
      // Update state without regenerating schedule
      // User will click "Assign Matches" to fill empty courts for next round
      updateCurrentState(state => ({
        ...state,
        teams: updatedTeams,
        matches: updatedMatches,
        courts: updatedCourts
      }))
    }

    // Stop timer (only for King of Court)
    if (activeTab === 'king') {
      const matchTimers = currentState.matchTimers || {}
      if (matchTimers[court.courtNumber]?.timerId) {
        clearInterval(matchTimers[court.courtNumber].timerId)
      }
      updateCurrentState(state => {
        const newTimers = { ...(state.matchTimers || {}) }
        delete newTimers[court.courtNumber]
        return { ...state, matchTimers: newTimers }
      })
    }
    
    // Update members state after all calculations
    setMembers(updatedMembers)
  }

  // Update an existing match and recalculate all related stats
  const updateMatch = (matchId, newTeam1Games, newTeam2Games) => {
    const matches = currentState.matches || []
    const teams = currentState.teams || []
    const oldMatch = matches.find(m => m.id === matchId)
    
    if (!oldMatch) {
      alert(language === 'en' ? 'Match not found' : 'لم يتم العثور على المباراة')
      return
    }

    // Validate scores for social tournament
    if (activeTab === 'social') {
      const maxScore = getMaxScoreForMatch(oldMatch)
      
      // Validate max scores
      if (newTeam1Games > maxScore || newTeam2Games > maxScore) {
        alert(language === 'en' 
          ? `Maximum score for this stage is ${maxScore}. Please enter valid scores.`
          : `الحد الأقصى للنتيجة في هذه المرحلة هو ${maxScore}. يرجى إدخال نتائج صحيحة.`)
        return
      }
      
      // Validate specific rules
      if (oldMatch.isGroupStage || oldMatch.groupId) {
        // Group stage: 6 games max, if 6-6 then tiebreak to 7-6
        // Valid scores: 0-6, 1-6, ..., 6-0, 6-1, ..., 6-5, 7-6, 6-7
        if (newTeam1Games > 7 || newTeam2Games > 7) {
          alert(language === 'en' 
            ? 'Group stage: Maximum 7 games (6 games + tiebreak).'
            : 'مرحلة المجموعات: الحد الأقصى 7 ألعاب (6 ألعاب + كسر التعادل).')
          return
        }
        if (newTeam1Games === 6 && newTeam2Games === 6) {
          // 6-6 is not valid - must play tiebreak to 7-6 or 6-7
          alert(language === 'en' 
            ? 'Group stage: If tied at 6-6, play tiebreak. Winner must be 7-6 or 6-7.'
            : 'مرحلة المجموعات: إذا كانت النتيجة 6-6، قم بلعب كسر التعادل. يجب أن يكون الفائز 7-6 أو 6-7.')
          return
        }
        // If score > 6, must be exactly 7-6 or 6-7
        if ((newTeam1Games === 7 && newTeam2Games !== 6) || (newTeam2Games === 7 && newTeam1Games !== 6)) {
          alert(language === 'en' 
            ? 'Group stage: Tiebreak score must be 7-6 or 6-7.'
            : 'مرحلة المجموعات: نتيجة كسر التعادل يجب أن تكون 7-6 أو 6-7.')
          return
        }
      } else if (oldMatch.isSemiFinal) {
        // Semi-final: 9 games max, if 9-9 then tiebreak to 10-9
        // Valid scores: 0-9, 1-9, ..., 9-0, 9-1, ..., 9-8, 10-9, 9-10
        if (newTeam1Games > 10 || newTeam2Games > 10) {
          alert(language === 'en' 
            ? 'Semi-final: Maximum 10 games (9 games + tiebreak).'
            : 'نصف النهائي: الحد الأقصى 10 ألعاب (9 ألعاب + كسر التعادل).')
          return
        }
        if (newTeam1Games === 9 && newTeam2Games === 9) {
          // 9-9 is not valid - must play tiebreak to 10-9 or 9-10
          alert(language === 'en' 
            ? 'Semi-final: If tied at 9-9, play tiebreak. Winner must be 10-9 or 9-10.'
            : 'نصف النهائي: إذا كانت النتيجة 9-9، قم بلعب كسر التعادل. يجب أن يكون الفائز 10-9 أو 9-10.')
          return
        }
        // If score > 9, must be exactly 10-9 or 9-10
        if ((newTeam1Games === 10 && newTeam2Games !== 9) || (newTeam2Games === 10 && newTeam1Games !== 9)) {
          alert(language === 'en' 
            ? 'Semi-final: Tiebreak score must be 10-9 or 9-10.'
            : 'نصف النهائي: نتيجة كسر التعادل يجب أن تكون 10-9 أو 9-10.')
          return
        }
      } else if (oldMatch.isFinal) {
        // Final matches should not be edited through updateMatch
        // They have a different structure with sets and tiebreak
        alert(language === 'en' 
          ? 'Final matches cannot be edited. They are recorded set by set.'
          : 'لا يمكن تعديل مباريات النهائي. يتم تسجيلها مجموعة تلو الأخرى.')
        return
      }
    }

    // Prevent ties in knockout stages (for King of Court)
    if (activeTab === 'king' && newTeam1Games === newTeam2Games && (oldMatch.isSemiFinal || oldMatch.isFinal || oldMatch.isThirdPlace)) {
      alert(t.tiedScores + ' ' + (language === 'en' ? 'Please play a tiebreaker or enter different scores.' : 'يرجى لعب كسر التعادل أو إدخال نتائج مختلفة.'))
      return
    }
    
    // For social tournament, prevent ties in knockout stages (but not final - handled differently)
    if (activeTab === 'social' && newTeam1Games === newTeam2Games && (oldMatch.isSemiFinal || oldMatch.isThirdPlace)) {
      alert(language === 'en' 
        ? 'Ties are not allowed in knockout stages. Please enter different scores.'
        : 'التعادل غير مسموح في مراحل خروج المغلوب. يرجى إدخال نتائج مختلفة.')
      return
    }

    // Determine new winner
    const newIsTie = newTeam1Games === newTeam2Games
    const newWinnerId = newIsTie ? null : (newTeam1Games > newTeam2Games ? oldMatch.team1.id : oldMatch.team2.id)
    const newWinner = newIsTie ? null : (newWinnerId === oldMatch.team1.id ? oldMatch.team1 : oldMatch.team2)
    const newLoser = newIsTie ? null : (newWinnerId === oldMatch.team1.id ? oldMatch.team2 : oldMatch.team1)

    // OLD MATCH DATA (to reverse)
    const oldIsTie = oldMatch.isTie
    const oldWinnerId = oldMatch.winner ? oldMatch.winner.id : null
    const oldTeam1Games = oldMatch.team1Games
    const oldTeam2Games = oldMatch.team2Games

    // Step 1: Reverse old match effects on teams
    let updatedTeams = teams.map(t => {
      if (t.id === oldMatch.team1.id) {
        // Reverse team1 stats
        if (oldIsTie) {
          return {
            ...t,
            draws: Math.max(0, t.draws - 1),
            gamesWon: Math.max(0, t.gamesWon - oldTeam1Games),
            gamesLost: Math.max(0, t.gamesLost - oldTeam2Games),
            matchesPlayed: Math.max(0, t.matchesPlayed - 1)
          }
        } else if (oldWinnerId === t.id) {
          return {
            ...t,
            wins: Math.max(0, t.wins - 1),
            gamesWon: Math.max(0, t.gamesWon - oldTeam1Games),
            gamesLost: Math.max(0, t.gamesLost - oldTeam2Games),
            matchesPlayed: Math.max(0, t.matchesPlayed - 1)
          }
        } else {
          return {
            ...t,
            losses: Math.max(0, t.losses - 1),
            gamesWon: Math.max(0, t.gamesWon - oldTeam1Games),
            gamesLost: Math.max(0, t.gamesLost - oldTeam2Games),
            matchesPlayed: Math.max(0, t.matchesPlayed - 1)
          }
        }
      } else if (t.id === oldMatch.team2.id) {
        // Reverse team2 stats
        if (oldIsTie) {
          return {
            ...t,
            draws: Math.max(0, t.draws - 1),
            gamesWon: Math.max(0, t.gamesWon - oldTeam2Games),
            gamesLost: Math.max(0, t.gamesLost - oldTeam1Games),
            matchesPlayed: Math.max(0, t.matchesPlayed - 1)
          }
        } else if (oldWinnerId === t.id) {
          return {
            ...t,
            wins: Math.max(0, t.wins - 1),
            gamesWon: Math.max(0, t.gamesWon - oldTeam2Games),
            gamesLost: Math.max(0, t.gamesLost - oldTeam1Games),
            matchesPlayed: Math.max(0, t.matchesPlayed - 1)
          }
        } else {
          return {
            ...t,
            losses: Math.max(0, t.losses - 1),
            gamesWon: Math.max(0, t.gamesWon - oldTeam2Games),
            gamesLost: Math.max(0, t.gamesLost - oldTeam1Games),
            matchesPlayed: Math.max(0, t.matchesPlayed - 1)
          }
        }
      }
      return t
    })

    // Step 2: Reverse old match effects on members
    let updatedMembers = [...members]
    const team1MemberIds = oldMatch.team1.memberIds || []
    const team2MemberIds = oldMatch.team2.memberIds || []
    const allMemberIds = [...new Set([...team1MemberIds, ...team2MemberIds])]

    allMemberIds.forEach(memberId => {
      const memberIndex = updatedMembers.findIndex(m => m.id === memberId)
      if (memberIndex === -1) return

      const member = updatedMembers[memberIndex]
      const isTeam1 = team1MemberIds.includes(memberId)
      const isTeam2 = team2MemberIds.includes(memberId)
      
      // Determine if this member won, lost, or tied in old match
      let memberWon = false
      let memberTied = false
      
      if (oldIsTie) {
        memberTied = true
      } else if (isTeam1 && oldWinnerId === oldMatch.team1.id) {
        memberWon = true
      } else if (isTeam2 && oldWinnerId === oldMatch.team2.id) {
        memberWon = true
      }

      // Find and remove points history entries for this match
      const matchHistoryEntries = (member.pointsHistory || []).filter(
        entry => entry.matchId === oldMatch.id
      )
      
      // Calculate points to remove
      let pointsToRemove = 0
      matchHistoryEntries.forEach(entry => {
        pointsToRemove += entry.pointsEarned || 0
      })

      // Remove history entries for this match
      const filteredHistory = (member.pointsHistory || []).filter(
        entry => entry.matchId !== oldMatch.id
      )

      // Reverse stats
      updatedMembers[memberIndex] = {
        ...member,
        totalGames: Math.max(0, member.totalGames - 1),
        totalWins: memberWon ? Math.max(0, member.totalWins - 1) : member.totalWins,
        totalLosses: (!memberWon && !memberTied) ? Math.max(0, member.totalLosses - 1) : member.totalLosses,
        totalDraws: memberTied ? Math.max(0, member.totalDraws - 1) : member.totalDraws,
        totalPoints: Math.max(0, member.totalPoints - pointsToRemove),
        pointsHistory: filteredHistory
      }
    })

    // Step 3: Update match with new scores
    const updatedMatch = {
      ...oldMatch,
      team1Games: newTeam1Games,
      team2Games: newTeam2Games,
      isTie: newIsTie,
      winner: newWinner,
      timestamp: Date.now() // Update timestamp
    }

    const updatedMatches = matches.map(m => m.id === matchId ? updatedMatch : m)

    // Step 4: Apply new match effects on teams
    updatedTeams = updatedTeams.map(t => {
      if (t.id === oldMatch.team1.id) {
        if (newIsTie) {
          return {
            ...t,
            draws: t.draws + 1,
            gamesWon: t.gamesWon + newTeam1Games,
            gamesLost: t.gamesLost + newTeam2Games,
            matchesPlayed: t.matchesPlayed + 1
          }
        } else if (newWinnerId === t.id) {
          return {
            ...t,
            wins: t.wins + 1,
            gamesWon: t.gamesWon + newTeam1Games,
            gamesLost: t.gamesLost + newTeam2Games,
            matchesPlayed: t.matchesPlayed + 1
          }
        } else {
          return {
            ...t,
            losses: t.losses + 1,
            gamesWon: t.gamesWon + newTeam1Games,
            gamesLost: t.gamesLost + newTeam2Games,
            matchesPlayed: t.matchesPlayed + 1
          }
        }
      } else if (t.id === oldMatch.team2.id) {
        if (newIsTie) {
          return {
            ...t,
            draws: t.draws + 1,
            gamesWon: t.gamesWon + newTeam2Games,
            gamesLost: t.gamesLost + newTeam1Games,
            matchesPlayed: t.matchesPlayed + 1
          }
        } else if (newWinnerId === t.id) {
          return {
            ...t,
            wins: t.wins + 1,
            gamesWon: t.gamesWon + newTeam2Games,
            gamesLost: t.gamesLost + newTeam1Games,
            matchesPlayed: t.matchesPlayed + 1
          }
        } else {
          return {
            ...t,
            losses: t.losses + 1,
            gamesWon: t.gamesWon + newTeam2Games,
            gamesLost: t.gamesLost + newTeam1Games,
            matchesPlayed: t.matchesPlayed + 1
          }
        }
      }
      return t
    })

    // Step 5: Apply new match effects on members
    allMemberIds.forEach(memberId => {
      const memberIndex = updatedMembers.findIndex(m => m.id === memberId)
      if (memberIndex === -1) return

      const member = updatedMembers[memberIndex]
      const isTeam1 = team1MemberIds.includes(memberId)
      const isTeam2 = team2MemberIds.includes(memberId)
      
      // Determine if this member won, lost, or tied in new match
      let memberWon = false
      let memberTied = false
      
      if (newIsTie) {
        memberTied = true
      } else if (isTeam1 && newWinnerId === oldMatch.team1.id) {
        memberWon = true
      } else if (isTeam2 && newWinnerId === oldMatch.team2.id) {
        memberWon = true
      }

      // Determine match stage for points calculation
      let matchPoints = 0
      let matchStage = ''
      
      if (oldMatch.isFinal) {
        matchPoints = memberWon ? 30 : 0
        matchStage = 'final'
      } else if (oldMatch.isSemiFinal) {
        matchPoints = memberWon ? 20 : 0
        matchStage = 'semi'
      } else if (oldMatch.isGroupStage || activeTab === 'social') {
        matchPoints = memberWon ? 15 : 0
        matchStage = 'group'
      } else if (activeTab === 'king') {
        matchPoints = memberWon ? 15 : 0
        matchStage = 'group'
      }

      const result = memberWon ? t.wins : memberTied ? t.draw : t.losses
      const opponentTeam = isTeam1 ? oldMatch.team2 : oldMatch.team1
      const teamName = isTeam1 ? oldMatch.team1.name : oldMatch.team2.name

      // Add match points history entry (only if points earned)
      const historyEntries = []
      if (matchPoints > 0) {
        const matchHistoryEntry = {
          id: Date.now() + Math.random(),
          timestamp: Date.now(),
          matchId: oldMatch.id,
          team: teamName,
          opponent: opponentTeam.name,
          result: result,
          pointsEarned: matchPoints,
          tournamentId: effectiveTournamentId,
          tournamentType: activeTab, // 'king' or 'social'
          stage: matchStage
        }
        historyEntries.push(matchHistoryEntry)
      } else if (!newIsTie) {
        // Still record the match even if no points (for history)
        const matchHistoryEntry = {
          id: Date.now() + Math.random(),
          timestamp: Date.now(),
          matchId: oldMatch.id,
          team: teamName,
          opponent: opponentTeam.name,
          result: result,
          pointsEarned: 0,
          tournamentId: effectiveTournamentId,
          tournamentType: activeTab, // 'king' or 'social'
          stage: matchStage
        }
        historyEntries.push(matchHistoryEntry)
      }

      updatedMembers[memberIndex] = {
        ...member,
        totalGames: member.totalGames + 1,
        totalWins: memberWon ? member.totalWins + 1 : member.totalWins,
        totalLosses: (!memberWon && !memberTied) ? member.totalLosses + 1 : member.totalLosses,
        totalDraws: memberTied ? member.totalDraws + 1 : member.totalDraws,
        totalPoints: member.totalPoints + matchPoints,
        pointsHistory: [...(member.pointsHistory || []), ...historyEntries]
      }
    })

    // Step 6: Update tournament wins if final match winner changed
    if (oldMatch.isFinal) {
      // Remove tournament win from old winner's members
      if (oldMatch.winner && oldMatch.winner.memberIds) {
        updatedMembers = updatedMembers.map(member => {
          if (oldMatch.winner.memberIds.includes(member.id)) {
            return {
              ...member,
              tournamentsWon: Math.max(0, (member.tournamentsWon || 0) - 1)
            }
          }
          return member
        })
      }
      
      // Add tournament win to new winner's members
      if (newWinner && newWinner.memberIds) {
        updatedMembers = updatedMembers.map(member => {
          if (newWinner.memberIds.includes(member.id)) {
            return {
              ...member,
              tournamentsWon: (member.tournamentsWon || 0) + 1
            }
          }
          return member
        })
      }
    }

    // Step 7: Update state
    updateCurrentState(state => ({
      ...state,
      teams: updatedTeams,
      matches: updatedMatches
    }))

    // Step 8: Update members
    setMembers(updatedMembers)

    // Step 9: Update match in IndexedDB
    saveMatchToIndexedDB(updatedMatch, activeTab, effectiveTournamentId, currentClub?.id).then(() => {
      getAllMatchesFromIndexedDB(currentClub?.id).then(historical => {
        setHistoricalMatches(historical)
      })
    })

    // Step 10: For social tournament, check if group qualifiers changed
    if (activeTab === 'social' && oldMatch.isGroupStage) {
      // Recheck group completion to see if qualifiers changed
      setTimeout(() => {
        checkAllGroupsComplete(updatedMatches)
      }, 0)
    }

    // Close edit modal
    setMatchToEdit(null)
  }

  // Calculate standings
  const getStandings = () => {
    const teams = currentState.teams || []
    const matches = currentState.matches || []
    
    // Calculate matchesPlayed from current matches array to avoid old data issues
    const standings = teams.map(team => {
      const teamMatches = matches.filter(m => 
        m.team1.id === team.id || m.team2.id === team.id
      )
      return {
        ...team,
        matchesPlayed: teamMatches.length
      }
    })
    
    return standings.sort((a, b) => {
      // First by wins
      if (b.wins !== a.wins) {
        return b.wins - a.wins
      }
      // Then by games won
      return b.gamesWon - a.gamesWon
    })
  }
  
  // Calculate standings for a specific group (Social)
  const getGroupStandings = (groupId) => {
    const groupStage = currentState.groupStage || {}
    const matches = currentState.matches || []
    const groupTeams = groupStage[groupId] || []
    if (groupTeams.length === 0) return []
    
    const groupMatches = matches.filter(m => m.groupId === groupId)
    
    const groupStandings = groupTeams.map(team => {
      const teamMatches = groupMatches.filter(m => 
        m.team1.id === team.id || m.team2.id === team.id
      )
      let wins = 0
      let losses = 0
      let draws = 0
      let gamesWon = 0
      let gamesLost = 0
      
      teamMatches.forEach(match => {
        const isTeam1 = match.team1.id === team.id
        
        // For final matches, count games from sets only (not tiebreak points)
        let teamGames, opponentGames
        if (match.isFinal && match.set1Team1Games !== undefined) {
          teamGames = isTeam1 
            ? (match.set1Team1Games + (match.set2Team1Games || 0))
            : (match.set1Team2Games + (match.set2Team2Games || 0))
          opponentGames = isTeam1
            ? (match.set1Team2Games + (match.set2Team2Games || 0))
            : (match.set1Team1Games + (match.set2Team1Games || 0))
        } else {
          teamGames = isTeam1 ? match.team1Games : match.team2Games
          opponentGames = isTeam1 ? match.team2Games : match.team1Games
        }
        
        gamesWon += teamGames
        gamesLost += opponentGames
        
        if (match.isTie) {
          draws++
        } else if (match.winner && match.winner.id === team.id) {
          wins++
        } else if (match.winner) {
          losses++
        }
      })
      
      return {
        ...team,
        wins,
        losses,
        draws,
        gamesWon,
        gamesLost,
        gamesDiff: gamesWon - gamesLost,
        matchesPlayed: teamMatches.length
      }
    })
    
    // Sort by wins, then games diff
    return groupStandings.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins
      return b.gamesDiff - a.gamesDiff
    })
  }

  // Load matches for a specific date and tournament type
  const loadOldTournamentMatches = async (date, tournamentType) => {
    try {
      // Get start and end of the selected date
      const selectedDateObj = new Date(date)
      const startOfDay = new Date(selectedDateObj)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(selectedDateObj)
      endOfDay.setHours(23, 59, 59, 999)
      
      // Get all matches for the date range
      const allMatches = await getMatchesByDateRange(startOfDay.getTime(), endOfDay.getTime())
      
      // Filter by tournament type
      const filteredMatches = allMatches.filter(match => match.tournamentType === tournamentType)
      
      setOldTournamentMatches(filteredMatches)
    } catch (error) {
      console.error('Error loading old tournament matches:', error)
      setOldTournamentMatches([])
    }
  }

  // Calculate standings from matches array
  const calculateStandingsFromMatches = (matches) => {
    const teamStats = {}
    
    matches.forEach(match => {
      // Process team1
      if (!teamStats[match.team1.id]) {
        teamStats[match.team1.id] = {
          id: match.team1.id,
          name: match.team1.name,
          wins: 0,
          losses: 0,
          draws: 0,
          gamesWon: 0,
          gamesLost: 0
        }
      }
      
      // Process team2
      if (!teamStats[match.team2.id]) {
        teamStats[match.team2.id] = {
          id: match.team2.id,
          name: match.team2.name,
          wins: 0,
          losses: 0,
          draws: 0,
          gamesWon: 0,
          gamesLost: 0
        }
      }
      
      const team1Stats = teamStats[match.team1.id]
      const team2Stats = teamStats[match.team2.id]
      
      // Add games (for final matches, use games from sets, not sets won)
      let team1Games, team2Games
      if (match.isFinal && match.set1Team1Games !== undefined) {
        team1Games = match.set1Team1Games + match.set2Team1Games
        team2Games = match.set1Team2Games + match.set2Team2Games
      } else {
        team1Games = match.team1Games
        team2Games = match.team2Games
      }
      
      team1Stats.gamesWon += team1Games
      team1Stats.gamesLost += team2Games
      team2Stats.gamesWon += team2Games
      team2Stats.gamesLost += team1Games
      
      // Add wins/losses/draws
      if (match.isTie) {
        team1Stats.draws++
        team2Stats.draws++
      } else if (match.winner) {
        if (match.winner.id === match.team1.id) {
          team1Stats.wins++
          team2Stats.losses++
        } else {
          team2Stats.wins++
          team1Stats.losses++
        }
      }
    })
    
    // Convert to array and sort
    const standings = Object.values(teamStats).sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins
      return (b.gamesWon - b.gamesLost) - (a.gamesWon - a.gamesLost)
    })
    
    return standings
  }

  // Load dates that have tournaments and calculate overall stats
  const loadDatesWithTournaments = async (tournamentType) => {
    try {
      const allMatches = await getAllMatchesFromIndexedDB(currentClub?.id)
      const datesSet = new Set()
      const datesArray = []
      
      // Get all unique dates that have matches of this tournament type
      const filteredMatches = allMatches.filter(match => match.tournamentType === tournamentType)
      
      filteredMatches.forEach(match => {
        const matchDate = new Date(match.savedAt || match.timestamp)
        const dateKey = `${matchDate.getFullYear()}-${String(matchDate.getMonth() + 1).padStart(2, '0')}-${String(matchDate.getDate()).padStart(2, '0')}`
        datesSet.add(dateKey)
        if (!datesArray.includes(dateKey)) {
          datesArray.push(dateKey)
        }
      })
      
      setDatesWithTournaments(datesSet)

      // Calculate overall statistics
      const teamsSet = new Set()
      let totalGames = 0
      const dates = datesArray.sort()
      
      filteredMatches.forEach(match => {
        if (match.team1?.id) teamsSet.add(match.team1.id)
        if (match.team2?.id) teamsSet.add(match.team2.id)
        
        let team1Games, team2Games
        if (match.isFinal && match.set1Team1Games !== undefined) {
          team1Games = match.set1Team1Games + match.set2Team1Games
          team2Games = match.set1Team2Games + match.set2Team2Games
        } else {
          team1Games = match.team1Games || 0
          team2Games = match.team2Games || 0
        }
        totalGames += team1Games + team2Games
      })

      setOverallTournamentStats({
        totalTournaments: dates.length,
        totalMatches: filteredMatches.length,
        totalTeams: teamsSet.size,
        totalGames: totalGames,
        lastTournamentDate: dates.length > 0 ? dates[dates.length - 1] : null,
        firstTournamentDate: dates.length > 0 ? dates[0] : null
      })
    } catch (error) {
      console.error('Error loading dates with tournaments:', error)
      setDatesWithTournaments(new Set())
      setOverallTournamentStats({
        totalTournaments: 0,
        totalMatches: 0,
        totalTeams: 0,
        totalGames: 0,
        lastTournamentDate: null,
        firstTournamentDate: null
      })
    }
  }

  // Handle date selection for old tournaments
  const handleDateSelect = async (date) => {
    setSelectedDate(date)
    setShowCalendar(false)
    if (date) {
      await loadOldTournamentMatches(date, oldTournamentTab)
    } else {
      setOldTournamentMatches([])
    }
  }

  // تحويل وقت HH:MM إلى دقائق من منتصف الليل (لمقارنة التداخل)
  const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0
    const [h, m] = String(timeStr).split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }

  // التحقق من تداخل وقت البطولة الجديدة مع أي بطولة مجدولة في نفس اليوم
  const hasTournamentTimeOverlap = (date, startTime, endTime) => {
    const newStart = timeToMinutes(startTime)
    const newEnd = timeToMinutes(endTime)
    if (newStart >= newEnd) return true // وقت غير صالح
    const sameDayTournaments = localBookings.filter(
      b => b.isTournament && b.date === date
    )
    for (const b of sameDayTournaments) {
      const existingStart = timeToMinutes(b.startTime)
      const existingEnd = timeToMinutes(b.endTime)
      // تداخل: الفترتان تتقاطعان إذا newStart < existingEnd && existingStart < newEnd
      if (newStart < existingEnd && existingStart < newEnd) return true
    }
    return false
  }

  // Handle tournament booking creation (king or social حسب النوع المختار عند فتح النافذة)
  const handleCreateTournamentBooking = () => {
    if (!tournamentBookingData.date || !tournamentBookingData.startTime || !tournamentBookingData.endTime) {
      alert(language === 'en' ? 'Please fill all fields' : 'يرجى ملء جميع الحقول')
      return
    }
    const open = currentClub?.settings?.openingTime
    const close = currentClub?.settings?.closingTime
    if (open && close) {
      const toMin = (t) => { const [h, m] = (t || '00:00').split(':').map(Number); return h * 60 + m }
      const startM = toMin(tournamentBookingData.startTime)
      const endM = toMin(tournamentBookingData.endTime)
      const openM = toMin(open)
      const closeM = toMin(close)
      if (startM < openM || endM > closeM) {
        alert(
          language === 'en'
            ? `Tournament must be within club hours (${open} – ${close}). Please choose a time within this range.`
            : `يجب أن تكون البطولة ضمن أوقات النادي (${open} – ${close}). يرجى اختيار وقت ضمن هذا النطاق.`
        )
        return
      }
    }
    if (hasTournamentTimeOverlap(tournamentBookingData.date, tournamentBookingData.startTime, tournamentBookingData.endTime)) {
      alert(language === 'en'
        ? 'This time overlaps with another scheduled tournament on the same day. Please choose a different time or date.'
        : 'هذا الوقت يتداخل مع بطولة مجدولة أخرى في نفس اليوم. اختر وقتاً أو تاريخاً مختلفاً.')
      return
    }
    const tournamentType = tournamentBookingData.tournamentType || 'king'
    const isSocial = tournamentType === 'social'
    const tournamentBooking = {
      id: `tournament_${Date.now()}`,
      date: tournamentBookingData.date,
      startTime: tournamentBookingData.startTime,
      endTime: tournamentBookingData.endTime,
      resource: isSocial ? (language === 'en' ? 'Social Tournament' : 'بطولة سوشيال') : (language === 'en' ? 'King of the Court' : 'ملك الملعب'),
      amount: '',
      participants: [],
      notes: isSocial ? (language === 'en' ? 'Social Tournament' : 'بطولة سوشيال') : (language === 'en' ? 'King of the Court Tournament' : 'بطولة ملك الملعب'),
      source: 'local',
      status: 'confirmed',
      isTournament: true,
      tournamentType,
      tournamentId: currentTournamentId
    }

    const updatedLocalBookings = [...localBookings, tournamentBooking]
    setLocalBookings(updatedLocalBookings)
    saveBookingsToClub(updatedLocalBookings)
    mergeBookings(updatedLocalBookings, playtomicBookings)
    setShowTournamentBookingModal(false)
    const today = new Date().toISOString().split('T')[0]
    setTournamentBookingData({
      date: today,
      startTime: currentClub?.settings?.openingTime || '09:00',
      endTime: currentClub?.settings?.closingTime || '18:00',
      tournamentType: activeTab === 'social' ? 'social' : 'king'
    })
    alert(language === 'en' 
      ? 'Tournament scheduled successfully! You can schedule more tournaments or start adding teams.'
      : 'تم جدولة البطولة بنجاح! يمكنك جدولة المزيد من البطولات أو البدء بإضافة الفرق.')
  }

  // Handle tournament deletion - delete by booking id (when called from list) or by date+type (legacy)
  const handleDeleteTournamentBooking = async (arg1, tournamentType) => {
    let updatedLocalBookings
    if (typeof arg1 === 'object' && arg1 !== null && arg1.id != null) {
      const bookingId = arg1.id
      const type = arg1.tournamentType || tournamentType || 'king'
      if (type === 'king') {
        setKingStateByTournamentId(prev => {
          const next = { ...prev }
          delete next[bookingId]
          return next
        })
      } else {
        setSocialStateByTournamentId(prev => {
          const next = { ...prev }
          delete next[bookingId]
          return next
        })
      }
      updatedLocalBookings = localBookings.filter(b => b.id !== bookingId)
      if (clubId && currentClub?.id) {
        const clubs = loadClubs()
        const club = clubs.find(c => c.id === clubId)
        if (club) {
          const acc = (club.accounting || []).filter(a => a.bookingId !== bookingId)
          saveClubs(clubs.map(c => c.id === clubId ? { ...c, accounting: acc } : c)).catch(e => console.error('saveClubs:', e)).catch(e => console.error('saveClubs:', e))
        }
      }
    } else {
      // Delete by date and type (legacy: removes all tournaments on that date with that type)
      const tournamentDate = arg1
      const toRemove = localBookings.filter(b => b.isTournament && b.tournamentType === tournamentType && b.date === tournamentDate)
      updatedLocalBookings = localBookings.filter(b => {
        if (b.isTournament && b.tournamentType === tournamentType && b.date === tournamentDate) {
          return false
        }
        return true
      })
      if (clubId && currentClub?.id && toRemove.length > 0) {
        const clubs = loadClubs()
        const club = clubs.find(c => c.id === clubId)
        if (club) {
          const removeIds = new Set(toRemove.map(b => b.id).filter(Boolean))
          const acc = (club.accounting || []).filter(a => !removeIds.has(a.bookingId))
          saveClubs(clubs.map(c => c.id === clubId ? { ...c, accounting: acc } : c)).catch(e => console.error('saveClubs:', e)).catch(e => console.error('saveClubs:', e))
        }
      }
    }
    setLocalBookings(updatedLocalBookings)
    saveBookingsToClub(updatedLocalBookings)
    mergeBookings(updatedLocalBookings, playtomicBookings)
  }

  // Delete old tournament by date and type (updated to also delete booking)
  const handleDeleteOldTournament = async () => {
    if (!selectedDate) return

    // Use the matches we already have loaded
    if (oldTournamentMatches.length === 0) {
      const errorMessage = language === 'en'
        ? 'No matches found to delete'
        : 'لم يتم العثور على مباريات للحذف'
      alert(errorMessage)
      return
    }

    const confirmMessage = language === 'en'
      ? `Are you sure you want to delete all ${oldTournamentMatches.length} match(es) for ${oldTournamentTab === 'king' ? 'King of the Court' : 'Social Tournament'} on ${selectedDate}? This action cannot be undone.`
      : `هل أنت متأكد من حذف جميع ${oldTournamentMatches.length} مباراة لـ ${oldTournamentTab === 'king' ? 'ملك الملعب' : 'بطولة سوشيال'} في ${selectedDate}؟ لا يمكن التراجع عن هذا الإجراء.`

    if (!window.confirm(confirmMessage)) {
      return
    }

    try {
      const db = await initIndexedDB()
      const transaction = db.transaction(['matches'], 'readwrite')
      const store = transaction.objectStore('matches')
      
      // Filter matches that have valid IDs
      const matchesWithIds = oldTournamentMatches.filter(match => match.id != null && match.id !== undefined)
      
      console.log('Matches to delete:', matchesWithIds.length, 'out of', oldTournamentMatches.length)
      console.log('Match IDs:', matchesWithIds.map(m => m.id))
      
      if (matchesWithIds.length === 0) {
        const errorMessage = language === 'en'
          ? 'No matches with valid IDs found to delete. Matches may not have been saved with IDs.'
          : 'لم يتم العثور على مباريات بصيغة صحيحة للحذف. قد لا تكون المباريات محفوظة بمعرفات.'
        alert(errorMessage)
        return
      }
      
      // Delete each match by ID
      const deletePromises = matchesWithIds.map(match => {
        return new Promise((resolve, reject) => {
          try {
            const request = store.delete(match.id)
            request.onsuccess = () => {
              console.log('Successfully deleted match:', match.id)
              resolve()
            }
            request.onerror = () => {
              console.error('Error deleting match:', match.id, request.error)
              // Don't reject, just log the error and continue
              resolve() // Resolve anyway to continue with other deletions
            }
          } catch (error) {
            console.error('Exception deleting match:', match.id, error)
            resolve() // Resolve anyway to continue
          }
        })
      })
      
      await Promise.all(deletePromises)
      const deletedCount = matchesWithIds.length
      
      // Also delete the tournament booking
      await handleDeleteTournamentBooking(selectedDate, oldTournamentTab)
      
      if (deletedCount > 0) {
        const successMessage = language === 'en'
          ? `Successfully deleted ${deletedCount} match(es) and tournament booking`
          : `تم حذف ${deletedCount} مباراة وحجز البطولة بنجاح`
        alert(successMessage)
        
        // Clear the selected date and matches
        setSelectedDate('')
        setOldTournamentMatches([])
        
        // Reload dates with tournaments to update the calendar
        await loadDatesWithTournaments(oldTournamentTab)
      } else {
        const errorMessage = language === 'en'
          ? 'No matches with valid IDs found to delete'
          : 'لم يتم العثور على مباريات بصيغة صحيحة للحذف'
        alert(errorMessage)
      }
    } catch (error) {
      console.error('Error deleting tournament:', error)
      const errorMessage = language === 'en'
        ? 'Error deleting tournament. Please try again.'
        : 'حدث خطأ أثناء حذف البطولة. يرجى المحاولة مرة أخرى.'
      alert(errorMessage)
    }
  }

  // Custom Calendar Component Functions
  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const formatDateKey = (date) => {
    if (typeof date === 'string') return date
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const isDateWithTournament = (date) => {
    const dateKey = formatDateKey(date)
    return datesWithTournaments.has(dateKey)
  }

  const isToday = (date) => {
    const today = new Date()
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear()
  }

  const isSelectedDate = (date) => {
    if (!selectedDate) return false
    const selected = new Date(selectedDate)
    return date.getDate() === selected.getDate() &&
           date.getMonth() === selected.getMonth() &&
           date.getFullYear() === selected.getFullYear()
  }

  const getCalendarDays = () => {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const daysInMonth = getDaysInMonth(calendarMonth)
    const firstDay = getFirstDayOfMonth(calendarMonth)
    const days = []

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(null)
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day))
    }

    return days
  }

  const navigateMonth = (direction) => {
    setCalendarMonth(prev => {
      const newDate = new Date(prev)
      newDate.setMonth(prev.getMonth() + direction)
      return newDate
    })
  }

  // Booking helper functions - respect club hours
  const getTimeSlots = () => {
    const open = currentClub?.settings?.openingTime
    const close = currentClub?.settings?.closingTime
    const slots = []
    if (!open || !close) {
      for (let hour = 0; hour < 24; hour++) {
        slots.push(`${hour.toString().padStart(2, '0')}:00`)
        slots.push(`${hour.toString().padStart(2, '0')}:30`)
      }
      return slots
    }
    const [openH, openM] = open.split(':').map(Number)
    const [closeH, closeM] = close.split(':').map(Number)
    const openMinutes = openH * 60 + openM
    const closeMinutes = closeH * 60 + closeM
    for (let m = openMinutes; m < closeMinutes; m += 30) {
      const h = Math.floor(m / 60) % 24
      const min = m % 60
      slots.push(`${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`)
    }
    return slots
  }

  const getDaysOfWeek = () => {
    // currentWeek now represents the first day being shown
    // Show N consecutive days starting from currentWeek
    const days = []
    for (let i = 0; i < selectedDays.length; i++) {
      const date = new Date(currentWeek)
      date.setDate(currentWeek.getDate() + i)
      days.push({ date, index: i })
    }
    return days
  }

  const toggleWeeklyViewDays = () => {
    // Cycle through: 7 -> 6 -> 5 -> 4 -> 3 -> 2 -> 1 -> 7
    const newCount = weeklyViewDays > 1 ? weeklyViewDays - 1 : 7
    setWeeklyViewDays(newCount)
    
    // Update selectedDays to show N consecutive days
    // Keep the same first day (currentWeek stays the same)
    setSelectedDays(Array.from({ length: newCount }, (_, i) => i))
  }

  const maximizeWeeklyView = () => {
    setWeeklyViewDays(7)
    setSelectedDays([0, 1, 2, 3, 4, 5, 6])
    // Keep currentWeek the same, just show more days
  }


  const getFontSizeForDays = (baseSize, daysCount) => {
    // Scale font size based on number of days: fewer days = larger font
    // Formula: baseSize * (7 / daysCount) with min and max limits
    const scaleFactor = 7 / daysCount
    const scaledSize = baseSize * scaleFactor
    // Clamp between baseSize and baseSize * 3 (allow more scaling for very few days)
    return Math.max(baseSize, Math.min(scaledSize, baseSize * 3))
  }

  const getBookingsForSlot = (day, timeSlot) => {
    // Only return bookings that START at this time slot (for merged cell rendering)
    return bookings.filter(booking => {
      const bookingDate = new Date(booking.date)
      const bookingDay = bookingDate.toDateString()
      const slotDay = day.toDateString()
      return bookingDay === slotDay && booking.startTime === timeSlot
    })
  }

  const getBookingsForCourtSlot = (court, timeSlot, date) => {
    // Only return bookings that START at this time slot for the specific court and date
    return bookings.filter(booking => {
      const bookingDate = new Date(booking.date)
      const bookingDay = bookingDate.toISOString().split('T')[0]
      const selectedDay = date
      return bookingDay === selectedDay && booking.resource === court && booking.startTime === timeSlot
    })
  }

  const getCourts = () => {
    const courts = currentClub?.courts?.filter(c => !c.maintenance) || []
    if (courts.length === 0) return ['Court 1', 'Court 2', 'Court 3', 'Court 4']
    return courts.map(c => c.name || c.nameAr || 'Court')
  }

  const getBookingRowSpan = (booking) => {
    // Calculate how many 30-minute slots the booking spans
    const startParts = booking.startTime.split(':')
    const endParts = booking.endTime.split(':')
    const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1])
    const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1])
    const duration = endMinutes - startMinutes
    return Math.max(1, duration / 30) // Each slot is 30 minutes
  }

  const getBookingMinHeight = (booking, baseHeight) => {
    // Calculate minimum height needed for participants
    // Header (court/date): ~12px, separator: ~4px, each participant: ~11px
    const participantCount = booking.participants ? booking.participants.length : 0
    if (participantCount === 0) return baseHeight
    
    const headerHeight = 12 // Court/date title
    const separatorHeight = 4 // Border and spacing
    const participantHeight = 11 // Each participant name (8.5px font + 1px margin + ~1.5px line-height)
    const padding = 6 // Top and bottom padding (3px each)
    const minContentHeight = headerHeight + separatorHeight + (participantCount * participantHeight) + padding
    
    return Math.max(baseHeight, minContentHeight)
  }

  const navigateCourtViewDate = (direction) => {
    // direction: 'prev' or 'next'
    const currentDate = new Date(selectedDateForCourtView)
    if (direction === 'prev') {
      currentDate.setDate(currentDate.getDate() - 1)
    } else {
      currentDate.setDate(currentDate.getDate() + 1)
    }
    setSelectedDateForCourtView(currentDate.toISOString().split('T')[0])
  }

  const handleGridMouseDown = (e, day, timeSlot) => {
    if (e.target.closest('.booking-event')) return // Don't start drag on existing booking
    const startCell = { day, timeSlot }
    // endCell: startCell so single tap/click opens modal (mobile + desktop)
    setDragSelection({ startCell, endCell: startCell, startTime: timeSlot, endTime: timeSlot })
  }

  const handleGridMouseMove = (e, day, timeSlot) => {
    if (!dragSelection || !dragSelection.startCell) return
    const startDay = dragSelection.startCell.day
    if (startDay.toDateString() !== day.toDateString()) return // Only allow same day selection
    
    setDragSelection(prev => ({
      ...prev,
      endCell: { day, timeSlot },
      endTime: timeSlot
    }))
  }

  const handleGridMouseUp = () => {
    if (dragSelection && dragSelection.startCell && dragSelection.endCell) {
      const startTime = dragSelection.startTime
      const endTime = dragSelection.endTime || dragSelection.startTime
      const date = dragSelection.startCell.day
      
      // Open booking modal with prefilled data
      const courts = getCourts()
      setBookingFormData({
        date: date.toISOString().split('T')[0],
        startTime: startTime,
        endTime: endTime,
        resource: courts[0] || 'Court 1',
        amount: '',
        participants: [],
        notes: ''
      })
      setShowBookingModal(true)
    }
    setDragSelection(null)
  }

  // Court view handlers
  const handleCourtGridMouseDown = (e, court, timeSlot, date) => {
    if (e.target.closest('.booking-event')) return
    const startCell = { court, timeSlot, date }
    // endCell: startCell so single tap/click opens modal (mobile + desktop)
    setDragSelection({ startCell, endCell: startCell, startTime: timeSlot, endTime: timeSlot })
  }

  const handleCourtGridMouseMove = (e, court, timeSlot, date) => {
    if (!dragSelection || !dragSelection.startCell) return
    const startCourt = dragSelection.startCell.court
    const startDate = dragSelection.startCell.date
    if (startCourt !== court || startDate !== date) return // Only allow same court and date selection
    
    setDragSelection(prev => ({
      ...prev,
      endCell: { court, timeSlot, date },
      endTime: timeSlot
    }))
  }

  const handleCourtGridMouseUp = () => {
    if (dragSelection && dragSelection.startCell && dragSelection.endCell) {
      const startTime = dragSelection.startTime
      const endTime = dragSelection.endTime || dragSelection.startTime
      const date = dragSelection.startCell.date
      const court = dragSelection.startCell.court
      
      // Open booking modal with prefilled data
      setBookingFormData({
        date: date,
        startTime: startTime,
        endTime: endTime,
        resource: court,
        amount: '',
        participants: [],
        notes: ''
      })
      setShowBookingModal(true)
    }
    setDragSelection(null)
  }

  const checkBookingConflict = (bookingData, excludeBookingId = null) => {
    const newStart = bookingData.startTime
    const newEnd = bookingData.endTime
    const newDate = bookingData.date
    const newCourt = bookingData.resource
    
    // Convert time strings to minutes for easier comparison
    const timeToMinutes = (timeStr) => {
      const [hours, minutes] = timeStr.split(':').map(Number)
      return hours * 60 + minutes
    }
    
    const newStartMinutes = timeToMinutes(newStart)
    const newEndMinutes = timeToMinutes(newEnd)
    
    // Check for conflicts with existing bookings
    const conflict = bookings.find(existing => {
      // Skip the booking being edited
      if (excludeBookingId && existing.id === excludeBookingId) return false
      
      // Must be same court and same date
      if (existing.resource !== newCourt || existing.date !== newDate) return false
      
      const existingStartMinutes = timeToMinutes(existing.startTime)
      const existingEndMinutes = timeToMinutes(existing.endTime)
      
      // Check if times overlap
      // New booking overlaps if it starts before existing ends AND ends after existing starts
      return newStartMinutes < existingEndMinutes && newEndMinutes > existingStartMinutes
    })
    
    return conflict
  }

  const saveBooking = (bookingData) => {
    // Don't allow editing Playtomic bookings directly (read-only)
    if (bookingData.id && bookingData.id.toString().startsWith('playtomic_')) {
      alert(
        language === 'en'
          ? 'Playtomic bookings are read-only. Please contact Playtomic to modify this booking.'
          : 'حجوزات Playtomic للقراءة فقط. يرجى الاتصال بـ Playtomic لتعديل هذا الحجز.'
      )
      return
    }

    // Validate booking is within club hours
    const open = currentClub?.settings?.openingTime
    const close = currentClub?.settings?.closingTime
    if (open && close) {
      const toMin = (t) => { const [h, m] = (t || '00:00').split(':').map(Number); return h * 60 + m }
      const startM = toMin(bookingData.startTime)
      const endM = toMin(bookingData.endTime)
      const openM = toMin(open)
      const closeM = toMin(close)
      if (startM < openM || endM > closeM) {
        alert(
          language === 'en'
            ? `Booking must be within club hours (${open} – ${close}). Please choose a time within this range.`
            : `يجب أن يكون الحجز ضمن أوقات النادي (${open} – ${close}). يرجى اختيار وقت ضمن هذا النطاق.`
        )
        return
      }
    }

    // Check for conflicts (excluding the current booking if editing)
    const conflict = checkBookingConflict(bookingData, bookingData.id || null)
    
    if (conflict) {
      const conflictStart = conflict.startTime
      const conflictEnd = conflict.endTime
      alert(
        language === 'en' 
          ? `Booking conflict! There is already a booking on ${conflict.resource} from ${conflictStart} to ${conflictEnd}. Please choose a different time or court.`
          : `تعارض في الحجز! يوجد بالفعل حجز على ${conflict.resource} من ${conflictStart} إلى ${conflictEnd}. يرجى اختيار وقت أو ملعب مختلف.`
      )
      return
    }
    
    let updatedLocalBookings
    if (bookingData.id && bookingData.id > 0 && !bookingData.id.toString().startsWith('playtomic_')) {
      // Update existing local booking by ID
      updatedLocalBookings = localBookings.map(b => 
        b.id === bookingData.id ? { ...bookingData, id: bookingData.id, source: 'local' } : b
      )
    } else {
      // Create new local booking
      const existingIds = localBookings
        .filter(b => b.id != null && b.id > 0 && !b.id.toString().startsWith('playtomic_'))
        .map(b => b.id)
      const nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1
      const newBooking = {
        ...bookingData,
        id: nextId,
        source: 'local',
        status: 'confirmed' // Default status
      }
      updatedLocalBookings = [...localBookings, newBooking]
    }
    
    // Clean up: Ensure all bookings in the updated array have IDs
    let maxId = 0
    updatedLocalBookings = updatedLocalBookings.map(b => {
      if (b.id && b.id > 0 && !b.id.toString().startsWith('playtomic_')) {
        maxId = Math.max(maxId, b.id)
        return { ...b, source: 'local' }
      } else {
        // Assign ID to any booking that still doesn't have one
        maxId += 1
        return { ...b, id: maxId, status: b.status || 'confirmed', source: 'local' }
      }
    })
    
    setLocalBookings(updatedLocalBookings)
    saveBookingsToClub(updatedLocalBookings)
    mergeBookings(updatedLocalBookings, playtomicBookings)
    // Sync accounting: add/update invoice for this booking
    if (currentClub?.id && clubId) {
      const clubs = loadClubs()
      const club = clubs.find(c => c.id === clubId)
      if (club) {
        const savedBooking = updatedLocalBookings.find(b => 
          (bookingData.id && b.id === bookingData.id) ||
          (b.date === bookingData.date && b.startTime === bookingData.startTime && b.resource === bookingData.resource)
        )
        const bookingId = savedBooking?.id || bookingData.id
        if (bookingId) {
          const amount = parseFloat(bookingData.amount) || 0
          const desc = `${bookingData.resource || 'Court'} - ${bookingData.date || ''} ${(bookingData.startTime || '')}-${(bookingData.endTime || '')}`.trim()
          const acc = club.accounting || []
          const without = acc.filter(a => a.bookingId !== bookingId)
          const entry = {
            id: `acc-${bookingId}`,
            bookingId,
            date: bookingData.date || new Date().toISOString().split('T')[0],
            description: desc || 'Booking',
            amount,
            type: 'revenue',
            status: amount > 0 ? 'pending' : 'n/a'
          }
          saveClubs(clubs.map(c => c.id === clubId ? { ...c, accounting: [...without, entry] } : c)).catch(e => console.error('saveClubs:', e))
        }
      }
    }
    setShowBookingModal(false)
    setBookingFormData(null)
  }

  const deleteBookingAndInvoice = (bookingId) => {
    if (!bookingId) return
    const updatedLocalBookings = localBookings.filter(b => b.id !== bookingId)
    setLocalBookings(updatedLocalBookings)
    saveBookingsToClub(updatedLocalBookings)
    mergeBookings(updatedLocalBookings, playtomicBookings)
    if (currentClub?.id && clubId) {
      const clubs = loadClubs()
      const club = clubs.find(c => c.id === clubId)
      if (club) {
        const acc = (club.accounting || []).filter(a => a.bookingId !== bookingId)
        saveClubs(clubs.map(c => c.id === clubId ? { ...c, accounting: acc } : c)).catch(e => console.error('saveClubs:', e))
      }
    }
    setShowBookingModal(false)
    setBookingFormData(null)
  }

  const getPaymentStatus = (booking) => {
    if (!booking.amount || booking.amount === '' || parseFloat(booking.amount) === 0) {
      return 'not_paid' // No amount set = not paid
    }
    
    const totalAmount = parseFloat(booking.amount) || 0
    if (totalAmount === 0) return 'not_paid'
    
    // Calculate total paid from participants (only count those marked as paid)
    const totalPaid = (booking.participants || []).reduce((sum, p) => {
      const participant = typeof p === 'object' ? p : { amount: '', paid: false }
      // Only count amount if participant is marked as paid
      if (participant.paid) {
        return sum + (parseFloat(participant.amount) || 0)
      }
      return sum
    }, 0)
    
    if (totalPaid === 0) return 'not_paid'
    if (totalPaid >= totalAmount) return 'paid'
    return 'partially_paid'
  }

  const getBookingColor = (booking) => {
    // Playtomic bookings have a distinct border/background
    const isPlaytomic = booking.source === 'playtomic' || booking.id?.toString().startsWith('playtomic_')
    
    const paymentStatus = getPaymentStatus(booking)
    let baseColor
    switch (paymentStatus) {
      case 'paid':
        baseColor = '#d4edda' // Green
        break
      case 'partially_paid':
        baseColor = '#fff3cd' // Yellow
        break
      case 'not_paid':
        baseColor = '#f8d7da' // Red
        break
      default:
        baseColor = '#d4edda' // Default green
    }
    
    // Add Playtomic indicator (lighter shade with border)
    if (isPlaytomic) {
      return baseColor // Keep same color but we'll add border in CSS
    }
    
    return baseColor
  }

  // Accounting helper functions
  const getFilteredBookings = () => {
    let filtered = [...bookings]
    
    // Filter by date range
    if (accountingDateFrom) {
      filtered = filtered.filter(b => b.date >= accountingDateFrom)
    }
    if (accountingDateTo) {
      filtered = filtered.filter(b => b.date <= accountingDateTo)
    }
    
    // Filter by payment status
    if (accountingStatusFilter !== 'all') {
      filtered = filtered.filter(b => getPaymentStatus(b) === accountingStatusFilter)
    }
    
    // Filter by court
    if (accountingCourtFilter !== 'all') {
      filtered = filtered.filter(b => b.resource === accountingCourtFilter)
    }
    
    return filtered
  }

  const calculateTotalPaid = (booking) => {
    if (!booking || !booking.participants) return 0
    return (booking.participants || []).reduce((sum, p) => {
      const participant = typeof p === 'object' ? p : { amount: '', paid: false }
      return participant.paid ? sum + (parseFloat(participant.amount) || 0) : sum
    }, 0)
  }

  const formatBookingDate = (dateString, lang) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString(lang === 'en' ? 'en-US' : 'ar-SA', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  const formatBookingTime = (timeString) => {
    if (!timeString) return ''
    return timeString
  }

  const getPaymentStatusLabel = (status, lang) => {
    if (lang === 'ar') {
      switch (status) {
        case 'paid': return t.paid
        case 'partially_paid': return t.partiallyPaid
        case 'not_paid': return t.notPaid
        default: return t.notPaid
      }
    } else {
      switch (status) {
        case 'paid': return t.paid
        case 'partially_paid': return t.partiallyPaid
        case 'not_paid': return t.notPaid
        default: return t.notPaid
      }
    }
  }

  const getAccountingStatistics = () => {
    const filtered = getFilteredBookings()
    let totalIncome = 0
    let totalPaid = 0
    let totalPending = 0
    let totalUnpaid = 0
    
    filtered.forEach(booking => {
      const amount = parseFloat(booking.amount) || 0
      totalIncome += amount
      
      const paidAmount = calculateTotalPaid(booking)
      totalPaid += paidAmount
      const remaining = amount - paidAmount
      
      if (paidAmount >= amount && amount > 0) {
        // Fully paid
      } else if (paidAmount > 0) {
        totalPending += remaining
      } else {
        totalUnpaid += amount
      }
    })
    
    return { totalIncome, totalPaid, totalPending, totalUnpaid }
  }

  const exportAccountingReport = () => {
    const filtered = getFilteredBookings()
    const stats = getAccountingStatistics()
    
    let csv = `${language === 'en' ? 'Accounting Report' : 'تقرير المحاسبة'}\n`
    csv += `${language === 'en' ? 'Generated' : 'تم الإنشاء'}: ${new Date().toLocaleString(language === 'en' ? 'en-US' : 'ar-SA')}\n\n`
    
    csv += `${language === 'en' ? 'Summary' : 'ملخص'}\n`
    csv += `${language === 'en' ? 'Total Income' : 'إجمالي الدخل'}: ${stats.totalIncome}\n`
    csv += `${language === 'en' ? 'Total Paid' : 'إجمالي المدفوع'}: ${stats.totalPaid}\n`
    csv += `${language === 'en' ? 'Total Pending' : 'إجمالي المعلق'}: ${stats.totalPending}\n`
    csv += `${language === 'en' ? 'Total Unpaid' : 'إجمالي غير المدفوع'}: ${stats.totalUnpaid}\n\n`
    
    csv += `${language === 'en' ? 'Payment Details' : 'تفاصيل المدفوعات'}\n`
    csv += `${language === 'en' ? 'Date' : 'التاريخ'},${language === 'en' ? 'Time' : 'الوقت'},${language === 'en' ? 'Court' : 'الملعب'},${language === 'en' ? 'Total Amount' : 'المبلغ الإجمالي'},${language === 'en' ? 'Paid Amount' : 'المبلغ المدفوع'},${language === 'en' ? 'Remaining' : 'المتبقي'},${language === 'en' ? 'Status' : 'الحالة'},${language === 'en' ? 'Participants' : 'المشاركون'}\n`
    
    filtered.forEach(booking => {
      const amount = parseFloat(booking.amount) || 0
      const paidAmount = (booking.participants || []).reduce((sum, p) => {
        const participant = typeof p === 'object' ? p : { amount: '', paid: false }
        return participant.paid ? sum + (parseFloat(participant.amount) || 0) : sum
      }, 0)
      const remaining = amount - paidAmount
      const status = getPaymentStatus(booking)
      const statusLabel = status === 'paid' ? (language === 'en' ? 'Paid' : 'مدفوع') 
        : status === 'partially_paid' ? (language === 'en' ? 'Partially Paid' : 'مدفوع جزئياً')
        : (language === 'en' ? 'Not Paid' : 'غير مدفوع')
      
      const participants = (booking.participants || []).map(p => {
        const participant = typeof p === 'object' ? p : { name: p, id: null }
        return participant.name || p
      }).join('; ')
      
      csv += `${booking.date},${booking.startTime}-${booking.endTime},${booking.resource},${amount},${paidAmount},${remaining},${statusLabel},"${participants}"\n`
    })
    
    // Create download link
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `accounting-report-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Bookings are loaded from club.bookings (DB) in loadSavedData

  // Merge local and Playtomic bookings
  const saveBookingsToClub = (bookings) => {
    if (!clubId) return
    const clubs = loadClubs()
    const club = clubs.find(c => c.id === clubId)
    if (club) {
      club.bookings = Array.isArray(bookings) ? bookings : []
      saveClubs(clubs).catch(e => console.error('saveClubs:', e))
    }
  }

  const mergeBookings = (local, playtomic) => {
    // Combine both arrays, Playtomic bookings take priority for conflicts
    const merged = [...local, ...playtomic]
    // Remove duplicates: use unique id for tournament bookings so multiple tournaments are kept; for others use date+time+resource
    const unique = merged.reduce((acc, booking) => {
      const key = (booking.isTournament && booking.id) ? String(booking.id) : `${booking.date}_${booking.startTime}_${booking.resource}`
      if (!acc.has(key)) {
        acc.set(key, booking)
      } else {
        // If duplicate, prefer Playtomic booking (for non-tournament only; tournaments are keyed by id)
        if (booking.source === 'playtomic') {
          acc.set(key, booking)
        }
      }
      return acc
    }, new Map())
    
    setBookings(Array.from(unique.values()))
  }

  // Load bookings from Playtomic API
  const loadPlaytomicBookings = async (forceRefresh = false) => {
    if (isLoadingPlaytomic && !forceRefresh) return
    
    setIsLoadingPlaytomic(true)
    try {
      // Calculate date range (current week ± 1 week)
      const today = new Date()
      const startDate = new Date(today)
      startDate.setDate(today.getDate() - 7) // 1 week ago
      const endDate = new Date(today)
      endDate.setDate(today.getDate() + 14) // 2 weeks ahead
      
      const startDateStr = startDate.toISOString().split('T')[0]
      const endDateStr = endDate.toISOString().split('T')[0]
      
      const playtomicData = await playtomicApi.getBookings(startDateStr, endDateStr)
      
      setPlaytomicBookings(playtomicData)
      setPlaytomicLastSync(new Date())
      
      // Merge with local bookings
      mergeBookings(localBookings, playtomicData)
      
      console.log(`Loaded ${playtomicData.length} bookings from Playtomic`)
    } catch (error) {
      console.error('Error loading Playtomic bookings:', error)
      alert(
        language === 'en'
          ? `Error loading bookings from Playtomic: ${error.message}`
          : `خطأ في تحميل الحجوزات من Playtomic: ${error.message}`
      )
    } finally {
      setIsLoadingPlaytomic(false)
    }
  }

  // Load Playtomic bookings when bookings tab is opened
  useEffect(() => {
    if (activeTab === 'bookings' && playtomicBookings.length === 0) {
      loadPlaytomicBookings()
    }
  }, [activeTab])

  // Update merged bookings when local or Playtomic bookings change
  useEffect(() => {
    mergeBookings(localBookings, playtomicBookings)
  }, [localBookings, playtomicBookings])

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Get remaining time
  const getRemainingTime = (courtNumber) => {
    const matchTimers = currentState.matchTimers || {}
    const timer = matchTimers[courtNumber]
    if (!timer) return '15:00'
    const remaining = 900 - timer.elapsed
    if (remaining <= 0) return t.timeUp
    return formatTime(remaining)
  }

    // Get max score for social tournament based on stage
  const getMaxScoreForSocialTournament = (court) => {
    if (!court) return 6
    if (court.isFinal) {
      // For final, check which set is being recorded
      if (court.currentSet === 'tiebreak') return 7 // Tiebreak out of 7 points
      return 6 // Each set out of 6 games
    }
    if (court.isSemiFinal) return 10 // 9 games + tiebreak
    if (court.isGroupStage || court.groupId) return 7 // 6 games + tiebreak
    return 6 // Default
  }

  // Get max score for a match (used in edit modal)
  const getMaxScoreForMatch = (match) => {
    if (activeTab === 'social') {
      if (match.isFinal) return 2
      if (match.isSemiFinal) return 10
      if (match.isGroupStage || match.groupId) return 7
      return 6
    }
    return 6 // King of Court default
  }

  // Format match score for display (handles final matches differently)
  const formatMatchScore = (match) => {
    if (match.isFinal && match.set1Team1Games !== undefined) {
      // For final matches, show sets won (e.g., "2-1")
      const team1Sets = match.team1SetsWon !== undefined ? match.team1SetsWon : match.team1Games
      const team2Sets = match.team2SetsWon !== undefined ? match.team2SetsWon : match.team2Games
      return `${team1Sets} - ${team2Sets}`
    }
    // For other matches, show games
    return `${match.team1Games} - ${match.team2Games}`
  }

  const standings = getStandings()
  const teams = currentState.teams || []
  const matches = currentState.matches || []
  const courts = currentState.courts || [null, null, null, null]
  const groupStage = currentState.groupStage || {}
  const tournamentStage = currentState.tournamentStage || 'group'
  const showMatchHistory = currentState.showMatchHistory || false
  const showMatchSchedule = currentState.showMatchSchedule || false

  // Show loading state while club is being loaded
  if (isLoadingClub || !currentClub) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{ fontSize: '18px', color: '#666' }}>
          {language === 'en' ? 'Loading club data...' : 'جاري تحميل بيانات النادي...'}
        </div>
        <div style={{ fontSize: '14px', color: '#999' }}>
          {clubId ? `Club ID: ${clubId}` : 'No club ID provided'}
        </div>
      </div>
    )
  }

  return (
    <div className={`app ${isRTL ? 'rtl' : ''} ${sidebarOpen ? 'sidebar-open' : ''}`}>
      {/* Mobile backdrop */}
      <div
        className="app-sidebar-backdrop"
        aria-hidden={!sidebarOpen}
        onClick={() => setSidebarOpen(false)}
      />
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <button
              type="button"
              className="app-menu-toggle"
              onClick={() => setSidebarOpen(true)}
              aria-label={language === 'en' ? 'Open menu' : 'فتح القائمة'}
            >
              <span /><span /><span />
            </button>
            <div className="logo">
              {currentClub?.logo && <img src={currentClub.logo} alt="" className="app-header-club-logo" />}
              {currentClub 
                ? (language === 'en' ? currentClub.name : currentClub.nameAr || currentClub.name)
                : (language === 'en' ? 'Padel Tournament' : 'بطولة البادل')
              }
            </div>
          </div>
          <div className="header-center">
            <div className="header-title">
              {activeTab === 'king' ? t.kingOfCourt : activeTab === 'social' ? t.socialTournament : activeTab === 'members' ? t.members : activeTab === 'bookings' ? t.bookings : activeTab === 'accounting' ? t.accounting : t.oldTournaments}
            </div>
          </div>
          <div className="header-right">
            {(activeTab === 'king' || activeTab === 'social') && viewedTournamentBooking && (
              <>
                <button 
                  className="btn-secondary btn-small"
                  onClick={() => setShowResetConfirm(true)}
                  style={{ marginRight: '10px' }}
                >
                  {t.resetTournament}
                </button>
                <button 
                  className="btn-danger btn-small"
                  onClick={() => setShowDeleteConfirm(true)}
                  style={{ marginRight: '10px' }}
                >
                  {language === 'en' ? 'Delete Tournament' : 'حذف البطولة'}
                </button>
              </>
            )}
            <button 
              className="language-toggle-btn"
              onClick={toggleLanguage}
              title={language === 'en' ? 'العربية' : 'English'}
            >
              <LanguageIcon lang={language === 'en' ? 'ar' : 'en'} size={18} />
            </button>
          </div>
        </div>
      </header>

      {currentClub?.status === 'pending' && getClubAdminSession()?.clubId === clubId && (
        <div className="app-pending-banner" role="status">
          <span className="app-pending-icon">⏳</span>
          <div className="app-pending-content">
            <strong>{language === 'en' ? 'Club pending approval' : 'النادي بانتظار الموافقة'}</strong>
            <p>{language === 'en' ? 'Your registration is under review. You can explore and prepare your club. Full access will be enabled once approved.' : 'تسجيل ناديك قيد المراجعة. يمكنك الاستكشاف وإعداد النادي. سيتم تفعيل الوصول الكامل بعد الموافقة.'}</p>
          </div>
        </div>
      )}

      {/* نافذة جدولة البطولة - أعلى الصفحة لضمان الظهور */}
      {showTournamentBookingModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowTournamentBookingModal(false)
          }}
          style={{
            zIndex: 999999,
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100vw',
            height: '100vh',
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '500px',
              width: '90%',
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '24px',
              position: 'relative',
              zIndex: 1000000,
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              margin: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #eee', paddingBottom: '12px' }}>
              <h2 style={{ margin: 0, fontSize: '22px', color: '#1e3a5f' }}>{language === 'en' ? 'Schedule Tournament' : 'جدولة البطولة'}</h2>
              <button type="button" onClick={() => setShowTournamentBookingModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', padding: '0 8px' }} aria-label="Close">✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>{language === 'en' ? 'Date' : 'التاريخ'} *</label>
                <input
                  type="date"
                  value={tournamentBookingData.date}
                  onChange={(e) => setTournamentBookingData({ ...tournamentBookingData, date: e.target.value })}
                  required
                  min={new Date().toISOString().split('T')[0]}
                  style={{ width: '100%', padding: '10px', border: '2px solid #ddd', borderRadius: '6px', fontSize: '16px' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>{language === 'en' ? 'Start Time' : 'وقت البداية'} *</label>
                <input
                  type="time"
                  value={tournamentBookingData.startTime}
                  min={currentClub?.settings?.openingTime}
                  max={currentClub?.settings?.closingTime}
                  onChange={(e) => setTournamentBookingData({ ...tournamentBookingData, startTime: e.target.value })}
                  required
                  style={{ width: '100%', padding: '10px', border: '2px solid #ddd', borderRadius: '6px', fontSize: '16px' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>{language === 'en' ? 'End Time' : 'وقت النهاية'} *</label>
                <input
                  type="time"
                  value={tournamentBookingData.endTime}
                  min={currentClub?.settings?.openingTime}
                  max={currentClub?.settings?.closingTime}
                  onChange={(e) => setTournamentBookingData({ ...tournamentBookingData, endTime: e.target.value })}
                  required
                  style={{ width: '100%', padding: '10px', border: '2px solid #ddd', borderRadius: '6px', fontSize: '16px' }}
                />
              </div>
              {/* نوع البطولة ثابت حسب التبويب (ملك الملعب أو بطولة سوشيال) */}
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>{language === 'en' ? 'Tournament Type' : 'نوع البطولة'}</label>
                <div style={{ width: '100%', padding: '12px 14px', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '16px', background: '#f8fafc', color: '#1e3a5f', fontWeight: '600' }}>
                  {tournamentBookingData.tournamentType === 'social' ? (language === 'en' ? 'Social Tournament' : 'بطولة سوشيال') : (language === 'en' ? 'King of the Court' : 'ملك الملعب')}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px', paddingTop: '16px', borderTop: '2px solid #eee' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowTournamentBookingModal(false)}>{t.cancel}</button>
              <button type="button" className="btn-primary" onClick={handleCreateTournamentBooking}>{language === 'en' ? 'Schedule' : 'جدولة'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="app-layout">
        {/* Sidebar with Tabs */}
        <aside className="sidebar" aria-hidden={!sidebarOpen}>
            <button
              type="button"
              className="sidebar-close"
              onClick={() => setSidebarOpen(false)}
              aria-label={language === 'en' ? 'Close menu' : 'إغلاق القائمة'}
            >
              ✕
            </button>
          <div className="sidebar-section">
            <div className="sidebar-tabs">
              <button
                className={`sidebar-tab ${activeTab === 'king' ? 'active' : ''}`}
                onClick={() => { switchTab('king'); setSidebarOpen(false); }}
              >
                {t.kingOfCourt}
              </button>
              <button
                className={`sidebar-tab ${activeTab === 'social' ? 'active' : ''}`}
                onClick={() => { switchTab('social'); setSidebarOpen(false); }}
              >
                {t.socialTournament}
              </button>
              <button
                className={`sidebar-tab ${activeTab === 'members' ? 'active' : ''}`}
                onClick={() => { switchTab('members'); setSidebarOpen(false); }}
              >
                {t.members}
              </button>
              <button
                className={`sidebar-tab ${activeTab === 'oldTournaments' ? 'active' : ''}`}
                onClick={() => { switchTab('oldTournaments'); setSidebarOpen(false); }}
              >
                {t.oldTournaments}
              </button>
              <button
                className={`sidebar-tab ${activeTab === 'bookings' ? 'active' : ''}`}
                onClick={() => { switchTab('bookings'); setSidebarOpen(false); }}
              >
                {t.bookings}
              </button>
              <button
                className={`sidebar-tab ${activeTab === 'accounting' ? 'active' : ''}`}
                onClick={() => { switchTab('accounting'); setSidebarOpen(false); }}
              >
                {t.accounting}
              </button>
            </div>
            <div className="sidebar-footer">
              <button
                type="button"
                className="sidebar-back-dashboard"
                onClick={() => { navigate(`/admin/club/${clubId}`); setSidebarOpen(false); }}
                title={t.backToDashboard}
              >
                <span className="sidebar-back-icon">←</span>
                <span>{t.backToDashboard}</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">

          {/* Members Tab Content */}
          {activeTab === 'members' ? (
            <>
              {/* Member Sub-Tabs Navigation */}
              <div className="content-tabs-container">
                <div className="content-tabs">
                  <button
                    className={`content-tab ${memberTab === 'members' ? 'active' : ''}`}
                    onClick={() => setMemberTab('members')}
                  >
                    {t.members} ({members.length})
                  </button>
                  <button
                    className={`content-tab ${memberTab === 'statistics' ? 'active' : ''}`}
                    onClick={() => setMemberTab('statistics')}
                  >
                    {t.seasonStats}
                  </button>
                </div>
              </div>

              {/* Members Management Tab */}
              {memberTab === 'members' && (
                <div className="tab-content">
                  <div className="section">
                    <div className="section-header">
                      <h2>{t.members} ({members.length})</h2>
                      <button className="btn-primary" onClick={() => {
                        const name = prompt(t.memberName + ':')
                        if (name && name.trim()) {
                          const newMember = {
                            id: members.length > 0 ? Math.max(...members.map(m => m.id)) + 1 : 1,
                            name: name.trim(),
                            totalGames: 0,
                            totalWins: 0,
                            totalLosses: 0,
                            totalDraws: 0,
                            totalPoints: 0,
                            tournamentsPlayed: 0,
                            tournamentsWon: 0,
                            lastTournamentId: undefined,
                            pointsHistory: []
                          }
                          setMembers([...members, newMember])
                        }
                      }}>
                        {t.addMember}
                      </button>
                    </div>
                    {members.length > 0 && (
                      <>
                        <div className="search-bar-container" style={{ marginBottom: '15px' }}>
                          <input
                            type="text"
                            placeholder={t.searchMembers}
                            value={memberSearchQuery}
                            onChange={(e) => {
                              setMemberSearchQuery(e.target.value)
                              // Auto-show members when searching
                              if (e.target.value.trim()) {
                                setShowMembersList(true)
                              }
                            }}
                            className="search-input"
                          />
                        </div>
                        <div style={{ marginBottom: '15px' }}>
                          <button
                            className="btn-secondary"
                            onClick={() => setShowMembersList(!showMembersList)}
                          >
                            {showMembersList || memberSearchQuery.trim() 
                              ? (language === 'en' ? 'Hide Members' : 'إخفاء الأعضاء')
                              : (language === 'en' ? 'Show Members' : 'عرض الأعضاء')
                            }
                          </button>
                          {memberSearchQuery.trim() && (
                            <span style={{ marginLeft: '15px', fontSize: '13px', color: '#7f8c8d' }}>
                              {language === 'en' 
                                ? `Found ${members.filter(m => {
                                    const searchLower = memberSearchQuery.toLowerCase().trim()
                                    return m.name.toLowerCase().includes(searchLower)
                                  }).length} member(s)`
                                : `تم العثور على ${members.filter(m => {
                                    const searchLower = memberSearchQuery.toLowerCase().trim()
                                    return m.name.toLowerCase().includes(searchLower)
                                  }).length} عضو`
                              }
                            </span>
                          )}
                        </div>
                      </>
                    )}
                    {members.length === 0 ? (
                      <p style={{ textAlign: 'center', color: '#95a5a6', padding: '20px', fontSize: '13px' }}>{t.noMembers}</p>
                    ) : (showMembersList || memberSearchQuery.trim()) && (
                      <div className="members-cards-container">
                        {members
                          .filter(member => {
                            if (!memberSearchQuery.trim()) return true
                            const searchLower = memberSearchQuery.toLowerCase().trim()
                            return (
                              member.name?.toLowerCase().includes(searchLower) ||
                              member.mobile?.toLowerCase().includes(searchLower) ||
                              member.email?.toLowerCase().includes(searchLower)
                            )
                          })
                          .map((member) => (
                            <div key={member.id} className="member-card">
                              <div className="member-card-header">
                                <h3>{member.name || t.memberName}</h3>
                                <div className="member-card-actions">
                                  <button 
                                    className="btn-secondary btn-small"
                                    onClick={() => setMemberFormModal(member)}
                                    title={language === 'en' ? 'Edit' : 'تعديل'}
                                  >
                                    ✏️
                                  </button>
                                  <button 
                                    className="btn-danger-compact"
                                    onClick={() => {
                                      setMemberToDelete(member)
                                    }}
                                    title={language === 'en' ? 'Delete' : 'حذف'}
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>
                              <div className="member-card-body">
                                <div className="member-info-item">
                                  <span className="member-info-label">{t.mobileNumber}:</span>
                                  <span className="member-info-value">{member.mobile || '-'}</span>
                                </div>
                                <div className="member-info-item">
                                  <span className="member-info-label">{t.dateOfBirth}:</span>
                                  <span className="member-info-value">{member.dateOfBirth || '-'}</span>
                                </div>
                                <div className="member-info-item">
                                  <span className="member-info-label">{t.email}:</span>
                                  <span className="member-info-value">{member.email || '-'}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Season Statistics Tab */}
              {memberTab === 'statistics' && (
                <div className="tab-content">
                  {members.length > 0 ? (
                    <>
                      <div className="section">
                        <div className="section-header">
                          <h2>{t.seasonStats}</h2>
                        </div>
                        <div className="search-bar-container" style={{ marginBottom: '15px' }}>
                          <input
                            type="text"
                            placeholder={t.searchMembers}
                            value={statisticsSearchQuery}
                            onChange={(e) => setStatisticsSearchQuery(e.target.value)}
                            className="search-input"
                          />
                          {statisticsSearchQuery.trim() && (
                            <button
                              className="btn-secondary"
                              onClick={() => setStatisticsSearchQuery('')}
                              style={{ marginLeft: '10px', padding: '10px 15px' }}
                              title={language === 'en' ? 'Clear search' : 'مسح البحث'}
                            >
                              {language === 'en' ? 'Clear' : 'مسح'}
                            </button>
                          )}
                        </div>
                        {statisticsSearchQuery.trim() && (
                          <div style={{ marginBottom: '15px', fontSize: '13px', color: '#7f8c8d' }}>
                            {language === 'en' 
                              ? `Showing ${members.filter(member => {
                                  const searchLower = statisticsSearchQuery.toLowerCase().trim()
                                  return (
                                    member.name?.toLowerCase().includes(searchLower) ||
                                    member.mobile?.toLowerCase().includes(searchLower) ||
                                    member.email?.toLowerCase().includes(searchLower)
                                  )
                                }).length} of ${members.length} members`
                              : `عرض ${members.filter(member => {
                                  const searchLower = statisticsSearchQuery.toLowerCase().trim()
                                  return (
                                    member.name?.toLowerCase().includes(searchLower) ||
                                    member.mobile?.toLowerCase().includes(searchLower) ||
                                    member.email?.toLowerCase().includes(searchLower)
                                  )
                                }).length} من ${members.length} عضو`
                            }
                          </div>
                        )}
                        <table className="standings-table">
                          <thead>
                            <tr>
                              <th>{t.rank}</th>
                              <th>{t.member}</th>
                              <th>{t.totalGames}</th>
                              <th>{t.totalWins}</th>
                              <th>{t.totalLosses}</th>
                              <th>{t.totalDraws}</th>
                              <th>{t.totalPoints}</th>
                              <th>{t.tournamentsPlayed}</th>
                              <th>{t.tournamentsWon}</th>
                              <th>{t.viewHistory}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {members
                              .filter(member => {
                                if (!statisticsSearchQuery.trim()) return true
                                const searchLower = statisticsSearchQuery.toLowerCase().trim()
                                return (
                                  member.name?.toLowerCase().includes(searchLower) ||
                                  member.mobile?.toLowerCase().includes(searchLower) ||
                                  member.email?.toLowerCase().includes(searchLower)
                                )
                              })
                              .sort((a, b) => b.totalPoints - a.totalPoints || b.totalWins - a.totalWins)
                              .map((member, index) => (
                                <tr key={member.id} className={index < 3 ? 'top-4' : ''}>
                                  <td>{index + 1}</td>
                                  <td><strong>{member.name}</strong></td>
                                  <td>{member.totalGames}</td>
                                  <td>{member.totalWins}</td>
                                  <td>{member.totalLosses}</td>
                                  <td>{member.totalDraws}</td>
                                  <td className="positive">{member.totalPoints}</td>
                                  <td>{member.tournamentsPlayed}</td>
                                  <td className="positive">{member.tournamentsWon || 0}</td>
                                  <td>
                                    <button 
                                      className="btn-secondary btn-small"
                                      onClick={() => {
                                        setSelectedMemberForHistory(member.id)
                                        setShowMemberPointsHistory(true)
                                      }}
                                    >
                                      {t.viewHistory}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                        <div style={{ marginTop: '15px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <button 
                            className="btn-secondary"
                            onClick={() => {
                              setShowMemberPointsHistory(!showMemberPointsHistory)
                              if (!showMemberPointsHistory) {
                                setSelectedMemberForHistory(null)
                              }
                            }}
                          >
                            {showMemberPointsHistory ? t.hidePointsHistory : t.showPointsHistory}
                          </button>
                          {showMemberPointsHistory && (
                            <select
                              value={selectedMemberForHistory || ''}
                              onChange={(e) => setSelectedMemberForHistory(e.target.value ? parseInt(e.target.value) : null)}
                              className="member-history-select"
                            >
                              <option value="">{t.selectMember}</option>
                              {members
                                .filter(member => {
                                  if (!statisticsSearchQuery.trim()) return true
                                  const searchLower = statisticsSearchQuery.toLowerCase().trim()
                                  return (
                                    member.name?.toLowerCase().includes(searchLower) ||
                                    member.mobile?.toLowerCase().includes(searchLower) ||
                                    member.email?.toLowerCase().includes(searchLower)
                                  )
                                })
                                .sort((a, b) => b.totalPoints - a.totalPoints || b.totalWins - a.totalWins)
                                .map(member => (
                                  <option key={member.id} value={member.id}>
                                    {member.name} ({member.totalPoints} {t.totalPoints})
                                  </option>
                                ))}
                            </select>
                          )}
                        </div>
                      </div>

                      {/* Member Points History */}
                      {showMemberPointsHistory && selectedMemberForHistory && (
                        <div className="section">
                          <h2>{t.pointsHistory}</h2>
                          {(() => {
                            const member = members.find(m => m.id === selectedMemberForHistory)
                            if (!member) return null
                            const history = member.pointsHistory || []
                            
                            if (history.length === 0) {
                              return (
                                <p style={{ textAlign: 'center', color: '#95a5a6', padding: '40px' }}>
                                  {language === 'en' ? 'No points history yet. Points will appear here after matches are recorded.' : 'لا يوجد سجل نقاط بعد. ستظهر النقاط هنا بعد تسجيل المباريات.'}
                                </p>
                              )
                            }
                            
                            return (
                              <div className="member-history-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                  <h3>{member.name} - {t.totalPoints}: {member.totalPoints}</h3>
                                  <button
                                    className="btn-danger btn-small"
                                    onClick={() => resetMemberStats(member.id)}
                                    title={language === 'en' ? 'Reset all statistics for this member' : 'إعادة تعيين جميع الإحصائيات لهذا العضو'}
                                  >
                                    {language === 'en' ? 'Reset Stats' : 'إعادة تعيين الإحصائيات'}
                                  </button>
                                </div>
                                <table className="points-history-table">
                                  <thead>
                                    <tr>
                                      <th>#</th>
                                      <th>{t.date}</th>
                                      <th>{t.match}</th>
                                      <th>{t.result}</th>
                                      <th>{t.pointsEarned}</th>
                                      <th>{language === 'en' ? 'Actions' : 'إجراءات'}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {history.slice().reverse().map((entry, idx) => (
                                      <tr key={entry.id}>
                                        <td>{history.length - idx}</td>
                                        <td>{new Date(entry.timestamp).toLocaleDateString()}</td>
                                        <td>
                                          {entry.stage === 'join' 
                                            ? (language === 'en' ? 'Joined Tournament' : 'انضمام للبطولة')
                                            : entry.team && entry.opponent 
                                              ? `${entry.team} vs ${entry.opponent}`
                                              : entry.team || '-'
                                          }
                                        </td>
                                        <td>{entry.result === 'Tournament Join' ? t.tournamentJoin : entry.result}</td>
                                        <td className={entry.pointsEarned > 0 ? 'positive' : ''}>
                                          {entry.pointsEarned > 0 ? '+' : ''}{entry.pointsEarned}
                                        </td>
                                        <td>
                                          <button
                                            className="btn-danger-compact"
                                            onClick={() => deleteMemberPointsEntry(member.id, entry.id)}
                                            title={language === 'en' ? 'Delete this entry' : 'حذف هذا السجل'}
                                          >
                                            ×
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )
                          })()}
                          {!selectedMemberForHistory && (
                            <p style={{ textAlign: 'center', color: '#95a5a6', padding: '40px' }}>
                              {t.noMemberSelected}
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="section">
                      <p style={{ textAlign: 'center', color: '#95a5a6', padding: '40px' }}>
                        {t.noMembers}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : activeTab === 'oldTournaments' ? (
            <>
              {/* Old Tournaments Sub-Tabs */}
              <div className="content-tabs-container">
                <div className="content-tabs">
                  <button
                    className={`content-tab ${oldTournamentTab === 'king' ? 'active' : ''}`}
                    onClick={() => {
                      setOldTournamentTab('king')
                      setSelectedDate('')
                      setOldTournamentMatches([])
                    }}
                  >
                    {t.kingOfCourt}
                  </button>
                  <button
                    className={`content-tab ${oldTournamentTab === 'social' ? 'active' : ''}`}
                    onClick={() => {
                      setOldTournamentTab('social')
                      setSelectedDate('')
                      setOldTournamentMatches([])
                    }}
                  >
                    {t.socialTournament}
                  </button>
                </div>
              </div>

              {/* Old Tournaments Content */}
              <div className="tab-content">
                <div className="section">
                  <div className="section-header">
                    <h2>{t.oldTournaments} - {oldTournamentTab === 'king' ? t.kingOfCourt : t.socialTournament}</h2>
                  </div>
                  
                  {/* Date Picker */}
                  <div style={{ marginBottom: '20px', position: 'relative' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#2c3e50' }}>
                      {t.selectDate}:
                    </label>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <input
                        type="text"
                        value={selectedDate || ''}
                        onClick={() => setShowCalendar(!showCalendar)}
                        readOnly
                        className="search-input"
                        style={{ maxWidth: '300px', cursor: 'pointer' }}
                        placeholder={language === 'en' ? 'Click to select date' : 'انقر لتحديد التاريخ'}
                      />
                      {showCalendar && (
                        <div className="custom-calendar" style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          marginTop: '5px',
                          backgroundColor: '#fff',
                          border: '1px solid #ddd',
                          borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                          zIndex: 1000,
                          padding: '15px',
                          minWidth: '280px'
                        }}>
                          {/* Calendar Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <button
                              type="button"
                              onClick={() => navigateMonth(-1)}
                              className="btn-secondary btn-small"
                              style={{ padding: '5px 10px' }}
                            >
                              ‹
                            </button>
                            <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
                              {calendarMonth.toLocaleDateString(language === 'en' ? 'en-US' : 'ar-SA', { month: 'long', year: 'numeric' })}
                            </div>
                            <button
                              type="button"
                              onClick={() => navigateMonth(1)}
                              className="btn-secondary btn-small"
                              style={{ padding: '5px 10px' }}
                            >
                              ›
                            </button>
                          </div>

                          {/* Calendar Days of Week */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px', marginBottom: '10px' }}>
                            {(language === 'ar' 
                              ? ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س']
                              : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
                            ).map(day => (
                              <div key={day} style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '12px', color: '#7f8c8d', padding: '5px' }}>
                                {day}
                              </div>
                            ))}
                          </div>

                          {/* Calendar Grid */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px' }}>
                            {getCalendarDays().map((date, index) => {
                              if (!date) {
                                return <div key={`empty-${index}`} style={{ padding: '8px' }}></div>
                              }
                              
                              const hasTournament = isDateWithTournament(date)
                              const isSelected = isSelectedDate(date)
                              const isTodayDate = isToday(date)
                              
                              return (
                                <button
                                  key={date.getTime()}
                                  type="button"
                                  onClick={() => handleDateSelect(formatDateKey(date))}
                                  style={{
                                    padding: '8px',
                                    border: isSelected ? '2px solid #3498db' : '1px solid #ddd',
                                    backgroundColor: isSelected 
                                      ? '#3498db' 
                                      : hasTournament 
                                        ? '#fee' 
                                        : isTodayDate
                                          ? '#e8f4f8'
                                          : '#fff',
                                    color: hasTournament ? '#e74c3c' : isSelected ? '#fff' : '#2c3e50',
                                    fontWeight: hasTournament || isSelected ? 'bold' : 'normal',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isSelected) {
                                      e.target.style.backgroundColor = hasTournament ? '#fcc' : '#f0f0f0'
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isSelected) {
                                      e.target.style.backgroundColor = hasTournament ? '#fee' : (isTodayDate ? '#e8f4f8' : '#fff')
                                    }
                                  }}
                                >
                                  {date.getDate()}
                                </button>
                              )
                            })}
                          </div>

                          {/* Calendar Footer */}
                          <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                const today = new Date()
                                handleDateSelect(formatDateKey(today))
                              }}
                              className="btn-secondary btn-small"
                              style={{ flex: 1 }}
                            >
                              {language === 'en' ? 'Today' : 'اليوم'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleDateSelect('')
                              }}
                              className="btn-secondary btn-small"
                              style={{ flex: 1 }}
                            >
                              {language === 'en' ? 'Clear' : 'مسح'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowCalendar(false)}
                              className="btn-secondary btn-small"
                              style={{ flex: 1 }}
                            >
                              {t.close}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Overall Statistics Cards (before date selection) */}
                  {!selectedDate && overallTournamentStats.totalTournaments > 0 && (
                    <div style={{ marginTop: '20px', marginBottom: '30px' }}>
                      <h3 style={{ marginBottom: '15px', color: '#2c3e50', fontSize: '18px' }}>
                        {language === 'en' ? 'Overall Statistics' : 'الإحصائيات العامة'}
                      </h3>
                      <div className="tournament-stats-cards">
                        <div className="stat-card stat-primary">
                          <div className="stat-icon">📊</div>
                          <div className="stat-content">
                            <div className="stat-label">{language === 'en' ? 'Total Tournaments' : 'إجمالي البطولات'}</div>
                            <div className="stat-value">{overallTournamentStats.totalTournaments}</div>
                          </div>
                        </div>

                        <div className="stat-card stat-success">
                          <div className="stat-icon">⚽</div>
                          <div className="stat-content">
                            <div className="stat-label">{language === 'en' ? 'Total Matches' : 'إجمالي المباريات'}</div>
                            <div className="stat-value">{overallTournamentStats.totalMatches}</div>
                          </div>
                        </div>

                        <div className="stat-card stat-info">
                          <div className="stat-icon">👥</div>
                          <div className="stat-content">
                            <div className="stat-label">{language === 'en' ? 'Unique Teams' : 'الفرق الفريدة'}</div>
                            <div className="stat-value">{overallTournamentStats.totalTeams}</div>
                          </div>
                        </div>

                        <div className="stat-card stat-warning">
                          <div className="stat-icon">🎯</div>
                          <div className="stat-content">
                            <div className="stat-label">{language === 'en' ? 'Total Games' : 'إجمالي الألعاب'}</div>
                            <div className="stat-value">{overallTournamentStats.totalGames}</div>
                          </div>
                        </div>

                        {overallTournamentStats.lastTournamentDate && (
                          <div className="stat-card stat-secondary">
                            <div className="stat-icon">📅</div>
                            <div className="stat-content">
                              <div className="stat-label">{language === 'en' ? 'Last Tournament' : 'آخر بطولة'}</div>
                              <div className="stat-value" style={{ fontSize: '16px', fontWeight: '600' }}>
                                {new Date(overallTournamentStats.lastTournamentDate).toLocaleDateString(
                                  language === 'ar' ? 'ar-SA' : 'en-US',
                                  { year: 'numeric', month: 'short', day: 'numeric' }
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {overallTournamentStats.firstTournamentDate && (
                          <div className="stat-card stat-info">
                            <div className="stat-icon">📆</div>
                            <div className="stat-content">
                              <div className="stat-label">{language === 'en' ? 'First Tournament' : 'أول بطولة'}</div>
                              <div className="stat-value" style={{ fontSize: '16px', fontWeight: '600' }}>
                                {new Date(overallTournamentStats.firstTournamentDate).toLocaleDateString(
                                  language === 'ar' ? 'ar-SA' : 'en-US',
                                  { year: 'numeric', month: 'short', day: 'numeric' }
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {overallTournamentStats.totalTournaments > 0 && (
                          <div className="stat-card stat-success">
                            <div className="stat-icon">📈</div>
                            <div className="stat-content">
                              <div className="stat-label">{language === 'en' ? 'Avg Matches/Tournament' : 'متوسط المباريات/بطولة'}</div>
                              <div className="stat-value">
                                {(overallTournamentStats.totalMatches / overallTournamentStats.totalTournaments).toFixed(1)}
                              </div>
                            </div>
                          </div>
                        )}

                        {overallTournamentStats.totalMatches > 0 && (
                          <div className="stat-card stat-warning">
                            <div className="stat-icon">📊</div>
                            <div className="stat-content">
                              <div className="stat-label">{language === 'en' ? 'Avg Games/Match' : 'متوسط الألعاب/مباراة'}</div>
                              <div className="stat-value">
                                {(overallTournamentStats.totalGames / overallTournamentStats.totalMatches).toFixed(1)}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tournament Details */}
                  {selectedDate && oldTournamentMatches.length > 0 ? (
                    <>
                      {/* Statistics Cards */}
                      {(() => {
                        const standings = calculateStandingsFromMatches(oldTournamentMatches)
                        const totalTeams = standings.length
                        const totalMatches = oldTournamentMatches.length
                        const totalGames = oldTournamentMatches.reduce((sum, match) => {
                          let team1Games, team2Games
                          if (match.isFinal && match.set1Team1Games !== undefined) {
                            team1Games = match.set1Team1Games + match.set2Team1Games
                            team2Games = match.set1Team2Games + match.set2Team2Games
                          } else {
                            team1Games = match.team1Games || 0
                            team2Games = match.team2Games || 0
                          }
                          return sum + team1Games + team2Games
                        }, 0)
                        const avgGamesPerMatch = totalMatches > 0 ? (totalGames / totalMatches).toFixed(1) : 0
                        const winner = standings.length > 0 ? standings[0] : null
                        const totalDraws = standings.reduce((sum, team) => sum + (team.draws || 0), 0)
                        
                        // Format date
                        const dateObj = new Date(selectedDate)
                        const formattedDate = dateObj.toLocaleDateString(
                          language === 'ar' ? 'ar-SA' : 'en-US',
                          { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
                        )

                        return (
                          <div className="tournament-stats-cards" style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '20px',
                            marginTop: '20px',
                            marginBottom: '20px'
                          }}>
                            <div className="stat-card stat-primary">
                              <div className="stat-icon">📅</div>
                              <div className="stat-content">
                                <div className="stat-label">{language === 'en' ? 'Tournament Date' : 'تاريخ البطولة'}</div>
                                <div className="stat-value">{formattedDate}</div>
                              </div>
                            </div>

                            <div className="stat-card stat-info">
                              <div className="stat-icon">👥</div>
                              <div className="stat-content">
                                <div className="stat-label">{language === 'en' ? 'Total Teams' : 'إجمالي الفرق'}</div>
                                <div className="stat-value">{totalTeams}</div>
                              </div>
                            </div>

                            <div className="stat-card stat-success">
                              <div className="stat-icon">⚽</div>
                              <div className="stat-content">
                                <div className="stat-label">{language === 'en' ? 'Total Matches' : 'إجمالي المباريات'}</div>
                                <div className="stat-value">{totalMatches}</div>
                              </div>
                            </div>

                            <div className="stat-card stat-warning">
                              <div className="stat-icon">🎯</div>
                              <div className="stat-content">
                                <div className="stat-label">{language === 'en' ? 'Total Games' : 'إجمالي الألعاب'}</div>
                                <div className="stat-value">{totalGames}</div>
                              </div>
                            </div>

                            <div className="stat-card stat-secondary">
                              <div className="stat-icon">📊</div>
                              <div className="stat-content">
                                <div className="stat-label">{language === 'en' ? 'Avg Games/Match' : 'متوسط الألعاب/مباراة'}</div>
                                <div className="stat-value">{avgGamesPerMatch}</div>
                              </div>
                            </div>

                            {winner && (
                              <div className="stat-card stat-primary" style={{ gridColumn: winner ? 'span 1' : 'auto' }}>
                                <div className="stat-icon">🏆</div>
                                <div className="stat-content">
                                  <div className="stat-label">{language === 'en' ? 'Champion' : 'البطل'}</div>
                                  <div className="stat-value" style={{ fontSize: '16px', fontWeight: '600' }}>
                                    {winner.name}
                                  </div>
                                  <div className="stat-sublabel" style={{ fontSize: '12px', marginTop: '4px', opacity: 0.8 }}>
                                    {winner.wins} {language === 'en' ? 'Wins' : 'فوز'} | {winner.gamesWon}-{winner.gamesLost}
                                  </div>
                                </div>
                              </div>
                            )}

                            {totalDraws > 0 && (
                              <div className="stat-card stat-info">
                                <div className="stat-icon">🤝</div>
                                <div className="stat-content">
                                  <div className="stat-label">{language === 'en' ? 'Total Draws' : 'إجمالي التعادلات'}</div>
                                  <div className="stat-value">{totalDraws}</div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })()}

                      {/* Delete Button */}
                      <div style={{ marginTop: '20px', marginBottom: '15px', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          className="btn-danger"
                          onClick={handleDeleteOldTournament}
                          style={{
                            padding: '10px 20px',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                        >
                          🗑️ {t.deleteTournament}
                        </button>
                      </div>

                      {/* Standings Table */}
                      <div className="section" style={{ marginTop: '20px' }}>
                        <h3>{t.tournamentDetails}</h3>
                        <table className="standings-table">
                          <thead>
                            <tr>
                              <th>{t.rank}</th>
                              <th>{t.team}</th>
                              <th>{t.wins}</th>
                              <th>{t.losses}</th>
                              <th>{t.gamesWon}</th>
                              <th>{t.gamesLost}</th>
                              <th>{t.gamesDiff}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {calculateStandingsFromMatches(oldTournamentMatches).map((team, index) => {
                              const gamesDiff = team.gamesWon - team.gamesLost
                              return (
                                <tr key={team.id} className={index < 3 ? 'top-4' : ''}>
                                  <td>{index + 1}</td>
                                  <td><strong>{team.name}</strong></td>
                                  <td>{team.wins}</td>
                                  <td>{team.losses}</td>
                                  <td>{team.gamesWon}</td>
                                  <td>{team.gamesLost}</td>
                                  <td className={gamesDiff > 0 ? 'positive' : gamesDiff < 0 ? 'negative' : ''}>
                                    {gamesDiff > 0 ? '+' : ''}{gamesDiff}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Matches Section (Collapsible) */}
                      <div className="section" style={{ marginTop: '20px' }}>
                        <button
                          className="btn-secondary"
                          onClick={() => setShowOldTournamentMatches(!showOldTournamentMatches)}
                          style={{ marginBottom: '15px' }}
                        >
                          {showOldTournamentMatches ? t.hideHistory : t.matchesPlayed} ({oldTournamentMatches.length})
                        </button>
                        
                        {showOldTournamentMatches && (
                          <div className="match-history-container">
                            <table className="match-history-table">
                              <thead>
                                <tr>
                                  <th>#</th>
                                  <th>{t.stage}</th>
                                  <th>{t.team}</th>
                                  <th>{t.vs}</th>
                                  <th>{t.team}</th>
                                  <th>{t.score}</th>
                                  <th>{t.winner}</th>
                                  <th>{t.court}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {oldTournamentMatches
                                  .sort((a, b) => (b.timestamp || b.savedAt || 0) - (a.timestamp || a.savedAt || 0))
                                  .map((match, index) => {
                                    // Determine stage label
                                    let stageLabel = ''
                                    if (match.isFinal) {
                                      stageLabel = t.finalLabel
                                    } else if (match.isThirdPlace) {
                                      stageLabel = t.thirdPlaceLabel
                                    } else if (match.isSemiFinal) {
                                      stageLabel = t.semiFinalLabel
                                    } else if (match.isGroupStage || match.groupId) {
                                      stageLabel = match.groupId 
                                        ? `${t.groupStageLabel} - ${match.groupId.replace('court', t.group + ' ')}`
                                        : t.groupStageLabel
                                    } else {
                                      stageLabel = t.kingOfCourt
                                    }

                                    return (
                                      <tr key={match.id || index}>
                                        <td>{oldTournamentMatches.length - index}</td>
                                        <td className="stage-cell">
                                          <span className={`stage-badge ${match.isFinal ? 'final-badge' : match.isThirdPlace ? 'third-badge' : match.isSemiFinal ? 'semi-badge' : 'group-badge'}`}>
                                            {stageLabel}
                                          </span>
                                        </td>
                                        <td><strong>{match.team1?.name || '-'}</strong></td>
                                        <td>{t.vs}</td>
                                        <td><strong>{match.team2?.name || '-'}</strong></td>
                                        <td className="score-cell">
                                          {match.team1Games} - {match.team2Games}
                                        </td>
                                        <td>
                                          {match.isTie ? (
                                            <span className="draw-result">{t.draw}</span>
                                          ) : match.winner ? (
                                            <span className="winner-result">🏆 {match.winner.name}</span>
                                          ) : (
                                            '-'
                                          )}
                                        </td>
                                        <td>{t.court} {match.courtNumber || '-'}</td>
                                      </tr>
                                    )
                                  })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </>
                  ) : selectedDate ? (
                    <p style={{ textAlign: 'center', color: '#95a5a6', padding: '40px' }}>
                      {t.noTournamentOnDate}
                    </p>
                  ) : (
                    <p style={{ textAlign: 'center', color: '#95a5a6', padding: '40px' }}>
                      {t.selectDate}
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : activeTab === 'bookings' ? (
            <>
              {/* Booking View Tabs */}
              <div className="content-tabs-container">
                <div className="content-tabs">
                  <button
                    className={`content-tab ${bookingView === 'weekly' ? 'active' : ''}`}
                    onClick={() => setBookingView('weekly')}
                  >
                    {language === 'en' ? 'Weekly View' : 'عرض أسبوعي'}
                  </button>
                  <button
                    className={`content-tab ${bookingView === 'courts' ? 'active' : ''}`}
                    onClick={() => setBookingView('courts')}
                  >
                    {language === 'en' ? 'Court View' : 'عرض الملاعب'}
                  </button>
                </div>
              </div>

              {bookingView === 'weekly' ? (
                <div className="section section-bookings">
                  <div className="section-header bookings-section-header">
                    <h2 className="bookings-title">{t.bookings} - {currentClub?.nameAr || currentClub?.name || 'Hala Padel'}</h2>
                    <div className="bookings-header-actions">
                      <div className="bookings-sync-row">
                        <button 
                          className="btn-primary btn-refresh-playtomic"
                          onClick={() => loadPlaytomicBookings(true)}
                          disabled={isLoadingPlaytomic}
                          title={language === 'en' ? 'Refresh bookings from Playtomic' : 'تحديث الحجوزات من Playtomic'}
                        >
                          <span>🔄</span>
                          <span className="btn-label">{isLoadingPlaytomic ? (language === 'en' ? 'Loading...' : 'جاري التحميل...') : (language === 'en' ? 'Refresh Playtomic' : 'تحديث Playtomic')}</span>
                        </button>
                        {playtomicLastSync && (
                          <span className="bookings-last-sync">
                            {language === 'en' 
                              ? `Last sync: ${new Date(playtomicLastSync).toLocaleTimeString()}`
                              : `آخر تحديث: ${new Date(playtomicLastSync).toLocaleTimeString('ar-SA')}`
                            }
                          </span>
                        )}
                      </div>
                      <div className="bookings-nav-wrap">
                        <button 
                          className="btn-secondary btn-nav-prev"
                          onClick={() => {
                            const newWeek = new Date(currentWeek)
                            newWeek.setDate(newWeek.getDate() - selectedDays.length)
                            setCurrentWeek(newWeek)
                          }}
                          title={language === 'en' ? `Previous ${selectedDays.length} days` : `${selectedDays.length} أيام سابقة`}
                        >
                          <span>{isRTL ? '→' : '←'}</span>
                          <span className="nav-label-full">{language === 'en' ? `Previous ${selectedDays.length === 1 ? 'Day' : `${selectedDays.length} Days`}` : `${selectedDays.length === 1 ? 'اليوم السابق' : `${selectedDays.length} أيام سابقة`}`}</span>
                        </button>
                        <button 
                          className="btn-secondary btn-nav-today"
                          onClick={() => setCurrentWeek(new Date())}
                        >
                          {language === 'en' ? 'Today' : 'اليوم'}
                        </button>
                        <button 
                          className="btn-secondary btn-nav-next"
                          onClick={() => {
                            const newWeek = new Date(currentWeek)
                            newWeek.setDate(newWeek.getDate() + selectedDays.length)
                            setCurrentWeek(newWeek)
                          }}
                          title={language === 'en' ? `Next ${selectedDays.length} days` : `${selectedDays.length} أيام قادمة`}
                        >
                          <span className="nav-label-full">{language === 'en' ? `Next ${selectedDays.length === 1 ? 'Day' : `${selectedDays.length} Days`}` : `${selectedDays.length === 1 ? 'اليوم التالي' : `${selectedDays.length} أيام قادمة`}`}</span>
                          <span>{isRTL ? '←' : '→'}</span>
                        </button>
                      </div>
                      <div className="bookings-days-row">
                        <span className="bookings-days-label">{language === 'en' ? 'Days:' : 'الأيام:'}</span>
                        <button 
                          className="btn-secondary btn-days-value"
                          onClick={toggleWeeklyViewDays}
                          title={language === 'en' ? `Reduce to ${selectedDays.length > 1 ? selectedDays.length - 1 : 7} days` : `تقليل إلى ${selectedDays.length > 1 ? selectedDays.length - 1 : 7} أيام`}
                        >
                          {selectedDays.length}
                        </button>
                        {selectedDays.length < 7 && (
                          <button 
                            className="btn-secondary btn-days-all"
                            onClick={maximizeWeeklyView}
                            title={language === 'en' ? 'Show all 7 days' : 'عرض جميع الأيام'}
                          >
                            {language === 'en' ? 'All' : 'الكل'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                
                {/* Calendar Grid */}
                <div className="booking-calendar-container">
                  <div 
                    className="booking-calendar-grid"
                    style={{
                      gridTemplateColumns: `80px repeat(${selectedDays.length}, 1fr)`,
                      minWidth: `${80 + (selectedDays.length * 150)}px`
                    }}
                  >
                    {/* Time column header */}
                    <div className="time-column-header"></div>
                    
                    {/* Day headers */}
                    {getDaysOfWeek().map((dayObj, dayIdx) => {
                      const day = dayObj.date
                      return (
                        <div key={dayIdx} className="day-header">
                          <div className="day-name">
                            {language === 'ar' 
                              ? ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'][day.getDay() === 0 ? 6 : day.getDay() - 1]
                              : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][day.getDay() === 0 ? 6 : day.getDay() - 1]
                            }
                          </div>
                          <div className="day-date">
                            {day.getDate()}/{day.getMonth() + 1}
                          </div>
                        </div>
                      )
                    })}
                    
                    {/* Time slots and grid cells */}
                    {getTimeSlots().map((timeSlot, timeIdx) => (
                      <React.Fragment key={timeIdx}>
                        {/* Time label */}
                        <div className="time-label">{timeSlot}</div>
                        
                        {/* Grid cells for each day */}
                        {getDaysOfWeek().map((dayObj, dayIdx) => {
                          const day = dayObj.date
                          const slotBookings = getBookingsForSlot(day, timeSlot)
                          const isInDragSelection = dragSelection && 
                            dragSelection.startCell && 
                            dragSelection.endCell &&
                            dragSelection.startCell.day.toDateString() === day.toDateString() &&
                            timeSlot >= (dragSelection.startTime || '') &&
                            timeSlot < (dragSelection.endTime || dragSelection.startTime || '')
                          
                          // Find the row index for this time slot
                          const timeSlotIndex = getTimeSlots().indexOf(timeSlot)
                          
                          return (
                            <div
                              key={`${dayIdx}-${timeIdx}`}
                              className={`calendar-cell calendar-cell-weekly ${isInDragSelection ? 'drag-selection' : ''}`}
                              data-date={day.toISOString().split('T')[0]}
                              data-time={timeSlot}
                              onMouseDown={(e) => handleGridMouseDown(e, day, timeSlot)}
                              onMouseMove={(e) => handleGridMouseMove(e, day, timeSlot)}
                              onMouseUp={handleGridMouseUp}
                              onTouchStart={(e) => { if (!e.target.closest('.booking-event')) handleGridMouseDown(e, day, timeSlot) }}
                              onTouchMove={(e) => {
                                if (!dragSelection?.startCell || !e.touches?.[0]) return
                                const el = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY)
                                const cell = el?.closest('.calendar-cell-weekly')
                                if (!cell?.dataset?.date || !cell?.dataset?.time) return
                                const dayStr = cell.dataset.date
                                const startDay = dragSelection.startCell?.day
                                if (!startDay || startDay.toISOString().split('T')[0] !== dayStr) return
                                handleGridMouseMove(e, new Date(dayStr + 'T12:00:00'), cell.dataset.time)
                              }}
                              onTouchEnd={(e) => { handleGridMouseUp(); e.preventDefault() }}
                              onMouseLeave={() => {
                                if (dragSelection && !dragSelection.endCell) setDragSelection(null)
                              }}
                              style={{ position: 'relative', touchAction: 'manipulation' }}
                            >
                              {slotBookings.map((booking, bookingIdx) => {
                                const rowSpan = getBookingRowSpan(booking)
                                const baseHeight = rowSpan * 30 - 2
                                const bookingHeight = getBookingMinHeight(booking, baseHeight)
                                const paymentStatus = getPaymentStatus(booking)
                                const bookingColor = getBookingColor(booking)
                                // Render multiple bookings side-by-side with clean styling
                                const totalBookings = slotBookings.length
                                const gap = totalBookings > 1 ? 2 : 0 // 2px gap between bookings
                                const widthPercent = totalBookings > 1 ? (100 / totalBookings) : 100
                                const leftPercent = totalBookings > 1 ? bookingIdx * widthPercent : 0
                                
                                return (
                                  <div
                                    key={booking.id}
                                    className={`booking-event ${totalBookings > 1 ? 'booking-event-multiple' : ''} ${paymentStatus === 'paid' ? 'paid' : paymentStatus === 'partially_paid' ? 'partially-paid' : 'not-paid'}`}
                                    onMouseEnter={() => setHoveredBooking(booking.id)}
                                    onMouseLeave={() => setHoveredBooking(null)}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      // If booking doesn't have an ID, assign one immediately
                                      let bookingToEdit = { ...booking, date: booking.date }
                                      if (!booking.id || booking.id <= 0) {
                                        const existingIds = bookings.filter(b => b.id != null && b.id > 0).map(b => b.id)
                                        const newId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1
                                        bookingToEdit.id = newId
                                        // Update the booking in the array with the new ID
                                        const updatedBookings = bookings.map(b => 
                                          (b.date === booking.date && 
                                           b.startTime === booking.startTime && 
                                           b.endTime === booking.endTime && 
                                           b.resource === booking.resource &&
                                           (!b.id || b.id <= 0))
                                            ? { ...b, id: newId }
                                            : b
                                        )
                                        const localOnly = updatedBookings.filter(b => !b.source || b.source !== 'playtomic')
                                        setLocalBookings(localOnly)
                                        saveBookingsToClub(localOnly)
                                        mergeBookings(localOnly, playtomicBookings)
                                      }
                                      setBookingFormData(bookingToEdit)
                                      setShowBookingModal(true)
                                    }}
                                    style={{
                                      backgroundColor: bookingColor,
                                      position: 'absolute',
                                      top: 0,
                                      left: totalBookings > 1 ? `calc(${leftPercent}% + ${bookingIdx > 0 ? gap : 0}px)` : '2px',
                                      width: totalBookings > 1 ? `calc(${widthPercent}% - ${bookingIdx === 0 || bookingIdx === totalBookings - 1 ? gap : gap * 2}px)` : 'calc(100% - 4px)',
                                      height: `${bookingHeight}px`,
                                      minHeight: '28px',
                                      zIndex: 3 + bookingIdx,
                                      cursor: 'pointer',
                                      borderLeft: `3px solid ${paymentStatus === 'paid' ? '#28a745' : paymentStatus === 'partially_paid' ? '#ffc107' : '#dc3545'}`,
                                      borderRight: totalBookings > 1 && bookingIdx < totalBookings - 1 ? '1px solid rgba(0,0,0,0.1)' : 'none',
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                      borderRadius: totalBookings > 1 
                                        ? (bookingIdx === 0 ? '4px 0 0 4px' : bookingIdx === totalBookings - 1 ? '0 4px 4px 0' : '0')
                                        : '4px'
                                    }}
                                  >
                                      <div className="booking-status-badge">
                                        {paymentStatus === 'paid' ? '✓' : paymentStatus === 'partially_paid' ? '⚠' : '✗'}
                                      </div>
                                      {(booking.source === 'playtomic' || booking.id?.toString().startsWith('playtomic_')) && (
                                        <div style={{ 
                                          position: 'absolute', 
                                          top: '2px', 
                                          right: '2px', 
                                          fontSize: '8px', 
                                          backgroundColor: '#2196f3', 
                                          color: 'white', 
                                          padding: '1px 3px', 
                                          borderRadius: '2px',
                                          fontWeight: 'bold'
                                        }}>
                                          P
                                        </div>
                                      )}
                                      <div style={{ overflow: 'hidden', width: '100%' }}>
                                        <div className="booking-title" style={{ 
                                          fontSize: `${getFontSizeForDays(totalBookings > 1 ? 10 : 11, selectedDays.length)}px`, 
                                          fontWeight: '600' 
                                        }}>
                                          {booking.participants && booking.participants.length > 0 ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                                              <div style={{ 
                                                fontSize: `${getFontSizeForDays(totalBookings > 1 ? 9 : 10, selectedDays.length)}px`, 
                                                fontWeight: '600', 
                                                marginBottom: '3px',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                              }}>
                                                {booking.resource}
                                              </div>
                                              <div className="booking-participants" style={{
                                                width: '100%',
                                                maxWidth: '100%'
                                              }}>
                                                {booking.participants.map((p, idx) => (
                                                  <div 
                                                    key={idx} 
                                                    className="booking-participant-name"
                                                    style={{
                                                      fontSize: `${getFontSizeForDays(8.5, selectedDays.length)}px`,
                                                      lineHeight: `${1.2 + (selectedDays.length <= 2 ? 0.2 : 0)}`
                                                    }}
                                                  >
                                                    {typeof p === 'object' ? p.name : p}
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          ) : (
                                            booking.resource
                                          )}
                                        </div>
                                      </div>
                                      {hoveredBooking === booking.id && (
                                        <div className="booking-tooltip">
                                          <div style={{ marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '6px' }}>
                                            <div><strong>{booking.resource}</strong></div>
                                            <div style={{ fontSize: '11px', marginTop: '2px' }}>{booking.startTime} - {booking.endTime}</div>
                                          </div>
                                          {booking.participants.length > 0 && (
                                            <div style={{ marginBottom: '8px' }}>
                                              <div style={{ fontWeight: '600', marginBottom: '4px', fontSize: '12px' }}>{t.participants}:</div>
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                {booking.participants.map((p, idx) => (
                                                  <div key={idx} style={{ 
                                                    padding: '2px 0',
                                                    fontSize: '13px',
                                                    lineHeight: '1.4'
                                                  }}>
                                                    • {typeof p === 'object' ? p.name : p}
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                          {booking.amount && (
                                            <div style={{ marginBottom: '8px', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '6px' }}>
                                              <div>
                                                {t.amount}: {booking.amount}
                                                {paymentStatus === 'paid' 
                                                  ? ` (${language === 'en' ? 'Paid' : 'مدفوع'})`
                                                  : paymentStatus === 'partially_paid'
                                                  ? ` (${language === 'en' ? 'Partially Paid' : 'مدفوع جزئياً'})`
                                                  : ` (${language === 'en' ? 'Not Paid' : 'غير مدفوع'})`
                                                }
                                              </div>
                                            </div>
                                          )}
                                          <div style={{ marginTop: '8px', fontSize: '10px', color: '#b0bec5', fontStyle: 'italic', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '6px' }}>
                                            {language === 'en' ? 'Click to edit' : 'انقر للتعديل'}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                            </div>
                          )
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
              ) : (
                <div className="section section-bookings">
                  <div className="section-header bookings-section-header">
                    <h2 className="bookings-title">{t.bookings} - {currentClub?.nameAr || currentClub?.name || 'Hala Padel'}</h2>
                    <div className="bookings-header-actions bookings-court-actions">
                      <div className="bookings-sync-row">
                        <button 
                          className="btn-primary btn-refresh-playtomic"
                          onClick={() => loadPlaytomicBookings(true)}
                          disabled={isLoadingPlaytomic}
                          title={language === 'en' ? 'Refresh bookings from Playtomic' : 'تحديث الحجوزات من Playtomic'}
                        >
                          <span>🔄</span>
                          <span className="btn-label">{isLoadingPlaytomic ? (language === 'en' ? 'Loading...' : 'جاري التحميل...') : (language === 'en' ? 'Refresh Playtomic' : 'تحديث Playtomic')}</span>
                        </button>
                        {playtomicLastSync && (
                          <span className="bookings-last-sync">
                            {language === 'en' 
                              ? `Last sync: ${new Date(playtomicLastSync).toLocaleTimeString()}`
                              : `آخر تحديث: ${new Date(playtomicLastSync).toLocaleTimeString('ar-SA')}`
                            }
                          </span>
                        )}
                      </div>
                      <div className="bookings-nav-wrap bookings-court-nav-wrap">
                        <button
                          className="btn-secondary btn-nav-prev"
                          onClick={() => navigateCourtViewDate('prev')}
                          title={language === 'en' ? 'Previous Day' : 'اليوم السابق'}
                        >
                          {isRTL ? '→' : '←'}
                        </button>
                        <div className="bookings-nav-today-group">
                          <button 
                            className="btn-secondary btn-nav-today"
                            onClick={() => setSelectedDateForCourtView(new Date().toISOString().split('T')[0])}
                          >
                            {language === 'en' ? 'Today' : 'اليوم'}
                          </button>
                          <input
                            type="date"
                            value={selectedDateForCourtView}
                            onChange={(e) => setSelectedDateForCourtView(e.target.value)}
                            className="search-input bookings-date-input"
                          />
                        </div>
                        <button
                          className="btn-secondary btn-nav-next"
                          onClick={() => navigateCourtViewDate('next')}
                          title={language === 'en' ? 'Next Day' : 'اليوم التالي'}
                        >
                          {isRTL ? '←' : '→'}
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Court View Calendar Grid */}
                  <div className="booking-calendar-container">
                    <div
                      className={`booking-calendar-grid booking-calendar-grid-courts`}
                      style={{
                        gridTemplateColumns: `80px repeat(${getCourts().length}, 1fr)`,
                        minWidth: `${80 + Math.max(getCourts().length, 1) * 120}px`
                      }}
                    >
                      {/* Time column header */}
                      <div className="time-column-header"></div>
                      
                      {/* Court headers */}
                      {getCourts().map((court, courtIdx) => (
                        <div key={courtIdx} className="day-header">
                          <div className="day-name">{court}</div>
                        </div>
                      ))}
                      
                      {/* Time slots and grid cells */}
                      {getTimeSlots().map((timeSlot, timeIdx) => (
                        <React.Fragment key={timeIdx}>
                          {/* Time label */}
                          <div className="time-label">{timeSlot}</div>
                          
                          {/* Grid cells for each court */}
                          {getCourts().map((court, courtIdx) => {
                            const slotBookings = getBookingsForCourtSlot(court, timeSlot, selectedDateForCourtView)
                            const isInDragSelection = dragSelection && 
                              dragSelection.startCell && 
                              dragSelection.endCell &&
                              dragSelection.startCell.court === court &&
                              dragSelection.startCell.date === selectedDateForCourtView &&
                              timeSlot >= (dragSelection.startTime || '') &&
                              timeSlot < (dragSelection.endTime || dragSelection.startTime || '')
                            
                            return (
                              <div
                                key={`${courtIdx}-${timeIdx}`}
                                className={`calendar-cell calendar-cell-court ${isInDragSelection ? 'drag-selection' : ''}`}
                                data-court={court}
                                data-date={selectedDateForCourtView}
                                data-time={timeSlot}
                                onMouseDown={(e) => handleCourtGridMouseDown(e, court, timeSlot, selectedDateForCourtView)}
                                onMouseMove={(e) => handleCourtGridMouseMove(e, court, timeSlot, selectedDateForCourtView)}
                                onMouseUp={handleCourtGridMouseUp}
                                onTouchStart={(e) => { if (!e.target.closest('.booking-event')) handleCourtGridMouseDown(e, court, timeSlot, selectedDateForCourtView) }}
                                onTouchMove={(e) => {
                                  if (!dragSelection?.startCell || !e.touches?.[0]) return
                                  const el = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY)
                                  const cell = el?.closest('.calendar-cell-court')
                                  if (!cell?.dataset?.court || !cell?.dataset?.date || !cell?.dataset?.time) return
                                  const startCourt = dragSelection.startCell?.court
                                  const startDate = dragSelection.startCell?.date
                                  if (startCourt !== cell.dataset.court || startDate !== cell.dataset.date) return
                                  handleCourtGridMouseMove(e, cell.dataset.court, cell.dataset.time, cell.dataset.date)
                                }}
                                onTouchEnd={(e) => { handleCourtGridMouseUp(); e.preventDefault() }}
                                onMouseLeave={() => {
                                  if (dragSelection && !dragSelection.endCell) setDragSelection(null)
                                }}
                                style={{ position: 'relative', touchAction: 'manipulation' }}
                              >
                                {slotBookings.map(booking => {
                                  const rowSpan = getBookingRowSpan(booking)
                                  const baseHeight = rowSpan * 30 - 2
                                  const bookingHeight = getBookingMinHeight(booking, baseHeight)
                                  const paymentStatus = getPaymentStatus(booking)
                                  const bookingColor = getBookingColor(booking)
                                  return (
                                    <div
                                      key={booking.id}
                                      className={`booking-event ${paymentStatus === 'paid' ? 'paid' : paymentStatus === 'partially_paid' ? 'partially-paid' : 'not-paid'}`}
                                      onMouseEnter={() => setHoveredBooking(booking.id)}
                                      onMouseLeave={() => setHoveredBooking(null)}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        // If booking doesn't have an ID, assign one immediately
                                        let bookingToEdit = { ...booking, date: booking.date }
                                        if (!booking.id || booking.id <= 0) {
                                          const existingIds = bookings.filter(b => b.id != null && b.id > 0).map(b => b.id)
                                          const newId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1
                                          bookingToEdit.id = newId
                                          // Update the booking in the array with the new ID
                                          const updatedBookings = bookings.map(b => 
                                            (b.date === booking.date && 
                                             b.startTime === booking.startTime && 
                                             b.endTime === booking.endTime && 
                                             b.resource === booking.resource &&
                                             (!b.id || b.id <= 0))
                                              ? { ...b, id: newId }
                                              : b
                                          )
                                          const localOnly = updatedBookings.filter(b => !b.source || b.source !== 'playtomic')
                                          setLocalBookings(localOnly)
                                          saveBookingsToClub(localOnly)
                                          mergeBookings(localOnly, playtomicBookings)
                                        }
                                        setBookingFormData(bookingToEdit)
                                        setShowBookingModal(true)
                                      }}
                                      style={{
                                        backgroundColor: bookingColor,
                                        position: 'absolute',
                                        top: 0,
                                        left: '2px',
                                        right: '2px',
                                        height: `${bookingHeight}px`,
                                        minHeight: '28px',
                                        zIndex: 3,
                                        cursor: 'pointer'
                                      }}
                                    >
                                      <div className="booking-status-badge">
                                        {paymentStatus === 'paid' ? '✓' : paymentStatus === 'partially_paid' ? '⚠' : '✗'}
                                      </div>
                                      {(booking.source === 'playtomic' || booking.id?.toString().startsWith('playtomic_')) && (
                                        <div style={{ 
                                          position: 'absolute', 
                                          top: '2px', 
                                          right: '2px', 
                                          fontSize: '8px', 
                                          backgroundColor: '#2196f3', 
                                          color: 'white', 
                                          padding: '1px 3px', 
                                          borderRadius: '2px',
                                          fontWeight: 'bold'
                                        }}>
                                          P
                                        </div>
                                      )}
                                      <div className="booking-title">
                                        {booking.participants && booking.participants.length > 0 ? (
                                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <div style={{ fontSize: '10px', fontWeight: '600', marginBottom: '2px' }}>
                                              {new Date(booking.date).toLocaleDateString(language === 'en' ? 'en-US' : 'ar-SA', { month: 'short', day: 'numeric' })}
                                            </div>
                                            <div className="booking-participants">
                                              {booking.participants.map((p, idx) => (
                                                <div key={idx} className="booking-participant-name">
                                                  {typeof p === 'object' ? p.name : p}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        ) : (
                                          new Date(booking.date).toLocaleDateString(language === 'en' ? 'en-US' : 'ar-SA', { month: 'short', day: 'numeric' })
                                        )}
                                      </div>
                                      {hoveredBooking === booking.id && (
                                        <div className="booking-tooltip">
                                          <div style={{ marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '6px' }}>
                                            <div><strong>{booking.resource}</strong></div>
                                            <div style={{ fontSize: '11px', marginTop: '2px' }}>{booking.startTime} - {booking.endTime}</div>
                                            <div style={{ fontSize: '11px', marginTop: '2px' }}>{new Date(booking.date).toLocaleDateString()}</div>
                                          </div>
                                          {booking.participants.length > 0 && (
                                            <div style={{ marginBottom: '8px' }}>
                                              <div style={{ fontWeight: '600', marginBottom: '4px', fontSize: '12px' }}>{t.participants}:</div>
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                {booking.participants.map((p, idx) => (
                                                  <div key={idx} style={{ 
                                                    padding: '2px 0',
                                                    fontSize: '13px',
                                                    lineHeight: '1.4'
                                                  }}>
                                                    • {typeof p === 'object' ? p.name : p}
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                          {booking.amount && (
                                            <div style={{ marginBottom: '8px', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '6px' }}>
                                              <div>
                                                {t.amount}: {booking.amount}
                                                {paymentStatus === 'paid' 
                                                  ? ` (${language === 'en' ? 'Paid' : 'مدفوع'})`
                                                  : paymentStatus === 'partially_paid'
                                                  ? ` (${language === 'en' ? 'Partially Paid' : 'مدفوع جزئياً'})`
                                                  : ` (${language === 'en' ? 'Not Paid' : 'غير مدفوع'})`
                                                }
                                              </div>
                                            </div>
                                          )}
                                          <div style={{ marginTop: '8px', fontSize: '10px', color: '#b0bec5', fontStyle: 'italic', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '6px' }}>
                                            {language === 'en' ? 'Click to edit' : 'انقر للتعديل'}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          })}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Booking Form Modal */}
              {showBookingModal && (
                <BookingFormModal
                  bookingData={bookingFormData || {}}
                  members={members}
                  courts={getCourts()}
                  clubOpeningTime={currentClub?.settings?.openingTime}
                  clubClosingTime={currentClub?.settings?.closingTime}
                  onSave={saveBooking}
                  onDelete={(bookingId) => {
                    if (!bookingId || bookingId === null || bookingId === undefined) {
                      console.error('Cannot delete: bookingId is invalid', bookingId)
                      return
                    }
                    deleteBookingAndInvoice(bookingId)
                  }}
                  onCancel={() => {
                    setShowBookingModal(false)
                    setBookingFormData(null)
                  }}
                  translations={t}
                  language={language}
                />
              )}

              {/* Tournament Booking Modal removed from here - now in main component at the end */}

            </>
          ) : activeTab === 'accounting' ? (
            <>
              <div className="section">
                <h2>{t.accounting}</h2>
                
                {/* Summary Cards */}
                {(() => {
                  const stats = getAccountingStatistics()
                  return (
                    <div className="accounting-summary-cards">
                      <div className="summary-card income">
                        <h3>{t.totalIncome}</h3>
                        <p>{stats.totalIncome.toFixed(2)}</p>
                      </div>
                      <div className="summary-card paid">
                        <h3>{t.totalPaid}</h3>
                        <p>{stats.totalPaid.toFixed(2)}</p>
                      </div>
                      <div className="summary-card pending">
                        <h3>{t.totalPending}</h3>
                        <p>{stats.totalPending.toFixed(2)}</p>
                      </div>
                      <div className="summary-card unpaid">
                        <h3>{t.totalUnpaid}</h3>
                        <p>{stats.totalUnpaid.toFixed(2)}</p>
                      </div>
                    </div>
                  )
                })()}

                {/* Filters */}
                <div className="accounting-filters">
                  <div className="filter-group">
                    <label>{t.filterByDate}</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input
                        type="date"
                        value={accountingDateFrom}
                        onChange={(e) => setAccountingDateFrom(e.target.value)}
                        className="search-input"
                        placeholder={t.fromDate}
                      />
                      <input
                        type="date"
                        value={accountingDateTo}
                        onChange={(e) => setAccountingDateTo(e.target.value)}
                        className="search-input"
                        placeholder={t.toDate}
                      />
                    </div>
                  </div>
                  <div className="filter-group">
                    <label>{t.filterByStatus}</label>
                    <select
                      value={accountingStatusFilter}
                      onChange={(e) => setAccountingStatusFilter(e.target.value)}
                      className="search-input"
                    >
                      <option value="all">{t.all}</option>
                      <option value="paid">{t.paid}</option>
                      <option value="partially_paid">{t.partiallyPaid}</option>
                      <option value="not_paid">{t.notPaid}</option>
                    </select>
                  </div>
                  <div className="filter-group">
                    <label>{t.filterByCourt}</label>
                    <select
                      value={accountingCourtFilter}
                      onChange={(e) => setAccountingCourtFilter(e.target.value)}
                      className="search-input"
                    >
                      <option value="all">{t.all}</option>
                      {getCourts().map(court => (
                        <option key={court} value={court}>{court}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Accounting Table */}
                {(() => {
                  const filtered = getFilteredBookings()
                  
                  if (filtered.length > 0) {
                    return (
                      <div className="accounting-table-container">
                        <table className="accounting-table">
                          <thead>
                            <tr>
                              <th>{t.bookingId}</th>
                              <th>{t.bookingDate}</th>
                              <th>{t.bookingTime}</th>
                              <th>{t.court}</th>
                              <th>{t.amount}</th>
                              <th>{t.paidAmount}</th>
                              <th>{t.remainingAmount}</th>
                              <th>{t.paymentMethod}</th>
                              <th>{t.status}</th>
                              <th>{t.actions}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map(booking => {
                              const totalAmount = parseFloat(booking.amount || 0)
                              const paidAmount = calculateTotalPaid(booking)
                              const remainingAmount = totalAmount - paidAmount
                              const status = getPaymentStatus(booking)
                              
                              return (
                                <tr key={booking.id}>
                                  <td>{booking.id}</td>
                                  <td>{formatBookingDate(booking.date, language)}</td>
                                  <td>{formatBookingTime(booking.startTime)} - {formatBookingTime(booking.endTime)}</td>
                                  <td>{booking.resource}</td>
                                  <td>{totalAmount.toFixed(2)}</td>
                                  <td>{paidAmount.toFixed(2)}</td>
                                  <td>{remainingAmount.toFixed(2)}</td>
                                  <td>
                                    {booking.participants && booking.participants.length > 0 ? (
                                      booking.participants.slice(0, 2).map((p, idx) => {
                                        const participant = typeof p === 'object' ? p : { paymentMethod: 'card' }
                                        return (
                                          <span key={idx} className="payment-method-tag">
                                            {t[participant.paymentMethod] || participant.paymentMethod}
                                          </span>
                                        )
                                      })
                                    ) : (
                                      <span className="payment-method-tag">{t.card}</span>
                                    )}
                                  </td>
                                  <td>
                                    <span className={`status-badge ${status}`}>
                                      {getPaymentStatusLabel(status, language)}
                                    </span>
                                  </td>
                                  <td>
                                    <button 
                                      className="btn-secondary btn-small"
                                      onClick={() => {
                                        setBookingFormData(booking)
                                        setShowBookingModal(true)
                                      }}
                                    >
                                      {t.viewDetails}
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )
                  } else {
                    return (
                      <p style={{ textAlign: 'center', color: '#95a5a6', padding: '40px' }}>
                        {t.noAccountingRecords}
                      </p>
                    )
                  }
                })()}

                <div style={{ marginTop: '20px', textAlign: 'right' }}>
                  <button className="btn-primary" onClick={exportAccountingReport}>
                    {t.exportReport}
                  </button>
                </div>
              </div>

              {/* Booking Form Modal for Editing */}
              {showBookingModal && bookingFormData && activeTab === 'accounting' && (
                <BookingFormModal
                  bookingData={bookingFormData}
                  members={members}
                  courts={getCourts()}
                  clubOpeningTime={currentClub?.settings?.openingTime}
                  clubClosingTime={currentClub?.settings?.closingTime}
                  onSave={(bookingData) => {
                    saveBooking(bookingData)
                    setShowBookingModal(false)
                    setBookingFormData(null)
                  }}
                  onDelete={(bookingId) => {
                    if (!bookingId || bookingId === null || bookingId === undefined) {
                      console.error('Cannot delete: bookingId is invalid', bookingId)
                      return
                    }
                    deleteBookingAndInvoice(bookingId)
                  }}
                  onCancel={() => {
                    setShowBookingModal(false)
                    setBookingFormData(null)
                  }}
                  translations={t}
                  language={language}
                />
              )}
            </>
          ) : (
            <>
          {/* Tournament Scheduling - King tab: بطاقات البطولات أو صفحة تفاصيل البطولة */}
          {activeTab === 'king' && !viewedTournamentBooking && (
            <div className="tournament-schedule-page">
              <div className="tournament-schedule-header">
                <h2 className="tournament-schedule-title">{language === 'en' ? 'Schedule Tournament' : 'جدولة البطولة'}</h2>
                <button
                  type="button"
                  className="btn-primary btn-schedule-new"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const today = new Date().toISOString().split('T')[0]
                    setTournamentBookingData({
                      date: today,
                      startTime: currentClub?.settings?.openingTime || '09:00',
                      endTime: currentClub?.settings?.closingTime || '18:00',
                      tournamentType: 'king'
                    })
                    setShowTournamentBookingModal(true)
                  }}
                >
                  {language === 'en' ? '+ Schedule New Tournament' : '+ جدولة بطولة جديدة'}
                </button>
              </div>
              {(() => {
                const today = new Date().toISOString().split('T')[0]
                const tournamentBookings = bookings.filter(b =>
                  b.isTournament &&
                  b.tournamentType === 'king' &&
                  b.date >= today
                ).sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || ''))
                if (tournamentBookings.length === 0) {
                  return (
                    <div className="tournament-empty-state">
                      <p>{language === 'en' ? 'No tournaments scheduled yet.' : 'لا توجد بطولات مجدولة بعد.'}</p>
                      <p className="tournament-empty-hint">{language === 'en' ? 'Click the button above to schedule a tournament.' : 'اضغط على الزر أعلاه لجدولة بطولة.'}</p>
                    </div>
                  )
                }
                return (
                  <div className="tournament-cards-section">
                    <h3 className="tournament-cards-heading">{language === 'en' ? 'Scheduled Tournaments' : 'البطولات المجدولة'} <span className="tournament-count">({tournamentBookings.length})</span></h3>
                    <div className="tournament-cards-grid">
                      {tournamentBookings.map(booking => (
                        <div key={booking.id} className="tournament-card">
                          <div className="tournament-card-header">
                            <span className="tournament-card-date">{new Date(booking.date).toLocaleDateString(language === 'en' ? 'en-US' : 'ar-SA', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
                            <span className="tournament-card-badge">{language === 'en' ? 'King of the Court' : 'ملك الملعب'}</span>
                          </div>
                          <div className="tournament-card-time">{booking.startTime} – {booking.endTime}</div>
                          <div className="tournament-card-actions">
                            <button
                              type="button"
                              className="btn-primary tournament-card-view"
                              onClick={() => {
                                setViewedTournamentBooking({ id: booking.id, date: booking.date, startTime: booking.startTime, endTime: booking.endTime, tournamentType: booking.tournamentType || 'king' })
                                setContentTab('teams')
                              }}
                            >
                              {language === 'en' ? 'View Tournament' : 'استعراض البطولة'}
                            </button>
                            <button
                              type="button"
                              className="btn-danger btn-small tournament-card-delete"
                              onClick={async () => {
                                if (confirm(language === 'en' ? `Delete tournament on ${booking.date} (${booking.startTime}-${booking.endTime})?` : `حذف البطولة بتاريخ ${booking.date} (${booking.startTime}-${booking.endTime})؟`)) {
                                  await handleDeleteTournamentBooking(booking)
                                  alert(language === 'en' ? 'Tournament deleted.' : 'تم حذف البطولة.')
                                }
                              }}
                            >
                              {language === 'en' ? 'Delete' : 'حذف'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
          {/* صفحة تفاصيل البطولة - ملك الملعب */}
          {activeTab === 'king' && viewedTournamentBooking && (
            <div className="tournament-detail-page">
              <div className="tournament-detail-header">
                <button type="button" className="tournament-detail-back" onClick={() => setViewedTournamentBooking(null)} aria-label={language === 'en' ? 'Back' : 'رجوع'}>
                  ← {language === 'en' ? 'Back to list' : 'رجوع للقائمة'}
                </button>
                <div className="tournament-detail-title-wrap">
                  <h2 className="tournament-detail-title">
                    {language === 'en' ? 'Tournament' : 'البطولة'}: {new Date(viewedTournamentBooking.date).toLocaleDateString(language === 'en' ? 'en-US' : 'ar-SA')} · {viewedTournamentBooking.startTime} – {viewedTournamentBooking.endTime}
                  </h2>
                  <span className="tournament-detail-badge">{language === 'en' ? 'King of the Court' : 'ملك الملعب'}</span>
                </div>
              </div>
            </div>
          )}

          {/* جدولة بطولة سوشيال - بطاقات البطولات أو صفحة تفاصيل البطولة */}
          {activeTab === 'social' && !viewedTournamentBooking && (
            <div className="tournament-schedule-page">
              <div className="tournament-schedule-header">
                <h2 className="tournament-schedule-title">{language === 'en' ? 'Schedule Tournament' : 'جدولة البطولة'}</h2>
                <button
                  type="button"
                  className="btn-primary btn-schedule-new"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const today = new Date().toISOString().split('T')[0]
                    setTournamentBookingData({
                      date: today,
                      startTime: currentClub?.settings?.openingTime || '09:00',
                      endTime: currentClub?.settings?.closingTime || '18:00',
                      tournamentType: 'social'
                    })
                    setShowTournamentBookingModal(true)
                  }}
                >
                  {language === 'en' ? '+ Schedule New Tournament' : '+ جدولة بطولة جديدة'}
                </button>
              </div>
              {(() => {
                const today = new Date().toISOString().split('T')[0]
                const tournamentBookings = bookings.filter(b =>
                  b.isTournament &&
                  b.tournamentType === 'social' &&
                  b.date >= today
                ).sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || ''))
                if (tournamentBookings.length === 0) {
                  return (
                    <div className="tournament-empty-state">
                      <p>{language === 'en' ? 'No tournaments scheduled yet.' : 'لا توجد بطولات مجدولة بعد.'}</p>
                      <p className="tournament-empty-hint">{language === 'en' ? 'Click the button above to schedule a tournament.' : 'اضغط على الزر أعلاه لجدولة بطولة.'}</p>
                    </div>
                  )
                }
                return (
                  <div className="tournament-cards-section">
                    <h3 className="tournament-cards-heading">{language === 'en' ? 'Scheduled Tournaments' : 'البطولات المجدولة'} <span className="tournament-count">({tournamentBookings.length})</span></h3>
                    <div className="tournament-cards-grid">
                      {tournamentBookings.map(booking => (
                        <div key={booking.id} className="tournament-card">
                          <div className="tournament-card-header">
                            <span className="tournament-card-date">{new Date(booking.date).toLocaleDateString(language === 'en' ? 'en-US' : 'ar-SA', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
                            <span className="tournament-card-badge">{language === 'en' ? 'Social Tournament' : 'بطولة سوشيال'}</span>
                          </div>
                          <div className="tournament-card-time">{booking.startTime} – {booking.endTime}</div>
                          <div className="tournament-card-actions">
                            <button
                              type="button"
                              className="btn-primary tournament-card-view"
                              onClick={() => {
                                setViewedTournamentBooking({ id: booking.id, date: booking.date, startTime: booking.startTime, endTime: booking.endTime, tournamentType: booking.tournamentType || 'social' })
                                setContentTab('teams')
                              }}
                            >
                              {language === 'en' ? 'View Tournament' : 'استعراض البطولة'}
                            </button>
                            <button
                              type="button"
                              className="btn-danger btn-small tournament-card-delete"
                              onClick={async () => {
                                if (confirm(language === 'en' ? `Delete tournament on ${booking.date} (${booking.startTime}-${booking.endTime})?` : `حذف البطولة بتاريخ ${booking.date} (${booking.startTime}-${booking.endTime})؟`)) {
                                  await handleDeleteTournamentBooking(booking)
                                  alert(language === 'en' ? 'Tournament deleted.' : 'تم حذف البطولة.')
                                }
                              }}
                            >
                              {language === 'en' ? 'Delete' : 'حذف'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
          {/* صفحة تفاصيل البطولة - سوشيال */}
          {activeTab === 'social' && viewedTournamentBooking && (
            <div className="tournament-detail-page">
              <div className="tournament-detail-header">
                <button type="button" className="tournament-detail-back" onClick={() => setViewedTournamentBooking(null)} aria-label={language === 'en' ? 'Back' : 'رجوع'}>
                  ← {language === 'en' ? 'Back to list' : 'رجوع للقائمة'}
                </button>
                <div className="tournament-detail-title-wrap">
                  <h2 className="tournament-detail-title">
                    {language === 'en' ? 'Tournament' : 'البطولة'}: {new Date(viewedTournamentBooking.date).toLocaleDateString(language === 'en' ? 'en-US' : 'ar-SA')} · {viewedTournamentBooking.startTime} – {viewedTournamentBooking.endTime}
                  </h2>
                  <span className="tournament-detail-badge">{language === 'en' ? 'Social Tournament' : 'بطولة سوشيال'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Content Tabs Navigation - Show if there are matches, teams, or a tournament is being viewed */}
          {(() => {
            if (activeTab === 'king') {
              const hasMatches = matches.length > 0
              const hasTeams = teams.length > 0
              const isViewingTournament = viewedTournamentBooking != null
              if (!hasMatches && !hasTeams && !isViewingTournament) return null
            }
            if (activeTab === 'social') {
              const isViewingTournament = viewedTournamentBooking != null
              if (!isViewingTournament) return null
            }
            
            return (
              <div className={viewedTournamentBooking && (activeTab === 'king' || activeTab === 'social') ? 'tournament-detail-content' : ''} style={{ marginTop: viewedTournamentBooking && (activeTab === 'king' || activeTab === 'social') ? '0' : 0 }}>
              <div className="content-tabs-container">
                <div className="content-tabs">
                  {/* تبويب الترتيب - يظهر دائماً */}
                  <button
                    className={`content-tab ${contentTab === 'standings' ? 'active' : ''}`}
                    onClick={() => setContentTab('standings')}
                  >
                    {t.standingsTab}
                  </button>
                  <button
                    className={`content-tab ${contentTab === 'teams' ? 'active' : ''}`}
                    onClick={() => setContentTab('teams')}
                    style={{ display: (activeTab === 'social' && (tournamentStage === 'semi' || tournamentStage === 'final')) ? 'none' : 'inline-flex' }}
                  >
                    {t.teamsTab}
                  </button>
                  <button
                    className={`content-tab ${contentTab === 'courts' ? 'active' : ''}`}
                    onClick={() => setContentTab('courts')}
                  >
                    {t.courtsTab}
                  </button>
                  {matches.length > 0 && (
                    <button
                      className={`content-tab ${contentTab === 'history' ? 'active' : ''}`}
                      onClick={() => setContentTab('history')}
                    >
                      {t.historyTab} ({matches.length})
                    </button>
                  )}
                  {activeTab === 'king' && (
                    <button
                      className={`content-tab ${contentTab === 'schedule' ? 'active' : ''}`}
                      onClick={() => setContentTab('schedule')}
                    >
                      {t.scheduleTab}
                    </button>
                  )}
                </div>
              </div>
              </div>
            )
          })()}

          {/* Tab Content - الترتيب يظهر دائماً، مع رسالة عند عدم وجود مباريات */}
          {contentTab && contentTab !== '' && contentTab === 'standings' && (
            <div className="tab-content">
              <div className="section">
                <h2>{t.standings}</h2>
                {matches.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#666', padding: '24px' }}>
                    {language === 'en' ? 'No matches played yet. Start a match to see standings.' : 'لم يتم لعب أي مباريات بعد. ابدأ مباراة لرؤية الترتيب.'}
                  </p>
                ) : (
                  <>
              {activeTab === 'social' && Object.keys(groupStage).length > 0 ? (
              <div className="group-standings-container">
                {Object.keys(groupStage).map((groupId, idx) => {
                  const groupStandings = getGroupStandings(groupId)
                  return (
                    <div key={groupId} className="group-standings">
                      <h3>{t.group} {idx + 1} - {t.standings}</h3>
                      <table className="standings-table">
                        <thead>
                          <tr>
                            <th>{t.rank}</th>
                            <th>{t.team}</th>
                            <th>{t.wins}</th>
                            <th>{t.losses}</th>
                            <th>{t.draws}</th>
                            <th>{t.gamesWon}</th>
                            <th>{t.gamesLost}</th>
                            <th>{t.gamesDiff}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupStandings.map((team, index) => {
                            const gamesDiff = team.gamesWon - team.gamesLost
                            return (
                              <tr key={team.id} className={index === 0 ? 'top-4' : ''}>
                                <td>{index + 1}</td>
                                <td><strong>{team.name}</strong></td>
                                <td>{team.wins}</td>
                                <td>{team.losses}</td>
                                <td>{team.draws || 0}</td>
                                <td>{team.gamesWon}</td>
                                <td>{team.gamesLost}</td>
                                <td className={gamesDiff > 0 ? 'positive' : gamesDiff < 0 ? 'negative' : ''}>
                                  {gamesDiff > 0 ? '+' : ''}{gamesDiff}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                })}
              </div>
            ) : (
              <table className="standings-table">
                <thead>
                  <tr>
                    <th>{t.rank}</th>
                    <th>{t.team}</th>
                    <th>{t.wins}</th>
                    <th>{t.losses}</th>
                    <th>{t.draws}</th>
                    <th>{t.gamesWon}</th>
                    <th>{t.gamesLost}</th>
                    <th>{t.gamesDiff}</th>
                    {activeTab === 'king' && <th>{t.matches}</th>}
                  </tr>
                </thead>
                <tbody>
                  {standings.map((team, index) => {
                    const gamesDiff = team.gamesWon - team.gamesLost
                    return (
                      <tr key={team.id} className={index < 4 ? 'top-4' : ''}>
                        <td>{index + 1}</td>
                        <td><strong>{team.name}</strong></td>
                        <td>{team.wins}</td>
                        <td>{team.losses}</td>
                        <td>{team.draws || 0}</td>
                        <td>{team.gamesWon}</td>
                        <td>{team.gamesLost}</td>
                        <td className={gamesDiff > 0 ? 'positive' : gamesDiff < 0 ? 'negative' : ''}>
                          {gamesDiff > 0 ? '+' : ''}{gamesDiff}
                        </td>
                        {activeTab === 'king' && <td>{team.matchesPlayed}/7</td>}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {contentTab === 'teams' && (
            <div className="tab-content">
              {!(activeTab === 'social' && (tournamentStage === 'semi' || tournamentStage === 'final')) && (
                <div className="section">
            <div className="section-header">
              <h2>{t.teams} ({teams.length})</h2>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {activeTab === 'social' && Object.keys(groupStage).length === 0 && teams.length >= 12 && (
                  <button 
                    className="btn-primary" 
                    onClick={initializeGroups}
                  >
                    {language === 'en' ? 'Initialize Groups' : 'تهيئة المجموعات'}
                  </button>
                )}
                <button className="btn-primary" onClick={addTeam}>{t.add}</button>
              </div>
            </div>
            {activeTab === 'social' && tournamentStage === 'group' && Object.keys(groupStage).length > 0 ? (
              <div className="drag-drop-container">
                <div className="unassigned-teams">
                  <h3>Unassigned Teams</h3>
                  <div className="teams-list">
                    {getUnassignedTeams().map(team => (
                      <div 
                        key={team.id} 
                        className="team-item draggable"
                        draggable
                        onDragStart={(e) => handleDragStart(e, team)}
                      >
                        <input
                          type="text"
                          value={team.name}
                          onChange={(e) => updateTeamName(team.id, e.target.value)}
                          className="team-name-input"
                        />
                        <button 
                          className="btn-danger btn-small"
                          onClick={() => removeTeam(team.id)}
                        >
                          −
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="groups-container">
                  {Object.keys(groupStage).map((groupId, idx) => (
                    <div key={groupId} className="group-slot">
                      <h3>{t.group} {idx + 1}</h3>
                      <div 
                        className="group-teams-dropzone"
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => {
                          handleDrop(e, groupId)
                          e.currentTarget.classList.remove('drag-over')
                        }}
                      >
                        {groupStage[groupId].map(team => (
                          <div key={team.id} className="team-item assigned">
                            <input
                              type="text"
                              value={team.name}
                              onChange={(e) => updateTeamName(team.id, e.target.value)}
                              className="team-name-input"
                              readOnly
                            />
                            <button 
                              className="btn-danger btn-small"
                              onClick={() => removeTeamFromGroup(team.id, groupId)}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        {groupStage[groupId].length < 3 && (
                          <div className="drop-hint">
                            {t.group} {idx + 1} ({groupStage[groupId].length}/3)
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {activeTab === 'social' && Object.keys(groupStage).length === 0 && (
                  <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#e8f4f8', borderRadius: '8px', fontSize: '14px', color: '#2c3e50' }}>
                    {teams.length < getAvailableCourtsCount() * 3 ? (
                      <p style={{ margin: 0 }}>
                        {language === 'en' 
                          ? `Add at least ${getAvailableCourtsCount() * 3} teams to initialize groups (${getAvailableCourtsCount()} courts × 3 teams each). Currently ${teams.length} teams.`
                          : `أضف ${getAvailableCourtsCount() * 3} فريقاً على الأقل لتهيئة المجموعات (${getAvailableCourtsCount()} ملاعب × 3 فرق لكل ملعب). حالياً ${teams.length} فريق.`
                        }
                      </p>
                    ) : (
                      <p style={{ margin: 0 }}>
                        {language === 'en' 
                          ? `Click "Initialize Groups" above to create ${getAvailableCourtsCount()} groups. Then drag and drop teams into each group (3 teams per group).`
                          : `انقر على "تهيئة المجموعات" أعلاه لإنشاء ${getAvailableCourtsCount()} مجموعات. ثم اسحب وأفلت الفِرق في كل مجموعة (3 فرق لكل مجموعة).`
                        }
                      </p>
                    )}
                  </div>
                )}
                <div className="teams-list">
                  {teams.map(team => (
                  <div key={team.id} className="team-item-with-members">
                    <div className="team-main">
                      <input
                        type="text"
                        value={team.name}
                        onChange={(e) => updateTeamName(team.id, e.target.value)}
                        className="team-name-input"
                      />
                      <button 
                        className="btn-danger btn-small"
                        onClick={() => removeTeam(team.id)}
                      >
                        −
                      </button>
                    </div>
                    {members.length > 0 && (
                      <div className="team-members-selection">
                        <label className="team-members-label">{t.teamMembers}:</label>
                        <div className="selected-members-chips">
                          {(team.memberIds || []).length > 0 ? (
                            (team.memberIds || []).map(memberId => {
                              const member = members.find(m => m.id === memberId)
                              if (!member) return null
                              return (
                                <span key={memberId} className="member-chip">
                                  {member.name}
                                  <button
                                    className="chip-remove"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      const currentIds = team.memberIds || []
                                      const newIds = currentIds.filter(id => id !== memberId)
                                      updateCurrentState(state => ({
                                        ...state,
                                        teams: (state.teams || []).map(t => 
                                          t.id === team.id ? { ...t, memberIds: newIds } : t
                                        )
                                      }))
                                    }}
                                  >
                                    ×
                                  </button>
                                </span>
                              )
                            })
                          ) : (
                            <span className="no-selected-members">{t.selectTeamMembers}</span>
                          )}
                        </div>
                        <button
                          className="btn-secondary btn-small"
                          style={{ marginTop: '8px', width: '100%' }}
                          onClick={() => {
                            setOpenMemberSelectorForTeam(team.id)
                            setMemberSelectorSearch('')
                          }}
                        >
                          {t.selectTeamMembers}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                </div>
              </>
            )}
                </div>
              )}
            </div>
          )}

          {contentTab === 'courts' && (
            <div className="tab-content">
              {/* Active Courts Section */}
              {((activeTab === 'king' && teams.length >= 2) || (activeTab === 'social' && Object.keys(groupStage).length > 0)) && (
                <div className="section">
                  <div className="section-header">
                    <h2>
                      {activeTab === 'social' && tournamentStage === 'group' 
                        ? t.groupStage
                        : activeTab === 'social' && tournamentStage === 'semi'
                        ? t.semiFinal
                        : activeTab === 'social' && tournamentStage === 'final'
                        ? t.final
                        : t.courts}
                      {' - ' + (language === 'en' ? 'Active' : 'نشط')}
                    </h2>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button 
                        className="btn-secondary" 
                        onClick={assignToCourts}
                        disabled={activeTab === 'social' && (
                          (tournamentStage === 'semi' || tournamentStage === 'final') ||
                          (Object.keys(groupStage).length > 0 && courts.some(c => c && c.isGroupStage))
                        )}
                      >
                        {activeTab === 'social' && Object.keys(groupStage).length > 0 && courts.every(c => !c) && tournamentStage === 'group'
                          ? 'Start Group Stage'
                          : activeTab === 'social' && (tournamentStage === 'semi' || tournamentStage === 'final')
                          ? (tournamentStage === 'semi' ? 'Semi-Finals In Progress' : 'Finals In Progress')
                          : t.assignMatches}
                      </button>
                    </div>
                  </div>
                  <div className="courts-grid">
                    {courts.map((court, index) => (
                      <div key={index} className={`court-card ${!court ? 'empty-court' : ''}`}>
                        {court ? (
                          <>
                            <h3>
                              {court?.isSemiFinal && t.semiFinal} {court?.isFinal && t.final}
                              {!court?.isSemiFinal && !court?.isFinal && (() => {
                                // Get court name from club.courts if available
                                const availableCourts = currentClub?.courts?.filter(c => !c.maintenance) || []
                                const courtInfo = availableCourts[index]
                                if (courtInfo) {
                                  return language === 'ar' && courtInfo.nameAr ? courtInfo.nameAr : courtInfo.name
                                }
                                return `${t.court} ${index + 1}`
                              })()}
                              {court?.isGroupStage && ` - ${t.group} ${index + 1}`}
                            </h3>
                            <div className="match-teams">
                              <div>{court.team1.name}</div>
                              <div className="vs">{t.vs}</div>
                              <div>{court.team2.name}</div>
                            </div>
                            {activeTab === 'king' && (
                              <>
                                {currentState.matchTimers?.[court.courtNumber] ? (
                                  <>
                                    <div className={`match-timer ${getRemainingTime(court.courtNumber) === t.timeUp || (currentState.matchTimers[court.courtNumber] && (900 - currentState.matchTimers[court.courtNumber].elapsed) < 60) ? 'time-warning' : ''} ${currentState.matchTimers[court.courtNumber].paused ? 'paused' : ''}`}>
                                      {getRemainingTime(court.courtNumber)}
                                      {currentState.matchTimers[court.courtNumber].paused && <span className="paused-label"> {t.paused}</span>}
                                    </div>
                                    <div className="timer-controls">
                                      {currentState.matchTimers[court.courtNumber].paused ? (
                                        <button
                                          className="btn-secondary"
                                          style={{ width: '100%', marginBottom: '8px' }}
                                          onClick={() => resumeTimer(court.courtNumber)}
                                        >
                                          {t.resume}
                                        </button>
                                      ) : (
                                        <button
                                          className="btn-secondary"
                                          style={{ width: '100%', marginBottom: '8px' }}
                                          onClick={() => pauseTimer(court.courtNumber)}
                                        >
                                          {t.pause}
                                        </button>
                                      )}
                                      <button
                                        className="btn-danger"
                                        style={{ width: '100%', marginBottom: '15px' }}
                                        onClick={() => resetTimer(court.courtNumber)}
                                      >
                                        {t.reset}
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <button
                                    className="btn-secondary"
                                    style={{ width: '100%', marginBottom: '15px' }}
                                    onClick={() => startMatchTimer(court.courtNumber)}
                                  >
                                    {t.startTimer}
                                  </button>
                                )}
                              </>
                            )}
                            {activeTab === 'social' && court.isFinal ? (
                              // Final match: Show sets separately
                              <div>
                                {/* Set 1 */}
                                {court.currentSet === 'set1' && (
                                  <div>
                                    <div style={{ marginBottom: '10px', fontWeight: '500', color: '#2c3e50', fontSize: '14px' }}>
                                      {language === 'en' ? 'Set 1 (out of 6 games)' : 'المجموعة الأولى (من 6 ألعاب)'}
                                    </div>
                                    <div className="score-inputs">
                                      <div>
                                        <label>{court.team1.name}</label>
                                        <input
                                          type="number"
                                          min="0"
                                          max="7"
                                          id={`team1-set1-${index}`}
                                          key={`team1-set1-${court.team1.id}-${court.team2.id}`}
                                          defaultValue={court.set1Team1Games !== null ? court.set1Team1Games : "0"}
                                        />
                                      </div>
                                      <div>
                                        <label>{court.team2.name}</label>
                                        <input
                                          type="number"
                                          min="0"
                                          max="7"
                                          id={`team2-set1-${index}`}
                                          key={`team2-set1-${court.team1.id}-${court.team2.id}`}
                                          defaultValue={court.set1Team2Games !== null ? court.set1Team2Games : "0"}
                                        />
                                      </div>
                                    </div>
                                    <button
                                      className="btn-primary"
                                      style={{ width: '100%', marginTop: '10px' }}
                                      onClick={() => {
                                        const team1Games = parseInt(document.getElementById(`team1-set1-${index}`).value) || 0
                                        const team2Games = parseInt(document.getElementById(`team2-set1-${index}`).value) || 0
                                        recordFinalSet(index, 'set1', team1Games, team2Games)
                                      }}
                                    >
                                      {language === 'en' ? 'Record Set 1' : 'تسجيل المجموعة الأولى'}
                                    </button>
                                  </div>
                                )}
                                
                                {/* Set 2 - Show if Set 1 is complete */}
                                {court.currentSet === 'set2' && (
                                  <div>
                                    {court.set1Team1Games !== null && (
                                      <div style={{ marginBottom: '10px', fontSize: '13px', color: '#7f8c8d' }}>
                                        {language === 'en' ? `Set 1: ${court.set1Team1Games} - ${court.set1Team2Games}` : `المجموعة الأولى: ${court.set1Team1Games} - ${court.set1Team2Games}`}
                                      </div>
                                    )}
                                    <div style={{ marginBottom: '10px', fontWeight: '500', color: '#2c3e50', fontSize: '14px' }}>
                                      {language === 'en' ? 'Set 2 (out of 6 games)' : 'المجموعة الثانية (من 6 ألعاب)'}
                                    </div>
                                    <div className="score-inputs">
                                      <div>
                                        <label>{court.team1.name}</label>
                                        <input
                                          type="number"
                                          min="0"
                                          max="7"
                                          id={`team1-set2-${index}`}
                                          key={`team1-set2-${court.team1.id}-${court.team2.id}`}
                                          defaultValue={court.set2Team1Games !== null ? court.set2Team1Games : "0"}
                                        />
                                      </div>
                                      <div>
                                        <label>{court.team2.name}</label>
                                        <input
                                          type="number"
                                          min="0"
                                          max="7"
                                          id={`team2-set2-${index}`}
                                          key={`team2-set2-${court.team1.id}-${court.team2.id}`}
                                          defaultValue={court.set2Team2Games !== null ? court.set2Team2Games : "0"}
                                        />
                                      </div>
                                    </div>
                                    <button
                                      className="btn-primary"
                                      style={{ width: '100%', marginTop: '10px' }}
                                      onClick={() => {
                                        const team1Games = parseInt(document.getElementById(`team1-set2-${index}`).value) || 0
                                        const team2Games = parseInt(document.getElementById(`team2-set2-${index}`).value) || 0
                                        recordFinalSet(index, 'set2', team1Games, team2Games)
                                      }}
                                    >
                                      {language === 'en' ? 'Record Set 2' : 'تسجيل المجموعة الثانية'}
                                    </button>
                                  </div>
                                )}
                                
                                {/* Tiebreak - Show if both sets are complete and it's 1-1 */}
                                {court.currentSet === 'tiebreak' && (
                                  <div>
                                    {court.set1Team1Games !== null && court.set2Team1Games !== null && (
                                      <div style={{ marginBottom: '10px', fontSize: '13px', color: '#7f8c8d' }}>
                                        {language === 'en' 
                                          ? `Set 1: ${court.set1Team1Games} - ${court.set1Team2Games}, Set 2: ${court.set2Team1Games} - ${court.set2Team2Games}`
                                          : `المجموعة الأولى: ${court.set1Team1Games} - ${court.set1Team2Games}, المجموعة الثانية: ${court.set2Team1Games} - ${court.set2Team2Games}`
                                        }
                                      </div>
                                    )}
                                    <div style={{ marginBottom: '10px', fontWeight: '500', color: '#2c3e50', fontSize: '14px' }}>
                                      {language === 'en' ? 'Tiebreak (out of 7 points)' : 'كسر التعادل (من 7 نقاط)'}
                                    </div>
                                    <div className="score-inputs">
                                      <div>
                                        <label>{court.team1.name}</label>
                                        <input
                                          type="number"
                                          min="0"
                                          max="7"
                                          id={`team1-tiebreak-${index}`}
                                          key={`team1-tiebreak-${court.team1.id}-${court.team2.id}`}
                                          defaultValue={court.tiebreakTeam1Points !== null ? court.tiebreakTeam1Points : "0"}
                                        />
                                      </div>
                                      <div>
                                        <label>{court.team2.name}</label>
                                        <input
                                          type="number"
                                          min="0"
                                          max="7"
                                          id={`team2-tiebreak-${index}`}
                                          key={`team2-tiebreak-${court.team1.id}-${court.team2.id}`}
                                          defaultValue={court.tiebreakTeam2Points !== null ? court.tiebreakTeam2Points : "0"}
                                        />
                                      </div>
                                    </div>
                                    <button
                                      className="btn-primary"
                                      style={{ width: '100%', marginTop: '10px' }}
                                      onClick={() => {
                                        const team1Points = parseInt(document.getElementById(`team1-tiebreak-${index}`).value) || 0
                                        const team2Points = parseInt(document.getElementById(`team2-tiebreak-${index}`).value) || 0
                                        recordFinalSet(index, 'tiebreak', team1Points, team2Points)
                                      }}
                                    >
                                      {language === 'en' ? 'Record Tiebreak' : 'تسجيل كسر التعادل'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              // Regular match (not final)
                              <>
                                <div className="score-inputs" key={`${court.team1.id}-${court.team2.id}-${court.courtNumber}`}>
                                  <div>
                                    <label>{court.team1.name}</label>
                                    <input
                                      type="number"
                                      min="0"
                                      max={activeTab === 'social' ? getMaxScoreForSocialTournament(court) : 6}
                                      id={`team1-games-${index}`}
                                      key={`team1-${court.team1.id}-${court.team2.id}`}
                                      defaultValue="0"
                                    />
                                  </div>
                                  <div>
                                    <label>{court.team2.name}</label>
                                    <input
                                      type="number"
                                      min="0"
                                      max={activeTab === 'social' ? getMaxScoreForSocialTournament(court) : 6}
                                      id={`team2-games-${index}`}
                                      key={`team2-${court.team1.id}-${court.team2.id}`}
                                      defaultValue="0"
                                    />
                                  </div>
                                </div>
                                <button
                                  className="btn-primary"
                                  style={{ width: '100%', marginTop: '10px' }}
                                  onClick={() => {
                                    const team1Games = parseInt(document.getElementById(`team1-games-${index}`).value) || 0
                                    const team2Games = parseInt(document.getElementById(`team2-games-${index}`).value) || 0
                                    recordMatchResult(index, team1Games, team2Games)
                                  }}
                                >
                                  {t.recordResult}
                                </button>
                              </>
                            )}
                          </>
                        ) : (
                          <div className="empty-court-content">
                            <span style={{ color: '#95a5a6', fontSize: '14px' }}>
                              {language === 'en' ? 'Empty' : 'فارغ'}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Matches by Stage */}
              {matches.length > 0 && (
                <>
                  {/* Group Stage Matches */}
                  {activeTab === 'social' && matches.some(m => m.isGroupStage || m.groupId) && (
                    <div className="section">
                      <h2>{t.groupStageLabel} - {language === 'en' ? 'Completed' : 'مكتمل'}</h2>
                      <div className="courts-grid">
                        {matches
                          .filter(m => m.isGroupStage || m.groupId)
                          .map((match, idx) => (
                            <div key={match.id} className="court-card completed-match">
                              <h3>
                                <span className={`stage-badge group-badge`}>{t.groupStageLabel}</span>
                                {match.groupId && ` - ${match.groupId.replace('court', t.group + ' ')}`}
                              </h3>
                              <div className="match-teams">
                                <div className={match.winner && match.winner.id === match.team1.id ? 'winner' : ''}>
                                  {match.team1.name}
                                </div>
                                <div className="vs">{t.vs}</div>
                                <div className={match.winner && match.winner.id === match.team2.id ? 'winner' : ''}>
                                  {match.team2.name}
                                </div>
                              </div>
                              <div className="completed-score">
                                <div className="score-display">
                                  <strong>{match.team1Games} - {match.team2Games}</strong>
                                </div>
                                {match.isTie ? (
                                  <div className="draw-result">{t.draw}</div>
                                ) : (
                                  <div className="winner-result">🏆 {match.winner.name}</div>
                                )}
                              </div>
                              <div className="court-number-small">{t.court} {match.courtNumber}</div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Semi-Final Matches */}
                  {matches.some(m => m.isSemiFinal) && (
                    <div className="section">
                      <h2>{t.semiFinalLabel} - {language === 'en' ? 'Completed' : 'مكتمل'}</h2>
                      <div className="courts-grid">
                        {matches
                          .filter(m => m.isSemiFinal)
                          .map((match) => (
                            <div key={match.id} className="court-card completed-match">
                              <h3>
                                <span className={`stage-badge semi-badge`}>{t.semiFinalLabel}</span>
                              </h3>
                              <div className="match-teams">
                                <div className={match.winner && match.winner.id === match.team1.id ? 'winner' : ''}>
                                  {match.team1.name}
                                </div>
                                <div className="vs">{t.vs}</div>
                                <div className={match.winner && match.winner.id === match.team2.id ? 'winner' : ''}>
                                  {match.team2.name}
                                </div>
                              </div>
                              <div className="completed-score">
                                <div className="score-display">
                                  <strong>{formatMatchScore(match)}</strong>
                                </div>
                                {match.isTie ? (
                                  <div className="draw-result">{t.draw}</div>
                                ) : (
                                  <div className="winner-result">🏆 {match.winner.name}</div>
                                )}
                              </div>
                              <div className="court-number-small">{t.court} {match.courtNumber}</div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Final Matches */}
                  {matches.some(m => m.isFinal) && (
                    <div className="section">
                      <h2>{t.finalLabel} - {language === 'en' ? 'Completed' : 'مكتمل'}</h2>
                      <div className="courts-grid">
                        {matches
                          .filter(m => m.isFinal)
                          .map((match) => (
                            <div key={match.id} className="court-card completed-match">
                              <h3>
                                <span className="stage-badge final-badge">
                                  {t.finalLabel}
                                </span>
                              </h3>
                              <div className="match-teams">
                                <div className={match.winner && match.winner.id === match.team1.id ? 'winner' : ''}>
                                  {match.team1.name}
                                </div>
                                <div className="vs">{t.vs}</div>
                                <div className={match.winner && match.winner.id === match.team2.id ? 'winner' : ''}>
                                  {match.team2.name}
                                </div>
                              </div>
                              <div className="completed-score">
                                <div className="score-display">
                                  <strong>{formatMatchScore(match)}</strong>
                                  {match.set1Team1Games !== undefined && (
                                    <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '5px' }}>
                                      {language === 'en' 
                                        ? `Set 1: ${match.set1Team1Games}-${match.set1Team2Games}, Set 2: ${match.set2Team1Games}-${match.set2Team2Games}${match.tiebreakTeam1Points !== null ? `, TB: ${match.tiebreakTeam1Points}-${match.tiebreakTeam2Points}` : ''}`
                                        : `المجموعة 1: ${match.set1Team1Games}-${match.set1Team2Games}, المجموعة 2: ${match.set2Team1Games}-${match.set2Team2Games}${match.tiebreakTeam1Points !== null ? `، ك.ت: ${match.tiebreakTeam1Points}-${match.tiebreakTeam2Points}` : ''}`
                                      }
                                    </div>
                                  )}
                                </div>
                                {match.isTie ? (
                                  <div className="draw-result">{t.draw}</div>
                                ) : (
                                  <div className="winner-result">🏆 {match.winner.name}</div>
                                )}
                              </div>
                              <div className="court-number-small">{t.court} {match.courtNumber}</div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* King of Court Matches */}
                  {activeTab === 'king' && matches.filter(m => !m.isSemiFinal && !m.isFinal && !m.groupId).length > 0 && (
                    <div className="section">
                      <h2>{t.kingOfCourt} - {language === 'en' ? 'Completed' : 'مكتمل'}</h2>
                      <div className="courts-grid">
                        {matches
                          .filter(m => !m.isSemiFinal && !m.isFinal && !m.isThirdPlace && !m.groupId)
                          .map((match) => (
                            <div key={match.id} className="court-card completed-match">
                              <h3>
                                <span className={`stage-badge group-badge`}>{t.kingOfCourt}</span>
                              </h3>
                              <div className="match-teams">
                                <div className={match.winner && match.winner.id === match.team1.id ? 'winner' : ''}>
                                  {match.team1.name}
                                </div>
                                <div className="vs">{t.vs}</div>
                                <div className={match.winner && match.winner.id === match.team2.id ? 'winner' : ''}>
                                  {match.team2.name}
                                </div>
                              </div>
                              <div className="completed-score">
                                <div className="score-display">
                                  <strong>{match.team1Games} - {match.team2Games}</strong>
                                </div>
                                {match.isTie ? (
                                  <div className="draw-result">{t.draw}</div>
                                ) : (
                                  <div className="winner-result">🏆 {match.winner.name}</div>
                                )}
                              </div>
                              <div className="court-number-small">{t.court} {match.courtNumber}</div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Empty State - No Active Courts and No Matches */}
              {!courts.some(c => c !== null) && matches.length === 0 && (
                <div className="section">
                  <h2>{t.courts}</h2>
                  <div className="section-header">
                    <p style={{ color: '#95a5a6', margin: 0 }}>
                      {activeTab === 'social' && Object.keys(groupStage).length === 0
                        ? (language === 'en' 
                          ? 'Go to the "Teams" tab to add teams and initialize groups. Then drag and drop teams into groups (3 teams per group).' 
                          : 'انتقل إلى علامة تبويب "الفِرق" لإضافة الفِرق وتهيئة المجموعات. ثم اسحب وأفلت الفِرق في المجموعات (3 فرق لكل مجموعة).')
                        : activeTab === 'social' && Object.keys(groupStage).length > 0 && courts.every(c => !c)
                        ? (language === 'en' 
                          ? 'All teams have been assigned to groups. Click "Start Group Stage" to begin matches.' 
                          : 'تم تعيين جميع الفِرق في المجموعات. انقر على "بدء مرحلة المجموعات" لبدء المباريات.')
                        : activeTab === 'king'
                        ? (language === 'en' 
                          ? 'Go to the "Teams" tab to add teams (8 teams recommended). Then click "Assign Matches" to start the tournament.' 
                          : 'انتقل إلى علامة تبويب "الفِرق" لإضافة الفِرق (يُنصح بـ 8 فرق). ثم انقر على "تعيين المباريات" لبدء البطولة.')
                        : (language === 'en' 
                          ? 'No active matches. Assign matches to courts to begin.' 
                          : 'لا توجد مباريات نشطة. قم بتعيين المباريات للملاعب للبدء.')
                      }
                    </p>
                    {activeTab === 'social' && Object.keys(groupStage).length > 0 && courts.every(c => !c) && tournamentStage === 'group' && (
                      <button 
                        className="btn-primary" 
                        onClick={startGroupStage}
                      >
                        {language === 'en' ? 'Start Group Stage' : 'بدء مرحلة المجموعات'}
                      </button>
                    )}
                    {activeTab === 'king' && teams.length >= 2 && (
                      <button 
                        className="btn-primary" 
                        onClick={assignToCourts}
                      >
                        {t.assignMatches}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {contentTab === 'schedule' && activeTab === 'king' && (
            <div className="tab-content">
              <div className="section">
                <h2>{t.matchSchedule} / {t.verifyPairings}</h2>
                <div className="match-schedule-container">
                  <div className="team-opponents-grid">
                    {teams.map(team => {
                      const opponents = getTeamOpponents(team.id)
                      // Calculate matchesPlayed from matches array
                      const teamMatchesCount = matches.filter(m => 
                        m.team1.id === team.id || m.team2.id === team.id
                      ).length
                      const remainingOpponents = teams.filter(t => 
                        t.id !== team.id && 
                        !opponents.some(o => o.team.id === t.id) &&
                        teamMatchesCount < 7
                      )
                      
                      return (
                        <div key={team.id} className="team-opponents-card">
                          <h4>{team.name}</h4>
                          <div className="opponents-list">
                            <div className="played-opponents">
                              <strong>Played ({opponents.length}):</strong>
                              {opponents.length > 0 ? (
                                <div className="opponent-tags">
                                  {opponents.map((opp, idx) => (
                                    <span key={idx} className="opponent-tag played">
                                      {opp.team.name}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="no-opponents">None yet</span>
                              )}
                            </div>
                            {remainingOpponents.length > 0 && (
                              <div className="remaining-opponents">
                                <strong>Remaining ({remainingOpponents.length}):</strong>
                                <div className="opponent-tags">
                                  {remainingOpponents.map(opp => (
                                    <span key={opp.id} className="opponent-tag remaining">
                                      {opp.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {contentTab === 'history' && (
            <div className="tab-content">
              <div className="section">
                <h2>{t.matchHistory} ({matches.length})</h2>
                {matches.length > 0 ? (
                  <div className="match-history-container">
                    <table className="match-history-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>{t.stage}</th>
                          <th>{t.team}</th>
                          <th>{t.vs}</th>
                          <th>{t.team}</th>
                          <th>{t.score}</th>
                          <th>{t.winner}</th>
                          {activeTab === 'social' && <th>{t.group}</th>}
                          <th>{t.court}</th>
                          <th>{language === 'en' ? 'Actions' : 'إجراءات'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matches.slice().reverse().map((match, index) => {
                          // Determine stage label
                          let stageLabel = ''
                          if (match.isFinal) {
                            stageLabel = t.finalLabel
                          } else if (match.isSemiFinal) {
                            stageLabel = t.semiFinalLabel
                          } else if (match.isGroupStage || match.groupId) {
                            stageLabel = match.groupId 
                              ? `${t.groupStageLabel} - ${match.groupId.replace('court', t.group + ' ')}`
                              : t.groupStageLabel
                          } else {
                            stageLabel = activeTab === 'king' ? t.kingOfCourt : t.groupStageLabel
                          }

                          return (
                            <tr key={match.id}>
                              <td>{matches.length - index}</td>
                              <td className="stage-cell">
                                <span className={`stage-badge ${match.isFinal ? 'final-badge' : match.isThirdPlace ? 'third-badge' : match.isSemiFinal ? 'semi-badge' : 'group-badge'}`}>
                                  {stageLabel}
                                </span>
                              </td>
                              <td><strong>{match.team1.name}</strong></td>
                              <td>{t.vs}</td>
                              <td><strong>{match.team2.name}</strong></td>
                              <td className="score-cell">
                                {formatMatchScore(match)}
                                {match.isFinal && match.set1Team1Games !== undefined && (
                                  <div style={{ fontSize: '11px', color: '#7f8c8d', marginTop: '3px' }}>
                                    {language === 'en' 
                                      ? `${match.set1Team1Games}-${match.set1Team2Games}, ${match.set2Team1Games}-${match.set2Team2Games}${match.tiebreakTeam1Points !== null ? `, ${match.tiebreakTeam1Points}-${match.tiebreakTeam2Points}` : ''}`
                                      : `${match.set1Team1Games}-${match.set1Team2Games}، ${match.set2Team1Games}-${match.set2Team2Games}${match.tiebreakTeam1Points !== null ? `، ${match.tiebreakTeam1Points}-${match.tiebreakTeam2Points}` : ''}`
                                    }
                                  </div>
                                )}
                              </td>
                              <td>
                                {match.isTie ? (
                                  <span className="draw-result">{t.draw}</span>
                                ) : (
                                  <span className="winner-result">🏆 {match.winner.name}</span>
                                )}
                              </td>
                              {activeTab === 'social' && (
                                <td>
                                  {match.groupId ? match.groupId.replace('court', t.group + ' ') : '-'}
                                </td>
                              )}
                              <td>{t.court} {match.courtNumber}</td>
                              <td>
                                <button
                                  className="btn-secondary btn-small"
                                  onClick={() => setMatchToEdit(match)}
                                  title={language === 'en' ? 'Edit Score' : 'تعديل النتيجة'}
                                >
                                  ✏️
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ textAlign: 'center', color: '#95a5a6', padding: '40px' }}>
                    {language === 'en' ? 'No matches recorded yet.' : 'لم يتم تسجيل أي مباريات بعد.'}
                  </p>
                )}
              </div>
            </div>
          )}
            </>
          )}

          {/* Member Form Modal (Add/Edit) */}
          {memberFormModal && (
            <div className="modal-overlay" onClick={() => setMemberFormModal(null)}>
              <div className="member-selector-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                <div className="modal-header">
                  <h3>{memberFormModal === 'add' ? t.addMember : t.editMember}</h3>
                  <button className="modal-close" onClick={() => setMemberFormModal(null)}>×</button>
                </div>
                <div className="modal-body">
                  <MemberForm
                    member={memberFormModal === 'add' ? null : memberFormModal}
                    onSave={async (memberData) => {
                      if (memberFormModal === 'add' && currentClub?.id) {
                        const newMember = {
                          id: 'member-' + Date.now(),
                          name: memberData.name || '',
                          mobile: memberData.mobile || '',
                          phone: memberData.mobile || '',
                          dateOfBirth: memberData.dateOfBirth || '',
                          email: memberData.email || '',
                          clubIds: [currentClub.id],
                          totalGames: 0,
                          totalWins: 0,
                          totalLosses: 0,
                          totalDraws: 0,
                          totalPoints: 0,
                          tournamentsPlayed: 0,
                          tournamentsWon: 0,
                          lastTournamentId: undefined,
                          pointsHistory: []
                        }
                        const saved = await upsertMember(newMember)
                        if (saved) {
                          setMembers(prev => [...prev, saved])
                          window.dispatchEvent(new CustomEvent('clubs-synced'))
                        }
                      } else if (memberFormModal !== 'add' && memberFormModal?.id) {
                        const updated = { ...memberFormModal, ...memberData }
                        const saved = await upsertMember(updated)
                        if (saved) {
                          setMembers(members.map(m => m.id === memberFormModal.id ? saved : m))
                          window.dispatchEvent(new CustomEvent('clubs-synced'))
                        }
                      }
                      setMemberFormModal(null)
                    }}
                    onCancel={() => setMemberFormModal(null)}
                    translations={t}
                    language={language}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Member Delete Confirmation Modal */}
          {memberToDelete && (
            <div className="modal-overlay" onClick={() => setMemberToDelete(null)}>
              <div className="member-selector-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                <div className="modal-header">
                  <h3>{language === 'en' ? 'Delete Member' : 'حذف العضو'}</h3>
                  <button className="modal-close" onClick={() => setMemberToDelete(null)}>×</button>
                </div>
                <div className="modal-body">
                  <p style={{ marginBottom: '20px', fontSize: '15px', color: '#2c3e50' }}>
                    {language === 'en' 
                      ? `Are you sure you want to delete "${memberToDelete.name}"? This action cannot be undone.`
                      : `هل أنت متأكد من حذف "${memberToDelete.name}"؟ لا يمكن التراجع عن هذا الإجراء.`
                    }
                  </p>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button 
                      className="btn-secondary"
                      onClick={() => setMemberToDelete(null)}
                    >
                      {t.close}
                    </button>
                    <button 
                      className="btn-danger"
                      onClick={() => {
                        setDeletedMember(memberToDelete)
                        setMembers(members.filter(m => m.id !== memberToDelete.id))
                        updateCurrentState(state => ({
                          ...state,
                          teams: (state.teams || []).map(team => ({
                            ...team,
                            memberIds: (team.memberIds || []).filter(id => id !== memberToDelete.id)
                          }))
                        }))
                        setMemberToDelete(null)
                        const timeout = setTimeout(() => {
                          deleteMember(memberToDelete.id).then(() => window.dispatchEvent(new CustomEvent('clubs-synced')))
                          setDeletedMember(null)
                        }, 5000)
                        setUndoTimeout(timeout)
                      }}
                    >
                      {language === 'en' ? 'Delete' : 'حذف'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Reset Tournament Confirmation Modal */}
          {showResetConfirm && (
            <div className="modal-overlay" onClick={() => setShowResetConfirm(false)}>
              <div className="member-selector-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                <div className="modal-header">
                  <h3>{t.resetTournament}</h3>
                  <button className="modal-close" onClick={() => setShowResetConfirm(false)}>×</button>
                </div>
                <div className="modal-body">
                  <p style={{ marginBottom: '20px', fontSize: '15px', color: '#2c3e50', lineHeight: '1.6' }}>
                    {t.confirmResetTournament}
                  </p>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button 
                      className="btn-secondary"
                      onClick={() => setShowResetConfirm(false)}
                    >
                      {t.close}
                    </button>
                    <button 
                      className="btn-danger"
                      onClick={resetTournament}
                    >
                      {t.resetTournamentConfirm}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Delete Tournament Confirmation Modal */}
          {showDeleteConfirm && (
            <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
              <div className="member-selector-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                <div className="modal-header">
                  <h3>{language === 'en' ? 'Delete Tournament' : 'حذف البطولة'}</h3>
                  <button className="modal-close" onClick={() => setShowDeleteConfirm(false)}>×</button>
                </div>
                <div className="modal-body">
                  <p style={{ marginBottom: '20px', fontSize: '15px', color: '#2c3e50', lineHeight: '1.6' }}>
                    {language === 'en' 
                      ? 'Are you sure you want to delete this tournament? This will permanently remove all match records, member points, and statistics related to this tournament. This action cannot be undone.'
                      : 'هل أنت متأكد من حذف هذه البطولة؟ سيتم حذف جميع سجلات المباريات ونقاط الأعضاء والإحصائيات المرتبطة بهذه البطولة بشكل دائم. لا يمكن التراجع عن هذا الإجراء.'}
                  </p>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button 
                      className="btn-secondary"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      {t.close}
                    </button>
                    <button 
                      className="btn-danger"
                      onClick={deleteTournament}
                    >
                      {language === 'en' ? 'Delete Tournament' : 'حذف البطولة'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Undo Delete Notification */}
          {deletedMember && (
            <div className="undo-notification">
              <div className="undo-notification-content">
                <span>
                  {language === 'en' 
                    ? `"${deletedMember.name}" has been deleted.`
                    : `تم حذف "${deletedMember.name}".`
                  }
                </span>
                <button
                  className="btn-secondary btn-small"
                  onClick={async () => {
                    const restored = await upsertMember(deletedMember)
                    if (restored) {
                      setMembers([...members, restored])
                      window.dispatchEvent(new CustomEvent('clubs-synced'))
                    }
                    if (undoTimeout) { clearTimeout(undoTimeout); setUndoTimeout(null) }
                    setDeletedMember(null)
                  }}
                  style={{ marginLeft: '15px' }}
                >
                  {language === 'en' ? 'Undo' : 'تراجع'}
                </button>
              </div>
            </div>
          )}

          {/* Match Edit Modal */}
          {matchToEdit && (
            <div className="modal-overlay" onClick={() => setMatchToEdit(null)}>
              <div className="member-selector-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                <div className="modal-header">
                  <h3>{language === 'en' ? 'Edit Match Score' : 'تعديل نتيجة المباراة'}</h3>
                  <button className="modal-close" onClick={() => setMatchToEdit(null)}>×</button>
                </div>
                <div className="modal-body">
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '20px', fontSize: '16px', fontWeight: '500' }}>
                      <div>{matchToEdit.team1.name}</div>
                      <div style={{ margin: '10px 0', color: '#7f8c8d' }}>{t.vs}</div>
                      <div>{matchToEdit.team2.name}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#2c3e50' }}>
                          {matchToEdit.team1.name}
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={getMaxScoreForMatch(matchToEdit)}
                          id="edit-team1-games"
                          defaultValue={matchToEdit.team1Games}
                          className="search-input"
                          style={{ textAlign: 'center', fontSize: '18px', fontWeight: 'bold' }}
                        />
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#7f8c8d' }}>-</div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#2c3e50' }}>
                          {matchToEdit.team2.name}
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={getMaxScoreForMatch(matchToEdit)}
                          id="edit-team2-games"
                          defaultValue={matchToEdit.team2Games}
                          className="search-input"
                          style={{ textAlign: 'center', fontSize: '18px', fontWeight: 'bold' }}
                        />
                      </div>
                    </div>
                    {(matchToEdit.isSemiFinal || matchToEdit.isFinal || matchToEdit.isThirdPlace) && (
                      <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#fff3cd', borderRadius: '5px', fontSize: '13px', color: '#856404' }}>
                        {language === 'en' 
                          ? (activeTab === 'social' && matchToEdit.isFinal
                            ? 'Final: Maximum 2 sets. If both teams have 1 set, play tiebreak (winner gets 2-1).'
                            : 'Note: Ties are not allowed in knockout stages. Please enter different scores.')
                          : (activeTab === 'social' && matchToEdit.isFinal
                            ? 'النهائي: الحد الأقصى مجموعتين. إذا كان كلا الفريقين لديه مجموعة واحدة، قم بلعب كسر التعادل (الفائز يحصل على 2-1).'
                            : 'ملاحظة: التعادل غير مسموح في مراحل خروج المغلوب. يرجى إدخال نتائج مختلفة.')}
                      </div>
                    )}
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn-secondary" onClick={() => setMatchToEdit(null)}>
                      {t.close}
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => {
                        const team1Games = parseInt(document.getElementById('edit-team1-games').value) || 0
                        const team2Games = parseInt(document.getElementById('edit-team2-games').value) || 0
                        updateMatch(matchToEdit.id, team1Games, team2Games)
                      }}
                    >
                      {language === 'en' ? 'Save Changes' : 'حفظ التغييرات'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Member Selector Modal */}
          {openMemberSelectorForTeam && (
            <div className="modal-overlay" onClick={() => setOpenMemberSelectorForTeam(null)}>
              <div className="member-selector-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>{t.selectTeamMembers}</h3>
                  <button className="modal-close" onClick={() => setOpenMemberSelectorForTeam(null)}>×</button>
                </div>
                <div className="modal-body">
                  <div className="search-bar-container">
                    <input
                      type="text"
                      placeholder={t.searchPlaceholder}
                      value={memberSelectorSearch}
                      onChange={(e) => setMemberSelectorSearch(e.target.value)}
                      className="search-input"
                      autoFocus
                    />
                  </div>
                  <div className="member-selector-list">
                    {members
                      .filter(member => {
                        if (!memberSelectorSearch.trim()) return true
                        const searchLower = memberSelectorSearch.toLowerCase().trim()
                        return member.name.toLowerCase().includes(searchLower)
                      })
                      .map(member => {
                        const team = teams.find(t => t.id === openMemberSelectorForTeam)
                        const isSelected = (team?.memberIds || []).includes(member.id)
                        return (
                          <label key={member.id} className="member-selector-item">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                const currentIds = team?.memberIds || []
                                const newIds = e.target.checked
                                  ? [...currentIds, member.id]
                                  : currentIds.filter(id => id !== member.id)
                                updateCurrentState(state => ({
                                  ...state,
                                  teams: (state.teams || []).map(t => 
                                    t.id === openMemberSelectorForTeam ? { ...t, memberIds: newIds } : t
                                  )
                                }))
                              }}
                            />
                            <span>{member.name}</span>
                          </label>
                        )
                      })}
                    {members.filter(member => {
                      if (!memberSelectorSearch.trim()) return true
                      const searchLower = memberSelectorSearch.toLowerCase().trim()
                      return member.name.toLowerCase().includes(searchLower)
                    }).length === 0 && (
                      <p className="no-members-found">{t.noMembersFound}</p>
                    )}
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn-primary" onClick={() => setOpenMemberSelectorForTeam(null)}>
                    {t.close}
                  </button>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}

// Member Form Component
function MemberForm({ member, onSave, onCancel, translations, language }) {
  const [formData, setFormData] = useState({
    name: member?.name || '',
    mobile: member?.mobile || '',
    dateOfBirth: member?.dateOfBirth || '',
    email: member?.email || ''
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      alert(language === 'en' ? 'Please enter a name' : 'يرجى إدخال الاسم')
      return
    }
    onSave(formData)
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: '#2c3e50' }}>
          {translations.memberName} *
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="search-input"
          required
          autoFocus
        />
      </div>
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: '#2c3e50' }}>
          {translations.mobileNumber}
        </label>
        <input
          type="tel"
          value={formData.mobile}
          onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
          className="search-input"
          placeholder={language === 'en' ? 'e.g., +1234567890' : 'مثال: +1234567890'}
        />
      </div>
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: '#2c3e50' }}>
          {translations.dateOfBirth}
        </label>
        <input
          type="date"
          value={formData.dateOfBirth}
          onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
          className="search-input"
        />
      </div>
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: '#2c3e50' }}>
          {translations.email}
        </label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="search-input"
          placeholder={language === 'en' ? 'e.g., member@example.com' : 'مثال: member@example.com'}
        />
      </div>
      <div className="modal-footer">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          {translations.close}
        </button>
        <button type="submit" className="btn-primary">
          {language === 'en' ? 'Save' : 'حفظ'}
        </button>
      </div>
    </form>
  )
}

// Booking Form Modal Component
function BookingFormModal({ bookingData, members, courts: courtsProp, clubOpeningTime, clubClosingTime, onSave, onDelete, onCancel, translations, language }) {
  const courts = courtsProp && courtsProp.length > 0 ? courtsProp : ['Court 1', 'Court 2', 'Court 3', 'Court 4']
  const defaultStart = clubOpeningTime || '09:00'
  const defaultEnd = (() => {
    if (clubOpeningTime && clubClosingTime) {
      const [oh, om] = clubOpeningTime.split(':').map(Number)
      const [ch, cm] = clubClosingTime.split(':').map(Number)
      const openM = oh * 60 + om
      const closeM = ch * 60 + cm
      const oneHourLater = Math.min(openM + 60, closeM)
      const h2 = Math.floor(oneHourLater / 60)
      const m2 = oneHourLater % 60
      return `${String(h2).padStart(2, '0')}:${String(m2).padStart(2, '0')}`
    }
    return '10:00'
  })()
  const [formData, setFormData] = useState({
    id: bookingData?.id || null,
    date: bookingData?.date || '',
    startTime: bookingData?.startTime || defaultStart,
    endTime: bookingData?.endTime || defaultEnd,
    resource: bookingData?.resource || courts[0] || 'Court 1',
    amount: bookingData?.amount || '',
    participants: (bookingData?.participants || []).map(p => {
      // Ensure all participants have paid field
      if (typeof p === 'object') {
        return { ...p, paid: p.paid !== undefined ? p.paid : false }
      }
      return { id: null, name: p, amount: '', paymentMethod: 'card', paid: false }
    }),
    notes: bookingData?.notes || ''
  })
  const [participantSearch, setParticipantSearch] = useState('')
  const [showParticipantSelector, setShowParticipantSelector] = useState(false)
  const [newParticipantName, setNewParticipantName] = useState('')
  const [participantSelectorMode, setParticipantSelectorMode] = useState('member') // 'member' or 'manual'

  // Sync formData when bookingData changes (when a different booking is opened)
  useEffect(() => {
    if (bookingData) {
      setFormData({
        id: bookingData.id || null,
        date: bookingData.date || '',
        startTime: bookingData.startTime || defaultStart,
        endTime: bookingData.endTime || defaultEnd,
        resource: courts.includes(bookingData.resource) ? bookingData.resource : (courts[0] || 'Court 1'),
        amount: bookingData.amount || '',
        participants: (bookingData.participants || []).map(p => {
          if (typeof p === 'object') {
            return { ...p, paid: p.paid !== undefined ? p.paid : false }
          }
          return { id: null, name: p, amount: '', paymentMethod: 'card', paid: false }
        }),
        notes: bookingData.notes || ''
      })
    }
  }, [bookingData?.id, bookingData?.date, bookingData?.startTime, courts, defaultStart, defaultEnd])

  // Calculate isEditMode based on formData.id (which syncs with bookingData.id)
  const isEditMode = !!(formData.id || bookingData?.id)

  const handleAddParticipant = (participantId) => {
    const member = members.find(m => m.id === participantId)
    if (member && !formData.participants.find(p => (typeof p === 'object' ? p.id : p) === participantId)) {
      setFormData({
        ...formData,
        participants: [...formData.participants, { id: member.id, name: member.name, amount: '', paymentMethod: 'card', paid: false }]
      })
      setShowParticipantSelector(false)
      setParticipantSearch('')
    }
  }

  const handleAddManualParticipant = () => {
    if (newParticipantName.trim() && !formData.participants.find(p => {
      const pName = typeof p === 'object' ? p.name : p
      return pName.toLowerCase() === newParticipantName.trim().toLowerCase()
    })) {
      setFormData({
        ...formData,
        participants: [...formData.participants, { id: null, name: newParticipantName.trim(), amount: '', paymentMethod: 'card', paid: false }]
      })
      setNewParticipantName('')
      setShowParticipantSelector(false)
    }
  }

  const handleSplitAmountEqually = () => {
    const totalAmount = parseFloat(formData.amount)
    if (!totalAmount || totalAmount <= 0 || formData.participants.length === 0) {
      return
    }
    
    const splitAmount = (totalAmount / formData.participants.length).toFixed(2)
    const updatedParticipants = formData.participants.map(p => {
      const participant = typeof p === 'object' ? p : { id: null, name: p, amount: '', paymentMethod: 'card', paid: false }
      return { ...participant, amount: splitAmount }
    })
    
    setFormData({
      ...formData,
      participants: updatedParticipants
    })
  }

  const handleRemoveParticipant = (index) => {
    setFormData({
      ...formData,
      participants: formData.participants.filter((_, i) => i !== index)
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(formData)
  }

  const paymentMethods = [
    { value: 'cash', label: translations.cash },
    { value: 'card', label: language === 'en' ? 'Card' : 'بطاقة'}
  ]

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="member-selector-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h3>{isEditMode ? (language === 'en' ? 'Edit Booking' : 'تعديل الحجز') : translations.createRegularBooking}</h3>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: '#2c3e50' }}>
                {translations.date}
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="search-input"
                required
              />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: '#2c3e50' }}>
                  {translations.startTime}
                </label>
                <input
                  type="time"
                  value={formData.startTime}
                  min={clubOpeningTime || undefined}
                  max={clubClosingTime || undefined}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  className="search-input"
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: '#2c3e50' }}>
                  {translations.endTime}
                </label>
                <input
                  type="time"
                  value={formData.endTime}
                  min={clubOpeningTime || undefined}
                  max={clubClosingTime || undefined}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  className="search-input"
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: '#2c3e50' }}>
                {translations.resource}
              </label>
              <select
                value={formData.resource}
                onChange={(e) => setFormData({ ...formData, resource: e.target.value })}
                className="search-input"
                required
              >
                {courts.map(court => (
                  <option key={court} value={court}>{court}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: '#2c3e50' }}>
                {translations.amount}
              </label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="search-input"
                placeholder={language === 'en' ? 'e.g., 300' : 'مثال: 300'}
              />
              {formData.participants.length > 0 && (
                <button
                  type="button"
                  className="btn-secondary btn-small"
                  onClick={handleSplitAmountEqually}
                  style={{ 
                    marginTop: '8px', 
                    width: '100%',
                    fontSize: '13px'
                  }}
                  disabled={!formData.amount || parseFloat(formData.amount) <= 0}
                >
                  {language === 'en' 
                    ? `Split equally (${formData.participants.length} ${formData.participants.length === 1 ? 'participant' : 'participants'})`
                    : `تقسيم بالتساوي (${formData.participants.length} ${formData.participants.length === 1 ? 'مشارك' : 'مشاركين'})`
                  }
                </button>
              )}
            </div>

            <div style={{ marginBottom: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <label style={{ fontWeight: '500', color: '#2c3e50' }}>
                  {translations.participants}
                </label>
                <button
                  type="button"
                  className="btn-secondary btn-small"
                  onClick={() => {
                    setShowParticipantSelector(!showParticipantSelector)
                    if (!showParticipantSelector) {
                      setParticipantSelectorMode('member')
                    }
                  }}
                >
                  {translations.addNewParticipant}
                </button>
              </div>
              
              {showParticipantSelector && (
                <div style={{ marginBottom: '10px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '5px', border: '1px solid #dee2e6' }}>
                  {/* Mode Tabs */}
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', borderBottom: '2px solid #dee2e6' }}>
                    <button
                      type="button"
                      onClick={() => setParticipantSelectorMode('member')}
                      style={{
                        padding: '8px 15px',
                        border: 'none',
                        background: participantSelectorMode === 'member' ? '#3498db' : 'transparent',
                        color: participantSelectorMode === 'member' ? 'white' : '#2c3e50',
                        cursor: 'pointer',
                        borderRadius: '5px 5px 0 0',
                        fontWeight: participantSelectorMode === 'member' ? 'bold' : 'normal'
                      }}
                    >
                      {language === 'en' ? 'From Members' : 'من الأعضاء'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setParticipantSelectorMode('manual')}
                      style={{
                        padding: '8px 15px',
                        border: 'none',
                        background: participantSelectorMode === 'manual' ? '#3498db' : 'transparent',
                        color: participantSelectorMode === 'manual' ? 'white' : '#2c3e50',
                        cursor: 'pointer',
                        borderRadius: '5px 5px 0 0',
                        fontWeight: participantSelectorMode === 'manual' ? 'bold' : 'normal'
                      }}
                    >
                      {language === 'en' ? 'Add Manually' : 'إضافة يدوياً'}
                    </button>
                  </div>

                  {/* Member Selection Mode */}
                  {participantSelectorMode === 'member' && (
                    <div>
                      <input
                        type="text"
                        placeholder={translations.searchPlaceholder}
                        value={participantSearch}
                        onChange={(e) => setParticipantSearch(e.target.value)}
                        className="search-input"
                        style={{ marginBottom: '10px' }}
                      />
                      <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                        {members.length > 0 ? (
                          members
                            .filter(m => {
                              if (!participantSearch.trim()) return true
                              const searchLower = participantSearch.toLowerCase()
                              return m.name.toLowerCase().includes(searchLower)
                            })
                            .map(member => (
                              <button
                                key={member.id}
                                type="button"
                                className="btn-secondary btn-small"
                                style={{ margin: '5px', width: 'auto' }}
                                onClick={() => handleAddParticipant(member.id)}
                              >
                                {member.name}
                              </button>
                            ))
                        ) : (
                          <p style={{ color: '#7f8c8d', fontSize: '13px', textAlign: 'center', padding: '10px' }}>
                            {language === 'en' ? 'No members available' : 'لا يوجد أعضاء متاحون'}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Manual Entry Mode */}
                  {participantSelectorMode === 'manual' && (
                    <div style={{ padding: '4px 0' }}>
                      <div style={{ 
                        display: 'flex', 
                        gap: '12px', 
                        marginBottom: '12px',
                        alignItems: 'stretch',
                        flexWrap: 'wrap'
                      }}>
                        <input
                          type="text"
                          placeholder={language === 'en' ? 'Enter participant name' : 'أدخل اسم المشارك'}
                          value={newParticipantName}
                          onChange={(e) => setNewParticipantName(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleAddManualParticipant()
                            }
                          }}
                          className="search-input participant-manual-input"
                          style={{ 
                            flex: '1 1 200px',
                            minWidth: '180px'
                          }}
                        />
                        <button
                          type="button"
                          className="btn-primary btn-small"
                          onClick={handleAddManualParticipant}
                          disabled={!newParticipantName.trim()}
                          style={{
                            padding: '12px 20px',
                            borderRadius: '10px',
                            fontWeight: '600',
                            minHeight: '44px'
                          }}
                        >
                          {language === 'en' ? 'Add' : 'إضافة'}
                        </button>
                      </div>
                      <p style={{ 
                        color: '#64748b', 
                        fontSize: '13px', 
                        margin: 0, 
                        lineHeight: 1.5,
                        paddingLeft: '2px'
                      }}>
                        {language === 'en' 
                          ? 'Enter the name of a participant who is not in the members list'
                          : 'أدخل اسم مشارك غير موجود في قائمة الأعضاء'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {formData.participants.map((participant, index) => {
                const participantName = typeof participant === 'object' ? participant.name : participant
                const participantId = typeof participant === 'object' ? participant.id : null
                const participantObj = typeof participant === 'object' ? participant : { id: null, name: participant, amount: '', paymentMethod: 'card', paid: false }
                return (
                  <div key={index} style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '2fr 1fr 1.5fr 1fr auto auto', 
                    gap: '10px', 
                    alignItems: 'center',
                    marginBottom: '10px',
                    padding: '10px',
                    backgroundColor: participantObj.paid ? '#d4edda' : '#f8f9fa',
                    borderRadius: '5px',
                    border: participantObj.paid ? '2px solid #28a745' : '1px solid #dee2e6'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{participantName}</span>
                      {participantObj.id === null && (
                        <span style={{ 
                          fontSize: '10px', 
                          padding: '2px 6px', 
                          backgroundColor: '#e9ecef', 
                          borderRadius: '10px',
                          color: '#6c757d'
                        }}>
                          {language === 'en' ? 'Guest' : 'ضيف'}
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      placeholder={translations.amount}
                      value={participantObj.amount || ''}
                      onChange={(e) => {
                        const updated = [...formData.participants]
                        updated[index] = { ...participantObj, amount: e.target.value }
                        setFormData({ ...formData, participants: updated })
                      }}
                      className="search-input"
                      style={{ fontSize: '14px' }}
                    />
                    <select
                      value={participantObj.paymentMethod || 'card'}
                      onChange={(e) => {
                        const updated = [...formData.participants]
                        updated[index] = { ...participantObj, paymentMethod: e.target.value }
                        setFormData({ ...formData, participants: updated })
                      }}
                      className="search-input"
                      style={{ fontSize: '14px' }}
                    >
                      {paymentMethods.map(method => (
                        <option key={method.value} value={method.value}>{method.label}</option>
                      ))}
                    </select>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '13px' }}>
                      <input
                        type="checkbox"
                        checked={participantObj.paid || false}
                        onChange={(e) => {
                          const updated = [...formData.participants]
                          updated[index] = { ...participantObj, paid: e.target.checked }
                          setFormData({ ...formData, participants: updated })
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                      <span>{language === 'en' ? 'Paid' : 'مدفوع'}</span>
                    </label>
                    <button
                      type="button"
                      className="btn-secondary btn-small"
                      onClick={() => handleRemoveParticipant(index)}
                      style={{ padding: '5px 10px' }}
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: '#2c3e50' }}>
                {translations.notes}
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="search-input"
                rows="3"
                style={{ resize: 'vertical' }}
              />
            </div>

            {/* Payment Summary */}
            {formData.amount && parseFloat(formData.amount) > 0 && (
              <div style={{ 
                marginBottom: '20px', 
                padding: '15px', 
                backgroundColor: '#f8f9fa', 
                borderRadius: '8px',
                border: '1px solid #dee2e6'
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '10px', color: '#2c3e50' }}>
                  {language === 'en' ? 'Payment Summary' : 'ملخص الدفع'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span>{language === 'en' ? 'Total Amount:' : 'المبلغ الإجمالي:'}</span>
                  <strong>{formData.amount}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span>{language === 'en' ? 'Total Paid:' : 'المبلغ المدفوع:'}</span>
                  <strong style={{ color: '#28a745' }}>
                    {formData.participants.reduce((sum, p) => {
                      const participant = typeof p === 'object' ? p : { amount: '', paid: false }
                      // Only count if marked as paid
                      return participant.paid ? sum + (parseFloat(participant.amount) || 0) : sum
                    }, 0)}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #dee2e6' }}>
                  <span>{language === 'en' ? 'Remaining:' : 'المتبقي:'}</span>
                  <strong style={{ 
                    color: (parseFloat(formData.amount) - formData.participants.reduce((sum, p) => {
                      const participant = typeof p === 'object' ? p : { amount: '', paid: false }
                      // Only count if marked as paid
                      return participant.paid ? sum + (parseFloat(participant.amount) || 0) : sum
                    }, 0)) > 0 ? '#dc3545' : '#28a745'
                  }}>
                    {parseFloat(formData.amount) - formData.participants.reduce((sum, p) => {
                      const participant = typeof p === 'object' ? p : { amount: '', paid: false }
                      // Only count if marked as paid
                      return participant.paid ? sum + (parseFloat(participant.amount) || 0) : sum
                    }, 0)}
                  </strong>
                </div>
              </div>
            )}

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const bookingId = formData.id || bookingData?.id
                    if (bookingId) {
                      if (confirm(language === 'en' ? 'Are you sure you want to delete this booking?' : 'هل أنت متأكد من حذف هذا الحجز؟')) {
                        onDelete(bookingId)
                      }
                    } else {
                      // For new bookings, just close the modal
                      onCancel()
                    }
                  }}
                >
                  {language === 'en' ? 'Delete' : 'حذف'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" className="btn-secondary" onClick={onCancel}>
                  {translations.cancel}
                </button>
                <button type="submit" className="btn-primary">
                  {translations.save}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default App
