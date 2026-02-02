import React, { useState } from 'react'
import './common.css'
import './AllClubsDashboard.css'
import {
  loadPlatformAdmins,
  addPlatformAdmin,
  removePlatformAdmin,
  savePlatformAdminsAsync
} from '../../storage/adminStorage'
import { getPlatformAdminSession, hasPlatformPermission } from '../../storage/platformAdminAuth'

const PLATFORM_PAGES = [
  { id: 'all-clubs', label: { en: 'All Clubs Dashboard', ar: 'لوحة جميع الأندية' } },
  { id: 'manage-clubs', label: { en: 'Manage Clubs', ar: 'إدارة الأندية' } },
  { id: 'all-members', label: { en: 'All Members', ar: 'أعضاء المنصة' } },
  { id: 'admin-users', label: { en: 'Admin Users', ar: 'مدراء المنصة' } }
]

const t = (en, ar, lang) => (lang === 'ar' ? ar : en)

export default function AdminUsersManagement({ language = 'en' }) {
  const session = getPlatformAdminSession()
  const [admins, setAdmins] = useState(() => loadPlatformAdmins())
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', permissions: [] })
  const [error, setError] = useState('')

  if (!hasPlatformPermission(session, 'admin-users')) {
    return <div className="empty-state"><p>{t('Access denied', 'غير مصرح', language)}</p></div>
  }

  const refresh = () => setAdmins(loadPlatformAdmins())

  const handleAdd = async (e) => {
    e.preventDefault()
    setError('')
    const result = addPlatformAdmin(form.email, form.password, form.permissions)
    if (result?.error === 'EMAIL_EXISTS') {
      setError(t('This email is already an admin.', 'هذا البريد مسجّل كمدراء.', language))
      return
    }
    if (result?.admin) {
      await savePlatformAdminsAsync(loadPlatformAdmins())
      refresh()
      setShowAdd(false)
      setForm({ email: '', password: '', permissions: [] })
    } else {
      setError(t('Could not add admin.', 'تعذر إضافة المدير.', language))
    }
  }

  const handleRemove = async (id) => {
    if (!window.confirm(t('Remove this admin?', 'إزالة هذا المدير؟', language))) return
    if (removePlatformAdmin(id)) {
      await savePlatformAdminsAsync(loadPlatformAdmins())
      refresh()
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

  return (
    <div className="all-clubs-dashboard">
      <div className="dashboard-header">
        <div className="dashboard-header-text">
          <h2>{t('Admin Users', 'مدراء المنصة', language)}</h2>
          <p>{t('Manage platform administrators and their access.', 'إدارة مدراء المنصة وصلاحياتهم.', language)}</p>
        </div>
        <div className="dashboard-header-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => { setShowAdd(true); setError(''); setForm({ email: '', password: '', permissions: [] }) }}
          >
            + {t('Add Admin', 'إضافة مدير', language)}
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="pending-modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="pending-modal" onClick={e => e.stopPropagation()}>
            <h3>{t('Add Platform Admin', 'إضافة مدير منصة', language)}</h3>
            <form onSubmit={handleAdd}>
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
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {PLATFORM_PAGES.filter(p => p.id !== 'admin-users').map(p => (
                    <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="checkbox" checked={form.permissions.includes(p.id)} onChange={() => togglePerm(p.id)} />
                      <span>{p.label[language]}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                <button type="submit" className="btn-primary">{t('Add', 'إضافة', language)}</button>
                <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>{t('Cancel', 'إلغاء', language)}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="total-stats-grid" style={{ marginBottom: 24 }}>
        <div className="total-stat-card stat-primary">
          <div className="total-stat-value">{admins.length}</div>
          <div className="total-stat-label">{t('Total Admins', 'إجمالي المدراء', language)}</div>
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
                    : (a.permissions || []).map(p => PLATFORM_PAGES.find(x => x.id === p)?.label[language] || p).join(', ') || '—'}
                </td>
                <td>
                  {a.role !== 'owner' && (
                    <button type="button" className="btn-danger btn-small" onClick={() => handleRemove(a.id)}>
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
  )
}
