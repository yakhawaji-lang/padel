import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import './AdminApp.css'
import './pages/common.css'
import AdminSidebar from './components/AdminSidebar'
import AdminHeader from './components/AdminHeader'
import Dashboard from './pages/Dashboard'
import ClubsManagement from './pages/ClubsManagement'
import TournamentsManagement from './pages/TournamentsManagement'
import TournamentTypesManagement from './pages/TournamentTypesManagement'
import MembersManagement from './pages/MembersManagement'
import BookingsManagement from './pages/BookingsManagement'
import OffersManagement from './pages/OffersManagement'
import AccountingManagement from './pages/AccountingManagement'
import ClubDetails from './pages/ClubDetails'
import { loadClubs, saveClubs } from '../storage/adminStorage'

function AdminApp() {
  const [currentClub, setCurrentClub] = useState(null)
  const [clubs, setClubs] = useState([])
  const [language, setLanguage] = useState('en')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Load clubs on mount
    const loadData = async () => {
      // Ensure Hala Padel exists before loading
      const { ensureHalaPadelExists } = await import('./utils/initHalaPadel')
      ensureHalaPadelExists()
      
      const savedClubs = loadClubs()
      // Force update
      setClubs([...savedClubs])
      
      // Check if club ID is in URL
      const urlParams = new URLSearchParams(window.location.search)
      const clubIdFromUrl = urlParams.get('club')
      
      // Set default club if exists
      if (savedClubs.length > 0) {
        let club = null
        
        // Priority: URL parameter > saved preference > first club
        if (clubIdFromUrl) {
          club = savedClubs.find(c => c.id === clubIdFromUrl)
        }
        
        if (!club) {
          const savedCurrentClubId = localStorage.getItem('admin_current_club_id')
          club = savedCurrentClubId 
            ? savedClubs.find(c => c.id === savedCurrentClubId) || savedClubs[0]
            : savedClubs[0]
        }
        
        setCurrentClub(club)
        localStorage.setItem('admin_current_club_id', club.id)
      }
      
      setIsLoading(false)
    }
    loadData()
  }, [])

  // Save current club selection
  useEffect(() => {
    if (currentClub) {
      localStorage.setItem('admin_current_club_id', currentClub.id)
    }
  }, [currentClub])

  const handleClubChange = (club) => {
    setCurrentClub(club)
  }

  const handleClubCreate = async (clubData) => {
    const newClub = {
      id: Date.now().toString(),
      ...clubData,
      createdAt: new Date().toISOString(),
      tournaments: [],
      members: [],
      bookings: [],
      offers: [],
      accounting: []
    }
    const updatedClubs = [...clubs, newClub]
    setClubs(updatedClubs)
    await saveClubs(updatedClubs)
    setCurrentClub(newClub)
    return newClub
  }

  const handleClubUpdate = async (clubId, clubData) => {
    const updatedClubs = clubs.map(club => 
      club.id === clubId ? { ...club, ...clubData, updatedAt: new Date().toISOString() } : club
    )
    setClubs(updatedClubs)
    await saveClubs(updatedClubs)
    if (currentClub?.id === clubId) {
      setCurrentClub(updatedClubs.find(c => c.id === clubId))
    }
  }

  const handleClubDelete = async (clubId) => {
    const updatedClubs = clubs.filter(club => club.id !== clubId)
    setClubs(updatedClubs)
    await saveClubs(updatedClubs)
    if (currentClub?.id === clubId) {
      setCurrentClub(updatedClubs.length > 0 ? updatedClubs[0] : null)
    }
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Loading...</div>
      </div>
    )
  }

  return (
    <div className="admin-app">
      <AdminSidebar 
        currentClub={currentClub}
        clubs={clubs}
        onClubChange={handleClubChange}
        language={language}
        onLanguageChange={setLanguage}
      />
      <div className="admin-main-content">
        <AdminHeader 
          currentClub={currentClub}
          language={language}
          onLanguageChange={setLanguage}
        />
        <Routes>
            <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
            <Route 
              path="/admin/dashboard" 
              element={
                <Dashboard 
                  currentClub={currentClub}
                  clubs={clubs}
                />
              } 
            />
            <Route 
              path="/admin/clubs" 
              element={
                <ClubsManagement 
                  clubs={clubs}
                  currentClub={currentClub}
                  onCreateClub={handleClubCreate}
                  onUpdateClub={handleClubUpdate}
                  onDeleteClub={handleClubDelete}
                  onSelectClub={handleClubChange}
                />
              } 
            />
            <Route 
              path="/admin/clubs/:clubId" 
              element={
                <ClubDetails 
                  clubs={clubs}
                  onUpdateClub={handleClubUpdate}
                />
              } 
            />
            <Route 
              path="/admin/tournaments" 
              element={
                <TournamentsManagement 
                  currentClub={currentClub}
                  clubs={clubs}
                  onUpdateClub={handleClubUpdate}
                />
              } 
            />
            <Route 
              path="/admin/tournament-types" 
              element={
                <TournamentTypesManagement 
                  currentClub={currentClub}
                  clubs={clubs}
                  onUpdateClub={handleClubUpdate}
                />
              } 
            />
            <Route 
              path="/admin/members" 
              element={
                <MembersManagement 
                  currentClub={currentClub}
                  clubs={clubs}
                  onUpdateClub={handleClubUpdate}
                />
              } 
            />
            <Route 
              path="/admin/bookings" 
              element={
                <BookingsManagement 
                  currentClub={currentClub}
                  clubs={clubs}
                  onUpdateClub={handleClubUpdate}
                />
              } 
            />
            <Route 
              path="/admin/offers" 
              element={
                <OffersManagement 
                  currentClub={currentClub}
                  clubs={clubs}
                  onUpdateClub={handleClubUpdate}
                />
              } 
            />
            <Route 
              path="/admin/accounting" 
              element={
                <AccountingManagement 
                  currentClub={currentClub}
                  clubs={clubs}
                  onUpdateClub={handleClubUpdate}
                />
              } 
            />
        </Routes>
      </div>
    </div>
  )
}

export default AdminApp
