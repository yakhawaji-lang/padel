import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './AllClubsManagement.css'
import './common.css'
import { useAdminPanel } from '../AdminPanelContext'
import { syncMembersToClubsManually, getClubMembersFromStorage } from '../../storage/adminStorage'

const t = (en, ar, lang) => (lang === 'ar' ? ar : en)

function Modal({ title, onClose, children }) {
  return (
    <div className="acm-modal-backdrop" onClick={onClose} role="presentation">
      <div className="acm-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="acm-modal-title">
        <div className="acm-modal-header">
          <h3 id="acm-modal-title">{title}</h3>
          <button type="button" className="acm-modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className="acm-modal-body">{children}</div>
      </div>
    </div>
  )
}

const emptyForm = {
  name: '',
  nameAr: '',
  address: '',
  addressAr: '',
  phone: '',
  email: '',
  website: '',
  playtomicVenueId: '',
  playtomicApiKey: ''
}

export default function AllClubsManagement() {
  const { clubs = [], language = 'en', onCreateClub, onUpdateClub, onDeleteClub } = useAdminPanel()
  const navigate = useNavigate()
  const [showModal, setShowModal] = useState(false)
  const [editingClub, setEditingClub] = useState(null)
  const [formData, setFormData] = useState(emptyForm)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)

  const safeClubs = Array.isArray(clubs) ? clubs.filter(c => c && c.id) : []

  const openCreate = () => {
    setEditingClub(null)
    setFormData(emptyForm)
    setShowModal(true)
  }

  const openEdit = (club) => {
    setEditingClub(club)
    setFormData({
      name: club.name || '',
      nameAr: club.nameAr || '',
      address: club.address || '',
      addressAr: club.addressAr || '',
      phone: club.phone || '',
      email: club.email || '',
      website: club.website || '',
      playtomicVenueId: club.playtomicVenueId || '',
      playtomicApiKey: club.playtomicApiKey || ''
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingClub(null)
    setFormData(emptyForm)
  }

  const handleCreate = async () => {
    if (!formData.name.trim()) return
    try {
      await onCreateClub({
        ...formData,
        courts: [
          { id: 'court-1', name: 'Court 1', nameAr: 'الملعب 1', type: 'indoor' },
          { id: 'court-2', name: 'Court 2', nameAr: 'الملعب 2', type: 'indoor' },
          { id: 'court-3', name: 'Court 3', nameAr: 'الملعب 3', type: 'indoor' },
          { id: 'court-4', name: 'Court 4', nameAr: 'الملعب 4', type: 'indoor' }
        ],
        settings: {
          defaultLanguage: 'en',
          timezone: 'Asia/Riyadh',
          currency: 'SAR',
          bookingDuration: 60,
          maxBookingAdvance: 30,
          cancellationPolicy: 24
        }
      })
      closeModal()
    } catch (e) {
      console.error('Create club failed:', e)
    }
  }

  const handleUpdate = async () => {
    if (!editingClub || !formData.name.trim()) return
    try {
      await onUpdateClub(editingClub.id, formData)
      closeModal()
    } catch (e) {
      console.error('Update club failed:', e)
    }
  }

  const handleDelete = (clubId) => {
    if (!window.confirm(t('Delete this club? This cannot be undone.', 'حذف هذا النادي؟ لا يمكن التراجع.', language))) return
    onDeleteClub(clubId)
  }

  const handleSyncMembers = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const updatedClubs = syncMembersToClubsManually()
      const total = updatedClubs.reduce((sum, c) => sum + (getClubMembersFromStorage(c.id)?.length || 0), 0)
      setSyncResult({ count: total })
      window.dispatchEvent(new CustomEvent('clubs-synced'))
    } catch (e) {
      setSyncResult({ error: true })
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncResult(null), 4000)
    }
  }

  return (
    <div className="main-admin-page">
      <div className="acm-page">
        <header className="acm-header">
          <div className="acm-header-content">
            <h1 className="acm-title">{t('Manage All Clubs', 'إدارة جميع الأندية', language)}</h1>
            <p className="acm-subtitle">{t('Create, edit, and manage club details', 'إنشاء وتعديل وإدارة تفاصيل الأندية', language)}</p>
          </div>
          <div className="acm-actions">
            <button type="button" className="acm-btn acm-btn--secondary" onClick={handleSyncMembers} disabled={syncing} title={t('Sync members from storage', 'مزامنة الأعضاء', language)}>
              <span className={syncing ? 'acm-spinner' : ''}>{syncing ? '⋯' : '↻'}</span> {t('Sync Members', 'مزامنة الأعضاء', language)}
              {syncResult && !syncResult.error && <span className="acm-sync-ok">✓ {syncResult.count}</span>}
              {syncResult?.error && <span className="acm-sync-err">!</span>}
            </button>
            <button type="button" className="acm-btn acm-btn--primary" onClick={openCreate}>
              + {t('Add Club', 'إضافة نادٍ', language)}
            </button>
          </div>
        </header>

        {safeClubs.length > 0 && (
          <div className="acm-stats">
            <div className="acm-stat-card">
              <span className="acm-stat-icon">🏢</span>
              <div className="acm-stat-content">
                <span className="acm-stat-value">{safeClubs.length}</span>
                <span className="acm-stat-label">{t('Total Clubs', 'إجمالي الأندية', language)}</span>
              </div>
            </div>
          </div>
        )}

        {safeClubs.length === 0 ? (
          <div className="acm-empty">
            <span className="acm-empty-icon">🏢</span>
            <h3>{t('No clubs yet', 'لا توجد أندية بعد', language)}</h3>
            <p>{t('Create your first club to get started.', 'أنشئ ناديك الأول للبدء.', language)}</p>
            <button type="button" className="acm-btn acm-btn--primary" onClick={openCreate}>
              + {t('Create First Club', 'إنشاء أول نادٍ', language)}
            </button>
          </div>
        ) : (
          <div className="acm-grid">
            {safeClubs.map(club => {
              const memberCount = getClubMembersFromStorage(club.id)?.length || 0
              return (
                <div key={club.id} className="acm-card">
                  <div className="acm-card-main">
                    <div className="acm-card-logo">
                      {club.logo ? <img src={club.logo} alt="" /> : <span>◇</span>}
                    </div>
                    <div className="acm-card-info">
                      <h3 className="acm-card-name">{club.name || t('Unnamed', 'بدون اسم', language)}</h3>
                      {club.nameAr && <p className="acm-card-name-ar">{club.nameAr}</p>}
                      {club.address && <p className="acm-card-address">{club.address}</p>}
                      <div className="acm-card-meta">
                        <span>{club.courts?.length || 0} {t('courts', 'ملاعب', language)}</span>
                        <span>{memberCount} {t('members', 'أعضاء', language)}</span>
                        <span>{club.tournaments?.length || 0} {t('tournaments', 'بطولات', language)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="acm-card-actions">
                    <button type="button" className="acm-btn-icon" onClick={() => navigate(`/club/${club.id}`)} title={t('View', 'عرض', language)}>◉</button>
                    <button type="button" className="acm-btn-icon" onClick={() => navigate(`/admin/club/${club.id}`)} title={t('Admin', 'إدارة', language)}>⚙</button>
                    <button type="button" className="acm-btn-icon" onClick={() => openEdit(club)} title={t('Edit', 'تعديل', language)}>✎</button>
                    <button type="button" className="acm-btn-icon acm-btn-icon--danger" onClick={() => handleDelete(club.id)} title={t('Delete', 'حذف', language)}>×</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {showModal && (
          <Modal
            title={editingClub ? t('Edit Club', 'تعديل النادي', language) : t('Create Club', 'إنشاء نادٍ جديد', language)}
            onClose={closeModal}
          >
            <form className="acm-form" onSubmit={e => { e.preventDefault(); editingClub ? handleUpdate() : handleCreate() }}>
              <div className="acm-form-row">
                <div className="acm-form-group">
                  <label>{t('Club Name (English)', 'اسم النادي (إنجليزي)', language)} *</label>
                  <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Club name" required />
                </div>
                <div className="acm-form-group">
                  <label>{t('Club Name (Arabic)', 'اسم النادي (عربي)', language)}</label>
                  <input type="text" value={formData.nameAr} onChange={e => setFormData({ ...formData, nameAr: e.target.value })} placeholder="اسم النادي" dir="rtl" />
                </div>
              </div>
              <div className="acm-form-row">
                <div className="acm-form-group acm-form-group--full">
                  <label>{t('Address', 'العنوان', language)}</label>
                  <input type="text" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="Street, city" />
                </div>
              </div>
              <div className="acm-form-row">
                <div className="acm-form-group">
                  <label>{t('Address (Arabic)', 'العنوان (عربي)', language)}</label>
                  <input type="text" value={formData.addressAr} onChange={e => setFormData({ ...formData, addressAr: e.target.value })} placeholder="الشارع، المدينة" dir="rtl" />
                </div>
              </div>
              <div className="acm-form-row">
                <div className="acm-form-group">
                  <label>{t('Phone', 'الهاتف', language)}</label>
                  <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="+966..." />
                </div>
                <div className="acm-form-group">
                  <label>{t('Email', 'البريد', language)}</label>
                  <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="club@example.com" />
                </div>
              </div>
              <div className="acm-form-row">
                <div className="acm-form-group acm-form-group--full">
                  <label>{t('Website', 'الموقع', language)}</label>
                  <input type="url" value={formData.website} onChange={e => setFormData({ ...formData, website: e.target.value })} placeholder="https://..." />
                </div>
              </div>
              <div className="acm-form-row">
                <div className="acm-form-group">
                  <label>{t('Playtomic Venue ID', 'معرف Playtomic', language)}</label>
                  <input type="text" value={formData.playtomicVenueId} onChange={e => setFormData({ ...formData, playtomicVenueId: e.target.value })} placeholder="venue-id" />
                </div>
                <div className="acm-form-group">
                  <label>{t('Playtomic API Key', 'مفتاح Playtomic', language)}</label>
                  <input type="text" value={formData.playtomicApiKey} onChange={e => setFormData({ ...formData, playtomicApiKey: e.target.value })} placeholder="Optional" />
                </div>
              </div>
              <div className="acm-form-actions">
                <button type="button" className="acm-btn acm-btn--secondary" onClick={closeModal}>{t('Cancel', 'إلغاء', language)}</button>
                <button type="submit" className="acm-btn acm-btn--primary">{editingClub ? t('Update', 'تحديث', language) : t('Create', 'إنشاء', language)}</button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    </div>
  )
}
