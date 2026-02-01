import React, { useState } from 'react'
import LanguageIcon from '../components/LanguageIcon'
import { useNavigate, useSearchParams } from 'react-router-dom'
import './Login.css'
import { loadClubs, saveClubs, upsertMember, getMergedMembersRaw } from '../storage/adminStorage'
import { getAppLanguage, setAppLanguage } from '../storage/languageStorage'
import { setCurrentPlatformUser } from '../storage/platformAuth'

const Login = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const joinClubId = searchParams.get('join')
  const [language, setLanguage] = useState(getAppLanguage())
  const [mode, setMode] = useState(joinClubId ? 'login' : 'login') // 'login', 'signup', or 'createClub'
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    clubId: ''
  })
  const [clubs, setClubs] = useState([])

  React.useEffect(() => {
    const loadedClubs = loadClubs()
    setClubs(loadedClubs)
  }, [])

  React.useEffect(() => {
    if (joinClubId) {
      setFormData(prev => ({ ...prev, clubId: joinClubId }))
    }
  }, [joinClubId])

  React.useEffect(() => {
    setAppLanguage(language)
  }, [language])

  const handleMemberLogin = (e) => {
    e.preventDefault()
    const members = getMergedMembersRaw()
    const member = members.find(m => 
      (m.email === formData.email || m.name === formData.name) && 
      m.password === formData.password
    )
    
    if (member) {
      setCurrentPlatformUser(member.id)
      if (joinClubId) {
        navigate(`/clubs/${joinClubId}`)
      } else {
        const clubId = member.clubIds?.[0] || member.clubId
        if (clubId) navigate(`/club/${clubId}`)
        else navigate('/')
      }
    } else {
      alert('Invalid credentials')
    }
  }

  const handleMemberSignup = (e) => {
    e.preventDefault()
    const clubIdToUse = joinClubId || formData.clubId
    if (!formData.name || !formData.email || !formData.password || !clubIdToUse) {
      alert(language === 'en' ? 'Please fill all fields' : 'يرجى تعبئة جميع الحقول')
      return
    }

    const members = getMergedMembersRaw()
    const existingMember = members.find(m => (m.email || '').toLowerCase() === (formData.email || '').toLowerCase())
    
    if (existingMember) {
      alert('Email already exists')
      return
    }

    const newMember = {
      id: Date.now().toString(),
      name: formData.name,
      email: formData.email,
      password: formData.password,
      clubIds: [clubIdToUse],
      clubId: clubIdToUse,
      role: 'member',
      createdAt: new Date().toISOString()
    }

    if (!upsertMember(newMember)) {
      alert(language === 'en' ? 'Registration failed' : 'فشل التسجيل')
      return
    }

    setCurrentPlatformUser(newMember.id)
    if (joinClubId) {
      navigate(`/clubs/${joinClubId}`)
    } else {
      navigate(`/club/${clubIdToUse}`)
    }
  }

  const handleCreateClub = (e) => {
    e.preventDefault()
    if (!formData.name) {
      alert('Club name is required')
      return
    }

    const newClub = {
      id: 'club-' + Date.now(),
      name: formData.name,
      nameAr: formData.nameAr || '',
      address: formData.address || '',
      addressAr: formData.addressAr || '',
      phone: formData.phone || '',
      email: formData.email || '',
      website: formData.website || '',
      playtomicVenueId: formData.playtomicVenueId || '',
      playtomicApiKey: formData.playtomicApiKey || '',
      courts: [
        { id: 'court-1', name: 'Court 1', nameAr: 'الملعب 1', type: 'indoor' },
        { id: 'court-2', name: 'Court 2', nameAr: 'الملعب 2', type: 'indoor' },
        { id: 'court-3', name: 'Court 3', nameAr: 'الملعب 3', type: 'indoor' },
        { id: 'court-4', name: 'Court 4', nameAr: 'الملعب 4', type: 'indoor' }
      ],
      settings: {
        defaultLanguage: 'en',
        timezone: 'Asia/Riyadh',
        currency: 'SAR',
        bookingDuration: 60,
        maxBookingAdvance: 30,
        cancellationPolicy: 24
      },
      tournaments: [],
      tournamentTypes: [
        {
          id: 'king-of-court',
          name: 'King of the Court',
          nameAr: 'ملك الملعب',
          description: 'Winners stay on court',
          descriptionAr: 'الفائزون يبقون على الملعب'
        },
        {
          id: 'social',
          name: 'Social Tournament',
          nameAr: 'بطولة سوشيال',
          description: 'Round-robin format',
          descriptionAr: 'نظام دوري'
        }
      ],
      members: [],
      bookings: [],
      offers: [],
      accounting: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    const clubs = loadClubs()
    clubs.push(newClub)
    saveClubs(clubs)

    alert('Club created successfully! Redirecting to admin panel...')
    navigate('/admin/all-clubs')
  }

  return (
    <div className={`login-page ${language === 'ar' ? 'rtl' : ''}`}>
      <div className="login-container">
        <div className="login-header">
          <div className="login-lang-wrap">
            <button
              type="button"
              className="login-lang-btn"
              onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
              title={language === 'en' ? 'العربية' : 'English'}
            >
              <LanguageIcon lang={language === 'en' ? 'ar' : 'en'} size={20} />
            </button>
          </div>
          <h1>{language === 'en' ? 'Padel Platform' : 'منصة بادل'}</h1>
          <p>{joinClubId 
            ? (language === 'en' ? 'Login or register to join the club' : 'سجّل الدخول أو أنشئ حساباً للانضمام للنادي')
            : (language === 'en' ? 'Login & Registration' : 'تسجيل الدخول والتسجيل')}</p>
        </div>

        <div className="login-tabs">
          <button 
            className={`tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => setMode('login')}
          >
            {language === 'en' ? 'Member Login' : 'تسجيل دخول الأعضاء'}
          </button>
          <button 
            className={`tab ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => setMode('signup')}
          >
            {language === 'en' ? 'Register New Member' : 'تسجيل عضو جديد'}
          </button>
          {!joinClubId && (
            <button 
              className={`tab ${mode === 'createClub' ? 'active' : ''}`}
              onClick={() => setMode('createClub')}
            >
              {language === 'en' ? 'Create Club' : 'إنشاء نادي'}
            </button>
          )}
        </div>

        <div className="login-form-container">
          {mode === 'login' && (
            <form onSubmit={handleMemberLogin} className="login-form">
              <h2>{language === 'en' ? 'Member Login' : 'تسجيل دخول الأعضاء'}</h2>
              <div className="form-group">
                <label>Email or Name</label>
                <input
                  type="text"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Enter email or name"
                  required
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter password"
                  required
                />
              </div>
              <button type="submit" className="btn-primary btn-block">
                Login
              </button>
            </form>
          )}

          {mode === 'signup' && (
            <form onSubmit={handleMemberSignup} className="login-form">
              <h2>{language === 'en' ? 'Register New Member' : 'تسجيل عضو جديد'}</h2>
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter your name"
                  required
                />
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Enter your email"
                  required
                />
              </div>
              <div className="form-group">
                <label>Password *</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Create password"
                  required
                />
              </div>
              {joinClubId ? (
                <div className="form-group">
                  <label>{language === 'en' ? 'Club' : 'النادي'}</label>
                  <p style={{ margin: 0, padding: '8px 0', fontWeight: 600, color: '#1976d2' }}>
                    {clubs.find(c => c.id === joinClubId)?.name || clubs.find(c => c.id === joinClubId)?.nameAr || joinClubId}
                  </p>
                </div>
              ) : (
                <div className="form-group">
                  <label>{language === 'en' ? 'Select Club *' : 'اختر النادي *'}</label>
                  <select
                    value={formData.clubId}
                    onChange={(e) => setFormData({ ...formData, clubId: e.target.value })}
                    required
                  >
                    <option value="">{language === 'en' ? 'Choose a club' : 'اختر نادي'}</option>
                    {clubs.filter(c => c.status !== 'pending').map(club => (
                      <option key={club.id} value={club.id}>
                        {club.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button type="submit" className="btn-primary btn-block">
                Sign Up
              </button>
            </form>
          )}

          {mode === 'createClub' && (
            <form onSubmit={handleCreateClub} className="login-form">
              <h2>Create New Club</h2>
              <div className="form-group">
                <label>Club Name (English) *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter club name"
                  required
                />
              </div>
              <div className="form-group">
                <label>Club Name (Arabic)</label>
                <input
                  type="text"
                  value={formData.nameAr || ''}
                  onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                  placeholder="أدخل اسم النادي"
                />
              </div>
              <div className="form-group">
                <label>Address</label>
                <input
                  type="text"
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Enter address"
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="text"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Enter phone number"
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Enter email"
                />
              </div>
              <div className="form-group">
                <label>Website</label>
                <input
                  type="url"
                  value={formData.website || ''}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="form-group">
                <label>Playtomic Venue ID</label>
                <input
                  type="text"
                  value={formData.playtomicVenueId || ''}
                  onChange={(e) => setFormData({ ...formData, playtomicVenueId: e.target.value })}
                  placeholder="Enter Playtomic venue ID"
                />
              </div>
              <button type="submit" className="btn-primary btn-block">
                Create Club
              </button>
              <p className="form-note">
                After creating the club, you'll be redirected to the admin panel to manage it.
              </p>
            </form>
          )}
        </div>

        {!joinClubId && (
        <div className="login-footer">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' }}>
            <a href="/admin" className="admin-link">
              {language === 'en' ? 'Go to Admin Panel' : 'الذهاب للوحة التحكم'}
            </a>
            {clubs.filter(c => c.status !== 'pending').length > 0 && (
              <div style={{ marginTop: '10px', padding: '15px', background: '#f0f7ff', borderRadius: '6px', width: '100%' }}>
                <p style={{ margin: '0 0 15px 0', fontSize: '14px', fontWeight: '500', color: '#333', textAlign: 'center' }}>
                  Quick Access to Existing Clubs / الوصول السريع للأندية:
                </p>
                {clubs.filter(c => c.status !== 'pending').map(club => (
                  <a
                    key={club.id}
                    href={`/admin/club/${club.id}`}
                    className="club-quick-link"
                    style={{
                      display: 'block',
                      padding: '12px',
                      margin: '8px 0',
                      background: '#2196f3',
                      color: 'white',
                      textDecoration: 'none',
                      borderRadius: '6px',
                      fontSize: '15px',
                      textAlign: 'center',
                      fontWeight: '500',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#1976d2'
                      e.target.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = '#2196f3'
                      e.target.style.transform = 'translateY(0)'
                    }}
                  >
                    🏢 {club.name} / {club.nameAr || club.name}
                  </a>
                ))}
                <p style={{ margin: '15px 0 0 0', fontSize: '12px', color: '#666', textAlign: 'center' }}>
                  Click to access club management / اضغط للوصول لإدارة النادي
                </p>
              </div>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  )
}

export default Login
