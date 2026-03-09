import React, { useState } from 'react'
import './AccountingManagement.css'

const AccountingManagement = ({ currentClub, clubs, onUpdateClub }) => {
  const [accounting, setAccounting] = useState(currentClub?.accounting || [])

  if (!currentClub) {
    return (
      <div className="admin-page">
        <div className="no-club-selected">
          <p>Please select a club first</p>
        </div>
      </div>
    )
  }

  const totalRevenue = accounting.reduce((sum, item) => sum + (item.amount || 0), 0)
  const totalExpenses = accounting.filter(item => item.type === 'expense')
    .reduce((sum, item) => sum + (item.amount || 0), 0)
  const netProfit = totalRevenue - totalExpenses

  return (
    <div className="admin-page">
      <div className="accounting-management">
        <div className="page-header">
          <h2 className="page-title">{currentClub.logo && <img src={currentClub.logo} alt="" className="club-logo" />}Accounting - {currentClub.name}</h2>
          <button className="btn-primary">+ Add Transaction</button>
        </div>

        <div className="accounting-summary">
          <div className="summary-card">
            <h3>Total Revenue</h3>
            <p className="amount positive">{totalRevenue.toFixed(2)} SAR</p>
          </div>
          <div className="summary-card">
            <h3>Total Expenses</h3>
            <p className="amount negative">{totalExpenses.toFixed(2)} SAR</p>
          </div>
          <div className="summary-card">
            <h3>Net Profit</h3>
            <p className="amount">{netProfit.toFixed(2)} SAR</p>
          </div>
        </div>

        <div className="accounting-table">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounting.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                    No transactions found
                  </td>
                </tr>
              ) : (
                accounting.map(item => (
                  <tr key={item.id}>
                    <td>{item.date}</td>
                    <td>{item.type}</td>
                    <td>{item.description}</td>
                    <td className={item.type === 'revenue' ? 'positive' : 'negative'}>
                      {item.amount} SAR
                    </td>
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

export default AccountingManagement
