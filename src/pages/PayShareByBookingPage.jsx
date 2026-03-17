/**
 * PayShareByBookingPage - يحصل على رابط الدفع من الحجز ثم يوجه لصفحة الدفع
 * /pay-share/booking/:bookingId?clubId=...
 * يستخدم عندما لا يكون inviteToken متوفراً في البيانات المخزنة
 */
import React, { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom'
import { getShareInviteToken } from '../api/dbClient'
import { getCurrentPlatformUser } from '../storage/platformAuth'
import { getAppLanguage } from '../storage/languageStorage'
import './PaymentPage.css'

const t = (en, ar, lang) => (lang === 'ar' ? ar : en)

const PayShareByBookingPage = () => {
  const { bookingId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const clubId = searchParams.get('clubId')
  const language = getAppLanguage() || 'en'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const platformUser = getCurrentPlatformUser()

  useEffect(() => {
    if (!bookingId || !clubId || !platformUser?.id) {
      setLoading(false)
      setError('Missing parameters')
      return
    }
    getShareInviteToken(bookingId, clubId, platformUser.id)
      .then(d => {
        if (d?.inviteToken) {
          navigate(`/pay-share/${d.inviteToken}`, { replace: true })
        } else {
          setError(language === 'ar' ? 'لم يتم العثور على رابط الدفع' : 'Payment link not found')
        }
      })
      .catch(e => {
        setError(e?.message || (language === 'ar' ? 'فشل تحميل رابط الدفع' : 'Failed to load payment link'))
      })
      .finally(() => setLoading(false))
  }, [bookingId, clubId, platformUser?.id, navigate, language])

  const c = {
    loading: t('Loading...', 'جاري التحميل...', language),
    error: t('Payment link not found', 'لم يتم العثور على رابط الدفع', language),
    backToBookings: t('My bookings', 'حجوزاتي', language),
    loginRequired: t('Please log in to pay.', 'يرجى تسجيل الدخول للدفع.', language),
  }

  if (!platformUser) {
    return (
      <div className="payment-page">
        <div className="payment-card payment-error">
          <h1 className="payment-title">{c.loginRequired}</h1>
          <Link to={`/login?returnTo=/pay-share/booking/${bookingId}?clubId=${clubId}`} className="payment-btn payment-btn-primary">
            {language === 'ar' ? 'تسجيل الدخول' : 'Log in'}
          </Link>
          <Link to="/my-bookings" className="payment-btn payment-btn-secondary">{c.backToBookings}</Link>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="payment-page">
        <div className="payment-card payment-loading">
          <div className="payment-spinner" aria-hidden />
          <p>{c.loading}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="payment-page">
        <div className="payment-card payment-error">
          <h1 className="payment-title">{c.error}</h1>
          <p className="payment-message">{error}</p>
          <Link to="/my-bookings" className="payment-btn payment-btn-primary">{c.backToBookings}</Link>
        </div>
      </div>
    )
  }

  return null
}

export default PayShareByBookingPage
