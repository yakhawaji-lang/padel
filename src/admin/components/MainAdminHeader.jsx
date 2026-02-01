import React from 'react'
import './MainAdminHeader.css'
import LanguageIcon from '../../components/LanguageIcon'

const MainAdminHeader = ({ language, onLanguageChange, onMenuToggle }) => {
  return (
    <header className="main-admin-header">
      <div className="main-admin-header-content">
        <div className="main-admin-header-left">
          {onMenuToggle && (
            <button
              type="button"
              className="main-admin-menu-toggle"
              onClick={(e) => { e.stopPropagation(); onMenuToggle(); }}
              aria-label={language === 'en' ? 'Open menu' : 'فتح القائمة'}
            >
              <span /><span /><span />
            </button>
          )}
          <h1 className="main-admin-page-title">
            {language === 'en' ? 'Main Admin Panel' : 'لوحة التحكم الرئيسية'}
          </h1>
          <span className="main-admin-subtitle">
            {language === 'en' ? 'Manage all clubs and system settings' : 'إدارة جميع الأندية وإعدادات النظام'}
          </span>
        </div>
        <div className="main-admin-header-right">
          <button
            className="header-language-toggle"
            onClick={() => onLanguageChange(language === 'en' ? 'ar' : 'en')}
            title={language === 'en' ? 'العربية' : 'English'}
          >
            <LanguageIcon lang={language === 'en' ? 'ar' : 'en'} size={18} />
          </button>
        </div>
      </div>
    </header>
  )
}

export default MainAdminHeader
