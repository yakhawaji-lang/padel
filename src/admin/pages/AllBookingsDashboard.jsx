import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { loadClubs, deleteBookingFromClub } from '../../storage/adminStorage'
import { calculateBookingPrice } from '../../utils/bookingPricing'
import './AllBookingsDashboard.css'
import './BookingsManagement.css'

const AllBookingsDashboard = ({ language }) => {
  const [clubs, setClubs] = useState([])
  const [filter, setFilter] = useState('upcoming')
  const [clubFilter, setClubFilter] = useState('all')
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    const load = () => setClubs(loadClubs() || [])
    load()
    window.addEventListener('clubs-synced', load)
    return () => window.removeEventListener('clubs-synced', load)
  }, [])

  const allBookings = clubs.flatMap(club => {
    const list = (club?.bookings || []).filter(b => !b.isTournament)
    return list.map(b => ({
      ...b,
      dateStr: (b.date || b.startDate || '').toString().split('T')[0],
      club,
      clubName: club.name,
      clubNameAr: club.nameAr
    }))
  }).filter(r => clubFilter === 'all' || r.club.id === clubFilter)
    .sort((a, b) => {
      const d1 = a.dateStr || ''
      const d2 = b.dateStr || ''
      if (d1 !== d2) return d1.localeCompare(d2)
      return (a.startTime || '').localeCompare(b.startTime || '')
    })

  const today = new Date().toISOString().split('T')[0]
  const upcoming = allBookings.filter(r => (r.dateStr || '') >= today)
  const past = allBookings.filter(r => (r.dateStr || '') < today)
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

  const handleDelete = async (clubId, bookingId) => {
    if (!window.confirm(language === 'en' ? 'Delete this booking?' : 'حذف هذا الحجز؟')) return
    setDeleting(bookingId)
    try {
      await deleteBookingFromClub(clubId, bookingId)
      setClubs(loadClubs() || [])
    } finally {
      setDeleting(null)
    }
  }

  const approvedClubs = clubs.filter(c => c.status !== 'pending')

  const t = {
    en: {
      title: 'All Court Bookings',
      upcoming: 'Upcoming',
      past: 'Past',
      allClubs: 'All clubs',
      date: 'Date',
      time: 'Time',
      court: 'Court',
      customer: 'Customer',
      club: 'Club',
      price: 'Price',
      status: 'Status',
      actions: 'Actions',
      delete: 'Delete',
      noBookings: 'No bookings found',
      refresh: 'Refresh',
      viewClub: 'View'
    },
    ar: {
      title: 'جميع حجوزات الملاعب',
      upcoming: 'القادمة',
      past: 'السابقة',
      allClubs: 'جميع الأندية',
      date: 'التاريخ',
      time: 'الوقت',
      court: 'الملعب',
      customer: 'العميل',
      club: 'النادي',
      price: 'السعر',
      status: 'الحالة',
      actions: 'إجراءات',
      delete: 'حذف',
      noBookings: 'لا توجد حجوزات',
      refresh: 'تحديث',
      viewClub: 'عرض'
    }
  }
  const c = t[language] || t.en

  return (
    <div className="admin-page all-bookings-dashboard">
      <div className="page-header">
        <h2 className="page-title">{c.title}</h2>
        <button type="button" className="btn-primary" onClick={() => setClubs(loadClubs() || [])}>
          {c.refresh}
        </button>
      </div>

      <div className="all-bookings-filters">
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
        <select
          value={clubFilter}
          onChange={e => setClubFilter(e.target.value)}
          className="all-bookings-club-select"
        >
          <option value="all">{c.allClubs}</option>
          {approvedClubs.map(club => (
            <option key={club.id} value={club.id}>
              {language === 'ar' && club.nameAr ? club.nameAr : club.name}
            </option>
          ))}
        </select>
      </div>

      <div className="bookings-table">
        <table>
          <thead>
            <tr>
              <th>{c.date}</th>
              <th>{c.time}</th>
              <th>{c.court}</th>
              <th>{c.club}</th>
              <th>{c.customer}</th>
              <th>{c.price}</th>
              <th>{c.status}</th>
              <th>{c.actions}</th>
            </tr>
          </thead>
          <tbody>
            {displayed.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '24px' }}>
                  {c.noBookings}
                </td>
              </tr>
            ) : (
              displayed.map((b, i) => {
                const club = b.club
                const dur = b.durationMinutes || 60
                const priceInfo = b.price != null
                  ? { price: b.price, currency: b.currency || club?.settings?.currency || 'SAR' }
                  : calculateBookingPrice(club, b.dateStr, b.startTime, dur)
                return (
                  <tr key={`${club.id}-${b.id}-${i}`}>
                    <td>{formatDate(b.dateStr)}</td>
                    <td>{(b.startTime || '') + (b.endTime ? ` – ${b.endTime}` : '')}</td>
                    <td>{b.resource || b.courtName || b.court || '—'}</td>
                    <td>
                      <Link to={`/admin/club/${club.id}/bookings`} className="all-bookings-club-link">
                        {language === 'ar' && club.clubNameAr ? club.clubNameAr : club.clubName}
                      </Link>
                    </td>
                    <td>{b.memberName || b.customerName || b.customer || '—'}</td>
                    <td>{priceInfo.price} {priceInfo.currency}</td>
                    <td>{b.status || 'confirmed'}</td>
                    <td>
                      <Link to={`/admin/club/${club.id}/bookings`} className="btn-secondary" style={{ marginRight: 6 }}>{c.viewClub}</Link>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => handleDelete(club.id, b.id)}
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
  )
}

export default AllBookingsDashboard
