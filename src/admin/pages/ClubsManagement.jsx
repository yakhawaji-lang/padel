import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './ClubsManagement.css'
import { ensureHalaPadelExists } from '../utils/initHalaPadel'

const ClubsManagement = ({ clubs, currentClub, onCreateClub, onUpdateClub, onDeleteClub, onSelectClub }) => {
  const navigate = useNavigate()
  const [showCreateModal, setShowCreateModal] = useState(false)
  
  // Ensure Hala Padel exists on mount
  useEffect(() => {
    ensureHalaPadelExists()
    // Note: Clubs will be reloaded by parent component
  }, [])
  const [editingClub, setEditingClub] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    nameAr: '',
    address: '',
    addressAr: '',
    phone: '',
    email: '',
    website: '',
    playtomicVenueId: '',
    playtomicApiKey: ''
  })

  const handleCreate = () => {
    if (!formData.name.trim()) {
      alert('Club name is required')
      return
    }
    
    const newClub = onCreateClub({
      ...formData,
      courts: [
        { id: 'court-1', name: 'Court 1', nameAr: 'الملعب 1', type: 'indoor' },
        { id: 'court-2', name: 'Court 2', nameAr: 'الملعب 2', type: 'indoor' },
        { id: 'court-3', name: 'Court 3', nameAr: 'الملعب 3', type: 'indoor' },
        { id: 'court-4', name: 'Court 4', nameAr: 'الملعب 4', type: 'indoor' }
      ],
      settings: {
        defaultLanguage: 'en',
        timezone: 'Asia/Riyadh',
        currency: 'SAR',
        bookingDuration: 60,
        maxBookingAdvance: 30,
        cancellationPolicy: 24
      }
    })
    
    setFormData({
      name: '',
      nameAr: '',
      address: '',
      addressAr: '',
      phone: '',
      email: '',
      website: '',
      playtomicVenueId: '',
      playtomicApiKey: ''
    })
    setShowCreateModal(false)
    navigate(`/admin/clubs/${newClub.id}`)
  }

  const handleEdit = (club) => {
    setEditingClub(club)
    setFormData({
      name: club.name || '',
      nameAr: club.nameAr || '',
      address: club.address || '',
      addressAr: club.addressAr || '',
      phone: club.phone || '',
      email: club.email || '',
      website: club.website || '',
      playtomicVenueId: club.playtomicVenueId || '',
      playtomicApiKey: club.playtomicApiKey || ''
    })
    setShowCreateModal(true)
  }

  const handleUpdate = () => {
    if (!formData.name.trim()) {
      alert('Club name is required')
      return
    }
    
    onUpdateClub(editingClub.id, formData)
    setShowCreateModal(false)
    setEditingClub(null)
    setFormData({
      name: '',
      nameAr: '',
      address: '',
      addressAr: '',
      phone: '',
      email: '',
      website: '',
      playtomicVenueId: '',
      playtomicApiKey: ''
    })
  }

  const handleDelete = (clubId) => {
    if (window.confirm('Are you sure you want to delete this club? This action cannot be undone.')) {
      onDeleteClub(clubId)
    }
  }

  return (
    <div className="admin-page">
      <div className="clubs-management">
        <div className="page-header">
          <h2 className="page-title">Clubs Management</h2>
          <div style={{ display: 'flex', gap: '10px' }}>
            {!clubs.some(c => c.id === 'hala-padel') && (
              <button 
                className="btn-primary"
                onClick={() => {
                  ensureHalaPadelExists()
                  window.location.reload()
                }}
                style={{ background: '#4caf50' }}
              >
                🏢 Create Hala Padel (Example)
              </button>
            )}
            <button 
              className="btn-primary"
              onClick={() => {
                setEditingClub(null)
                setFormData({
                  name: '',
                  nameAr: '',
                  address: '',
                  addressAr: '',
                  phone: '',
                  email: '',
                  website: '',
                  playtomicVenueId: '',
                  playtomicApiKey: ''
                })
                setShowCreateModal(true)
              }}
            >
              + Add New Club
            </button>
          </div>
        </div>

        {clubs.length === 0 ? (
          <div className="empty-state">
            <p>No clubs found. Create your first club!</p>
            <button 
              className="btn-primary"
              onClick={() => {
                setEditingClub(null)
                setFormData({
                  name: '',
                  nameAr: '',
                  address: '',
                  addressAr: '',
                  phone: '',
                  email: '',
                  website: '',
                  playtomicVenueId: '',
                  playtomicApiKey: ''
                })
                setShowCreateModal(true)
              }}
            >
              + Create First Club
            </button>
          </div>
        ) : (
          <div className="clubs-grid">
            {clubs.map(club => (
              <div key={club.id} className="club-card">
                <div className="club-card-header">
                  {club.logo && <img src={club.logo} alt="" className="club-logo" />}
                  <div>
                    <h3>{club.name}</h3>
                    {club.nameAr && <p className="club-name-ar">{club.nameAr}</p>}
                  </div>
                </div>
                <div className="club-card-body">
                  {club.address && <p><strong>Address:</strong> {club.address}</p>}
                  {club.phone && <p><strong>Phone:</strong> {club.phone}</p>}
                  {club.email && <p><strong>Email:</strong> {club.email}</p>}
                  <div className="club-stats">
                    <div className="stat-item">
                      <span className="stat-icon">🏟️</span>
                      <span className="stat-text">{club.courts?.length || 0} Courts</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-icon">👥</span>
                      <span className="stat-text">{club.members?.length || 0} Members</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-icon">🏆</span>
                      <span className="stat-text">{club.tournaments?.length || 0} Tournaments</span>
                    </div>
                  </div>
                </div>
                <div className="club-card-actions">
                  <div className="primary-actions">
                    <button 
                      className="btn-primary btn-full"
                      onClick={() => {
                        import('../../storage/appSettingsStorage').then(({ setAdminCurrentClubId }) => setAdminCurrentClubId(club.id))
                        onSelectClub(club)
                        window.open(`/app?club=${club.id}`, '_blank')
                      }}
                      title="Open club dashboard in new tab"
                    >
                      🏠 Club Dashboard / لوحة تحكم النادي
                    </button>
                    <button 
                      className="btn-secondary btn-full"
                      onClick={() => navigate(`/admin/clubs/${club.id}`)}
                    >
                      📋 Club Details / تفاصيل النادي
                    </button>
                  </div>
                  <div className="secondary-actions">
                    <button 
                      className="btn-secondary btn-small"
                      onClick={() => handleEdit(club)}
                    >
                      ✏️ Edit
                    </button>
                    <button 
                      className="btn-danger btn-small"
                      onClick={() => handleDelete(club.id)}
                    >
                      🗑️ Delete
                    </button>
                    {currentClub?.id !== club.id && (
                      <button 
                        className="btn-secondary btn-small"
                        onClick={() => onSelectClub(club)}
                      >
                        ✓ Select
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {showCreateModal && (
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>{editingClub ? 'Edit Club' : 'Create New Club'}</h3>
              <div className="form-group">
                <label>Club Name (English) *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter club name"
                />
              </div>
              <div className="form-group">
                <label>Club Name (Arabic)</label>
                <input
                  type="text"
                  value={formData.nameAr}
                  onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                  placeholder="أدخل اسم النادي"
                />
              </div>
              <div className="form-group">
                <label>Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Enter address"
                />
              </div>
              <div className="form-group">
                <label>Address (Arabic)</label>
                <input
                  type="text"
                  value={formData.addressAr}
                  onChange={(e) => setFormData({ ...formData, addressAr: e.target.value })}
                  placeholder="أدخل العنوان"
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Enter phone number"
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Enter email"
                />
              </div>
              <div className="form-group">
                <label>Website</label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="form-group">
                <label>Playtomic Venue ID</label>
                <input
                  type="text"
                  value={formData.playtomicVenueId}
                  onChange={(e) => setFormData({ ...formData, playtomicVenueId: e.target.value })}
                  placeholder="Enter Playtomic venue ID"
                />
              </div>
              <div className="form-group">
                <label>Playtomic API Key</label>
                <input
                  type="password"
                  value={formData.playtomicApiKey}
                  onChange={(e) => setFormData({ ...formData, playtomicApiKey: e.target.value })}
                  placeholder="Enter API key"
                />
              </div>
              <div className="modal-actions">
                <button 
                  className="btn-secondary"
                  onClick={() => {
                    setShowCreateModal(false)
                    setEditingClub(null)
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="btn-primary"
                  onClick={editingClub ? handleUpdate : handleCreate}
                >
                  {editingClub ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ClubsManagement
