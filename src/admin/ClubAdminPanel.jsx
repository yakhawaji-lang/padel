import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom'
import './ClubAdminPanel.css'
import ClubAdminSidebar from './components/ClubAdminSidebar'
import ClubAdminHeader from './components/ClubAdminHeader'
import ClubDashboard from './pages/ClubDashboard'
import ClubMembersManagement from './pages/ClubMembersManagement'
import ClubOffersManagement from './pages/ClubOffersManagement'
import ClubStoreManagement from './pages/ClubStoreManagement'
import ClubAccountingManagement from './pages/ClubAccountingManagement'
import ClubSettings from './pages/ClubSettings'
import { loadClubs, saveClubs, getClubById } from '../storage/adminStorage'

function ClubAdminPanel() {
  const { clubId } = useParams()
  const navigate = useNavigate()
  const [club, setClub] = useState(null)
  const [clubs, setClubs] = useState([])
  const [language, setLanguage] = useState('en')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = () => {
      const allClubs = loadClubs()
      setClubs(allClubs)
      
      const foundClub = getClubById(clubId)
      if (foundClub) {
        setClub(foundClub)
        // Load language from localStorage (user preference) or club default
        const savedLanguage = localStorage.getItem(`club_${clubId}_language`)
        const clubDefaultLanguage = foundClub.settings?.defaultLanguage || 'en'
        setLanguage(savedLanguage || clubDefaultLanguage)
      } else {
        // Club not found, redirect to main admin
        navigate('/admin/all-clubs')
      }
      
      setIsLoading(false)
    }
    loadData()
  }, [clubId, navigate])
  
  // Save language preference when it changes
  useEffect(() => {
    if (clubId && language) {
      localStorage.setItem(`club_${clubId}_language`, language)
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
    <div className="club-admin-panel">
      <ClubAdminSidebar 
        club={club}
        language={language}
        onLanguageChange={setLanguage}
      />
      <div className="club-admin-content">
        <ClubAdminHeader 
          club={club}
          language={language}
          onLanguageChange={setLanguage}
        />
        <Routes>
          <Route path="/" element={<Navigate to="dashboard" replace />} />
          <Route 
            path="dashboard" 
            element={
              <ClubDashboard 
                club={club}
              />
            } 
          />
          <Route 
            path="members" 
            element={
              <ClubMembersManagement 
                club={club}
                onUpdateClub={handleClubUpdate}
              />
            } 
          />
          <Route 
            path="offers" 
            element={
              <ClubOffersManagement 
                club={club}
                onUpdateClub={handleClubUpdate}
              />
            } 
          />
          <Route 
            path="store" 
            element={
              <ClubStoreManagement 
                club={club}
                language={language}
                onUpdateClub={handleClubUpdate}
              />
            } 
          />
          <Route 
            path="accounting" 
            element={
              <ClubAccountingManagement 
                club={club}
                onUpdateClub={handleClubUpdate}
              />
            } 
          />
          <Route 
            path="settings" 
            element={
              <ClubSettings 
                club={club}
                onUpdateClub={handleClubUpdate}
              />
            } 
          />
        </Routes>
      </div>
    </div>
  )
}

export default ClubAdminPanel
