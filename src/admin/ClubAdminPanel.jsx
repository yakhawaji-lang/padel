import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom'
import './ClubAdminPanel.css'
import './admin-rtl.css'
import ClubAdminSidebar from './components/ClubAdminSidebar'
import ClubAdminHeader from './components/ClubAdminHeader'
import { getAppLanguage, setAppLanguage } from '../storage/languageStorage'
import ClubDashboard from './pages/ClubDashboard'
import ClubMembersManagement from './pages/ClubMembersManagement'
import ClubOffersManagement from './pages/ClubOffersManagement'
import ClubStoreManagement from './pages/ClubStoreManagement'
import ClubAccountingManagement from './pages/ClubAccountingManagement'
import ClubSettings from './pages/ClubSettings'
import ClubUsersManagement from './pages/ClubUsersManagement'
import ClubPageGuard from '../components/ClubPageGuard'
import { loadClubs, saveClubs, getClubById, syncMembersToClubsManually } from '../storage/adminStorage'

function ClubAdminPanel() {
  const { clubId } = useParams()
  const navigate = useNavigate()
  const [club, setClub] = useState(null)
  const [clubs, setClubs] = useState([])
  const [language, setLanguage] = useState('en')
  const [isLoading, setIsLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const loadData = () => {
    syncMembersToClubsManually()
    const allClubs = loadClubs()
    setClubs(allClubs)
    const foundClub = getClubById(clubId)
    if (foundClub) {
      setClub(foundClub)
        // Use app-wide language (persists across navigation)
        setLanguage(getAppLanguage())
    } else {
      navigate('/admin/all-clubs')
    }
    setIsLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [clubId, navigate])

  useEffect(() => {
    const onSynced = () => loadData()
    window.addEventListener('clubs-synced', onSynced)
    return () => window.removeEventListener('clubs-synced', onSynced)
  }, [clubId])
  
  // Save language preference when it changes
  useEffect(() => {
    if (language) {
      setAppLanguage(language)
      if (clubId) {
        localStorage.setItem(`club_${clubId}_language`, language)
      }
    }
  }, [clubId, language])

  const handleClubUpdate = (updates) => {
    const updatedClub = { ...club, ...updates, updatedAt: new Date().toISOString() }
    setClub(updatedClub)
    
    const updatedClubs = clubs.map(c => c.id === clubId ? updatedClub : c)
    setClubs(updatedClubs)
    saveClubs(updatedClubs)
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Loading...</div>
      </div>
    )
  }

  if (!club) {
    return null
  }

  return (
    <div className={`club-admin-panel ${sidebarOpen ? 'sidebar-open' : ''} ${language === 'ar' ? 'rtl' : ''}`}>
      <div
        className="club-admin-sidebar-backdrop"
        aria-hidden={!sidebarOpen}
        onClick={() => setSidebarOpen(false)}
      />
      <ClubAdminSidebar 
        club={club}
        language={language}
        onLanguageChange={setLanguage}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="club-admin-content" onClick={() => setSidebarOpen(false)}>
        <ClubAdminHeader 
          club={club}
          language={language}
          onLanguageChange={setLanguage}
          onMenuToggle={() => setSidebarOpen(true)}
        />
        <Routes>
          <Route path="/" element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<ClubPageGuard permission="dashboard"><ClubDashboard club={club} /></ClubPageGuard>} />
          <Route path="members" element={<ClubPageGuard permission="members"><ClubMembersManagement club={club} language={language} /></ClubPageGuard>} />
          <Route path="offers" element={<ClubPageGuard permission="offers"><ClubOffersManagement club={club} language={language} onUpdateClub={handleClubUpdate} /></ClubPageGuard>} />
          <Route path="store" element={<ClubPageGuard permission="store"><ClubStoreManagement club={club} language={language} onUpdateClub={handleClubUpdate} /></ClubPageGuard>} />
          <Route path="accounting" element={<ClubPageGuard permission="accounting"><ClubAccountingManagement club={club} language={language} onUpdateClub={handleClubUpdate} /></ClubPageGuard>} />
          <Route path="settings" element={<ClubPageGuard permission="settings"><ClubSettings club={club} onUpdateClub={handleClubUpdate} onDefaultLanguageChange={(lang) => { setLanguage(lang); setAppLanguage(lang); if (clubId) localStorage.setItem(`club_${clubId}_language`, lang) }} /></ClubPageGuard>} />
          <Route path="users" element={<ClubPageGuard permission="users"><ClubUsersManagement club={club} onUpdateClub={handleClubUpdate} language={language} /></ClubPageGuard>} />
        </Routes>
      </div>
    </div>
  )
}

export default ClubAdminPanel
