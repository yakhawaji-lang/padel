import React from 'react'
import { Navigate } from 'react-router-dom'
import { getPlatformAdminSession, hasPlatformPermission } from '../storage/platformAdminAuth'

export default function PlatformPageGuard({ permission, children }) {
  const session = getPlatformAdminSession()
  if (!session) {
    return <Navigate to="/admin-login" replace />
  }
  if (permission && !hasPlatformPermission(session, permission)) {
    return <Navigate to="/admin/all-clubs" replace />
  }
  return children
}
