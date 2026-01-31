import React from 'react'
import './MainAdminHeader.css'

const MainAdminHeader = ({ language, onLanguageChange, onMenuToggle }) => {
  return (
    <header className="main-admin-header">
      <div className="main-admin-header-content">
        <div className="main-admin-header-left">
          {onMenuToggle && (
            <button
              type="button"
              className="main-admin-menu-toggle"
              onClick={onMenuToggle}
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
          >
            {language === 'en' ? 'العربية' : 'English'}
          </button>
        </div>
      </div>
    </header>
  )
}

export default MainAdminHeader
