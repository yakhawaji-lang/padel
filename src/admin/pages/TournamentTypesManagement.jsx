import React, { useState } from 'react'
import './TournamentTypesManagement.css'

const TournamentTypesManagement = ({ currentClub, clubs, onUpdateClub }) => {
  const [types, setTypes] = useState(currentClub?.tournamentTypes || [])
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({ name: '', nameAr: '', description: '', descriptionAr: '' })

  if (!currentClub) {
    return (
      <div className="admin-page">
        <div className="no-club-selected">
          <p>Please select a club first</p>
        </div>
      </div>
    )
  }

  const handleCreate = () => {
    const newType = {
      id: Date.now().toString(),
      ...formData
    }
    const updatedTypes = [...types, newType]
    setTypes(updatedTypes)
    onUpdateClub(currentClub.id, { tournamentTypes: updatedTypes })
    setFormData({ name: '', nameAr: '', description: '', descriptionAr: '' })
    setShowModal(false)
  }

  return (
    <div className="admin-page">
      <div className="tournament-types-management">
        <div className="page-header">
          <h2 className="page-title">{currentClub.logo && <img src={currentClub.logo} alt="" className="club-logo" />}Tournament Types - {currentClub.name}</h2>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            + Add Type
          </button>
        </div>

        <div className="types-list">
          {types.map(type => (
            <div key={type.id} className="type-card">
              <h3>{type.name}</h3>
              {type.nameAr && <p className="name-ar">{type.nameAr}</p>}
              {type.description && <p>{type.description}</p>}
              <div className="card-actions">
                <button className="btn-secondary">Edit</button>
                <button className="btn-danger">Delete</button>
              </div>
            </div>
          ))}
        </div>

        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Add Tournament Type</h3>
              <div className="form-group">
                <label>Name (English)</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Name (Arabic)</label>
                <input
                  type="text"
                  value={formData.nameAr}
                  onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn-primary" onClick={handleCreate}>Create</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TournamentTypesManagement
