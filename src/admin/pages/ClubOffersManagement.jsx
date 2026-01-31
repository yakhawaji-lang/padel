import React, { useState } from 'react'
import './OffersManagement.css'

const ClubOffersManagement = ({ club, onUpdateClub }) => {
  const [offers, setOffers] = useState(club?.offers || [])

  if (!club) {
    return <div className="club-admin-page">Loading...</div>
  }

  return (
    <div className="club-admin-page">
      <div className="offers-management">
        <div className="page-header">
          <h2 className="page-title">{club.logo && <img src={club.logo} alt="" className="club-logo" />}Offers Management - {club.name}</h2>
          <button className="btn-primary">+ Add Offer</button>
        </div>

        <div className="offers-list">
          {offers.length === 0 ? (
            <div className="empty-state">
              <p>No offers found. Add your first offer!</p>
            </div>
          ) : (
            offers.map(offer => (
              <div key={offer.id} className="offer-card">
                <h3>{offer.title}</h3>
                <p>{offer.description}</p>
                <p>Discount: {offer.discount}%</p>
                <div className="card-actions">
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

export default ClubOffersManagement
