import React from 'react'
import './ClubAdminHeader.css'

const ClubAdminHeader = ({ club, language, onLanguageChange }) => {
  return (
    <header className="club-admin-header">
      <div className="club-admin-header-content">
        <div className="club-admin-header-left">
          <h1 className="club-admin-page-title">
            {club.logo && <img src={club.logo} alt="" className="club-logo" />}
            {language === 'en' ? club.name : club.nameAr || club.name}
          </h1>
          {club.address && (
            <span className="club-address">
              {language === 'en' ? club.address : club.addressAr || club.address}
            </span>
          )}
        </div>
        <div className="club-admin-header-right">
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

export default ClubAdminHeader
