import React from 'react'
import LanguageIcon from '../../components/LanguageIcon'
import './ClubAdminHeader.css'

const ClubAdminHeader = ({ club, language, onLanguageChange, onMenuToggle }) => {
  return (
    <header className="club-admin-header">
      <div className="club-admin-header-content">
        <div className="club-admin-header-left">
          {onMenuToggle && (
            <button
              type="button"
              className="club-admin-menu-toggle"
              onClick={(e) => { e.stopPropagation(); onMenuToggle(); }}
              aria-label={language === 'en' ? 'Open menu' : 'فتح القائمة'}
            >
              <span /><span /><span />
            </button>
          )}
          <div className="club-admin-header-title-wrap">
            <h1 className="club-admin-page-title">
              {club.logo && <img src={club.logo} alt="" className="club-logo" />}
              <span className="title-text">{language === 'en' ? club.name : club.nameAr || club.name}</span>
            </h1>
            {club.address && (
              <span className="club-address">
                {language === 'en' ? club.address : club.addressAr || club.address}
              </span>
            )}
          </div>
        </div>
        <div className="club-admin-header-right">
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

export default ClubAdminHeader
