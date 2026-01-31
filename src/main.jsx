import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import App from './App'
import MainAdminPanel from './admin/MainAdminPanel'
import ClubAdminPanel from './admin/ClubAdminPanel'
import Login from './pages/Login'
import HomePage from './pages/HomePage'
import ClubPublicPage from './pages/ClubPublicPage'
import Register from './pages/Register'
import './index.css'

function Root() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Home Page - Display all clubs */}
        <Route path="/" element={<HomePage />} />
        
        {/* Main Admin Panel - Manage all clubs */}
        <Route path="/admin/*" element={<MainAdminPanel />} />
        
        {/* Club Admin Panel - Manage specific club */}
        <Route path="/admin/club/:clubId/*" element={<ClubAdminPanel />} />
        
        {/* Platform registration */}
        <Route path="/register" element={<Register />} />
        
        {/* Login/Signup Page */}
        <Route path="/login" element={<Login />} />
        
        {/* Club public commercial page */}
        <Route path="/clubs/:clubId" element={<ClubPublicPage />} />
        
        {/* Club Page - Main application for a specific club */}
        <Route path="/club/:clubId/*" element={<App />} />
      </Routes>
    </BrowserRouter>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)


