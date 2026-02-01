import React, { useState, useEffect } from 'react'
import './ClubSettings.css'
import '../pages/common.css'
import SocialIcon, { PLATFORMS } from '../../components/SocialIcon'

const ClubSettings = ({ club, onUpdateClub, onDefaultLanguageChange }) => {
  const [formData, setFormData] = useState({
    name: '',
    nameAr: '',
    logo: '',
    banner: '',
    headerBgColor: '#ffffff',
    headerTextColor: '#0f172a',
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
    maintenance: false
  })

  useEffect(() => {
    if (club) {
      setFormData({
        name: club?.name || '',
        nameAr: club?.nameAr || '',
        logo: club?.logo || '',
        banner: club?.banner || '',
        headerBgColor: club?.settings?.headerBgColor || '#ffffff',
        headerTextColor: club?.settings?.headerTextColor || '#0f172a',
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
  }, [club])

  if (!club) {
    return (
      <div className="club-admin-page">
        <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>
      </div>
    )
  }

  const handleSave = () => {
    if (formData.openingTime && formData.closingTime && formData.openingTime >= formData.closingTime) {
      alert('Closing time must be after opening time.')
      return
    }
    const updates = {
      name: formData.name,
      nameAr: formData.nameAr,
      logo: formData.logo || undefined,
      banner: formData.banner || undefined,
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
        socialLinks: socialLinks
      }
    }
    onUpdateClub(updates)
    if (typeof onDefaultLanguageChange === 'function' && updates.settings?.defaultLanguage) {
      onDefaultLanguageChange(updates.settings.defaultLanguage)
    }
    alert('Settings saved successfully!')
  }

  const handleAddCourt = () => {
    if (!courtForm.name.trim()) {
      alert('Court name is required')
      return
    }
    const newCourt = {
      id: 'court-' + Date.now(),
      name: courtForm.name,
      nameAr: courtForm.nameAr || courtForm.name,
      type: courtForm.type,
      maintenance: courtForm.maintenance || false
    }
    setCourts([...courts, newCourt])
    setCourtForm({ name: '', nameAr: '', type: 'indoor', maintenance: false })
  }

  const handleEditCourt = (court) => {
    setEditingCourt(court)
    setCourtForm({
      name: court.name,
      nameAr: court.nameAr || '',
      type: court.type || 'indoor',
      maintenance: court.maintenance || false
    })
  }

  const handleUpdateCourt = () => {
    if (!courtForm.name.trim()) {
      alert('Court name is required')
      return
    }
    const updatedCourts = courts.map(c => 
      c.id === editingCourt.id 
        ? { ...c, name: courtForm.name, nameAr: courtForm.nameAr || courtForm.name, type: courtForm.type, maintenance: courtForm.maintenance }
        : c
    )
    setCourts(updatedCourts)
    setEditingCourt(null)
    setCourtForm({ name: '', nameAr: '', type: 'indoor', maintenance: false })
  }

  const handleDeleteCourt = (courtId) => {
    if (window.confirm('Are you sure you want to delete this court?')) {
      setCourts(courts.filter(c => c.id !== courtId))
    }
  }

  const handleCancelEdit = () => {
    setEditingCourt(null)
    setCourtForm({ name: '', nameAr: '', type: 'indoor', maintenance: false })
  }

  const handleToggleMaintenance = (courtId) => {
    const updatedCourts = courts.map(c => 
      c.id === courtId 
        ? { ...c, maintenance: !c.maintenance }
        : c
    )
    setCourts(updatedCourts)
  }

  return (
    <div className="club-admin-page">
      <div className="club-settings">
        <div className="page-header">
          <h2 className="page-title">
            {club.logo && <img src={club.logo} alt="" className="club-logo-in-title" />}
            Club Settings - {club.name}
          </h2>
          <button className="btn-primary" onClick={handleSave}>Save Settings</button>
        </div>

        <div className="club-settings-tabs">
          {[
            { id: 'basic', label: 'Basic Information' },
            { id: 'playtomic', label: 'Playtomic' },
            { id: 'general', label: 'General' },
            { id: 'booking', label: 'Booking' },
            { id: 'courts', label: 'Courts' },
            { id: 'hours', label: 'Club Hours' },
            { id: 'social', label: 'Social Media' }
          ].map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`club-settings-tab ${activeTab === id ? 'active' : ''}`}
              onClick={() => setActiveTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="settings-sections">
          {activeTab === 'basic' && (
          <div className="settings-section">
            <h3>Basic Information</h3>
            <div className="form-group">
              <label>Club Name (English) *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Club Name (Arabic)</label>
              <input
                type="text"
                value={formData.nameAr}
                onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Club logo — شعار النادي (URL or upload image)</label>
              <div className="logo-input-row">
                <input
                  type="text"
                  placeholder="https://... or leave empty"
                  value={formData.logo}
                  onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                  className="logo-url-input"
                />
                <label className="btn-secondary logo-upload-btn">
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        const reader = new FileReader()
                        reader.onload = () => setFormData(prev => ({ ...prev, logo: reader.result }))
                        reader.readAsDataURL(file)
                      }
                      e.target.value = ''
                    }}
                  />
                  Upload image
                </label>
              </div>
              {formData.logo && (
                <div className="logo-preview-wrap">
                  <img src={formData.logo} alt="Logo preview" className="logo-preview" />
                  <button type="button" className="logo-remove" onClick={() => setFormData(prev => ({ ...prev, logo: '' }))}>Remove</button>
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Club Banner — بنر النادي (URL or upload image)</label>
              <p className="form-hint">Displayed at the top of the club public page. Recommended: 1200×400px or similar wide aspect ratio. / يُعرض في أعلى صفحة النادي. يُفضّل نسبة 1200×400 بكسل.</p>
              <div className="logo-input-row">
                <input
                  type="text"
                  placeholder="https://... or leave empty"
                  value={formData.banner}
                  onChange={(e) => setFormData({ ...formData, banner: e.target.value })}
                  className="logo-url-input"
                />
                <label className="btn-secondary logo-upload-btn">
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        const reader = new FileReader()
                        reader.onload = () => setFormData(prev => ({ ...prev, banner: reader.result }))
                        reader.readAsDataURL(file)
                      }
                      e.target.value = ''
                    }}
                  />
                  Upload image
                </label>
              </div>
              {formData.banner && (
                <div className="banner-preview-wrap">
                  <img src={formData.banner} alt="Banner preview" className="banner-preview" />
                  <button type="button" className="logo-remove" onClick={() => setFormData(prev => ({ ...prev, banner: '' }))}>Remove</button>
                </div>
              )}
            </div>
            <div className="form-row" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: '1 1 200px' }}>
                <label>Header background color — لون خلفية القسم الذي أعلى البنر</label>
                <p className="form-hint">Background / الخلفية</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <input
                    type="color"
                    value={formData.headerBgColor}
                    onChange={(e) => setFormData({ ...formData, headerBgColor: e.target.value })}
                    style={{ width: 48, height: 36, padding: 2, cursor: 'pointer', border: '1px solid #e2e8f0', borderRadius: 8 }}
                  />
                  <input
                    type="text"
                    value={formData.headerBgColor}
                    onChange={(e) => setFormData({ ...formData, headerBgColor: e.target.value })}
                    placeholder="#ffffff"
                    style={{ width: 100, padding: '8px 12px', fontSize: 14 }}
                  />
                </div>
              </div>
              <div className="form-group" style={{ flex: '1 1 200px' }}>
                <label>Header text color — لون الخطوط الذي أعلى البنر</label>
                <p className="form-hint">Text / الخطوط</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <input
                    type="color"
                    value={formData.headerTextColor}
                    onChange={(e) => setFormData({ ...formData, headerTextColor: e.target.value })}
                    style={{ width: 48, height: 36, padding: 2, cursor: 'pointer', border: '1px solid #e2e8f0', borderRadius: 8 }}
                  />
                  <input
                    type="text"
                    value={formData.headerTextColor}
                    onChange={(e) => setFormData({ ...formData, headerTextColor: e.target.value })}
                    placeholder="#0f172a"
                    style={{ width: 100, padding: '8px 12px', fontSize: 14 }}
                  />
                </div>
              </div>
            </div>
            <div className="form-group">
              <label>Tagline / Short description (English) — shown on home page</label>
              <input
                type="text"
                placeholder="e.g. Indoor courts • King of the Court & Social tournaments"
                value={formData.tagline}
                onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Tagline (Arabic) — وصف قصير يظهر في الصفحة الرئيسية</label>
              <input
                type="text"
                placeholder="مثال: ملاعب داخلية • بطولات ملك الملعب وسوشيال"
                value={formData.taglineAr}
                onChange={(e) => setFormData({ ...formData, taglineAr: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Address (Arabic)</label>
              <input
                type="text"
                value={formData.addressAr}
                onChange={(e) => setFormData({ ...formData, addressAr: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Website</label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              />
            </div>
          </div>
          )}

          {activeTab === 'playtomic' && (
          <div className="settings-section">
            <h3>Playtomic Integration</h3>
            <div className="form-group">
              <label>Playtomic Venue ID</label>
              <input
                type="text"
                value={formData.playtomicVenueId}
                onChange={(e) => setFormData({ ...formData, playtomicVenueId: e.target.value })}
                placeholder="e.g., hala-padel"
              />
            </div>
            <div className="form-group">
              <label>Playtomic API Key</label>
              <input
                type="password"
                value={formData.playtomicApiKey}
                onChange={(e) => setFormData({ ...formData, playtomicApiKey: e.target.value })}
                placeholder="Enter your Playtomic API key"
              />
            </div>
          </div>
          )}

          {activeTab === 'general' && (
          <div className="settings-section">
            <h3>General Settings</h3>
            <div className="form-group">
              <label>Default Language</label>
              <select
                value={formData.defaultLanguage}
                onChange={(e) => setFormData({ ...formData, defaultLanguage: e.target.value })}
              >
                <option value="en">English</option>
                <option value="ar">Arabic</option>
              </select>
            </div>
            <div className="form-group">
              <label>Timezone</label>
              <input
                type="text"
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Currency</label>
              <input
                type="text"
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              />
            </div>
          </div>
          )}

          {activeTab === 'booking' && (
          <div className="settings-section">
            <h3>Booking Settings</h3>
            <div className="form-group">
              <label>Booking Duration (minutes)</label>
              <input
                type="number"
                value={formData.bookingDuration}
                onChange={(e) => setFormData({ ...formData, bookingDuration: parseInt(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label>Max Booking Advance (days)</label>
              <input
                type="number"
                value={formData.maxBookingAdvance}
                onChange={(e) => setFormData({ ...formData, maxBookingAdvance: parseInt(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label>Cancellation Policy (hours before booking)</label>
              <input
                type="number"
                value={formData.cancellationPolicy}
                onChange={(e) => setFormData({ ...formData, cancellationPolicy: parseInt(e.target.value) })}
              />
            </div>
          </div>
          )}

          {activeTab === 'courts' && (
          <div className="settings-section">
            <h3>Courts Management</h3>
            <div className="courts-list">
              {courts.length > 0 ? (
                <div className="courts-table">
                  <table className="courts-table-content">
                    <thead>
                      <tr>
                        <th>Name (English)</th>
                        <th>Name (Arabic)</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {courts.map(court => (
                        <tr key={court.id} className={court.maintenance ? 'court-maintenance' : ''}>
                          <td>{court.name}</td>
                          <td>{court.nameAr || '-'}</td>
                          <td>
                            <span className={`court-type-badge ${court.type}`}>
                              {court.type === 'indoor' ? 'Indoor' : 'Outdoor'}
                            </span>
                          </td>
                          <td>
                            <span className={`court-status-badge ${court.maintenance ? 'maintenance' : 'active'}`}>
                              {court.maintenance ? '🔧 Maintenance' : '✅ Active'}
                            </span>
                          </td>
                          <td>
                            <div className="court-actions">
                              <button 
                                className={`btn-maintenance btn-small ${court.maintenance ? 'btn-restore' : ''}`}
                                onClick={() => handleToggleMaintenance(court.id)}
                                title={court.maintenance ? 'Restore from maintenance' : 'Put under maintenance'}
                              >
                                {court.maintenance ? '✅ Restore' : '🔧 Maintenance'}
                              </button>
                              <button 
                                className="btn-secondary btn-small"
                                onClick={() => handleEditCourt(court)}
                              >
                                Edit
                              </button>
                              <button 
                                className="btn-danger btn-small"
                                onClick={() => handleDeleteCourt(court.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">No courts added yet</div>
              )}
            </div>

            <div className="court-form">
              <h4>{editingCourt ? 'Edit Court' : 'Add New Court'}</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>Court Name (English) *</label>
                  <input
                    type="text"
                    value={courtForm.name}
                    onChange={(e) => setCourtForm({ ...courtForm, name: e.target.value })}
                    placeholder="e.g., Court 1"
                  />
                </div>
                <div className="form-group">
                  <label>Court Name (Arabic)</label>
                  <input
                    type="text"
                    value={courtForm.nameAr}
                    onChange={(e) => setCourtForm({ ...courtForm, nameAr: e.target.value })}
                    placeholder="e.g., الملعب 1"
                  />
                </div>
                <div className="form-group">
                  <label>Type</label>
                  <select
                    value={courtForm.type}
                    onChange={(e) => setCourtForm({ ...courtForm, type: e.target.value })}
                  >
                    <option value="indoor">Indoor</option>
                    <option value="outdoor">Outdoor</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={courtForm.maintenance}
                      onChange={(e) => setCourtForm({ ...courtForm, maintenance: e.target.checked })}
                      style={{ marginRight: '8px' }}
                    />
                    Under Maintenance
                  </label>
                </div>
              </div>
              <div className="form-actions">
                {editingCourt ? (
                  <>
                    <button className="btn-primary" onClick={handleUpdateCourt}>
                      Update Court
                    </button>
                    <button className="btn-secondary" onClick={handleCancelEdit}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button className="btn-primary" onClick={handleAddCourt}>
                    Add Court
                  </button>
                )}
              </div>
            </div>
          </div>
          )}

          {activeTab === 'hours' && (
          <div className="settings-section">
            <h3>Club Hours / أوقات النادي</h3>
            <p className="section-description" style={{ marginBottom: '16px', color: '#6c757d', fontSize: '14px' }}>
              Working hours of the club. All bookings and tournaments (court bookings, King of the Court, Social) will be restricted to these times.
            </p>
            <p className="section-description" style={{ marginBottom: '16px', color: '#6c757d', fontSize: '14px', direction: 'rtl' }}>
              وقت عمل النادي. جميع الحجوزات والبطولات (حجوزات الملاعب، ملك الملعب، سوشيال) ستكون ضمن هذه الأوقات فقط.
            </p>
            <div className="form-row" style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-group">
                <label>Opening time / من الساعة</label>
                <input
                  type="time"
                  value={formData.openingTime}
                  onChange={(e) => setFormData({ ...formData, openingTime: e.target.value })}
                  style={{ padding: '8px 12px', fontSize: '14px' }}
                />
              </div>
              <div className="form-group">
                <label>Closing time / إلى الساعة</label>
                <input
                  type="time"
                  value={formData.closingTime}
                  onChange={(e) => setFormData({ ...formData, closingTime: e.target.value })}
                  style={{ padding: '8px 12px', fontSize: '14px' }}
                />
              </div>
            </div>
            {formData.openingTime >= formData.closingTime && (
              <p style={{ color: '#dc3545', fontSize: '13px', marginTop: '8px' }}>
                Closing time must be after opening time.
              </p>
            )}
          </div>
          )}

          {activeTab === 'social' && (
          <div className="settings-section">
            <h3>Social Media — التواصل الاجتماعي</h3>
            <p className="form-hint">Icons appear in the center of the header bar above the banner. / تظهر الأيقونات في منتصف الشريط الذي أعلى البنر.</p>
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
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSocialLinks([...socialLinks, { platform: 'facebook', url: '', iconColor: '#1877f2', textColor: '#ffffff' }])}
              >
                + Add social link
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
