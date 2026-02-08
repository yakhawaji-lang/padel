import React, { useState, useEffect } from 'react'
import { loadClubs, getClubById, deleteBookingFromClub } from '../../storage/adminStorage'
import { calculateBookingPrice } from '../../utils/bookingPricing'
import './BookingsManagement.css'

const ClubBookingsManagement = ({ club, language, onRefresh }) => {
  const [bookings, setBookings] = useState([])
  const [filter, setFilter] = useState('upcoming')
  const [deleting, setDeleting] = useState(null)

  const refresh = () => {
    loadClubs()
    const c = getClubById(club?.id)
    const list = (c?.bookings || []).filter(b => !b.isTournament)
    setBookings(list)
    if (onRefresh) onRefresh()
  }

  useEffect(() => {
    if (!club?.id) return
    refresh()
    const onSynced = () => refresh()
    window.addEventListener('clubs-synced', onSynced)
    return () => window.removeEventListener('clubs-synced', onSynced)
  }, [club?.id])

  const today = new Date().toISOString().split('T')[0]
  const withDate = bookings.map(b => ({
    ...b,
    dateStr: (b.date || b.startDate || '').toString().split('T')[0]
  }))
  const upcoming = withDate.filter(b => (b.dateStr || '') >= today)
  const past = withDate.filter(b => (b.dateStr || '') < today)
  const displayed = filter === 'upcoming' ? upcoming : past

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    try {
      return new Date(dateStr + 'T12:00:00').toLocaleDateString(language === 'en' ? 'en-US' : 'ar-SA', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return dateStr
    }
  }

  const handleDelete = async (bookingId) => {
    if (!window.confirm(language === 'en' ? 'Delete this booking?' : 'حذف هذا الحجز؟')) return
    setDeleting(bookingId)
    try {
      await deleteBookingFromClub(club.id, bookingId)
      refresh()
    } finally {
      setDeleting(null)
    }
  }

  const t = {
    en: {
      bookings: 'Court Bookings',
      upcoming: 'Upcoming',
      past: 'Past',
      date: 'Date',
      time: 'Time',
      court: 'Court',
      customer: 'Customer',
      price: 'Price',
      status: 'Status',
      actions: 'Actions',
      delete: 'Delete',
      noBookings: 'No bookings found',
      refresh: 'Refresh'
    },
    ar: {
      bookings: 'حجوزات الملاعب',
      upcoming: 'القادمة',
      past: 'السابقة',
      date: 'التاريخ',
      time: 'الوقت',
      court: 'الملعب',
      customer: 'العميل',
      price: 'السعر',
      status: 'الحالة',
      actions: 'إجراءات',
      delete: 'حذف',
      noBookings: 'لا توجد حجوزات',
      refresh: 'تحديث'
    }
  }
  const c = t[language] || t.en

  if (!club) return null

  return (
    <div className="admin-page">
      <div className="bookings-management">
        <div className="page-header">
          <h2 className="page-title">
            {club.logo && <img src={club.logo} alt="" className="club-logo" />}
            {c.bookings} – {language === 'ar' && club.nameAr ? club.nameAr : club.name}
          </h2>
          <button type="button" className="btn-primary" onClick={refresh}>
            {c.refresh}
          </button>
        </div>

        <div className="bookings-tabs">
          <button
            type="button"
            className={`bookings-tab ${filter === 'upcoming' ? 'active' : ''}`}
            onClick={() => setFilter('upcoming')}
          >
            {c.upcoming} ({upcoming.length})
          </button>
          <button
            type="button"
            className={`bookings-tab ${filter === 'past' ? 'active' : ''}`}
            onClick={() => setFilter('past')}
          >
            {c.past} ({past.length})
          </button>
        </div>

        <div className="bookings-table">
          <table>
            <thead>
              <tr>
                <th>{c.date}</th>
                <th>{c.time}</th>
                <th>{c.court}</th>
                <th>{c.customer}</th>
                <th>{c.price}</th>
                <th>{c.status}</th>
                <th>{c.actions}</th>
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '24px' }}>
                    {c.noBookings}
                  </td>
                </tr>
              ) : (
                displayed.map((b, i) => {
                  const dur = b.durationMinutes || 60
                  const priceInfo = b.price != null
                    ? { price: b.price, currency: b.currency || club?.settings?.currency || 'SAR' }
                    : calculateBookingPrice(club, b.dateStr, b.startTime, dur)
                  return (
                    <tr key={b.id || i}>
                      <td>{formatDate(b.dateStr)}</td>
                      <td>{(b.startTime || '') + (b.endTime ? ` – ${b.endTime}` : '')}</td>
                      <td>{b.resource || b.courtName || b.court || '—'}</td>
                      <td>{b.memberName || b.customerName || b.customer || '—'}</td>
                      <td>{priceInfo.price} {priceInfo.currency}</td>
                      <td>{b.status || 'confirmed'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-danger"
                          onClick={() => handleDelete(b.id)}
                          disabled={deleting === b.id}
                        >
                          {deleting === b.id ? '…' : c.delete}
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default ClubBookingsManagement
