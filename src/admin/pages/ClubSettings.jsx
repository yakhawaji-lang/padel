import React, { useState, useEffect } from 'react'
import './club-pages-common.css'
import './ClubSettings.css'
import '../pages/common.css'
import SocialIcon, { PLATFORMS } from '../../components/SocialIcon'

const t = (en, ar, lang) => (lang === 'ar' ? ar : en)

const ClubSettings = ({ club, language = 'en', onUpdateClub, onDefaultLanguageChange }) => {
  const lang = language || 'en'
  const [formData, setFormData] = useState({
    name: '',
    nameAr: '',
    logo: '',
    banner: '',
    headerBgColor: '#ffffff',
    headerTextColor: '#0f172a',
    heroBgColor: '#ffffff',
    heroBgOpacity: 85,
    heroTitleColor: '#0f172a',
    heroTextColor: '#475569',
    heroStatsColor: '#0f172a',
    tagline: '',
    taglineAr: '',
    address: '',
    addressAr: '',
    phone: '',
    email: '',
    website: '',
    playtomicVenueId: '',
    playtomicApiKey: '',
    defaultLanguage: 'en',
    timezone: 'Asia/Riyadh',
    currency: 'SAR',
    bookingDuration: 60,
    maxBookingAdvance: 30,
    cancellationPolicy: 24,
    openingTime: '06:00',
    closingTime: '23:00'
  })
  const [activeTab, setActiveTab] = useState('basic')
  const [socialLinks, setSocialLinks] = useState([])
  const [courts, setCourts] = useState([])
  const [editingCourt, setEditingCourt] = useState(null)
  const [courtForm, setCourtForm] = useState({
    name: '',
    nameAr: '',
    type: 'indoor',
    maintenance: false,
    image: ''
  })

  // Sync from club only when switching clubs (club?.id). Avoid overwriting local edits when clubs-synced fires.
  useEffect(() => {
    if (club) {
      setFormData({
        name: club?.name || '',
        nameAr: club?.nameAr || '',
        logo: club?.logo || '',
        banner: club?.banner || '',
        headerBgColor: club?.settings?.headerBgColor || '#ffffff',
        headerTextColor: club?.settings?.headerTextColor || '#0f172a',
        heroBgColor: club?.settings?.heroBgColor || '#ffffff',
        heroBgOpacity: club?.settings?.heroBgOpacity ?? 85,
        heroTitleColor: club?.settings?.heroTitleColor || '#0f172a',
        heroTextColor: club?.settings?.heroTextColor || '#475569',
        heroStatsColor: club?.settings?.heroStatsColor || '#0f172a',
        tagline: club?.tagline || '',
        taglineAr: club?.taglineAr || '',
        address: club?.address || '',
        addressAr: club?.addressAr || '',
        phone: club?.phone || '',
        email: club?.email || '',
        website: club?.website || '',
        playtomicVenueId: club?.playtomicVenueId || '',
        playtomicApiKey: club?.playtomicApiKey || '',
        defaultLanguage: club?.settings?.defaultLanguage || 'en',
        timezone: club?.settings?.timezone || 'Asia/Riyadh',
        currency: club?.settings?.currency || 'SAR',
        bookingDuration: club?.settings?.bookingDuration || 60,
        maxBookingAdvance: club?.settings?.maxBookingAdvance || 30,
        cancellationPolicy: club?.settings?.cancellationPolicy || 24,
        openingTime: club?.settings?.openingTime || '06:00',
        closingTime: club?.settings?.closingTime || '23:00'
      })
      setCourts(club?.courts || [])
      setSocialLinks(club?.settings?.socialLinks || [])
    }
  }, [club?.id])

  if (!club) {
    return (
      <div className="club-admin-page">
        <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>
      </div>
    )
  }

  const handleSave = () => {
    if (formData.openingTime && formData.closingTime && formData.openingTime >= formData.closingTime) {
      alert(t('Closing time must be after opening time.', 'وقت الإغلاق يجب أن يكون بعد وقت الفتح.', lang))
      return
    }
    const updates = {
      name: formData.name,
      nameAr: formData.nameAr,
      logo: formData.logo || '',
      banner: formData.banner || '',
      tagline: formData.tagline,
      taglineAr: formData.taglineAr,
      address: formData.address,
      addressAr: formData.addressAr,
      phone: formData.phone,
      email: formData.email,
      website: formData.website,
      playtomicVenueId: formData.playtomicVenueId,
      playtomicApiKey: formData.playtomicApiKey,
      courts: courts,
      settings: {
        ...club?.settings,
        defaultLanguage: formData.defaultLanguage,
        timezone: formData.timezone,
        currency: formData.currency,
        bookingDuration: formData.bookingDuration,
        maxBookingAdvance: formData.maxBookingAdvance,
        cancellationPolicy: formData.cancellationPolicy,
        openingTime: formData.openingTime,
        closingTime: formData.closingTime,
        headerBgColor: formData.headerBgColor || '#ffffff',
        headerTextColor: formData.headerTextColor || '#0f172a',
        heroBgColor: formData.heroBgColor || '#ffffff',
        heroBgOpacity: formData.heroBgOpacity ?? 85,
        heroTitleColor: formData.heroTitleColor || '#0f172a',
        heroTextColor: formData.heroTextColor || '#475569',
        heroStatsColor: formData.heroStatsColor || '#0f172a',
        socialLinks: socialLinks
      }
    }
    onUpdateClub(updates)
    if (typeof onDefaultLanguageChange === 'function' && updates.settings?.defaultLanguage) {
      onDefaultLanguageChange(updates.settings.defaultLanguage)
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('clubs-synced'))
    }
    alert(t('Settings saved successfully!', 'تم حفظ الإعدادات بنجاح!', lang))
  }

  const handleAddCourt = () => {
    if (!courtForm.name.trim()) {
      alert(t('Court name is required', 'اسم الملعب مطلوب', lang))
      return
    }
    const newCourt = {
      id: 'court-' + Date.now(),
      name: courtForm.name,
      nameAr: courtForm.nameAr || courtForm.name,
      type: courtForm.type,
      maintenance: courtForm.maintenance || false,
      image: courtForm.image || undefined
    }
    const nextCourts = [...courts, newCourt]
    setCourts(nextCourts)
    setCourtForm({ name: '', nameAr: '', type: 'indoor', maintenance: false, image: '' })
    onUpdateClub({ courts: nextCourts })
  }

  const handleEditCourt = (court) => {
    setEditingCourt(court)
    setCourtForm({
      name: court.name,
      nameAr: court.nameAr || '',
      type: court.type || 'indoor',
      maintenance: court.maintenance || false,
      image: court.image || ''
    })
  }

  const handleUpdateCourt = () => {
    if (!courtForm.name.trim()) {
      alert(t('Court name is required', 'اسم الملعب مطلوب', lang))
      return
    }
    const updatedCourts = courts.map(c => 
      c.id === editingCourt.id 
        ? { ...c, name: courtForm.name, nameAr: courtForm.nameAr || courtForm.name, type: courtForm.type, maintenance: courtForm.maintenance, image: courtForm.image || undefined }
        : c
    )
    setCourts(updatedCourts)
    setEditingCourt(null)
    setCourtForm({ name: '', nameAr: '', type: 'indoor', maintenance: false, image: '' })
    onUpdateClub({ courts: updatedCourts })
  }

  const handleDeleteCourt = (courtId) => {
    if (window.confirm(t('Are you sure you want to delete this court?', 'هل أنت متأكد من حذف هذا الملعب؟', lang))) {
      const nextCourts = courts.filter(c => c.id !== courtId)
      setCourts(nextCourts)
      onUpdateClub({ courts: nextCourts })
    }
  }

  const handleCancelEdit = () => {
    setEditingCourt(null)
    setCourtForm({ name: '', nameAr: '', type: 'indoor', maintenance: false, image: '' })
  }

  const handleToggleMaintenance = (courtId) => {
    const updatedCourts = courts.map(c => 
      c.id === courtId 
        ? { ...c, maintenance: !c.maintenance }
        : c
    )
    setCourts(updatedCourts)
    onUpdateClub({ courts: updatedCourts })
  }

  const tabs = [
    { id: 'basic', label: t('Basic Information', 'المعلومات الأساسية', lang), icon: '📋' },
    { id: 'playtomic', label: 'Playtomic', icon: '🎾' },
    { id: 'general', label: t('General', 'عام', lang), icon: '⚙️' },
    { id: 'booking', label: t('Booking', 'الحجز', lang), icon: '📅' },
    { id: 'courts', label: t('Courts', 'الملاعب', lang), icon: '🏟️' },
    { id: 'hours', label: t('Club Hours', 'أوقات العمل', lang), icon: '🕐' },
    { id: 'social', label: t('Social Media', 'التواصل الاجتماعي', lang), icon: '🔗' }
  ]

  return (
    <div className="club-admin-page">
      <header className="cxp-header">
        <div className="cxp-header-title-wrap">
          <h1 className="cxp-title">
            {club.logo && <img src={club.logo} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'contain' }} />}
            {t('Club Settings', 'إعدادات النادي', lang)} — {lang === 'ar' ? (club.nameAr || club.name) : club.name}
          </h1>
          <p className="cxp-subtitle">{t('Manage your club profile and preferences', 'إدارة الملف الشخصي والإعدادات للنادي', lang)}</p>
        </div>
        <div className="cxp-header-actions">
          <button type="button" className="cxp-btn cxp-btn--primary" onClick={handleSave}>
            ✓ {t('Save Settings', 'حفظ الإعدادات', lang)}
          </button>
        </div>
      </header>
      <div className="club-settings">
        <div className="club-settings-tabs">
          {tabs.map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              className={`club-settings-tab ${activeTab === id ? 'active' : ''}`}
              onClick={() => setActiveTab(id)}
            >
              <span className="tab-icon">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="settings-sections">
          {activeTab === 'basic' && (
          <div className="settings-section">
            <h3 className="settings-section-title">
              <span className="section-icon">📋</span>
              {t('Basic Information', 'المعلومات الأساسية', lang)}
            </h3>

            <div className="settings-field-group">
              <h4 className="field-group-title">{t('Club Names', 'أسماء النادي', lang)}</h4>
              <div className="form-row form-row-2">
                <div className="form-group settings-field">
                  <label className="field-label">{t('Club Name (English)', 'اسم النادي (إنجليزي)', lang)} *</label>
                  <input
                    type="text"
                    className="settings-input"
                    placeholder={t('e.g. Premium Padel Club', 'مثال: نادي البادل المميز')}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="form-group settings-field">
                  <label className="field-label">{t('Club Name (Arabic)', 'اسم النادي (عربي)', lang)}</label>
                  <input
                    type="text"
                    className="settings-input"
                    placeholder={t('e.g. نادي البادل المميز', 'مثال: نادي البادل المميز')}
                    value={formData.nameAr}
                    onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="settings-field-group">
              <h4 className="field-group-title">{t('Logo & Banner', 'الشعار والبنر', lang)}</h4>
              <div className="form-group settings-field">
                <label className="field-label">{t('Club Logo', 'شعار النادي', lang)}</label>
                <p className="field-hint">{t('URL or upload image. Shown in header and listings.', 'رابط URL أو رفع صورة. يُعرض في الهيدر والقوائم.')}</p>
              <div className="media-input-row">
                <input
                  type="text"
                  placeholder="https://..."
                  value={formData.logo}
                  onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                  className="media-url-input"
                />
                <label className="btn-upload">
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) { const r = new FileReader(); r.onload = () => setFormData(prev => ({ ...prev, logo: r.result })); r.readAsDataURL(file) }
                    e.target.value = ''
                  }} />
                  📤 {t('Upload', 'رفع', lang)}
                </label>
              </div>
              {formData.logo && (
                <div className="media-preview-row">
                  <img src={formData.logo} alt="Logo" className="media-preview" />
                  <button type="button" className="btn-remove-media" onClick={() => setFormData(prev => ({ ...prev, logo: '' }))}>✕ {t('Remove', 'إزالة', lang)}</button>
                </div>
              )}
            </div>
            <div className="form-group settings-field">
              <label className="field-label">{t('Club Banner', 'بنر النادي', lang)}</label>
              <p className="field-hint">{t('Displayed at top of club page. Recommended: 1200×400px.', 'يُعرض في أعلى صفحة النادي. يُفضّل: 1200×400 بكسل.')}</p>
              <div className="media-input-row">
                <input type="text" placeholder="https://..." value={formData.banner} onChange={(e) => setFormData({ ...formData, banner: e.target.value })} className="media-url-input" />
                <label className="btn-upload">
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) { const r = new FileReader(); r.onload = () => setFormData(prev => ({ ...prev, banner: r.result })); r.readAsDataURL(file) }
                    e.target.value = ''
                  }} />
                  📤 {t('Upload', 'رفع', lang)}
                </label>
              </div>
              {formData.banner && (
                <div className="media-preview-row banner-preview-row">
                  <img src={formData.banner} alt="Banner" className="banner-preview-img" />
                  <button type="button" className="btn-remove-media" onClick={() => setFormData(prev => ({ ...prev, banner: '' }))}>✕ {t('Remove', 'إزالة', lang)}</button>
                </div>
              )}
            </div>
            </div>

            <div className="settings-field-group">
              <h4 className="field-group-title">{t('Header Colors', 'ألوان الهيدر', lang)}</h4>
              <p className="field-hint field-hint-block">{t('Colors for the section above the banner.', 'ألوان القسم فوق البنر.')}</p>
              <div className="form-row form-row-2 color-fields-row">
                <div className="color-field">
                  <label>{t('Background', 'الخلفية', lang)}</label>
                  <div className="color-input-wrap">
                    <input type="color" value={formData.headerBgColor} onChange={(e) => setFormData({ ...formData, headerBgColor: e.target.value })} className="color-picker" />
                    <input type="text" value={formData.headerBgColor} onChange={(e) => setFormData({ ...formData, headerBgColor: e.target.value })} placeholder="#ffffff" className="color-hex-input" />
                  </div>
                </div>
                <div className="color-field">
                  <label>{t('Text', 'النص', lang)}</label>
                  <div className="color-input-wrap">
                    <input type="color" value={formData.headerTextColor} onChange={(e) => setFormData({ ...formData, headerTextColor: e.target.value })} className="color-picker" />
                    <input type="text" value={formData.headerTextColor} onChange={(e) => setFormData({ ...formData, headerTextColor: e.target.value })} placeholder="#0f172a" className="color-hex-input" />
                  </div>
                </div>
              </div>
            </div>

            <div className="settings-field-group">
              <h4 className="field-group-title">{t('Hero Card (on banner)', 'بطاقة البنر', lang)}</h4>
              <p className="field-hint field-hint-block">{t('Card overlay colors and transparency.', 'ألوان وشفافية البطاقة فوق البنر.')}</p>
              <div className="form-row form-row-multi hero-color-row">
                <div className="form-group settings-field compact">
                  <label className="field-label">{t('Opacity (%)', 'الشفافية', lang)}</label>
                  <input type="number" min="0" max="100" value={formData.heroBgOpacity} onChange={(e) => setFormData({ ...formData, heroBgOpacity: Number(e.target.value) || 85 })} className="settings-input" />
                </div>
                <div className="color-field">
                  <label>{t('Background', 'الخلفية', lang)}</label>
                  <div className="color-input-wrap">
                    <input type="color" value={formData.heroBgColor} onChange={(e) => setFormData({ ...formData, heroBgColor: e.target.value })} className="color-picker" />
                    <input type="text" value={formData.heroBgColor} onChange={(e) => setFormData({ ...formData, heroBgColor: e.target.value })} className="color-hex-input" />
                  </div>
                </div>
                <div className="color-field">
                  <label>{t('Title', 'العنوان', lang)}</label>
                  <div className="color-input-wrap">
                    <input type="color" value={formData.heroTitleColor} onChange={(e) => setFormData({ ...formData, heroTitleColor: e.target.value })} className="color-picker" />
                    <input type="text" value={formData.heroTitleColor} onChange={(e) => setFormData({ ...formData, heroTitleColor: e.target.value })} className="color-hex-input" />
                  </div>
                </div>
                <div className="color-field">
                  <label>{t('Description', 'الوصف', lang)}</label>
                  <div className="color-input-wrap">
                    <input type="color" value={formData.heroTextColor} onChange={(e) => setFormData({ ...formData, heroTextColor: e.target.value })} className="color-picker" />
                    <input type="text" value={formData.heroTextColor} onChange={(e) => setFormData({ ...formData, heroTextColor: e.target.value })} className="color-hex-input" />
                  </div>
                </div>
                <div className="color-field">
                  <label>{t('Stats', 'الإحصائيات', lang)}</label>
                  <div className="color-input-wrap">
                    <input type="color" value={formData.heroStatsColor} onChange={(e) => setFormData({ ...formData, heroStatsColor: e.target.value })} className="color-picker" />
                    <input type="text" value={formData.heroStatsColor} onChange={(e) => setFormData({ ...formData, heroStatsColor: e.target.value })} className="color-hex-input" />
                  </div>
                </div>
              </div>
            </div>

            <div className="settings-field-group">
              <h4 className="field-group-title">{t('Tagline & Description', 'الشعار والوصف', lang)}</h4>
              <div className="form-row form-row-2">
                <div className="form-group settings-field">
                  <label className="field-label">{t('Tagline (English)', 'الشعار (إنجليزي)', lang)}</label>
                  <input type="text" className="settings-input" placeholder={t('e.g. Indoor courts • King of the Court', 'مثال: ملاعب داخلية • ملك الملعب')} value={formData.tagline} onChange={(e) => setFormData({ ...formData, tagline: e.target.value })} />
                </div>
                <div className="form-group settings-field">
                  <label className="field-label">{t('Tagline (Arabic)', 'الشعار (عربي)', lang)}</label>
                  <input type="text" className="settings-input" placeholder={t('مثال: ملاعب داخلية • ملك الملعب', 'مثال: ملاعب داخلية • ملك الملعب')} value={formData.taglineAr} onChange={(e) => setFormData({ ...formData, taglineAr: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="settings-field-group">
              <h4 className="field-group-title">{t('Contact Information', 'معلومات التواصل', lang)}</h4>
              <div className="form-row form-row-2">
                <div className="form-group settings-field">
                  <label className="field-label">{t('Address (English)', 'العنوان (إنجليزي)', lang)}</label>
                  <input type="text" className="settings-input" placeholder={t('Street, City', 'الشارع، المدينة')} value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
                </div>
                <div className="form-group settings-field">
                  <label className="field-label">{t('Address (Arabic)', 'العنوان (عربي)', lang)}</label>
                  <input type="text" className="settings-input" value={formData.addressAr} onChange={(e) => setFormData({ ...formData, addressAr: e.target.value })} />
                </div>
                <div className="form-group settings-field">
                  <label className="field-label">{t('Phone', 'الهاتف', lang)}</label>
                  <input type="tel" className="settings-input" placeholder="+966..." value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                </div>
                <div className="form-group settings-field">
                  <label className="field-label">{t('Email', 'البريد الإلكتروني', lang)}</label>
                  <input type="email" className="settings-input" placeholder="info@club.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div className="form-group settings-field full-width">
                  <label className="field-label">{t('Website', 'الموقع الإلكتروني', lang)}</label>
                  <input type="url" className="settings-input" placeholder="https://..." value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} />
                </div>
              </div>
            </div>
          </div>
          )}

          {activeTab === 'playtomic' && (
          <div className="settings-section">
            <h3 className="settings-section-title">
              <span className="section-icon">🎾</span>
              Playtomic Integration
            </h3>
            <p className="field-hint field-hint-block">{t('Connect your club to Playtomic for court bookings.', 'ربط النادي بـ Playtomic لحجوزات الملاعب.')}</p>
            <div className="settings-field-group">
              <div className="form-row form-row-2">
                <div className="form-group settings-field">
                  <label className="field-label">{t('Playtomic Venue ID', 'معرف المكان')}</label>
                  <input type="text" className="settings-input" placeholder="e.g. hala-padel" value={formData.playtomicVenueId} onChange={(e) => setFormData({ ...formData, playtomicVenueId: e.target.value })} />
                </div>
                <div className="form-group settings-field">
                  <label className="field-label">{t('Playtomic API Key', 'مفتاح API')}</label>
                  <input type="password" className="settings-input" placeholder={t('Enter your API key', 'أدخل مفتاح API')} value={formData.playtomicApiKey} onChange={(e) => setFormData({ ...formData, playtomicApiKey: e.target.value })} />
                </div>
              </div>
            </div>
          </div>
          )}

          {activeTab === 'general' && (
          <div className="settings-section">
            <h3 className="settings-section-title">
              <span className="section-icon">⚙️</span>
              {t('General Settings', 'الإعدادات العامة', lang)}
            </h3>
            <div className="settings-field-group">
              <div className="form-row form-row-2">
                <div className="form-group settings-field">
                  <label className="field-label">{t('Default Language', 'اللغة الافتراضية', lang)}</label>
                  <select className="settings-select" value={formData.defaultLanguage} onChange={(e) => setFormData({ ...formData, defaultLanguage: e.target.value })}>
                    <option value="en">English</option>
                    <option value="ar">العربية</option>
                  </select>
                </div>
                <div className="form-group settings-field">
                  <label className="field-label">{t('Timezone', 'المنطقة الزمنية', lang)}</label>
                  <input type="text" className="settings-input" placeholder="Asia/Riyadh" value={formData.timezone} onChange={(e) => setFormData({ ...formData, timezone: e.target.value })} />
                </div>
                <div className="form-group settings-field">
                  <label className="field-label">{t('Currency', 'العملة', lang)}</label>
                  <select className="settings-select" value={formData.currency} onChange={(e) => setFormData({ ...formData, currency: e.target.value })}>
                    <option value="SAR">SAR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="AED">AED</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          )}

          {activeTab === 'booking' && (
          <div className="settings-section">
            <h3 className="settings-section-title">
              <span className="section-icon">📅</span>
              {t('Booking Settings', 'إعدادات الحجز', lang)}
            </h3>
            <p className="field-hint field-hint-block">{t('Configure how court bookings work.', 'إعداد آلية حجز الملاعب.')}</p>
            <div className="settings-field-group">
              <div className="form-row form-row-3">
                <div className="form-group settings-field">
                  <label className="field-label">{t('Booking Duration (min)', 'مدة الحجز (دقيقة)', lang)}</label>
                  <input type="number" className="settings-input" min={30} step={30} value={formData.bookingDuration} onChange={(e) => setFormData({ ...formData, bookingDuration: parseInt(e.target.value) || 60 })} />
                </div>
                <div className="form-group settings-field">
                  <label className="field-label">{t('Max Advance (days)', 'الحد الأقصى للحجز مسبقاً (يوم)', lang)}</label>
                  <input type="number" className="settings-input" min={1} value={formData.maxBookingAdvance} onChange={(e) => setFormData({ ...formData, maxBookingAdvance: parseInt(e.target.value) || 30 })} />
                </div>
                <div className="form-group settings-field">
                  <label className="field-label">{t('Cancellation (hours before)', 'الإلغاء (ساعات قبل)', lang)}</label>
                  <input type="number" className="settings-input" min={0} value={formData.cancellationPolicy} onChange={(e) => setFormData({ ...formData, cancellationPolicy: parseInt(e.target.value) || 24 })} />
                </div>
              </div>
            </div>
          </div>
          )}

          {activeTab === 'courts' && (
          <div className="settings-section">
            <h3 className="settings-section-title">
              <span className="section-icon">🏟️</span>
              {t('Courts Management', 'إدارة الملاعب', lang)}
            </h3>
            <div className="courts-list">
              {courts.length > 0 ? (
                <div className="courts-table">
                  <table className="courts-table-content">
                    <thead>
                      <tr>
                        <th>{t('Image', 'الصورة', lang)}</th>
                        <th>{t('Name (English)', 'الاسم (إنجليزي)', lang)}</th>
                        <th>{t('Name (Arabic)', 'الاسم (عربي)', lang)}</th>
                        <th>{t('Type', 'النوع', lang)}</th>
                        <th>{t('Status', 'الحالة', lang)}</th>
                        <th>{t('Actions', 'الإجراءات', lang)}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {courts.map(court => (
                        <tr key={court.id} className={court.maintenance ? 'court-maintenance' : ''}>
                          <td>{court.image ? <img src={court.image} alt="" style={{ width: 48, height: 36, objectFit: 'cover', borderRadius: 4 }} /> : '—'}</td>
                          <td>{court.name}</td>
                          <td>{court.nameAr || '-'}</td>
                          <td>
                            <span className={`court-type-badge ${court.type}`}>
                              {court.type === 'indoor' ? t('Indoor', 'داخلي', lang) : t('Outdoor', 'خارجي', lang)}
                            </span>
                          </td>
                          <td>
                            <span className={`court-status-badge ${court.maintenance ? 'maintenance' : 'active'}`}>
                              {court.maintenance ? '🔧 ' + t('Maintenance', 'صيانة', lang) : '✅ ' + t('Active', 'نشط', lang)}
                            </span>
                          </td>
                          <td>
                            <div className="court-actions">
                              <button 
                                className={`btn-maintenance btn-small ${court.maintenance ? 'btn-restore' : ''}`}
                                onClick={() => handleToggleMaintenance(court.id)}
                                title={court.maintenance ? t('Restore from maintenance', 'استعادة من الصيانة', lang) : t('Put under maintenance', 'وضع تحت الصيانة', lang)}
                              >
                                {court.maintenance ? '✅ ' + t('Restore', 'استعادة', lang) : '🔧 ' + t('Maintenance', 'صيانة', lang)}
                              </button>
                              <button className="btn-secondary btn-small" onClick={() => handleEditCourt(court)}>
                                {t('Edit', 'تعديل', lang)}
                              </button>
                              <button className="btn-danger btn-small" onClick={() => handleDeleteCourt(court.id)}>
                                {t('Delete', 'حذف', lang)}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">{t('No courts added yet', 'لم تتم إضافة ملاعب بعد', lang)}</div>
              )}
            </div>

            <div className="court-form">
              <h4 className="court-form-title">{editingCourt ? t('Edit Court', 'تعديل الملعب', lang) : t('Add New Court', 'إضافة ملعب جديد', lang)}</h4>
              <div className="form-row form-row-2 court-form-row">
                <div className="form-group settings-field">
                  <label className="field-label">{t('Court Name (English)', 'اسم الملعب (إنجليزي)', lang)} *</label>
                  <input type="text" className="settings-input" placeholder="e.g. Court 1" value={courtForm.name} onChange={(e) => setCourtForm({ ...courtForm, name: e.target.value })} />
                </div>
                <div className="form-group settings-field">
                  <label className="field-label">{t('Court Name (Arabic)', 'اسم الملعب (عربي)', lang)}</label>
                  <input type="text" className="settings-input" placeholder="مثال: الملعب 1" value={courtForm.nameAr} onChange={(e) => setCourtForm({ ...courtForm, nameAr: e.target.value })} />
                </div>
                <div className="form-group settings-field">
                  <label className="field-label">{t('Type', 'النوع', lang)}</label>
                  <select className="settings-select" value={courtForm.type} onChange={(e) => setCourtForm({ ...courtForm, type: e.target.value })}>
                    <option value="indoor">{t('Indoor', 'داخلي', lang)}</option>
                    <option value="outdoor">{t('Outdoor', 'خارجي', lang)}</option>
                  </select>
                </div>
                <div className="form-group settings-field checkbox-field">
                  <label className="checkbox-label">
                    <input type="checkbox" checked={courtForm.maintenance} onChange={(e) => setCourtForm({ ...courtForm, maintenance: e.target.checked })} className="settings-checkbox" />
                    {t('Under Maintenance', 'قيد الصيانة', lang)}
                  </label>
                </div>
              </div>
              <div className="form-group settings-field">
                <label className="field-label">{t('Court Image', 'صورة الملعب', lang)}</label>
                <p className="field-hint">{t('Shown in Facilities section on club page.', 'يُعرض في قسم المرافق والملاعب.')}</p>
                <div className="media-input-row">
                  <input type="text" placeholder="https://..." value={courtForm.image} onChange={(e) => setCourtForm({ ...courtForm, image: e.target.value })} className="media-url-input" />
                  <label className="btn-upload">
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) { const r = new FileReader(); r.onload = () => setCourtForm(prev => ({ ...prev, image: r.result })); r.readAsDataURL(file) }
                      e.target.value = ''
                    }} />
                    📤 {t('Upload', 'رفع', lang)}
                  </label>
                </div>
                {courtForm.image && (
                  <div className="media-preview-row">
                    <img src={courtForm.image} alt="Court" className="court-preview-img" />
                    <button type="button" className="btn-remove-media" onClick={() => setCourtForm(prev => ({ ...prev, image: '' }))}>✕ {t('Remove', 'إزالة', lang)}</button>
                  </div>
                )}
              </div>
              <div className="form-actions">
                {editingCourt ? (
                  <>
                    <button className="btn-primary" onClick={handleUpdateCourt}>{t('Update Court', 'تحديث الملعب', lang)}</button>
                    <button className="btn-secondary" onClick={handleCancelEdit}>{t('Cancel', 'إلغاء', lang)}</button>
                  </>
                ) : (
                  <button className="btn-primary" onClick={handleAddCourt}>+ {t('Add Court', 'إضافة ملعب', lang)}</button>
                )}
              </div>
            </div>
          </div>
          )}

          {activeTab === 'hours' && (
          <div className="settings-section">
            <h3 className="settings-section-title">
              <span className="section-icon">🕐</span>
              {t('Club Hours', 'أوقات العمل', lang)}
            </h3>
            <p className="field-hint field-hint-block">{t('Working hours. All bookings and tournaments are restricted to these times.', 'وقت عمل النادي. جميع الحجوزات والبطولات ضمن هذه الأوقات فقط.')}</p>
            <div className="settings-field-group hours-group">
              <div className="form-row form-row-2">
                <div className="form-group settings-field">
                  <label className="field-label">{t('Opening Time', 'من الساعة', lang)}</label>
                  <input type="time" className="settings-input settings-time-input" value={formData.openingTime} onChange={(e) => setFormData({ ...formData, openingTime: e.target.value })} />
                </div>
                <div className="form-group settings-field">
                  <label className="field-label">{t('Closing Time', 'إلى الساعة', lang)}</label>
                  <input type="time" className="settings-input settings-time-input" value={formData.closingTime} onChange={(e) => setFormData({ ...formData, closingTime: e.target.value })} />
                </div>
              </div>
              {formData.openingTime && formData.closingTime && formData.openingTime >= formData.closingTime && (
                <p className="field-error">{t('Closing time must be after opening time.', 'وقت الإغلاق يجب أن يكون بعد وقت الفتح.')}</p>
              )}
            </div>
          </div>
          )}

          {activeTab === 'social' && (
          <div className="settings-section">
            <h3 className="settings-section-title">
              <span className="section-icon">🔗</span>
              {t('Social Media', 'التواصل الاجتماعي', lang)}
            </h3>
            <p className="field-hint field-hint-block">{t('Social links appear in the header above the banner.', 'روابط التواصل تظهر في الشريط فوق البنر.')}</p>
            <div className="social-links-editor">
              {socialLinks.map((item, idx) => (
                <div key={idx} className="social-link-row">
                  <select
                    value={item.platform || 'facebook'}
                    onChange={(e) => {
                      const next = [...socialLinks]
                      next[idx] = { ...next[idx], platform: e.target.value }
                      setSocialLinks(next)
                    }}
                  >
                    {PLATFORMS.map(p => (
                      <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                    ))}
                  </select>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={item.url || ''}
                    onChange={(e) => {
                      const next = [...socialLinks]
                      next[idx] = { ...next[idx], url: e.target.value }
                      setSocialLinks(next)
                    }}
                  />
                  <div className="social-link-colors">
                    <input
                      type="color"
                      title="Icon / Background color — لون الأيقونة"
                      value={item.iconColor || '#1877f2'}
                      onChange={(e) => {
                        const next = [...socialLinks]
                        next[idx] = { ...next[idx], iconColor: e.target.value }
                        setSocialLinks(next)
                      }}
                    />
                    <input
                      type="color"
                      title="Icon fill / Text color — لون الخطوط"
                      value={item.textColor || '#ffffff'}
                      onChange={(e) => {
                        const next = [...socialLinks]
                        next[idx] = { ...next[idx], textColor: e.target.value }
                        setSocialLinks(next)
                      }}
                    />
                  </div>
                  <div className="social-link-preview">
                    <SocialIcon platform={item.platform} iconColor={item.iconColor} textColor={item.textColor} size={28} preview />
                  </div>
                  <button type="button" className="btn-danger btn-small" onClick={() => setSocialLinks(socialLinks.filter((_, i) => i !== idx))}>
                    {t('Remove', 'إزالة', lang)}
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn-secondary btn-add-social"
                onClick={() => setSocialLinks([...socialLinks, { platform: 'facebook', url: '', iconColor: '#1877f2', textColor: '#ffffff' }])}
              >
                + {t('Add social link', 'إضافة رابط', lang)}
              </button>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ClubSettings
