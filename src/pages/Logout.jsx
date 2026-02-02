import React, { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { clearPlatformAdminSession } from '../storage/platformAdminAuth'
import { clearClubAdminSession } from '../storage/clubAuth'

/**
 * Handles both platform and club logout via /logout/platform and /logout/club
 */
export default function Logout() {
  const navigate = useNavigate()
  const { type } = useParams()

  useEffect(() => {
    if (type === 'platform') {
      clearPlatformAdminSession()
      navigate('/admin-login', { replace: true })
    } else if (type === 'club') {
      clearClubAdminSession()
      navigate('/club-login', { replace: true })
    } else {
      navigate('/', { replace: true })
    }
  }, [type, navigate])

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh', color: '#64748b' }}>
      Logging out...
    </div>
  )
}
