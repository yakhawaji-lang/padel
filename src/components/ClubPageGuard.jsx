import React from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { getClubAdminSession, hasClubPermission } from '../storage/clubAuth'

export default function ClubPageGuard({ permission, children }) {
  const { clubId } = useParams()
  const session = getClubAdminSession()
  if (!session || session.clubId !== clubId) {
    return <Navigate to="/club-login" replace />
  }
  if (permission && !hasClubPermission(session, permission)) {
    return <Navigate to={`/admin/club/${clubId}/dashboard`} replace />
  }
  return children
}
