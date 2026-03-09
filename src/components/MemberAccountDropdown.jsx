import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { updatePlatformMember, logoutPlatformUser } from '../storage/platformAuth'
import { changeMemberPassword } from '../api/dbClient'
import './MemberAccountDropdown.css'

const MemberAccountDropdown = ({ member, onUpdate, language = 'en', children, className = '' }) => {
  const [open, setOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', email: '', avatar: '' })
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [changePasswordForm, setChangePasswordForm] = useState({ current: '', new: '', confirm: '' })
  const [changePasswordError, setChangePasswordError] = useState('')
  const [changePasswordSuccess, setChangePasswordSuccess] = useState(false)
  const [changePasswordSubmitting, setChangePasswordSubmitting] = useState(false)

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

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault()
    if (!member?.id) return
    setChangePasswordError('')
    const { current, new: newPw, confirm } = changePasswordForm
    if (!current.trim()) {
      setChangePasswordError(language === 'ar' ? 'أدخل كلمة المرور الحالية' : 'Enter current password')
      return
    }
    if (!newPw || newPw.length < 6) {
      setChangePasswordError(c.passwordMinLength)
      return
    }
    if (newPw !== confirm) {
      setChangePasswordError(c.passwordsDoNotMatch)
      return
    }
    setChangePasswordSubmitting(true)
    try {
      await changeMemberPassword(member.id, current, newPw)
      setChangePasswordSuccess(true)
      setChangePasswordForm({ current: '', new: '', confirm: '' })
      if (onUpdate) onUpdate()
    } catch (err) {
      setChangePasswordError(err?.message || (language === 'ar' ? 'فشل تغيير كلمة المرور' : 'Failed to change password'))
    } finally {
      setChangePasswordSubmitting(false)
    }
  }

  const t = {
    en: { editProfile: 'Edit profile', logout: 'Logout', myAccount: 'My account', myBookings: 'My Bookings', save: 'Save', cancel: 'Cancel', name: 'Name', email: 'Email', avatar: 'Profile photo (URL or upload)', changePassword: 'Change password', currentPassword: 'Current password', newPassword: 'New password', confirmPassword: 'Confirm new password', passwordMinLength: 'At least 6 characters', passwordsDoNotMatch: 'Passwords do not match', passwordChanged: 'Password changed successfully.' },
    ar: { editProfile: 'تعديل الحساب', logout: 'تسجيل الخروج', myAccount: 'حسابي', myBookings: 'حجوزاتي', save: 'حفظ', cancel: 'إلغاء', name: 'الاسم', email: 'البريد', avatar: 'صورة الملف الشخصي (رابط أو رفع)', changePassword: 'تغيير كلمة المرور', currentPassword: 'كلمة المرور الحالية', newPassword: 'كلمة المرور الجديدة', confirmPassword: 'تأكيد كلمة المرور الجديدة', passwordMinLength: '6 أحرف على الأقل', passwordsDoNotMatch: 'كلمتا المرور غير متطابقتين', passwordChanged: 'تم تغيير كلمة المرور بنجاح.' }
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
          <button type="button" className="member-account-menu-item" onClick={() => { setChangePasswordOpen(true); setChangePasswordForm({ current: '', new: '', confirm: '' }); setChangePasswordError(''); setChangePasswordSuccess(false); setOpen(false); }}>
            {c.changePassword}
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

      {changePasswordOpen && (
        <div className="member-edit-overlay" onClick={() => { setChangePasswordOpen(false); setChangePasswordError(''); setChangePasswordSuccess(false); }}>
          <div className="member-edit-modal" onClick={e => e.stopPropagation()}>
            <h3>{c.changePassword}</h3>
            {changePasswordSuccess ? (
              <>
                <p className="member-change-password-success">{c.passwordChanged}</p>
                <div className="member-edit-actions">
                  <button type="button" className="btn-primary" onClick={() => { setChangePasswordOpen(false); setChangePasswordSuccess(false); }}>{c.cancel}</button>
                </div>
              </>
            ) : (
              <form onSubmit={handleChangePasswordSubmit}>
                <div className="form-group">
                  <label>{c.currentPassword}</label>
                  <input type="password" autoComplete="current-password" value={changePasswordForm.current} onChange={e => setChangePasswordForm(f => ({ ...f, current: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>{c.newPassword}</label>
                  <input type="password" autoComplete="new-password" value={changePasswordForm.new} onChange={e => setChangePasswordForm(f => ({ ...f, new: e.target.value }))} placeholder={c.passwordMinLength} />
                </div>
                <div className="form-group">
                  <label>{c.confirmPassword}</label>
                  <input type="password" autoComplete="new-password" value={changePasswordForm.confirm} onChange={e => setChangePasswordForm(f => ({ ...f, confirm: e.target.value }))} />
                </div>
                {changePasswordError && <p className="member-change-password-error">{changePasswordError}</p>}
                <div className="member-edit-actions">
                  <button type="button" className="btn-secondary" onClick={() => { setChangePasswordOpen(false); setChangePasswordError(''); }}>{c.cancel}</button>
                  <button type="submit" className="btn-primary" disabled={changePasswordSubmitting}>{changePasswordSubmitting ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : c.save}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default MemberAccountDropdown
