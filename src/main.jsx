import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { loadClubsAsync, loadClubs, initBackendStorage } from './storage/adminStorage.js'
import { applyAppLanguage } from './storage/languageStorage.js'
import './index.css'

const USE_POSTGRES = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_USE_POSTGRES) === 'true'

// تطبيق اللغة المحفوظة عند بدء التطبيق
applyAppLanguage()

/* Code-splitting: load route components on demand */
const HomePage = lazy(() => import('./pages/HomePage'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const RegisterClub = lazy(() => import('./pages/RegisterClub'))
const ClubLogin = lazy(() => import('./pages/ClubLogin'))
import ClubPublicPage from './pages/ClubPublicPage'
import { ErrorBoundary } from './components/ErrorBoundary'
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
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/admin/*" element={<MainAdminPanel />} />
          <Route path="/admin/club/:clubId/*" element={<ClubAdminPanel />} />
          <Route path="/register" element={<Register />} />
          <Route path="/register-club" element={<RegisterClub />} />
          <Route path="/club-login" element={<ClubLogin />} />
          <Route path="/login" element={<Login />} />
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
    await backendStorage.bootstrap()
    await loadClubsAsync()
  } else {
    loadClubs()
    const { subscribeToClubs } = await import('./storage/supabaseSync.js')
    const { applyRemoteClubs } = await import('./storage/adminStorage.js')
    subscribeToClubs((clubs) => applyRemoteClubs(clubs))
    await loadClubsAsync().catch((e) => console.warn('loadClubsAsync failed:', e))
  }
}

bootstrap().then(() => mountApp()).catch((e) => {
  console.error('Bootstrap failed:', e)
  document.getElementById('root').innerHTML = `<div style="padding:40px;text-align:center;"><p>فشل تحميل التطبيق. تأكد من تشغيل الخادم وقاعدة البيانات.</p><p>Bootstrap failed. Ensure the server and database are running.</p></div>`
})


