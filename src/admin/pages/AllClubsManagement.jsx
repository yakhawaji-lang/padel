import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './AllClubsManagement.css'
import './common.css'
import { syncMembersToClubsManually, loadClubs } from '../../storage/adminStorage'

const AllClubsManagement = ({ clubs, onCreateClub, onUpdateClub, onDeleteClub }) => {
  const navigate = useNavigate()
  const [showCreateModal, setShowCreateModal] = useState(false)
  
  // Debug: Log clubs data
  React.useEffect(() => {
    console.log('AllClubsManagement - clubs prop:', clubs)
    console.log('AllClubsManagement - clubs type:', typeof clubs)
    console.log('AllClubsManagement - clubs is array:', Array.isArray(clubs))
    console.log('AllClubsManagement - clubs length:', clubs?.length)
    if (clubs && clubs.length > 0) {
      console.log('AllClubsManagement - First club:', clubs[0])
    }
  }, [clubs])
  
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

  // Ensure clubs is always an array
  const safeClubs = Array.isArray(clubs) ? clubs : []
  
  console.log('AllClubsManagement Render - safeClubs:', safeClubs)
  console.log('AllClubsManagement Render - safeClubs.length:', safeClubs.length)

  return (
    <div className="main-admin-page">
      <div className="all-clubs-management">
        <div className="page-header">
          <div>
            <h2 className="page-title">Manage All Clubs</h2>
            <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#666' }}>
              Sync members from localStorage to update member counts
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              className="btn-secondary"
              onClick={() => {
                const updatedClubs = syncMembersToClubsManually()
                alert(`Synced members! Found ${updatedClubs.reduce((sum, c) => sum + (c.members?.length || 0), 0)} total members across all clubs.`)
                window.location.reload()
              }}
              title="Sync members from localStorage to clubs"
            >
              🔄 Sync Members
            </button>
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

        <div className="clubs-table-container">
          {safeClubs.length > 0 && (
            <div className="table-info">
              <span>Total Clubs: <strong>{safeClubs.length}</strong></span>
            </div>
          )}
          <table className="clubs-table">
            <thead>
              <tr>
                <th>Club Name</th>
                <th>Address</th>
                <th>Courts</th>
                <th>Members</th>
                <th>Tournaments</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {safeClubs.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                      <div style={{ fontSize: '48px', opacity: 0.5 }}>🏢</div>
                      <p style={{ margin: 0, fontSize: '16px', color: '#666' }}>
                        No clubs found. Create your first club!
                      </p>
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
                  </td>
                </tr>
              ) : (
                safeClubs.map(club => {
                  if (!club || !club.id) {
                    console.warn('Invalid club data:', club)
                    return null
                  }
                  return (
                  <tr key={club.id}>
                    <td>
                      <span className="club-name-cell">
                        {club.logo && <img src={club.logo} alt="" className="club-logo-table" />}
                        <span>
                          <strong style={{ fontSize: '15px', color: '#333' }}>{club.name || 'Unnamed Club'}</strong>
                          {club.nameAr && (
                            <div style={{ fontSize: '12px', color: '#999', marginTop: '4px', fontStyle: 'italic' }}>
                              {club.nameAr}
                            </div>
                          )}
                        </span>
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '13px' }}>{club.address || '-'}</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: '600', color: '#2196f3' }}>{club.courts?.length || 0}</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: '600', color: '#4caf50' }}>{club.members?.length || 0}</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: '600', color: '#ff9800' }}>{club.tournaments?.length || 0}</span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button 
                          className="btn-primary btn-small"
                          onClick={() => navigate(`/club/${club.id}`)}
                          title="Open Club Page"
                        >
                          🏠
                        </button>
                        <button 
                          className="btn-secondary btn-small"
                          onClick={() => navigate(`/admin/club/${club.id}`)}
                          title="Club Admin Panel"
                        >
                          ⚙️
                        </button>
                        <button 
                          className="btn-secondary btn-small"
                          onClick={() => handleEdit(club)}
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button 
                          className="btn-danger btn-small"
                          onClick={() => handleDelete(club.id)}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

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

export default AllClubsManagement
