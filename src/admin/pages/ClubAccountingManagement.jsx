import React, { useState, useEffect } from 'react'
import './AccountingManagement.css'

const ClubAccountingManagement = ({ club, onUpdateClub, language }) => {
  const [accounting, setAccounting] = useState(club?.accounting || [])

  useEffect(() => {
    setAccounting(club?.accounting || [])
  }, [club?.id, club?.accounting])

  if (!club) {
    return <div className="club-admin-page">Loading...</div>
  }

  const lang = language || 'en'
  const t = {
    en: { delete: 'Delete', deleteConfirm: 'Are you sure you want to delete this transaction?' },
    ar: { delete: 'حذف', deleteConfirm: 'هل أنت متأكد من حذف هذه العملية؟' }
  }
  const c = t[lang]

  const handleDelete = (item, index) => {
    if (!window.confirm(c.deleteConfirm)) return
    const next = accounting.filter((_, i) => (item.id ? _.id !== item.id : i !== index))
    setAccounting(next)
    onUpdateClub({ accounting: next })
  }

  return (
    <div className="club-admin-page">
      <div className="accounting-management">
        <div className="page-header">
          <h2 className="page-title">{club.logo && <img src={club.logo} alt="" className="club-logo" />}Accounting Management - {club.name}</h2>
          <button className="btn-primary">+ Add Transaction</button>
        </div>

        <div className="accounting-table">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Type</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounting.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>
                    No transactions found
                  </td>
                </tr>
              ) : (
                accounting.map((item, index) => (
                  <tr key={item.id || index}>
                    <td>{item.date}</td>
                    <td>{item.description}</td>
                    <td>{item.amount} {club.settings?.currency || 'SAR'}</td>
                    <td>{item.type}</td>
                    <td>{item.status}</td>
                    <td>
                      <button className="btn-secondary">Edit</button>
                      <button className="btn-danger" onClick={() => handleDelete(item, index)}>{c.delete}</button>
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

export default ClubAccountingManagement
