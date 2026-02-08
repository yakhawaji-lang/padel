import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { canAccessPlatformAdmin } from '../storage/platformAdminAuth'

export default function PlatformAuthGuard({ children }) {
  const location = useLocation()
  const isAuth = canAccessPlatformAdmin()
  if (!isAuth) {
    return <Navigate to="/super-admin" state={{ from: location }} replace />
  }
  return children
}
