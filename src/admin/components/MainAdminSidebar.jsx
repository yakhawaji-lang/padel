import React, { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import './MainAdminSidebar.css'
import LanguageIcon from '../../components/LanguageIcon'
import { getPlatformAdminSession, hasPlatformPermission } from '../../storage/platformAdminAuth'

const MainAdminSidebar = ({ clubs, language, onLanguageChange, open, onClose }) => {
  const session = getPlatformAdminSession()
  const location = useLocation()
  const displayClubs = (Array.isArray(clubs) ? clubs : []).filter(c => c.status !== 'pending')
  useEffect(() => {
    if (open && typeof onClose === 'function') onClose()
  }, [location.pathname])

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  return (
    <aside className={`main-admin-sidebar ${open ? 'open' : ''}`} aria-hidden={!open} role="navigation">
      <div className="main-admin-sidebar-header">
        <h2 className="main-admin-logo">
          {language === 'en' ? 'Main Admin Panel' : 'لوحة التحكم الرئيسية'}
        </h2>
        <button
          type="button"
          className="main-admin-sidebar-close"
          onClick={onClose}
          aria-label={language === 'en' ? 'Close menu' : 'إغلاق القائمة'}
        >
          ✕
        </button>
        <button
          className="language-toggle"
          onClick={() => onLanguageChange(language === 'en' ? 'ar' : 'en')}
          title={language === 'en' ? 'العربية' : 'English'}
        >
          <LanguageIcon lang={language === 'en' ? 'ar' : 'en'} size={18} />
        </button>
      </div>

      <nav className="main-admin-nav">
        {hasPlatformPermission(session, 'all-clubs') && (
          <Link
            to="/admin/all-clubs"
            className={`main-admin-nav-item ${isActive('/admin/all-clubs') || location.pathname === '/admin' ? 'active' : ''}`}
          >
            <span className="nav-icon">📊</span>
            <span className="nav-label">
              {language === 'en' ? 'All Clubs Dashboard' : 'لوحة جميع الأندية'}
            </span>
          </Link>
        )}
        {session && (
          <Link
            to="/admin/admin-users"
            className={`main-admin-nav-item ${isActive('/admin/admin-users') ? 'active' : ''}`}
          >
            <span className="nav-icon">👤</span>
            <span className="nav-label">
              {language === 'en' ? 'Admin Users' : 'مدراء المنصة والأندية'}
            </span>
          </Link>
        )}
        {hasPlatformPermission(session, 'manage-clubs') && (
          <Link
            to="/admin/manage-clubs"
            className={`main-admin-nav-item ${isActive('/admin/manage-clubs') ? 'active' : ''}`}
          >
            <span className="nav-icon">🏢</span>
            <span className="nav-label">
              {language === 'en' ? 'Manage All Clubs' : 'إدارة جميع الأندية'}
            </span>
          </Link>
        )}
        {hasPlatformPermission(session, 'all-members') && (
          <Link
            to="/admin/all-members"
            className={`main-admin-nav-item ${isActive('/admin/all-members') ? 'active' : ''}`}
          >
            <span className="nav-icon">👥</span>
            <span className="nav-label">
              {language === 'en' ? 'All Members' : 'أعضاء كل الأندية'}
            </span>
          </Link>
        )}
        {hasPlatformPermission(session, 'all-clubs') && (
          <Link
            to="/admin/all-bookings"
            className={`main-admin-nav-item ${isActive('/admin/all-bookings') ? 'active' : ''}`}
          >
            <span className="nav-icon">📅</span>
            <span className="nav-label">
              {language === 'en' ? 'All Bookings' : 'جميع الحجوزات'}
            </span>
          </Link>
        )}
        {session && (
          <Link
            to="/admin/whatsapp-test"
            className={`main-admin-nav-item ${isActive('/admin/whatsapp-test') ? 'active' : ''}`}
          >
            <span className="nav-icon">💬</span>
            <span className="nav-label">
              {language === 'en' ? 'WhatsApp test' : 'تجربة واتساب'}
            </span>
          </Link>
        )}
        {session && (
          <Link
            to="/admin/sms-test"
            className={`main-admin-nav-item ${isActive('/admin/sms-test') ? 'active' : ''}`}
          >
            <span className="nav-icon">📱</span>
            <span className="nav-label">
              {language === 'en' ? 'SMS test' : 'تجربة SMS'}
            </span>
          </Link>
        )}
        {session && (
          <Link
            to="/admin/email-test"
            className={`main-admin-nav-item ${isActive('/admin/email-test') ? 'active' : ''}`}
          >
            <span className="nav-icon">✉️</span>
            <span className="nav-label">
              {language === 'en' ? 'Email test' : 'تجربة البريد'}
            </span>
          </Link>
        )}
        {session && (
          <Link
            to="/admin/settings"
            className={`main-admin-nav-item ${isActive('/admin/settings') ? 'active' : ''}`}
          >
            <span className="nav-icon">⚙️</span>
            <span className="nav-label">
              {language === 'en' ? 'Settings' : 'إعدادات'}
            </span>
          </Link>
        )}
      </nav>

      <div className="clubs-quick-list">
        <div className="clubs-list-header">
          <span className="nav-icon">🏢</span>
          <span className="nav-label">
            {language === 'en' ? 'Clubs' : 'الأندية'} ({displayClubs.length})
          </span>
        </div>
        <div className="clubs-list">
          {displayClubs.length === 0 ? (
            <div className="no-clubs">
              {language === 'en' ? 'No clubs found' : 'لا توجد أندية'}
            </div>
          ) : (
            displayClubs.map(club => (
              <div key={club.id} className="club-quick-item">
                <Link
                  to={`/club/${club.id}`}
                  className="club-quick-link"
                >
                  {club.logo ? <img src={club.logo} alt="" className="club-logo-small" /> : <span className="club-icon-small">🏢</span>}
                  <span className="club-name-text" title={language === 'en' ? club.name : club.nameAr || club.name}>
                    {language === 'en' ? club.name : club.nameAr || club.name}
                  </span>
                </Link>
                <Link
                  to={`/admin/club/${club.id}`}
                  className="club-admin-link"
                  title={language === 'en' ? 'Club Admin Panel' : 'لوحة تحكم النادي'}
                >
                  ⚙️
                </Link>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="main-admin-sidebar-footer">
        <Link to="/" className="back-to-app">
          ← {language === 'en' ? 'Back to Home' : 'العودة للرئيسية'}
        </Link>
        <Link to="/logout/platform" className="back-to-app" style={{ marginTop: 8, fontSize: '0.85rem', opacity: 0.8 }}>
          {language === 'en' ? 'Logout' : 'تسجيل الخروج'}
        </Link>
      </div>
    </aside>
  )
}

export default MainAdminSidebar
