import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import LanguageIcon from '../components/LanguageIcon'
import { useNavigate, useSearchParams } from 'react-router-dom'
import './Login.css'
import { getMergedMembersRaw, addMemberToClub } from '../storage/adminStorage'
import { getAppLanguage, setAppLanguage } from '../storage/languageStorage'
import { setCurrentPlatformUser } from '../storage/platformAuth'
import { normalizePayReturnPath, parsePaymentShareInviteToken, persistResumeInviteToken } from '../utils/paymentShareDeepLink'

/** Normalize for comparison: trim, lowercase emails and names, digits-only for phones */
function norm(s) {
  if (s == null) return ''
  const t = String(s).trim()
  if (t.includes('@')) return t.toLowerCase()
  const digits = t.replace(/\D/g, '')
  if (digits.length >= 8) return digits.replace(/^966/, '').replace(/^0/, '') || digits
  return t.toLowerCase()
}

const Login = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const joinClubId = searchParams.get('join')
  const returnUrl = searchParams.get('return')
  const returnPath = normalizePayReturnPath(returnUrl || '')
  const [language, setLanguage] = useState(getAppLanguage())
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  React.useEffect(() => {
    setAppLanguage(language)
  }, [language])

  const handleMemberLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const rawIdentifier = String(formData.email || '').trim()
      const password = (formData.password || '').trim()
      const input = norm(formData.email)
      if (!input || !password) {
        setError(language === 'ar' ? 'أدخل البريد أو الاسم وكلمة المرور' : 'Enter email or name and password')
        return
      }

      let member = null
      let serverRejectedCredentials = false
      try {
        const bookingApi = await import('../api/dbClient')
        const auth = await bookingApi.memberLogin(rawIdentifier, password)
        if (auth?.ok && auth.memberId) {
          try {
            const backend = (await import('../storage/backendStorage')).default
            if (backend?.refreshStoreKeys) {
              await backend.refreshStoreKeys(['all_members', 'padel_members'])
            }
          } catch (_) {}
          const membersAfter = getMergedMembersRaw()
          member =
            membersAfter.find((m) => String(m.id) === String(auth.memberId)) || {
              id: auth.memberId,
              name: auth.name || '',
              email: auth.email || '',
              mobile: auth.mobile || null,
              phone: auth.mobile || null,
              clubIds: [],
              clubId: null,
            }
        }
      } catch (err) {
        if (err?.status === 401 || err?.apiCode === 'AUTH_FAILED') {
          serverRejectedCredentials = true
        }
      }

      if (!member && !serverRejectedCredentials) {
        try {
          const backend = (await import('../storage/backendStorage')).default
          if (backend?.refreshStoreKeys) {
            await backend.refreshStoreKeys(['all_members', 'padel_members'])
          }
        } catch (_) {}
        const members = getMergedMembersRaw()
        member = members.find((m) => {
          const matchId =
            norm(m.email) === input ||
            norm(m.name) === input ||
            norm(m.mobile || m.phone || '') === input
          return matchId && (m.password || '') === password
        })
      }

      if (member) {
        await setCurrentPlatformUser(member.id)
        const inviteTok = returnPath.startsWith('/') ? parsePaymentShareInviteToken(returnPath) : null
        if (inviteTok) {
          persistResumeInviteToken(inviteTok)
          try {
            const bookingApi = await import('../api/dbClient')
            let claimClubId = joinClubId || null
            if (!claimClubId) {
              const inv = await bookingApi.getInviteByToken(inviteTok).catch(() => null)
              claimClubId = inv?.clubId || null
            }
            if (claimClubId) {
              try {
                await bookingApi.joinClub(claimClubId, member.id)
                await addMemberToClub(member.id, claimClubId)
              } catch (_) {}
              try {
                await bookingApi.claimInviteShare({
                  inviteToken: inviteTok,
                  clubId: claimClubId,
                  memberId: member.id,
                  phone: member.mobile || member.phone,
                  memberName: member.name
                })
              } catch (_) {}
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('clubs-synced'))
              }
            }
          } catch (_) {}
        } else if (joinClubId) {
          try {
            const bookingApi = await import('../api/dbClient')
            await bookingApi.joinClub(joinClubId, member.id)
            await addMemberToClub(member.id, joinClubId)
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('clubs-synced'))
            }
          } catch (_) {}
        }
        if (returnPath && returnPath.startsWith('/')) {
          navigate(returnPath)
        } else if (joinClubId) {
          navigate(`/clubs/${joinClubId}`)
        } else {
          const clubId = member.clubIds?.[0] || member.clubId
          if (clubId) navigate(`/clubs/${clubId}`)
          else navigate('/')
        }
      } else {
        setError(language === 'ar' ? 'البريد أو كلمة المرور غير صحيحة' : 'Invalid email or password')
      }
    } finally {
      setLoading(false)
    }
  }

  const c = {
    title: language === 'en' ? 'Sign in to PlayTix' : 'تسجيل الدخول إلى PlayTix',
    subtitle: joinClubId
      ? (language === 'en' ? 'Sign in to join the club.' : 'سجّل الدخول للانضمام للنادي.')
      : (language === 'en' ? 'Sign in to browse clubs, book courts and make purchases.' : 'سجّل الدخول لتصفح النوادي وحجز الملاعب وإجراء المشتريات.'),
    backToHome: language === 'en' ? 'Back to home' : 'العودة للرئيسية',
    backToClub: language === 'en' ? 'Back to club' : 'العودة للنادي',
    emailOrName: language === 'en' ? 'Email, name or phone' : 'البريد أو الاسم أو الجوال',
    emailPlaceholder: language === 'en' ? 'Enter email, name or phone' : 'أدخل البريد أو الاسم أو رقم الجوال',
    password: language === 'en' ? 'Password' : 'كلمة المرور',
    passwordPlaceholder: language === 'en' ? 'Enter password' : 'أدخل كلمة المرور',
    submit: loading ? (language === 'en' ? 'Signing in...' : 'جاري تسجيل الدخول...') : (language === 'en' ? 'Sign in' : 'تسجيل الدخول'),
    forgotPassword: language === 'en' ? 'Forgot password?' : 'نسيت كلمة المرور؟',
    noAccount: language === 'en' ? "Don't have an account? " : 'ليس لديك حساب؟ ',
    register: language === 'en' ? 'Register' : 'تسجيل',
  }

  return (
    <div className={`login-page ${language === 'ar' ? 'rtl' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <header className="login-header">
        <Link to="/" className="login-logo-link">
          <img src={`${import.meta.env.BASE_URL}logo-playtix.png`} alt="PlayTix" className="login-logo" />
        </Link>
        <Link
          to={joinClubId ? `/clubs/${joinClubId}` : (returnPath && returnPath.startsWith('/') ? returnPath : '/')}
          className="login-back"
        >
          {joinClubId ? c.backToClub : c.backToHome}
        </Link>
        <button
          type="button"
          className="login-lang"
          onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
          title={language === 'en' ? 'العربية' : 'English'}
        >
          <LanguageIcon lang={language === 'en' ? 'ar' : 'en'} size={20} />
        </button>
      </header>
      <main className="login-main">
        <div className="login-card">
          <h1 className="login-title">{c.title}</h1>
          <p className="login-subtitle">{c.subtitle}</p>
          <form onSubmit={handleMemberLogin} className="login-form">
            {error && <p className="login-error" role="alert">{error}</p>}
            <div className="form-group">
              <label htmlFor="login-email">{c.emailOrName} *</label>
              <input
                id="login-email"
                type="text"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder={c.emailPlaceholder}
                required
                autoComplete="username"
              />
            </div>
            <div className="form-group">
              <label htmlFor="login-password">{c.password} *</label>
              <input
                id="login-password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={c.passwordPlaceholder}
                required
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className="login-submit" disabled={loading}>
              {c.submit}
            </button>
          </form>
          <p className="login-forgot-hint">
            <Link to="/forgot-password?type=member">{c.forgotPassword}</Link>
          </p>
          <p className="login-register-hint">
            {c.noAccount}
            <Link
              to={(() => {
                const q = new URLSearchParams()
                if (joinClubId) q.set('join', joinClubId)
                if (returnPath) q.set('returnTo', returnPath)
                const s = q.toString()
                return s ? `/register?${s}` : '/register'
              })()}
            >
              {c.register}
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}

export default Login
