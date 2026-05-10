import React, { lazy, Suspense, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'

const WESTERN_NUM_MAX_NODES = 600
const WESTERN_NUM_DEBOUNCE_MS = 200

/** Ensure all number inputs and .western-numerals elements use Western numerals (0-9) across the system */
function useWesternNumerals() {
  useEffect(() => {
    let raf = 0
    let debounceT = null
    const runPaint = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        try {
          const root = document.getElementById('root')
          if (!root) return
          const nodes = root.querySelectorAll('input[type="number"], .western-numerals')
          const n = Math.min(nodes.length, WESTERN_NUM_MAX_NODES)
          for (let i = 0; i < n; i++) {
            const el = nodes[i]
            el.setAttribute('lang', 'en')
            el.setAttribute('dir', 'ltr')
          }
        } catch (_) {}
      })
    }
    const schedule = () => {
      if (debounceT) clearTimeout(debounceT)
      debounceT = setTimeout(() => {
        debounceT = null
        runPaint()
      }, WESTERN_NUM_DEBOUNCE_MS)
    }
    const root = document.getElementById('root')
    if (!root) return
    runPaint()
    // Debounced: React + subtree mutations can fire thousands of callbacks/sec and freeze the tab.
    const obs = new MutationObserver(schedule)
    obs.observe(root, { childList: true, subtree: true })
    return () => {
      if (debounceT) clearTimeout(debounceT)
      cancelAnimationFrame(raf)
      obs.disconnect()
    }
  }, [])
}

const USE_POSTGRES = true

/* Code-splitting: load route components on demand */
/* Home: eager — landing /app/ must not hang on a lazy chunk (same Suspense "Loading..." failure mode as pay-invite). */
import HomePage from './pages/HomePage'
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
/* Eager load: pay links must not depend on a lazy chunk (Suspense "Loading..." forever if chunk eval throws). */
import PayInvitePage from './pages/PayInvitePage'
import PaySharePage from './pages/PaySharePage'
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
const GlobalSavingOverlay = lazy(() => import('./components/GlobalSavingOverlay'))

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
          <Route path="/" element={<ErrorBoundary fallback={(err) => <div style={{ padding: 40, textAlign: 'center' }}><p>Something went wrong. {err?.message || ''}</p><a href={import.meta.env.BASE_URL || '/'}>Go to home</a></div>}><HomePage /></ErrorBoundary>} />
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
      <Suspense fallback={null}>
        <GlobalSavingOverlay />
      </Suspense>
    </BrowserRouter>
  )
}

function escapeHtmlBoot(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** If React fails before paint, avoid a blank white screen (especially when console is cleared or scripts 404). */
function showFatalBootError(e) {
  try {
    const root = document.getElementById('root')
    if (!root) return
    const msg = String(e?.message || e || 'error')
    const stack = e?.stack ? String(e.stack) : ''
    root.innerHTML =
      '<div style="padding:24px;font-family:system-ui,sans-serif;max-width:560px;margin:2rem auto;line-height:1.5">' +
      '<h1 style="font-size:1.25rem">PlayTix</h1>' +
      '<p>تعذّر تشغيل التطبيق. جرّب تحديث الصفحة (Ctrl+F5) أو افتح <a href="/app/">/app/</a> مباشرة.</p>' +
      '<p lang="en" style="font-size:14px;color:#64748b">The app failed to start. Hard-refresh (Ctrl+F5) or open <a href="/app/">/app/</a>.</p>' +
      '<pre style="overflow:auto;background:#f1f5f9;padding:12px;border-radius:8px;font-size:11px;white-space:pre-wrap;word-break:break-word">' +
      escapeHtmlBoot(msg + (stack ? '\n' + stack : '')) +
      '</pre></div>'
  } catch (_) {}
}

function mountApp() {
  const el = document.getElementById('root')
  if (!el) throw new Error('Missing #root — check index.html')
  const app = import.meta.env.DEV ? (
    <React.StrictMode>
      <Root />
    </React.StrictMode>
  ) : (
    <Root />
  )
  ReactDOM.createRoot(el).render(app)
}

/** Apply html lang/dir without calling getAppLanguage/getCached (avoids stack overflow from deep parse/recursion). */
function applyBootstrapLanguageFromStorage(backendStorage) {
  if (typeof document === 'undefined') return
  let lang = 'en'
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('playtix_app_language') : null
    if (raw) {
      try {
        const p = JSON.parse(raw)
        if (p === 'ar' || p === 'en') lang = p
      } catch {
        try {
          localStorage.removeItem('playtix_app_language')
        } catch (_) {}
      }
    }
  } catch (_) {}
  try {
    const v = backendStorage?.getCache?.('app_language')
    if (v === 'ar' || v === 'en') lang = v
  } catch (_) {}
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  document.documentElement.lang = lang
}

async function bootstrap() {
  const backendStorage = (await import('./storage/backendStorage.js')).default
  try {
    await Promise.race([
      backendStorage.bootstrap(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Bootstrap timeout')), 15000))
    ])
  } catch (e) {
    console.warn('Bootstrap (cache fetch):', e?.message || e)
  }
  try {
    const { loadClubsAsync } = await import('./storage/adminStorage.js')
    await loadClubsAsync()
  } catch (e) {
    console.warn('Bootstrap (clubs):', e?.message || e)
  }
  try {
    applyBootstrapLanguageFromStorage(backendStorage)
  } catch (e) {
    console.warn('Bootstrap (language):', e?.message || e)
  }
}

async function initAndMount() {
  try {
    const backendStorage = (await import('./storage/backendStorage.js')).default
    const admin = await import('./storage/adminStorage.js')
    const { initAppSettingsStorage } = await import('./storage/appSettingsStorage.js')
    admin.initBackendStorage(backendStorage)
    initAppSettingsStorage(backendStorage)
  } catch (e) {
    console.error('Init backend failed:', e)
  }
  // Mount React first, then bootstrap in a separate macrotask so the initial UI + lazy chunks
  // never share one call stack with heavy DB sync / JSON work (fixes Maximum call stack on /app/).
  try {
    mountApp()
  } catch (e) {
    console.error('mountApp failed:', e)
    showFatalBootError(e)
    return
  }
  setTimeout(() => {
    bootstrap().catch((e) => console.warn('Bootstrap unexpected:', e?.message || e))
  }, 0)
}

initAndMount().catch((e) => {
  console.error('initAndMount failed:', e)
  showFatalBootError(e)
})


