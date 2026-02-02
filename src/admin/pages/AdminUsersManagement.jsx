import React, { useState, useEffect } from 'react'
import './common.css'
import './AllClubsDashboard.css'
import './AdminUsersManagement.css'
import {
  loadPlatformAdmins,
  addPlatformAdmin,
  removePlatformAdmin,
  savePlatformAdminsAsync
} from '../../storage/adminStorage'
import { getPlatformAdminSession, hasPlatformPermission } from '../../storage/platformAdminAuth'
import { PLATFORM_PERMISSIONS, CLUB_PERMISSIONS } from '../../config/permissions'

const t = (en, ar, lang) => (lang === 'ar' ? ar : en)

export default function AdminUsersManagement({ language = 'en', clubs = [], onUpdateClub, onRefreshClubs }) {
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

  if (!hasPlatformPermission(session, 'admin-users')) {
    return <div className="empty-state"><p>{t('Access denied', 'غير مصرح', language)}</p></div>
  }

  const refreshPlatform = () => setAdmins(loadPlatformAdmins())

  useEffect(() => {
    const approved = (clubs || []).filter(c => c.status !== 'pending' && c.status !== 'rejected')
    if (activeTab === 'clubs' && approved.length > 0) {
      if (!selectedClubId || !approved.find(c => c.id === selectedClubId)) {
        setSelectedClubId(approved[0].id)
      }
    }
  }, [activeTab, clubs, selectedClubId])
  const approvedClubs = (clubs || []).filter(c => c.status !== 'pending' && c.status !== 'rejected')
  const selectedClub = approvedClubs.find(c => c.id === selectedClubId) || approvedClubs[0]
  const clubAdminUsers = selectedClub?.adminUsers || []

  const handleAddPlatform = async (e) => {
    e.preventDefault()
    setError('')
    const result = addPlatformAdmin(form.email, form.password, form.permissions)
    if (result?.error === 'EMAIL_EXISTS') {
      setError(t('This email is already an admin.', 'هذا البريد مسجّل كمدراء.', language))
      return
    }
    if (result?.admin) {
      await savePlatformAdminsAsync(loadPlatformAdmins())
      refreshPlatform()
      setShowAddPlatform(false)
      setForm({ email: '', password: '', permissions: [] })
    } else {
      setError(t('Could not add admin.', 'تعذر إضافة المدير.', language))
    }
  }

  const handleRemovePlatform = async (id) => {
    if (!window.confirm(t('Remove this admin?', 'إزالة هذا المدير؟', language))) return
    if (removePlatformAdmin(id)) {
      await savePlatformAdminsAsync(loadPlatformAdmins())
      refreshPlatform()
    }
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

  const handleAddClubUser = (e) => {
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
    onUpdateClub(selectedClub.id, { adminUsers: users })
    setShowAddClubUser(false)
    setClubUserForm({ email: '', password: '', permissions: [] })
  }

  const handleRemoveClubUser = (id) => {
    if (!selectedClub || !onUpdateClub) return
    if (!window.confirm(t('Remove this user?', 'إزالة هذا المستخدم؟', language))) return
    const users = clubAdminUsers.filter(u => u.id !== id)
    onUpdateClub(selectedClub.id, { adminUsers: users })
  }

  return (
    <div className="admin-users-management">
      <div className="dashboard-header">
        <div className="dashboard-header-text">
          <h2>{t('Admin Users', 'مدراء المنصة', language)}</h2>
          <p>{t('Manage platform admins and club admin users.', 'إدارة مدراء المنصة ومدراء الأندية.', language)}</p>
        </div>
      </div>

      <div className="admin-users-tabs">
        <button
          type="button"
          className={`admin-users-tab ${activeTab === 'platform' ? 'active' : ''}`}
          onClick={() => setActiveTab('platform')}
        >
          <span className="tab-icon">👤</span>
          {t('Platform Admins', 'مدراء المنصة', language)}
        </button>
        <button
          type="button"
          className={`admin-users-tab ${activeTab === 'clubs' ? 'active' : ''}`}
          onClick={() => setActiveTab('clubs')}
        >
          <span className="tab-icon">🏢</span>
          {t('Club Admins', 'مدراء الأندية', language)}
        </button>
      </div>

      {/* Platform Admins Tab */}
      {activeTab === 'platform' && (
        <div className="admin-users-panel">
          <div className="admin-users-panel-header">
            <p>{t('Platform administrators can access the main admin panel (all clubs, settings).', 'مدراء المنصة يمكنهم الوصول للوحة التحكم الرئيسية.', language)}</p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => { setShowAddPlatform(true); setError(''); setForm({ email: '', password: '', permissions: [] }) }}
            >
              + {t('Add Platform Admin', 'إضافة مدير منصة', language)}
            </button>
          </div>

          {showAddPlatform && (
            <div className="pending-modal-overlay" onClick={() => setShowAddPlatform(false)}>
              <div className="pending-modal" onClick={e => e.stopPropagation()}>
                <h3>{t('Add Platform Admin', 'إضافة مدير منصة', language)}</h3>
                <form onSubmit={handleAddPlatform}>
                  {error && <p className="register-error" style={{ marginBottom: 12 }}>{error}</p>}
                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label>{t('Email', 'البريد')} *</label>
                    <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                  </div>
                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label>{t('Password', 'كلمة المرور')} * (min 6)</label>
                    <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={6} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label>{t('Pages access', 'صفحات الوصول')}</label>
                    <div className="permissions-checkbox-grid">
                      {PLATFORM_PERMISSIONS.filter(p => p.id !== 'admin-users').map(p => (
                        <label key={p.id} className="permission-checkbox-item">
                          <input type="checkbox" checked={form.permissions.includes(p.id)} onChange={() => togglePerm(p.id)} />
                          <span>{p.label[language]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                    <button type="submit" className="btn-primary">{t('Add', 'إضافة', language)}</button>
                    <button type="button" className="btn-secondary" onClick={() => setShowAddPlatform(false)}>{t('Cancel', 'إلغاء', language)}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="total-stats-grid" style={{ marginBottom: 24 }}>
            <div className="total-stat-card stat-primary">
              <div className="total-stat-value">{admins.length}</div>
              <div className="total-stat-label">{t('Platform Admins', 'مدراء المنصة', language)}</div>
            </div>
          </div>

          <div className="clubs-overview-section">
            <table className="all-members-table">
              <thead>
                <tr>
                  <th>{t('Email', 'البريد', language)}</th>
                  <th>{t('Role', 'الدور', language)}</th>
                  <th>{t('Permissions', 'الصلاحيات', language)}</th>
                  <th>{t('Actions', 'إجراءات', language)}</th>
                </tr>
              </thead>
              <tbody>
                {admins.map(a => (
                  <tr key={a.id}>
                    <td>{a.email}</td>
                    <td>{a.role === 'owner' ? t('Owner', 'مالك', language) : t('Admin', 'مدير', language)}</td>
                    <td>
                      {a.role === 'owner'
                        ? t('Full access', 'صلاحية كاملة', language)
                        : (a.permissions || []).map(p => PLATFORM_PERMISSIONS.find(x => x.id === p)?.label[language] || p).join(', ') || '—'}
                    </td>
                    <td>
                      {a.role !== 'owner' && (
                        <button type="button" className="btn-danger btn-small" onClick={() => handleRemovePlatform(a.id)}>
                          {t('Remove', 'إزالة', language)}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Club Admins Tab */}
      {activeTab === 'clubs' && (
        <div className="admin-users-panel admin-users-club-panel">
          {approvedClubs.length === 0 ? (
            <div className="admin-users-empty">
              <p>{t('No approved clubs yet.', 'لا توجد أندية معتمدة بعد.', language)}</p>
              <p className="hint">{t('Clubs will appear here after approval.', 'ستظهر الأندية هنا بعد الموافقة عليها.', language)}</p>
            </div>
          ) : (
            <>
              <div className="club-selector-section">
                <label>{t('Select club', 'اختر النادي', language)}</label>
                <div className="club-selector-cards">
                  {approvedClubs.map(club => (
                    <button
                      key={club.id}
                      type="button"
                      className={`club-selector-card ${selectedClubId === club.id || (!selectedClubId && club.id === approvedClubs[0]?.id) ? 'active' : ''}`}
                      onClick={() => setSelectedClubId(club.id)}
                    >
                      {club.logo ? <img src={club.logo} alt="" className="club-selector-logo" /> : <span className="club-selector-icon">🏢</span>}
                      <span className="club-selector-name">{language === 'ar' ? (club.nameAr || club.name) : club.name}</span>
                      <span className="club-selector-count">{(club.adminUsers || []).length + 1}</span>
                    </button>
                  ))}
                </div>
              </div>

              {selectedClub && (
                <div className="club-users-section">
                  <div className="club-users-header">
                    <h3>
                      {language === 'ar' ? (selectedClub.nameAr || selectedClub.name) : selectedClub.name}
                      <span className="club-users-badge">{t('Club admins', 'مدراء النادي', language)}</span>
                    </h3>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => { setShowAddClubUser(true); setClubUserError(''); setClubUserForm({ email: '', password: '', permissions: [] }) }}
                    >
                      + {t('Add Club Admin', 'إضافة مدير للنادي', language)}
                    </button>
                  </div>

                  {showAddClubUser && (
                    <div className="pending-modal-overlay" onClick={() => setShowAddClubUser(false)}>
                      <div className="pending-modal" onClick={e => e.stopPropagation()}>
                        <h3>{t('Add Club Admin User', 'إضافة مدير للنادي', language)} — {language === 'ar' ? (selectedClub.nameAr || selectedClub.name) : selectedClub.name}</h3>
                        <form onSubmit={handleAddClubUser}>
                          {clubUserError && <p className="register-error" style={{ marginBottom: 12 }}>{clubUserError}</p>}
                          <div className="form-group" style={{ marginBottom: 16 }}>
                            <label>{t('Email', 'البريد')} *</label>
                            <input type="email" value={clubUserForm.email} onChange={e => setClubUserForm({ ...clubUserForm, email: e.target.value })} required />
                          </div>
                          <div className="form-group" style={{ marginBottom: 16 }}>
                            <label>{t('Password', 'كلمة المرور')} * (min 6)</label>
                            <input type="password" value={clubUserForm.password} onChange={e => setClubUserForm({ ...clubUserForm, password: e.target.value })} required minLength={6} />
                          </div>
                          <div className="form-group" style={{ marginBottom: 16 }}>
                            <label>{t('Pages access', 'صفحات الوصول')}</label>
                            <div className="permissions-checkbox-grid">
                              {CLUB_PERMISSIONS.map(p => (
                                <label key={p.id} className="permission-checkbox-item">
                                  <input type="checkbox" checked={clubUserForm.permissions.includes(p.id)} onChange={() => toggleClubUserPerm(p.id)} />
                                  <span>{p.label[language]}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                            <button type="submit" className="btn-primary">{t('Add', 'إضافة', language)}</button>
                            <button type="button" className="btn-secondary" onClick={() => setShowAddClubUser(false)}>{t('Cancel', 'إلغاء', language)}</button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}

                  <div className="club-users-table-wrap">
                    <table className="all-members-table club-users-table">
                      <thead>
                        <tr>
                          <th>{t('User', 'المستخدم', language)}</th>
                          <th>{t('Role', 'الدور', language)}</th>
                          <th>{t('Permissions', 'الصلاحيات', language)}</th>
                          <th>{t('Actions', 'إجراءات', language)}</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>
                            <span className="club-user-email">{selectedClub.adminEmail || selectedClub.email}</span>
                            <span className="club-user-role-badge owner">{t('Owner', 'مالك', language)}</span>
                          </td>
                          <td>{t('Owner', 'مالك', language)}</td>
                          <td>{t('Full access', 'صلاحية كاملة', language)}</td>
                          <td>—</td>
                        </tr>
                        {clubAdminUsers.map(u => (
                          <tr key={u.id}>
                            <td><span className="club-user-email">{u.email}</span></td>
                            <td>{t('Admin', 'مدير', language)}</td>
                            <td>{(u.permissions || []).map(p => CLUB_PERMISSIONS.find(x => x.id === p)?.label[language] || p).join(', ') || '—'}</td>
                            <td>
                              <button type="button" className="btn-danger btn-small" onClick={() => handleRemoveClubUser(u.id)}>
                                {t('Remove', 'إزالة', language)}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
