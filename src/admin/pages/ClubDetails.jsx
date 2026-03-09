import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getClubMembersFromStorage } from '../../storage/adminStorage'
import './ClubDetails.css'

const ClubDetails = ({ clubs, onUpdateClub }) => {
  const { clubId } = useParams()
  const navigate = useNavigate()
  const [club, setClub] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    const foundClub = clubs.find(c => c.id === clubId)
    if (foundClub) {
      setClub(foundClub)
    } else {
      navigate('/admin/clubs')
    }
  }, [clubId, clubs, navigate])

  if (!club) {
    return <div>Loading...</div>
  }

  return (
    <div className="admin-page">
      <div className="club-details">
        <div className="page-header">
          <button className="btn-secondary" onClick={() => navigate('/admin/clubs')}>
            ← Back to Clubs
          </button>
          <h2 className="page-title">{club.logo && <img src={club.logo} alt="" className="club-logo" />}{club.name}</h2>
        </div>

        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={`tab ${activeTab === 'courts' ? 'active' : ''}`}
            onClick={() => setActiveTab('courts')}
          >
            Courts
          </button>
          <button 
            className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'overview' && (
            <div className="overview-section">
              <div className="info-card">
                <h3>Club Information</h3>
                <p><strong>Name:</strong> {club.name}</p>
                {club.nameAr && <p><strong>Name (Arabic):</strong> {club.nameAr}</p>}
                <p><strong>Address:</strong> {club.address}</p>
                {club.addressAr && <p><strong>Address (Arabic):</strong> {club.addressAr}</p>}
                {club.phone && <p><strong>Phone:</strong> {club.phone}</p>}
                {club.email && <p><strong>Email:</strong> {club.email}</p>}
                {club.website && <p><strong>Website:</strong> <a href={club.website} target="_blank" rel="noopener noreferrer">{club.website}</a></p>}
              </div>

              <div className="stats-card">
                <h3>Statistics</h3>
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-value">{club.tournaments?.length || 0}</span>
                    <span className="stat-label">Tournaments</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{getClubMembersFromStorage(club.id).length}</span>
                    <span className="stat-label">Members</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{club.bookings?.length || 0}</span>
                    <span className="stat-label">Bookings</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{club.courts?.length || 0}</span>
                    <span className="stat-label">Courts</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'courts' && (
            <div className="courts-section">
              <h3>Courts Management</h3>
              <div className="courts-list">
                {club.courts?.map(court => (
                  <div key={court.id} className="court-item">
                    <span>{court.name}</span>
                    {court.nameAr && <span className="court-name-ar">({court.nameAr})</span>}
                    <span className="court-type">{court.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="settings-section">
              <h3>Club Settings</h3>
              <div className="settings-form">
                <div className="form-group">
                  <label>Default Language</label>
                  <select value={club.settings?.defaultLanguage || 'en'}>
                    <option value="en">English</option>
                    <option value="ar">Arabic</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Currency</label>
                  <input type="text" value={club.settings?.currency || 'SAR'} />
                </div>
                <div className="form-group">
                  <label>Booking Duration (minutes)</label>
                  <input type="number" value={club.settings?.bookingDuration || 60} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ClubDetails
