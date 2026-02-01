import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import './ClubDashboard.css'
import { loadFromLocalStorage } from '../../storage'
import LanguageIcon from '../../components/LanguageIcon'

const ClubDashboard = ({ club }) => {
  const navigate = useNavigate()
  const { clubId } = useParams()
  const [language, setLanguage] = useState('en')
  const [tournamentData, setTournamentData] = useState(null)
  
  useEffect(() => {
    if (!club || !clubId) return
    
    // Load language preference
    const savedLanguage = localStorage.getItem(`club_${clubId}_language`) || club?.settings?.defaultLanguage || 'en'
    setLanguage(savedLanguage)
    
    // Load tournament data for this club (دعم بيانات كل بطولة)
    try {
      const data = club?.tournamentData || {}
      const kingStateByTournamentId = data.kingStateByTournamentId ?? loadFromLocalStorage.kingStateByTournament(clubId)
      const socialStateByTournamentId = data.socialStateByTournamentId ?? loadFromLocalStorage.socialStateByTournament(clubId)
      setTournamentData({ kingStateByTournamentId: kingStateByTournamentId || {}, socialStateByTournamentId: socialStateByTournamentId || {} })
    } catch (error) {
      console.error('Error loading tournament data:', error)
      setTournamentData({ kingStateByTournamentId: {}, socialStateByTournamentId: {} })
    }
  }, [clubId, club])

  if (!club) {
    return (
      <div className="club-admin-page">
        <div style={{ 
          textAlign: 'center', 
          padding: '40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '15px'
        }}>
          <div style={{ fontSize: '48px', opacity: 0.5 }}>⏳</div>
          <div>Loading club data...</div>
          {clubId && <div style={{ fontSize: '12px', color: '#999' }}>Club ID: {clubId}</div>}
        </div>
      </div>
    )
  }

  const t = {
    en: {
      dashboard: 'Club Dashboard',
      overview: 'Overview',
      statistics: 'Statistics',
      quickActions: 'Quick Actions',
      recentActivity: 'Recent Activity',
      clubInfo: 'Club Information',
      tournaments: 'Tournaments',
      members: 'Members',
      bookings: 'Bookings',
      revenue: 'Revenue',
      courts: 'Courts',
      activeTournaments: 'Active Tournaments',
      totalMatches: 'Total Matches',
      openClubPage: 'Open Club Page',
      manageMembers: 'Manage Members',
      manageOffers: 'Manage Offers',
      viewAccounting: 'View Accounting',
      clubSettings: 'Club Settings',
      noData: 'No data available',
      address: 'Address',
      phone: 'Phone',
      email: 'Email',
      website: 'Website',
      playtomicIntegration: 'Playtomic Integration',
      connected: 'Connected',
      notConnected: 'Not Connected',
      kingOfCourt: 'King of the Court',
      socialTournament: 'Social Tournament',
      teams: 'Teams',
      matches: 'Matches',
      currentTournament: 'Current Tournament',
      viewDetails: 'View Details'
    },
    ar: {
      dashboard: 'لوحة تحكم النادي',
      overview: 'نظرة عامة',
      statistics: 'الإحصائيات',
      quickActions: 'إجراءات سريعة',
      recentActivity: 'النشاط الأخير',
      clubInfo: 'معلومات النادي',
      tournaments: 'البطولات',
      members: 'الأعضاء',
      bookings: 'الحجوزات',
      revenue: 'الإيرادات',
      courts: 'الملاعب',
      activeTournaments: 'البطولات النشطة',
      totalMatches: 'إجمالي المباريات',
      openClubPage: 'فتح صفحة النادي',
      manageMembers: 'إدارة الأعضاء',
      manageOffers: 'إدارة العروض',
      viewAccounting: 'عرض المحاسبة',
      clubSettings: 'إعدادات النادي',
      noData: 'لا توجد بيانات',
      address: 'العنوان',
      phone: 'الهاتف',
      email: 'البريد الإلكتروني',
      website: 'الموقع الإلكتروني',
      playtomicIntegration: 'تكامل Playtomic',
      connected: 'متصل',
      notConnected: 'غير متصل',
      kingOfCourt: 'ملك الملعب',
      socialTournament: 'بطولة سوشيال',
      teams: 'الفرق',
      matches: 'المباريات',
      currentTournament: 'البطولة الحالية',
      viewDetails: 'عرض التفاصيل'
    }
  }[language]

  // Calculate statistics (دعم بيانات كل بطولة: kingStateByTournamentId / socialStateByTournamentId)
  const stats = useMemo(() => {
    const kingByTournament = tournamentData?.kingStateByTournamentId || {}
    const socialByTournament = tournamentData?.socialStateByTournamentId || {}
    const kingMatches = Object.values(kingByTournament).reduce((sum, s) => sum + (s?.matches?.length || 0), 0)
    const socialMatches = Object.values(socialByTournament).reduce((sum, s) => sum + (s?.matches?.length || 0), 0)
    const totalMatches = kingMatches + socialMatches
    
    const kingTeams = Object.values(kingByTournament).reduce((sum, s) => sum + (s?.teams?.length || 0), 0)
    const socialTeams = Object.values(socialByTournament).reduce((sum, s) => sum + (s?.teams?.length || 0), 0)
    const totalActiveTeams = kingTeams + socialTeams
    
    const revenue = club.accounting?.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) || 0
    
    const hasPlaytomic = !!(club.playtomicVenueId && club.playtomicApiKey)
    
    return {
      totalTournaments: club.tournaments?.length || 0,
      totalMembers: club.members?.length || 0,
      totalBookings: club.bookings?.length || 0,
      totalRevenue: revenue,
      totalCourts: club.courts?.length || 0,
      totalMatches,
      kingMatches,
      socialMatches,
      totalActiveTeams,
      kingTeams,
      socialTeams,
      hasPlaytomic,
      totalOffers: club.offers?.length || 0
    }
  }, [club, tournamentData])

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString(language === 'en' ? 'en-US' : 'ar-SA', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  const formatCurrency = (amount) => {
    try {
      return new Intl.NumberFormat(language === 'en' ? 'en-US' : 'ar-SA', {
        style: 'currency',
        currency: club?.settings?.currency || 'SAR',
        minimumFractionDigits: 0
      }).format(amount || 0)
    } catch (error) {
      return `${amount || 0} ${club?.settings?.currency || 'SAR'}`
    }
  }

  // Safety check
  if (!club || !club.id) {
    console.error('ClubDashboard - Club is missing:', { club, clubId })
    return (
      <div className="club-admin-page">
        <div style={{ 
          textAlign: 'center', 
          padding: '40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '15px'
        }}>
          <div style={{ fontSize: '48px', opacity: 0.5 }}>⚠️</div>
          <div>Club data not available</div>
          {clubId && <div style={{ fontSize: '12px', color: '#999' }}>Club ID: {clubId}</div>}
        </div>
      </div>
    )
  }

  console.log('ClubDashboard - Rendering with club:', club.name, 'Stats:', stats)

  return (
    <div className="club-admin-page">
      <div className="club-dashboard">
        <div className="dashboard-header">
          <div>
            <h2 className="page-title">
              {club.logo && <img src={club.logo} alt="" className="club-logo" />}
              {t.dashboard} - {language === 'en' ? club.name : club.nameAr || club.name}
            </h2>
            <p className="page-subtitle">
              {t.overview} • {formatDate(club.createdAt)}
            </p>
          </div>
          <button
            className="language-toggle-btn"
            onClick={() => {
              const newLang = language === 'en' ? 'ar' : 'en'
              setLanguage(newLang)
              localStorage.setItem(`club_${clubId}_language`, newLang)
            }}
          >
            <LanguageIcon lang={language === 'en' ? 'ar' : 'en'} size={18} />
          </button>
        </div>

        {/* Main Statistics */}
        <div className="stats-grid">
          <div className="stat-card stat-primary">
            <div className="stat-icon">🏆</div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalTournaments}</div>
              <div className="stat-label">{t.tournaments}</div>
              <div className="stat-sublabel">{stats.totalMatches} {t.totalMatches}</div>
            </div>
          </div>
          
          <div className="stat-card stat-success">
            <div className="stat-icon">👥</div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalMembers}</div>
              <div className="stat-label">{t.members}</div>
              <div className="stat-sublabel">
                {stats.totalActiveTeams > 0 ? `${stats.totalActiveTeams} ${t.teams} active` : t.noData}
              </div>
            </div>
          </div>
          
          <div className="stat-card stat-info">
            <div className="stat-icon">📅</div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalBookings}</div>
              <div className="stat-label">{t.bookings}</div>
              <div className="stat-sublabel">All time</div>
            </div>
          </div>
          
          <div className="stat-card stat-warning">
            <div className="stat-icon">🏟️</div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalCourts}</div>
              <div className="stat-label">{t.courts}</div>
              <div className="stat-sublabel">Available</div>
            </div>
          </div>
          
          <div className="stat-card stat-danger">
            <div className="stat-icon">💰</div>
            <div className="stat-content">
              <div className="stat-value">{formatCurrency(stats.totalRevenue)}</div>
              <div className="stat-label">{t.revenue}</div>
              <div className="stat-sublabel">Total</div>
            </div>
          </div>
          
          <div className="stat-card stat-secondary">
            <div className="stat-icon">🎁</div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalOffers}</div>
              <div className="stat-label">{t.manageOffers}</div>
              <div className="stat-sublabel">Active offers</div>
            </div>
          </div>
        </div>

        <div className="dashboard-content-grid">
          {/* Left Column */}
          <div className="dashboard-left">
            {/* Club Information */}
            <div className="dashboard-section">
              <h3 className="section-title">{t.clubInfo}</h3>
              <div className="info-card">
                <div className="info-item">
                  <span className="info-label">{t.address}:</span>
                  <span className="info-value">
                    {language === 'en' ? club.address : club.addressAr || club.address || '-'}
                  </span>
                </div>
                {club.phone && (
                  <div className="info-item">
                    <span className="info-label">{t.phone}:</span>
                    <span className="info-value">{club.phone}</span>
                  </div>
                )}
                {club.email && (
                  <div className="info-item">
                    <span className="info-label">{t.email}:</span>
                    <span className="info-value">{club.email}</span>
                  </div>
                )}
                {club.website && (
                  <div className="info-item">
                    <span className="info-label">{t.website}:</span>
                    <a href={club.website} target="_blank" rel="noopener noreferrer" className="info-link">
                      {club.website}
                    </a>
                  </div>
                )}
                <div className="info-item">
                  <span className="info-label">{t.playtomicIntegration}:</span>
                  <span className={`info-badge ${stats.hasPlaytomic ? 'badge-success' : 'badge-warning'}`}>
                    {stats.hasPlaytomic ? '✓ ' + t.connected : t.notConnected}
                  </span>
                </div>
              </div>
            </div>

            {/* Active Tournaments */}
            <div className="dashboard-section">
              <h3 className="section-title">{t.activeTournaments}</h3>
              <div className="tournaments-cards">
                {(Object.values(tournamentData?.kingStateByTournamentId || {}).some(s => s?.teams?.length > 0)) ? (
                  <div className="tournament-status-card">
                    <div className="tournament-status-header">
                      <span className="tournament-icon">👑</span>
                      <span className="tournament-name">{t.kingOfCourt}</span>
                    </div>
                    <div className="tournament-status-stats">
                      <div className="tournament-stat">
                        <span className="tournament-stat-value">{stats.kingTeams}</span>
                        <span className="tournament-stat-label">{t.teams}</span>
                      </div>
                      <div className="tournament-stat">
                        <span className="tournament-stat-value">{stats.kingMatches}</span>
                        <span className="tournament-stat-label">{t.matches}</span>
                      </div>
                    </div>
                    <button 
                      className="tournament-view-btn"
                      onClick={() => navigate(`/club/${clubId}`)}
                    >
                      {t.viewDetails} →
                    </button>
                  </div>
                ) : (
                  <div className="tournament-status-card empty">
                    <span className="tournament-icon">👑</span>
                    <span>{t.kingOfCourt}</span>
                    <span className="empty-text">{t.noData}</span>
                  </div>
                )}

                {(Object.values(tournamentData?.socialStateByTournamentId || {}).some(s => s?.teams?.length > 0)) ? (
                  <div className="tournament-status-card">
                    <div className="tournament-status-header">
                      <span className="tournament-icon">🎯</span>
                      <span className="tournament-name">{t.socialTournament}</span>
                    </div>
                    <div className="tournament-status-stats">
                      <div className="tournament-stat">
                        <span className="tournament-stat-value">{stats.socialTeams}</span>
                        <span className="tournament-stat-label">{t.teams}</span>
                      </div>
                      <div className="tournament-stat">
                        <span className="tournament-stat-value">{stats.socialMatches}</span>
                        <span className="tournament-stat-label">{t.matches}</span>
                      </div>
                    </div>
                    <button 
                      className="tournament-view-btn"
                      onClick={() => navigate(`/club/${clubId}`)}
                    >
                      {t.viewDetails} →
                    </button>
                  </div>
                ) : (
                  <div className="tournament-status-card empty">
                    <span className="tournament-icon">🎯</span>
                    <span>{t.socialTournament}</span>
                    <span className="empty-text">{t.noData}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="dashboard-right">
            {/* Quick Actions */}
            <div className="dashboard-section">
              <h3 className="section-title">{t.quickActions}</h3>
              <div className="quick-actions-grid">
                <button 
                  className="quick-action-btn action-primary"
                  onClick={() => navigate(`/club/${club.id}`)}
                >
                  <span className="action-icon">🏠</span>
                  <span className="action-label">{t.openClubPage}</span>
                </button>
                <button 
                  className="quick-action-btn action-secondary"
                  onClick={() => navigate(`/admin/club/${club.id}/members`)}
                >
                  <span className="action-icon">👥</span>
                  <span className="action-label">{t.manageMembers}</span>
                </button>
                <button 
                  className="quick-action-btn action-secondary"
                  onClick={() => navigate(`/admin/club/${club.id}/offers`)}
                >
                  <span className="action-icon">🎁</span>
                  <span className="action-label">{t.manageOffers}</span>
                </button>
                <button 
                  className="quick-action-btn action-secondary"
                  onClick={() => navigate(`/admin/club/${club.id}/accounting`)}
                >
                  <span className="action-icon">💰</span>
                  <span className="action-label">{t.viewAccounting}</span>
                </button>
                <button 
                  className="quick-action-btn action-secondary"
                  onClick={() => navigate(`/admin/club/${club.id}/settings`)}
                >
                  <span className="action-icon">⚙️</span>
                  <span className="action-label">{t.clubSettings}</span>
                </button>
              </div>
            </div>

            {/* Recent Members */}
            {club.members && club.members.length > 0 && (
              <div className="dashboard-section">
                <h3 className="section-title">{t.members} ({club.members.length})</h3>
                <div className="members-preview">
                  {club.members.slice(0, 5).map(member => (
                    <div key={member.id} className="member-preview-item">
                      <div className="member-avatar">
                        {member.avatar ? (
                          <img src={member.avatar} alt="" />
                        ) : (
                          member.name?.charAt(0).toUpperCase() || '?'
                        )}
                      </div>
                      <div className="member-info">
                        <div className="member-name">{member.name}</div>
                        {member.email && (
                          <div className="member-email">{member.email}</div>
                        )}
                      </div>
                      {member.totalPoints > 0 && (
                        <div className="member-points">
                          {member.totalPoints} pts
                        </div>
                      )}
                    </div>
                  ))}
                  {club.members.length > 5 && (
                    <button 
                      className="view-all-btn"
                      onClick={() => navigate(`/admin/club/${club.id}/members`)}
                    >
                      {language === 'en' ? `View all ${club.members.length} members` : `عرض جميع ${club.members.length} عضو`} →
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Courts Overview */}
            {club.courts && club.courts.length > 0 && (
              <div className="dashboard-section">
                <h3 className="section-title">{t.courts} ({club.courts.length})</h3>
                <div className="courts-grid">
                  {club.courts.map(court => (
                    <div key={court.id} className="court-badge">
                      {language === 'en' ? court.name : court.nameAr || court.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ClubDashboard
