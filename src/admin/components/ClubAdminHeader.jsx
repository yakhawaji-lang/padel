import React, { useState, useRef, useEffect } from 'react'
import { NavLink, Link, useParams } from 'react-router-dom'
import LanguageIcon from '../../components/LanguageIcon'
import { getClubAdminSession, hasClubPermission } from '../../storage/clubAuth'
import './ClubAdminHeader.css'

const MENU_ITEMS = [
  { path: 'dashboard', icon: '📊', label: { en: 'Dashboard', ar: 'لوحة التحكم' }, perm: 'dashboard' },
  { path: 'members', icon: '👥', label: { en: 'Members', ar: 'الأعضاء' }, perm: 'members' },
  { path: 'bookings', icon: '📅', label: { en: 'Bookings', ar: 'الحجوزات' }, perm: 'dashboard' },
  { path: 'booking-prices', icon: '💰', label: { en: 'Prices', ar: 'الأسعار' }, perm: 'settings' },
  { path: 'offers', icon: '🎁', label: { en: 'Offers', ar: 'العروض' }, perm: 'offers' },
  { path: 'store', icon: '🛒', label: { en: 'Store', ar: 'المتجر' }, perm: 'store' },
  { path: 'accounting', icon: '📈', label: { en: 'Accounting', ar: 'المحاسبة' }, perm: 'accounting' },
  { path: 'settings', icon: '⚙️', label: { en: 'Settings', ar: 'الإعدادات' }, perm: 'settings' },
  { path: 'users', icon: '👤', label: { en: 'Users', ar: 'المدراء' }, perm: 'users' }
]

const ClubAdminHeader = ({ club, language, onLanguageChange }) => {
  const { clubId } = useParams()
  const session = getClubAdminSession()
  const [navOpen, setNavOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  const basePath = `/admin/club/${clubId}`
  const visibleItems = MENU_ITEMS.filter(item => hasClubPermission(session, item.perm))

  return (
    <header className="club-admin-header club-admin-header--top-nav">
      {/* القائمة العلوية: الشعار + العنوان + اللغة + القائمة المنسدلة */}
      <div className="club-admin-header__bar">
        <div className="club-admin-header__brand">
          {club?.logo && <img src={club.logo} alt="" className="club-admin-header__logo" />}
          <div className="club-admin-header__brand-text">
            <span className="club-admin-header__club-name">
              {language === 'en' ? club?.name : club?.nameAr || club?.name}
            </span>
            {club?.address && (
              <span className="club-admin-header__address">
                {language === 'en' ? club.address : club.addressAr || club.address}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          className="club-admin-header__nav-toggle"
          aria-expanded={navOpen}
          aria-label={language === 'en' ? 'Toggle menu' : 'فتح/إغلاق القائمة'}
          onClick={() => setNavOpen(!navOpen)}
        >
          <span /><span /><span />
        </button>

        <div className="club-admin-header__actions">
          <button
            type="button"
            className="club-admin-header__lang-btn"
            onClick={() => onLanguageChange(language === 'en' ? 'ar' : 'en')}
            title={language === 'en' ? 'العربية' : 'English'}
          >
            <LanguageIcon lang={language === 'en' ? 'ar' : 'en'} size={18} />
          </button>
          <div className="club-admin-header__dropdown" ref={menuRef}>
            <button
              type="button"
              className="club-admin-header__more-btn"
              aria-expanded={menuOpen}
              aria-haspopup="true"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <span className="club-admin-header__more-dots">⋯</span>
            </button>
            <div className={`club-admin-header__dropdown-menu ${menuOpen ? 'club-admin-header__dropdown-menu--open' : ''}`}>
              <Link to={`/club/${clubId}`} className="club-admin-header__dropdown-item" onClick={() => setMenuOpen(false)}>
                🏠 {language === 'en' ? 'Club Page' : 'صفحة النادي'}
              </Link>
              <Link to="/admin/all-clubs" className="club-admin-header__dropdown-item" onClick={() => setMenuOpen(false)}>
                ← {language === 'en' ? 'Main Admin' : 'التحكم الرئيسي'}
              </Link>
              <Link to="/logout/club" className="club-admin-header__dropdown-item club-admin-header__dropdown-item--logout" onClick={() => setMenuOpen(false)}>
                {language === 'en' ? 'Logout' : 'تسجيل الخروج'}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* شريط أيقونات الصفحات تحت القائمة العلوية - خلفية مميزة */}
      <div className="club-admin-header__sub">
        <nav className={`club-admin-header__nav ${navOpen ? 'club-admin-header__nav--open' : ''}`}>
          <div className="club-admin-header__nav-scroll">
            {visibleItems.map(item => (
              <NavLink
                key={item.path}
                to={`${basePath}/${item.path}`}
                end={item.path === 'dashboard'}
                className={({ isActive }) =>
                  `club-admin-header__nav-link ${isActive ? 'club-admin-header__nav-link--active' : ''}`
                }
                onClick={() => setNavOpen(false)}
              >
                <span className="club-admin-header__nav-icon">{item.icon}</span>
                <span className="club-admin-header__nav-label">{item.label[language]}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </header>
  )
}

export default ClubAdminHeader
