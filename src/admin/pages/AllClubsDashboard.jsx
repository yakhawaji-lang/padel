import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import './common.css'
import './AllClubsDashboard.css'
import { getAllMembersFromStorage, addMemberToClubs } from '../../storage/adminStorage'

const t = (en, ar, lang) => (lang === 'ar' ? ar : en)

const AllClubsDashboard = ({ clubs, language = 'en', onUpdateClub, onApproveClub, onRejectClub }) => {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [viewingPending, setViewingPending] = useState(null)
  const [sortBy, setSortBy] = useState('name')
  const [sortOrder, setSortOrder] = useState('asc')
  const [addToClubMember, setAddToClubMember] = useState(null)
  const [memberSearch, setMemberSearch] = useState('')
  const [membersRefresh, setMembersRefresh] = useState(0)

  const approvedClubs = useMemo(() => clubs.filter(c => c.status !== 'pending'), [clubs])
  const allMembers = useMemo(() => getAllMembersFromStorage(), [clubs, membersRefresh])
  const pendingClubs = useMemo(() => clubs.filter(c => c.status === 'pending'), [clubs])

  // Calculate total statistics (approved only)
  const totalStats = useMemo(() => {
    return {
      totalClubs: approvedClubs.length,
      totalMembers: allMembers.length,
      totalTournaments: approvedClubs.reduce((sum, club) => sum + (club.tournaments?.length || 0), 0),
      totalBookings: approvedClubs.reduce((sum, club) => sum + (club.bookings?.length || 0), 0),
      totalRevenue: approvedClubs.reduce((sum, club) => 
        sum + (club.accounting?.reduce((acc, item) => acc + (parseFloat(item.amount) || 0), 0) || 0), 0
      ),
      totalCourts: approvedClubs.reduce((sum, club) => sum + (club.courts?.length || 0), 0),
      activeClubs: approvedClubs.filter(club => 
        (club.members?.length || 0) > 0 || 
        allMembers.some(m => (m.clubIds || []).includes(club.id)) ||
        (club.tournaments?.length || 0) > 0
      ).length,
      storesEnabled: approvedClubs.filter(club => club.storeEnabled).length
    }
  }, [approvedClubs, allMembers])

  // Filter and sort clubs (approved only)
  const filteredAndSortedClubs = useMemo(() => {
    let filtered = approvedClubs.filter(club => {
      const query = searchQuery.toLowerCase()
      return (
        club.name?.toLowerCase().includes(query) ||
        club.nameAr?.toLowerCase().includes(query) ||
        club.address?.toLowerCase().includes(query) ||
        club.id?.toLowerCase().includes(query)
      )
    })

    // Sort clubs
    filtered.sort((a, b) => {
      let aValue, bValue
      
      switch (sortBy) {
        case 'members':
          aValue = a.members?.length || 0
          bValue = b.members?.length || 0
          break
        case 'tournaments':
          aValue = a.tournaments?.length || 0
          bValue = b.tournaments?.length || 0
          break
        case 'revenue':
          aValue = a.accounting?.reduce((acc, item) => acc + (parseFloat(item.amount) || 0), 0) || 0
          bValue = b.accounting?.reduce((acc, item) => acc + (parseFloat(item.amount) || 0), 0) || 0
          break
        case 'created':
          aValue = new Date(a.createdAt || 0).getTime()
          bValue = new Date(b.createdAt || 0).getTime()
          break
        default: // 'name'
          aValue = a.name?.toLowerCase() || ''
          bValue = b.name?.toLowerCase() || ''
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0
      }
    })

    return filtered
  }, [approvedClubs, searchQuery, sortBy, sortOrder])

  const handleSort = (newSortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(newSortBy)
      setSortOrder('asc')
    }
  }

  const getClubRevenue = (club) => {
    return club.accounting?.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) || 0
  }

  const getClubName = (clubId) => {
    const club = approvedClubs.find(c => c.id === clubId)
    return club ? (language === 'ar' && club.nameAr ? club.nameAr : club.name) : clubId
  }

  const handleAddMemberToClub = (memberId, clubId) => {
    if (addMemberToClubs(memberId, clubId)) {
      setAddToClubMember(null)
      setMembersRefresh(k => k + 1)
      window.dispatchEvent(new CustomEvent('clubs-synced'))
    }
  }

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return allMembers
    const q = memberSearch.toLowerCase().trim()
    return allMembers.filter(m =>
      m.name?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q) ||
      m.mobile?.toLowerCase().includes(q)
    )
  }, [allMembers, memberSearch])

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  return (
    <div className="main-admin-page">
      <div className="all-clubs-dashboard">
        <div className="dashboard-header">
          <div className="dashboard-header-text">
            <h2 className="page-title">{t('All Clubs Dashboard', 'لوحة جميع الأندية', language)}</h2>
            <p className="page-subtitle">{t('Overview and statistics for all clubs in the system', 'نظرة عامة وإحصائيات لجميع الأندية في النظام', language)}</p>
          </div>
          <button 
            type="button"
            className="btn-primary dashboard-add-btn"
            onClick={() => navigate('/admin/manage-clubs')}
          >
            + {t('Add New Club', 'إضافة نادٍ جديد', language)}
          </button>
        </div>
        
        {/* Statistics Cards */}
        <div className="total-stats-grid">
          <div className="total-stat-card stat-primary">
            <div className="total-stat-icon">🏢</div>
            <div className="total-stat-content">
              <div className="total-stat-value">{totalStats.totalClubs}</div>
              <div className="total-stat-label">Total Clubs</div>
              <div className="total-stat-sublabel">{totalStats.activeClubs} active</div>
            </div>
          </div>
          
          <div className="total-stat-card stat-success">
            <div className="total-stat-icon">👥</div>
            <div className="total-stat-content">
              <div className="total-stat-value">{totalStats.totalMembers}</div>
              <div className="total-stat-label">Total Members</div>
              <div className="total-stat-sublabel">
                {t('Registered on platform', 'مسجلون في المنصة', language)}
              </div>
            </div>
          </div>
          
          <div className="total-stat-card stat-info">
            <div className="total-stat-icon">🏆</div>
            <div className="total-stat-content">
              <div className="total-stat-value">{totalStats.totalTournaments}</div>
              <div className="total-stat-label">Total Tournaments</div>
              <div className="total-stat-sublabel">
                {totalStats.totalClubs > 0 
                  ? Math.round(totalStats.totalTournaments / totalStats.totalClubs) 
                  : 0} avg per club
              </div>
            </div>
          </div>
          
          <div className="total-stat-card stat-warning">
            <div className="total-stat-icon">🏟️</div>
            <div className="total-stat-content">
              <div className="total-stat-value">{totalStats.totalCourts}</div>
              <div className="total-stat-label">Total Courts</div>
              <div className="total-stat-sublabel">
                {totalStats.totalClubs > 0 
                  ? (totalStats.totalCourts / totalStats.totalClubs).toFixed(1) 
                  : 0} avg per club
              </div>
            </div>
          </div>
          
          <div className="total-stat-card stat-danger">
            <div className="total-stat-icon">💰</div>
            <div className="total-stat-content">
              <div className="total-stat-value">{totalStats.totalRevenue.toFixed(0)}</div>
              <div className="total-stat-label">Total Revenue (SAR)</div>
              <div className="total-stat-sublabel">
                {totalStats.totalClubs > 0 
                  ? (totalStats.totalRevenue / totalStats.totalClubs).toFixed(0) 
                  : 0} avg per club
              </div>
            </div>
          </div>
          
          <div className="total-stat-card stat-secondary">
            <div className="total-stat-icon">📅</div>
            <div className="total-stat-content">
              <div className="total-stat-value">{totalStats.totalBookings}</div>
              <div className="total-stat-label">Total Bookings</div>
              <div className="total-stat-sublabel">All time</div>
            </div>
          </div>
        </div>

        {/* Pending Clubs */}
        {pendingClubs.length > 0 && (
          <div className="pending-clubs-section">
            <h3>{t('Pending club registrations', 'طلبات تسجيل نوادي قيد المراجعة', language)} ({pendingClubs.length})</h3>
            <div className="pending-clubs-list">
              {pendingClubs.map(club => (
                <div key={club.id} className="pending-club-card">
                  <div className="pending-club-info">
                    <strong>{language === 'ar' && club.nameAr ? club.nameAr : club.name}</strong>
                    <span>{club.adminEmail || club.email}</span>
                    {club.commercialRegister && <span>{t('CR', 'س.ت', language)}: {club.commercialRegister}</span>}
                  </div>
                  <div className="pending-club-actions">
                    <button
                      type="button"
                      className="btn-secondary btn-small"
                      onClick={() => setViewingPending(club)}
                    >
                      {t('View details', 'عرض البيانات', language)}
                    </button>
                    {onApproveClub && (
                      <button 
                        type="button" 
                        className="btn-primary btn-small"
                        onClick={() => onApproveClub(club.id)}
                      >
                        {t('Approve', 'موافقة', language)}
                      </button>
                    )}
                    {onRejectClub && (
                      <button 
                        type="button" 
                        className="btn-danger btn-small"
                        onClick={() => window.confirm(t('Reject this registration?', 'رفض هذا التسجيل؟', language)) && onRejectClub(club.id)}
                      >
                        {t('Reject', 'رفض', language)}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending club details modal */}
        {viewingPending && (
          <div className="pending-modal-overlay" onClick={() => setViewingPending(null)}>
            <div className="pending-modal" onClick={e => e.stopPropagation()}>
              <div className="pending-modal-header">
                <h3>{t('Club registration details', 'بيانات تسجيل النادي', language)}</h3>
                <button type="button" className="pending-modal-close" onClick={() => setViewingPending(null)} aria-label="Close">&times;</button>
              </div>
              <div className="pending-modal-body">
                <div className="pending-detail-grid">
                  <div className="pending-detail-row">
                    <span className="pending-detail-label">{t('Club name (English)', 'اسم النادي (إنجليزي)', language)}</span>
                    <span className="pending-detail-value">{viewingPending.name || '—'}</span>
                  </div>
                  <div className="pending-detail-row">
                    <span className="pending-detail-label">{t('Club name (Arabic)', 'اسم النادي (عربي)', language)}</span>
                    <span className="pending-detail-value">{viewingPending.nameAr || '—'}</span>
                  </div>
                  <div className="pending-detail-row">
                    <span className="pending-detail-label">{t('Admin email', 'البريد الإلكتروني للدخول', language)}</span>
                    <span className="pending-detail-value">{viewingPending.adminEmail || viewingPending.email || '—'}</span>
                  </div>
                  <div className="pending-detail-row">
                    <span className="pending-detail-label">{t('Club email', 'بريد النادي', language)}</span>
                    <span className="pending-detail-value">{viewingPending.email || '—'}</span>
                  </div>
                  <div className="pending-detail-row">
                    <span className="pending-detail-label">{t('Phone', 'الهاتف', language)}</span>
                    <span className="pending-detail-value">{viewingPending.phone || '—'}</span>
                  </div>
                  <div className="pending-detail-row">
                    <span className="pending-detail-label">{t('Commercial register', 'السجل التجاري', language)}</span>
                    <span className="pending-detail-value">{viewingPending.commercialRegister || '—'}</span>
                  </div>
                  <div className="pending-detail-row">
                    <span className="pending-detail-label">{t('Address / Location', 'العنوان / الموقع', language)}</span>
                    <span className="pending-detail-value">{viewingPending.address || viewingPending.location?.address || '—'}</span>
                  </div>
                  {viewingPending.location?.lat != null && (
                    <div className="pending-detail-row">
                      <span className="pending-detail-label">{t('Coordinates', 'الإحداثيات', language)}</span>
                      <span className="pending-detail-value">{viewingPending.location.lat?.toFixed(5)}, {viewingPending.location.lng?.toFixed(5)}</span>
                    </div>
                  )}
                  <div className="pending-detail-row">
                    <span className="pending-detail-label">{t('Submitted', 'تاريخ التقديم', language)}</span>
                    <span className="pending-detail-value">{formatDate(viewingPending.createdAt)}</span>
                  </div>
                  {viewingPending.commercialRegisterImage && (
                    <div className="pending-detail-row pending-detail-full">
                      <span className="pending-detail-label">{t('Commercial register document', 'صورة السجل التجاري', language)}</span>
                      <div className="pending-cr-image-wrap">
                        <img src={viewingPending.commercialRegisterImage} alt="CR" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="pending-modal-footer">
                {onRejectClub && (
                  <button type="button" className="btn-danger" onClick={() => { if (window.confirm(t('Reject this registration?', 'رفض هذا التسجيل؟', language))) { onRejectClub(viewingPending.id); setViewingPending(null); } }}>
                    {t('Reject', 'رفض', language)}
                  </button>
                )}
                <div className="pending-modal-footer-right">
                  <button type="button" className="btn-secondary" onClick={() => setViewingPending(null)}>
                    {t('Close', 'إغلاق', language)}
                  </button>
                  {onApproveClub && (
                    <button type="button" className="btn-primary" onClick={() => { onApproveClub(viewingPending.id); setViewingPending(null); }}>
                      {t('Approve', 'موافقة', language)}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* All Members Section */}
        <div id="all-members-section" className="all-members-section">
          <h3>{t('All Members Across Clubs', 'أعضاء كل الأندية', language)} ({allMembers.length})</h3>
          <div className="all-members-search">
            <input
              type="text"
              placeholder={t('Search members by name, email...', 'البحث بالأعضاء بالاسم أو البريد...', language)}
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              className="search-input"
              style={{ maxWidth: 320 }}
            />
          </div>
          {filteredMembers.length === 0 ? (
            <div className="empty-state small">
              <p>{t('No members found.', 'لا يوجد أعضاء.', language)}</p>
            </div>
          ) : (
            <div className="all-members-table-wrap">
              <table className="all-members-table">
                <thead>
                  <tr>
                    <th>{t('Member', 'العضو', language)}</th>
                    <th>{t('Email', 'البريد', language)}</th>
                    <th>{t('Clubs Joined', 'النوادي المنضم لها', language)}</th>
                    <th>{t('Actions', 'إجراءات', language)}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map(member => {
                    const clubsJoined = (member.clubIds || []).filter(id => approvedClubs.some(c => c.id === id))
                    const clubsNotJoined = approvedClubs.filter(c => !(member.clubIds || []).includes(c.id))
                    return (
                      <tr key={member.id}>
                        <td>
                          <div className="member-cell">
                            {member.avatar ? (
                              <img src={member.avatar} alt="" className="member-avatar-small" />
                            ) : (
                              <span className="member-initial">{member.name?.[0] || '?'}</span>
                            )}
                            <span>{member.name || '—'}</span>
                          </div>
                        </td>
                        <td>{member.email || '—'}</td>
                        <td>
                          <div className="clubs-joined-cell">
                            {clubsJoined.length === 0 ? (
                              <span className="no-clubs">{t('None', 'لا يوجد', language)}</span>
                            ) : (
                              clubsJoined.map(clubId => (
                                <span key={clubId} className="club-badge">
                                  {getClubName(clubId)}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td>
                          {clubsNotJoined.length > 0 ? (
                            <div className="add-to-club-cell">
                              {addToClubMember?.id === member.id ? (
                                <div className="add-to-club-dropdown">
                                  {clubsNotJoined.map(club => (
                                    <button
                                      key={club.id}
                                      type="button"
                                      className="btn-secondary btn-small"
                                      onClick={() => handleAddMemberToClub(member.id, club.id)}
                                    >
                                      + {getClubName(club.id)}
                                    </button>
                                  ))}
                                  <button
                                    type="button"
                                    className="btn-secondary btn-small"
                                    onClick={() => setAddToClubMember(null)}
                                  >
                                    {t('Cancel', 'إلغاء', language)}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="btn-primary btn-small"
                                  onClick={() => setAddToClubMember(member)}
                                >
                                  {t('Add to club', 'إضافة لنادي', language)}
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="in-all-clubs">{t('In all clubs', 'في جميع الأندية', language)}</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Search and Filter */}
        <div className="dashboard-controls">
          <div className="search-box">
            <input
              type="text"
              placeholder={t('Search clubs by name, address, or ID...', 'البحث بالأندية بالاسم أو العنوان أو المعرّف...', language)}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              aria-label={t('Search clubs', 'البحث في الأندية', language)}
            />
            <span className="search-icon" aria-hidden>🔍</span>
          </div>
          <div className="sort-controls">
            <label className="sort-label">{t('Sort by:', 'ترتيب حسب:', language)}</label>
            <select 
              value={sortBy} 
              onChange={(e) => handleSort(e.target.value)}
              className="sort-select"
              aria-label={t('Sort by', 'ترتيب حسب', language)}
            >
              <option value="name">{t('Name', 'الاسم', language)}</option>
              <option value="members">{t('Members', 'الأعضاء', language)}</option>
              <option value="tournaments">{t('Tournaments', 'البطولات', language)}</option>
              <option value="revenue">{t('Revenue', 'الإيرادات', language)}</option>
              <option value="created">{t('Created Date', 'تاريخ الإنشاء', language)}</option>
            </select>
            <button 
              type="button"
              className="sort-order-btn"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              title={sortOrder === 'asc' ? (language === 'ar' ? 'تصاعدي' : 'Ascending') : (language === 'ar' ? 'تنازلي' : 'Descending')}
              aria-label={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>

        {/* Clubs List */}
        <div className="clubs-overview-section">
          <div className="section-header">
            <h3>
              {t('All Clubs', 'جميع الأندية', language)} ({filteredAndSortedClubs.length})
              {searchQuery && <span className="search-results"> – {t('Search results', 'نتائج البحث', language)}</span>}
            </h3>
          </div>
          
          {clubs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon" aria-hidden>🏢</div>
              <p>{t('No clubs found. Create your first club!', 'لا توجد أندية. أنشئ ناديك الأول!', language)}</p>
              <button 
                type="button"
                className="btn-primary"
                onClick={() => navigate('/admin/manage-clubs')}
              >
                + {t('Create First Club', 'إنشاء أول نادٍ', language)}
              </button>
            </div>
          ) : filteredAndSortedClubs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon" aria-hidden>🔍</div>
              <p>{t('No clubs match your search criteria.', 'لا توجد أندية تطابق معايير البحث.', language)}</p>
              <button 
                type="button"
                className="btn-secondary"
                onClick={() => setSearchQuery('')}
              >
                {t('Clear Search', 'مسح البحث', language)}
              </button>
            </div>
          ) : (
            <div className="clubs-overview-grid">
              {filteredAndSortedClubs.map(club => {
                const clubRevenue = getClubRevenue(club)
                const hasPlaytomic = !!(club.playtomicVenueId && club.playtomicApiKey)
                
                return (
                  <div key={club.id} className="club-overview-card">
                    <div className="club-card-header">
                      {club.logo && <img src={club.logo} alt="" className="club-card-logo" />}
                      <div className="club-header-info">
                        <h4 className="club-name">{club.name}</h4>
                        {club.nameAr && (
                          <p className="club-name-ar">{club.nameAr}</p>
                        )}
                        {club.address && (
                          <p className="club-address">📍 {club.address}</p>
                        )}
                      </div>
                      <div className="club-card-badges">
                        {hasPlaytomic && (
                          <span className="playtomic-badge" title="Playtomic Integration">P</span>
                        )}
                        {onUpdateClub && (
                          <label className="store-toggle-wrap" title={club.storeEnabled ? 'Store enabled – click to disable' : 'Store disabled – click to enable'}>
                            <span className="store-toggle-label">🛒</span>
                            <input
                              type="checkbox"
                              checked={!!club.storeEnabled}
                              onChange={() => onUpdateClub(club.id, { storeEnabled: !club.storeEnabled })}
                              className="store-toggle"
                            />
                            <span className="store-toggle-text">{club.storeEnabled ? 'On' : 'Off'}</span>
                          </label>
                        )}
                      </div>
                    </div>

                    <div className="club-card-stats">
                      <div className="club-stat-item">
                        <span className="stat-icon">🏟️</span>
                        <div className="stat-details">
                          <span className="stat-value">{club.courts?.length || 0}</span>
                          <span className="stat-label">Courts</span>
                        </div>
                      </div>
                      <div className="club-stat-item">
                        <span className="stat-icon">👥</span>
                        <div className="stat-details">
                          <span className="stat-value">{club.members?.length || 0}</span>
                          <span className="stat-label">Members</span>
                        </div>
                      </div>
                      <div className="club-stat-item">
                        <span className="stat-icon">🏆</span>
                        <div className="stat-details">
                          <span className="stat-value">{club.tournaments?.length || 0}</span>
                          <span className="stat-label">Tournaments</span>
                        </div>
                      </div>
                      <div className="club-stat-item">
                        <span className="stat-icon">💰</span>
                        <div className="stat-details">
                          <span className="stat-value">{clubRevenue.toFixed(0)}</span>
                          <span className="stat-label">Revenue (SAR)</span>
                        </div>
                      </div>
                    </div>

                    {club.createdAt && (
                      <div className="club-meta">
                        <span className="meta-item">
                          Created: {formatDate(club.createdAt)}
                        </span>
                        {club.updatedAt && club.updatedAt !== club.createdAt && (
                          <span className="meta-item">
                            Updated: {formatDate(club.updatedAt)}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="club-card-actions">
                      <button 
                        type="button"
                        className="btn-primary btn-small btn-full"
                        onClick={() => navigate(`/club/${club.id}`)}
                        title={t('Open Club Main Page', 'فتح الصفحة الرئيسية للنادي', language)}
                      >
                        🏠 {t('Club Page', 'صفحة النادي', language)}
                      </button>
                      <button 
                        type="button"
                        className="btn-secondary btn-small btn-full"
                        onClick={() => navigate(`/admin/club/${club.id}`)}
                        title={t('Open Club Admin Panel', 'فتح لوحة تحكم النادي', language)}
                      >
                        ⚙️ {t('Admin Panel', 'لوحة التحكم', language)}
                      </button>
                      <button 
                        type="button"
                        className="btn-secondary btn-small btn-full"
                        onClick={() => navigate(`/admin/manage-clubs`)}
                        title={t('Edit Club Details', 'تعديل تفاصيل النادي', language)}
                      >
                        ✏️ {t('Edit', 'تعديل', language)}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AllClubsDashboard
