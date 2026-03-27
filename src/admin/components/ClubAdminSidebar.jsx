import React, { useEffect } from 'react'
import LanguageIcon from '../../components/LanguageIcon'
import { Link, useLocation, useParams } from 'react-router-dom'
import { getClubAdminSession, hasClubPermission } from '../../storage/clubAuth'
import './ClubAdminSidebar.css'

const ClubAdminSidebar = ({ club, language, onLanguageChange, open, onClose }) => {
  const session = getClubAdminSession()
  const location = useLocation()
  const { clubId } = useParams()
  useEffect(() => {
    if (open && typeof onClose === 'function') onClose()
  }, [location.pathname])

  const isActive = (path) => {
    const currentPath = location.pathname
    // Check exact match or if current path starts with the target path
    return currentPath === path || currentPath.startsWith(path + '/')
  }

  const menuItems = [
    { path: `dashboard`, icon: '📊', label: { en: 'Dashboard', ar: 'لوحة التحكم' }, perm: 'dashboard' },
    { path: `members`, icon: '👥', label: { en: 'Members', ar: 'الأعضاء' }, perm: 'members' },
    { path: `bookings`, icon: '📅', label: { en: 'Bookings', ar: 'الحجوزات' }, perm: 'dashboard' },
    { path: `booking-prices`, icon: '💰', label: { en: 'Court Booking Prices', ar: 'أسعار حجوزات الملاعب' }, perm: 'settings' },
    { path: `booking-policies`, icon: '✏️', label: { en: 'Booking change & cancel', ar: 'تعديل الحجز والإلغاء' }, perm: 'settings' },
    { path: `payment-settings`, icon: '💳', label: { en: 'Payment settings', ar: 'إعدادات الدفع' }, perm: 'settings' },
    { path: `offers`, icon: '🎁', label: { en: 'Offers', ar: 'العروض' }, perm: 'offers' },
    { path: `store`, icon: '🛒', label: { en: 'Sales / Store', ar: 'المبيعات / المتجر' }, perm: 'store' },
    { path: `settings`, icon: '⚙️', label: { en: 'Settings', ar: 'الإعدادات' }, perm: 'settings' },
    { path: `users`, icon: '👤', label: { en: 'Club Users', ar: 'مدراء النادي' }, perm: 'users' }
  ]
  
  const getFullPath = (relativePath) => {
    return `/admin/club/${clubId}/${relativePath}`
  }

  return (
    <aside className={`club-admin-sidebar ${open ? 'open' : ''}`} aria-hidden={!open}>
      <div className="club-admin-sidebar-header">
        <div className="club-info">
          <h2 className="club-admin-logo">
            {club.logo && <img src={club.logo} alt="" className="club-logo" />}
            {language === 'en' ? club.name : club.nameAr || club.name}
          </h2>
          <p className="club-subtitle">
            {language === 'en' ? 'Club Admin Panel' : 'لوحة تحكم النادي'}
          </p>
        </div>
        <button
          type="button"
          className="club-admin-sidebar-close"
          onClick={onClose}
          aria-label="Close menu"
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

      <nav className="club-admin-nav">
        {menuItems.filter(item => hasClubPermission(session, item.perm)).map(item => {
          const fullPath = getFullPath(item.path)
          return (
            <Link
              key={item.path}
              to={fullPath}
              className={`club-admin-nav-item ${isActive(fullPath) ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label[language]}</span>
            </Link>
          )
        })}
      </nav>

      <div className="club-admin-sidebar-footer">
        <Link to={`/club/${clubId}`} className="back-to-club">
          🏠 {language === 'en' ? 'Club Page' : 'صفحة النادي'}
        </Link>
        <Link to="/admin/all-clubs" className="back-to-main-admin">
          ← {language === 'en' ? 'Main Admin' : 'التحكم الرئيسي'}
        </Link>
        <Link to="/logout/club" className="back-to-club" style={{ marginTop: 8, fontSize: '0.85rem', opacity: 0.8 }}>
          {language === 'en' ? 'Logout' : 'تسجيل الخروج'}
        </Link>
      </div>
    </aside>
  )
}

export default ClubAdminSidebar
