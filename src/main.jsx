import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'

/* Code-splitting: load route components on demand */
const HomePage = lazy(() => import('./pages/HomePage'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const ClubPublicPage = lazy(() => import('./pages/ClubPublicPage'))
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
          <Route path="/login" element={<Login />} />
          <Route path="/clubs/:clubId" element={<ClubPublicPage />} />
          <Route path="/club/:clubId/*" element={<App />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)


