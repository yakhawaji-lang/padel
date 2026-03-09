import React from 'react'
import './Dashboard.css'

const Dashboard = ({ currentClub, clubs }) => {
  if (!currentClub) {
    return (
      <div className="admin-page">
        <div className="no-club-selected">
          <h2>Welcome to Admin Panel</h2>
          <p>Please create or select a club to get started</p>
          <div style={{ marginTop: '20px' }}>
            <a href="/admin/clubs" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>
              Go to Clubs Management
            </a>
          </div>
        </div>
      </div>
    )
  }

  const stats = {
    totalTournaments: currentClub.tournaments?.length || 0,
    totalMembers: currentClub.members?.length || 0,
    totalBookings: currentClub.bookings?.length || 0,
    totalRevenue: currentClub.accounting?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0
  }

  return (
    <div className="admin-page">
      <div className="dashboard-container">
        <h2 className="page-title">Dashboard</h2>
        
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">🏆</div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalTournaments}</div>
              <div className="stat-label">Tournaments</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalMembers}</div>
              <div className="stat-label">Members</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">📅</div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalBookings}</div>
              <div className="stat-label">Bookings</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">💰</div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalRevenue.toFixed(2)} SAR</div>
              <div className="stat-label">Total Revenue</div>
            </div>
          </div>
        </div>

        <div className="dashboard-sections">
          <div className="dashboard-section">
            <h3>Recent Activity</h3>
            <p>Activity feed will be displayed here</p>
          </div>
          
          <div className="dashboard-section">
            <h3>Quick Actions</h3>
            <div className="quick-actions">
              <button className="action-btn">Create Tournament</button>
              <button className="action-btn">Add Member</button>
              <button className="action-btn">New Booking</button>
              <button className="action-btn">View Reports</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
