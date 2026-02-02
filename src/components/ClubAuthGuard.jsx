import React from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { getClubAdminSession } from '../storage/clubAuth'

export default function ClubAuthGuard({ children }) {
  const { clubId } = useParams()
  const session = getClubAdminSession()
  const isAuth = session && session.clubId === clubId
  if (!isAuth) {
    return <Navigate to="/club-login" replace />
  }
  return children
}
