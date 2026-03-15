/**
 * PaymentPage - صفحة الدفع للحجوزات (credit_card / mada)
 * /pay/:bookingId?method=credit_card
 */
import React, { useState, useEffect } from 'react'
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom'
import { getBookingById, completePayment } from '../api/dbClient'
import { getAppLanguage } from '../storage/languageStorage'
import { getCurrentPlatformUser } from '../storage/platformAuth'
import './PaymentPage.css'

const t = (en, ar, lang) => (lang === 'ar' ? ar : en)

const formatDate = (dateStr, lang) => {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'ar-SA', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return dateStr
  }
}

const PaymentPage = () => {
  const { bookingId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const method = searchParams.get('method') || 'credit_card'
  const language = getAppLanguage() || 'en'

  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvv, setCvv] = useState('')

  const platformUser = getCurrentPlatformUser()

  useEffect(() => {
    if (!bookingId) {
      setLoading(false)
      setError('Booking ID required')
      return
    }
    getBookingById(bookingId)
      .then(data => {
        setBooking(data)
        setError(null)
      })
      .catch(e => {
        setError(e?.message || 'Failed to load booking')
      })
      .finally(() => setLoading(false))
  }, [bookingId])

  const handlePayNow = async (e) => {
    e.preventDefault()
    if (!booking?.clubId || !bookingId || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await completePayment({ bookingId, clubId: booking.clubId })
      setSuccess(true)
      setTimeout(() => {
        navigate('/my-bookings?payment=success')
      }, 2000)
    } catch (e) {
      setError(e?.message || (language === 'ar' ? 'فشل الدفع. حاول مجدداً.' : 'Payment failed. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  const c = {
    title: t('Complete payment', 'إتمام الدفع', language),
    court: t('Court', 'الملعب', language),
    date: t('Date', 'التاريخ', language),
    time: t('Time', 'الوقت', language),
    amount: t('Amount', 'المبلغ', language),
    paymentMethod: t('Payment method', 'طريقة الدفع', language),
    creditCard: t('Credit card', 'البطاقة الائتمانية', language),
    mada: t('Mada', 'متاب', language),
    cardNumber: t('Card number', 'رقم البطاقة', language),
    expiry: t('Expiry (MM/YY)', 'تاريخ الانتهاء (شهر/سنة)', language),
    cvv: t('CVV', 'رمز الأمان', language),
    payNow: t('Pay now', 'ادفع الآن', language),
    success: t('Payment successful! Redirecting to your bookings...', 'تم الدفع بنجاح! جاري التحويل لحجوزاتك...', language),
    backToHome: t('Back to home', 'العودة للرئيسية', language),
    myBookings: t('My bookings', 'حجوزاتي', language),
    loading: t('Loading...', 'جاري التحميل...', language),
    notFound: t('Booking not found', 'الحجز غير موجود', language),
    loginRequired: t('Please log in to complete payment.', 'يرجى تسجيل الدخول لإتمام الدفع.', language),
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

  if (error && !booking) {
    return (
      <div className="payment-page">
        <div className="payment-card payment-error">
          <h1 className="payment-title">{c.notFound}</h1>
          <p className="payment-message">{error}</p>
          <div className="payment-actions">
            <Link to="/" className="payment-btn payment-btn-secondary">{c.backToHome}</Link>
          </div>
        </div>
      </div>
    )
  }

  if (!platformUser) {
    return (
      <div className="payment-page">
        <div className="payment-card payment-error">
          <h1 className="payment-title">{c.loginRequired}</h1>
          <div className="payment-actions">
            <Link to={`/login?returnTo=/pay/${bookingId}`} className="payment-btn payment-btn-primary">{language === 'ar' ? 'تسجيل الدخول' : 'Log in'}</Link>
            <Link to="/" className="payment-btn payment-btn-secondary">{c.backToHome}</Link>
          </div>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="payment-page">
        <div className="payment-card payment-success">
          <div className="payment-success-icon">✓</div>
          <h1 className="payment-title">{c.success}</h1>
          <Link to="/my-bookings" className="payment-btn payment-btn-primary">{c.myBookings}</Link>
        </div>
      </div>
    )
  }

  const clubName = language === 'ar' && booking?.clubNameAr ? booking.clubNameAr : booking?.clubName
  const paymentMethodLabel = method === 'mada' ? c.mada : c.creditCard

  return (
    <div className="payment-page" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="payment-card">
        <h1 className="payment-title">{c.title}</h1>
        <p className="payment-club-name">{clubName}</p>

        <dl className="payment-details">
          <div className="payment-detail-row">
            <dt>{c.court}</dt>
            <dd>{booking?.courtName || booking?.courtId}</dd>
          </div>
          <div className="payment-detail-row">
            <dt>{c.date}</dt>
            <dd>{formatDate(booking?.date, language)}</dd>
          </div>
          <div className="payment-detail-row">
            <dt>{c.time}</dt>
            <dd>{booking?.startTime} – {booking?.endTime}</dd>
          </div>
          <div className="payment-detail-row payment-detail-amount">
            <dt>{c.amount}</dt>
            <dd>{parseFloat(booking?.totalAmount || 0).toFixed(2)} {booking?.currency || 'SAR'}</dd>
          </div>
          <div className="payment-detail-row">
            <dt>{c.paymentMethod}</dt>
            <dd>{paymentMethodLabel}</dd>
          </div>
        </dl>

        <form onSubmit={handlePayNow} className="payment-form">
          <div className="payment-form-group">
            <label>{c.cardNumber}</label>
            <input
              type="text"
              placeholder="4242 4242 4242 4242"
              value={cardNumber}
              onChange={e => setCardNumber(e.target.value)}
              maxLength={19}
              className="payment-input"
            />
          </div>
          <div className="payment-form-row">
            <div className="payment-form-group">
              <label>{c.expiry}</label>
              <input
                type="text"
                placeholder="MM/YY"
                value={expiry}
                onChange={e => setExpiry(e.target.value)}
                maxLength={5}
                className="payment-input"
              />
            </div>
            <div className="payment-form-group">
              <label>{c.cvv}</label>
              <input
                type="text"
                placeholder="123"
                value={cvv}
                onChange={e => setCvv(e.target.value)}
                maxLength={4}
                className="payment-input"
              />
            </div>
          </div>

          {error && <p className="payment-error-msg">{error}</p>}

          <button type="submit" className="payment-btn payment-btn-primary payment-btn-submit" disabled={submitting}>
            {submitting ? (language === 'ar' ? 'جاري المعالجة...' : 'Processing...') : c.payNow}
          </button>
        </form>

        <p className="payment-hint">
          {language === 'ar' ? 'هذا نموذج تجريبي. لن يتم خصم أي مبلغ فعلي.' : 'This is a simulated payment form. No actual charge will be made.'}
        </p>

        <Link to="/my-bookings" className="payment-link-secondary">{c.myBookings}</Link>
      </div>
    </div>
  )
}

export default PaymentPage
