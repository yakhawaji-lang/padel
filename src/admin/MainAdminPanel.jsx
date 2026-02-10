import React, { useState, useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import './MainAdminPanel.css'
import './admin-rtl.css'
import MainAdminSidebar from './components/MainAdminSidebar'
import MainAdminHeader from './components/MainAdminHeader'
import AllClubsDashboard from './pages/AllClubsDashboard'
import AllClubsManagement from './pages/AllClubsManagement'
import AdminUsersManagement from './pages/AdminUsersManagement'
import AllMembersManagement from './pages/AllMembersManagement'
import AllBookingsDashboard from './pages/AllBookingsDashboard'
import PlatformPageGuard from '../components/PlatformPageGuard'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { AdminPanelProvider } from './AdminPanelContext'
import { loadClubs, saveClubs, approveClub as doApproveClub, rejectClub as doRejectClub, deleteClub as doDeleteClub, deleteClubPermanent as doDeleteClubPermanent, syncMembersToClubsManually, refreshClubsFromApi } from '../storage/adminStorage'
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
      setClubs(Array.isArray(savedClubs) ? savedClubs : [])
      
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
    
    // Refresh clubs from API periodically (reduced interval to avoid 504 gateway timeout)
    const doRefresh = async () => {
      await refreshClubsFromApi()
      const c = loadClubs()
      setClubs(Array.isArray(c) ? c : [])
    }
    const syncInterval = setInterval(doRefresh, 90000)
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

  const handleClubCreate = async (clubData) => {
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
    await saveClubs(updatedClubs)
    return newClub
  }

  const handleClubUpdate = async (clubId, clubData) => {
    const updatedClubs = clubs.map(club => 
      club.id === clubId 
        ? { ...club, ...clubData, updatedAt: new Date().toISOString() }
        : club
    )
    setClubs(updatedClubs)
    await saveClubs(updatedClubs)
  }

  const handleClubDelete = async (clubId) => {
    if (await doDeleteClub(clubId)) {
      setClubs(loadClubs() || [])
    }
  }

  const handlePermanentlyDeleteClub = async (clubId) => {
    if (await doDeleteClubPermanent(clubId)) {
      setClubs(loadClubs() || [])
    }
  }

  const handleApproveClub = async (clubId) => {
    const approved = await doApproveClub(clubId)
    if (approved) {
      const updatedClubs = loadClubs()
      setClubs(Array.isArray(updatedClubs) ? updatedClubs : [])
    }
  }

  const handleRejectClub = async (clubId) => {
    if (await doRejectClub(clubId)) {
      const updatedClubs = loadClubs()
      setClubs(Array.isArray(updatedClubs) ? updatedClubs : [])
    }
  }

  const handleRefreshClubs = async () => {
    await refreshClubsFromApi()
    setClubs(loadClubs() || [])
  }

  const ctxValue = useMemo(() => ({
    clubs,
    language,
    onUpdateClub: handleClubUpdate,
    onApproveClub: handleApproveClub,
    onRejectClub: handleRejectClub,
    onRefresh: handleRefreshClubs,
    onCreateClub: handleClubCreate,
    onDeleteClub: handleClubDelete,
    onPermanentlyDeleteClub: handlePermanentlyDeleteClub
  }), [clubs, language])

  const location = useLocation()
  const path = (location.pathname.replace(/^\/app\/admin\/?/, '').replace(/^\/admin\/?/, '') || 'all-clubs').split('/')[0] || 'all-clubs'

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Loading...</div>
      </div>
    )
  }

  const renderPage = () => {
    if (path === 'admin-users') {
      return <PlatformPageGuard permission="admin-users"><AdminUsersManagement /></PlatformPageGuard>
    }
    if (path === 'manage-clubs') {
      return <PlatformPageGuard permission="manage-clubs"><AllClubsManagement /></PlatformPageGuard>
    }
    if (path === 'all-members') {
      return <PlatformPageGuard permission="all-members"><AllMembersManagement /></PlatformPageGuard>
    }
    if (path === 'all-bookings') {
      return <PlatformPageGuard permission="all-clubs"><AllBookingsDashboard language={language} /></PlatformPageGuard>
    }
    return <AllClubsDashboard />
  }

  return (
    <AdminPanelProvider value={ctxValue}>
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
          <div className="main-admin-page-wrap">
            <ErrorBoundary fallback={<div className="main-admin-page" style={{ padding: 24 }}><p>خطأ في تحميل الصفحة. <a href="/app/admin/all-clubs">تحديث</a></p></div>}>
              {renderPage()}
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </AdminPanelProvider>
  )
}

export default MainAdminPanel
