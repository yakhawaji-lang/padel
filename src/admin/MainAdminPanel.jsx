import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import './MainAdminPanel.css'
import './admin-rtl.css'
import MainAdminSidebar from './components/MainAdminSidebar'
import MainAdminHeader from './components/MainAdminHeader'
import AllClubsDashboard from './pages/AllClubsDashboard'
import AllClubsManagement from './pages/AllClubsManagement'
import AdminUsersManagement from './pages/AdminUsersManagement'
import PlatformPageGuard from '../components/PlatformPageGuard'
import { loadClubs, saveClubs, approveClub as doApproveClub, rejectClub as doRejectClub, syncMembersToClubsManually, refreshClubsFromApi } from '../storage/adminStorage'
import { getAppLanguage, setAppLanguage } from '../storage/languageStorage'

function MainAdminPanel() {
  const [clubs, setClubs] = useState([])
  const [language, setLanguage] = useState(() => getAppLanguage())
  const [isLoading, setIsLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      await refreshClubsFromApi()
      syncMembersToClubsManually()
      const savedClubs = loadClubs()
      setClubs(savedClubs || [])
      
      // Load saved language preference
      const savedLanguage = getAppLanguage()
      if (savedLanguage) {
        setLanguage(savedLanguage)
      }
    }
    loadData().finally(() => setIsLoading(false))
    
    // Update UI when another device adds/edits data (real-time sync)
    const onClubsSynced = () => {
      const updatedClubs = loadClubs()
      setClubs(updatedClubs || [])
    }
    window.addEventListener('clubs-synced', onClubsSynced)
    
    // Refresh clubs from API every 3 seconds to catch pending registrations from other devices
    const doRefresh = async () => {
      await refreshClubsFromApi()
      setClubs(loadClubs() || [])
    }
    const syncInterval = setInterval(doRefresh, 3000)
    // Refresh when user returns to the tab
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') doRefresh()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    
    return () => {
      window.removeEventListener('clubs-synced', onClubsSynced)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      clearInterval(syncInterval)
    }
  }, [])
  
  // Save language preference when it changes
  useEffect(() => {
    if (language) {
      setAppLanguage(language)
    }
  }, [language])

  const handleClubCreate = (clubData) => {
    const newClub = {
      id: Date.now().toString(),
      ...clubData,
      createdAt: new Date().toISOString(),
      tournaments: [],
      members: [],
      bookings: [],
      offers: [],
      accounting: [],
      storeEnabled: false,
      store: { name: '', nameAr: '', categories: [], products: [], sales: [] },
      tournamentData: {
        kingState: null,
        socialState: null,
        currentTournamentId: 1
      }
    }
    const updatedClubs = [...clubs, newClub]
    setClubs(updatedClubs)
    saveClubs(updatedClubs)
    return newClub
  }

  const handleClubUpdate = (clubId, clubData) => {
    const updatedClubs = clubs.map(club => 
      club.id === clubId 
        ? { ...club, ...clubData, updatedAt: new Date().toISOString() }
        : club
    )
    setClubs(updatedClubs)
    saveClubs(updatedClubs)
  }

  const handleClubDelete = (clubId) => {
    const updatedClubs = clubs.filter(club => club.id !== clubId)
    setClubs(updatedClubs)
    saveClubs(updatedClubs)
  }

  const handleApproveClub = (clubId) => {
    const approved = doApproveClub(clubId)
    if (approved) {
      const updatedClubs = loadClubs()
      setClubs(updatedClubs)
    }
  }

  const handleRejectClub = (clubId) => {
    if (doRejectClub(clubId)) {
      const updatedClubs = loadClubs()
      setClubs(updatedClubs)
    }
  }

  const handleRefreshClubs = async () => {
    await refreshClubsFromApi()
    setClubs(loadClubs() || [])
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Loading...</div>
      </div>
    )
  }

  return (
    <div className={`main-admin-panel ${sidebarOpen ? 'sidebar-open' : ''} ${language === 'ar' ? 'rtl' : ''}`}>
      <div
        className="main-admin-sidebar-backdrop"
        aria-hidden={!sidebarOpen}
        onClick={() => setSidebarOpen(false)}
      />
      <MainAdminSidebar 
        clubs={clubs}
        language={language}
        onLanguageChange={setLanguage}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="main-admin-content" onClick={() => setSidebarOpen(false)}>
        <MainAdminHeader 
          language={language}
          onLanguageChange={setLanguage}
          onMenuToggle={() => setSidebarOpen(true)}
        />
        <Routes>
          <Route path="/" element={<Navigate to="all-clubs" replace />} />
          <Route path="all-clubs" element={<PlatformPageGuard permission="all-clubs"><AllClubsDashboard clubs={clubs} language={language} onUpdateClub={handleClubUpdate} onApproveClub={handleApproveClub} onRejectClub={handleRejectClub} onRefresh={handleRefreshClubs} /></PlatformPageGuard>} />
          <Route path="manage-clubs" element={<PlatformPageGuard permission="manage-clubs"><AllClubsManagement clubs={clubs} language={language} onCreateClub={handleClubCreate} onUpdateClub={handleClubUpdate} onDeleteClub={handleClubDelete} /></PlatformPageGuard>} />
          <Route path="admin-users" element={<PlatformPageGuard permission="admin-users"><AdminUsersManagement language={language} clubs={clubs} onUpdateClub={handleClubUpdate} onRefreshClubs={handleRefreshClubs} /></PlatformPageGuard>} />
        </Routes>
      </div>
    </div>
  )
}

export default MainAdminPanel
