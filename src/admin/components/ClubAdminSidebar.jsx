import React, { useEffect } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import './ClubAdminSidebar.css'

const ClubAdminSidebar = ({ club, language, onLanguageChange, open, onClose }) => {
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
    { path: `dashboard`, icon: '📊', label: { en: 'Dashboard', ar: 'لوحة التحكم' } },
    { path: `members`, icon: '👥', label: { en: 'Members', ar: 'الأعضاء' } },
    { path: `offers`, icon: '🎁', label: { en: 'Offers', ar: 'العروض' } },
    { path: `store`, icon: '🛒', label: { en: 'Sales / Store', ar: 'المبيعات / المتجر' } },
    { path: `accounting`, icon: '💰', label: { en: 'Accounting', ar: 'المحاسبة' } },
    { path: `settings`, icon: '⚙️', label: { en: 'Settings', ar: 'الإعدادات' } },
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
          className="language-toggle"
          onClick={() => onLanguageChange(language === 'en' ? 'ar' : 'en')}
          title={language === 'en' ? 'العربية' : 'English'}
        >
          {language === 'en' ? 'العربية' : 'English'}
        </button>
        </div>
      </div>

      <nav className="club-admin-nav">
        {menuItems.map(item => {
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
      </div>
    </aside>
  )
}

export default ClubAdminSidebar
