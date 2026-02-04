import React, { useState, useEffect } from 'react'
import './club-pages-common.css'
import './AccountingManagement.css'

const t = (en, ar, lang) => (lang === 'ar' ? ar : en)

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

const ClubAccountingManagement = ({ club, onUpdateClub, language }) => {
  const lang = language || 'en'
  const [accounting, setAccounting] = useState(club?.accounting || [])
  const [showAdd, setShowAdd] = useState(false)
  const [formData, setFormData] = useState({ date: '', description: '', amount: '', type: 'revenue', status: 'completed' })

  useEffect(() => {
    setAccounting(club?.accounting || [])
  }, [club?.id, club?.accounting])

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
        <h1 className="cxp-title">
          {club.logo && <img src={club.logo} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'contain' }} />}
          {t('Accounting', 'المحاسبة', lang)} — {lang === 'ar' ? (club.nameAr || club.name) : club.name}
        </h1>
        <p className="cxp-subtitle">{t('Track revenue and expenses', 'تتبع الإيرادات والمصروفات', lang)}</p>
      </header>

      <div className="cxp-stats">
        <div className="cxp-stat" style={{ borderLeft: '4px solid #22c55e' }}>
          <div className="cxp-stat-value" style={{ color: '#16a34a' }}>{formatAmount(totalRevenue)}</div>
          <div className="cxp-stat-label">{t('Revenue', 'الإيرادات', lang)}</div>
        </div>
        <div className="cxp-stat" style={{ borderLeft: '4px solid #ef4444' }}>
          <div className="cxp-stat-value" style={{ color: '#dc2626' }}>{formatAmount(totalExpenses)}</div>
          <div className="cxp-stat-label">{t('Expenses', 'المصروفات', lang)}</div>
        </div>
        <div className="cxp-stat" style={{ borderLeft: '4px solid #1e3a5f' }}>
          <div className="cxp-stat-value" style={{ color: net >= 0 ? '#16a34a' : '#dc2626' }}>{formatAmount(net)}</div>
          <div className="cxp-stat-label">{t('Net', 'الصافي', lang)}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button type="button" className="cxp-btn cxp-btn--primary" onClick={() => setShowAdd(true)}>
          + {t('Add Transaction', 'إضافة عملية', lang)}
        </button>
      </div>

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
