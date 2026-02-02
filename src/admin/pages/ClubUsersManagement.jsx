import React, { useState } from 'react'
import { getClubAdminSession, hasClubPermission } from '../../storage/clubAuth'
import { CLUB_PERMISSIONS } from '../../config/permissions'
import './MembersManagement.css'

const t = (en, ar, lang) => (lang === 'ar' ? ar : en)

export default function ClubUsersManagement({ club, onUpdateClub, language = 'en' }) {
  const session = getClubAdminSession()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', permissions: [] })
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')

  if (!hasClubPermission(session, 'users')) {
    return <div className="empty-state"><p>{t('Access denied', 'غير مصرح', language)}</p></div>
  }

  const adminUsers = club?.adminUsers || []

  const openEdit = (user) => {
    setEditingId(user.id)
    setForm({ email: user.email, password: '', permissions: user.permissions || [] })
    setError('')
  }

  const handleEdit = (e) => {
    e.preventDefault()
    if (!editingId || !club || !onUpdateClub) return
    setError('')
    const users = (club.adminUsers || []).map(u =>
      u.id === editingId
        ? {
            ...u,
            email: form.email.trim().toLowerCase(),
            password: form.password || u.password,
            permissions: form.permissions
          }
        : u
    )
    if (form.password && form.password.length > 0 && form.password.length < 6) {
      setError(t('Password must be at least 6 characters.', 'كلمة المرور 6 أحرف على الأقل.', language))
      return
    }
    if (users.some(u => u.id !== editingId && (u.email || '').toLowerCase() === form.email.trim().toLowerCase())) {
      setError(t('This email is already used.', 'هذا البريد مستخدم مسبقاً.', language))
      return
    }
    onUpdateClub({ adminUsers: users })
    setEditingId(null)
    setForm({ email: '', password: '', permissions: [] })
  }

  const togglePerm = (id) => {
    setForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(id)
        ? prev.permissions.filter(p => p !== id)
        : [...prev.permissions, id]
    }))
  }

  const handleAdd = (e) => {
    e.preventDefault()
    if (!form.email || !form.password || form.password.length < 6) return
    const users = [...adminUsers]
    if (users.some(u => (u.email || '').toLowerCase() === form.email.trim().toLowerCase())) {
      setError(t('Email already exists', 'البريد مسجّل مسبقاً', language))
      setShowAdd(true)
      return
    }
    users.push({
      id: 'club-user-' + Date.now(),
      email: form.email.trim(),
      password: form.password,
      permissions: form.permissions,
      createdAt: new Date().toISOString()
    })
    onUpdateClub({ adminUsers: users })
    setShowAdd(false)
    setForm({ email: '', password: '', permissions: [] })
  }

  const handleRemove = (id) => {
    if (!window.confirm(t('Remove this user?', 'إزالة هذا المستخدم؟', language))) return
    const users = adminUsers.filter(u => u.id !== id)
    onUpdateClub({ adminUsers: users })
    setEditingId(null)
  }

  return (
    <div className="club-members-management">
      <div className="section-header">
        <h2>{t('Club Admin Users', 'مدراء النادي', language)}</h2>
        <button type="button" className="btn-primary" onClick={() => { setShowAdd(true); setForm({ email: '', password: '', permissions: [] }) }}>
          + {t('Add User', 'إضافة مستخدم', language)}
        </button>
      </div>

          {showAdd && !editingId && (
        <div className="modal-overlay" onClick={() => { setShowAdd(false); setError('') }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{t('Add Club Admin User', 'إضافة مدير للنادي', language)}</h3>
            <form onSubmit={handleAdd}>
              {error && <p className="register-error" style={{ marginBottom: 12 }}>{error}</p>}
              <div className="form-group">
                <label>{t('Email', 'البريد')} *</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>{t('Password', 'كلمة المرور')} * (min 6)</label>
                <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={6} />
              </div>
              <div className="form-group">
                <label>{t('Pages access', 'صفحات الوصول')}</label>
                <div className="permissions-checkbox-grid">
                  {CLUB_PERMISSIONS.map(p => (
                    <label key={p.id} className="permission-checkbox-item">
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

      {editingId && (
        <div className="modal-overlay" onClick={() => { setEditingId(null); setForm({ email: '', password: '', permissions: [] }) }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{t('Edit Club Admin User', 'تعديل مدير النادي', language)}</h3>
            <form onSubmit={handleEdit}>
              {error && <p className="register-error" style={{ marginBottom: 12 }}>{error}</p>}
              <div className="form-group">
                <label>{t('Email', 'البريد')} *</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>{t('Password', 'كلمة المرور')} (min 6, leave blank to keep)</label>
                <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
              </div>
              <div className="form-group">
                <label>{t('Pages access', 'صفحات الوصول')}</label>
                <div className="permissions-checkbox-grid">
                  {CLUB_PERMISSIONS.map(p => (
                    <label key={p.id} className="permission-checkbox-item">
                      <input type="checkbox" checked={form.permissions.includes(p.id)} onChange={() => togglePerm(p.id)} />
                      <span>{p.label[language]}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                <button type="submit" className="btn-primary">{t('Save', 'حفظ', language)}</button>
                <button type="button" className="btn-secondary" onClick={() => { setEditingId(null); setForm({ email: '', password: '', permissions: [] }) }}>{t('Cancel', 'إلغاء', language)}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="members-table-wrap">
        <table className="members-table">
          <thead>
            <tr>
              <th>{t('Email', 'البريد', language)}</th>
              <th>{t('Permissions', 'الصلاحيات', language)}</th>
              <th>{t('Actions', 'إجراءات', language)}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{club?.adminEmail || club?.email} <span style={{ color: '#059669', fontSize: '0.8rem' }}>({t('Owner', 'مالك', language)})</span></td>
              <td>{t('Full access', 'صلاحية كاملة', language)}</td>
              <td>—</td>
            </tr>
            {adminUsers.map(u => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{(u.permissions || []).map(p => CLUB_PERMISSIONS.find(x => x.id === p)?.label[language] || p).join(', ') || '—'}</td>
                <td>
                  <div className="action-buttons">
                    <button type="button" className="btn-secondary btn-small" onClick={() => openEdit(u)}>{t('Edit', 'تعديل', language)}</button>
                    <button type="button" className="btn-danger btn-small" onClick={() => handleRemove(u.id)}>{t('Remove', 'إزالة', language)}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
