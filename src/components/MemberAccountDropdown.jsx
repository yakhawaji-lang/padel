import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { updatePlatformMember, logoutPlatformUser } from '../storage/platformAuth'
import './MemberAccountDropdown.css'

const MemberAccountDropdown = ({ member, onUpdate, language = 'en', children, className = '' }) => {
  const [open, setOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', email: '', avatar: '' })

  useEffect(() => {
    if (member) setEditForm({ name: member.name || '', email: member.email || '', avatar: member.avatar || '' })
  }, [member])

  useEffect(() => {
    const close = () => setOpen(false)
    if (open) {
      document.addEventListener('click', close)
      return () => document.removeEventListener('click', close)
    }
  }, [open])

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    if (!member?.id) return
    await updatePlatformMember(member.id, { name: editForm.name.trim(), email: editForm.email.trim(), avatar: editForm.avatar || undefined })
    setEditOpen(false)
    if (onUpdate) onUpdate()
  }

  const handleLogout = () => {
    logoutPlatformUser()
    setOpen(false)
    if (onUpdate) onUpdate()
    window.location.reload()
  }

  const t = {
    en: { editProfile: 'Edit profile', logout: 'Logout', myAccount: 'My account', myBookings: 'My Bookings', save: 'Save', cancel: 'Cancel', name: 'Name', email: 'Email', avatar: 'Profile photo (URL or upload)' },
    ar: { editProfile: 'تعديل الحساب', logout: 'تسجيل الخروج', myAccount: 'حسابي', myBookings: 'حجوزاتي', save: 'حفظ', cancel: 'إلغاء', name: 'الاسم', email: 'البريد', avatar: 'صورة الملف الشخصي (رابط أو رفع)' }
  }
  const c = t[language]

  if (!member) return null

  return (
    <div className={`member-account-dropdown ${className}`} onClick={e => e.stopPropagation()}>
      <button
        type="button"
        className="member-account-trigger"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {member.avatar ? (
          <img src={member.avatar} alt="" className="member-account-avatar" />
        ) : (
          <span className="member-account-avatar-placeholder">{member.name?.[0] || '?'}</span>
        )}
      </button>
      {open && (
        <div className="member-account-menu">
          <div className="member-account-menu-header">
            {member.avatar ? (
              <img src={member.avatar} alt="" className="member-account-menu-avatar" />
            ) : (
              <span className="member-account-menu-avatar-placeholder">{member.name?.[0] || '?'}</span>
            )}
            <div className="member-account-menu-name">{member.name}</div>
            <div className="member-account-menu-email">{member.email}</div>
          </div>
          <Link to="/my-bookings" className="member-account-menu-item" onClick={() => setOpen(false)}>
            📅 {c.myBookings}
          </Link>
          <button type="button" className="member-account-menu-item" onClick={() => { setEditOpen(true); setOpen(false); }}>
            {c.editProfile}
          </button>
          <button type="button" className="member-account-menu-item" onClick={handleLogout}>
            {c.logout}
          </button>
        </div>
      )}

      {editOpen && (
        <div className="member-edit-overlay" onClick={() => setEditOpen(false)}>
          <div className="member-edit-modal" onClick={e => e.stopPropagation()}>
            <h3>{c.editProfile}</h3>
            <form onSubmit={handleSaveProfile}>
              <div className="form-group">
                <label>{c.name}</label>
                <input type="text" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>{c.email}</label>
                <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>{c.avatar}</label>
                <div className="form-image-row">
                  <input
                    type="text"
                    placeholder="https://..."
                    value={editForm.avatar}
                    onChange={e => setEditForm(f => ({ ...f, avatar: e.target.value }))}
                  />
                  <label className="btn-upload-small">
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) {
                          const r = new FileReader()
                          r.onload = () => setEditForm(prev => ({ ...prev, avatar: r.result }))
                          r.readAsDataURL(f)
                        }
                        e.target.value = ''
                      }}
                    />
                    {language === 'en' ? 'Upload' : 'رفع'}
                  </label>
                </div>
                {editForm.avatar && <img src={editForm.avatar} alt="" className="member-edit-avatar-preview" />}
              </div>
              <div className="member-edit-actions">
                <button type="button" className="btn-secondary" onClick={() => setEditOpen(false)}>{c.cancel}</button>
                <button type="submit" className="btn-primary">{c.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default MemberAccountDropdown
