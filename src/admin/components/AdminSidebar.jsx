import React, { useState } from 'react'
import LanguageIcon from '../../components/LanguageIcon'
import { Link, useLocation } from 'react-router-dom'
import './AdminSidebar.css'

const AdminSidebar = ({ currentClub, clubs, onClubChange, language, onLanguageChange }) => {
  const location = useLocation()
  const [showClubSelector, setShowClubSelector] = useState(false)

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  const menuItems = [
    { path: '/admin/dashboard', icon: '📊', label: { en: 'Dashboard', ar: 'لوحة التحكم' } },
    { path: '/admin/clubs', icon: '🏢', label: { en: 'Clubs', ar: 'الأندية' } },
    { path: '/admin/tournaments', icon: '🏆', label: { en: 'Tournaments', ar: 'البطولات' } },
    { path: '/admin/tournament-types', icon: '📋', label: { en: 'Tournament Types', ar: 'أنواع البطولات' } },
    { path: '/admin/members', icon: '👥', label: { en: 'Members', ar: 'الأعضاء' } },
    { path: '/admin/bookings', icon: '📅', label: { en: 'Bookings', ar: 'الحجوزات' } },
    { path: '/admin/offers', icon: '🎁', label: { en: 'Offers', ar: 'العروض' } },
    { path: '/admin/accounting', icon: '💰', label: { en: 'Accounting', ar: 'المحاسبة' } },
  ]

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-header">
        <h2 className="admin-logo">
          {language === 'en' ? 'Admin Panel' : 'لوحة التحكم'}
        </h2>
        <button
          className="language-toggle"
          onClick={() => onLanguageChange(language === 'en' ? 'ar' : 'en')}
          title={language === 'en' ? 'العربية' : 'English'}
        >
          <LanguageIcon lang={language === 'en' ? 'ar' : 'en'} size={18} />
        </button>
      </div>

      <div className="club-selector-container">
        <button
          className="club-selector-btn"
          onClick={() => setShowClubSelector(!showClubSelector)}
        >
          {currentClub?.logo ? <img src={currentClub.logo} alt="" className="club-logo-small" /> : <span className="club-icon">🏢</span>}
          <span className="club-name">
            {currentClub 
              ? (language === 'en' ? currentClub.name : currentClub.nameAr || currentClub.name)
              : (language === 'en' ? 'Select Club' : 'اختر النادي')
            }
          </span>
          <span className="dropdown-arrow">▼</span>
        </button>
        
        {showClubSelector && (
          <div className="club-selector-dropdown">
            {clubs.length === 0 ? (
              <div className="no-clubs">
                {language === 'en' ? 'No clubs found' : 'لا توجد أندية'}
              </div>
            ) : (
              clubs.map(club => (
                <button
                  key={club.id}
                  className={`club-option ${currentClub?.id === club.id ? 'active' : ''}`}
                  onClick={() => {
                    onClubChange(club)
                    setShowClubSelector(false)
                  }}
                >
                  {club.logo ? <img src={club.logo} alt="" className="club-logo-small" /> : <span className="club-icon-small">🏢</span>}
                  <span>{language === 'en' ? club.name : club.nameAr || club.name}</span>
                  {currentClub?.id === club.id && <span className="check-mark">✓</span>}
                </button>
              ))
            )}
            <Link
              to="/admin/clubs"
              className="add-club-btn"
              onClick={() => setShowClubSelector(false)}
            >
              + {language === 'en' ? 'Add New Club' : 'إضافة نادي جديد'}
            </Link>
          </div>
        )}
      </div>

      <nav className="admin-nav">
        {menuItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={`admin-nav-item ${isActive(item.path) ? 'active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label[language]}</span>
          </Link>
        ))}
      </nav>

      <div className="admin-sidebar-footer">
        <Link to="/" className="back-to-app">
          ← {language === 'en' ? 'Back to App' : 'العودة للتطبيق'}
        </Link>
      </div>
    </aside>
  )
}

export default AdminSidebar
