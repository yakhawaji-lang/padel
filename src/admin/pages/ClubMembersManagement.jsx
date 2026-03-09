import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getClubMembersFromStorage, upsertMember, removeMemberFromClubs, deleteMember, refreshClubsFromApi } from '../../storage/adminStorage'
import { getAppLanguage } from '../../storage/languageStorage'
import './club-pages-common.css'
import './MembersManagement.css'

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

const ClubMembersManagement = ({ club, language: langProp }) => {
  const language = langProp || getAppLanguage()
  const navigate = useNavigate()
  const [refreshKey, setRefreshKey] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [editingMember, setEditingMember] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', mobile: '', password: '' })
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', email: '', mobile: '', password: '' })

  const members = useMemo(() => {
    if (!club?.id) return []
    const fromStorage = getClubMembersFromStorage(club.id)
    const fromClub = club?.members || []
    const byId = new Map()
    fromStorage.forEach(m => { if (m?.id) byId.set(String(m.id), m) })
    fromClub.forEach(m => { if (m?.id && !byId.has(String(m.id))) byId.set(String(m.id), m) })
    return Array.from(byId.values())
  }, [club?.id, club?.members, refreshKey])

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members
    const q = searchQuery.toLowerCase()
    return members.filter(m =>
      m.name?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q) ||
      (m.mobile || m.phone || '')?.toLowerCase().includes(q)
    )
  }, [members, searchQuery])

  useEffect(() => {
    const onSynced = () => setRefreshKey(k => k + 1)
    const onVisible = () => { if (document.visibilityState === 'visible') setRefreshKey(k => k + 1) }
    window.addEventListener('clubs-synced', onSynced)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('clubs-synced', onSynced)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refreshClubsFromApi()
      setRefreshKey(k => k + 1)
    } finally {
      setRefreshing(false)
    }
  }

  const openEdit = (member) => {
    setEditingMember(member)
    setEditForm({
      name: member.name || '',
      email: member.email || '',
      mobile: member.mobile || member.phone || '',
      password: ''
    })
    setError('')
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    setError('')
    if (!editingMember) return
    const updated = {
      ...editingMember,
      name: editForm.name.trim() || editingMember.name,
      email: editForm.email.trim() || editingMember.email,
      mobile: editForm.mobile.trim() || editingMember.mobile
    }
    if (editForm.password && editForm.password.length >= 6) updated.password = editForm.password
    const result = await upsertMember(updated)
    if (result) {
      setRefreshKey(k => k + 1)
      setEditingMember(null)
      window.dispatchEvent(new CustomEvent('clubs-synced'))
    } else {
      setError(t('Could not update member.', 'تعذر تحديث العضو.', language))
    }
  }

  const handleRemoveFromClub = async (member) => {
    if (!window.confirm(t('Remove this member from the club?', 'إزالة هذا العضو من النادي؟', language))) return
    if (await removeMemberFromClubs(member.id, club.id)) {
      setRefreshKey(k => k + 1)
      setEditingMember(null)
      window.dispatchEvent(new CustomEvent('clubs-synced'))
    }
  }

  const handleDeleteMember = async (member) => {
    if (!window.confirm(t('Permanently delete this member from the platform?', 'حذف هذا العضو نهائياً من المنصة؟', language))) return
    if (await deleteMember(member.id)) {
      setRefreshKey(k => k + 1)
      setEditingMember(null)
      window.dispatchEvent(new CustomEvent('clubs-synced'))
    }
  }

  const handleAddNewMember = async (e) => {
    e.preventDefault()
    if (!addForm.name?.trim() || !addForm.email?.trim()) return
    const newMember = {
      id: 'member-' + Date.now(),
      name: addForm.name.trim(),
      email: addForm.email.trim(),
      mobile: (addForm.mobile || '').trim(),
      phone: (addForm.mobile || '').trim(),
      password: addForm.password || '',
      clubIds: [club.id],
      role: 'member',
      createdAt: new Date().toISOString()
    }
    const result = await upsertMember(newMember)
    if (result) {
      setRefreshKey(k => k + 1)
      setShowAddModal(false)
      setAddForm({ name: '', email: '', mobile: '', password: '' })
      window.dispatchEvent(new CustomEvent('clubs-synced'))
    }
  }

  if (!club) {
    return (
      <div className="club-admin-page">
        <div className="cxp-empty">
          <span className="cxp-empty-icon">⏳</span>
          <h4>{t('Loading...', 'جاري التحميل...', language)}</h4>
        </div>
      </div>
    )
  }

  return (
    <div className="club-admin-page club-members-management">
      <header className="cxp-header">
        <div className="cxp-header-title-wrap">
          <h1 className="cxp-title">
            {club.logo && <img src={club.logo} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'contain' }} />}
            {t('Members', 'الأعضاء', language)} — {language === 'ar' ? (club.nameAr || club.name) : club.name}
          </h1>
          <p className="cxp-subtitle">{t('Manage club members', 'إدارة أعضاء النادي', language)}</p>
        </div>
        <div className="cxp-header-actions">
          <button type="button" className="cxp-btn cxp-btn--secondary" onClick={handleRefresh} disabled={refreshing} title={t('Refresh from database', 'تحديث من قاعدة البيانات', language)}>
            {refreshing ? '⋯' : '↻'} {t('Refresh', 'تحديث', language)}
          </button>
          <button type="button" className="cxp-btn cxp-btn--primary" onClick={() => setShowAddModal(true)}>
            + {t('Add Member', 'إضافة عضو', language)}
          </button>
        </div>
      </header>

      {members.length > 0 && (
        <div className="cxp-stats">
          <div className="cxp-stat">
            <div className="cxp-stat-value">{members.length}</div>
            <div className="cxp-stat-label">{t('Total', 'الإجمالي', language)}</div>
          </div>
        </div>
      )}

      {members.length > 0 && (
        <div className="cxp-search-wrap">
          <input
            type="text"
            className="cxp-search-input"
            placeholder={t('Search by name, email, phone...', 'البحث بالاسم، البريد، الهاتف...', language)}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <span className="cxp-search-icon">🔍</span>
        </div>
      )}

      {filteredMembers.length === 0 ? (
        <div className="cxp-empty">
          <span className="cxp-empty-icon">👥</span>
          <h4>
            {searchQuery.trim()
              ? t('No results', 'لا توجد نتائج', language)
              : t('No members yet', 'لا يوجد أعضاء بعد', language)}
          </h4>
          <p>
            {searchQuery.trim()
              ? t('Try a different search.', 'جرب بحثاً آخر.', language)
              : t('Members will appear when they join the club.', 'ستظهر الأعضاء عند انضمامهم للنادي.', language)}
          </p>
        </div>
      ) : (
        <div className="cxp-cards cxp-members-cards">
          {filteredMembers.map(member => (
            <div key={member.id} className="cxp-card cxp-member-card">
              <div className="cxp-member-main">
                <div className="cxp-member-avatar">
                  {member.avatar ? (
                    <img src={member.avatar} alt="" />
                  ) : (
                    <span>{(member.name || '?')[0].toUpperCase()}</span>
                  )}
                </div>
                <div className="cxp-member-info">
                  <h4 className="cxp-member-name">{member.name || '—'}</h4>
                  {member.email && <p className="cxp-member-email">{member.email}</p>}
                  {(member.mobile || member.phone) && <p className="cxp-member-phone">{member.mobile || member.phone}</p>}
                  {member.totalGames != null && (
                    <span className="cxp-member-games">{member.totalGames} {t('games', 'مباريات', language)}</span>
                  )}
                </div>
              </div>
              <div className="cxp-member-actions">
                <button type="button" className="cxp-btn-icon" onClick={() => openEdit(member)} title={t('Edit', 'تعديل', language)}>✎</button>
                <button type="button" className="cxp-btn cxp-btn--secondary" style={{ padding: '6px 12px', fontSize: '0.8125rem' }} onClick={() => handleRemoveFromClub(member)}>
                  {t('Remove', 'إزالة', language)}
                </button>
                <button type="button" className="cxp-btn-icon cxp-btn-icon--danger" onClick={() => handleDeleteMember(member)} title={t('Delete', 'حذف', language)}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <Modal title={t('Add Member', 'إضافة عضو', language)} onClose={() => { setShowAddModal(false); setAddForm({ name: '', email: '', mobile: '', password: '' }) }}>
          <form onSubmit={handleAddNewMember}>
            <div className="cxp-form-group">
              <label>{t('Name', 'الاسم', language)} *</label>
              <input type="text" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} required />
            </div>
            <div className="cxp-form-group">
              <label>{t('Email', 'البريد', language)} *</label>
              <input type="email" value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} required />
            </div>
            <div className="cxp-form-group">
              <label>{t('Phone', 'الهاتف', language)}</label>
              <input type="text" value={addForm.mobile} onChange={e => setAddForm({ ...addForm, mobile: e.target.value })} placeholder="+966..." />
            </div>
            <div className="cxp-form-group">
              <label>{t('Password', 'كلمة المرور', language)}</label>
              <input type="password" value={addForm.password} onChange={e => setAddForm({ ...addForm, password: e.target.value })} placeholder="••••••••" minLength={6} />
            </div>
            <div className="cxp-form-actions">
              <button type="button" className="cxp-btn cxp-btn--secondary" onClick={() => { setShowAddModal(false); setAddForm({ name: '', email: '', mobile: '', password: '' }) }}>{t('Cancel', 'إلغاء', language)}</button>
              <button type="submit" className="cxp-btn cxp-btn--primary">{t('Save', 'حفظ', language)}</button>
            </div>
          </form>
        </Modal>
      )}

      {editingMember && (
        <Modal title={t('Edit Member', 'تعديل العضو', language)} onClose={() => setEditingMember(null)}>
          <form onSubmit={handleSaveEdit}>
            {error && <p style={{ color: '#dc2626', marginBottom: 12, fontSize: '0.875rem' }}>{error}</p>}
            <div className="cxp-form-group">
              <label>{t('Name', 'الاسم', language)} *</label>
              <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
            </div>
            <div className="cxp-form-group">
              <label>{t('Email', 'البريد', language)}</label>
              <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div className="cxp-form-group">
              <label>{t('Phone', 'الهاتف', language)}</label>
              <input type="text" value={editForm.mobile} onChange={e => setEditForm({ ...editForm, mobile: e.target.value })} placeholder="+966..." />
            </div>
            <div className="cxp-form-group">
              <label>{t('New password (leave blank to keep)', 'كلمة مرور جديدة (اتركه فارغاً للإبقاء)', language)}</label>
              <input type="password" value={editForm.password} onChange={e => setEditForm({ ...editForm, password: e.target.value })} placeholder="••••••••" />
            </div>
            <div className="cxp-form-actions">
              <button type="button" className="cxp-btn cxp-btn--secondary" onClick={() => setEditingMember(null)}>{t('Cancel', 'إلغاء', language)}</button>
              <button type="submit" className="cxp-btn cxp-btn--primary">{t('Save', 'حفظ', language)}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default ClubMembersManagement
