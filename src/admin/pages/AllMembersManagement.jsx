import React, { useState, useMemo, useEffect } from 'react'
import './AllMembersManagement.css'
import './common.css'
import { useAdminPanel } from '../AdminPanelContext'
import {
  getAllMembersFromStorage,
  addMemberToClub,
  upsertMember,
  deleteMember,
  getClubMembersFromStorage,
} from '../../storage/adminStorage'
import { getPlatformAdminSession, hasPlatformPermission } from '../../storage/platformAdminAuth'

const t = (en, ar, lang) => (lang === 'ar' ? ar : en)

function Modal({ title, onClose, children }) {
  return (
    <div className="amm-modal-backdrop" onClick={onClose} role="presentation">
      <div className="amm-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="amm-modal-title">
        <div className="amm-modal-header">
          <h3 id="amm-modal-title">{title}</h3>
          <button type="button" className="amm-modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className="amm-modal-body">{children}</div>
      </div>
    </div>
  )
}

const emptyEditForm = { name: '', email: '', mobile: '', password: '' }

export default function AllMembersManagement() {
  const { clubs = [], language = 'en' } = useAdminPanel()
  const session = getPlatformAdminSession()
  const [searchQuery, setSearchQuery] = useState('')
  const [membersRefresh, setMembersRefresh] = useState(0)
  const [editingMember, setEditingMember] = useState(null)
  const [editForm, setEditForm] = useState(emptyEditForm)
  const [addToClubMember, setAddToClubMember] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState(emptyEditForm)

  const approvedClubs = useMemo(() => (Array.isArray(clubs) ? clubs : []).filter(c => c.status !== 'pending' && c.status !== 'rejected'), [clubs])
  const allMembers = useMemo(() => getAllMembersFromStorage(), [clubs, membersRefresh])

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return allMembers
    const q = searchQuery.toLowerCase().trim()
    return allMembers.filter(m =>
      m.name?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q) ||
      (m.mobile || m.phone || '')?.toLowerCase().includes(q)
    )
  }, [allMembers, searchQuery])

  const getClubName = (clubId) => {
    const club = approvedClubs.find(c => c.id === clubId)
    return club ? (language === 'ar' && club.nameAr ? club.nameAr : club.name) : clubId
  }

  const handleEditMember = (member) => {
    setEditingMember(member)
    setEditForm({
      name: member.name || '',
      email: member.email || '',
      mobile: member.mobile || member.phone || '',
      password: '',
    })
    setAddToClubMember(null)
  }

  const handleSaveMemberEdit = async (e) => {
    e.preventDefault()
    if (!editingMember) return
    const updated = {
      ...editingMember,
      name: editForm.name.trim(),
      email: editForm.email.trim(),
      mobile: editForm.mobile.trim(),
    }
    if (editForm.password && editForm.password.length >= 6) updated.password = editForm.password
    const result = await upsertMember(updated)
    if (result) {
      setMembersRefresh(k => k + 1)
      setEditingMember(null)
      setEditForm(emptyEditForm)
      window.dispatchEvent(new CustomEvent('clubs-synced'))
    }
  }

  const handleDeleteMember = async (member) => {
    if (!window.confirm(t('Permanently delete this member?', 'حذف هذا العضو نهائياً؟', language))) return
    if (await deleteMember(member.id)) {
      setMembersRefresh(k => k + 1)
      setEditingMember(null)
      setAddToClubMember(null)
      window.dispatchEvent(new CustomEvent('clubs-synced'))
    }
  }

  const handleAddMemberToClub = async (memberId, clubId) => {
    const ok = await addMemberToClub(memberId, clubId)
    if (ok) {
      setMembersRefresh(k => k + 1)
      setAddToClubMember(null)
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
      clubIds: [],
      role: 'member',
      createdAt: new Date().toISOString()
    }
    const result = await upsertMember(newMember)
    if (result) {
      setMembersRefresh(k => k + 1)
      setShowAddModal(false)
      setAddForm(emptyEditForm)
      window.dispatchEvent(new CustomEvent('clubs-synced'))
    }
  }

  if (!hasPlatformPermission(session, 'all-members')) {
    return (
      <div className="main-admin-page">
        <div className="amm-empty amm-empty-error">
          <span className="amm-empty-icon">🔒</span>
          <h3>{t('Access denied', 'غير مصرح', language)}</h3>
          <p>{t('You do not have permission to view all members.', 'ليس لديك صلاحية عرض جميع الأعضاء.', language)}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="main-admin-page">
      <div className="amm-page">
        <header className="amm-header">
          <div className="amm-header-content">
            <h1 className="amm-title">{t('All Members', 'أعضاء كل الأندية', language)}</h1>
            <p className="amm-subtitle">{t('View and manage members across all clubs', 'عرض وإدارة الأعضاء في جميع الأندية', language)}</p>
          </div>
          <div className="amm-search-wrap">
            <input
              type="text"
              className="amm-search-input"
              placeholder={t('Search by name, email, phone...', 'البحث بالاسم، البريد، الهاتف...', language)}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              aria-label={t('Search members', 'البحث في الأعضاء', language)}
            />
            <span className="amm-search-icon" aria-hidden>🔍</span>
          </div>
          <button type="button" className="amm-btn amm-btn--primary" onClick={() => setShowAddModal(true)}>
            + {t('Add Member', 'إضافة عضو', language)}
          </button>
        </header>

        {allMembers.length > 0 && (
          <div className="amm-stats">
            <div className="amm-stat-card">
              <span className="amm-stat-icon">👥</span>
              <div className="amm-stat-content">
                <span className="amm-stat-value">{allMembers.length}</span>
                <span className="amm-stat-label">{t('Total Members', 'إجمالي الأعضاء', language)}</span>
              </div>
            </div>
          </div>
        )}

        {filteredMembers.length === 0 ? (
          <div className="amm-empty">
            <span className="amm-empty-icon">👥</span>
            <h3>
              {searchQuery.trim()
                ? t('No members found', 'لا توجد نتائج', language)
                : t('No members yet', 'لا يوجد أعضاء بعد', language)}
            </h3>
            <p>
              {searchQuery.trim()
                ? t('Try a different search term.', 'جرب مصطلح بحث آخر.', language)
                : t('Members will appear here when they register on the platform.', 'ستظهر الأعضاء هنا عند التسجيل في المنصة.', language)}
            </p>
          </div>
        ) : (
          <div className="amm-grid">
            {filteredMembers.map(member => {
              const clubsJoined = (member.clubIds || []).filter(id => approvedClubs.some(c => c.id === id))
              const clubsNotJoined = approvedClubs.filter(c => !(member.clubIds || []).includes(c.id))
              return (
                <div key={member.id} className="amm-card">
                  <div className="amm-card-main">
                    <div className="amm-card-avatar">
                      {member.avatar ? (
                        <img src={member.avatar} alt="" />
                      ) : (
                        <span className="amm-card-initial">{(member.name || '?')[0].toUpperCase()}</span>
                      )}
                    </div>
                    <div className="amm-card-info">
                      <h3 className="amm-card-name">{member.name || t('Unnamed', 'بدون اسم', language)}</h3>
                      {member.email && <p className="amm-card-email">{member.email}</p>}
                      {(member.mobile || member.phone) && (
                        <p className="amm-card-phone">{member.mobile || member.phone}</p>
                      )}
                      <div className="amm-card-clubs">
                        {clubsJoined.length === 0 ? (
                          <span className="amm-no-clubs">{t('No clubs', 'لا نوادي', language)}</span>
                        ) : (
                          clubsJoined.map(clubId => (
                            <span key={clubId} className="amm-club-badge">
                              {getClubName(clubId)}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="amm-card-actions">
                    {clubsNotJoined.length > 0 ? (
                      addToClubMember?.id === member.id ? (
                        <div className="amm-add-dropdown">
                          {clubsNotJoined.map(club => (
                            <button
                              key={club.id}
                              type="button"
                              className="amm-btn amm-btn--small amm-btn--secondary"
                              onClick={() => handleAddMemberToClub(member.id, club.id)}
                            >
                              + {getClubName(club.id)}
                            </button>
                          ))}
                          <button type="button" className="amm-btn amm-btn--small amm-btn--secondary" onClick={() => setAddToClubMember(null)}>
                            {t('Cancel', 'إلغاء', language)}
                          </button>
                        </div>
                      ) : (
                        <button type="button" className="amm-btn amm-btn--small amm-btn--primary" onClick={() => setAddToClubMember(member)}>
                          {t('Add to club', 'إضافة لنادي', language)}
                        </button>
                      )
                    ) : (
                      <span className="amm-in-all">{t('In all clubs', 'في جميع الأندية', language)}</span>
                    )}
                    <div className="amm-action-btns">
                      <button type="button" className="amm-btn-icon" onClick={() => handleEditMember(member)} title={t('Edit', 'تعديل', language)}>✎</button>
                      <button type="button" className="amm-btn-icon amm-btn-icon--danger" onClick={() => handleDeleteMember(member)} title={t('Delete', 'حذف', language)}>×</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {showAddModal && (
          <Modal title={t('Add Member', 'إضافة عضو', language)} onClose={() => { setShowAddModal(false); setAddForm(emptyEditForm) }}>
            <form className="amm-form" onSubmit={handleAddNewMember}>
              <div className="amm-form-group">
                <label>{t('Name', 'الاسم', language)} *</label>
                <input type="text" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} required />
              </div>
              <div className="amm-form-group">
                <label>{t('Email', 'البريد', language)} *</label>
                <input type="email" value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} required />
              </div>
              <div className="amm-form-group">
                <label>{t('Phone', 'الهاتف', language)}</label>
                <input type="text" value={addForm.mobile} onChange={e => setAddForm({ ...addForm, mobile: e.target.value })} placeholder="+966..." />
              </div>
              <div className="amm-form-group">
                <label>{t('Password', 'كلمة المرور', language)}</label>
                <input type="password" value={addForm.password} onChange={e => setAddForm({ ...addForm, password: e.target.value })} placeholder="••••••••" minLength={6} />
              </div>
              <div className="amm-form-actions">
                <button type="button" className="amm-btn amm-btn--secondary" onClick={() => { setShowAddModal(false); setAddForm(emptyEditForm) }}>
                  {t('Cancel', 'إلغاء', language)}
                </button>
                <button type="submit" className="amm-btn amm-btn--primary">{t('Save', 'حفظ', language)}</button>
              </div>
            </form>
          </Modal>
        )}

        {editingMember && (
          <Modal title={t('Edit Member', 'تعديل العضو', language)} onClose={() => { setEditingMember(null); setEditForm(emptyEditForm) }}>
            <form className="amm-form" onSubmit={handleSaveMemberEdit}>
              <div className="amm-form-group">
                <label>{t('Name', 'الاسم', language)} *</label>
                <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
              </div>
              <div className="amm-form-group">
                <label>{t('Email', 'البريد', language)}</label>
                <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
              <div className="amm-form-group">
                <label>{t('Phone', 'الهاتف', language)}</label>
                <input type="text" value={editForm.mobile} onChange={e => setEditForm({ ...editForm, mobile: e.target.value })} placeholder="+966..." />
              </div>
              <div className="amm-form-group">
                <label>{t('New password (leave blank to keep)', 'كلمة مرور جديدة (اتركه فارغاً للإبقاء)', language)}</label>
                <input type="password" value={editForm.password} onChange={e => setEditForm({ ...editForm, password: e.target.value })} placeholder="••••••••" />
              </div>
              <div className="amm-form-actions">
                <button type="button" className="amm-btn amm-btn--secondary" onClick={() => { setEditingMember(null); setEditForm(emptyEditForm) }}>
                  {t('Cancel', 'إلغاء', language)}
                </button>
                <button type="submit" className="amm-btn amm-btn--primary">{t('Save', 'حفظ', language)}</button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    </div>
  )
}
