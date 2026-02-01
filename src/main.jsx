import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { loadClubsAsync, loadClubs, applyRemoteClubs } from './storage/adminStorage.js'
import { subscribeToClubs } from './storage/supabaseSync.js'
import { applyAppLanguage } from './storage/languageStorage.js'
import './index.css'

// تطبيق اللغة المحفوظة عند بدء التطبيق
applyAppLanguage()

/* Code-splitting: load route components on demand */
const HomePage = lazy(() => import('./pages/HomePage'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const RegisterClub = lazy(() => import('./pages/RegisterClub'))
const ClubLogin = lazy(() => import('./pages/ClubLogin'))
import ClubPublicPage from './pages/ClubPublicPage'
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
          <Route path="/clubs/:clubId" element={<ClubPublicPage />} />
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

loadClubs()
mountApp()
loadClubsAsync()
  .catch((e) => {
    console.warn('Bootstrap loadClubsAsync failed:', e)
  })
subscribeToClubs((clubs) => applyRemoteClubs(clubs))


