import React, { useState } from 'react'
import './MembersManagement.css'

const MembersManagement = ({ currentClub, clubs, onUpdateClub }) => {
  const [members, setMembers] = useState(currentClub?.members || [])

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
      <div className="members-management">
        <div className="page-header">
          <h2 className="page-title">{currentClub.logo && <img src={currentClub.logo} alt="" className="club-logo" />}Members Management - {currentClub.name}</h2>
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

export default MembersManagement
