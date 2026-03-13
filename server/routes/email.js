/**
 * Email API - test send, verification code, welcome
 */
import { Router } from 'express'
import { sendEmail, generateVerificationCode } from '../services/emailSend.js'
import { getSetting, setSetting } from '../db/dataHelpers.js'
import { isEmailChannelEnabled } from '../services/messageSend.js'
import { getClubsFromNormalized, saveClubsToNormalized } from '../db/normalizedData.js'
import { hasNormalizedTables } from '../db/normalizedData.js'

const router = Router()
const VERIFICATION_CODES_KEY = 'email_verification_codes'
const CODE_EXPIRY_MS = 10 * 60 * 1000 // 10 minutes

/** POST /api/email/send - test email (admin) */
router.post('/send', async (req, res) => {
  try {
    const { to, subject, body } = req.body || {}
    const toStr = (to || '').trim().toLowerCase()
    if (!toStr || !toStr.includes('@')) {
      return res.status(400).json({ error: 'Valid recipient email required' })
    }
    const subj = (subject || '').trim() || 'PlayTix Email Test'
    const html = (body || '').trim() || '<p>This is a test email from PlayTix.</p><p dir="rtl">هذه رسالة تجريبية من PlayTix.</p>'
    const result = await sendEmail(toStr, subj, html)
    if (!result.ok) {
      return res.status(400).json({ error: result.error || 'Send failed' })
    }
    return res.json({ ok: true, id: result.id })
  } catch (e) {
    console.error('[email send]', e)
    return res.status(500).json({ error: e?.message || 'Server error' })
  }
})

/** POST /api/email/send-verification-code - send 4-digit code for member/club registration */
router.post('/send-verification-code', async (req, res) => {
  try {
    const { email, purpose } = req.body || {}
    const em = (email || '').trim().toLowerCase()
    if (!em || !em.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' })
    }
    const code = generateVerificationCode()
    let codes = (await getSetting(VERIFICATION_CODES_KEY)) || {}
    if (typeof codes !== 'object') codes = {}
    codes[em] = { code, expiresAt: Date.now() + CODE_EXPIRY_MS, purpose: purpose || 'registration' }
    await setSetting(VERIFICATION_CODES_KEY, codes)

    const subj = 'PlayTix — كود التحقق / Verification Code'
    const html = `
      <div dir="ltr" style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2>Verification Code</h2>
        <p>Your verification code is: <strong style="font-size:1.5em;letter-spacing:4px;">${code}</strong></p>
        <p style="color:#666;font-size:12px;">This code expires in 10 minutes.</p>
        <hr style="margin:24px 0;" />
        <h2 dir="rtl">كود التحقق</h2>
        <p dir="rtl">كود التحقق الخاص بك: <strong style="font-size:1.5em;letter-spacing:4px;">${code}</strong></p>
        <p dir="rtl" style="color:#666;font-size:12px;">ينتهي خلال 10 دقائق.</p>
      </div>
    `
    const result = await sendEmail(em, subj, html)
    if (!result.ok) {
      return res.status(400).json({ error: result.error || 'Failed to send verification email' })
    }
    return res.json({ ok: true })
  } catch (e) {
    console.error('[email send-verification-code]', e)
    return res.status(500).json({ error: e?.message || 'Server error' })
  }
})

/** POST /api/email/verify-code - verify 4-digit code */
router.post('/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body || {}
    const em = (email || '').trim().toLowerCase()
    const codeStr = (code || '').replace(/\D/g, '')
    if (!em || !em.includes('@') || codeStr.length !== 4) {
      return res.status(400).json({ error: 'Valid email and 4-digit code required' })
    }
    let codes = (await getSetting(VERIFICATION_CODES_KEY)) || {}
    if (typeof codes !== 'object') codes = {}
    const entry = codes[em]
    if (!entry || entry.expiresAt < Date.now()) {
      return res.status(400).json({ error: 'Code expired or invalid' })
    }
    if (entry.code !== codeStr) {
      return res.status(400).json({ error: 'Invalid code' })
    }
    delete codes[em]
    await setSetting(VERIFICATION_CODES_KEY, codes)
    return res.json({ ok: true })
  } catch (e) {
    console.error('[email verify-code]', e)
    return res.status(500).json({ error: e?.message || 'Server error' })
  }
})

/** POST /api/email/send-welcome-member - welcome email to new member after registration */
router.post('/send-welcome-member', async (req, res) => {
  try {
    if (!(await isEmailChannelEnabled())) {
      return res.json({ ok: true })
    }
    const { email, name } = req.body || {}
    const em = (email || '').trim().toLowerCase()
    if (!em || !em.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' })
    }
    const displayName = (name || '').trim() || 'Member'
    const subj = 'PlayTix — Welcome! مرحباً بك!'
    const html = `
      <div dir="ltr" style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2>Welcome to PlayTix!</h2>
        <p>Hi ${displayName},</p>
        <p>Your account has been created successfully. You can now browse clubs, book courts, and participate in tournaments.</p>
        <hr style="margin:24px 0;" />
        <h2 dir="rtl">مرحباً بك في PlayTix!</h2>
        <p dir="rtl">مرحباً ${displayName}،</p>
        <p dir="rtl">تم إنشاء حسابك بنجاح. يمكنك الآن تصفح النوادي وحجز الملاعب والمشاركة في البطولات.</p>
      </div>
    `
    const result = await sendEmail(em, subj, html)
    if (!result.ok) {
      return res.status(400).json({ error: result.error || 'Failed to send welcome email' })
    }
    return res.json({ ok: true })
  } catch (e) {
    console.error('[email send-welcome-member]', e)
    return res.status(500).json({ error: e?.message || 'Server error' })
  }
})

/** POST /api/email/send-welcome-club-join - welcome email when member joins a club */
router.post('/send-welcome-club-join', async (req, res) => {
  try {
    if (!(await isEmailChannelEnabled())) {
      return res.json({ ok: true })
    }
    const { email, memberName, clubName } = req.body || {}
    const em = (email || '').trim().toLowerCase()
    if (!em || !em.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' })
    }
    const mName = (memberName || '').trim() || 'Member'
    const cName = (clubName || '').trim() || 'Club'
    const subj = `PlayTix — Welcome to ${cName}! مرحباً بك في ${cName}!`
    const html = `
      <div dir="ltr" style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2>Welcome to ${cName}!</h2>
        <p>Hi ${mName},</p>
        <p>You have successfully joined <strong>${cName}</strong>. You can now book courts and participate in club activities.</p>
        <hr style="margin:24px 0;" />
        <h2 dir="rtl">مرحباً بك في ${cName}!</h2>
        <p dir="rtl">مرحباً ${mName}،</p>
        <p dir="rtl">انضممت بنجاح إلى <strong>${cName}</strong>. يمكنك الآن حجز الملاعب والمشاركة في أنشطة النادي.</p>
      </div>
    `
    const result = await sendEmail(em, subj, html)
    if (!result.ok) {
      return res.status(400).json({ error: result.error || 'Failed to send welcome email' })
    }
    return res.json({ ok: true })
  } catch (e) {
    console.error('[email send-welcome-club-join]', e)
    return res.status(500).json({ error: e?.message || 'Server error' })
  }
})

/** POST /api/email/send-club-verification - send verification code to club admin email */
router.post('/send-club-verification', async (req, res) => {
  try {
    const { email } = req.body || {}
    const em = (email || '').trim().toLowerCase()
    if (!em || !em.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' })
    }
    const code = generateVerificationCode()
    let codes = (await getSetting(VERIFICATION_CODES_KEY)) || {}
    if (typeof codes !== 'object') codes = {}
    codes[em] = { code, expiresAt: Date.now() + CODE_EXPIRY_MS, purpose: 'club_verification' }
    await setSetting(VERIFICATION_CODES_KEY, codes)

    const subj = 'PlayTix — تفعيل بريد النادي / Club Email Verification'
    const html = `
      <div dir="ltr" style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2>Club Email Verification</h2>
        <p>Your verification code is: <strong style="font-size:1.5em;letter-spacing:4px;">${code}</strong></p>
        <p style="color:#666;font-size:12px;">Enter this code in your club dashboard to verify your email.</p>
        <hr style="margin:24px 0;" />
        <h2 dir="rtl">تفعيل بريد النادي</h2>
        <p dir="rtl">كود التحقق: <strong style="font-size:1.5em;letter-spacing:4px;">${code}</strong></p>
        <p dir="rtl" style="color:#666;font-size:12px;">أدخل هذا الكود في لوحة تحكم النادي لتفعيل بريدك.</p>
      </div>
    `
    const result = await sendEmail(em, subj, html)
    if (!result.ok) {
      return res.status(400).json({ error: result.error || 'Failed to send verification email' })
    }
    return res.json({ ok: true })
  } catch (e) {
    console.error('[email send-club-verification]', e)
    return res.status(500).json({ error: e?.message || 'Server error' })
  }
})

/** POST /api/email/verify-club-email - verify club admin email and set emailVerified */
router.post('/verify-club-email', async (req, res) => {
  try {
    const { email, code, clubId } = req.body || {}
    const em = (email || '').trim().toLowerCase()
    const codeStr = (code || '').replace(/\D/g, '')
    const cid = (clubId || '').toString().trim()
    if (!em || !em.includes('@') || codeStr.length !== 4 || !cid) {
      return res.status(400).json({ error: 'Valid email, 4-digit code, and clubId required' })
    }
    let codes = (await getSetting(VERIFICATION_CODES_KEY)) || {}
    if (typeof codes !== 'object') codes = {}
    const entry = codes[em]
    if (!entry || entry.expiresAt < Date.now() || entry.purpose !== 'club_verification') {
      return res.status(400).json({ error: 'Code expired or invalid' })
    }
    if (entry.code !== codeStr) {
      return res.status(400).json({ error: 'Invalid code' })
    }
    delete codes[em]
    await setSetting(VERIFICATION_CODES_KEY, codes)

    const normalized = await hasNormalizedTables()
    if (!normalized) {
      return res.status(400).json({ error: 'Requires normalized tables' })
    }
    const clubs = await getClubsFromNormalized()
    const club = clubs.find(c => (c.id || '').toString() === cid)
    if (!club) {
      return res.status(404).json({ error: 'Club not found' })
    }
    const adminEm = (club.adminEmail || club.email || '').toLowerCase()
    if (adminEm !== em) {
      return res.status(400).json({ error: 'Email does not match club admin' })
    }
    club.emailVerified = true
    club.updatedAt = new Date().toISOString()
    const td = typeof club.tournamentData === 'object' && club.tournamentData ? club.tournamentData : {}
    club.tournamentData = { ...td, emailVerified: true }
    const updated = clubs.map(c => (c.id || '').toString() === cid ? club : c)
    await saveClubsToNormalized(updated, { actorType: 'system', actorId: null })
    return res.json({ ok: true })
  } catch (e) {
    console.error('[email verify-club-email]', e)
    return res.status(500).json({ error: e?.message || 'Server error' })
  }
})

export default router
