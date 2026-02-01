import React, { useState, useEffect, useMemo } from 'react'
import { getClubMembersFromStorage } from '../../storage/adminStorage'
import './MembersManagement.css'

const ClubMembersManagement = ({ club, onUpdateClub }) => {
  const [refreshKey, setRefreshKey] = useState(0)

  const members = useMemo(() => {
    if (!club?.id) return []
    const fromStorage = getClubMembersFromStorage(club.id)
    const fromClub = club?.members || []
    const byId = new Map()
    fromStorage.forEach(m => { if (m?.id) byId.set(String(m.id), m) })
    fromClub.forEach(m => { if (m?.id && !byId.has(String(m.id))) byId.set(String(m.id), m) })
    return Array.from(byId.values())
  }, [club?.id, club?.members, refreshKey])

  useEffect(() => {
    const onSynced = () => setRefreshKey(k => k + 1)
    const onVisible = () => { if (document.visibilityState === 'visible') setRefreshKey(k => k + 1) }
    window.addEventListener('clubs-synced', onSynced)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('clubs-synced', onSynced)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  if (!club) {
    return <div className="club-admin-page">Loading...</div>
  }

  return (
    <div className="club-admin-page">
      <div className="members-management">
        <div className="page-header">
          <h2 className="page-title">{club.logo && <img src={club.logo} alt="" className="club-logo" />}Members Management - {club.name}</h2>
          <button className="btn-primary">+ Add Member</button>
        </div>

        <div className="members-table">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Total Games</th>
                <th>Total Wins</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>
                    No members found
                  </td>
                </tr>
              ) : (
                members.map(member => (
                  <tr key={member.id}>
                    <td>{member.id}</td>
                    <td>{member.name}</td>
                    <td>{member.mobile || '-'}</td>
                    <td>{member.email || '-'}</td>
                    <td>{member.totalGames || 0}</td>
                    <td>{member.totalWins || 0}</td>
                    <td>
                      <button className="btn-secondary">Edit</button>
                      <button className="btn-danger">Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default ClubMembersManagement
