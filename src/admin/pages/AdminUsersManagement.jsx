import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import './common.css'
import './AdminUsersManagement.css'
import { useAdminPanel } from '../AdminPanelContext'
import {
  loadPlatformAdmins,
  addPlatformAdmin,
  removePlatformAdmin,
  updatePlatformAdmin,
} from '../../storage/adminStorage'
import { refreshStoreKeys } from '../../storage/backendStorage'
import { getPlatformAdminSession, hasPlatformPermission } from '../../storage/platformAdminAuth'
import { PLATFORM_PERMISSIONS, CLUB_PERMISSIONS } from '../../config/permissions'

const t = (en, ar, lang) => (lang === 'ar' ? ar : en)

// --- Modal Component ---
function Modal({ title, onClose, children }) {
  return (
    <div className="au-modal-backdrop" onClick={onClose} role="presentation">
      <div className="au-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="au-modal-title">
        <div className="au-modal-header">
          <h3 id="au-modal-title">{title}</h3>
          <button type="button" className="au-modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className="au-modal-body">{children}</div>
      </div>
    </div>
  )
}

export default function AdminUsersManagement() {
  const { language = 'en', clubs = [], onUpdateClub, onRefreshClubs } = useAdminPanel()
  const location = useLocation()
  const session = getPlatformAdminSession()
  const [activeTab, setActiveTab] = useState('platform')
  const [admins, setAdmins] = useState(() => loadPlatformAdmins())
  const [showAddPlatform, setShowAddPlatform] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', permissions: [] })
  const [error, setError] = useState('')
  const [selectedClubId, setSelectedClubId] = useState('')
  const [showAddClubUser, setShowAddClubUser] = useState(false)
  const [clubUserForm, setClubUserForm] = useState({ email: '', password: '', permissions: [] })
  const [clubUserError, setClubUserError] = useState('')
  const [editingPlatformId, setEditingPlatformId] = useState(null)
  const [editingClubUserId, setEditingClubUserId] = useState(null)
  const [editingClubOwner, setEditingClubOwner] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const refreshPlatform = () => setAdmins(loadPlatformAdmins())

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refreshStoreKeys(['platform_admins'])
      setAdmins(loadPlatformAdmins())
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await refreshStoreKeys(['platform_admins'])
        if (!cancelled) setAdmins(loadPlatformAdmins())
      } catch (e) {
        if (!cancelled) setAdmins(loadPlatformAdmins())
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const state = location.state || {}
    if (state.activeTab) setActiveTab(state.activeTab)
    if (state.selectedClubId) setSelectedClubId(state.selectedClubId)
    if (state.showAddClubUser) setShowAddClubUser(true)
  }, [location.key])

  useEffect(() => {
    const approved = (clubs || []).filter(c => c.status !== 'pending' && c.status !== 'rejected')
    if (activeTab === 'clubs' && approved.length > 0) {
      if (!selectedClubId || !approved.find(c => c.id === selectedClubId)) {
        setSelectedClubId(approved[0].id)
      }
    }
  }, [activeTab, clubs, selectedClubId])

  if (!hasPlatformPermission(session, 'admin-users')) {
    return (
      <div className="main-admin-page">
        <div className="au-empty au-empty-error">
          <span className="au-empty-icon">🔒</span>
          <h3>{t('Access denied', 'غير مصرح', language)}</h3>
          <p>{t('You do not have permission to manage admin users.', 'ليس لديك صلاحية إدارة المستخدمين.', language)}</p>
        </div>
      </div>
    )
  }

  const approvedClubs = (clubs || []).filter(c => c.status !== 'pending' && c.status !== 'rejected')
  const selectedClub = approvedClubs.find(c => c.id === selectedClubId) || approvedClubs[0]
  const clubAdminUsers = selectedClub?.adminUsers || []

  const handleAddPlatform = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const result = await addPlatformAdmin(form.email, form.password, form.permissions)
      if (result?.error === 'EMAIL_EXISTS') {
        setError(t('This email is already an admin.', 'هذا البريد مسجّل كمدراء.', language))
        return
      }
      if (result?.admin) {
        await refreshStoreKeys(['platform_admins'])
        setAdmins(loadPlatformAdmins())
        setShowAddPlatform(false)
        setForm({ email: '', password: '', permissions: [] })
      } else {
        setError(t('Could not add admin.', 'تعذر إضافة المدير.', language))
      }
    } catch (err) {
      console.error('Add platform admin failed:', err)
      setError(t('Save failed: ', 'فشل الحفظ: ', language) + (err?.message || 'API error'))
    } finally {
      setSaving(false)
    }
  }

  const handleRemovePlatform = async (id) => {
    if (!window.confirm(t('Remove this admin?', 'إزالة هذا المدير؟', language))) return
    setSaving(true)
    try {
      if (await removePlatformAdmin(id)) {
        await refreshStoreKeys(['platform_admins'])
        setAdmins(loadPlatformAdmins())
        setEditingPlatformId(null)
      }
    } catch (err) {
      console.error('Remove platform admin failed:', err)
      setError(t('Save failed: ', 'فشل الحفظ: ', language) + (err?.message || 'API error'))
    } finally {
      setSaving(false)
    }
  }

  const handleEditPlatform = async (e) => {
    e.preventDefault()
    if (!editingPlatformId) return
    setError('')
    setSaving(true)
    try {
      const admin = admins.find(a => a.id === editingPlatformId)
      if (!admin) return
      const updates = { email: form.email.trim().toLowerCase() }
      if (form.password && form.password.length >= 6) updates.password = form.password
      if (admin.role !== 'owner') updates.permissions = form.permissions
      const updated = await updatePlatformAdmin(editingPlatformId, updates)
      if (updated) {
        await refreshStoreKeys(['platform_admins'])
        setAdmins(loadPlatformAdmins())
        setEditingPlatformId(null)
        setForm({ email: '', password: '', permissions: [] })
      } else {
        setError(t('Could not update admin.', 'تعذر تحديث المدير.', language))
      }
    } catch (err) {
      console.error('Edit platform admin failed:', err)
      setError(t('Save failed: ', 'فشل الحفظ: ', language) + (err?.message || 'API error'))
    } finally {
      setSaving(false)
    }
  }

  const openEditPlatform = (admin) => {
    setEditingPlatformId(admin.id)
    setForm({
      email: admin.email,
      password: '',
      permissions: admin.role === 'owner' ? (admin.permissions || []) : (admin.permissions || [])
    })
    setError('')
  }

  const togglePerm = (id) => {
    setForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(id)
        ? prev.permissions.filter(p => p !== id)
        : [...prev.permissions, id]
    }))
  }

  const toggleClubUserPerm = (id) => {
    setClubUserForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(id)
        ? prev.permissions.filter(p => p !== id)
        : [...prev.permissions, id]
    }))
  }

  const handleAddClubUser = async (e) => {
    e.preventDefault()
    setClubUserError('')
    if (!selectedClub || !onUpdateClub) return
    if (!clubUserForm.email || !clubUserForm.password || clubUserForm.password.length < 6) {
      setClubUserError(t('Email and password (min 6 chars) required.', 'البريد وكلمة المرور (6 أحرف) مطلوبة.', language))
      return
    }
    const users = [...clubAdminUsers]
    if (users.some(u => (u.email || '').toLowerCase() === clubUserForm.email.trim().toLowerCase())) {
      setClubUserError(t('This email is already a club admin.', 'هذا البريد مسجّل مسبقاً.', language))
      return
    }
    users.push({
      id: 'club-user-' + Date.now(),
      email: clubUserForm.email.trim().toLowerCase(),
      password: clubUserForm.password,
      permissions: clubUserForm.permissions,
      createdAt: new Date().toISOString()
    })
    setSaving(true)
    try {
      await onUpdateClub(selectedClub.id, { adminUsers: users })
      setShowAddClubUser(false)
      setClubUserForm({ email: '', password: '', permissions: [] })
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clubs-synced'))
    } catch (err) {
      setClubUserError(t('Save failed.', 'فشل الحفظ.', language) + (err?.message || ''))
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveClubUser = async (id) => {
    if (!selectedClub || !onUpdateClub) return
    if (!window.confirm(t('Remove this user?', 'إزالة هذا المستخدم؟', language))) return
    const users = clubAdminUsers.filter(u => u.id !== id)
    setSaving(true)
    try {
      await onUpdateClub(selectedClub.id, { adminUsers: users })
      setEditingClubUserId(null)
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clubs-synced'))
    } finally {
      setSaving(false)
    }
  }

  const handleEditClubUser = async (e) => {
    e.preventDefault()
    if (!selectedClub || !onUpdateClub || !editingClubUserId) return
    setClubUserError('')
    const user = clubAdminUsers.find(u => u.id === editingClubUserId)
    if (!user) return
    if (clubUserForm.password && clubUserForm.password.length < 6) {
      setClubUserError(t('Password must be at least 6 characters.', 'كلمة المرور 6 أحرف على الأقل.', language))
      return
    }
    if (clubAdminUsers.some(u => u.id !== editingClubUserId && (u.email || '').toLowerCase() === clubUserForm.email.trim().toLowerCase())) {
      setClubUserError(t('This email is already used.', 'هذا البريد مستخدم مسبقاً.', language))
      return
    }
    const users = clubAdminUsers.map(u =>
      u.id === editingClubUserId
        ? {
            ...u,
            email: clubUserForm.email.trim().toLowerCase(),
            password: clubUserForm.password || u.password,
            permissions: clubUserForm.permissions
          }
        : u
    )
    setSaving(true)
    try {
      await onUpdateClub(selectedClub.id, { adminUsers: users })
      setEditingClubUserId(null)
      setClubUserForm({ email: '', password: '', permissions: [] })
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clubs-synced'))
    } catch (err) {
      setClubUserError(t('Save failed.', 'فشل الحفظ.', language) + (err?.message || ''))
    } finally {
      setSaving(false)
    }
  }

  const openEditClubUser = (user) => {
    setEditingClubUserId(user.id)
    setEditingClubOwner(false)
    setClubUserForm({ email: user.email, password: '', permissions: user.permissions || [] })
    setClubUserError('')
  }

  const openEditClubOwner = () => {
    if (!selectedClub) return
    setEditingClubUserId(null)
    setEditingClubOwner(true)
    setClubUserForm({
      email: selectedClub.adminEmail || selectedClub.email || '',
      password: '',
      permissions: []
    })
    setClubUserError('')
  }

  const handleEditClubOwner = async (e) => {
    e.preventDefault()
    if (!selectedClub || !onUpdateClub || !editingClubOwner) return
    setClubUserError('')
    if (!clubUserForm.email?.trim()) {
      setClubUserError(t('Email is required.', 'البريد مطلوب.', language))
      return
    }
    if (clubUserForm.password && clubUserForm.password.length < 6) {
      setClubUserError(t('Password must be at least 6 characters.', 'كلمة المرور 6 أحرف على الأقل.', language))
      return
    }
    setSaving(true)
    try {
      await onUpdateClub(selectedClub.id, {
        adminEmail: clubUserForm.email.trim().toLowerCase(),
        ...(clubUserForm.password && clubUserForm.password.length >= 6 && { adminPassword: clubUserForm.password })
      })
      setEditingClubOwner(false)
      setClubUserForm({ email: '', password: '', permissions: [] })
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clubs-synced'))
    } catch (err) {
      setClubUserError(t('Save failed.', 'فشل الحفظ.', language) + (err?.message || ''))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="main-admin-page">
      <div className="au-page">
        <header className="au-header">
          <div className="au-header-content">
            <h1 className="au-title">{t('Admin Users', 'إدارة المستخدمين', language)}</h1>
            <p className="au-subtitle">{t('Manage platform and club administrators', 'إدارة مدراء المنصة والأندية', language)}</p>
          </div>
        </header>

        <nav className="au-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'platform'}
            className={`au-tab ${activeTab === 'platform' ? 'au-tab--active' : ''}`}
            onClick={() => setActiveTab('platform')}
          >
            <span className="au-tab-icon" aria-hidden>👤</span>
            <span>{t('Platform Admins', 'مدراء المنصة', language)}</span>
            <span className="au-tab-badge">{admins.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'clubs'}
            className={`au-tab ${activeTab === 'clubs' ? 'au-tab--active' : ''}`}
            onClick={() => setActiveTab('clubs')}
          >
            <span className="au-tab-icon" aria-hidden>🏢</span>
            <span>{t('Club Admins', 'مدراء الأندية', language)}</span>
            <span className="au-tab-badge">{approvedClubs.length}</span>
          </button>
        </nav>

        {activeTab === 'platform' && (
          <section className="au-section" role="tabpanel">
            <div className="au-section-header">
              <p className="au-section-desc">{t('Platform administrators can access the main admin panel.', 'مدراء المنصة يمكنهم الوصول للوحة التحكم الرئيسية.', language)}</p>
              <div className="au-actions">
                <button type="button" className="au-btn au-btn--secondary" onClick={handleRefresh} disabled={refreshing} title={t('Refresh', 'تحديث', language)}>
                  <span className={refreshing ? 'au-spinner' : ''}>{refreshing ? '⋯' : '↻'}</span> {t('Refresh', 'تحديث', language)}
                </button>
                <button type="button" className="au-btn au-btn--primary" onClick={() => { setShowAddPlatform(true); setError(''); setForm({ email: '', password: '', permissions: [] }) }}>
                  + {t('Add Admin', 'إضافة مدير', language)}
                </button>
              </div>
            </div>

            {admins.length === 0 ? (
              <div className="au-empty">
                <span className="au-empty-icon">👤</span>
                <h3>{t('No platform admins yet', 'لا يوجد مدراء منصة بعد', language)}</h3>
                <p>{t('Add the first admin to get started. Default: 2@2.com', 'أضف المدير الأول للبدء. الافتراضي: 2@2.com', language)}</p>
                <button type="button" className="au-btn au-btn--primary" onClick={() => { setShowAddPlatform(true); setForm({ email: '', password: '', permissions: [] }) }}>
                  + {t('Add Platform Admin', 'إضافة مدير منصة', language)}
                </button>
              </div>
            ) : (
              <div className="au-cards">
                {admins.map(a => (
                  <div key={a.id} className="au-card">
                    <div className="au-card-main">
                      <div className="au-card-avatar">{a.email.charAt(0).toUpperCase()}</div>
                      <div className="au-card-info">
                        <span className="au-card-email">{a.email}</span>
                        <span className={`au-card-role au-card-role--${a.role}`}>
                          {a.role === 'owner' ? t('Owner', 'مالك', language) : t('Admin', 'مدير', language)}
                        </span>
                        <span className="au-card-perms">
                          {a.role === 'owner' ? t('Full access', 'صلاحية كاملة', language) : (a.permissions || []).map(p => PLATFORM_PERMISSIONS.find(x => x.id === p)?.label[language] || p).join(' · ') || '—'}
                        </span>
                      </div>
                    </div>
                    <div className="au-card-actions">
                      <button type="button" className="au-btn-icon" onClick={() => openEditPlatform(a)} title={t('Edit', 'تعديل', language)}>✎</button>
                      {a.role !== 'owner' && (
                        <button type="button" className="au-btn-icon au-btn-icon--danger" onClick={() => handleRemovePlatform(a.id)} title={t('Remove', 'إزالة', language)}>×</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showAddPlatform && (
              <Modal title={t('Add Platform Admin', 'إضافة مدير منصة', language)} onClose={() => setShowAddPlatform(false)}>
                <form onSubmit={handleAddPlatform} className="au-form">
                  {error && <p className="au-form-error">{error}</p>}
                  <div className="au-form-group">
                    <label>{t('Email', 'البريد')} *</label>
                    <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required placeholder="admin@example.com" />
                  </div>
                  <div className="au-form-group">
                    <label>{t('Password', 'كلمة المرور')} * (min 6)</label>
                    <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={6} placeholder="••••••••" />
                  </div>
                  <div className="au-form-group">
                    <label>{t('Pages access', 'صفحات الوصول')}</label>
                    <div className="au-perms-grid">
                      {PLATFORM_PERMISSIONS.filter(p => p.id !== 'admin-users').map(p => (
                        <label key={p.id} className="au-check-item">
                          <input type="checkbox" checked={form.permissions.includes(p.id)} onChange={() => togglePerm(p.id)} />
                          <span>{p.label[language]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="au-form-actions">
                    <button type="submit" className="au-btn au-btn--primary" disabled={saving}>{saving ? t('Saving...', 'جاري الحفظ...', language) : t('Add', 'إضافة', language)}</button>
                    <button type="button" className="au-btn au-btn--secondary" onClick={() => setShowAddPlatform(false)} disabled={saving}>{t('Cancel', 'إلغاء', language)}</button>
                  </div>
                </form>
              </Modal>
            )}

            {editingPlatformId && (() => {
              const isEditingOwner = admins.find(a => a.id === editingPlatformId)?.role === 'owner'
              return (
                <Modal title={isEditingOwner ? t('Edit Owner', 'تعديل المالك', language) : t('Edit Admin', 'تعديل المدير', language)} onClose={() => { setEditingPlatformId(null); setForm({ email: '', password: '', permissions: [] }) }}>
                  <form onSubmit={handleEditPlatform} className="au-form">
                    {isEditingOwner && <p className="au-form-hint">{t('Update email and password.', 'تحديث البريد وكلمة المرور.', language)}</p>}
                    {error && <p className="au-form-error">{error}</p>}
                    <div className="au-form-group">
                      <label>{t('Email', 'البريد')} *</label>
                      <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                    </div>
                    <div className="au-form-group">
                      <label>{t('Password', 'كلمة المرور')} {isEditingOwner ? `(${t('leave blank to keep', 'اتركه فارغاً للإبقاء', language)})` : '(min 6, leave blank to keep)'}</label>
                      <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••••" {...(!isEditingOwner && { minLength: 6 })} />
                    </div>
                    {!isEditingOwner && (
                      <div className="au-form-group">
                        <label>{t('Pages access', 'صفحات الوصول')}</label>
                        <div className="au-perms-grid">
                          {PLATFORM_PERMISSIONS.filter(p => p.id !== 'admin-users').map(p => (
                            <label key={p.id} className="au-check-item">
                              <input type="checkbox" checked={form.permissions.includes(p.id)} onChange={() => togglePerm(p.id)} />
                              <span>{p.label[language]}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="au-form-actions">
                      <button type="submit" className="au-btn au-btn--primary" disabled={saving}>{saving ? t('Saving...', 'جاري الحفظ...', language) : t('Save', 'حفظ', language)}</button>
                      <button type="button" className="au-btn au-btn--secondary" onClick={() => { setEditingPlatformId(null); setForm({ email: '', password: '', permissions: [] }) }} disabled={saving}>{t('Cancel', 'إلغاء', language)}</button>
                    </div>
                  </form>
                </Modal>
              )
            })()}
          </section>
        )}

        {activeTab === 'clubs' && (
          <section className="au-section" role="tabpanel">
            {approvedClubs.length === 0 ? (
              <div className="au-empty">
                <span className="au-empty-icon">🏢</span>
                <h3>{t('No approved clubs', 'لا توجد أندية معتمدة', language)}</h3>
                <p>{t('Clubs will appear here after approval.', 'ستظهر الأندية هنا بعد الموافقة.', language)}</p>
              </div>
            ) : (
              <>
                <div className="au-club-picker">
                  <label>{t('Select club', 'اختر النادي', language)}</label>
                  <div className="au-club-picker-list">
                    {approvedClubs.map(club => (
                      <button
                        key={club.id}
                        type="button"
                        className={`au-club-chip ${selectedClubId === club.id ? 'au-club-chip--active' : ''}`}
                        onClick={() => setSelectedClubId(club.id)}
                      >
                        {club.logo ? <img src={club.logo} alt="" className="au-club-chip-logo" /> : <span className="au-club-chip-icon">🏢</span>}
                        <span className="au-club-chip-name">{language === 'ar' ? (club.nameAr || club.name) : club.name}</span>
                        <span className="au-club-chip-count">{(club.adminUsers || []).length + 1}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedClub && (
                  <div className="au-club-section">
                    <div className="au-section-header">
                      <h2 className="au-club-title">{language === 'ar' ? (selectedClub.nameAr || selectedClub.name) : selectedClub.name}</h2>
                      <div className="au-club-actions">
                        <button type="button" className="au-btn au-btn--primary" onClick={() => { setShowAddClubUser(true); setClubUserError(''); setClubUserForm({ email: '', password: '', permissions: [] }) }}>
                          + {t('Add Club Admin', 'إضافة مدير للنادي', language)}
                        </button>
                      </div>
                    </div>

                    <div className="au-cards">
                      <div className="au-card au-card--owner">
                        <div className="au-card-main">
                          <div className="au-card-avatar">{selectedClub.adminEmail?.charAt(0) || selectedClub.email?.charAt(0) || '?'}</div>
                          <div className="au-card-info">
                            <span className="au-card-email">{selectedClub.adminEmail || selectedClub.email}</span>
                            <span className="au-card-role au-card-role--owner">{t('Owner', 'مالك', language)}</span>
                            <span className="au-card-perms">{t('Full access', 'صلاحية كاملة', language)}</span>
                          </div>
                        </div>
                        <div className="au-card-actions">
                          <button type="button" className="au-btn-icon" onClick={openEditClubOwner} title={t('Edit', 'تعديل', language)}>✎</button>
                        </div>
                      </div>
                      {clubAdminUsers.map(u => (
                        <div key={u.id} className="au-card">
                          <div className="au-card-main">
                            <div className="au-card-avatar">{u.email.charAt(0).toUpperCase()}</div>
                            <div className="au-card-info">
                              <span className="au-card-email">{u.email}</span>
                              <span className="au-card-role">{t('Admin', 'مدير', language)}</span>
                              <span className="au-card-perms">{(u.permissions || []).map(p => CLUB_PERMISSIONS.find(x => x.id === p)?.label[language] || p).join(' · ') || '—'}</span>
                            </div>
                          </div>
                          <div className="au-card-actions">
                            <button type="button" className="au-btn-icon" onClick={() => openEditClubUser(u)} title={t('Edit', 'تعديل', language)}>✎</button>
                            <button type="button" className="au-btn-icon au-btn-icon--danger" onClick={() => handleRemoveClubUser(u.id)} title={t('Remove', 'إزالة', language)}>×</button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {showAddClubUser && (
                      <Modal title={`${t('Add Club Admin', 'إضافة مدير للنادي', language)} — ${language === 'ar' ? (selectedClub.nameAr || selectedClub.name) : selectedClub.name}`} onClose={() => setShowAddClubUser(false)}>
                        <form onSubmit={handleAddClubUser} className="au-form">
                          {clubUserError && <p className="au-form-error">{clubUserError}</p>}
                          <div className="au-form-group">
                            <label>{t('Email', 'البريد')} *</label>
                            <input type="email" value={clubUserForm.email} onChange={e => setClubUserForm({ ...clubUserForm, email: e.target.value })} required />
                          </div>
                          <div className="au-form-group">
                            <label>{t('Password', 'كلمة المرور')} * (min 6)</label>
                            <input type="password" value={clubUserForm.password} onChange={e => setClubUserForm({ ...clubUserForm, password: e.target.value })} required minLength={6} placeholder="••••••••" />
                          </div>
                          <div className="au-form-group">
                            <label>{t('Pages access', 'صفحات الوصول')}</label>
                            <div className="au-perms-grid">
                              {CLUB_PERMISSIONS.map(p => (
                                <label key={p.id} className="au-check-item">
                                  <input type="checkbox" checked={clubUserForm.permissions.includes(p.id)} onChange={() => toggleClubUserPerm(p.id)} />
                                  <span>{p.label[language]}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                          <div className="au-form-actions">
                            <button type="submit" className="au-btn au-btn--primary" disabled={saving}>{saving ? '⋯' : t('Add', 'إضافة', language)}</button>
                            <button type="button" className="au-btn au-btn--secondary" onClick={() => setShowAddClubUser(false)} disabled={saving}>{t('Cancel', 'إلغاء', language)}</button>
                          </div>
                        </form>
                      </Modal>
                    )}

                    {(editingClubUserId || editingClubOwner) && (
                      <Modal title={editingClubOwner ? t('Edit Club Owner', 'تعديل مالك النادي', language) : t('Edit Club Admin', 'تعديل مدير النادي', language)} onClose={() => { setEditingClubUserId(null); setEditingClubOwner(false); setClubUserForm({ email: '', password: '', permissions: [] }) }}>
                        <form onSubmit={editingClubOwner ? handleEditClubOwner : handleEditClubUser} className="au-form">
                          {editingClubOwner && <p className="au-form-hint">{t('Update email and password.', 'تحديث البريد وكلمة المرور.', language)}</p>}
                          {clubUserError && <p className="au-form-error">{clubUserError}</p>}
                          <div className="au-form-group">
                            <label>{t('Email', 'البريد')} *</label>
                            <input type="email" value={clubUserForm.email} onChange={e => setClubUserForm({ ...clubUserForm, email: e.target.value })} required />
                          </div>
                          <div className="au-form-group">
                            <label>{t('Password', 'كلمة المرور')} ({t('leave blank to keep', 'اتركه فارغاً للإبقاء', language)})</label>
                            <input type="password" value={clubUserForm.password} onChange={e => setClubUserForm({ ...clubUserForm, password: e.target.value })} placeholder="••••••••" />
                          </div>
                          {!editingClubOwner && (
                            <div className="au-form-group">
                              <label>{t('Pages access', 'صفحات الوصول')}</label>
                              <div className="au-perms-grid">
                                {CLUB_PERMISSIONS.map(p => (
                                  <label key={p.id} className="au-check-item">
                                    <input type="checkbox" checked={clubUserForm.permissions.includes(p.id)} onChange={() => toggleClubUserPerm(p.id)} />
                                    <span>{p.label[language]}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="au-form-actions">
                            <button type="submit" className="au-btn au-btn--primary" disabled={saving}>{saving ? '⋯' : t('Save', 'حفظ', language)}</button>
                            <button type="button" className="au-btn au-btn--secondary" onClick={() => { setEditingClubUserId(null); setEditingClubOwner(false); setClubUserForm({ email: '', password: '', permissions: [] }) }} disabled={saving}>{t('Cancel', 'إلغاء', language)}</button>
                          </div>
                        </form>
                      </Modal>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
