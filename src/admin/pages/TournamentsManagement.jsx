import React, { useState } from 'react'
import './TournamentsManagement.css'

const TournamentsManagement = ({ currentClub, clubs, onUpdateClub }) => {
  const [tournaments, setTournaments] = useState(currentClub?.tournaments || [])

  if (!currentClub) {
    return (
      <div className="admin-page">
        <div className="no-club-selected">
          <p>Please select a club first</p>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="tournaments-management">
        <div className="page-header">
          <h2 className="page-title">{currentClub.logo && <img src={currentClub.logo} alt="" className="club-logo" />}Tournaments Management - {currentClub.name}</h2>
          <button className="btn-primary">+ Create Tournament</button>
        </div>

        <div className="tournaments-list">
          {tournaments.length === 0 ? (
            <div className="empty-state">
              <p>No tournaments found. Create your first tournament!</p>
            </div>
          ) : (
            tournaments.map(tournament => (
              <div key={tournament.id} className="tournament-card">
                <h3>{tournament.name}</h3>
                <p>Type: {tournament.type}</p>
                <p>Status: {tournament.status}</p>
                <div className="card-actions">
                  <button className="btn-secondary">View</button>
                  <button className="btn-secondary">Edit</button>
                  <button className="btn-danger">Delete</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default TournamentsManagement
