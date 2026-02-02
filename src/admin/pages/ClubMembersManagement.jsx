import React, { useState, useEffect, useMemo } from 'react'
import { getClubMembersFromStorage, upsertMember, removeMemberFromClubs, deleteMember } from '../../storage/adminStorage'
import { getAppLanguage } from '../../storage/languageStorage'
import './MembersManagement.css'

const t = (en, ar, lang) => (lang === 'ar' ? ar : en)

const ClubMembersManagement = ({ club, language: langProp }) => {
  const language = langProp || getAppLanguage()
  const [refreshKey, setRefreshKey] = useState(0)
  const [editingMember, setEditingMember] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', mobile: '', password: '' })
  const [error, setError] = useState('')

  const members = useMemo(() => {
    if (!club?.id) return []
    const fromStorage = getClubMembersFromStorage(club.id)
    const fromClub = club?.members || []
    const byId = new Map()
    fromStorage.forEach(m => { if (m?.id) byId.set(String(m.id), m) })
    fromClub.forEach(m => { if (m?.id && !byId.has(String(m.id))) byId.set(String(m.id), m) })
    return Array.from(byId.values())
  }, [club?.id, club?.members, refreshKey])

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

  const handleSaveEdit = (e) => {
    e.preventDefault()
    setError('')
    if (!editingMember) return
    const updated = {
      ...editingMember,
      name: editForm.name.trim() || editingMember.name,
      email: editForm.email.trim() || editingMember.email,
      mobile: editForm.mobile.trim() || editingMember.mobile
    }
    if (editForm.password && editForm.password.length >= 6) {
      updated.password = editForm.password
    }
    const result = upsertMember(updated)
    if (result) {
      setRefreshKey(k => k + 1)
      setEditingMember(null)
    } else {
      setError(t('Could not update member.', 'تعذر تحديث العضو.', language))
    }
  }

  const handleRemoveFromClub = (member) => {
    if (!window.confirm(t('Remove this member from the club?', 'إزالة هذا العضو من النادي؟', language))) return
    if (removeMemberFromClubs(member.id, club.id)) {
      setRefreshKey(k => k + 1)
      setEditingMember(null)
    }
  }

  const handleDeleteMember = (member) => {
    if (!window.confirm(t('Permanently delete this member from the platform?', 'حذف هذا العضو نهائياً من المنصة؟', language))) return
    if (deleteMember(member.id)) {
      setRefreshKey(k => k + 1)
      setEditingMember(null)
    }
  }

  if (!club) {
    return <div className="club-admin-page">Loading...</div>
  }

  return (
    <div className="club-admin-page club-members-management">
      <div className="members-management">
        <div className="page-header">
          <h2 className="page-title">{club.logo && <img src={club.logo} alt="" className="club-logo" />}{t('Members Management', 'إدارة الأعضاء', language)} - {language === 'ar' ? (club.nameAr || club.name) : club.name}</h2>
        </div>

        <div className="members-table-wrap">
          <table className="members-table">
            <thead>
              <tr>
                <th>{t('Name', 'الاسم', language)}</th>
                <th>{t('Phone', 'الهاتف', language)}</th>
                <th>{t('Email', 'البريد', language)}</th>
                <th>{t('Games', 'المباريات', language)}</th>
                <th>{t('Actions', 'إجراءات', language)}</th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                    {t('No members found', 'لا يوجد أعضاء', language)}
                  </td>
                </tr>
              ) : (
                members.map(member => (
                  <tr key={member.id}>
                    <td>{member.name || '—'}</td>
                    <td>{member.mobile || member.phone || '—'}</td>
                    <td>{member.email || '—'}</td>
                    <td>{member.totalGames || 0}</td>
                    <td>
                      <div className="action-buttons">
                        <button type="button" className="btn-secondary btn-small" onClick={() => openEdit(member)}>
                          {t('Edit', 'تعديل', language)}
                        </button>
                        <button type="button" className="btn-secondary btn-small" onClick={() => handleRemoveFromClub(member)}>
                          {t('Remove from club', 'إزالة من النادي', language)}
                        </button>
                        <button type="button" className="btn-danger btn-small" onClick={() => handleDeleteMember(member)}>
                          {t('Delete', 'حذف', language)}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {editingMember && (
          <div className="modal-overlay" onClick={() => setEditingMember(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h3>{t('Edit Member', 'تعديل العضو', language)}</h3>
              <form onSubmit={handleSaveEdit}>
                {error && <p className="register-error" style={{ marginBottom: 12 }}>{error}</p>}
                <div className="form-group">
                  <label>{t('Name', 'الاسم')} *</label>
                  <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>{t('Email', 'البريد')}</label>
                  <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>{t('Phone', 'الهاتف')}</label>
                  <input type="text" value={editForm.mobile} onChange={e => setEditForm({ ...editForm, mobile: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>{t('New password (leave blank to keep)', 'كلمة مرور جديدة (اتركه فارغاً للإبقاء)', language)}</label>
                  <input type="password" value={editForm.password} onChange={e => setEditForm({ ...editForm, password: e.target.value })} placeholder="••••••••" />
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                  <button type="submit" className="btn-primary">{t('Save', 'حفظ', language)}</button>
                  <button type="button" className="btn-secondary" onClick={() => setEditingMember(null)}>{t('Cancel', 'إلغاء', language)}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ClubMembersManagement
