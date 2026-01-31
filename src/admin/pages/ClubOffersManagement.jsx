import React from 'react'
import OffersManagement from './OffersManagement'

/**
 * نظام العروض لكل نادي — يعيد استخدام المكوّن الكامل مع تمرير النادي الحالي.
 * كل نادي له عروضه الخاصة (club.offers).
 */
const ClubOffersManagement = ({ club, onUpdateClub }) => {
  return (
    <OffersManagement
      currentClub={club}
      onUpdateClub={onUpdateClub}
    />
  )
}

export default ClubOffersManagement
