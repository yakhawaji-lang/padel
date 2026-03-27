import React, { useState, useEffect, useMemo } from 'react'
import { loadClubs, getClubById } from '../../storage/adminStorage'
import * as bookingApi from '../../api/dbClient'
import './club-pages-common.css'
import './AccountingManagement.css'
import './BookingsManagement.css'
import { hasMemberSelfCancelFlag } from '../../utils/bookingMemberCancel'

const t = (en, ar, lang) => (lang === 'ar' ? ar : en)

function bookingAllowsElectronicFulfillment(b) {
  const m = (
    b?.initiatorPaymentMethod ||
    b?.paymentMethod ||
    (b?.data && typeof b.data === 'object' ? b.data.initiatorPaymentMethod || b.data.paymentMethod : '') ||
    ''
  )
    .toString()
    .toLowerCase()
    .trim()
  if (!m || m === 'at_club' || m === 'pay_at_club' || m === 'cash') return false
  return ['credit_card', 'mada', 'electronic', 'card', 'online', 'stripe', 'apple_pay', 'google_pay', 'tap', 'hyperpay'].includes(m)
}

function Modal({ title, onClose, children }) {
  return (
    <div className="cxp-modal-backdrop" onClick={onClose} role="presentation">
      <div className="cxp-modal" onClick={e => e.stopPropagation()} role="dialog">
        <div className="cxp-modal-header">
          <h3>{title}</h3>
          <button type="button" className="cxp-modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className="cxp-modal-body">{children}</div>
      </div>
    </div>
  )
}

const ClubAccountingManagement = ({ club, onUpdateClub, language, onRefresh }) => {
  const lang = language || 'en'
  const [accounting, setAccounting] = useState(club?.accounting || [])
  const [bookings, setBookings] = useState([])
  const [actionLoading, setActionLoading] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [formData, setFormData] = useState({ date: '', description: '', amount: '', type: 'revenue', status: 'completed' })

  useEffect(() => {
    setAccounting(club?.accounting || [])
  }, [club?.id, club?.accounting])

  const refreshBookingsFromCache = () => {
    if (!club?.id) return
    loadClubs()
    const c = getClubById(club.id)
    setBookings(Array.isArray(c?.bookings) ? c.bookings : [])
  }

  useEffect(() => {
    if (!club?.id) return
    refreshBookingsFromCache()
    const onSynced = () => refreshBookingsFromCache()
    window.addEventListener('clubs-synced', onSynced)
    return () => window.removeEventListener('clubs-synced', onSynced)
  }, [club?.id])

  const pendingMemberRefunds = useMemo(() => {
    const list = (bookings || []).filter((b) => {
      const st = (b.status || '').toString().toLowerCase()
      if (st !== 'cancelled_awaiting_refund_ack') return false
      const shares = Array.isArray(b.paymentShares) ? b.paymentShares : []
      if (shares.length > 0) return false
      return !!(hasMemberSelfCancelFlag(b) || b.memberRefundPreference)
    })
    return list.sort((a, b) => {
      const da = (a.date || a.startDate || '').toString().split('T')[0]
      const db = (b.date || b.startDate || '').toString().split('T')[0]
      return String(db).localeCompare(String(da))
    })
  }, [bookings])

  const formatBookingDate = (dateStr) => {
    if (!dateStr) return '—'
    const d = typeof dateStr === 'string' ? dateStr.split('T')[0] : ''
    if (!d) return '—'
    try {
      return new Date(d + 'T12:00:00').toLocaleDateString(lang === 'en' ? 'en-US' : 'ar-SA', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return d
    }
  }

  const handleFulfillMemberRefund = async (b, fulfillment) => {
    if (!club?.id || !b?.id) return
    const ful = String(fulfillment).toLowerCase()
    const msgEn = {
      cash: 'Confirm you handed the refund amount in cash to the customer? Invoice will be voided.',
      wallet: 'Confirm the refund amount was credited to the member wallet? Invoice will be voided.',
      electronic: 'Confirm electronic/card refund was initiated per your bank or gateway? Invoice will be voided.',
    }
    const msgAr = {
      cash: 'تأكيد تسليم المبلغ نقداً للعميل؟ ستُلغى فاتورة الحجز وتُعامل كاسترداد.',
      wallet: 'تأكيد إضافة المبلغ لمحفظة العضو؟ ستُلغى فاتورة الحجز وتُعامل كاسترداد.',
      electronic: 'تأكيد بدء الاسترداد الإلكتروني عبر البنك/البوابة؟ ستُلغى فاتورة الحجز وتُعامل كاسترداد.',
    }
    const msg = (lang === 'en' ? msgEn : msgAr)[ful] || (lang === 'en' ? 'Confirm?' : 'تأكيد؟')
    if (!window.confirm(msg)) return
    setActionLoading(`fulfill-refund-${b.id}`)
    try {
      await bookingApi.adminFulfillMemberRefund({ bookingId: b.id, clubId: club.id, fulfillment: ful })
      refreshBookingsFromCache()
      onRefresh?.()
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clubs-synced'))
    } catch (e) {
      window.alert(lang === 'en' ? (e?.message || 'Failed') : (e?.message || 'فشل'))
    } finally {
      setActionLoading(null)
    }
  }

  if (!club) {
    return (
      <div className="club-admin-page">
        <div className="cxp-empty">
          <span className="cxp-empty-icon">⏳</span>
          <h4>{t('Loading...', 'جاري التحميل...', lang)}</h4>
        </div>
      </div>
    )
  }

  const currency = club?.settings?.currency || 'SAR'

  const totalRevenue = accounting
    .filter(i => (i.type || 'revenue') === 'revenue')
    .reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
  const totalExpenses = accounting
    .filter(i => i.type === 'expense')
    .reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
  const net = totalRevenue - totalExpenses

  const formatAmount = (amount) => {
    const n = parseFloat(amount) || 0
    return new Intl.NumberFormat(lang === 'ar' ? 'ar-SA' : 'en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(n) + ' ' + currency
  }

  const handleAdd = (e) => {
    e.preventDefault()
    if (!formData.description?.trim() || formData.amount === '' || formData.amount == null) return
    const amt = parseFloat(formData.amount) || 0
    if (amt <= 0) return
    const item = {
      id: 'acc-' + Date.now(),
      date: formData.date || new Date().toISOString().split('T')[0],
      description: formData.description.trim(),
      amount: amt,
      type: formData.type || 'revenue',
      status: formData.status || 'completed'
    }
    const next = [...accounting, item]
    setAccounting(next)
    onUpdateClub({ accounting: next })
    setShowAdd(false)
    setFormData({ date: new Date().toISOString().split('T')[0], description: '', amount: '', type: 'revenue', status: 'completed' })
  }

  const handleDelete = (item, index) => {
    if (!window.confirm(t('Delete this transaction?', 'حذف هذه العملية؟', lang))) return
    const next = accounting.filter((_, i) => (item.id ? _.id !== item.id : i !== index))
    setAccounting(next)
    onUpdateClub({ accounting: next })
  }

  return (
    <div className="club-admin-page">
      <header className="cxp-header">
        <div className="cxp-header-title-wrap">
          <h1 className="cxp-title">
            {club.logo && <img src={club.logo} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'contain' }} />}
            {t('Accounting', 'المحاسبة', lang)} — {lang === 'ar' ? (club.nameAr || club.name) : club.name}
          </h1>
          <p className="cxp-subtitle">{t('Track revenue and expenses', 'تتبع الإيرادات والمصروفات', lang)}</p>
        </div>
      </header>

      <div className="cxp-stats">
        <div className="cxp-stat cxp-stat-revenue">
          <div className="cxp-stat-value">{formatAmount(totalRevenue)}</div>
          <div className="cxp-stat-label">{t('Revenue', 'الإيرادات', lang)}</div>
        </div>
        <div className="cxp-stat cxp-stat-expenses">
          <div className="cxp-stat-value">{formatAmount(totalExpenses)}</div>
          <div className="cxp-stat-label">{t('Expenses', 'المصروفات', lang)}</div>
        </div>
        <div className={`cxp-stat cxp-stat-net ${net < 0 ? 'negative' : ''}`}>
          <div className="cxp-stat-value">{formatAmount(net)}</div>
          <div className="cxp-stat-label">{t('Net', 'الصافي', lang)}</div>
        </div>
      </div>

      <div className="cxp-actions-row">
        <button type="button" className="cxp-btn cxp-btn--primary" onClick={() => setShowAdd(true)}>
          + {t('Add Transaction', 'إضافة عملية', lang)}
        </button>
      </div>

      {pendingMemberRefunds.length > 0 && (
        <section className="cxp-card cxp-refund-queue" aria-label={t('Member refund requests', 'طلبات استرداد الأعضاء', lang)}>
          <h2 className="cxp-refund-queue-title">
            {t('Member refund requests', 'طلبات استرداد الأعضاء', lang)}
          </h2>
          <p className="cxp-refund-queue-intro">
            {t(
              'Bookings cancelled by members pending your confirmation of how the refund was completed.',
              'حجوزات ألغاها الأعضاء وبانتظار تأكيدك لطريقة تنفيذ الاسترداد.',
              lang
            )}
          </p>
          <ul className="cxp-refund-queue-list">
            {pendingMemberRefunds.map((b) => {
              const dateRaw = (b.date || b.startDate || '').toString().split('T')[0]
              const timeLine = [b.startTime, b.endTime].filter(Boolean).join(' — ')
              const customer = b.memberName || b.customerName || b.customer || '—'
              const resource = b.resource || b.courtName || b.court || '—'
              const showElectronic = bookingAllowsElectronicFulfillment(b)
              return (
                <li key={b.id} className="cxp-refund-queue-item">
                  <div className="cxp-refund-queue-item-meta">
                    <strong className="cxp-refund-queue-customer">{customer}</strong>
                    <span className="cxp-refund-queue-date">
                      {formatBookingDate(dateRaw)}
                      {timeLine ? ` · ${timeLine}` : ''} · {resource}
                    </span>
                    <span className="cxp-refund-queue-id">
                      {t('Booking', 'حجز', lang)} #{b.id}
                    </span>
                  </div>
                  <div
                    className="booking-member-refund-fulfill cxp-refund-fulfill-inner"
                    style={{
                      marginTop: 10,
                      padding: 14,
                      background: '#fffbeb',
                      borderRadius: 8,
                      border: '1px solid #fcd34d',
                    }}
                  >
                    <h5 style={{ margin: '0 0 8px', fontSize: '1rem' }}>
                      {t('Member refund request', 'طلب استرداد من العضو', lang)}
                    </h5>
                    <p style={{ margin: '0 0 10px', fontSize: '0.9rem', color: '#92400e' }}>
                      {t('Preference', 'الخيار')}: <strong>{String(b.memberRefundPreference || '—')}</strong>
                      {' · '}
                      {t('Net', 'الصافي')}:{' '}
                      <strong>{b.memberRefundNet != null ? b.memberRefundNet : '—'} {currency}</strong>
                    </p>
                    <p style={{ margin: '0 0 12px', fontSize: '0.85rem', color: '#78350f' }}>
                      {showElectronic
                        ? t(
                            'Choose how you completed the refund. For card payments, use Electronic after your bank reversal.',
                            'اختر كيف نفّذت الاسترداد. للدفع بالبطاقة استخدم «إلكتروني» بعد عكس العملية لدى البنك.',
                            lang
                          )
                        : t(
                            'Choose cash or wallet. This booking was paid at the club — no card reversal.',
                            'اختر النقد أو المحفظة. الدفع كان في النادي — لا يوجد عكس للبطاقة.',
                            lang
                          )}
                    </p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="booking-payment-mark-paid-btn"
                        disabled={actionLoading === `fulfill-refund-${b.id}`}
                        onClick={() => handleFulfillMemberRefund(b, 'cash')}
                      >
                        {actionLoading === `fulfill-refund-${b.id}`
                          ? '…'
                          : t('Paid cash to customer', 'دفع نقداً للعميل', lang)}
                      </button>
                      <button
                        type="button"
                        className="booking-payment-mark-paid-btn"
                        disabled={actionLoading === `fulfill-refund-${b.id}`}
                        onClick={() => handleFulfillMemberRefund(b, 'wallet')}
                      >
                        {t('Credited wallet', 'إضافة للمحفظة', lang)}
                      </button>
                      {showElectronic ? (
                        <button
                          type="button"
                          className="booking-refund-btn booking-refund-btn--warn"
                          disabled={actionLoading === `fulfill-refund-${b.id}`}
                          onClick={() => handleFulfillMemberRefund(b, 'electronic')}
                        >
                          {t('Electronic / bank refund', 'استرداد إلكتروني / بنك', lang)}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <div className="cxp-card" style={{ overflow: 'hidden', padding: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="accounting-table-content">
            <thead>
              <tr>
                <th>{t('Date', 'التاريخ', lang)}</th>
                <th>{t('Description', 'الوصف', lang)}</th>
                <th>{t('Amount', 'المبلغ', lang)}</th>
                <th>{t('Type', 'النوع', lang)}</th>
                <th>{t('Status', 'الحالة', lang)}</th>
                <th>{t('Actions', 'إجراءات', lang)}</th>
              </tr>
            </thead>
            <tbody>
              {accounting.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '32px' }}>
                    <span className="cxp-empty-icon" style={{ display: 'block', marginBottom: 8 }}>💰</span>
                    {t('No transactions yet', 'لا توجد عمليات بعد', lang)}
                  </td>
                </tr>
              ) : (
                accounting.map((item, index) => (
                  <tr key={item.id || index}>
                    <td>{item.date}</td>
                    <td>{item.description}</td>
                    <td className={item.type === 'expense' ? 'negative' : 'positive'}>
                      {item.type === 'expense' ? '-' : ''}{formatAmount(item.amount)}
                    </td>
                    <td>{item.type === 'revenue' ? t('Revenue', 'إيراد', lang) : t('Expense', 'مصروف', lang)}</td>
                    <td>{item.status || '—'}</td>
                    <td>
                      <button type="button" className="cxp-btn-icon cxp-btn-icon--danger" onClick={() => handleDelete(item, index)} title={t('Delete', 'حذف', lang)}>×</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <Modal title={t('Add Transaction', 'إضافة عملية', lang)} onClose={() => setShowAdd(false)}>
          <form onSubmit={handleAdd}>
            <div className="cxp-form-group">
              <label>{t('Date', 'التاريخ', lang)}</label>
              <input
                type="date"
                value={formData.date || new Date().toISOString().split('T')[0]}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div className="cxp-form-group">
              <label>{t('Description', 'الوصف', lang)} *</label>
              <input
                type="text"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('e.g. Court booking payment', 'مثال: دفعة حجز ملعب', lang)}
                required
              />
            </div>
            <div className="cxp-form-group">
              <label>{t('Amount', 'المبلغ', lang)} *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0"
                required
              />
            </div>
            <div className="cxp-form-group">
              <label>{t('Type', 'النوع', lang)}</label>
              <select
                value={formData.type}
                onChange={e => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="revenue">{t('Revenue', 'إيراد', lang)}</option>
                <option value="expense">{t('Expense', 'مصروف', lang)}</option>
              </select>
            </div>
            <div className="cxp-form-group">
              <label>{t('Status', 'الحالة', lang)}</label>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="completed">{t('Completed', 'مكتمل', lang)}</option>
                <option value="pending">{t('Pending', 'قيد الانتظار', lang)}</option>
              </select>
            </div>
            <div className="cxp-form-actions">
              <button type="button" className="cxp-btn cxp-btn--secondary" onClick={() => setShowAdd(false)}>{t('Cancel', 'إلغاء', lang)}</button>
              <button type="submit" className="cxp-btn cxp-btn--primary">{t('Add', 'إضافة', lang)}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default ClubAccountingManagement
