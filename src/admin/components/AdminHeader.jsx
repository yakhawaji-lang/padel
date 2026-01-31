import React from 'react'
import './AdminHeader.css'

const AdminHeader = ({ currentClub, language, onLanguageChange }) => {
  return (
    <header className="admin-header">
      <div className="admin-header-content">
        <div className="admin-header-left">
          <h1 className="admin-page-title">
            {currentClub?.logo && <img src={currentClub.logo} alt="" className="club-logo" />}
            {currentClub 
              ? (language === 'en' ? currentClub.name : currentClub.nameAr || currentClub.name)
              : (language === 'en' ? 'Admin Panel' : 'لوحة التحكم')
            }
          </h1>
          {currentClub && (
            <span className="club-address">
              {language === 'en' ? currentClub.address : currentClub.addressAr || currentClub.address}
            </span>
          )}
        </div>
        <div className="admin-header-right">
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

export default AdminHeader
