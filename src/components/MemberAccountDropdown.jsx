import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { updatePlatformMember, logoutPlatformUser } from '../storage/platformAuth'
import { changeMemberPassword, sendPhoneChangeCode, verifyPhoneChange } from '../api/dbClient'
import './MemberAccountDropdown.css'

const MemberAccountDropdown = ({ member, onUpdate, language = 'en', children, className = '' }) => {
  const [open, setOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', email: '', avatar: '', mobile: '' })
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [changePasswordForm, setChangePasswordForm] = useState({ current: '', new: '', confirm: '' })
  const [changePasswordError, setChangePasswordError] = useState('')
  const [changePasswordSuccess, setChangePasswordSuccess] = useState(false)
  const [changePasswordSubmitting, setChangePasswordSubmitting] = useState(false)
  const [phoneChangeStep, setPhoneChangeStep] = useState('idle') // idle | send | verify | done
  const [phoneChangeNewPhone, setPhoneChangeNewPhone] = useState('')
  const [phoneChangeCode, setPhoneChangeCode] = useState('')
  const [phoneChangeError, setPhoneChangeError] = useState('')
  const [phoneChangeSubmitting, setPhoneChangeSubmitting] = useState(false)

  useEffect(() => {
    if (member) setEditForm({ name: member.name || '', email: member.email || '', avatar: member.avatar || '', mobile: member.mobile || member.phone || '' })
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
    const currentMobile = (member.mobile || member.phone || '').toString().trim()
    const newMobile = (editForm.mobile || '').toString().replace(/\s/g, '')
    if (newMobile && newMobile.replace(/\D/g, '').length >= 9 && newMobile !== currentMobile) {
      setPhoneChangeStep('send')
      setPhoneChangeNewPhone(newMobile)
      setPhoneChangeError('')
      return
    }
    await updatePlatformMember(member.id, { name: editForm.name.trim(), email: editForm.email.trim(), avatar: editForm.avatar || undefined, mobile: newMobile || undefined })
    setEditOpen(false)
    setPhoneChangeStep('idle')
    if (onUpdate) onUpdate()
  }

  const handleSendPhoneCode = async () => {
    if (!member?.id || !phoneChangeNewPhone) return
    setPhoneChangeError('')
    setPhoneChangeSubmitting(true)
    try {
      await sendPhoneChangeCode(member.id, phoneChangeNewPhone)
      setPhoneChangeStep('verify')
    } catch (e) {
      setPhoneChangeError(e?.message || (language === 'ar' ? 'فشل إرسال الكود' : 'Failed to send code'))
    } finally {
      setPhoneChangeSubmitting(false)
    }
  }

  const handleVerifyPhoneChange = async () => {
    if (!member?.id || !phoneChangeNewPhone || !phoneChangeCode) return
    setPhoneChangeError('')
    setPhoneChangeSubmitting(true)
    try {
      await verifyPhoneChange(member.id, phoneChangeNewPhone, phoneChangeCode)
      await updatePlatformMember(member.id, {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        avatar: editForm.avatar || undefined,
        mobile: phoneChangeNewPhone
      })
      setPhoneChangeStep('done')
      setEditForm(f => ({ ...f, mobile: phoneChangeNewPhone }))
      if (onUpdate) onUpdate()
    } catch (e) {
      setPhoneChangeError(e?.message || (language === 'ar' ? 'كود غير صحيح' : 'Invalid code'))
    } finally {
      setPhoneChangeSubmitting(false)
    }
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
    en: { editProfile: 'Edit profile', logout: 'Logout', myAccount: 'My account', myBookings: 'My Bookings', myFavorites: 'My favorites', save: 'Save', cancel: 'Cancel', name: 'Name', email: 'Email', mobile: 'Phone number', avatar: 'Profile photo (URL or upload)', changePassword: 'Change password', currentPassword: 'Current password', newPassword: 'New password', confirmPassword: 'Confirm new password', passwordMinLength: 'At least 6 characters', passwordsDoNotMatch: 'Passwords do not match', passwordChanged: 'Password changed successfully.', sendCode: 'Send verification code', codeSent: 'Code sent to email/WhatsApp/SMS', enterCode: 'Enter 4-digit code', verifyAndSave: 'Verify and save', phoneChanged: 'Phone number updated successfully.' },
    ar: { editProfile: 'تعديل الحساب', logout: 'تسجيل الخروج', myAccount: 'حسابي', myBookings: 'حجوزاتي', myFavorites: 'المفضلة', save: 'حفظ', cancel: 'إلغاء', name: 'الاسم', email: 'البريد', mobile: 'رقم الجوال', avatar: 'صورة الملف الشخصي (رابط أو رفع)', changePassword: 'تغيير كلمة المرور', currentPassword: 'كلمة المرور الحالية', newPassword: 'كلمة المرور الجديدة', confirmPassword: 'تأكيد كلمة المرور الجديدة', passwordMinLength: '6 أحرف على الأقل', passwordsDoNotMatch: 'كلمتا المرور غير متطابقتين', passwordChanged: 'تم تغيير كلمة المرور بنجاح.', sendCode: 'إرسال كود التحقق', codeSent: 'تم إرسال الكود إلى البريد/واتساب/رسالة', enterCode: 'أدخل الكود المكون من 4 أرقام', verifyAndSave: 'تحقق واحفظ', phoneChanged: 'تم تحديث رقم الجوال بنجاح.' }
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
          <Link to="/my-favorites" className="member-account-menu-item" onClick={() => setOpen(false)}>
            ★ {c.myFavorites}
          </Link>
          <button type="button" className="member-account-menu-item" onClick={() => { setEditOpen(true); setOpen(false); setPhoneChangeStep('idle'); }}>
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
        <div className="member-edit-overlay" onClick={() => { setEditOpen(false); setPhoneChangeStep('idle'); setPhoneChangeError(''); }}>
          <div className="member-edit-modal" onClick={e => e.stopPropagation()}>
            <h3>{c.editProfile}</h3>
            {(phoneChangeStep === 'send' || phoneChangeStep === 'verify') ? (
              <div className="member-edit-phone-change">
                <p className="member-edit-phone-hint">
                  {phoneChangeStep === 'send'
                    ? (language === 'ar' ? `سيتم إرسال كود التحقق إلى البريد أو الواتساب أو الرسالة للرقم: ${phoneChangeNewPhone}` : `Verification code will be sent to email, WhatsApp or SMS for: ${phoneChangeNewPhone}`)
                    : (language === 'ar' ? 'أدخل الكود الذي استلمته' : 'Enter the code you received')}
                </p>
                {phoneChangeStep === 'verify' && (
                  <div className="form-group">
                    <label>{c.enterCode}</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      value={phoneChangeCode}
                      onChange={e => setPhoneChangeCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="0000"
                    />
                  </div>
                )}
                {phoneChangeError && <p className="member-change-password-error">{phoneChangeError}</p>}
                <div className="member-edit-actions">
                  <button type="button" className="btn-secondary" onClick={() => { setPhoneChangeStep('idle'); setPhoneChangeError(''); }}>{c.cancel}</button>
                  {phoneChangeStep === 'send' ? (
                    <button type="button" className="btn-primary" onClick={handleSendPhoneCode} disabled={phoneChangeSubmitting}>
                      {phoneChangeSubmitting ? (language === 'ar' ? 'جاري الإرسال...' : 'Sending...') : c.sendCode}
                    </button>
                  ) : (
                    <button type="button" className="btn-primary" onClick={handleVerifyPhoneChange} disabled={phoneChangeSubmitting || phoneChangeCode.length !== 4}>
                      {phoneChangeSubmitting ? (language === 'ar' ? 'جاري التحقق...' : 'Verifying...') : c.verifyAndSave}
                    </button>
                  )}
                </div>
              </div>
            ) : phoneChangeStep === 'done' ? (
              <div>
                <p className="member-change-password-success">{c.phoneChanged}</p>
                <div className="member-edit-actions">
                  <button type="button" className="btn-primary" onClick={() => { setEditOpen(false); setPhoneChangeStep('idle'); if (onUpdate) onUpdate(); }}>{c.cancel}</button>
                </div>
              </div>
            ) : (
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
                <label>{c.mobile}</label>
                <input type="tel" value={editForm.mobile} onChange={e => setEditForm(f => ({ ...f, mobile: e.target.value }))} placeholder="+966..." inputMode="tel" />
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
            )}
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
