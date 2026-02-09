import React, { useState, useEffect } from 'react'
import { loadClubs, getClubById, getClubMembersFromStorage, deleteBookingFromClub, updateBookingInClub } from '../../storage/adminStorage'
import { calculateBookingPrice } from '../../utils/bookingPricing'
import './club-pages-common.css'
import './BookingsManagement.css'

const ClubBookingsManagement = ({ club, language, onRefresh }) => {
  const [bookings, setBookings] = useState([])
  const [filter, setFilter] = useState('upcoming')
  const [actionLoading, setActionLoading] = useState(null)
  const [editBooking, setEditBooking] = useState(null)
  const [editForm, setEditForm] = useState({})

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

  const openEditModal = (b) => {
    const dur = b.durationMinutes || 60
    const [h, m] = (b.startTime || '00:00').split(':').map(Number)
    const endM = (h || 0) * 60 + (m || 0) + dur
    const endTime = `${String(Math.floor(endM / 60)).padStart(2, '0')}:${String(endM % 60).padStart(2, '0')}`
    const resourceVal = b.resource || b.courtName || b.court || ''
    const courts = club?.courts || []
    const matchedCourt = courts.find(c => (c.name || '') === resourceVal || (c.id || '') === (b.courtId || resourceVal))
    setEditBooking(b)
    setEditForm({
      dateStr: b.dateStr || '',
      startTime: b.startTime || '',
      endTime: b.endTime || endTime,
      courtId: matchedCourt?.id || (resourceVal ? '_other' : ''),
      resource: resourceVal,
      memberName: b.memberName || b.customerName || b.customer || '',
      memberId: (members.some(m => String(m.id) === (b.memberId || '')) ? b.memberId : '') || '',
      price: b.price != null ? b.price : '',
      status: b.status || 'confirmed',
      durationMinutes: dur
    })
  }

  const showError = (msg) => {
    if (typeof window !== 'undefined' && window.alert) window.alert(msg)
  }

  const handleSaveEdit = async () => {
    if (!editBooking?.id) return
    setActionLoading('edit')
    try {
      const dur = parseInt(editForm.durationMinutes, 10) || 60
      const [h, m] = (editForm.startTime || '00:00').split(':').map(Number)
      const endM = (h || 0) * 60 + (m || 0) + dur
      const endTime = `${String(Math.floor(endM / 60)).padStart(2, '0')}:${String(endM % 60).padStart(2, '0')}`
      const court = courts.find(c => c.id === editForm.courtId)
      const courtName = court?.name || editForm.resource || editForm.courtId || ''
      await updateBookingInClub(club.id, editBooking.id, {
        date: editForm.dateStr,
        startDate: editForm.dateStr,
        startTime: editForm.startTime,
        endTime,
        resource: courtName,
        court: courtName,
        courtName: courtName,
        courtId: (editForm.courtId && editForm.courtId !== '_other') ? editForm.courtId : undefined,
        memberName: editForm.memberName,
        customerName: editForm.memberName,
        customer: editForm.memberName,
        memberId: editForm.memberId || undefined,
        price: editForm.price !== '' ? parseFloat(editForm.price) : undefined,
        status: editForm.status,
        durationMinutes: dur
      })
      setEditBooking(null)
      refresh()
    } catch (e) {
      const msg = language === 'en'
        ? `Failed to save: ${e?.message || 'Server error. Try again.'}`
        : `فشل الحفظ: ${e?.message || 'خطأ في الخادم. حاول مرة أخرى.'}`
      showError(msg)
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancel = async (b) => {
    if (!window.confirm(language === 'en' ? 'Cancel this booking?' : 'إلغاء هذا الحجز؟')) return
    setActionLoading(b.id)
    try {
      await updateBookingInClub(club.id, b.id, { status: 'cancelled' })
      refresh()
    } catch (e) {
      const msg = language === 'en'
        ? `Failed to cancel: ${e?.message || 'Server error. Try again.'}`
        : `فشل الإلغاء: ${e?.message || 'خطأ في الخادم. حاول مرة أخرى.'}`
      showError(msg)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (bookingId) => {
    if (!window.confirm(language === 'en' ? 'Delete this booking? It will be removed from the list.' : 'حذف هذا الحجز؟ سيتم إزالته من القائمة.')) return
    setActionLoading(bookingId)
    try {
      await deleteBookingFromClub(club.id, bookingId)
      refresh()
    } catch (e) {
      const msg = language === 'en'
        ? `Failed to delete: ${e?.message || 'Server error. Try again.'}`
        : `فشل الحذف: ${e?.message || 'خطأ في الخادم. حاول مرة أخرى.'}`
      showError(msg)
    } finally {
      setActionLoading(null)
    }
  }

  const handlePermanentDelete = async (bookingId) => {
    if (!window.confirm(language === 'en'
      ? 'Permanently delete from database? This cannot be undone.'
      : 'الحذف النهائي من قاعدة البيانات؟ لا يمكن التراجع.')) return
    setActionLoading('perm-' + bookingId)
    try {
      await deleteBookingFromClub(club.id, bookingId)
      refresh()
    } catch (e) {
      const msg = language === 'en'
        ? `Failed to delete: ${e?.message || 'Server error. Try again.'}`
        : `فشل الحذف النهائي: ${e?.message || 'خطأ في الخادم. حاول مرة أخرى.'}`
      showError(msg)
    } finally {
      setActionLoading(null)
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
      edit: 'Edit',
      cancel: 'Cancel',
      delete: 'Delete',
      permanentDelete: 'Permanent Delete',
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

  const courts = club?.courts || []
  const members = getClubMembersFromStorage(club?.id) || []

  if (!club) return null

  return (
    <div className="club-admin-page">
      <header className="cxp-header">
        <div className="cxp-header-title-wrap">
          <h1 className="cxp-title">
            {club.logo && <img src={club.logo} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'contain' }} />}
            {c.bookings} — {language === 'ar' ? (club.nameAr || club.name) : club.name}
          </h1>
          <p className="cxp-subtitle">
            {language === 'en' ? 'View and manage court bookings' : 'عرض وإدارة حجوزات الملاعب'}
          </p>
        </div>
        <div className="cxp-header-actions">
          <button type="button" className="cxp-btn cxp-btn--secondary" onClick={refresh}>
            ↻ {c.refresh}
          </button>
        </div>
      </header>

      <div className="bookings-management">
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

        <div className="bookings-table cxp-card" style={{ overflow: 'hidden', padding: 0 }}>
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
                  const isLoading = actionLoading === b.id || actionLoading === 'perm-' + b.id
                  return (
                    <tr key={b.id || i} className={isCancelled ? 'booking-row-cancelled' : ''}>
                      <td>{formatDate(b.dateStr)}</td>
                      <td>{(b.startTime || '') + (b.endTime ? ` – ${b.endTime}` : '')}</td>
                      <td>{b.resource || b.courtName || b.court || '—'}</td>
                      <td>{b.memberName || b.customerName || b.customer || '—'}</td>
                      <td>{priceInfo.price} {priceInfo.currency}</td>
                      <td>
                        <span className={`booking-status booking-status-${(b.status || 'confirmed').toLowerCase()}`}>
                          {(b.status || 'confirmed') === 'cancelled' ? c.cancelled : (b.status || c.confirmed)}
                        </span>
                      </td>
                      <td>
                        <div className="bookings-actions">
                          <button
                            type="button"
                            className="btn-secondary btn-icon"
                            onClick={() => openEditModal(b)}
                            disabled={isLoading}
                            title={c.edit}
                          >
                            ✏️
                          </button>
                          {!isCancelled && (b.dateStr || '') >= today && (
                            <button
                              type="button"
                              className="btn-warning btn-icon"
                              onClick={() => handleCancel(b)}
                              disabled={isLoading}
                              title={c.cancel}
                            >
                              ⛔
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn-danger btn-icon"
                            onClick={() => handleDelete(b.id)}
                            disabled={isLoading}
                            title={c.delete}
                          >
                            🗑️
                          </button>
                          <button
                            type="button"
                            className="btn-danger-outline btn-icon"
                            onClick={() => handlePermanentDelete(b.id)}
                            disabled={isLoading}
                            title={c.permanentDelete}
                          >
                            ⚠️
                          </button>
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
            <div className="bookings-edit-form">
              <div className="form-row">
                <label>{c.date}</label>
                <input
                  type="date"
                  value={editForm.dateStr}
                  onChange={e => setEditForm(f => ({ ...f, dateStr: e.target.value }))}
                />
              </div>
              <div className="form-row">
                <label>{c.time}</label>
                <input
                  type="time"
                  value={editForm.startTime}
                  onChange={e => setEditForm(f => ({ ...f, startTime: e.target.value }))}
                />
              </div>
              <div className="form-row">
                <label>{c.duration}</label>
                <input
                  type="number"
                  min="30"
                  step="30"
                  value={editForm.durationMinutes}
                  onChange={e => setEditForm(f => ({ ...f, durationMinutes: e.target.value }))}
                />
              </div>
              <div className="form-row">
                <label>{c.court}</label>
                {courts.length > 0 ? (
                  <select
                    value={editForm.courtId || '_other'}
                    onChange={e => {
                      const val = e.target.value
                      if (val === '_other') {
                        setEditForm(f => ({ ...f, courtId: '', resource: f.resource }))
                      } else {
                        const court = courts.find(c => c.id === val)
                        setEditForm(f => ({ ...f, courtId: val, resource: court?.name || val }))
                      }
                    }}
                  >
                    {courts.map(court => (
                      <option key={court.id} value={court.id}>{court.name || court.id}</option>
                    ))}
                    <option value="_other">— {language === 'en' ? 'Other' : 'آخر'} —</option>
                  </select>
                ) : null}
                {(courts.length === 0 || editForm.courtId === '' || editForm.courtId === '_other') && (
                  <input
                    type="text"
                    value={editForm.resource}
                    onChange={e => setEditForm(f => ({ ...f, resource: e.target.value }))}
                    placeholder={c.court}
                  />
                )}
              </div>
              <div className="form-row">
                <label>{c.customer}</label>
                {members.length > 0 ? (
                  <select
                    value={members.some(m => String(m.id) === editForm.memberId) ? editForm.memberId : '_other'}
                    onChange={e => {
                      const val = e.target.value
                      if (val === '_other') {
                        setEditForm(f => ({ ...f, memberId: '', memberName: f.memberName || '' }))
                      } else {
                        const m = members.find(x => String(x.id) === val)
                        setEditForm(f => ({ ...f, memberId: val, memberName: m?.name || m?.email || val }))
                      }
                    }}
                  >
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.name || m.email || m.id}</option>
                    ))}
                    <option value="_other">— {language === 'en' ? 'Other' : 'آخر'} —</option>
                  </select>
                ) : null}
                <input
                  type="text"
                  value={editForm.memberName}
                  onChange={e => setEditForm(f => ({ ...f, memberName: e.target.value }))}
                  placeholder={c.customer}
                />
              </div>
              <div className="form-row">
                <label>{c.price}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.price}
                  onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))}
                />
                <span>{club?.settings?.currency || 'SAR'}</span>
              </div>
              <div className="form-row">
                <label>{c.status}</label>
                <select
                  value={editForm.status}
                  onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                >
                  <option value="confirmed">{c.confirmed}</option>
                  <option value="cancelled">{c.cancelled}</option>
                </select>
              </div>
            </div>
            <div className="bookings-edit-actions">
              <button type="button" className="btn-secondary" onClick={() => setEditBooking(null)}>
                {c.close}
              </button>
              <button type="button" className="btn-primary" onClick={handleSaveEdit} disabled={actionLoading === 'edit'}>
                {actionLoading === 'edit' ? '…' : c.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ClubBookingsManagement
