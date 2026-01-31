import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import './AllClubsDashboard.css'

const AllClubsDashboard = ({ clubs, onUpdateClub }) => {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('name') // 'name', 'members', 'tournaments', 'revenue'
  const [sortOrder, setSortOrder] = useState('asc') // 'asc', 'desc'

  // Calculate total statistics
  const totalStats = useMemo(() => {
    return {
      totalClubs: clubs.length,
      totalMembers: clubs.reduce((sum, club) => sum + (club.members?.length || 0), 0),
      totalTournaments: clubs.reduce((sum, club) => sum + (club.tournaments?.length || 0), 0),
      totalBookings: clubs.reduce((sum, club) => sum + (club.bookings?.length || 0), 0),
      totalRevenue: clubs.reduce((sum, club) => 
        sum + (club.accounting?.reduce((acc, item) => acc + (parseFloat(item.amount) || 0), 0) || 0), 0
      ),
      totalCourts: clubs.reduce((sum, club) => sum + (club.courts?.length || 0), 0),
      activeClubs: clubs.filter(club => club.members?.length > 0 || club.tournaments?.length > 0).length,
      storesEnabled: clubs.filter(club => club.storeEnabled).length
    }
  }, [clubs])

  // Filter and sort clubs
  const filteredAndSortedClubs = useMemo(() => {
    let filtered = clubs.filter(club => {
      const query = searchQuery.toLowerCase()
      return (
        club.name?.toLowerCase().includes(query) ||
        club.nameAr?.toLowerCase().includes(query) ||
        club.address?.toLowerCase().includes(query) ||
        club.id?.toLowerCase().includes(query)
      )
    })

    // Sort clubs
    filtered.sort((a, b) => {
      let aValue, bValue
      
      switch (sortBy) {
        case 'members':
          aValue = a.members?.length || 0
          bValue = b.members?.length || 0
          break
        case 'tournaments':
          aValue = a.tournaments?.length || 0
          bValue = b.tournaments?.length || 0
          break
        case 'revenue':
          aValue = a.accounting?.reduce((acc, item) => acc + (parseFloat(item.amount) || 0), 0) || 0
          bValue = b.accounting?.reduce((acc, item) => acc + (parseFloat(item.amount) || 0), 0) || 0
          break
        case 'created':
          aValue = new Date(a.createdAt || 0).getTime()
          bValue = new Date(b.createdAt || 0).getTime()
          break
        default: // 'name'
          aValue = a.name?.toLowerCase() || ''
          bValue = b.name?.toLowerCase() || ''
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0
      }
    })

    return filtered
  }, [clubs, searchQuery, sortBy, sortOrder])

  const handleSort = (newSortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(newSortBy)
      setSortOrder('asc')
    }
  }

  const getClubRevenue = (club) => {
    return club.accounting?.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) || 0
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  return (
    <div className="main-admin-page">
      <div className="all-clubs-dashboard">
        <div className="dashboard-header">
          <div>
            <h2 className="page-title">All Clubs Dashboard</h2>
            <p className="page-subtitle">Overview and statistics for all clubs in the system</p>
          </div>
          <button 
            className="btn-primary"
            onClick={() => navigate('/admin/manage-clubs')}
          >
            + Add New Club
          </button>
        </div>
        
        {/* Statistics Cards */}
        <div className="total-stats-grid">
          <div className="total-stat-card stat-primary">
            <div className="total-stat-icon">🏢</div>
            <div className="total-stat-content">
              <div className="total-stat-value">{totalStats.totalClubs}</div>
              <div className="total-stat-label">Total Clubs</div>
              <div className="total-stat-sublabel">{totalStats.activeClubs} active</div>
            </div>
          </div>
          
          <div className="total-stat-card stat-success">
            <div className="total-stat-icon">👥</div>
            <div className="total-stat-content">
              <div className="total-stat-value">{totalStats.totalMembers}</div>
              <div className="total-stat-label">Total Members</div>
              <div className="total-stat-sublabel">
                {totalStats.totalClubs > 0 
                  ? Math.round(totalStats.totalMembers / totalStats.totalClubs) 
                  : 0} avg per club
              </div>
            </div>
          </div>
          
          <div className="total-stat-card stat-info">
            <div className="total-stat-icon">🏆</div>
            <div className="total-stat-content">
              <div className="total-stat-value">{totalStats.totalTournaments}</div>
              <div className="total-stat-label">Total Tournaments</div>
              <div className="total-stat-sublabel">
                {totalStats.totalClubs > 0 
                  ? Math.round(totalStats.totalTournaments / totalStats.totalClubs) 
                  : 0} avg per club
              </div>
            </div>
          </div>
          
          <div className="total-stat-card stat-warning">
            <div className="total-stat-icon">🏟️</div>
            <div className="total-stat-content">
              <div className="total-stat-value">{totalStats.totalCourts}</div>
              <div className="total-stat-label">Total Courts</div>
              <div className="total-stat-sublabel">
                {totalStats.totalClubs > 0 
                  ? (totalStats.totalCourts / totalStats.totalClubs).toFixed(1) 
                  : 0} avg per club
              </div>
            </div>
          </div>
          
          <div className="total-stat-card stat-danger">
            <div className="total-stat-icon">💰</div>
            <div className="total-stat-content">
              <div className="total-stat-value">{totalStats.totalRevenue.toFixed(0)}</div>
              <div className="total-stat-label">Total Revenue (SAR)</div>
              <div className="total-stat-sublabel">
                {totalStats.totalClubs > 0 
                  ? (totalStats.totalRevenue / totalStats.totalClubs).toFixed(0) 
                  : 0} avg per club
              </div>
            </div>
          </div>
          
          <div className="total-stat-card stat-secondary">
            <div className="total-stat-icon">📅</div>
            <div className="total-stat-content">
              <div className="total-stat-value">{totalStats.totalBookings}</div>
              <div className="total-stat-label">Total Bookings</div>
              <div className="total-stat-sublabel">All time</div>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="dashboard-controls">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search clubs by name, address, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <span className="search-icon">🔍</span>
          </div>
          <div className="sort-controls">
            <label>Sort by:</label>
            <select 
              value={sortBy} 
              onChange={(e) => handleSort(e.target.value)}
              className="sort-select"
            >
              <option value="name">Name</option>
              <option value="members">Members</option>
              <option value="tournaments">Tournaments</option>
              <option value="revenue">Revenue</option>
              <option value="created">Created Date</option>
            </select>
            <button 
              className="sort-order-btn"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>

        {/* Clubs List */}
        <div className="clubs-overview-section">
          <div className="section-header">
            <h3>
              All Clubs ({filteredAndSortedClubs.length})
              {searchQuery && <span className="search-results"> - Search results</span>}
            </h3>
          </div>
          
          {clubs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🏢</div>
              <p>No clubs found. Create your first club!</p>
              <button 
                className="btn-primary"
                onClick={() => navigate('/admin/manage-clubs')}
              >
                + Create First Club
              </button>
            </div>
          ) : filteredAndSortedClubs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <p>No clubs match your search criteria.</p>
              <button 
                className="btn-secondary"
                onClick={() => setSearchQuery('')}
              >
                Clear Search
              </button>
            </div>
          ) : (
            <div className="clubs-overview-grid">
              {filteredAndSortedClubs.map(club => {
                const clubRevenue = getClubRevenue(club)
                const hasPlaytomic = !!(club.playtomicVenueId && club.playtomicApiKey)
                
                return (
                  <div key={club.id} className="club-overview-card">
                    <div className="club-card-header">
                      {club.logo && <img src={club.logo} alt="" className="club-card-logo" />}
                      <div className="club-header-info">
                        <h4 className="club-name">{club.name}</h4>
                        {club.nameAr && (
                          <p className="club-name-ar">{club.nameAr}</p>
                        )}
                        {club.address && (
                          <p className="club-address">📍 {club.address}</p>
                        )}
                      </div>
                      <div className="club-card-badges">
                        {hasPlaytomic && (
                          <span className="playtomic-badge" title="Playtomic Integration">P</span>
                        )}
                        {onUpdateClub && (
                          <label className="store-toggle-wrap" title={club.storeEnabled ? 'Store enabled – click to disable' : 'Store disabled – click to enable'}>
                            <span className="store-toggle-label">🛒</span>
                            <input
                              type="checkbox"
                              checked={!!club.storeEnabled}
                              onChange={() => onUpdateClub(club.id, { storeEnabled: !club.storeEnabled })}
                              className="store-toggle"
                            />
                            <span className="store-toggle-text">{club.storeEnabled ? 'On' : 'Off'}</span>
                          </label>
                        )}
                      </div>
                    </div>

                    <div className="club-card-stats">
                      <div className="club-stat-item">
                        <span className="stat-icon">🏟️</span>
                        <div className="stat-details">
                          <span className="stat-value">{club.courts?.length || 0}</span>
                          <span className="stat-label">Courts</span>
                        </div>
                      </div>
                      <div className="club-stat-item">
                        <span className="stat-icon">👥</span>
                        <div className="stat-details">
                          <span className="stat-value">{club.members?.length || 0}</span>
                          <span className="stat-label">Members</span>
                        </div>
                      </div>
                      <div className="club-stat-item">
                        <span className="stat-icon">🏆</span>
                        <div className="stat-details">
                          <span className="stat-value">{club.tournaments?.length || 0}</span>
                          <span className="stat-label">Tournaments</span>
                        </div>
                      </div>
                      <div className="club-stat-item">
                        <span className="stat-icon">💰</span>
                        <div className="stat-details">
                          <span className="stat-value">{clubRevenue.toFixed(0)}</span>
                          <span className="stat-label">Revenue (SAR)</span>
                        </div>
                      </div>
                    </div>

                    {club.createdAt && (
                      <div className="club-meta">
                        <span className="meta-item">
                          Created: {formatDate(club.createdAt)}
                        </span>
                        {club.updatedAt && club.updatedAt !== club.createdAt && (
                          <span className="meta-item">
                            Updated: {formatDate(club.updatedAt)}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="club-card-actions">
                      <button 
                        className="btn-primary btn-small btn-full"
                        onClick={() => navigate(`/club/${club.id}`)}
                        title="Open Club Main Page"
                      >
                        🏠 Club Page
                      </button>
                      <button 
                        className="btn-secondary btn-small btn-full"
                        onClick={() => navigate(`/admin/club/${club.id}`)}
                        title="Open Club Admin Panel"
                      >
                        ⚙️ Admin Panel
                      </button>
                      <button 
                        className="btn-secondary btn-small btn-full"
                        onClick={() => navigate(`/admin/manage-clubs`)}
                        title="Edit Club Details"
                      >
                        ✏️ Edit
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AllClubsDashboard
