import React, { useState } from 'react'
import './BookingsManagement.css'

const BookingsManagement = ({ currentClub, clubs, onUpdateClub }) => {
  const [bookings, setBookings] = useState(currentClub?.bookings || [])

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
      <div className="bookings-management">
        <div className="page-header">
          <h2 className="page-title">{currentClub.logo && <img src={currentClub.logo} alt="" className="club-logo" />}Bookings Management - {currentClub.name}</h2>
          <button className="btn-primary">+ New Booking</button>
        </div>

        <div className="bookings-table">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Date</th>
                <th>Time</th>
                <th>Court</th>
                <th>Participants</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '20px' }}>
                    No bookings found
                  </td>
                </tr>
              ) : (
                bookings.map(booking => (
                  <tr key={booking.id}>
                    <td>{booking.id}</td>
                    <td>{booking.date}</td>
                    <td>{booking.startTime} - {booking.endTime}</td>
                    <td>{booking.resource || booking.court}</td>
                    <td>{booking.participants?.length || 0}</td>
                    <td>{booking.amount || 0} SAR</td>
                    <td>{booking.status || 'confirmed'}</td>
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

export default BookingsManagement
