import React, { useState, useEffect } from 'react'
import { loadClubs, getClubById, getClubMembersFromStorage, deleteBookingFromClub, updateBookingInClub } from '../../storage/adminStorage'
import { calculateBookingPrice } from '../../utils/bookingPricing'
import './BookingsManagement.css'

const ClubBookingsManagement = ({ club, language, onRefresh }) => {
  const [bookings, setBookings] = useState([])
  const [filter, setFilter] = useState('upcoming')
  const [actionId, setActionId] = useState(null)
  const [editBooking, setEditBooking] = useState(null)
  const [actionMenuOpen, setActionMenuOpen] = useState(null)

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

  const courts = club?.courts || []
  const members = getClubMembersFromStorage(club?.id) || []

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

  const runAction = async (fn) => {
    setActionId('run')
    try {
      await fn()
      refresh()
      setActionMenuOpen(null)
      setEditBooking(null)
    } finally {
      setActionId(null)
    }
  }

  const handleEdit = (b) => {
    const dur = b.durationMinutes || 60
    const [h, m] = (b.startTime || '00:00').split(':').map(Number)
    const endM = (h || 0) * 60 + (m || 0) + dur
    const endTime = `${String(Math.floor(endM / 60)).padStart(2, '0')}:${String(endM % 60).padStart(2, '0')}`
    setEditBooking({
      ...b,
      endTime: b.endTime || endTime
    })
    setActionMenuOpen(null)
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!editBooking) return
    const form = e.target
    const dateStr = form.date?.value || editBooking.dateStr
    const startTime = form.startTime?.value || editBooking.startTime
    const dur = parseInt(form.duration?.value, 10) || 60
    const [h, m] = (startTime || '00:00').split(':').map(Number)
    const endM = (h || 0) * 60 + (m || 0) + dur
    const endTime = `${String(Math.floor(endM / 60)).padStart(2, '0')}:${String(endM % 60).padStart(2, '0')}`
    const courtVal = form.court?.value
    const courtName = courts.find(c => c.id === courtVal)?.name || courtVal || editBooking.resource || editBooking.courtName
    const customerName = form.customer?.value?.trim() || editBooking.memberName || editBooking.customerName
    const priceVal = parseFloat(form.price?.value)
    const price = isNaN(priceVal) ? (editBooking.price ?? calculateBookingPrice(club, dateStr, startTime, dur).price) : priceVal
    const currency = club?.settings?.currency || 'SAR'
    const status = form.status?.value || editBooking.status || 'confirmed'

    await runAction(() =>
      updateBookingInClub(club.id, editBooking.id, {
        date: dateStr,
        startDate: dateStr,
        startTime,
        endTime,
        durationMinutes: dur,
        resource: courtName,
        court: courtName,
        courtName,
        memberName: customerName,
        customerName,
        customer: customerName,
        price,
        currency,
        status
      })
    )
  }

  const handleCancel = async (b) => {
    const msg = language === 'en' ? 'Cancel this booking? Status will be set to cancelled.' : 'إلغاء هذا الحجز؟ ستُحدّث الحالة إلى ملغي.'
    if (!window.confirm(msg)) return
    await runAction(() => updateBookingInClub(club.id, b.id, { status: 'cancelled' }))
  }

  const handleDelete = async (bookingId) => {
    const msg = language === 'en' ? 'Delete this booking? It will be removed from the list.' : 'حذف هذا الحجز؟ سيُزال من القائمة.'
    if (!window.confirm(msg)) return
    await runAction(() => deleteBookingFromClub(club.id, bookingId))
  }

  const handlePermanentDelete = async (bookingId) => {
    const msg = language === 'en'
      ? 'Permanently delete from database? This cannot be undone.'
      : 'حذف نهائياً من قاعدة البيانات؟ لا يمكن التراجع عن هذا الإجراء.'
    if (!window.confirm(msg)) return
    await runAction(() => deleteBookingFromClub(club.id, bookingId))
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
      edit: 'Edit',
      cancel: 'Cancel',
      delete: 'Delete',
      permanentDelete: 'Permanent delete',
      noBookings: 'No bookings found',
      refresh: 'Refresh',
      editBooking: 'Edit booking',
      save: 'Save',
      close: 'Close',
      duration: 'Duration (min)',
      cancelled: 'cancelled',
      confirmed: 'confirmed'
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
      edit: 'تعديل',
      cancel: 'إلغاء',
      delete: 'حذف',
      permanentDelete: 'حذف نهائي',
      noBookings: 'لا توجد حجوزات',
      refresh: 'تحديث',
      editBooking: 'تعديل الحجز',
      save: 'حفظ',
      close: 'إغلاق',
      duration: 'المدة (دقيقة)',
      cancelled: 'ملغي',
      confirmed: 'مؤكد'
    }
  }
  const c = t[language] || t.en

  const getStatusClass = (status) => {
    const s = (status || '').toLowerCase()
    if (s === 'cancelled') return 'booking-status-cancelled'
    if (s === 'confirmed') return 'booking-status-confirmed'
    return ''
  }

  if (!club) return null

  return (
    <div className="admin-page">
      <div className="bookings-management">
        <div className="page-header">
          <h2 className="page-title">
            {club.logo && <img src={club.logo} alt="" className="club-logo" />}
            {c.bookings} – {language === 'ar' && club.nameAr ? club.nameAr : club.name}
          </h2>
          <button type="button" className="btn-primary" onClick={refresh} disabled={!!actionId}>
            {actionId ? '…' : c.refresh}
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
                  const isCancelled = (b.status || '').toLowerCase() === 'cancelled'
                  const isUpcoming = (b.dateStr || '') >= today
                  const menuOpen = actionMenuOpen === b.id
                  return (
                    <tr key={b.id || i} className={isCancelled ? 'booking-row-cancelled' : ''}>
                      <td>{formatDate(b.dateStr)}</td>
                      <td>{(b.startTime || '') + (b.endTime ? ` – ${b.endTime}` : '')}</td>
                      <td>{b.resource || b.courtName || b.court || '—'}</td>
                      <td>{b.memberName || b.customerName || b.customer || '—'}</td>
                      <td>{priceInfo.price} {priceInfo.currency}</td>
                      <td>
                        <span className={`booking-status ${getStatusClass(b.status)}`}>
                          {b.status || c.confirmed}
                        </span>
                      </td>
                      <td>
                        <div className="bookings-actions-cell">
                          <button
                            type="button"
                            className="btn-actions-toggle"
                            onClick={() => setActionMenuOpen(menuOpen ? null : b.id)}
                            disabled={!!actionId}
                            aria-haspopup="true"
                            aria-expanded={menuOpen}
                          >
                            ⋮
                          </button>
                          {menuOpen && (
                            <>
                              <div className="bookings-actions-backdrop" onClick={() => setActionMenuOpen(null)} />
                              <div className="bookings-actions-menu">
                                <button
                                  type="button"
                                  className="bookings-action-item"
                                  onClick={() => handleEdit(b)}
                                >
                                  ✏️ {c.edit}
                                </button>
                                {isUpcoming && !isCancelled && (
                                  <button
                                    type="button"
                                    className="bookings-action-item bookings-action-cancel"
                                    onClick={() => handleCancel(b)}
                                  >
                                    🚫 {c.cancel}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="bookings-action-item bookings-action-delete"
                                  onClick={() => handleDelete(b.id)}
                                >
                                  🗑️ {c.delete}
                                </button>
                                <button
                                  type="button"
                                  className="bookings-action-item bookings-action-permanent"
                                  onClick={() => handlePermanentDelete(b.id)}
                                >
                                  ⛔ {c.permanentDelete}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editBooking && (
        <div className="bookings-edit-overlay" onClick={() => setEditBooking(null)}>
          <div className="bookings-edit-modal" onClick={e => e.stopPropagation()}>
            <h3>{c.editBooking}</h3>
            <form onSubmit={handleSaveEdit}>
              <div className="form-row">
                <div className="form-group">
                  <label>{c.date}</label>
                  <input
                    type="date"
                    name="date"
                    defaultValue={editBooking.dateStr}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>{c.time}</label>
                  <input
                    type="time"
                    name="startTime"
                    defaultValue={editBooking.startTime}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>{c.duration}</label>
                  <input
                    type="number"
                    name="duration"
                    min="30"
                    step="30"
                    defaultValue={editBooking.durationMinutes || 60}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{c.court}</label>
                  <select
                    name="court"
                    defaultValue={
                      courts.find(crt => (crt.name || crt.id || '') === (editBooking.resource || editBooking.courtName || editBooking.court || ''))?.id ||
                      (editBooking.resource || editBooking.courtName || editBooking.court || '')
                    }
                  >
                    <option value="">—</option>
                    {courts.map(crt => (
                      <option key={crt.id} value={crt.id}>{crt.name || crt.id}</option>
                    ))}
                    {((editBooking.resource || editBooking.courtName || editBooking.court) &&
                      !courts.some(crt => (crt.name || crt.id) === (editBooking.resource || editBooking.courtName || editBooking.court))) && (
                      <option value={editBooking.resource || editBooking.courtName || editBooking.court}>
                        {editBooking.resource || editBooking.courtName || editBooking.court}
                      </option>
                    )}
                  </select>
                </div>
                <div className="form-group">
                  <label>{c.customer}</label>
                  <input
                    type="text"
                    name="customer"
                    defaultValue={editBooking.memberName || editBooking.customerName || editBooking.customer || ''}
                    placeholder={language === 'en' ? 'Customer name' : 'اسم العميل'}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{c.price}</label>
                  <input
                    type="number"
                    name="price"
                    min="0"
                    step="0.01"
                    defaultValue={editBooking.price ?? ''}
                    placeholder={language === 'en' ? 'Auto' : 'تلقائي'}
                  />
                </div>
                <div className="form-group">
                  <label>{c.status}</label>
                  <select name="status" defaultValue={editBooking.status || 'confirmed'}>
                    <option value="confirmed">{c.confirmed}</option>
                    <option value="cancelled">{c.cancelled}</option>
                  </select>
                </div>
              </div>
              <div className="bookings-edit-actions">
                <button type="button" className="btn-secondary" onClick={() => setEditBooking(null)}>
                  {c.close}
                </button>
                <button type="submit" className="btn-primary" disabled={!!actionId}>
                  {actionId ? '…' : c.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default ClubBookingsManagement
