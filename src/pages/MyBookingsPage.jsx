import React, { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { getCurrentPlatformUser } from '../storage/platformAuth'
import { getMemberBookings, getClubById, loadClubs, refreshClubsFromApi, getClubMembersFromStorage, getAllMembersFromStorage, updateTournamentMemberPaymentEntry } from '../storage/adminStorage'
import * as bookingApi from '../api/dbClient'
import LanguageIcon from '../components/LanguageIcon'
import BookingDetailModal from '../components/BookingDetailModal'
import { UnifiedPaymentMenu, getUnifiedPaymentCopy } from '../components/UnifiedPaymentOptions'
import { getAppLanguage, setAppLanguage } from '../storage/languageStorage'
import './MyBookingsPage.css'
import {
  findPaymentShareForMember,
  resolvePaymentShareDisplayName,
  shareNeedsRefundAcknowledgment,
  isSamePaymentShare,
} from '../utils/paymentShareMemberMatch.js'
import { normalizePhone } from '../utils/phoneNormalize'
import { buildPayShareAbsoluteUrl, buildWhatsAppHrefForSplitInvite, buildClubPublicAbsoluteUrl } from '../utils/splitInviteLinks'
import { getTournamentMemberPaymentEntry } from '../utils/tournamentHelpers.js'
import { isContactsPickSupported, pickPhoneNumbersFromContacts } from '../utils/contactPicker'

/** حجوزات مُلغاة أو منتهية أو بانتظار تأكيد الاسترداد — تظهر في تبويب «ملغاة» وليس في القادمة/السابقة */
const LIST_CANCELLED_STATUSES = ['cancelled', 'expired', 'cancelled_awaiting_refund_ack']

function bookingIsListCancelled(booking) {
  return LIST_CANCELLED_STATUSES.includes((booking?.status || '').toString().toLowerCase())
}

/** كل الحصص النشطة مدفوعة والمجموع يغطي إجمالي الحجز — لا نعرض إضافة مشاركين */
function isSplitFullyPaidByAllParticipants(booking) {
  const shares = booking?.paymentShares || []
  if (!Array.isArray(shares) || shares.length === 0) return false
  const active = shares.filter((s) => !s.removedAt && !s.removed_at)
  if (active.length === 0) return false
  const total = parseFloat(booking.totalAmount ?? booking.price ?? booking.amount) || 0
  const sum = active.reduce((acc, s) => acc + (parseFloat(s.amount) || 0), 0)
  const allPaid = active.every((s) => (s.paidAt || s.paid_at) && !(s.refundedAt || s.refunded_at))
  return allPaid && sum >= total - 0.02
}

const SPLIT_PHONE_MIN_DIGITS = 8

/** ميزانية التقسيم: الإجمالي، مجموع الحصص الحالية، والمتبقي للدعوات الجديدة */
function getSplitBudgetForBooking(booking) {
  const total =
    parseFloat(booking?.totalAmount ?? booking?.total_amount ?? booking?.amount ?? booking?.price ?? 0) || 0
  const shares = Array.isArray(booking?.paymentShares) ? booking.paymentShares : []
  const activeSum = shares.reduce(
    (s, sh) => s + (!(sh.removedAt || sh.removed_at) ? parseFloat(sh.amount) || 0 : 0),
    0
  )
  const remaining = Math.max(0, total - activeSum)
  return { total, activeSum, remaining }
}

function splitPhoneDigits(phone) {
  return String(phone || '').replace(/\D/g, '')
}

function phoneDigitsValid(phone) {
  return splitPhoneDigits(phone).length >= SPLIT_PHONE_MIN_DIGITS
}

/** تقسيم المتبقي بالتساوي على n مشارك (هللات، الباقي على آخر سطر) */
function splitRemainingEquallyCents(remaining, n) {
  if (n <= 0 || remaining <= 0) return []
  const cents = Math.round(remaining * 100)
  const each = Math.floor(cents / n)
  const arr = Array.from({ length: n }, () => each)
  arr[n - 1] += cents - each * n
  return arr.map((c) => c / 100)
}

function phoneTailKeyLocal(phone) {
  const d = splitPhoneDigits(phone)
  if (d.length < SPLIT_PHONE_MIN_DIGITS) return ''
  return d.length <= 10 ? d : d.slice(-10)
}

function phoneAlreadyActiveInBooking(booking, phone) {
  const key = phoneTailKeyLocal(phone)
  if (!key) return false
  const shares = booking?.paymentShares || []
  return shares.some((s) => {
    if (s.removedAt || s.removed_at) return false
    const sk = phoneTailKeyLocal(s.phone || '')
    return sk && (sk === key || sk.endsWith(key) || key.endsWith(sk))
  })
}

function phoneKeysMatch(phoneA, phoneB) {
  const ka = phoneTailKeyLocal(phoneA)
  const kb = phoneTailKeyLocal(phoneB)
  if (!ka || !kb) return false
  return ka === kb || ka.endsWith(kb) || kb.endsWith(ka)
}

function getBookingDisplayProps({ booking, club, memberId }, language) {
  const dateStr = booking.dateStr || booking.date || (booking.startDate && (typeof booking.startDate === 'string' ? booking.startDate : booking.startDate.toISOString?.()?.split('T')[0])) || ''
  const timeStr = (booking.startTime || booking.timeSlot || '') + (booking.endTime ? ` – ${booking.endTime}` : '')
  const isTournament = booking?.isTournament === true
  const courtName = isTournament
    ? (booking.resource || booking.notes || (language === 'en' ? 'Tournament' : 'بطولة'))
    : (booking.resource || booking.courtName || booking.court || (Array.isArray(club?.courts) && booking.courtId && club.courts.find(c => String(c.id) === String(booking.courtId))?.name) || booking.courtId || '—')
  const priceVal = booking.price != null ? booking.price : (booking.totalAmount != null && booking.totalAmount !== '' && booking.totalAmount !== 0 ? booking.totalAmount : null)
  const currencyStr = booking.currency || club?.settings?.currency || 'SAR'
  const clubName = club
    ? (language === 'ar' ? (club.nameAr || club.name) : (club.name || club.nameAr))
    : '—'
  const clubLink = club ? `/clubs/${club.id}` : null
  const isTraining = !isTournament && (booking?.type === 'training' || booking?.data?.type === 'training')
  const st = (booking?.status || '').toString().toLowerCase()
  const isAwaitingRefundAck = st === 'cancelled_awaiting_refund_ack'
  const terminalCancelled = LIST_CANCELLED_STATUSES.includes(st)
  let isPaid = false
  let isPendingPayment = false
  let tournamentEntry = null
  let tournamentAwaitingClub = false
  if (isTournament && memberId) {
    tournamentEntry = getTournamentMemberPaymentEntry(club, booking, memberId)
    const memberPaymentDone = !!(tournamentEntry && (tournamentEntry.clubReceived || tournamentEntry.memberAck))
    isPaid = memberPaymentDone
    isPendingPayment = !memberPaymentDone && !['cancelled', 'expired', 'cancelled_awaiting_refund_ack'].includes(st)
    tournamentAwaitingClub = !!(tournamentEntry && tournamentEntry.paymentMethod === 'at_club' && !tournamentEntry.clubReceived && !tournamentEntry.memberAck)
  } else if (!isTournament) {
    const shares = Array.isArray(booking?.paymentShares) ? booking.paymentShares : []
    const total =
      parseFloat(booking.totalAmount ?? booking.total_amount ?? booking.amount ?? booking.price ?? 0) || 0
    const paid = parseFloat(booking.paidAmount ?? booking.paid_amount ?? 0) || 0
    if (shares.length > 0) {
      const paidSum = shares.reduce(
        (s, sh) =>
          s +
          ((sh.paidAt || sh.paid_at) && !(sh.refundedAt || sh.refunded_at) ? parseFloat(sh.amount) || 0 : 0),
        0
      )
      const activeSum = shares.reduce(
        (s, sh) => s + (!(sh.removedAt || sh.removed_at) ? parseFloat(sh.amount) || 0 : 0),
        0
      )
      const refTotal = total > 0.01 ? total : activeSum
      isPaid = !isAwaitingRefundAck && refTotal > 0.01 && paidSum >= refTotal - 0.02
      isPendingPayment =
        !['cancelled', 'expired', 'cancelled_awaiting_refund_ack'].includes(st) &&
        (!isPaid || ['pending_payments', 'partially_paid', 'pending_payment', 'initiated', 'locked'].includes(st))
    } else if (isAwaitingRefundAck || ['cancelled', 'expired'].includes(st)) {
      isPaid = false
      isPendingPayment = false
    } else if (total <= 0.01) {
      isPaid = ['confirmed'].includes(st)
      isPendingPayment = ['pending_payment', 'pending_payments', 'partially_paid', 'initiated', 'locked'].includes(st)
    } else {
      isPaid = paid >= total - 0.02
      isPendingPayment =
        !isPaid || ['pending_payment', 'pending_payments', 'partially_paid', 'initiated', 'locked'].includes(st)
    }
  }
  return {
    dateStr,
    timeStr,
    courtName,
    priceVal,
    currencyStr,
    clubName,
    clubLink,
    isTraining,
    isTournament,
    isPaid,
    isPendingPayment,
    isAwaitingRefundAck,
    tournamentEntry,
    tournamentAwaitingClub,
    terminalCancelled,
  }
}

const MyBookingsPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const fromClubId = searchParams.get('from')
  const paymentSuccess = searchParams.get('payment') === 'success'
  const [member, setMember] = useState(null)
  const [bookings, setBookings] = useState([])
  const [filter, setFilter] = useState('upcoming')
  const [language, setLanguage] = useState(() => getAppLanguage())
  const [markingPayAtClub, setMarkingPayAtClub] = useState(null)
  const [detailRow, setDetailRow] = useState(null)
  const [payMenuOpen, setPayMenuOpen] = useState(null)
  const [addSplitForBookingId, setAddSplitForBookingId] = useState(null)
  const [addSplitStep, setAddSplitStep] = useState(1)
  const [addSplitPeople, setAddSplitPeople] = useState([{ phone: '' }])
  const [addSplitRows, setAddSplitRows] = useState([])
  const [addSplitWizardWarnings, setAddSplitWizardWarnings] = useState([])
  const [addSplitBusy, setAddSplitBusy] = useState(false)
  const [addSplitFavorites, setAddSplitFavorites] = useState([])
  const [addSplitFavoritesLoading, setAddSplitFavoritesLoading] = useState(false)
  const [addSplitContactBusy, setAddSplitContactBusy] = useState(false)
  const [trainingInvites, setTrainingInvites] = useState([])
  const [dismissingInviteId, setDismissingInviteId] = useState(null)
  const [walletByClub, setWalletByClub] = useState({})
  const [shareRowEditKey, setShareRowEditKey] = useState(null)
  const [shareRowEditPhone, setShareRowEditPhone] = useState('')
  const [bootOpenSplitParticipantActions, setBootOpenSplitParticipantActions] = useState(false)
  const [shareRowBusyKey, setShareRowBusyKey] = useState(null)

  useEffect(() => {
    setAppLanguage(language)
  }, [language])

  useEffect(() => {
    const user = getCurrentPlatformUser()
    setMember(user)
    if (!user) {
      const returnTo = (location.pathname + location.search) || '/my-bookings'
      navigate(`/login?return=${encodeURIComponent(returnTo)}`)
      return
    }
  }, [navigate, location.pathname, location.search])

  useEffect(() => {
    const closePayMenu = (e) => {
      if (payMenuOpen && !e.target.closest('.my-bookings-pay-dropdown, .my-bookings-card-pay-wrap')) {
        setPayMenuOpen(null)
      }
    }
    document.addEventListener('click', closePayMenu)
    return () => document.removeEventListener('click', closePayMenu)
  }, [payMenuOpen])

  useEffect(() => {
    if (!member?.id) return
    const loadFromApi = async () => {
      await refreshClubsFromApi()
      loadClubs()
      setBookings(getMemberBookings(member.id))
    }
    const syncFromCache = () => {
      loadClubs()
      setBookings(getMemberBookings(member.id))
    }
    loadFromApi()
    window.addEventListener('clubs-synced', syncFromCache)
    return () => window.removeEventListener('clubs-synced', syncFromCache)
  }, [member?.id])

  const clubIdsForWallet = React.useMemo(() => {
    const ids = new Set()
    if (fromClubId) ids.add(String(fromClubId))
    bookings.forEach(({ club }) => {
      if (club?.id != null) ids.add(String(club.id))
    })
    return [...ids]
  }, [bookings, fromClubId])

  const loadWalletBalances = React.useCallback(async () => {
    if (!member?.id || clubIdsForWallet.length === 0) {
      setWalletByClub({})
      return
    }
    const entries = await Promise.all(
      clubIdsForWallet.map(async (clubId) => {
        try {
          const r = await bookingApi.getWalletBalance(clubId, member.id)
          const raw = r?.balance
          const bal = typeof raw === 'number' ? raw : parseFloat(raw)
          return [clubId, Number.isFinite(bal) ? bal : 0]
        } catch {
          return [clubId, 0]
        }
      })
    )
    setWalletByClub(Object.fromEntries(entries))
  }, [member?.id, clubIdsForWallet])

  useEffect(() => {
    loadWalletBalances()
  }, [loadWalletBalances])

  useEffect(() => {
    const onSync = () => loadWalletBalances()
    window.addEventListener('clubs-synced', onSync)
    return () => window.removeEventListener('clubs-synced', onSync)
  }, [loadWalletBalances])

  const loadTrainingInvites = React.useCallback(async () => {
    if (!member?.id) {
      setTrainingInvites([])
      return
    }
    try {
      const list = await bookingApi.getMyTrainingInvites(member.id)
      setTrainingInvites(Array.isArray(list) ? list : [])
    } catch {
      setTrainingInvites([])
    }
  }, [member?.id])

  useEffect(() => {
    loadTrainingInvites()
  }, [loadTrainingInvites])

  useEffect(() => {
    const onSync = () => loadTrainingInvites()
    window.addEventListener('clubs-synced', onSync)
    return () => window.removeEventListener('clubs-synced', onSync)
  }, [loadTrainingInvites])

  useEffect(() => {
    if (!addSplitForBookingId || !member?.id) {
      setAddSplitFavorites([])
      return
    }
    const entry = bookings.find((x) => String(x.booking?.id) === String(addSplitForBookingId))
    const clubId = entry?.club?.id
    if (!clubId) {
      setAddSplitFavorites([])
      return
    }
    let cancelled = false
    ;(async () => {
      setAddSplitFavoritesLoading(true)
      try {
        const ids = await bookingApi.getFavoriteMembers(member.id, clubId)
        const idList = Array.isArray(ids) ? ids.map(String) : []
        const fromAll = getAllMembersFromStorage() || []
        const fromClub = getClubMembersFromStorage(clubId) || []
        const byId = new Map()
        for (const m of [...fromClub, ...fromAll]) {
          if (m?.id != null) byId.set(String(m.id), m)
        }
        const resolved = idList.map((id) => {
          const m = byId.get(id)
          const phone = (m?.mobile || m?.phone || '').trim()
          return {
            id,
            name: (m?.name || m?.email || id).toString(),
            phone
          }
        })
        if (!cancelled) setAddSplitFavorites(resolved)
      } catch {
        if (!cancelled) setAddSplitFavorites([])
      } finally {
        if (!cancelled) setAddSplitFavoritesLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [addSplitForBookingId, member?.id, bookings])

  const closeAddSplitPanel = () => {
    setAddSplitForBookingId(null)
    setAddSplitStep(1)
    setAddSplitPeople([{ phone: '' }])
    setAddSplitRows([])
    setAddSplitWizardWarnings([])
  }

  const openAddSplitPanel = (bookingId) => {
    setAddSplitForBookingId(bookingId)
    setAddSplitStep(1)
    setAddSplitPeople([{ phone: '' }])
    setAddSplitRows([])
    setAddSplitWizardWarnings([])
  }

  const applyFavoriteToSplitPeople = (f) => {
    const p = (f?.phone || '').trim()
    if (!p) return
    const name = (f?.name || '').trim()
    setAddSplitPeople((prev) => {
      const emptyIdx = prev.findIndex((row) => !String(row.phone || '').trim())
      const entry = name ? { phone: p, name } : { phone: p }
      if (emptyIdx >= 0) {
        const next = [...prev]
        next[emptyIdx] = entry
        return next
      }
      return [...prev, entry]
    })
  }

  const applyPhonesToSplitPeople = (phones) => {
    const list = (phones || []).map((p) => String(p).trim()).filter(Boolean)
    if (list.length === 0) return
    setAddSplitPeople((prev) => {
      let next = [...prev]
      for (const pi of list) {
        const emptyIdx = next.findIndex((r) => !String(r.phone || '').trim())
        if (emptyIdx >= 0) {
          next[emptyIdx] = { phone: pi }
        } else {
          next = [...next, { phone: pi }]
        }
      }
      return next
    })
  }

  const pickPhonesForSplit = async () => {
    setAddSplitContactBusy(true)
    try {
      const { phones, error } = await pickPhoneNumbersFromContacts({ multiple: true, max: 12 })
      if (error === 'USER_CANCELLED') return
      if (phones.length > 0) applyPhonesToSplitPeople(phones)
    } finally {
      setAddSplitContactBusy(false)
    }
  }

  const today = new Date().toISOString().split('T')[0]
  const normDate = (r) => {
    const d = r.booking.dateStr || r.booking.date || r.booking.startDate || ''
    return typeof d === 'string' ? d.split('T')[0] : (d && d.toISOString ? d.toISOString().split('T')[0] : '')
  }
  const cancelledList = bookings
    .filter((r) => bookingIsListCancelled(r.booking))
    .sort((a, b) => String(normDate(b) || '').localeCompare(String(normDate(a) || '')))
  const upcoming = bookings.filter((r) => normDate(r) >= today && !bookingIsListCancelled(r.booking))
  const past = bookings.filter((r) => normDate(r) < today && !bookingIsListCancelled(r.booking))
  const displayed = filter === 'upcoming' ? upcoming : filter === 'past' ? past : cancelledList

  /** من صفحة النادي: ?booking=id — اختر التبويب المناسب ثم مرّر ولوّن البطاقة */
  const focusBookingIdParam = searchParams.get('booking')
  const focusScrollDoneRef = useRef(null)

  useEffect(() => {
    if (!focusBookingIdParam || !member?.id || bookings.length === 0) return
    const item = bookings.find((x) => String(x.booking?.id) === String(focusBookingIdParam))
    if (!item) return
    const b = item.booking
    if (bookingIsListCancelled(b)) {
      setFilter('cancelled')
      return
    }
    const d = (b.dateStr || b.date || b.startDate || '').toString().split('T')[0]
    const todayStr = new Date().toISOString().split('T')[0]
    setFilter(d < todayStr ? 'past' : 'upcoming')
  }, [focusBookingIdParam, bookings, member?.id])

  useLayoutEffect(() => {
    if (!focusBookingIdParam || !member?.id) return
    if (focusScrollDoneRef.current === focusBookingIdParam) return
    const inList = displayed.some(({ booking: b }) => String(b?.id) === String(focusBookingIdParam))
    if (!inList) return

    let cancelled = false
    const attempt = () => {
      if (cancelled || focusScrollDoneRef.current === focusBookingIdParam) return
      const el = document.getElementById(`my-booking-card-${focusBookingIdParam}`)
      if (!el) return
      focusScrollDoneRef.current = focusBookingIdParam
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('my-bookings-card--focus-highlight')
      window.setTimeout(() => {
        el.classList.remove('my-bookings-card--focus-highlight')
      }, 2600)
      const next = new URLSearchParams(searchParams)
      next.delete('booking')
      const qs = next.toString()
      navigate(qs ? `/my-bookings?${qs}` : '/my-bookings', { replace: true })
    }

    attempt()
    const t0 = window.setTimeout(attempt, 0)
    const t1 = window.setTimeout(attempt, 100)
    return () => {
      cancelled = true
      clearTimeout(t0)
      clearTimeout(t1)
    }
  }, [focusBookingIdParam, displayed, member?.id, navigate, searchParams])

  useEffect(() => {
    if (!searchParams.get('booking')) focusScrollDoneRef.current = null
  }, [searchParams])

  useEffect(() => {
    const bid = searchParams.get('booking')
    if (!bid || !member?.id || bookings.length === 0) return
    const exists = bookings.some((x) => String(x.booking?.id) === String(bid))
    if (exists) return
    const next = new URLSearchParams(searchParams)
    next.delete('booking')
    const qs = next.toString()
    navigate(qs ? `/my-bookings?${qs}` : '/my-bookings', { replace: true })
  }, [searchParams, bookings, member?.id, navigate])

  const shareMemberDirectory = React.useMemo(() => {
    const byId = new Map()
    for (const m of getAllMembersFromStorage() || []) {
      if (m?.id != null) byId.set(String(m.id), m)
    }
    const clubIds = new Set()
    bookings.forEach(({ club }) => {
      if (club?.id) clubIds.add(club.id)
    })
    clubIds.forEach((cid) => {
      for (const m of getClubMembersFromStorage(cid) || []) {
        if (m?.id != null && !byId.has(String(m.id))) byId.set(String(m.id), m)
      }
    })
    return [...byId.values()]
  }, [bookings])

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    try {
      return new Date(dateStr + 'T12:00:00').toLocaleDateString(language === 'en' ? 'en-US' : 'ar-SA', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return dateStr
    }
  }

  const resolveShareInviteToken = async (clubId, inviteToken, bookingId) => {
    let token = inviteToken
    if (!token && bookingId && member?.id) {
      try {
        const d = await bookingApi.getShareInviteToken(bookingId, clubId, member.id)
        token = d?.inviteToken
      } catch (_) {}
    }
    return token
  }

  const handleRecordPayment = async (clubId, inviteToken, bookingId) => {
    if (!clubId) return
    const token = await resolveShareInviteToken(clubId, inviteToken, bookingId)
    if (!token) return
    setMarkingPayAtClub(`share-${token}`)
    try {
      await bookingApi.recordPayment({ inviteToken: token, clubId, paymentMethod: 'at_club' })
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clubs-synced'))
      await refreshClubsFromApi()
      loadClubs()
      setBookings(getMemberBookings(member.id))
      setPayMenuOpen(null)
    } catch (e) {
      console.error('recordPayment failed:', e)
    } finally {
      setMarkingPayAtClub(null)
    }
  }

  const handlePayShareFromWallet = async (clubId, inviteToken, bookingId, busyKey) => {
    if (!clubId) return
    const token = await resolveShareInviteToken(clubId, inviteToken, bookingId)
    if (!token) {
      if (typeof window !== 'undefined' && window.alert) {
        window.alert(language === 'ar' ? 'تعذّر تحديد حصتك للدفع من المحفظة.' : 'Could not resolve your share for wallet payment.')
      }
      return
    }
    setMarkingPayAtClub(busyKey || `wallet-${token}`)
    try {
      await bookingApi.recordPayment({ inviteToken: token, clubId, paymentMethod: 'wallet' })
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clubs-synced'))
      await refreshClubsFromApi()
      loadClubs()
      setBookings(getMemberBookings(member.id))
      await loadWalletBalances()
      setPayMenuOpen(null)
    } catch (e) {
      console.error('wallet share payment failed:', e)
      if (typeof window !== 'undefined' && window.alert) {
        window.alert(language === 'ar' ? (e?.message || 'فشل الدفع من المحفظة') : (e?.message || 'Wallet payment failed'))
      }
    } finally {
      setMarkingPayAtClub(null)
    }
  }

  const handleMarkPayAtClub = async (clubId, bookingId) => {
    setMarkingPayAtClub(bookingId)
    try {
      await bookingApi.markPayAtClub(bookingId, clubId)
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clubs-synced'))
      await refreshClubsFromApi()
      loadClubs()
      setBookings(getMemberBookings(member.id))
    } catch (e) {
      console.error('markPayAtClub failed:', e)
    } finally {
      setMarkingPayAtClub(null)
    }
  }

  const handleTournamentPayAtClubChoice = async (clubId, bookingId, memberId) => {
    if (!clubId || !bookingId || !memberId) return
    setMarkingPayAtClub(`t-${bookingId}`)
    try {
      await updateTournamentMemberPaymentEntry(clubId, bookingId, memberId, { paymentMethod: 'at_club' })
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clubs-synced'))
      await refreshClubsFromApi()
      loadClubs()
      setBookings(getMemberBookings(member.id))
      setPayMenuOpen(null)
    } catch (e) {
      console.error(e)
    } finally {
      setMarkingPayAtClub(null)
    }
  }

  const getStatusLabel = (status) => {
    const s = (status || 'confirmed').toString().toLowerCase()
    const labels = {
      en: {
        initiated: 'In progress', locked: 'Reserved', pending_payments: 'Awaiting payments', pending_payment: 'Awaiting payment', partially_paid: 'Partial payment', confirmed: 'Confirmed',
        cancelled: 'Cancelled', expired: 'Expired', cancelled_awaiting_refund_ack: 'Cancelled — confirm refund received'
      },
      ar: {
        initiated: 'قيد الإجراء', locked: 'محجوز', pending_payments: 'بانتظار الدفعات', pending_payment: 'بانتظار الدفع', partially_paid: 'دفع جزئي', confirmed: 'مؤكد',
        cancelled: 'ملغي', expired: 'منتهي', cancelled_awaiting_refund_ack: 'ملغي — أكّد استلام الاسترداد'
      }
    }
    return (labels[language] || labels.en)[s] || s
  }

  const getStatusClass = (status) => {
    const s = (status || 'confirmed').toString().toLowerCase()
    if (['confirmed'].includes(s)) return 'status-confirmed'
    if (['cancelled_awaiting_refund_ack'].includes(s)) return 'status-refund-ack'
    if (['initiated', 'locked', 'pending_payments', 'pending_payment', 'partially_paid'].includes(s)) return 'status-pending'
    if (['cancelled', 'expired'].includes(s)) return 'status-cancelled'
    return ''
  }

  const handleAckRefund = async (share, clubId) => {
    if (!member?.id || !clubId) return
    setMarkingPayAtClub(`ack-${share.id || share.inviteToken}`)
    try {
      await bookingApi.acknowledgeShareRefund({
        shareId: share.id || undefined,
        inviteToken: share.inviteToken || undefined,
        clubId,
        memberId: member.id,
        phone: member.phone || member.mobile
      })
      window.dispatchEvent(new CustomEvent('clubs-synced'))
      await refreshClubsFromApi()
      loadClubs()
      setBookings(getMemberBookings(member.id))
    } catch (e) {
      console.error(e)
      window.alert(language === 'en' ? (e?.message || 'Failed') : (e?.message || 'فشل'))
    } finally {
      setMarkingPayAtClub(null)
    }
  }

  const canAddSplitParticipants = (booking, club, m) => {
    if (!m?.id || !club?.id || booking?.isTournament) return false
    const st = (booking.status || '').toString()
    if (['cancelled', 'expired', 'cancelled_awaiting_refund_ack'].includes(st)) return false
    const initiator = String(booking.memberId || booking.initiatorMemberId || '') === String(m.id)
    if (!initiator) return false
    const shares = booking.paymentShares || []
    if (!Array.isArray(shares) || shares.length === 0) return false
    if (isSplitFullyPaidByAllParticipants(booking)) return false
    return true
  }

  const t = {
    en: {
      myBookings: 'My Bookings',
      backToHome: 'Back to home',
      upcoming: 'Upcoming',
      past: 'Past',
      date: 'Date',
      time: 'Time',
      court: 'Court',
      club: 'Club',
      price: 'Price',
      status: 'Status',
      actions: 'Actions',
      cancel: 'Cancel',
      noBookings: 'No bookings',
      noUpcoming: 'No upcoming bookings.',
      noPast: 'No past bookings.',
      cancelled: 'Cancelled',
      noCancelled: 'No cancelled bookings.',
      walletTitle: 'Club wallet',
      walletSubtitle: 'Balance you can use for club fees (credits from refunds appear here).',
      walletAtClub: 'at',
      goToClub: 'View club',
      edit: 'Edit',
      participants: 'Participants',
      paid: 'Paid',
      pending: 'Pending',
      resendInvite: 'Resend invite',
      pay: 'Pay',
      payAtClub: 'Pay at club',
      payAtClubHint: 'Cash or card at the club',
      payElectronic: 'Pay electronically',
      payElectronicHint: 'Card or Mada online',
      payAtClubConfirm: "I'll pay at club",
      payNow: 'Pay now',
      loading: 'Loading…',
      bookCourt: 'Book a court',
      paymentSuccess: 'Payment completed successfully!',
      typeCourt: 'Court',
      typeTraining: 'Training',
      typeTournament: 'Tournament',
      paidLabel: 'Paid',
      awaitingPayment: 'Awaiting payment',
      splitFavorites: 'Favorites',
      splitFavoritesEmpty: 'No favorites in this club yet. Add them from My favorites.',
      splitFavoritesNoPhone: 'No phone on file',
      splitFavHint: 'Tap a name to add their phone to the list.',
      splitPickContacts: 'From contacts',
      splitParticipants: 'Split payment participants',
      yourShareAmountsHint: 'Only you see each person’s share amount.',
      trainingInviteTitle: 'Training join requests',
      trainingInviteIntro: 'A coach sent you a request to join a training session. It stays here until you open the club page to book or tap dismiss.',
      trainingInviteDismiss: 'Dismiss',
      openClubToJoin: 'Open club page to join',
      tournamentAwaitingClub: 'Pay at club — awaiting club confirmation',
      leaveTournament: 'Leave tournament',
      bookerEditPhone: 'Edit number',
      bookerSavePhone: 'Save',
      bookerRemoveShare: 'Remove',
      bookerShareConfirmRemove: 'Remove this participant? They have not paid yet.',
      bookerShareError: 'Something went wrong. Try again.',
      participantLeaveShare: 'Leave split',
      participantLeaveConfirm: 'Remove yourself from this split? You have not paid yet.',
      splitParticipantModifyHint:
        'Change how you receive a refund for your share (wallet, at the club, or card if you paid online).',
      participantRefundAwaiting: 'Refund requested — club will process it',
      splitAddBulkHint: 'Add several phone + amount rows, then send all invites at once.',
      splitWizardStep1: 'People',
      splitWizardStep2: 'Amounts',
      splitWizardStep3: 'Confirm',
      splitWizardHintStep1:
        'Add phone numbers from favorites, contacts, or manually. On the next screen you split the remaining booking balance among them.',
      splitWizardReviewIntro: 'Review amounts, then send payment invites to everyone you added.',
      splitWizardNext: 'Next',
      splitWizardBack: 'Back',
      splitWizardSendInvites: 'Send invites',
      splitNoRemaining: 'There is no remaining balance to assign to new participants.',
      splitNoValidPhones:
        'Add at least one valid phone (8+ digits) for someone not already included in this split.',
      splitAmountsInvalid: 'Enter a positive amount for each new participant.',
      splitOverBudget: 'The assigned total is more than the remaining balance for this booking.',
      splitSplitEqually: 'Split remaining equally',
      splitBudgetRemaining: 'Remaining for new invites',
      splitBudgetTotal: 'Booking total',
      splitBudgetAllocated: 'Already allocated',
      splitAssignedSum: 'Assigned to new invites',
      splitLeftToAssign: 'Still unassigned',
      splitPhoneLabel: 'Phone',
      splitRemoveRow: 'Remove',
      splitParticipantHeading: 'New participants',
      splitWarnSkippedSelf: 'Your own number was not added as a new invitee.',
      splitWarnSkippedInBooking: 'Some numbers were skipped because they are already part of this split.',
      splitWarnSkippedDup: 'Duplicate numbers were merged into one row.',
      splitWizardAriaSteps: 'Steps to add split payment participants',
      payStateKicker: 'Your payment',
      payAtClubStateTitle: 'Pay at the club',
      payAtClubStateDesc:
        'Front desk will confirm once they receive your payment. You can switch to card or Mada online below if you change your mind.',
      payAtClubStateBadge: 'Selected',
      switchToElectronicPayment: 'Switch to electronic payment',
    },
    ar: {
      myBookings: 'حجوزاتي',
      backToHome: 'العودة للرئيسية',
      upcoming: 'القادمة',
      past: 'السابقة',
      date: 'التاريخ',
      time: 'الوقت',
      court: 'الملعب',
      club: 'النادي',
      price: 'السعر',
      status: 'الحالة',
      actions: 'إجراءات',
      cancel: 'إلغاء',
      noBookings: 'لا توجد حجوزات',
      noUpcoming: 'لا توجد حجوزات قادمة.',
      noPast: 'لا توجد حجوزات سابقة.',
      cancelled: 'الملغاة',
      noCancelled: 'لا توجد حجوزات ملغاة.',
      walletTitle: 'محفظة النادي',
      walletSubtitle: 'رصيد يُستخدم لرسوم الحجز في النادي (تظهر هنا أرصدة الاسترداد إلى المحفظة).',
      walletAtClub: 'في',
      goToClub: 'عرض النادي',
      edit: 'تعديل',
      participants: 'المشاركون',
      paid: 'دفع',
      pending: 'قيد الانتظار',
      resendInvite: 'إعادة إرسال الدعوة',
      pay: 'دفع',
      payAtClub: 'الدفع في النادي',
      payAtClubHint: 'كاش أو بطاقة في النادي',
      payElectronic: 'الدفع الإلكتروني',
      payElectronicHint: 'بطاقة أو متاب أونلاين',
      payAtClubConfirm: 'سأدفع في النادي',
      payNow: 'ادفع الآن',
      loading: 'جاري التحميل…',
      bookCourt: 'احجز ملعباً',
      paymentSuccess: 'تم الدفع بنجاح!',
      typeCourt: 'ملعب',
      typeTraining: 'حصص تدريب',
      typeTournament: 'بطولة',
      paidLabel: 'مدفوع',
      awaitingPayment: 'بانتظار الدفع',
      splitFavorites: 'المفضلة',
      splitFavoritesEmpty: 'لا يوجد مفضلون في هذا النادي بعد. أضفهم من صفحة المفضلة.',
      splitFavoritesNoPhone: 'لا يوجد جوال',
      splitFavHint: 'اضغط على الاسم لإضافة الجوال إلى القائمة.',
      splitPickContacts: 'من جهات الاتصال',
      splitParticipants: 'المشاركون في التقسيم',
      yourShareAmountsHint: 'أنت فقط ترى مبلغ حصة كل مشارك.',
      trainingInviteTitle: 'طلبات انضمام — حصص تدريب',
      trainingInviteIntro: 'تم إرسال طلب انضمام إلى حصة تدريبية إليك من المدرب. يبقى ظاهراً هنا حتى تفتح صفحة النادي للحجز أو تضغط إخفاء.',
      trainingInviteDismiss: 'إخفاء',
      openClubToJoin: 'فتح صفحة النادي للانضمام',
      tournamentAwaitingClub: 'الدفع في النادي — بانتظار تأكيد الاستقبال',
      leaveTournament: 'مغادرة البطولة',
      bookerEditPhone: 'تعديل الرقم',
      bookerSavePhone: 'حفظ',
      bookerRemoveShare: 'حذف',
      bookerShareConfirmRemove: 'إزالة هذا المشارك؟ لم يكمل الدفع بعد.',
      bookerShareError: 'حدث خطأ. حاول مرة أخرى.',
      participantLeaveShare: 'إلغاء المشاركة',
      participantLeaveConfirm: 'إزالة نفسك من التقسيم؟ لم تدفع بعد.',
      splitParticipantModifyHint:
        'تعديل طريقة استرداد حصتك: محفظة النادي، نقداً في النادي، أو للبطاقة إن دفعت إلكترونياً.',
      participantRefundAwaiting: 'تم طلب الاسترداد — بانتظار تنفيذ النادي',
      splitAddBulkHint: 'أضف عدة أسطر (جوال + مبلغ) ثم أرسل كل الدعوات دفعة واحدة.',
      splitWizardStep1: 'المشاركون',
      splitWizardStep2: 'التوزيع',
      splitWizardStep3: 'التأكيد',
      splitWizardHintStep1:
        'أضف أرقام الجوال من المفضلة أو جهات الاتصال أو يدوياً. في الخطوة التالية توزّع المبلغ المتبقي من الحجز.',
      splitWizardReviewIntro: 'راجِع المبالغ ثم أرسل دعوات الدفع لمن أضفتهم.',
      splitWizardNext: 'التالي',
      splitWizardBack: 'رجوع',
      splitWizardSendInvites: 'إرسال الدعوات',
      splitNoRemaining: 'لا يوجد رصيد متبقٍ لإضافة مشاركين جددين.',
      splitNoValidPhones: 'أضف رقماً صالحاً واحداً على الأقل (8 أرقام فأكثر) لشخص غير مضمّن في التقسيم حالياً.',
      splitAmountsInvalid: 'أدخل مبلغاً موجباً لكل مشارك جديد.',
      splitOverBudget: 'مجموع المبالغ يتجاوز الرصيد المتبقي لهذا الحجز.',
      splitSplitEqually: 'تقسيم المتبقي بالتساوي',
      splitBudgetRemaining: 'المتبقي لدعوات جديدة',
      splitBudgetTotal: 'إجمالي الحجز',
      splitBudgetAllocated: 'المخصص حالياً',
      splitAssignedSum: 'المخصص للمدعوين الجدد',
      splitLeftToAssign: 'غير موزّع بعد',
      splitPhoneLabel: 'الجوال',
      splitRemoveRow: 'حذف',
      splitParticipantHeading: 'مشاركون جدد',
      splitWarnSkippedSelf: 'لم يُضف رقمك كمدعو جديد.',
      splitWarnSkippedInBooking: 'تجاهلنا أرقاماً لأنها موجودة مسبقاً في هذا التقسيم.',
      splitWarnSkippedDup: 'دُمجت الأرقام المكررة في سطر واحد.',
      splitWizardAriaSteps: 'خطوات إضافة مشاركين للتقسيم',
      payStateKicker: 'دفع حصتك',
      payAtClubStateTitle: 'الدفع في النادي',
      payAtClubStateDesc:
        'سيُؤكَّد الدفع من الاستقبال عند استلام المبلغ. يمكنك أدناه التبديل للدفع الإلكتروني (بطاقة أو مدى) إذا غيّرت رأيك.',
      payAtClubStateBadge: 'تم الاختيار',
      switchToElectronicPayment: 'التبديل إلى الدفع الإلكتروني',
    }
  }
  const c = t[language] || t.en

  const addSplitApplyEqualAmounts = (booking) => {
    const { remaining } = getSplitBudgetForBooking(booking)
    const n = addSplitRows.length
    if (n === 0) return
    const amounts = splitRemainingEquallyCents(remaining, n)
    setAddSplitRows((prev) =>
      prev.map((row, i) => ({ ...row, amount: amounts[i] != null ? String(amounts[i]) : '' }))
    )
  }

  const addSplitGoToAmountsStep = (booking) => {
    const { remaining } = getSplitBudgetForBooking(booking)
    if (remaining <= 0.009) {
      window.alert(c.splitNoRemaining)
      return
    }
    const bookerPhone = member?.phone || member?.mobile || ''
    const warnings = []
    const collected = []
    const seen = new Set()
    let skippedSelf = 0
    let skippedDup = 0
    let skippedBooking = 0

    for (const row of addSplitPeople) {
      const phone = String(row.phone || '').trim()
      if (!phoneDigitsValid(phone)) continue
      const key = phoneTailKeyLocal(phone)
      if (!key) continue
      if (bookerPhone && phoneKeysMatch(phone, bookerPhone)) {
        skippedSelf++
        continue
      }
      if (phoneAlreadyActiveInBooking(booking, phone)) {
        skippedBooking++
        continue
      }
      if (seen.has(key)) {
        skippedDup++
        continue
      }
      seen.add(key)
      collected.push({
        phone,
        name: String(row.name || '').trim(),
        amount: '',
      })
    }

    if (collected.length === 0) {
      window.alert(c.splitNoValidPhones)
      return
    }

    if (skippedSelf) warnings.push(c.splitWarnSkippedSelf)
    if (skippedBooking) warnings.push(c.splitWarnSkippedInBooking)
    if (skippedDup) warnings.push(c.splitWarnSkippedDup)

    const amounts = splitRemainingEquallyCents(remaining, collected.length)
    const withAmounts = collected.map((row, i) => ({
      ...row,
      amount: amounts[i] != null ? String(amounts[i]) : '',
    }))
    setAddSplitRows(withAmounts)
    setAddSplitWizardWarnings(warnings)
    setAddSplitStep(2)
  }

  const addSplitGoToConfirmStep = (booking, currencyStr) => {
    const { remaining } = getSplitBudgetForBooking(booking)
    const cur = currencyStr || 'SAR'
    const parsed = addSplitRows.map((row) => ({
      ...row,
      amountNum: parseFloat(String(row.amount).replace(',', '.')) || 0,
    }))
    if (parsed.some((row) => row.amountNum <= 0)) {
      window.alert(c.splitAmountsInvalid)
      return
    }
    const sum = parsed.reduce((s, row) => s + row.amountNum, 0)
    if (sum > remaining + 0.02) {
      window.alert(`${c.splitOverBudget} (${remaining.toFixed(2)} ${cur}).`)
      return
    }
    setAddSplitStep(3)
  }

  const addSplitWizardBack = () => {
    if (addSplitStep === 2) setAddSplitStep(1)
    else if (addSplitStep === 3) setAddSplitStep(2)
  }

  const submitAddSplit = async (booking, club) => {
    if (!club?.id || !booking?.id || !member?.id) return
    const rows = addSplitRows.map((row) => ({
      type: 'unregistered',
      phone: (row.phone || '').trim(),
      amount: parseFloat(String(row.amount).replace(',', '.')) || 0,
    })).filter((row) => row.phone && row.amount > 0)
    if (rows.length === 0) {
      window.alert(c.splitAmountsInvalid)
      return
    }
    setAddSplitBusy(true)
    try {
      await bookingApi.addSplitParticipants({
        bookingId: booking.id,
        clubId: club.id,
        memberId: member.id,
        paymentShares: rows,
      })
      window.dispatchEvent(new CustomEvent('clubs-synced'))
      await refreshClubsFromApi()
      loadClubs()
      setBookings(getMemberBookings(member.id))
      closeAddSplitPanel()
    } catch (e) {
      window.alert(e?.message || (language === 'en' ? 'Failed' : 'فشل'))
    } finally {
      setAddSplitBusy(false)
    }
  }

  const refetchBookings = React.useCallback(async () => {
    await refreshClubsFromApi()
    loadClubs()
    const mid = member?.id
    if (mid) setBookings(getMemberBookings(mid))
  }, [member?.id])

  if (!member) {
    return (
      <div className="my-bookings-page">
        <div className="my-bookings-loading">
          <div className="my-bookings-loading-spinner" aria-hidden />
          <p>{c.loading}</p>
        </div>
      </div>
    )
  }

  const saveInlineSharePhone = async (booking, club, share, compositeKey) => {
    if (!shareRowEditPhone.trim()) return
    setShareRowBusyKey(compositeKey)
    try {
      await bookingApi.bookerUpdateSharePhone({
        bookingId: booking.id,
        clubId: club.id,
        memberId: member.id,
        shareId: share.id || undefined,
        inviteToken: share.inviteToken || undefined,
        phone: shareRowEditPhone
      })
      setShareRowEditKey(null)
      await refetchBookings()
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clubs-synced'))
    } catch (e) {
      if (typeof window !== 'undefined' && window.alert) window.alert(c.bookerShareError)
    } finally {
      setShareRowBusyKey(null)
    }
  }

  const removeInlineShare = async (booking, club, share, compositeKey) => {
    if (typeof window !== 'undefined' && !window.confirm(c.bookerShareConfirmRemove)) return
    setShareRowBusyKey(compositeKey)
    try {
      await bookingApi.bookerRemovePendingShare({
        bookingId: booking.id,
        clubId: club.id,
        memberId: member.id,
        shareId: share.id || undefined,
        inviteToken: share.inviteToken || undefined
      })
      setShareRowEditKey(null)
      await refetchBookings()
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clubs-synced'))
    } catch (e) {
      if (typeof window !== 'undefined' && window.alert) window.alert(c.bookerShareError)
    } finally {
      setShareRowBusyKey(null)
    }
  }

  const leaveMySplitShare = async (booking, club, share, compositeKey) => {
    if (typeof window !== 'undefined' && !window.confirm(c.participantLeaveConfirm)) return
    setShareRowBusyKey(compositeKey)
    try {
      await bookingApi.memberRemoveOwnShare({
        bookingId: booking.id,
        clubId: club.id,
        memberId: member.id,
        shareId: share.id || undefined,
        inviteToken: share.inviteToken || undefined,
        phone: member.phone || member.mobile
      })
      await refetchBookings()
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clubs-synced'))
    } catch (e) {
      if (typeof window !== 'undefined' && window.alert) {
        window.alert(language === 'en' ? (e?.message || c.bookerShareError) : (e?.message || c.bookerShareError))
      }
    } finally {
      setShareRowBusyKey(null)
    }
  }

  const getPayOptions = (booking, club) => {
    const memberIdStr = String(member?.id || '')
    const isInitiator = String(booking.memberId || booking.initiatorMemberId || '') === memberIdStr
    const userShare = findPaymentShareForMember(booking, member)
    if (userShare?.paidAt) return null
    const inviteToken = userShare?.inviteToken
    const chosePayAtClub = userShare && userShare.paymentMethod === 'at_club' && !userShare.paidAt
    if (userShare && club?.id) {
      return { type: 'share', inviteToken, clubId: club.id, chosePayAtClub, bookingId: booking.id }
    }
    const initiatorChosePayAtClub = isInitiator && (booking?.initiatorPaymentMethod === 'at_club' || booking?.data?.initiatorPaymentMethod === 'at_club')
    if (isInitiator && club?.id) {
      return { type: 'initiator', bookingId: booking.id, clubId: club.id, chosePayAtClub: initiatorChosePayAtClub }
    }
    return null
  }

  /** Deep link for online payment (split / booker / tournament). */
  const getElectronicPayHref = (po, booking) => {
    if (!po || !booking?.id) return '#'
    if (po.type === 'tournament') {
      const mid = po.memberId ?? member?.id
      return `/pay/tournament-member/${po.clubId}/${booking.id}?memberId=${encodeURIComponent(String(mid || ''))}`
    }
    if (po.type === 'share') {
      return po.inviteToken
        ? `/pay-share/${po.inviteToken}`
        : `/pay-share/booking/${booking.id}?clubId=${po.clubId}`
    }
    return `/pay/${booking.id}?method=credit_card`
  }

  const renderBookingRow = ({ booking, club }, i) => {
    let { dateStr, timeStr, courtName, priceVal, currencyStr, clubName, clubLink, isTraining, isTournament, isPaid, isPendingPayment, isAwaitingRefundAck, tournamentEntry, tournamentAwaitingClub, terminalCancelled } = getBookingDisplayProps({ booking, club, memberId: member?.id }, language)
    if (!booking.isTournament) {
      const isInitiator = String(booking.memberId || booking.initiatorMemberId || '') === String(member?.id || '')
      if (!isInitiator && member) {
        const share = findPaymentShareForMember(booking, member)
        if (share && share.amount != null && share.amount !== '') {
          priceVal = share.amount
        }
      }
    } else if (tournamentEntry?.fee) {
      const fv = parseFloat(String(tournamentEntry.fee).replace(',', '.'))
      if (Number.isFinite(fv) && fv > 0) priceVal = fv
    }
    const priceText = priceVal != null ? `${Number(priceVal)} ${currencyStr}` : '—'
    const isUpcoming = filter === 'upcoming'
    const payOptions = getPayOptions(booking, club)
    const visibleShares = (booking.paymentShares || []).filter((s) => {
      if (!s.removedAt && !s.removed_at) return true
      return member && shareNeedsRefundAcknowledgment(s, member)
    })
    const showAddSplit = canAddSplitParticipants(booking, club, member)
    const isBooker = String(booking.memberId || booking.initiatorMemberId || '') === String(member?.id || '')
    const mySplitShare = member ? findPaymentShareForMember(booking, member) : null

    return {
      key: `${club?.id}-${booking.id}-${i}`,
      dateStr,
      timeStr,
      courtName,
      clubName,
      clubLink,
      club,
      booking,
      priceText,
      currencyStr,
      getStatusLabel,
      getStatusClass,
      isUpcoming,
      formatDate,
      payOptions,
      isTraining,
      isTournament,
      isPaid,
      isPendingPayment,
      isAwaitingRefundAck,
      visibleShares,
      showAddSplit,
      isBooker,
      mySplitShare,
      tournamentEntry,
      tournamentAwaitingClub,
      terminalCancelled,
    }
  }

  const rows = displayed.map((item, i) => renderBookingRow(item, i))

  const getWalletPayMenuProps = (r) => {
    const L = getUnifiedPaymentCopy(language)
    const cid = r.payOptions?.clubId
    const shareAmt = parseFloat(r.mySplitShare?.amount) || 0
    const paid = !!(r.mySplitShare?.paidAt || r.mySplitShare?.paid_at)
    const walletReady = cid != null && Object.prototype.hasOwnProperty.call(walletByClub, cid)
    const bal = walletReady ? (Number(walletByClub[cid]) || 0) : 0
    const canWallet =
      !paid &&
      shareAmt > 0.009 &&
      (r.payOptions.type === 'share' || r.payOptions.type === 'initiator')
    if (!canWallet) {
      return { walletSubtitle: L.walletFullBookingOnly }
    }
    return {
      onPayWallet: () =>
        handlePayShareFromWallet(r.payOptions.clubId, r.payOptions.inviteToken, r.payOptions.bookingId, `w:${r.key}`),
      walletPayLoading: !walletReady,
      walletPayDisabled: walletReady && bal + 1e-9 < shareAmt,
      walletPayBusy: markingPayAtClub === `w:${r.key}`,
    }
  }

  const backClubFromBookings = (upcoming[0]?.club || past[0]?.club || cancelledList[0]?.club || bookings[0]?.club) || null
  const backClub = fromClubId ? getClubById(fromClubId) : backClubFromBookings
  const backLink = backClub ? `/clubs/${backClub.id}` : '/'
  const backText = backClub
    ? (language === 'ar' ? `العودة إلى ${backClub.nameAr || backClub.name}` : `Back to ${backClub.name || backClub.nameAr}`)
    : c.backToHome

  return (
    <div className="my-bookings-page" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <header className="my-bookings-header">
        <div className="my-bookings-header-inner">
          <Link to={backLink} className="my-bookings-back" aria-label={backText}>
            <span className="my-bookings-back-icon" aria-hidden>←</span>
            <span className="my-bookings-back-text">{backText}</span>
          </Link>
          <h1 className="my-bookings-header-title">{c.myBookings}</h1>
          <button
            type="button"
            className="my-bookings-lang"
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            title={language === 'en' ? 'العربية' : 'English'}
            aria-label={language === 'en' ? 'Switch to Arabic' : 'Switch to English'}
          >
            <LanguageIcon lang={language === 'en' ? 'ar' : 'en'} />
          </button>
        </div>
      </header>

      {paymentSuccess && (
        <div className="my-bookings-success-banner" role="alert">
          {c.paymentSuccess}
        </div>
      )}

      {clubIdsForWallet.length > 0 && (
        <section className="my-bookings-wallets" aria-label={c.walletTitle}>
          <div className="my-bookings-wallets-inner">
            <h2 className="my-bookings-wallets-title">{c.walletTitle}</h2>
            <p className="my-bookings-wallets-sub">{c.walletSubtitle}</p>
            <ul className="my-bookings-wallets-list">
              {clubIdsForWallet.map((cid) => {
                const cl = getClubById(cid)
                const label = cl
                  ? language === 'ar'
                    ? cl.nameAr || cl.name
                    : cl.name || cl.nameAr
                  : cid
                const raw = walletByClub[cid]
                const bal = typeof raw === 'number' ? raw : parseFloat(raw) || 0
                const cur = cl?.settings?.currency || 'SAR'
                const formatted = bal.toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
                const hasCredit = bal > 0.004
                return (
                  <li key={cid} className={`my-bookings-wallet-row ${hasCredit ? 'my-bookings-wallet-row--positive' : ''}`}>
                    <span className="my-bookings-wallet-club">
                      <span className="my-bookings-wallet-club-label">{c.walletAtClub}</span> {label}
                    </span>
                    <span className="my-bookings-wallet-balance">
                      {formatted} {cur}
                    </span>
                    {cl?.id ? (
                      <Link to={`/clubs/${cl.id}`} className="my-bookings-wallet-link">
                        {c.goToClub}
                      </Link>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </div>
        </section>
      )}

      {trainingInvites.length > 0 && (
        <section className="my-bookings-training-invites" aria-label={c.trainingInviteTitle}>
          <h2 className="my-bookings-training-invites-title">{c.trainingInviteTitle}</h2>
          <p className="my-bookings-training-invites-intro">{c.trainingInviteIntro}</p>
          <ul className="my-bookings-training-invites-list">
            {trainingInvites.map((inv) => {
              const cl = getClubById(inv.clubId)
              const clubLabel = cl ? (language === 'ar' ? (cl.nameAr || cl.name) : (cl.name || cl.nameAr)) : inv.clubId
              const courtLabel = cl?.courts?.find((co) => String(co.id) === String(inv.courtId) || co.name === inv.courtId)
              const courtName = courtLabel
                ? (language === 'ar' ? (courtLabel.nameAr || courtLabel.name) : courtLabel.name)
                : (inv.courtId || '—')
              const timeLine = [inv.startTime, inv.endTime].filter(Boolean).join(' – ')
              return (
                <li key={inv.id} className="my-bookings-training-invite-card">
                  <div className="my-bookings-training-invite-body">
                    <strong className="my-bookings-training-invite-club">{clubLabel}</strong>
                    <span className="my-bookings-training-invite-meta">
                      {formatDate(inv.date)} · {timeLine} · {courtName}
                    </span>
                  </div>
                  <div className="my-bookings-training-invite-actions">
                    <Link className="my-bookings-training-invite-link" to={`/clubs/${inv.clubId}`}>
                      {c.openClubToJoin}
                    </Link>
                    <button
                      type="button"
                      className="my-bookings-training-invite-dismiss"
                      disabled={dismissingInviteId === inv.id}
                      onClick={async () => {
                        setDismissingInviteId(inv.id)
                        try {
                          await bookingApi.dismissTrainingInvite(inv.id, member.id)
                          setTrainingInvites((prev) => prev.filter((x) => x.id !== inv.id))
                        } catch (e) {
                          window.alert(e?.message || '—')
                        } finally {
                          setDismissingInviteId(null)
                        }
                      }}
                    >
                      {c.trainingInviteDismiss}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <main className="my-bookings-main">
        <div className="my-bookings-tabs" role="tablist" aria-label={c.myBookings}>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'upcoming'}
            className={`my-bookings-tab ${filter === 'upcoming' ? 'active' : ''}`}
            onClick={() => setFilter('upcoming')}
          >
            <span className="my-bookings-tab-label">{c.upcoming}</span>
            <span className="my-bookings-tab-count">{upcoming.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'past'}
            className={`my-bookings-tab ${filter === 'past' ? 'active' : ''}`}
            onClick={() => setFilter('past')}
          >
            <span className="my-bookings-tab-label">{c.past}</span>
            <span className="my-bookings-tab-count">{past.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'cancelled'}
            className={`my-bookings-tab ${filter === 'cancelled' ? 'active' : ''}`}
            onClick={() => setFilter('cancelled')}
          >
            <span className="my-bookings-tab-label">{c.cancelled}</span>
            <span className="my-bookings-tab-count">{cancelledList.length}</span>
          </button>
        </div>

        {displayed.length === 0 ? (
          <section className="my-bookings-empty" aria-live="polite">
            <div className="my-bookings-empty-icon" aria-hidden />
            <p className="my-bookings-empty-title">
              {filter === 'upcoming' ? c.noUpcoming : filter === 'past' ? c.noPast : c.noCancelled}
            </p>
            <Link to={backLink} className="my-bookings-empty-cta">{c.bookCourt}</Link>
          </section>
        ) : (
          <>
            <div className="my-bookings-booking-list">
              {rows.map((r) => (
                <article
                  key={r.key}
                  id={r.booking?.id ? `my-booking-card-${r.booking.id}` : undefined}
                  className={`my-bookings-card my-bookings-card-clickable ${r.isTournament ? 'my-bookings-card--tournament' : r.isTraining ? 'my-bookings-card--training' : 'my-bookings-card--court'} ${r.terminalCancelled ? 'my-bookings-card--cancelled' : r.isPaid ? 'my-bookings-card--paid' : 'my-bookings-card--pending'}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setDetailRow(r)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailRow(r) } }}
                >
                  <div className="my-bookings-card-main">
                    <div className="my-bookings-card-badges">
                      <span className={`my-bookings-type-badge ${r.isTournament ? 'my-bookings-type-badge--tournament' : r.isTraining ? 'my-bookings-type-badge--training' : 'my-bookings-type-badge--court'}`}>
                        {r.isTournament ? c.typeTournament : r.isTraining ? c.typeTraining : c.typeCourt}
                      </span>
                      {!r.terminalCancelled ? (
                        <span className={`my-bookings-payment-badge ${r.isPaid ? 'my-bookings-payment-badge--paid' : 'my-bookings-payment-badge--pending'}`}>
                          {r.isPaid ? c.paidLabel : r.tournamentAwaitingClub ? c.tournamentAwaitingClub : c.awaitingPayment}
                        </span>
                      ) : null}
                      <span className={`my-bookings-status ${r.getStatusClass(r.booking.status)}`}>
                        {r.getStatusLabel(r.booking.status)}
                      </span>
                    </div>
                    <div className="my-bookings-card-summary">
                      <div className="my-bookings-card-field">
                        <span className="my-bookings-card-label">{c.date}</span>
                        <span className="my-bookings-card-value">{r.formatDate(r.dateStr)}</span>
                      </div>
                      <div className="my-bookings-card-field">
                        <span className="my-bookings-card-label">{c.time}</span>
                        <span className="my-bookings-card-value">{r.timeStr || '—'}</span>
                      </div>
                      <div className="my-bookings-card-field my-bookings-card-field--wide">
                        <span className="my-bookings-card-label">{c.court}</span>
                        <span className="my-bookings-card-value">
                          <span className="my-bookings-card-icon" aria-hidden>{r.isTraining ? '\u{1F468}\u200D\u{1F3EB}' : '🏸'}</span>
                          {r.courtName}
                        </span>
                      </div>
                      <div className="my-bookings-card-field">
                        <span className="my-bookings-card-label">{c.club}</span>
                        {r.clubLink ? (
                          <Link to={r.clubLink} className="my-bookings-card-club my-bookings-card-value" onClick={(e) => e.stopPropagation()}>
                            {r.clubName}
                          </Link>
                        ) : (
                          <span className="my-bookings-card-value">{r.clubName}</span>
                        )}
                      </div>
                      <div className="my-bookings-card-field">
                        <span className="my-bookings-card-label">{c.price}</span>
                        <span className="my-bookings-card-value my-bookings-card-value--price">{r.priceText}</span>
                      </div>
                    </div>
                  </div>
                  {Array.isArray(r.visibleShares) && r.visibleShares.length > 0 && (
                    <div className="my-bookings-participants" onClick={(e) => e.stopPropagation()}>
                      <div className="my-bookings-participants-head">
                        <h3 className="my-bookings-participants-title">{c.splitParticipants}</h3>
                        {r.isBooker ? <p className="my-bookings-participants-hint">{c.yourShareAmountsHint}</p> : null}
                      </div>
                      <ul className="my-bookings-participants-list">
                        {r.visibleShares.slice(0, 12).map((s, idx) => {
                          const name = (() => {
                            const lbl = resolvePaymentShareDisplayName(s, shareMemberDirectory)
                            if (lbl !== '—') return lbl
                            return s.type === 'unregistered' ? c.pending : '—'
                          })()
                          const rf = s.refundedAt || s.refunded_at
                          const pd = s.paidAt || s.paid_at
                          const shareAmt = parseFloat(s.amount)
                          const amtText = Number.isFinite(shareAmt) ? `${shareAmt} ${r.currencyStr}` : '—'
                          const compositeKey = `${r.key}|${s.inviteToken || idx}`
                          const canBookerManageShare =
                            r.isBooker &&
                            !!(s.inviteToken) &&
                            !pd &&
                            !rf &&
                            filter === 'upcoming' &&
                            !(s.removedAt || s.removed_at)
                          const payAbs =
                            (s.payInviteUrl || s.pay_invite_url || '') ||
                            (s.inviteToken ? buildPayShareAbsoluteUrl(s.inviteToken, s.type) : '')
                          const startT = r.booking?.startTime || r.booking?.timeSlot || '—'
                          const endT = r.booking?.endTime || ''
                          const clubPageAbs = r.club?.id ? buildClubPublicAbsoluteUrl(r.club.id) : ''
                          const waHrefList =
                            payAbs && !pd && !rf
                              ? buildWhatsAppHrefForSplitInvite(s.phone, payAbs, language, {
                                  participantType: s.type,
                                  clubName: r.clubName,
                                  bookingDate: r.dateStr,
                                  startTime: startT,
                                  endTime: endT,
                                  shareAmount: shareAmt,
                                  currency: r.currencyStr,
                                  clubPageUrl: clubPageAbs,
                                  externalWebsite: r.club?.website || '',
                                })
                              : (s.whatsappLink || '')
                          const showWa = waHrefList && !pd && !rf && filter === 'upcoming'
                          const isEditingList = shareRowEditKey === compositeKey
                          return (
                            <li key={s.id || s.inviteToken || idx} className="my-bookings-share-item">
                              {isEditingList ? (
                                <div className="my-bookings-share-edit" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="tel"
                                    className="my-bookings-share-edit-input"
                                    value={shareRowEditPhone}
                                    onChange={(e) => setShareRowEditPhone(e.target.value)}
                                    inputMode="tel"
                                    autoComplete="tel"
                                  />
                                  <div className="my-bookings-share-edit-btns">
                                    <button
                                      type="button"
                                      className="my-bookings-share-edit-save"
                                      disabled={shareRowBusyKey === compositeKey}
                                      onClick={(e) => { e.stopPropagation(); saveInlineSharePhone(r.booking, r.club, s, compositeKey) }}
                                    >
                                      {shareRowBusyKey === compositeKey ? '…' : c.bookerSavePhone}
                                    </button>
                                    <button
                                      type="button"
                                      className="my-bookings-share-edit-cancel"
                                      disabled={shareRowBusyKey === compositeKey}
                                      onClick={(e) => { e.stopPropagation(); setShareRowEditKey(null) }}
                                    >
                                      {c.cancel}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                              <div className="my-bookings-share-item-main">
                                <span className="my-bookings-share-item-name">{name}</span>
                                {r.isBooker ? (
                                  <span className="my-bookings-share-item-amount">{amtText}</span>
                                ) : null}
                              </div>
                              <div className="my-bookings-share-item-tail">
                                <span className={`my-bookings-share-item-status ${rf ? 'is-refunded' : pd ? 'is-paid' : 'is-pending'}`}>
                                  {rf ? (language === 'en' ? 'Refunded' : 'مسترد') : pd ? `✓ ${c.paid}` : c.pending}
                                </span>
                                {shareNeedsRefundAcknowledgment(s, member) && r.club?.id && filter === 'upcoming' && (
                                  <button
                                    type="button"
                                    className="my-bookings-ack-refund-btn"
                                    disabled={!!markingPayAtClub}
                                    onClick={(e) => { e.stopPropagation(); handleAckRefund(s, r.club.id) }}
                                  >
                                    {language === 'en' ? 'I received refund' : 'استلمت الاسترداد'}
                                  </button>
                                )}
                                {showWa ? (
                                  <a href={waHrefList} target="_blank" rel="noopener noreferrer" className="my-bookings-resend" title={c.resendInvite} onClick={(e) => e.stopPropagation()}>💬</a>
                                ) : null}
                                {canBookerManageShare ? (
                                  <>
                                    <button
                                      type="button"
                                      className="my-bookings-share-action-icon"
                                      title={c.bookerEditPhone}
                                      aria-label={c.bookerEditPhone}
                                      disabled={!!shareRowBusyKey}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setShareRowEditKey(compositeKey)
                                        setShareRowEditPhone(normalizePhone(s.phone || ''))
                                      }}
                                    >
                                      ✎
                                    </button>
                                    <button
                                      type="button"
                                      className="my-bookings-share-action-icon my-bookings-share-action-icon--danger"
                                      title={c.bookerRemoveShare}
                                      aria-label={c.bookerRemoveShare}
                                      disabled={!!shareRowBusyKey}
                                      onClick={(e) => { e.stopPropagation(); removeInlineShare(r.booking, r.club, s, compositeKey) }}
                                    >
                                      🗑
                                    </button>
                                  </>
                                ) : null}
                                {(() => {
                                  /** حصة الحاجز تُطابق memberId/id وقد لا يكون لها inviteToken */
                                  const isMyParticipation =
                                    !!(r.mySplitShare && isSamePaymentShare(s, r.mySplitShare))
                                  const memberReqAt = s.memberRefundRequestedAt || s.member_refund_requested_at
                                  const removed = !!(s.removedAt || s.removed_at)
                                  const bookingSt = (r.booking?.status || '').toString().toLowerCase()
                                  const splitRefundOkCancelled =
                                    filter === 'cancelled' && bookingSt === 'expired'
                                  const showParticipantLeave =
                                    isMyParticipation &&
                                    filter === 'upcoming' &&
                                    !pd &&
                                    !rf &&
                                    !memberReqAt &&
                                    !removed
                                  const showParticipantShareModify =
                                    isMyParticipation &&
                                    (filter === 'upcoming' || splitRefundOkCancelled) &&
                                    !!pd &&
                                    !rf &&
                                    !memberReqAt &&
                                    !removed
                                  const showParticipantRefundPending =
                                    isMyParticipation &&
                                    !!memberReqAt &&
                                    !rf &&
                                    !removed &&
                                    (filter === 'upcoming' || splitRefundOkCancelled)
                                  if (!showParticipantLeave && !showParticipantShareModify && !showParticipantRefundPending) {
                                    return null
                                  }
                                  return (
                                    <div className="my-bookings-participant-refund-wrap" onClick={(e) => e.stopPropagation()}>
                                      {showParticipantRefundPending ? (
                                        <span className="my-bookings-share-refund-pending">{c.participantRefundAwaiting}</span>
                                      ) : null}
                                      {showParticipantLeave ? (
                                        <button
                                          type="button"
                                          className="my-bookings-participant-leave-btn"
                                          disabled={!!shareRowBusyKey}
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            leaveMySplitShare(r.booking, r.club, s, compositeKey)
                                          }}
                                        >
                                          {shareRowBusyKey === compositeKey ? '…' : c.participantLeaveShare}
                                        </button>
                                      ) : null}
                                      {showParticipantShareModify ? (
                                        <button
                                          type="button"
                                          className="my-bookings-participant-modify-btn"
                                          title={c.splitParticipantModifyHint}
                                          disabled={!!shareRowBusyKey}
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setDetailRow(r)
                                            setBootOpenSplitParticipantActions(true)
                                          }}
                                        >
                                          <span className="my-bookings-participant-modify-btn-icon" aria-hidden>✏️</span>
                                          {c.edit}
                                        </button>
                                      ) : null}
                                    </div>
                                  )
                                })()}
                              </div>
                                </>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                      {r.visibleShares.length > 12 && (
                        <p className="my-bookings-participants-more">
                          +{r.visibleShares.length - 12} {language === 'en' ? 'more' : 'المزيد'}
                        </p>
                      )}
                    </div>
                  )}
                  {['pending_payment'].includes((r.booking.status || '').toString()) && filter === 'upcoming' && r.club && (
                    <div className="my-bookings-card-pay-wrap" onClick={(e) => e.stopPropagation()}>
                      <Link to={`/pay/${r.booking.id}?method=${r.booking.paymentMethod || 'credit_card'}`} className="my-bookings-pay-now-link">
                        {c.payNow}
                      </Link>
                    </div>
                  )}
                  {filter === 'upcoming' && r.club && r.payOptions &&
                    (['pending_payments', 'partially_paid'].includes((r.booking.status || '').toString()) ||
                      r.payOptions.type === 'tournament') && (
                    <div className="my-bookings-card-pay-wrap" onClick={(e) => e.stopPropagation()}>
                      {r.payOptions.chosePayAtClub ? (
                        <section
                          className="my-bookings-pay-state my-bookings-pay-state--at-club"
                          aria-label={language === 'ar' ? 'حالة الدفع' : 'Payment status'}
                        >
                          <div className="my-bookings-pay-state-top">
                            <p className="my-bookings-pay-state-kicker">{c.payStateKicker}</p>
                            <div className="my-bookings-pay-state-row">
                              <div className="my-bookings-pay-state-icon-wrap" aria-hidden>🏢</div>
                              <div className="my-bookings-pay-state-copy">
                                <h3 className="my-bookings-pay-state-title">{c.payAtClubStateTitle}</h3>
                                <p className="my-bookings-pay-state-desc">{c.payAtClubStateDesc}</p>
                              </div>
                              <span className="my-bookings-pay-state-badge">
                                <span className="my-bookings-pay-state-badge-icon" aria-hidden>✓</span>
                                {c.payAtClubStateBadge}
                              </span>
                            </div>
                          </div>
                          <div className="my-bookings-pay-state-footer">
                            <Link
                              to={getElectronicPayHref(r.payOptions, r.booking)}
                              className="my-bookings-pay-state-switch"
                              onClick={() => setPayMenuOpen(null)}
                            >
                              <span className="my-bookings-pay-state-switch-icon" aria-hidden>💳</span>
                              {c.switchToElectronicPayment}
                            </Link>
                          </div>
                        </section>
                      ) : (
                        <>
                          <button
                            type="button"
                            className={`my-bookings-pay-btn ${payMenuOpen === r.key ? 'my-bookings-pay-btn-open' : ''}`}
                            onClick={() => setPayMenuOpen(payMenuOpen === r.key ? null : r.key)}
                            disabled={!!markingPayAtClub}
                          >
                            <span className="my-bookings-pay-btn-icon">💳</span>
                            {c.pay}
                            <span className="my-bookings-pay-btn-chevron" aria-hidden>▼</span>
                          </button>
                          {payMenuOpen === r.key && (
                            <div className="my-bookings-card-pay-menu">
                              {r.payOptions.type === 'tournament' ? (
                                <UnifiedPaymentMenu
                                  language={language}
                                  variant="tournament"
                                  chosePayAtClub={r.payOptions.chosePayAtClub}
                                  onPayAtClub={() => {
                                    handleTournamentPayAtClubChoice(r.payOptions.clubId, r.payOptions.bookingId, r.payOptions.memberId)
                                    setPayMenuOpen(null)
                                  }}
                                  payAtClubDisabled={!!markingPayAtClub}
                                  electronicHref={getElectronicPayHref(r.payOptions, r.booking)}
                                  onElectronicNavigate={() => setPayMenuOpen(null)}
                                />
                              ) : r.payOptions.type === 'share' ? (
                                <UnifiedPaymentMenu
                                  language={language}
                                  variant="share"
                                  chosePayAtClub={r.payOptions.chosePayAtClub}
                                  onPayAtClub={() => {
                                    handleRecordPayment(r.payOptions.clubId, r.payOptions.inviteToken, r.payOptions.bookingId)
                                    setPayMenuOpen(null)
                                  }}
                                  payAtClubDisabled={!!markingPayAtClub}
                                  electronicHref={getElectronicPayHref(r.payOptions, r.booking)}
                                  onElectronicNavigate={() => setPayMenuOpen(null)}
                                  {...getWalletPayMenuProps(r)}
                                />
                              ) : (
                                <UnifiedPaymentMenu
                                  language={language}
                                  variant="share"
                                  chosePayAtClub={r.payOptions.chosePayAtClub}
                                  onPayAtClub={() => {
                                    handleMarkPayAtClub(r.payOptions.clubId, r.payOptions.bookingId)
                                    setPayMenuOpen(null)
                                  }}
                                  payAtClubDisabled={markingPayAtClub === r.booking.id}
                                  electronicHref={getElectronicPayHref(r.payOptions, r.booking)}
                                  electronicSubtitle={language === 'ar' ? 'بطاقة أو مدى — من صفحة الدفع' : 'Card or Mada — on payment page'}
                                  onElectronicNavigate={() => setPayMenuOpen(null)}
                                  {...getWalletPayMenuProps(r)}
                                />
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  {r.showAddSplit && filter === 'upcoming' && r.club && (
                    <div className="my-bookings-add-split my-bookings-add-split--card" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="my-bookings-add-split-toggle"
                        onClick={() => {
                          if (addSplitForBookingId === r.booking.id) closeAddSplitPanel()
                          else openAddSplitPanel(r.booking.id)
                        }}
                      >
                        {language === 'en' ? '+ Add participants (share payment)' : '+ إضافة مشاركين (تقسيم)'}
                      </button>
                      {addSplitForBookingId === r.booking.id && (() => {
                        const splitBudget = getSplitBudgetForBooking(r.booking)
                        const newAssignedSum = addSplitRows.reduce(
                          (s, row) => s + (parseFloat(String(row.amount).replace(',', '.')) || 0),
                          0
                        )
                        const splitLeft = splitBudget.remaining - newAssignedSum
                        const stepMeta = [
                          { n: 1, label: c.splitWizardStep1 },
                          { n: 2, label: c.splitWizardStep2 },
                          { n: 3, label: c.splitWizardStep3 },
                        ]
                        return (
                          <div className="my-bookings-add-split-form my-bookings-add-split-wizard">
                            <ol className="my-bookings-split-wizard-steps" aria-label={c.splitWizardAriaSteps}>
                              {stepMeta.map(({ n, label }) => (
                                <li
                                  key={n}
                                  className={`my-bookings-split-wizard-step ${addSplitStep === n ? 'is-current' : ''} ${addSplitStep > n ? 'is-done' : ''}`}
                                >
                                  <span className="my-bookings-split-wizard-step-badge" aria-hidden>
                                    {addSplitStep > n ? '✓' : n}
                                  </span>
                                  <span className="my-bookings-split-wizard-step-text">{label}</span>
                                </li>
                              ))}
                            </ol>

                            {addSplitStep === 1 && (
                              <>
                                <p className="my-bookings-add-split-bulk-hint">{c.splitWizardHintStep1}</p>
                                <div className="my-bookings-add-split-favorites">
                                  <p className="my-bookings-add-split-favorites-title">★ {c.splitFavorites}</p>
                                  <p className="my-bookings-add-split-fav-hint">{c.splitFavHint}</p>
                                  {addSplitFavoritesLoading ? (
                                    <div className="my-bookings-add-split-fav-loading">{c.loading}</div>
                                  ) : addSplitFavorites.length === 0 ? (
                                    <p className="my-bookings-add-split-fav-empty">{c.splitFavoritesEmpty}</p>
                                  ) : (
                                    <div className="my-bookings-add-split-fav-chips" role="list">
                                      {addSplitFavorites.map((f) => (
                                        <button
                                          key={f.id}
                                          type="button"
                                          className={`my-bookings-add-split-fav-chip ${f.phone ? '' : 'my-bookings-add-split-fav-chip--muted'}`}
                                          disabled={!f.phone}
                                          onClick={() => applyFavoriteToSplitPeople(f)}
                                        >
                                          <span className="my-bookings-add-split-fav-chip-name">{f.name}</span>
                                          {f.phone ? (
                                            <span className="my-bookings-add-split-fav-chip-phone">{f.phone}</span>
                                          ) : (
                                            <span className="my-bookings-add-split-fav-chip-na">{c.splitFavoritesNoPhone}</span>
                                          )}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                {isContactsPickSupported() ? (
                                  <button
                                    type="button"
                                    className="my-bookings-add-split-contacts-btn"
                                    onClick={pickPhonesForSplit}
                                    disabled={addSplitContactBusy || addSplitBusy}
                                  >
                                    {addSplitContactBusy ? '…' : `📇 ${c.splitPickContacts}`}
                                  </button>
                                ) : null}
                                <p className="my-bookings-split-participant-heading">{c.splitParticipantHeading}</p>
                                {addSplitPeople.map((row, ri) => (
                                  <div key={ri} className="my-bookings-add-split-person-row">
                                    <div className="my-bookings-add-split-person-fields">
                                      <input
                                        type="tel"
                                        className="my-bookings-add-split-person-phone"
                                        placeholder={c.splitPhoneLabel}
                                        value={row.phone}
                                        autoComplete="tel"
                                        inputMode="tel"
                                        onChange={(e) =>
                                          setAddSplitPeople((prev) =>
                                            prev.map((x, j) =>
                                              j === ri ? { ...x, phone: e.target.value } : x
                                            )
                                          )}
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      className="my-bookings-add-split-person-remove"
                                      onClick={() =>
                                        setAddSplitPeople((prev) =>
                                          prev.length <= 1
                                            ? [{ phone: '' }]
                                            : prev.filter((_, j) => j !== ri)
                                        )
                                      }
                                      aria-label={c.splitRemoveRow}
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  className="my-bookings-add-split-more"
                                  onClick={() => setAddSplitPeople((prev) => [...prev, { phone: '' }])}
                                >
                                  {language === 'en' ? '+ Add another' : '+ إضافة مشارك'}
                                </button>
                                <div className="my-bookings-split-wizard-nav my-bookings-split-wizard-nav--end">
                                  <button
                                    type="button"
                                    className="my-bookings-split-wizard-btn my-bookings-split-wizard-btn-primary"
                                    disabled={addSplitBusy}
                                    onClick={() => addSplitGoToAmountsStep(r.booking)}
                                  >
                                    {c.splitWizardNext}
                                  </button>
                                </div>
                              </>
                            )}

                            {addSplitStep === 2 && (
                              <>
                                {addSplitWizardWarnings.length > 0 ? (
                                  <ul className="my-bookings-split-wizard-warnings">
                                    {addSplitWizardWarnings.map((w, wi) => (
                                      <li key={wi}>{w}</li>
                                    ))}
                                  </ul>
                                ) : null}
                                <div className="my-bookings-split-budget-card">
                                  <div className="my-bookings-split-budget-row">
                                    <span>{c.splitBudgetTotal}</span>
                                    <strong>
                                      {splitBudget.total.toFixed(2)} {r.currencyStr}
                                    </strong>
                                  </div>
                                  <div className="my-bookings-split-budget-row">
                                    <span>{c.splitBudgetAllocated}</span>
                                    <strong>
                                      {splitBudget.activeSum.toFixed(2)} {r.currencyStr}
                                    </strong>
                                  </div>
                                  <div className="my-bookings-split-budget-row my-bookings-split-budget-row--highlight">
                                    <span>{c.splitBudgetRemaining}</span>
                                    <strong>
                                      {splitBudget.remaining.toFixed(2)} {r.currencyStr}
                                    </strong>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className="my-bookings-split-equal-btn"
                                  onClick={() => addSplitApplyEqualAmounts(r.booking)}
                                  disabled={addSplitBusy || addSplitRows.length === 0}
                                >
                                  {c.splitSplitEqually}
                                </button>
                                {addSplitRows.map((row, ri) => (
                                  <div key={`${row.phone}-${ri}`} className="my-bookings-add-split-amount-row">
                                    <div className="my-bookings-add-split-amount-label">
                                      <span className="my-bookings-add-split-amount-name">
                                        {row.name || row.phone || c.splitPhoneLabel}
                                      </span>
                                      {row.name ? (
                                        <span className="my-bookings-add-split-amount-phone" dir="ltr">
                                          {row.phone}
                                        </span>
                                      ) : null}
                                    </div>
                                    <div className="my-bookings-add-split-amount-input-wrap">
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="my-bookings-add-split-amount-input"
                                        value={row.amount}
                                        inputMode="decimal"
                                        onChange={(e) =>
                                          setAddSplitRows((prev) =>
                                            prev.map((x, j) => (j === ri ? { ...x, amount: e.target.value } : x))
                                          )}
                                      />
                                      <span className="my-bookings-add-split-amount-cur">{r.currencyStr}</span>
                                    </div>
                                  </div>
                                ))}
                                <div
                                  className={`my-bookings-split-sum-row ${splitLeft < -0.02 ? 'is-over' : splitLeft <= 0.02 ? 'is-ok' : ''}`}
                                >
                                  <span>{c.splitAssignedSum}</span>
                                  <strong>
                                    {newAssignedSum.toFixed(2)} {r.currencyStr}
                                  </strong>
                                </div>
                                <div
                                  className={`my-bookings-split-sum-row my-bookings-split-sum-row--muted ${splitLeft < -0.02 ? 'is-over' : ''}`}
                                >
                                  <span>{c.splitLeftToAssign}</span>
                                  <strong>
                                    {splitLeft.toFixed(2)} {r.currencyStr}
                                  </strong>
                                </div>
                                <div className="my-bookings-split-wizard-nav">
                                  <button
                                    type="button"
                                    className="my-bookings-split-wizard-btn my-bookings-split-wizard-btn-secondary"
                                    disabled={addSplitBusy}
                                    onClick={addSplitWizardBack}
                                  >
                                    {c.splitWizardBack}
                                  </button>
                                  <button
                                    type="button"
                                    className="my-bookings-split-wizard-btn my-bookings-split-wizard-btn-primary"
                                    disabled={addSplitBusy || splitLeft < -0.02}
                                    onClick={() => addSplitGoToConfirmStep(r.booking, r.currencyStr)}
                                  >
                                    {c.splitWizardNext}
                                  </button>
                                </div>
                              </>
                            )}

                            {addSplitStep === 3 && (
                              <>
                                <p className="my-bookings-add-split-bulk-hint">{c.splitWizardReviewIntro}</p>
                                <ul className="my-bookings-split-confirm-list">
                                  {addSplitRows.map((row, ri) => {
                                    const amt = parseFloat(String(row.amount).replace(',', '.')) || 0
                                    return (
                                      <li key={`${row.phone}-${ri}`} className="my-bookings-split-confirm-item">
                                        <div className="my-bookings-split-confirm-who">
                                          <span className="my-bookings-split-confirm-name">
                                            {row.name || row.phone}
                                          </span>
                                          {row.name ? (
                                            <span className="my-bookings-split-confirm-phone" dir="ltr">
                                              {row.phone}
                                            </span>
                                          ) : null}
                                        </div>
                                        <div className="my-bookings-split-confirm-amt">
                                          {amt.toFixed(2)} {r.currencyStr}
                                        </div>
                                      </li>
                                    )
                                  })}
                                </ul>
                                <div className="my-bookings-split-wizard-nav">
                                  <button
                                    type="button"
                                    className="my-bookings-split-wizard-btn my-bookings-split-wizard-btn-secondary"
                                    disabled={addSplitBusy}
                                    onClick={addSplitWizardBack}
                                  >
                                    {c.splitWizardBack}
                                  </button>
                                  <button
                                    type="button"
                                    className="my-bookings-split-wizard-btn my-bookings-split-wizard-btn-primary my-bookings-split-wizard-btn-submit"
                                    disabled={addSplitBusy}
                                    onClick={() => submitAddSplit(r.booking, r.club)}
                                  >
                                    {addSplitBusy ? '…' : c.splitWizardSendInvites}
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  )}
                  {r.club && (
                    <div className="my-bookings-card-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="my-bookings-edit-btn"
                        onClick={() => setDetailRow(r)}
                      >
                        <span className="my-bookings-edit-btn-icon" aria-hidden>✏️</span>
                        {c.edit}
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </>
        )}
        {detailRow && (
          <BookingDetailModal
            booking={detailRow.booking}
            club={detailRow.club}
            platformUser={member}
            memberDirectory={shareMemberDirectory}
            language={language}
            showBrowseClubLink={false}
            bootOpenSplitParticipantActions={bootOpenSplitParticipantActions}
            onBootOpenSplitParticipantActionsDone={() => setBootOpenSplitParticipantActions(false)}
            onClose={() => {
              setBootOpenSplitParticipantActions(false)
              setDetailRow(null)
            }}
            onUpdated={async () => {
              await refreshClubsFromApi()
              loadClubs()
              const updated = getMemberBookings(member.id)
              setBookings(updated)
              const bid = detailRow?.booking?.id
              if (bid) {
                const row = updated.find(r => String(r.booking?.id) === String(bid))
                if (row) setDetailRow(row)
              }
            }}
          />
        )}
      </main>
    </div>
  )
}

export default MyBookingsPage
