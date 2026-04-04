import React, { lazy, Suspense, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { loadClubsAsync, initBackendStorage } from './storage/adminStorage.js'
import { initAppSettingsStorage } from './storage/appSettingsStorage.js'
import GlobalSavingOverlay from './components/GlobalSavingOverlay'
import './index.css'

/** Ensure all number inputs and .western-numerals elements use Western numerals (0-9) across the system */
function useWesternNumerals() {
  useEffect(() => {
    let raf = 0
    const apply = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        try {
          document.querySelectorAll('input[type="number"], .western-numerals').forEach(el => {
            el.setAttribute('lang', 'en')
            el.setAttribute('dir', 'ltr')
          })
        } catch (_) {}
      })
    }
    const root = document.getElementById('root')
    if (!root) return
    apply()
    // Observe #root only — extensions often mutate <body> (e.g. shopping overlays); that used to fire
    // full-document querySelectorAll on every mutation and contributed to stack/perf issues on playtix.app.
    const obs = new MutationObserver(apply)
    obs.observe(root, { childList: true, subtree: true })
    return () => {
      cancelAnimationFrame(raf)
      obs.disconnect()
    }
  }, [])
}

const USE_POSTGRES = true

/* Code-splitting: load route components on demand */
const HomePage = lazy(() => import('./pages/HomePage'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'))
const TermsOfService = lazy(() => import('./pages/TermsOfService'))
const DataDeletion = lazy(() => import('./pages/DataDeletion'))
const RegisterClub = lazy(() => import('./pages/RegisterClub'))
const MyBookingsPage = lazy(() => import('./pages/MyBookingsPage'))
const MyFavoritesPage = lazy(() => import('./pages/MyFavoritesPage'))
const PayInvitePage = lazy(() => import('./pages/PayInvitePage'))
const PaySharePage = lazy(() => import('./pages/PaySharePage'))
const CoachDashboardPage = lazy(() => import('./pages/CoachDashboardPage'))
const PayShareByBookingPage = lazy(() => import('./pages/PayShareByBookingPage'))
const PaymentPage = lazy(() => import('./pages/PaymentPage'))
const TournamentMemberPayPage = lazy(() => import('./pages/TournamentMemberPayPage'))
const ClubLogin = lazy(() => import('./pages/ClubLogin'))
const PlatformAdminLogin = lazy(() => import('./pages/PlatformAdminLogin'))
const Logout = lazy(() => import('./pages/Logout'))
const ClubPublicPage = lazy(() => import('./pages/ClubPublicPage'))
import { ErrorBoundary } from './components/ErrorBoundary'
import PlatformAuthGuard from './components/PlatformAuthGuard'
import ClubAuthGuard from './components/ClubAuthGuard'
const App = lazy(() => import('./App'))
const MainAdminPanel = lazy(() => import('./admin/MainAdminPanel'))
const ClubAdminPanel = lazy(() => import('./admin/ClubAdminPanel'))

function LoadingFallback() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      fontSize: '18px',
      color: '#64748b'
    }}>
      Loading...
    </div>
  )
}

function Root() {
  useWesternNumerals()
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL || '/'}>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/admin-login" element={<PlatformAdminLogin />} />
          <Route path="/super-admin" element={<PlatformAdminLogin isSuperAdmin />} />
          <Route path="/logout/:type" element={<Logout />} />
          <Route path="admin/club/:clubId/*" element={<ClubAuthGuard><ClubAdminPanel /></ClubAuthGuard>} />
          <Route path="admin/*" element={<PlatformAuthGuard><MainAdminPanel /></PlatformAuthGuard>} />
          <Route path="/register" element={<Register />} />
          <Route path="/register-club" element={<RegisterClub />} />
          <Route path="/club-login" element={<ClubLogin />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/data-deletion" element={<DataDeletion />} />
          <Route path="/my-bookings" element={<ErrorBoundary fallback={(err) => <div style={{ padding: 40, textAlign: 'center' }}><p>Something went wrong. {err?.message || ''}</p><a href={import.meta.env.BASE_URL || '/'}>Go to home</a></div>}><MyBookingsPage /></ErrorBoundary>} />
          <Route path="/my-favorites" element={<ErrorBoundary fallback={(err) => <div style={{ padding: 40, textAlign: 'center' }}><p>Something went wrong. {err?.message || ''}</p><a href={import.meta.env.BASE_URL || '/'}>Go to home</a></div>}><MyFavoritesPage /></ErrorBoundary>} />
          <Route path="/pay-invite" element={<ErrorBoundary fallback={(err) => <div style={{ padding: 40, textAlign: 'center' }}><p>Something went wrong. {err?.message || ''}</p><a href={import.meta.env.BASE_URL || '/'}>Go to home</a></div>}><PayInvitePage /></ErrorBoundary>} />
          <Route path="/pay-invite/:token" element={<ErrorBoundary fallback={(err) => <div style={{ padding: 40, textAlign: 'center' }}><p>Something went wrong. {err?.message || ''}</p><a href={import.meta.env.BASE_URL || '/'}>Go to home</a></div>}><PayInvitePage /></ErrorBoundary>} />
          <Route path="/pay-share/booking/:bookingId" element={<ErrorBoundary fallback={(err) => <div style={{ padding: 40, textAlign: 'center' }}><p>Something went wrong. {err?.message || ''}</p><a href={import.meta.env.BASE_URL || '/'}>Go to home</a></div>}><PayShareByBookingPage /></ErrorBoundary>} />
          <Route path="/pay-share/:token" element={<ErrorBoundary fallback={(err) => <div style={{ padding: 40, textAlign: 'center' }}><p>Something went wrong. {err?.message || ''}</p><a href={import.meta.env.BASE_URL || '/'}>Go to home</a></div>}><PaySharePage /></ErrorBoundary>} />
          <Route path="/pay/tournament-member/:clubId/:bookingId" element={<ErrorBoundary fallback={(err) => <div style={{ padding: 40, textAlign: 'center' }}><p>Something went wrong. {err?.message || ''}</p><a href={import.meta.env.BASE_URL || '/'}>Go to home</a></div>}><TournamentMemberPayPage /></ErrorBoundary>} />
          <Route path="/pay/:bookingId" element={<ErrorBoundary fallback={(err) => <div style={{ padding: 40, textAlign: 'center' }}><p>Something went wrong. {err?.message || ''}</p><a href={import.meta.env.BASE_URL || '/'}>Go to home</a></div>}><PaymentPage /></ErrorBoundary>} />
          <Route path="/clubs/:clubId" element={<ErrorBoundary fallback={(err) => <div style={{ padding: 40, textAlign: 'center', minHeight: '50vh' }}><p>Something went wrong. {err?.message || ''}</p><a href={import.meta.env.BASE_URL || '/'}>Go to home</a></div>}><ClubPublicPage /></ErrorBoundary>} />
          <Route path="/clubs/:clubId/coach" element={<ErrorBoundary fallback={(err) => <div style={{ padding: 40, textAlign: 'center', minHeight: '50vh' }}><p>Something went wrong. {err?.message || ''}</p><a href={import.meta.env.BASE_URL || '/'}>Go to home</a></div>}><CoachDashboardPage /></ErrorBoundary>} />
          <Route path="/club/:clubId/*" element={<App />} />
        </Routes>
      </Suspense>
      <GlobalSavingOverlay />
    </BrowserRouter>
  )
}

function mountApp() {
  const el = document.getElementById('root')
  const app = import.meta.env.DEV ? (
    <React.StrictMode>
      <Root />
    </React.StrictMode>
  ) : (
    <Root />
  )
  ReactDOM.createRoot(el).render(app)
}

async function bootstrap() {
  const backendStorage = (await import('./storage/backendStorage.js')).default
  initBackendStorage(backendStorage)
  initAppSettingsStorage(backendStorage)
  try {
    await Promise.race([
      backendStorage.bootstrap(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Bootstrap timeout')), 15000))
    ])
  } catch (e) {
    console.warn('Bootstrap (cache fetch):', e?.message || e)
  }
  try {
    await loadClubsAsync()
  } catch (e) {
    console.warn('Bootstrap (clubs):', e?.message || e)
  }
  try {
    const { getAppLanguage } = await import('./storage/appSettingsStorage.js')
    const lang = getAppLanguage()
    if (typeof document !== 'undefined') {
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
      document.documentElement.lang = lang
    }
  } catch (e) {
    console.warn('Bootstrap (language):', e?.message || e)
  }
}

async function initAndMount() {
  try {
    const backendStorage = (await import('./storage/backendStorage.js')).default
    initBackendStorage(backendStorage)
    initAppSettingsStorage(backendStorage)
  } catch (e) {
    console.error('Init backend failed:', e)
  }
  // Mount React first, then bootstrap in a separate macrotask so the initial UI + lazy chunks
  // never share one call stack with heavy DB sync / JSON work (fixes Maximum call stack on /app/).
  mountApp()
  setTimeout(() => {
    bootstrap().catch((e) => console.warn('Bootstrap unexpected:', e?.message || e))
  }, 0)
}

initAndMount()


