import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import './common.css'
import './AllClubsDashboard.css'
import { useAdminPanel } from '../AdminPanelContext'
import { getAllMembersFromStorage, getClubMembersFromStorage } from '../../storage/adminStorage'

const t = (en, ar, lang) => (lang === 'ar' ? ar : en)

const getDataSourceLabel = () => {
  if (typeof window === 'undefined') return { en: '—', ar: '—' }
  const h = (window.location?.hostname || '').toLowerCase()
  if (h.includes('playtix.app')) return { en: 'PlayTix', ar: 'بلايتكس' }
  if (h.includes('vercel.app')) return { en: 'Cloud', ar: 'سحابي' }
  if (h.includes('localhost') || h === '127.0.0.1') return { en: 'Local', ar: 'محلي' }
  return { en: 'Cloud', ar: 'سحابي' }
}

function Modal({ title, onClose, children }) {
  return (
    <div className="acd-modal-backdrop" onClick={onClose} role="presentation">
      <div className="acd-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="acd-modal-title">
        <div className="acd-modal-header">
          <h3 id="acd-modal-title">{title}</h3>
          <button type="button" className="acd-modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className="acd-modal-body">{children}</div>
      </div>
    </div>
  )
}

const AllClubsDashboard = () => {
  const { clubs = [], language = 'en', onUpdateClub, onApproveClub, onRejectClub, onRefresh, onDeleteClub, onPermanentlyDeleteClub } = useAdminPanel()
  const navigate = useNavigate()
  const dataSource = getDataSourceLabel()
  const [searchQuery, setSearchQuery] = useState('')
  const [viewingPending, setViewingPending] = useState(null)
  const [sortBy, setSortBy] = useState('name')
  const [sortOrder, setSortOrder] = useState('asc')
  const [deletingClubId, setDeletingClubId] = useState(null)

  const clubsList = Array.isArray(clubs) ? clubs : []
  const approvedClubs = useMemo(() => clubsList.filter(c => c.status !== 'pending'), [clubsList])
  const allMembers = useMemo(() => getAllMembersFromStorage(), [clubs])
  const pendingClubs = useMemo(() => clubsList.filter(c => c.status === 'pending'), [clubsList])

  const totalStats = useMemo(() => ({
    totalClubs: approvedClubs.length,
    totalMembers: allMembers.length,
    totalTournaments: approvedClubs.reduce((sum, club) => sum + (club.tournaments?.length || 0), 0),
    totalBookings: approvedClubs.reduce((sum, club) => sum + (club.bookings?.length || 0), 0),
    totalRevenue: approvedClubs.reduce((sum, club) =>
      sum + (club.accounting?.reduce((acc, item) => acc + (parseFloat(item.amount) || 0), 0) || 0), 0
    ),
    totalCourts: approvedClubs.reduce((sum, club) => sum + (club.courts?.length || 0), 0),
    activeClubs: approvedClubs.filter(club =>
      getClubMembersFromStorage(club.id).length > 0 || (club.tournaments?.length || 0) > 0
    ).length,
  }), [approvedClubs, allMembers])

  const filteredAndSortedClubs = useMemo(() => {
    let filtered = approvedClubs.filter(club => {
      const q = searchQuery.toLowerCase()
      return (
        club.name?.toLowerCase().includes(q) ||
        club.nameAr?.toLowerCase().includes(q) ||
        club.address?.toLowerCase().includes(q) ||
        club.id?.toLowerCase().includes(q)
      )
    })
    filtered.sort((a, b) => {
      let aVal, bVal
      switch (sortBy) {
        case 'members': aVal = getClubMembersFromStorage(a.id).length; bVal = getClubMembersFromStorage(b.id).length; break
        case 'tournaments': aVal = a.tournaments?.length || 0; bVal = b.tournaments?.length || 0; break
        case 'revenue': aVal = a.accounting?.reduce((acc, i) => acc + (parseFloat(i.amount) || 0), 0) || 0; bVal = b.accounting?.reduce((acc, i) => acc + (parseFloat(i.amount) || 0), 0) || 0; break
        case 'created': aVal = new Date(a.createdAt || 0).getTime(); bVal = new Date(b.createdAt || 0).getTime(); break
        default: aVal = a.name?.toLowerCase() || ''; bVal = b.name?.toLowerCase() || ''
      }
      const cmp = aVal > bVal ? 1 : aVal < bVal ? -1 : 0
      return sortOrder === 'asc' ? cmp : -cmp
    })
    return filtered
  }, [approvedClubs, searchQuery, sortBy, sortOrder])

  const handleSort = (newSortBy) => {
    if (sortBy === newSortBy) setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    else { setSortBy(newSortBy); setSortOrder('asc') }
  }

  const handleDeleteClub = async (clubId) => {
    if (!clubId || !onDeleteClub) return
    const club = approvedClubs.find(c => c.id === clubId)
    const name = club ? (language === 'ar' ? (club.nameAr || club.name) : club.name) : ''
    if (!window.confirm(t(`Delete club "${name}"? The club will be removed from the list. You can undo by re-adding.`, `حذف النادي "${name}"؟ سيُزال النادي من القائمة. يمكن الاسترجاع بإعادة الإضافة.`, language))) return
    setDeletingClubId(clubId)
    try {
      await onDeleteClub(clubId)
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clubs-synced'))
    } catch (err) {
      console.error('Delete club failed:', err)
    } finally {
      setDeletingClubId(null)
    }
  }

  const handlePermanentlyDeleteClub = async (clubId) => {
    if (!clubId || !onPermanentlyDeleteClub) return
    const club = approvedClubs.find(c => c.id === clubId)
    const name = club ? (language === 'ar' ? (club.nameAr || club.name) : club.name) : ''
    if (!window.confirm(t(`Permanently delete "${name}"? This will remove all data from the database. This action cannot be undone!`, `حذف "${name}" نهائياً؟ سيُزال كل البيانات من قاعدة البيانات. لا يمكن التراجع!`, language))) return
    setDeletingClubId(clubId)
    try {
      await onPermanentlyDeleteClub(clubId)
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clubs-synced'))
    } catch (err) {
      console.error('Permanent delete failed:', err)
    } finally {
      setDeletingClubId(null)
    }
  }

  const handleAddClubAdmin = (club) => {
    navigate('/admin/admin-users', { state: { activeTab: 'clubs', selectedClubId: club.id, showAddClubUser: true } })
  }

  const getClubRevenue = (club) =>
    club.accounting?.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) || 0

  const formatDate = (dateString) => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  return (
    <div className="main-admin-page">
      <div className="acd-page">
        <header className="acd-header">
          <div className="acd-header-content">
            <h1 className="acd-title">{t('All Clubs Dashboard', 'لوحة جميع الأندية', language)}</h1>
            <p className="acd-subtitle">{t('Overview and statistics for all clubs', 'نظرة عامة وإحصائيات لجميع الأندية', language)}</p>
          </div>
          <div className="acd-actions">
            {onRefresh && (
              <button type="button" className="acd-btn acd-btn--secondary" onClick={() => onRefresh()} title={t('Refresh from server', 'تحديث من الخادم', language)}>
                ↻ {t('Refresh', 'تحديث', language)}
              </button>
            )}
            <button type="button" className="acd-btn acd-btn--primary" onClick={() => navigate('/admin/manage-clubs')}>
              + {t('Add Club', 'إضافة نادٍ', language)}
            </button>
          </div>
        </header>

        {/* Stats */}
        <div className="acd-stats-grid">
          <div className="acd-stat acd-stat--primary">
            <span className="acd-stat-icon">🏢</span>
            <div className="acd-stat-body">
              <span className="acd-stat-value">{totalStats.totalClubs}</span>
              <span className="acd-stat-label">{t('Clubs', 'الأندية', language)}</span>
              <span className="acd-stat-sublabel">{totalStats.activeClubs} {t('active', 'نشطة', language)}</span>
            </div>
          </div>
          <div className="acd-stat acd-stat--success">
            <span className="acd-stat-icon">👥</span>
            <div className="acd-stat-body">
              <span className="acd-stat-value">{totalStats.totalMembers}</span>
              <span className="acd-stat-label">{t('Members', 'الأعضاء', language)}</span>
              <span className="acd-stat-sublabel">{language === 'ar' ? dataSource.ar : dataSource.en}</span>
            </div>
          </div>
          <div className="acd-stat acd-stat--info">
            <span className="acd-stat-icon">🏆</span>
            <div className="acd-stat-body">
              <span className="acd-stat-value">{totalStats.totalTournaments}</span>
              <span className="acd-stat-label">{t('Tournaments', 'البطولات', language)}</span>
              <span className="acd-stat-sublabel">{totalStats.totalClubs > 0 ? Math.round(totalStats.totalTournaments / totalStats.totalClubs) : 0} {t('avg', 'متوسط', language)}</span>
            </div>
          </div>
          <div className="acd-stat acd-stat--warning">
            <span className="acd-stat-icon">🏟️</span>
            <div className="acd-stat-body">
              <span className="acd-stat-value">{totalStats.totalCourts}</span>
              <span className="acd-stat-label">{t('Courts', 'الملاعب', language)}</span>
              <span className="acd-stat-sublabel">{totalStats.totalClubs > 0 ? (totalStats.totalCourts / totalStats.totalClubs).toFixed(1) : 0} {t('avg', 'متوسط', language)}</span>
            </div>
          </div>
          <div className="acd-stat acd-stat--revenue">
            <span className="acd-stat-icon">💰</span>
            <div className="acd-stat-body">
              <span className="acd-stat-value">{totalStats.totalRevenue.toFixed(0)}</span>
              <span className="acd-stat-label">SAR</span>
              <span className="acd-stat-sublabel">{t('Revenue', 'الإيرادات', language)}</span>
            </div>
          </div>
          <div className="acd-stat acd-stat--secondary">
            <span className="acd-stat-icon">📅</span>
            <div className="acd-stat-body">
              <span className="acd-stat-value">{totalStats.totalBookings}</span>
              <span className="acd-stat-label">{t('Bookings', 'الحجوزات', language)}</span>
              <span className="acd-stat-sublabel">{t('All time', 'الكل', language)}</span>
            </div>
          </div>
        </div>

        {/* Pending Clubs */}
        {pendingClubs.length > 0 && (
          <section className="acd-pending">
            <h3 className="acd-pending-title">{t('Pending registrations', 'طلبات قيد المراجعة', language)} ({pendingClubs.length})</h3>
            <div className="acd-pending-grid">
              {pendingClubs.map(club => (
                <div key={club.id} className="acd-pending-card">
                  <div className="acd-pending-info">
                    <strong>{language === 'ar' && club.nameAr ? club.nameAr : club.name}</strong>
                    <span>{club.adminEmail || club.email}</span>
                    {club.commercialRegister && <span>{t('CR', 'س.ت', language)}: {club.commercialRegister}</span>}
                  </div>
                  <div className="acd-pending-actions">
                    <button type="button" className="acd-btn acd-btn--small acd-btn--secondary" onClick={() => setViewingPending(club)}>
                      {t('View', 'عرض', language)}
                    </button>
                    {onApproveClub && (
                      <button type="button" className="acd-btn acd-btn--small acd-btn--primary" onClick={() => { onApproveClub(club.id); setViewingPending(null); }}>
                        {t('Approve', 'موافقة', language)}
                      </button>
                    )}
                    {onRejectClub && (
                      <button type="button" className="acd-btn acd-btn--small acd-btn--danger" onClick={() => window.confirm(t('Reject?', 'رفض؟', language)) && onRejectClub(club.id)}>
                        {t('Reject', 'رفض', language)}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Search & Sort */}
        <div className="acd-controls">
          <div className="acd-search-wrap">
            <input
              type="text"
              className="acd-search-input"
              placeholder={t('Search clubs...', 'البحث في الأندية...', language)}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              aria-label={t('Search', 'بحث', language)}
            />
            <span className="acd-search-icon">🔍</span>
          </div>
          <div className="acd-sort-wrap">
            <label className="acd-sort-label">{t('Sort:', 'ترتيب:', language)}</label>
            <select value={sortBy} onChange={e => handleSort(e.target.value)} className="acd-sort-select" aria-label={t('Sort by', 'ترتيب حسب', language)}>
              <option value="name">{t('Name', 'الاسم', language)}</option>
              <option value="members">{t('Members', 'الأعضاء', language)}</option>
              <option value="tournaments">{t('Tournaments', 'البطولات', language)}</option>
              <option value="revenue">{t('Revenue', 'الإيرادات', language)}</option>
              <option value="created">{t('Created', 'تاريخ الإنشاء', language)}</option>
            </select>
            <button type="button" className="acd-sort-order" onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')} title={sortOrder === 'asc' ? '↑' : '↓'}>
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>

        {/* Clubs Grid */}
        <section className="acd-clubs-section">
          <h3 className="acd-section-title">
            {t('All Clubs', 'جميع الأندية', language)} ({filteredAndSortedClubs.length})
            {searchQuery && <span className="acd-search-hint"> — {t('Search results', 'نتائج البحث', language)}</span>}
          </h3>

          {approvedClubs.length === 0 && pendingClubs.length === 0 ? (
            <div className="acd-empty">
              <span className="acd-empty-icon">🏢</span>
              <h4>{t('No clubs yet', 'لا توجد أندية بعد', language)}</h4>
              <p>{t('Create your first club to get started.', 'أنشئ ناديك الأول للبدء.', language)}</p>
              <button type="button" className="acd-btn acd-btn--primary" onClick={() => navigate('/admin/manage-clubs')}>
                + {t('Create First Club', 'إنشاء أول نادٍ', language)}
              </button>
            </div>
          ) : filteredAndSortedClubs.length === 0 ? (
            <div className="acd-empty">
              <span className="acd-empty-icon">🔍</span>
              <h4>{t('No results', 'لا توجد نتائج', language)}</h4>
              <p>{t('Try a different search.', 'جرب بحثاً آخر.', language)}</p>
              <button type="button" className="acd-btn acd-btn--secondary" onClick={() => setSearchQuery('')}>
                {t('Clear', 'مسح', language)}
              </button>
            </div>
          ) : (
            <div className="acd-clubs-grid">
              {filteredAndSortedClubs.map(club => {
                const clubRevenue = getClubRevenue(club)
                const memberCount = getClubMembersFromStorage(club.id).length
                const hasPlaytomic = !!(club.playtomicVenueId && club.playtomicApiKey)
                return (
                  <div key={club.id} className="acd-club-card">
                    <div className="acd-club-main">
                      <div className="acd-club-logo">
                        {club.logo ? <img src={club.logo} alt="" /> : <span>◇</span>}
                      </div>
                      <div className="acd-club-info">
                        <h4 className="acd-club-name">{club.name || t('Unnamed', 'بدون اسم', language)}</h4>
                        {club.nameAr && <p className="acd-club-name-ar">{club.nameAr}</p>}
                        {club.address && <p className="acd-club-address">{club.address}</p>}
                        <div className="acd-club-badges">
                          {hasPlaytomic && <span className="acd-badge acd-badge--playtomic">P</span>}
                          {onUpdateClub && (
                            <label className="acd-store-toggle" title={club.storeEnabled ? 'Store on' : 'Store off'}>
                              🛒
                              <input type="checkbox" checked={!!club.storeEnabled} onChange={() => onUpdateClub(club.id, { storeEnabled: !club.storeEnabled })} />
                              <span>{club.storeEnabled ? t('On', 'تفعيل', language) : t('Off', 'إيقاف', language)}</span>
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="acd-club-stats">
                      <span><strong>{club.courts?.length || 0}</strong> {t('courts', 'ملاعب', language)}</span>
                      <span><strong>{memberCount}</strong> {t('members', 'أعضاء', language)}</span>
                      <span><strong>{club.tournaments?.length || 0}</strong> {t('tournaments', 'بطولات', language)}</span>
                      <span><strong>{clubRevenue.toFixed(0)}</strong> SAR</span>
                    </div>
                    {club.createdAt && (
                      <p className="acd-club-meta">{t('Created', 'تاريخ الإنشاء', language)}: {formatDate(club.createdAt)}</p>
                    )}
                    <div className="acd-club-actions">
                      <button type="button" className="acd-btn-icon" onClick={() => navigate(`/clubs/${club.id}`)} title={t('Club page', 'صفحة النادي', language)}>◉</button>
                      <button type="button" className="acd-btn-icon" onClick={() => navigate(`/admin/club/${club.id}`)} title={t('Admin', 'إدارة', language)}>⚙</button>
                      <button type="button" className="acd-btn-icon" onClick={() => navigate('/admin/manage-clubs')} title={t('Edit', 'تعديل', language)}>✎</button>
                      <button type="button" className="acd-btn acd-btn--small acd-btn--primary" onClick={() => handleAddClubAdmin(club)}>
                        + {t('Add Club Admin', 'إضافة مدير للنادي', language)}
                      </button>
                      <button
                        type="button"
                        className="acd-btn acd-btn--small acd-btn--danger-outline"
                        onClick={() => handleDeleteClub(club.id)}
                        disabled={deletingClubId === club.id}
                        title={t('Delete club (removes from list)', 'حذف النادي (يزيله من القائمة)', language)}
                      >
                        {deletingClubId === club.id ? '⋯' : '🗑'} {t('Delete', 'حذف', language)}
                      </button>
                      <button
                        type="button"
                        className="acd-btn acd-btn--small acd-btn--danger-solid"
                        onClick={() => handlePermanentlyDeleteClub(club.id)}
                        disabled={deletingClubId === club.id}
                        title={t('Permanently delete from database. Cannot be undone!', 'حذف نهائي من قاعدة البيانات. لا يمكن التراجع!', language)}
                      >
                        {deletingClubId === club.id ? '⋯' : '⚠️'} {t('Permanent Delete', 'حذف نهائي', language)}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Pending Details Modal */}
        {viewingPending && (
          <Modal title={t('Registration details', 'بيانات التسجيل', language)} onClose={() => setViewingPending(null)}>
            <div className="acd-modal-details">
              <div className="acd-detail-row"><span>{t('Name (EN)', 'الاسم (إنجليزي)', language)}</span><span>{viewingPending.name || '—'}</span></div>
              <div className="acd-detail-row"><span>{t('Name (AR)', 'الاسم (عربي)', language)}</span><span>{viewingPending.nameAr || '—'}</span></div>
              <div className="acd-detail-row"><span>{t('Admin email', 'البريد الإداري', language)}</span><span>{viewingPending.adminEmail || viewingPending.email || '—'}</span></div>
              <div className="acd-detail-row"><span>{t('Email', 'البريد', language)}</span><span>{viewingPending.email || '—'}</span></div>
              <div className="acd-detail-row"><span>{t('Phone', 'الهاتف', language)}</span><span>{viewingPending.phone || '—'}</span></div>
              <div className="acd-detail-row"><span>{t('CR', 'السجل التجاري', language)}</span><span>{viewingPending.commercialRegister || '—'}</span></div>
              <div className="acd-detail-row"><span>{t('Address', 'العنوان', language)}</span><span>{viewingPending.address || viewingPending.location?.address || '—'}</span></div>
              {viewingPending.location?.lat != null && (
                <div className="acd-detail-row"><span>{t('Coordinates', 'الإحداثيات', language)}</span><span>{viewingPending.location.lat?.toFixed(5)}, {viewingPending.location.lng?.toFixed(5)}</span></div>
              )}
              <div className="acd-detail-row"><span>{t('Submitted', 'تاريخ التقديم', language)}</span><span>{formatDate(viewingPending.createdAt)}</span></div>
              {viewingPending.commercialRegisterImage && (
                <div className="acd-detail-full">
                  <span>{t('CR document', 'صورة السجل', language)}</span>
                  <img src={viewingPending.commercialRegisterImage} alt="CR" className="acd-cr-img" />
                </div>
              )}
            </div>
            <div className="acd-modal-footer">
              <button type="button" className="acd-btn acd-btn--secondary" onClick={() => setViewingPending(null)}>{t('Close', 'إغلاق', language)}</button>
              {onRejectClub && (
                <button type="button" className="acd-btn acd-btn--danger" onClick={() => { if (window.confirm(t('Reject?', 'رفض؟', language))) { onRejectClub(viewingPending.id); setViewingPending(null); } }}>
                  {t('Reject', 'رفض', language)}
                </button>
              )}
              {onApproveClub && (
                <button type="button" className="acd-btn acd-btn--primary" onClick={() => { onApproveClub(viewingPending.id); setViewingPending(null); }}>
                  {t('Approve', 'موافقة', language)}
                </button>
              )}
            </div>
          </Modal>
        )}
      </div>
    </div>
  )
}

export default AllClubsDashboard
