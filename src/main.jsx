import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { loadClubsAsync, loadClubs, initBackendStorage } from './storage/adminStorage.js'
import { applyAppLanguage } from './storage/languageStorage.js'
import './index.css'

const USE_POSTGRES = (typeof import.meta === 'undefined' || import.meta.env?.VITE_USE_POSTGRES !== 'false')

// تطبيق اللغة المحفوظة عند بدء التطبيق
applyAppLanguage()

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
const ClubLogin = lazy(() => import('./pages/ClubLogin'))
const PlatformAdminLogin = lazy(() => import('./pages/PlatformAdminLogin'))
const Logout = lazy(() => import('./pages/Logout'))
import ClubPublicPage from './pages/ClubPublicPage'
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
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL || '/'}>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/admin-login" element={<PlatformAdminLogin />} />
          <Route path="/logout/:type" element={<Logout />} />
          <Route path="/admin/*" element={<PlatformAuthGuard><MainAdminPanel /></PlatformAuthGuard>} />
          <Route path="/admin/club/:clubId/*" element={<ClubAuthGuard><ClubAdminPanel /></ClubAuthGuard>} />
          <Route path="/register" element={<Register />} />
          <Route path="/register-club" element={<RegisterClub />} />
          <Route path="/club-login" element={<ClubLogin />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/data-deletion" element={<DataDeletion />} />
          <Route path="/clubs/:clubId" element={<ErrorBoundary fallback={<div style={{ padding: 40, textAlign: 'center', minHeight: '50vh' }}><p>Something went wrong. <a href="/">Go to home</a></p></div>}><ClubPublicPage /></ErrorBoundary>} />
          <Route path="/club/:clubId/*" element={<App />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

function mountApp() {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>,
  )
}

async function bootstrap() {
  if (USE_POSTGRES) {
    const backendStorage = (await import('./storage/backendStorage.js')).default
    initBackendStorage(backendStorage)
    try {
      await Promise.race([
        backendStorage.bootstrap(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Bootstrap timeout')), 15000))
      ])
      await loadClubsAsync()
    } catch (e) {
      console.warn('Bootstrap failed, using fallback:', e?.message || e)
    }
  } else {
    loadClubs()
    const { subscribeToClubs } = await import('./storage/supabaseSync.js')
    const { applyRemoteClubs } = await import('./storage/adminStorage.js')
    subscribeToClubs((clubs) => applyRemoteClubs(clubs))
    await loadClubsAsync().catch((e) => console.warn('loadClubsAsync failed:', e))
  }
}

async function initAndMount() {
  if (USE_POSTGRES) {
    try {
      const backendStorage = (await import('./storage/backendStorage.js')).default
      initBackendStorage(backendStorage)
    } catch (e) {
      console.error('Init backend failed:', e)
    }
  }
  mountApp()
  bootstrap().catch((e) => {
    console.error('Bootstrap failed:', e)
  })
}

initAndMount()


