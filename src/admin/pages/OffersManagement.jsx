import React, { useState } from 'react'
import './OffersManagement.css'

const OffersManagement = ({ currentClub, clubs, onUpdateClub }) => {
  const [offers, setOffers] = useState(currentClub?.offers || [])

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
      <div className="offers-management">
        <div className="page-header">
          <h2 className="page-title">{currentClub.logo && <img src={currentClub.logo} alt="" className="club-logo" />}Offers Management - {currentClub.name}</h2>
          <button className="btn-primary">+ Create Offer</button>
        </div>

        <div className="offers-list">
          {offers.length === 0 ? (
            <div className="empty-state">
              <p>No offers found. Create your first offer!</p>
            </div>
          ) : (
            offers.map(offer => (
              <div key={offer.id} className="offer-card">
                <h3>{offer.name}</h3>
                <p>{offer.description}</p>
                <p><strong>Discount:</strong> {offer.discount}%</p>
                <p><strong>Valid Until:</strong> {offer.validUntil}</p>
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

export default OffersManagement
