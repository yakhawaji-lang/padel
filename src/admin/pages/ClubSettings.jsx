import React, { useState, useEffect } from 'react'
import './club-pages-common.css'
import './ClubSettings.css'
import '../pages/common.css'
import SocialIcon, { PLATFORMS } from '../../components/SocialIcon'
import { getImageUrl } from '../../api/dbClient'
import { getLegacyOpenCloseBounds, timeToMinutes as whToMinutes } from '../../utils/clubWorkingHours'

const t = (en, ar, lang) => (lang === 'ar' ? ar : en)

const normalizeMMDD = (s) => {
  const raw = (s || '').toString().trim()
  const m = raw.match(/^(\d{1,2})-(\d{1,2})$/)
  if (!m) return '01-01'
  const mm = String(Math.min(12, Math.max(1, parseInt(m[1], 10)))).padStart(2, '0')
  const dd = String(Math.min(31, Math.max(1, parseInt(m[2], 10)))).padStart(2, '0')
  return `${mm}-${dd}`
}

const defaultWorkingHoursSeasons = () => ([{
  id: 'default',
  label: '',
  startDate: '01-01',
  endDate: '12-31',
  periods: [{ open: '06:00', close: '23:00' }]
}])

const seasonsFromClubSettings = (club) => {
  const wh = club?.settings?.workingHoursSeasons
  if (Array.isArray(wh) && wh.length > 0) {
    return wh.map((s, i) => ({
      id: (s.id || `season-${i}`).toString(),
      label: (s.label || '').toString(),
      startDate: normalizeMMDD(s.startDate || '01-01'),
      endDate: normalizeMMDD(s.endDate || '12-31'),
      periods: Array.isArray(s.periods) && s.periods.length > 0
        ? s.periods.map(p => ({
            open: (p.open || club?.settings?.openingTime || '06:00').toString().slice(0, 5),
            close: (p.close || club?.settings?.closingTime || '23:00').toString().slice(0, 5)
          }))
        : [{ open: club?.settings?.openingTime || '06:00', close: club?.settings?.closingTime || '23:00' }]
    }))
  }
  return defaultWorkingHoursSeasons().map((row) => ({
    ...row,
    periods: [{
      open: club?.settings?.openingTime || '06:00',
      close: club?.settings?.closingTime || '23:00'
    }]
  }))
}

// الحقول الخمسة لإعدادات الحجز — تُحفظ في padel_db (club_settings) وتُسترجع منها
const BOOKING_NUMBER_FIELDS = [
  { key: 'lockMinutes', default: 10, max: 60, labelEn: 'Lock (min)', labelAr: 'مهلة الحجز (دقيقة)', hintEn: 'Time to complete payment after selecting slot', hintAr: 'مهلة إتمام الدفع بعد اختيار الوقت' },
  { key: 'paymentDeadlineMinutes', default: 10, labelEn: 'Payment deadline (min)', labelAr: 'مهلة الدفع (دقيقة)' },
  { key: 'splitManageMinutes', default: 15, labelEn: 'Split manage (min)', labelAr: 'مهلة إدارة المشاركين (دقيقة)' },
  { key: 'splitPaymentDeadlineMinutes', default: 30, labelEn: 'Split payment deadline (min)', labelAr: 'مهلة دفعات المشاركين (دقيقة)' },
  { key: 'refundDays', default: 3, labelEn: 'Refund (days)', labelAr: 'مدة الاسترداد (أيام)' }
]
const BOOKING_CHECKBOX_FIELD = 'allowIncompleteBookings'
// الحقول الأربعة المعروضة: Lock، Split manage، Split payment deadline، Refund (paymentDeadlineMinutes يُحفظ ويُسترجع لكن لا يُعرض هنا)
const BOOKING_VISIBLE_NUMBER_FIELDS = BOOKING_NUMBER_FIELDS.filter(f => f.key !== 'paymentDeadlineMinutes')

/** مهلة دفع المشاركين لحجوزات البطولة (King / Social) — التمديد اليدوي يبقى من صفحة الحجوزات */
const TOURNAMENT_SPLIT_DEADLINE_FIELDS = [
  {
    key: 'tournamentKingSplitPaymentDeadlineMinutes',
    default: 30,
    max: 43200,
    /** تسمية ثنائية اللغة في واجهة واحدة (كما طُلب في إعدادات النادي) */
    labelBilingual:
      'King of the Court — participant payment deadline (min) / ملك الملعب — مهلة دفع المشاركين (دقيقة)',
    hintEn: 'How long participants have to register and pay their share. Max 43200 (30 days). You can extend a booking later from Bookings (same as other split bookings).',
    hintAr: 'المدة المتاحة للمشاركين للتسجيل ودفع الحصص. الحد الأقصى 43200 دقيقة (30 يوماً). يمكن تمديد الحجز لاحقاً من صفحة الحجوزات كباقي الحجوزات المشتركة.',
  },
  {
    key: 'tournamentSocialSplitPaymentDeadlineMinutes',
    default: 30,
    max: 43200,
    labelBilingual:
      'Social Tournament — participant payment deadline (min) / بطولة سوشيال — مهلة دفع المشاركين (دقيقة)',
    hintEn: 'Same as above for Social Tournament bookings.',
    hintAr: 'نفس المهلة لحجوزات بطولة السوشيال.',
  },
]
const BOOKING_CONFIRM_NUMBER_FIELDS = [...BOOKING_VISIBLE_NUMBER_FIELDS, ...TOURNAMENT_SPLIT_DEADLINE_FIELDS]

/** Always return a number for display in number inputs (avoids dot/empty); 0 is valid. */
const numDisplay = (val, fallback) => {
  if (val === undefined || val === null || val === '') return fallback
  const n = Number(val)
  return Number.isNaN(n) ? fallback : n
}

/** For save payload: number or default; 0 is valid and must be sent to DB. */
const toNum = (val, fallback) => {
  if (val === undefined || val === null || val === '') return fallback
  const n = Number(val)
  return Number.isNaN(n) ? fallback : n
}

const ClubSettings = ({ club, language = 'en', onUpdateClub, onDefaultLanguageChange }) => {
  const lang = language || 'en'
  const formDataRef = React.useRef(null)
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
    ...BOOKING_NUMBER_FIELDS.reduce((acc, { key, default: d }) => ({ ...acc, [key]: d }), {}),
    ...TOURNAMENT_SPLIT_DEADLINE_FIELDS.reduce((acc, { key, default: d }) => ({ ...acc, [key]: d }), {}),
    [BOOKING_CHECKBOX_FIELD]: false,
    workingHoursSeasons: defaultWorkingHoursSeasons()
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

  // Sync form from club when club loads or after refresh (club?.id, club?.updatedAt so we pick up fresh DB data)
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
        ...BOOKING_NUMBER_FIELDS.reduce((acc, { key, default: d }) => ({ ...acc, [key]: numDisplay(club?.settings?.[key], d) }), {}),
        ...TOURNAMENT_SPLIT_DEADLINE_FIELDS.reduce((acc, { key, default: d }) => ({ ...acc, [key]: numDisplay(club?.settings?.[key], d) }), {}),
        [BOOKING_CHECKBOX_FIELD]: !!club?.settings?.[BOOKING_CHECKBOX_FIELD],
        workingHoursSeasons: seasonsFromClubSettings(club)
      })
      setCourts(club?.courts || [])
      setSocialLinks(club?.settings?.socialLinks || [])
    }
  }, [club?.id, club?.updatedAt])

  formDataRef.current = formData

  if (!club) {
    return (
      <div className="club-admin-page">
        <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>
      </div>
    )
  }

  const [isSaving, setIsSaving] = useState(false)
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)
  const [pendingUpdates, setPendingUpdates] = useState(null)

  const buildUpdates = (data) => {
    const fd = data ?? formDataRef.current ?? formData
    const rawSeasons = Array.isArray(fd.workingHoursSeasons) ? fd.workingHoursSeasons : defaultWorkingHoursSeasons()
    const workingHoursSeasons = rawSeasons.map((s, i) => ({
      id: (s.id || `season-${i}`).toString(),
      label: (s.label || '').toString().trim(),
      startDate: normalizeMMDD(s.startDate),
      endDate: normalizeMMDD(s.endDate),
      periods: (Array.isArray(s.periods) ? s.periods : [])
        .map(p => ({
          open: (p.open || '06:00').toString().slice(0, 5),
          close: (p.close || '23:00').toString().slice(0, 5)
        }))
        .filter(p => whToMinutes(p.open) !== whToMinutes(p.close))
    })).filter(s => s.periods.length > 0)
    const legacyBounds = getLegacyOpenCloseBounds({
      ...club?.settings,
      workingHoursSeasons: workingHoursSeasons.length > 0 ? workingHoursSeasons : undefined,
      openingTime: club?.settings?.openingTime,
      closingTime: club?.settings?.closingTime
    })
    return {
      name: fd.name,
      nameAr: fd.nameAr,
      logo: fd.logo || '',
      banner: fd.banner || '',
      tagline: fd.tagline,
      taglineAr: fd.taglineAr,
      address: fd.address,
      addressAr: fd.addressAr,
      phone: fd.phone,
      email: fd.email,
      website: fd.website,
      playtomicVenueId: fd.playtomicVenueId,
      playtomicApiKey: fd.playtomicApiKey,
      courts: courts,
      settings: {
        ...club?.settings,
        defaultLanguage: fd.defaultLanguage,
        timezone: fd.timezone,
        currency: fd.currency,
        bookingDuration: Math.min(180, Math.max(15, Number(fd.bookingDuration) || 60)),
        preparationTimeMinutes: 0,
        maxBookingAdvance: Math.max(1, Number(fd.maxBookingAdvance) || 30),
        cancellationPolicy: Math.max(0, Number(fd.cancellationPolicy) || 24),
        ...BOOKING_NUMBER_FIELDS.reduce((acc, { key, default: d }) => ({ ...acc, [key]: toNum(fd[key], d) }), {}),
        ...TOURNAMENT_SPLIT_DEADLINE_FIELDS.reduce((acc, { key, default: d }) => ({ ...acc, [key]: toNum(fd[key], d) }), {}),
        [BOOKING_CHECKBOX_FIELD]: !!fd[BOOKING_CHECKBOX_FIELD],
        workingHoursSeasons,
        openingTime: legacyBounds.openingTime,
        closingTime: legacyBounds.closingTime,
        headerBgColor: fd.headerBgColor || '#ffffff',
        headerTextColor: fd.headerTextColor || '#0f172a',
        heroBgColor: fd.heroBgColor || '#ffffff',
        heroBgOpacity: fd.heroBgOpacity ?? 85,
        heroTitleColor: fd.heroTitleColor || '#0f172a',
        heroTextColor: fd.heroTextColor || '#475569',
        heroStatsColor: fd.heroStatsColor || '#0f172a',
        socialLinks: socialLinks
      }
    }
  }

  const handleSaveClick = () => {
    const fd = formDataRef.current ?? formData
    const seasons = Array.isArray(fd.workingHoursSeasons) ? fd.workingHoursSeasons : []
    if (seasons.length === 0) {
      alert(t('Add at least one season with working periods.', 'أضف موسماً واحداً على الأقل مع فترات العمل.', lang))
      return
    }
    for (let si = 0; si < seasons.length; si++) {
      const s = seasons[si]
      const periods = Array.isArray(s.periods) ? s.periods : []
      if (periods.length === 0) {
        alert(t(`Season ${si + 1}: add at least one open/close period.`, `الموسم ${si + 1}: أضف فترة فتح وإغلاق واحدة على الأقل.`, lang))
        return
      }
      for (let pi = 0; pi < periods.length; pi++) {
        const p = periods[pi]
        if (whToMinutes(p.open) === whToMinutes(p.close)) {
          alert(t(`Period ${pi + 1}: open and close cannot be equal.`, `الفترة ${pi + 1}: وقت الفتح والإغلاق لا يمكن أن يكونا متطابقين.`, lang))
          return
        }
      }
    }
    setPendingUpdates(buildUpdates(fd))
    setShowSaveConfirm(true)
  }

  const handleSaveConfirm = async () => {
    if (!showSaveConfirm) return
    setShowSaveConfirm(false)
    setIsSaving(true)
    const updates = buildUpdates(formDataRef.current ?? formData)
    setPendingUpdates(null)
    try {
      await onUpdateClub(updates)
      if (typeof onDefaultLanguageChange === 'function' && updates.settings?.defaultLanguage) {
        onDefaultLanguageChange(updates.settings.defaultLanguage)
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('clubs-synced'))
      }
      alert(t('Settings saved successfully!', 'تم حفظ الإعدادات بنجاح!', lang))
    } catch (e) {
      console.error('Save failed:', e)
      const raw = e?.message || t('Failed to save settings. Please try again.', 'فشل حفظ الإعدادات. يرجى المحاولة مرة أخرى.', lang)
      const hint = (e?.status === 404 || /not found|404/i.test(String(raw)))
        ? t(' (Make sure the API server is running: npm run dev:api on port 4000)', ' (تأكد من تشغيل خادم الـ API: npm run dev:api على المنفذ 4000)', lang)
        : ''
      alert(raw + hint)
    } finally {
      setIsSaving(false)
    }
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
          <button type="button" className="cxp-btn cxp-btn--primary" onClick={handleSaveClick} disabled={isSaving}>
            {isSaving ? t('Saving...', 'جاري الحفظ...', lang) : `✓ ${t('Save Settings', 'حفظ الإعدادات', lang)}`}
          </button>
        </div>
      </header>

      {showSaveConfirm && pendingUpdates?.settings && (
        <div className="cxp-modal-backdrop" onClick={() => { setShowSaveConfirm(false); setPendingUpdates(null) }} role="presentation">
          <div className="cxp-modal" onClick={e => e.stopPropagation()} role="dialog" aria-labelledby="save-confirm-title" aria-modal="true">
            <div className="cxp-modal-header">
              <h3 id="save-confirm-title">{t('Confirm Save', 'تأكيد الحفظ', lang)}</h3>
              <button type="button" className="cxp-modal-close" onClick={() => { setShowSaveConfirm(false); setPendingUpdates(null) }} aria-label="Close">&times;</button>
            </div>
            <div className="cxp-modal-body">
              <p className="field-hint field-hint-block" style={{ marginBottom: 16 }}>{t('Review booking settings before saving:', 'مراجعة إعدادات الحجز قبل الحفظ:', lang)}</p>
              <ul className="save-confirm-values" style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.95rem' }}>
                {BOOKING_CONFIRM_NUMBER_FIELDS.map((field) => {
                  const { key, default: def, labelBilingual, labelEn, labelAr } = field
                  const label = labelBilingual || t(labelEn, labelAr, lang)
                  return (
                    <li key={key} style={{ padding: '8px 0', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                      <span style={{ lineHeight: 1.35 }}>{label}</span>
                      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{String(numDisplay(pendingUpdates.settings[key], def))}</strong>
                    </li>
                  )
                })}
                <li style={{ padding: '8px 0', display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
                  <span>{t('Allow incomplete split bookings', 'السماح بحجوزات مشتركة غير مكتملة الدفع', lang)}</span>
                  <strong>{pendingUpdates.settings[BOOKING_CHECKBOX_FIELD] ? '✓ ' + t('Yes', 'نعم', lang) : '— ' + t('No', 'لا', lang)}</strong>
                </li>
              </ul>
              <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'flex-end' }}>
                <button type="button" className="cxp-btn cxp-btn--secondary" onClick={() => { setShowSaveConfirm(false); setPendingUpdates(null) }}>
                  {t('Cancel', 'إلغاء', lang)}
                </button>
                <button type="button" className="cxp-btn cxp-btn--primary" onClick={handleSaveConfirm}>
                  {t('Confirm & Save', 'تأكيد والحفظ', lang)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="form-group settings-field">
                  <label className="field-label">{t('Club Name (Arabic)', 'اسم النادي (عربي)', lang)}</label>
                  <input
                    type="text"
                    className="settings-input"
                    placeholder={t('e.g. نادي البادل المميز', 'مثال: نادي البادل المميز')}
                    value={formData.nameAr}
                    onChange={(e) => setFormData(prev => ({ ...prev, nameAr: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="settings-field-group">
              <h4 className="field-group-title">{t('Logo & Banner', 'الشعار والبنر', lang)}</h4>
              <div className="form-group settings-field">
                <label className="field-label">{t('Club Logo', 'شعار النادي', lang)}</label>
                <p className="field-hint">{t('URL or upload image. Shown in header and listings. Uploads are saved to Gallery and linked to the database.', 'رابط URL أو رفع صورة. يُعرض في الهيدر والقوائم. الصور المرفوعة تُحفظ في Gallery وترتبط بقاعدة البيانات.')}</p>
              <div className="media-input-row">
                <input
                  type="text"
                  placeholder="https://..."
                  value={formData.logo}
                  onChange={(e) => setFormData(prev => ({ ...prev, logo: e.target.value }))}
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
                  <img src={getImageUrl(formData.logo)} alt="Logo" className="media-preview" />
                  <button type="button" className="btn-remove-media" onClick={() => setFormData(prev => ({ ...prev, logo: '' }))}>✕ {t('Remove', 'إزالة', lang)}</button>
                </div>
              )}
            </div>
            <div className="form-group settings-field">
              <label className="field-label">{t('Club Banner', 'بنر النادي', lang)}</label>
              <p className="field-hint">{t('Displayed at top of club page. Recommended: 1200×400px. Uploads are saved to Gallery.', 'يُعرض في أعلى صفحة النادي. يُفضّل: 1200×400 بكسل. الصور المرفوعة تُحفظ في Gallery.')}</p>
              <div className="media-input-row">
                <input type="text" placeholder="https://..." value={formData.banner} onChange={(e) => setFormData(prev => ({ ...prev, banner: e.target.value }))} className="media-url-input" />
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
                  <img src={getImageUrl(formData.banner)} alt="Banner" className="banner-preview-img" />
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
                    <input type="color" value={formData.headerBgColor} onChange={(e) => setFormData(prev => ({ ...prev, headerBgColor: e.target.value }))} className="color-picker" />
                    <input type="text" value={formData.headerBgColor} onChange={(e) => setFormData(prev => ({ ...prev, headerBgColor: e.target.value }))} placeholder="#ffffff" className="color-hex-input" />
                  </div>
                </div>
                <div className="color-field">
                  <label>{t('Text', 'النص', lang)}</label>
                  <div className="color-input-wrap">
                    <input type="color" value={formData.headerTextColor} onChange={(e) => setFormData(prev => ({ ...prev, headerTextColor: e.target.value }))} className="color-picker" />
                    <input type="text" value={formData.headerTextColor} onChange={(e) => setFormData(prev => ({ ...prev, headerTextColor: e.target.value }))} placeholder="#0f172a" className="color-hex-input" />
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
                  <input type="number" min="0" max="100" value={formData.heroBgOpacity} onChange={(e) => setFormData(prev => ({ ...prev, heroBgOpacity: Number(e.target.value) || 85 }))} className="settings-input" />
                </div>
                <div className="color-field">
                  <label>{t('Background', 'الخلفية', lang)}</label>
                  <div className="color-input-wrap">
                    <input type="color" value={formData.heroBgColor} onChange={(e) => setFormData(prev => ({ ...prev, heroBgColor: e.target.value }))} className="color-picker" />
                    <input type="text" value={formData.heroBgColor} onChange={(e) => setFormData(prev => ({ ...prev, heroBgColor: e.target.value }))} className="color-hex-input" />
                  </div>
                </div>
                <div className="color-field">
                  <label>{t('Title', 'العنوان', lang)}</label>
                  <div className="color-input-wrap">
                    <input type="color" value={formData.heroTitleColor} onChange={(e) => setFormData(prev => ({ ...prev, heroTitleColor: e.target.value }))} className="color-picker" />
                    <input type="text" value={formData.heroTitleColor} onChange={(e) => setFormData(prev => ({ ...prev, heroTitleColor: e.target.value }))} className="color-hex-input" />
                  </div>
                </div>
                <div className="color-field">
                  <label>{t('Description', 'الوصف', lang)}</label>
                  <div className="color-input-wrap">
                    <input type="color" value={formData.heroTextColor} onChange={(e) => setFormData(prev => ({ ...prev, heroTextColor: e.target.value }))} className="color-picker" />
                    <input type="text" value={formData.heroTextColor} onChange={(e) => setFormData(prev => ({ ...prev, heroTextColor: e.target.value }))} className="color-hex-input" />
                  </div>
                </div>
                <div className="color-field">
                  <label>{t('Stats', 'الإحصائيات', lang)}</label>
                  <div className="color-input-wrap">
                    <input type="color" value={formData.heroStatsColor} onChange={(e) => setFormData(prev => ({ ...prev, heroStatsColor: e.target.value }))} className="color-picker" />
                    <input type="text" value={formData.heroStatsColor} onChange={(e) => setFormData(prev => ({ ...prev, heroStatsColor: e.target.value }))} className="color-hex-input" />
                  </div>
                </div>
              </div>
            </div>

            <div className="settings-field-group">
              <h4 className="field-group-title">{t('Tagline & Description', 'الشعار والوصف', lang)}</h4>
              <div className="form-row form-row-2">
                <div className="form-group settings-field">
                  <label className="field-label">{t('Tagline (English)', 'الشعار (إنجليزي)', lang)}</label>
                  <input type="text" className="settings-input" placeholder={t('e.g. Indoor courts • King of the Court', 'مثال: ملاعب داخلية • ملك الملعب')} value={formData.tagline} onChange={(e) => setFormData(prev => ({ ...prev, tagline: e.target.value }))} />
                </div>
                <div className="form-group settings-field">
                  <label className="field-label">{t('Tagline (Arabic)', 'الشعار (عربي)', lang)}</label>
                  <input type="text" className="settings-input" placeholder={t('مثال: ملاعب داخلية • ملك الملعب', 'مثال: ملاعب داخلية • ملك الملعب')} value={formData.taglineAr} onChange={(e) => setFormData(prev => ({ ...prev, taglineAr: e.target.value }))} />
                </div>
              </div>
            </div>

            <div className="settings-field-group">
              <h4 className="field-group-title">{t('Contact Information', 'معلومات التواصل', lang)}</h4>
              <div className="form-row form-row-2">
                <div className="form-group settings-field">
                  <label className="field-label">{t('Address (English)', 'العنوان (إنجليزي)', lang)}</label>
                  <input type="text" className="settings-input" placeholder={t('Street, City', 'الشارع، المدينة')} value={formData.address} onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))} />
                </div>
                <div className="form-group settings-field">
                  <label className="field-label">{t('Address (Arabic)', 'العنوان (عربي)', lang)}</label>
                  <input type="text" className="settings-input" value={formData.addressAr} onChange={(e) => setFormData(prev => ({ ...prev, addressAr: e.target.value }))} />
                </div>
                <div className="form-group settings-field">
                  <label className="field-label">{t('Phone', 'الهاتف', lang)}</label>
                  <input type="tel" className="settings-input" placeholder="+966..." value={formData.phone} onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))} />
                </div>
                <div className="form-group settings-field">
                  <label className="field-label">{t('Email', 'البريد الإلكتروني', lang)}</label>
                  <input type="email" className="settings-input" placeholder="info@club.com" value={formData.email} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} />
                </div>
                <div className="form-group settings-field full-width">
                  <label className="field-label">{t('Website', 'الموقع الإلكتروني', lang)}</label>
                  <input type="url" className="settings-input" placeholder="https://..." value={formData.website} onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))} />
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
                  <input type="text" className="settings-input" placeholder="e.g. hala-padel" value={formData.playtomicVenueId} onChange={(e) => setFormData(prev => ({ ...prev, playtomicVenueId: e.target.value }))} />
                </div>
                <div className="form-group settings-field">
                  <label className="field-label">{t('Playtomic API Key', 'مفتاح API')}</label>
                  <input type="password" className="settings-input" placeholder={t('Enter your API key', 'أدخل مفتاح API')} value={formData.playtomicApiKey} onChange={(e) => setFormData(prev => ({ ...prev, playtomicApiKey: e.target.value }))} />
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
                  <select className="settings-select" value={formData.defaultLanguage} onChange={(e) => setFormData(prev => ({ ...prev, defaultLanguage: e.target.value }))}>
                    <option value="en">English</option>
                    <option value="ar">العربية</option>
                  </select>
                </div>
                <div className="form-group settings-field">
                  <label className="field-label">{t('Timezone', 'المنطقة الزمنية', lang)}</label>
                  <input type="text" className="settings-input" placeholder="Asia/Riyadh" value={formData.timezone} onChange={(e) => setFormData(prev => ({ ...prev, timezone: e.target.value }))} />
                </div>
                <div className="form-group settings-field">
                  <label className="field-label">{t('Currency', 'العملة', lang)}</label>
                  <select className="settings-select" value={formData.currency} onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}>
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
              <div className="form-row form-row-2">
                <div className="form-group settings-field">
                  <label className="field-label">{t('Minimum booking duration (min)', 'أقل مدة للحجز (دقيقة)', lang)}</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="settings-input"
                    dir="ltr"
                    lang="en"
                    minLength={1}
                    maxLength={3}
                    value={formData.bookingDuration === '' || formData.bookingDuration === undefined ? '' : String(formData.bookingDuration)}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '')
                      if (raw === '') {
                        setFormData(prev => ({ ...prev, bookingDuration: '' }))
                        return
                      }
                      const v = parseInt(raw, 10)
                      if (!Number.isNaN(v)) setFormData(prev => ({ ...prev, bookingDuration: v }))
                    }}
                    onBlur={() => {
                      const v = Number(formData.bookingDuration)
                      if (formData.bookingDuration === '' || formData.bookingDuration === undefined || Number.isNaN(v) || v < 15 || v > 180) {
                        setFormData(prev => ({ ...prev, bookingDuration: Math.min(180, Math.max(15, Number(prev.bookingDuration) || 60)) }))
                      }
                    }}
                    title={t('Minimum duration; no booking can be shorter.', 'أقل مدة؛ لا يمكن طلب حجز أقل من هذه القيمة.')}
                  />
                  <span className="field-hint">{t('Minimum booking duration. No booking can be shorter than this value.', 'أقل مدة للحجز. لا يمكن طلب حجز أقل من هذه القيمة.')}</span>
                </div>
                <div className="form-group settings-field">
                  <label className="field-label">{t('Max Advance (days)', 'الحد الأقصى للحجز مسبقاً (يوم)', lang)}</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="settings-input"
                    dir="ltr"
                    lang="en"
                    value={formData.maxBookingAdvance === '' || formData.maxBookingAdvance === undefined ? '' : String(formData.maxBookingAdvance)}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '')
                      if (raw === '') {
                        setFormData(prev => ({ ...prev, maxBookingAdvance: '' }))
                        return
                      }
                      const v = parseInt(raw, 10)
                      if (!Number.isNaN(v)) setFormData(prev => ({ ...prev, maxBookingAdvance: v }))
                    }}
                    onBlur={() => {
                      const v = Number(formData.maxBookingAdvance)
                      if (formData.maxBookingAdvance === '' || formData.maxBookingAdvance === undefined || Number.isNaN(v) || v < 1) {
                        setFormData(prev => ({ ...prev, maxBookingAdvance: Math.max(1, Number(prev.maxBookingAdvance) || 30) }))
                      }
                    }}
                  />
                </div>
                <div className="form-group settings-field">
                  <label className="field-label">{t('Cancellation (hours before)', 'الإلغاء (ساعات قبل)', lang)}</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="settings-input"
                    dir="ltr"
                    lang="en"
                    value={formData.cancellationPolicy === '' || formData.cancellationPolicy === undefined ? '' : String(formData.cancellationPolicy)}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '')
                      if (raw === '') {
                        setFormData(prev => ({ ...prev, cancellationPolicy: '' }))
                        return
                      }
                      const v = parseInt(raw, 10)
                      if (!Number.isNaN(v)) setFormData(prev => ({ ...prev, cancellationPolicy: v }))
                    }}
                    onBlur={() => {
                      const v = Number(formData.cancellationPolicy)
                      if (formData.cancellationPolicy === '' || formData.cancellationPolicy === undefined || Number.isNaN(v) || v < 0) {
                        setFormData(prev => ({ ...prev, cancellationPolicy: Math.max(0, Number(prev.cancellationPolicy) || 24) }))
                      }
                    }}
                  />
                </div>
              </div>
              <div className="form-row form-row-3" style={{ marginTop: 16 }}>
                {BOOKING_VISIBLE_NUMBER_FIELDS.map(({ key, default: def, max, labelEn, labelAr, hintEn, hintAr }) => (
                  <div key={key} className="form-group settings-field">
                    <label className="field-label">{t(labelEn, labelAr, lang)}</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="settings-input"
                      dir="ltr"
                      lang="en"
                      value={formData[key] === '' || formData[key] === undefined ? '' : String(formData[key])}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '')
                        if (raw === '') {
                          setFormData(prev => ({ ...prev, [key]: '' }))
                          return
                        }
                        const v = parseInt(raw, 10)
                        if (!Number.isNaN(v)) setFormData(prev => ({ ...prev, [key]: v }))
                      }}
                      onBlur={() => {
                        const v = Number(formData[key])
                        if (formData[key] === '' || formData[key] === undefined || Number.isNaN(v) || v < 0 || (max != null && v > max)) {
                          setFormData(prev => ({ ...prev, [key]: max != null ? Math.min(max, Math.max(0, Number(prev[key]) || def)) : Math.max(0, Number(prev[key]) || def) }))
                        }
                      }}
                    />
                    {hintEn && <span className="field-hint">{t(hintEn, hintAr, lang)}</span>}
                  </div>
                ))}
              </div>
              <div className="form-row" style={{ marginTop: 16 }}>
                <div className="form-group settings-field checkbox-field">
                  <label className="checkbox-label">
                    <input type="checkbox" checked={!!formData[BOOKING_CHECKBOX_FIELD]} onChange={(e) => setFormData(prev => ({ ...prev, [BOOKING_CHECKBOX_FIELD]: e.target.checked }))} className="settings-checkbox" />
                    {t('Allow incomplete split bookings', 'السماح بحجوزات مشتركة غير مكتملة الدفع', lang)}
                  </label>
                </div>
              </div>

              <div
                className="settings-field-group tournament-booking-settings-block"
                style={{
                  marginTop: 28,
                  paddingTop: 22,
                  borderTop: '1px solid #e2e8f0',
                }}
              >
                <h4 className="field-group-title" style={{ marginBottom: 6 }}>
                  {t('Tournament bookings (split payments)', 'حجوزات البطولات (الدفع المشترك)', lang)}
                </h4>
                <p className="field-hint field-hint-block" style={{ marginBottom: 16 }}>
                  {t(
                    'Deadlines for King of the Court and Social Tournament when participants pay their share (separate from the general split deadline above).',
                    'مهلات منفصلة لبطولتي ملك الملعب والسوشيال عند دفع المشاركين لحصصهم (مستقلة عن مهلة التقسيم العامة أعلاه).',
                    lang
                  )}
                </p>
                <div className="form-row form-row-2">
                  {TOURNAMENT_SPLIT_DEADLINE_FIELDS.map(({ key, default: def, max, labelBilingual, hintEn, hintAr }) => (
                    <div key={key} className="form-group settings-field">
                      <label className="field-label" style={{ lineHeight: 1.35 }}>{labelBilingual}</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        className="settings-input"
                        dir="ltr"
                        lang="en"
                        value={formData[key] === '' || formData[key] === undefined ? '' : String(formData[key])}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, '')
                          if (raw === '') {
                            setFormData(prev => ({ ...prev, [key]: '' }))
                            return
                          }
                          const v = parseInt(raw, 10)
                          if (!Number.isNaN(v)) setFormData(prev => ({ ...prev, [key]: v }))
                        }}
                        onBlur={() => {
                          const v = Number(formData[key])
                          if (formData[key] === '' || formData[key] === undefined || Number.isNaN(v) || v < 0 || (max != null && v > max)) {
                            setFormData(prev => ({
                              ...prev,
                              [key]: max != null ? Math.min(max, Math.max(0, Number(prev[key]) || def)) : Math.max(0, Number(prev[key]) || def),
                            }))
                          }
                        }}
                      />
                      {hintEn && <span className="field-hint">{t(hintEn, hintAr, lang)}</span>}
                    </div>
                  ))}
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
            <p className="field-hint field-hint-block">
              {t(
                'Seasons (MM-DD). Put the default season first, then overrides — the last matching season wins. Same-day period: open earlier than close (e.g. 07:00–12:00). Overnight: one row only — open evening, close next morning (e.g. 16:00–04:00 means until 4:00 the next day). Do not split at midnight. With overnight hours, legacy time pickers allow the full day; real rules follow these windows.',
                'مواسم (شهر-يوم). الموسم الافتراضي أولاً ثم التفضيلات — آخر موسم مطابق يُطبَّق. نفس اليوم: الفتح قبل الإغلاق (مثل 07:00–12:00). عمل ليلي: صف واحد فقط — افتح مساءً وأغلق صباح اليوم التالي (مثل 16:00–04:00 يعني حتى 4 صباحاً لليوم التالي). لا تقسّم عند منتصف الليل. عند وجود عمل ليلي، حقول الوقت القديمة تسمح بيوم كامل والتحقق الفعلي حسب هذه النوافذ.',
                lang
              )}
            </p>
            <div className="working-hours-seasons">
              {(formData.workingHoursSeasons || []).map((season, si) => (
                <div key={season.id || si} className="working-hours-season">
                  <div className="working-hours-season-header">
                    <div className="form-group settings-field">
                      <label className="field-label">{t('Label (optional)', 'اسم الموسم (اختياري)', lang)}</label>
                      <input
                        type="text"
                        className="settings-input"
                        value={season.label || ''}
                        placeholder={t('e.g. Summer', 'مثال: الصيف', lang)}
                        onChange={(e) => {
                          const next = [...(formData.workingHoursSeasons || [])]
                          next[si] = { ...next[si], label: e.target.value }
                          setFormData(prev => ({ ...prev, workingHoursSeasons: next }))
                        }}
                      />
                    </div>
                    <div className="form-group settings-field">
                      <label className="field-label">{t('From (MM-DD)', 'من (شهر-يوم)', lang)}</label>
                      <input
                        type="text"
                        className="settings-input"
                        value={season.startDate || '01-01'}
                        pattern="\d{2}-\d{2}"
                        onChange={(e) => {
                          const next = [...(formData.workingHoursSeasons || [])]
                          next[si] = { ...next[si], startDate: e.target.value }
                          setFormData(prev => ({ ...prev, workingHoursSeasons: next }))
                        }}
                      />
                    </div>
                    <div className="form-group settings-field">
                      <label className="field-label">{t('To (MM-DD)', 'إلى (شهر-يوم)', lang)}</label>
                      <input
                        type="text"
                        className="settings-input"
                        value={season.endDate || '12-31'}
                        onChange={(e) => {
                          const next = [...(formData.workingHoursSeasons || [])]
                          next[si] = { ...next[si], endDate: e.target.value }
                          setFormData(prev => ({ ...prev, workingHoursSeasons: next }))
                        }}
                      />
                    </div>
                    {(formData.workingHoursSeasons || []).length > 1 && (
                      <button
                        type="button"
                        className="btn-secondary working-hours-remove-season"
                        onClick={() => {
                          const next = (formData.workingHoursSeasons || []).filter((_, j) => j !== si)
                          setFormData(prev => ({ ...prev, workingHoursSeasons: next.length ? next : defaultWorkingHoursSeasons() }))
                        }}
                      >
                        {t('Remove season', 'حذف الموسم', lang)}
                      </button>
                    )}
                  </div>
                  {(season.periods || []).map((p, pi) => (
                    <div key={`${si}-p-${pi}`} className="working-hours-period-row">
                      <div className="form-group settings-field">
                        <label className="field-label">{t('Open', 'الفتح', lang)}</label>
                        <input
                          type="time"
                          className="settings-input settings-time-input"
                          value={p.open || '06:00'}
                          onChange={(e) => {
                            const next = [...(formData.workingHoursSeasons || [])]
                            const periods = [...(next[si].periods || [])]
                            periods[pi] = { ...periods[pi], open: e.target.value }
                            next[si] = { ...next[si], periods }
                            setFormData(prev => ({ ...prev, workingHoursSeasons: next }))
                          }}
                        />
                      </div>
                      <div className="form-group settings-field">
                        <label className="field-label">{t('Close', 'الإغلاق', lang)}</label>
                        <input
                          type="time"
                          className="settings-input settings-time-input"
                          value={p.close || '23:00'}
                          onChange={(e) => {
                            const next = [...(formData.workingHoursSeasons || [])]
                            const periods = [...(next[si].periods || [])]
                            periods[pi] = { ...periods[pi], close: e.target.value }
                            next[si] = { ...next[si], periods }
                            setFormData(prev => ({ ...prev, workingHoursSeasons: next }))
                          }}
                        />
                      </div>
                      {(season.periods || []).length > 1 && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            const next = [...(formData.workingHoursSeasons || [])]
                            const periods = (next[si].periods || []).filter((_, j) => j !== pi)
                            next[si] = { ...next[si], periods: periods.length ? periods : [{ open: '06:00', close: '23:00' }] }
                            setFormData(prev => ({ ...prev, workingHoursSeasons: next }))
                          }}
                        >
                          {t('Remove period', 'حذف الفترة', lang)}
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      const next = [...(formData.workingHoursSeasons || [])]
                      const periods = [...(next[si].periods || []), { open: '18:00', close: '23:00' }]
                      next[si] = { ...next[si], periods }
                      setFormData(prev => ({ ...prev, workingHoursSeasons: next }))
                    }}
                  >
                    + {t('Add period', 'إضافة فترة', lang)}
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  const next = [...(formData.workingHoursSeasons || []), {
                    id: `season-${Date.now()}`,
                    label: '',
                    startDate: '06-01',
                    endDate: '08-31',
                    periods: [{ open: '07:00', close: '12:00' }, { open: '16:00', close: '23:00' }]
                  }]
                  setFormData(prev => ({ ...prev, workingHoursSeasons: next }))
                }}
              >
                + {t('Add season', 'إضافة موسم', lang)}
              </button>
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
