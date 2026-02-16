/**
 * Normalized data layer - قراءة وكتابة الجداول المنظمة
 * يحوّل إلى/من الصيغة التي يتوقعها التطبيق (توافق مع الفرونت إند)
 */
import { query } from './pool.js'
import { logAudit } from './audit.js'
import * as membershipService from '../services/membershipService.js'

const SOFT_DELETE_WHERE = 'deleted_at IS NULL'

/** Check if a column exists in a table (for migrations) */
async function columnExists(table, column) {
  try {
    const { rows } = await query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column]
    )
    return rows.length > 0
  } catch {
    return false
  }
}

// ---------- Booking settings: حقل واحد في الواجهة = عمود واحد في club_settings (padel_db) ----------
const BOOKING_SETTINGS_COLS = [
  { db: 'lock_minutes', js: 'lockMinutes', default: 10 },
  { db: 'payment_deadline_minutes', js: 'paymentDeadlineMinutes', default: 10 },
  { db: 'split_manage_minutes', js: 'splitManageMinutes', default: 15 },
  { db: 'split_payment_deadline_minutes', js: 'splitPaymentDeadlineMinutes', default: 30 },
  { db: 'refund_days', js: 'refundDays', default: 3 }
]
const ALLOW_INCOMPLETE_DB = 'allow_incomplete_bookings'
const ALLOW_INCOMPLETE_JS = 'allowIncompleteBookings'

function bookingNumFromDb(val, defaultVal) {
  const n = Number(val)
  return (val != null && val !== '' && !Number.isNaN(n)) ? n : defaultVal
}

function bookingNumToDb(val, defaultVal) {
  if (val === null || val === undefined || val === '') return defaultVal
  const n = Number(val)
  return Number.isNaN(n) ? defaultVal : n
}

/** Ensure club_settings has booking-related columns so all settings persist in padel_db */
async function ensureClubSettingsBookingColumns() {
  const cols = [
    { name: 'lock_minutes', type: 'INT', def: '10' },
    { name: 'payment_deadline_minutes', type: 'INT', def: '10' },
    { name: 'split_manage_minutes', type: 'INT', def: '15' },
    { name: 'split_payment_deadline_minutes', type: 'INT', def: '30' },
    { name: 'refund_days', type: 'INT', def: '3' },
    { name: 'allow_incomplete_bookings', type: 'TINYINT(1)', def: '0' }
  ]
  for (const { name, type, def } of cols) {
    if (!(await columnExists('club_settings', name))) {
      await query(`ALTER TABLE club_settings ADD COLUMN \`${name}\` ${type} DEFAULT ${def}`)
    }
  }
}

/** التحقق من وجود الجداول المنظمة */
export async function hasNormalizedTables() {
  try {
    await query('SELECT 1 FROM clubs LIMIT 1')
    return true
  } catch {
    return false
  }
}

// ---------- Platform Admins ----------
export async function getPlatformAdminsFromNormalized() {
  const { rows } = await query(
    `SELECT id, email, password_hash, role, permissions, created_at, updated_at
     FROM platform_admins WHERE ${SOFT_DELETE_WHERE}`
  )
  return rows.map(r => ({
    id: r.id,
    email: r.email,
    password: r.password_hash,
    role: r.role,
    permissions: typeof r.permissions === 'object' ? r.permissions : (r.permissions ? JSON.parse(r.permissions || '[]') : []),
    createdAt: r.created_at?.toISOString?.() || r.created_at
  }))
}

export async function savePlatformAdminsToNormalized(items, actor = {}) {
  if (!Array.isArray(items)) return
  const existing = await getPlatformAdminsFromNormalized()
  const existingIds = new Set(existing.map(m => m.id))
  const newIds = new Set(items.map(m => m?.id).filter(Boolean))

  for (const item of items) {
    if (!item?.id) continue
    const id = String(item.id)
    const password = item.password ?? item.password_hash ?? ''
    const permissions = JSON.stringify(item.permissions || [])
    const isNew = !existingIds.has(id)

    if (isNew) {
      await query(
        `INSERT INTO platform_admins (id, email, password_hash, role, permissions, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, item.email || '', password, item.role || 'admin', permissions, actor.actorId || null]
      )
      await logAudit({ tableName: 'platform_admins', recordId: id, action: 'INSERT', ...actor, newValue: { email: item.email } })
    } else {
      await query(
        `UPDATE platform_admins SET email=?, password_hash=?, role=?, permissions=?, updated_at=NOW(), updated_by=?
         WHERE id=?`,
        [item.email || '', password, item.role || 'admin', permissions, actor.actorId || null, id]
      )
      await logAudit({ tableName: 'platform_admins', recordId: id, action: 'UPDATE', ...actor, newValue: { email: item.email } })
    }
  }

  for (const id of existingIds) {
    if (!newIds.has(id)) {
      await query(
        'UPDATE platform_admins SET deleted_at=NOW(), deleted_by=? WHERE id=?',
        [actor.actorId || null, id]
      )
      await logAudit({ tableName: 'platform_admins', recordId: id, action: 'DELETE', ...actor })
    }
  }
}

// ---------- Members ----------
export async function getMembersFromNormalized() {
  let rows
  try {
    const res = await query(
      `SELECT id, name, name_ar, email, avatar, mobile, password_hash, total_points, total_games, total_wins, points_history
       FROM members WHERE ${SOFT_DELETE_WHERE}`
    )
    rows = res.rows
  } catch (e) {
    if (e?.message?.includes('Unknown column') && (e?.message?.includes('password_hash') || e?.message?.includes('mobile'))) {
      const res = await query(
        `SELECT id, name, name_ar, email, avatar, total_points, total_games, total_wins, points_history
         FROM members WHERE ${SOFT_DELETE_WHERE}`
      )
      rows = res.rows?.map(r => ({ ...r, password_hash: null, mobile: null })) || []
    } else {
      throw e
    }
  }
  const memberIds = rows.map(r => r.id)
  let clubIdsByMember = {}
  if (memberIds.length > 0) {
    const placeholders = memberIds.map(() => '?').join(',')
    const { rows: mcRows } = await query(
      `SELECT member_id, club_id FROM member_clubs WHERE member_id IN (${placeholders})`,
      memberIds
    )
    mcRows.forEach(r => {
      if (!clubIdsByMember[r.member_id]) clubIdsByMember[r.member_id] = []
      clubIdsByMember[r.member_id].push(r.club_id)
    })
  }

  // Merge passwords from app_store/entities when missing (migration not run yet or legacy data)
  const needsPasswordMerge = rows.some(r => !r.password_hash)
  if (needsPasswordMerge && rows.length > 0) {
    const passwordById = new Map()
    try {
      const { rows: storeRows } = await query('SELECT value FROM app_store WHERE `key` IN (?, ?)', ['all_members', 'padel_members'])
      for (const r of storeRows || []) {
        const arr = Array.isArray(r.value) ? r.value : (typeof r.value === 'string' ? (() => { try { return JSON.parse(r.value || '[]') } catch { return [] } })() : [])
        for (const m of arr) {
          if (m?.id && (m.password || m.password_hash)) passwordById.set(String(m.id), m.password || m.password_hash)
        }
      }
    } catch (_) {}
    try {
      const { rows: entityRows } = await query('SELECT entity_id, data FROM entities WHERE entity_type = ?', ['member'])
      for (const r of entityRows || []) {
        const d = typeof r.data === 'object' ? r.data : (r.data ? JSON.parse(r.data || '{}') : {})
        const pw = d.password || d.password_hash
        if (r.entity_id && pw) passwordById.set(String(r.entity_id), pw)
      }
    } catch (_) {}
    rows.forEach(r => {
      if (!r.password_hash && passwordById.has(r.id)) r.password_hash = passwordById.get(r.id)
    })
  }

  return rows.map(r => ({
    id: r.id,
    name: r.name,
    nameAr: r.name_ar,
    email: r.email,
    avatar: r.avatar,
    phone: r.mobile || null,
    mobile: r.mobile || null,
    password: r.password_hash || null,
    clubIds: clubIdsByMember[r.id] || [],
    clubId: (clubIdsByMember[r.id] || [])[0],
    totalPoints: r.total_points ?? 0,
    totalGames: r.total_games ?? 0,
    totalWins: r.total_wins ?? 0,
    pointsHistory: typeof r.points_history === 'object' ? r.points_history : (r.points_history ? JSON.parse(r.points_history || '[]') : [])
  }))
}

export async function saveMembersToNormalized(items, actor = {}) {
  if (!Array.isArray(items)) return
  const existing = await getMembersFromNormalized()
  const existingIds = new Set(existing.map(m => String(m?.id || '')).filter(Boolean))
  const newIds = new Set(items.map(m => (m?.id != null ? String(m.id) : '')).filter(Boolean))

  const itemIds = items.map(m => (m?.id != null ? String(m.id) : '')).filter(Boolean)
  const currentMemberClubs = new Map()
  const mergedClubIdsByMemberId = new Map()
  if (itemIds.length > 0) {
    const placeholders = itemIds.map(() => '?').join(',')
    const { rows } = await query(`SELECT member_id, club_id FROM member_clubs WHERE member_id IN (${placeholders})`, itemIds)
    for (const r of rows || []) {
      if (!currentMemberClubs.has(r.member_id)) currentMemberClubs.set(r.member_id, [])
      currentMemberClubs.get(r.member_id).push(r.club_id)
    }
  }

  for (const item of items) {
    if (!item?.id) continue
    const id = String(item.id)
    const isNew = !existingIds.has(id)
    const payloadClubIds = item.clubIds || (item.clubId ? [item.clubId] : [])
    const currentClubIds = currentMemberClubs.get(id) || []
    const mergedClubIds = [...new Set([...currentClubIds, ...payloadClubIds].filter(Boolean))]

    const passwordVal = item.password ?? item.password_hash ?? null
    const mobileVal = item.mobile ?? item.phone ?? null

    const insertWithAuth = `INSERT INTO members (id, name, name_ar, email, avatar, mobile, password_hash, total_points, total_games, total_wins, points_history, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    const insertWithoutAuth = `INSERT INTO members (id, name, name_ar, email, avatar, total_points, total_games, total_wins, points_history, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    const insertParamsWithAuth = [id, item.name || '', item.nameAr || null, item.email || null, item.avatar || null, mobileVal, passwordVal, item.totalPoints ?? 0, item.totalGames ?? 0, item.totalWins ?? 0, JSON.stringify(item.pointsHistory || []), actor.actorId || null]
    const insertParamsWithoutAuth = [id, item.name || '', item.nameAr || null, item.email || null, item.avatar || null, item.totalPoints ?? 0, item.totalGames ?? 0, item.totalWins ?? 0, JSON.stringify(item.pointsHistory || []), actor.actorId || null]

    if (isNew) {
      try {
        await query(insertWithAuth, insertParamsWithAuth)
      } catch (e) {
        if (e?.message?.includes('Unknown column') && (e?.message?.includes('password_hash') || e?.message?.includes('mobile'))) {
          await query(insertWithoutAuth, insertParamsWithoutAuth)
        } else {
          throw e
        }
      }
      await logAudit({ tableName: 'members', recordId: id, action: 'INSERT', ...actor, newValue: { name: item.name } })
    } else {
      try {
        await query(
          `UPDATE members SET name=?, name_ar=?, email=?, avatar=?, mobile=?, password_hash=?, total_points=?, total_games=?, total_wins=?, points_history=?, updated_at=NOW(), updated_by=?
           WHERE id=?`,
          [
            item.name || '',
            item.nameAr || null,
            item.email || null,
            item.avatar || null,
            mobileVal,
            passwordVal,
            item.totalPoints ?? 0,
            item.totalGames ?? 0,
            item.totalWins ?? 0,
            JSON.stringify(item.pointsHistory || []),
            actor.actorId || null,
            id
          ]
        )
      } catch (e) {
        if (e?.message?.includes('Unknown column') && (e?.message?.includes('password_hash') || e?.message?.includes('mobile'))) {
          await query(
            `UPDATE members SET name=?, name_ar=?, email=?, avatar=?, total_points=?, total_games=?, total_wins=?, points_history=?, updated_at=NOW(), updated_by=? WHERE id=?`,
            [item.name || '', item.nameAr || null, item.email || null, item.avatar || null, item.totalPoints ?? 0, item.totalGames ?? 0, item.totalWins ?? 0, JSON.stringify(item.pointsHistory || []), actor.actorId || null, id]
          )
        } else throw e
      }
      await logAudit({ tableName: 'members', recordId: id, action: 'UPDATE', ...actor, newValue: { name: item.name } })
    }

    const preserveMembership = payloadClubIds.length === 0 && currentClubIds.length > 0
    if (!preserveMembership) {
      await membershipService.setMemberClubs(id, mergedClubIds)
    }
    mergedClubIdsByMemberId.set(id, preserveMembership ? currentClubIds : mergedClubIds)
  }

  for (const id of existingIds) {
    if (!newIds.has(id) && id) {
      await query('UPDATE members SET deleted_at=NOW(), deleted_by=? WHERE id=?', [actor.actorId || null, id])
      await membershipService.removeAllMembershipsForMember(id)
      await logAudit({ tableName: 'members', recordId: id, action: 'DELETE', ...actor })
    }
  }

  // Dual-write to app_store so passwords are available for login merge (when password_hash column missing)
  try {
    const toStore = items.map(m => {
      const mid = m?.id != null ? String(m.id) : ''
      const clubIds = mergedClubIdsByMemberId.get(mid) ?? m.clubIds ?? (m.clubId ? [m.clubId] : [])
      return {
      id: m.id,
      name: m.name,
      nameAr: m.nameAr,
      email: m.email,
      avatar: m.avatar,
      phone: m.phone ?? m.mobile,
      mobile: m.mobile ?? m.phone,
      password: m.password ?? m.password_hash ?? null,
      clubIds,
      clubId: clubIds[0],
      totalPoints: m.totalPoints ?? 0,
      totalGames: m.totalGames ?? 0,
      totalWins: m.totalWins ?? 0,
      pointsHistory: m.pointsHistory || []
    }
    })
    await query(
      `INSERT INTO app_store (\`key\`, value, updated_at) VALUES ('all_members', ?, NOW())
       ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()`,
      [JSON.stringify(toStore)]
    )
    await query(
      `INSERT INTO app_store (\`key\`, value, updated_at) VALUES ('padel_members', ?, NOW())
       ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()`,
      [JSON.stringify(toStore)]
    )
  } catch (_) {}
}

/**
 * Sync member_clubs for members who exist in members table but have no member_clubs rows.
 * Tries: entities, app_store (all_members, padel_members). Falls back to assigning to the single club if only one exists.
 */
export async function syncMemberClubs() {
  const { rows: memberRows } = await query(
    `SELECT id FROM members WHERE ${SOFT_DELETE_WHERE}`
  )
  if (memberRows.length === 0) return { synced: 0, membersChecked: 0 }

  const memberIds = memberRows.map(r => r.id)
  const placeholders = memberIds.map(() => '?').join(',')
  const { rows: mcRows } = await query(
    `SELECT member_id FROM member_clubs WHERE member_id IN (${placeholders})`,
    memberIds
  )
  const membersWithClubs = new Set(mcRows.map(r => r.member_id))
  const membersWithoutClubs = memberIds.filter(id => !membersWithClubs.has(id))
  if (membersWithoutClubs.length === 0) return { synced: 0, membersChecked: memberIds.length }

  let synced = 0
  const { rows: clubRows } = await query(`SELECT id FROM clubs WHERE ${SOFT_DELETE_WHERE}`)
  const allClubIds = clubRows.map(r => r.id)
  const singleClubId = allClubIds.length === 1 ? allClubIds[0] : null

  for (const memberId of membersWithoutClubs) {
    let clubIds = []

    const { rows: entityRows } = await query(
      'SELECT data FROM entities WHERE entity_type = ? AND entity_id = ?',
      ['member', memberId]
    )
    if (entityRows.length > 0) {
      const d = typeof entityRows[0].data === 'object' ? entityRows[0].data : JSON.parse(entityRows[0].data || '{}')
      clubIds = d.clubIds && Array.isArray(d.clubIds) ? d.clubIds : (d.clubId ? [d.clubId] : [])
    }

    if (clubIds.length === 0) {
      const { rows: storeRows } = await query(
        'SELECT value FROM app_store WHERE `key` IN (?, ?)',
        ['all_members', 'padel_members']
      )
      for (const r of storeRows) {
        const arr = Array.isArray(r.value) ? r.value : (typeof r.value === 'string' ? (() => { try { return JSON.parse(r.value || '[]') } catch { return [] } })() : [])
        const m = arr.find(x => String(x?.id) === String(memberId))
        if (m) {
          clubIds = m.clubIds && Array.isArray(m.clubIds) ? m.clubIds : (m.clubId ? [m.clubId] : [])
          break
        }
      }
    }

    if (clubIds.length === 0 && singleClubId) {
      clubIds = [singleClubId]
    }

    for (const cid of clubIds) {
      if (cid && allClubIds.includes(cid)) {
        try {
          if (await membershipService.addMemberToClub(memberId, cid)) synced++
        } catch (_) {}
      }
    }
  }

  return { synced, membersChecked: memberIds.length }
}

/**
 * Remove a member from one club (explicit removal). Use this when the UI "remove from club" is used.
 * Does not affect other clubs. After this, saveMembers with updated clubIds will not re-add (merge keeps DB state).
 */
export async function removeMemberFromClub(memberId, clubId, actor = {}) {
  return membershipService.removeMemberFromClub(memberId, clubId, actor)
}

/** بناء كائن الإعدادات من صف club_settings (نفس الشكل المُرجَع للواجهة) */
function settingsFromSettingsRow(s) {
  const row = s || {}
  return {
    defaultLanguage: row.default_language || 'en',
    timezone: row.timezone || 'Asia/Riyadh',
    currency: row.currency || 'SAR',
    bookingDuration: bookingNumFromDb(row.booking_duration, 60),
    maxBookingAdvance: bookingNumFromDb(row.max_booking_advance, 30),
    cancellationPolicy: bookingNumFromDb(row.cancellation_policy, 24),
    ...Object.fromEntries(BOOKING_SETTINGS_COLS.map(({ db, js, default: d }) => [js, bookingNumFromDb(row[db], d)])),
    [ALLOW_INCOMPLETE_JS]: !!(Number(row[ALLOW_INCOMPLETE_DB]) === 1 || row[ALLOW_INCOMPLETE_DB] === true),
    openingTime: row.opening_time || '06:00',
    closingTime: row.closing_time || '23:00',
    headerBgColor: row.header_bg_color || '#ffffff',
    headerTextColor: row.header_text_color || '#0f172a',
    heroBgColor: row.hero_bg_color || '#ffffff',
    heroBgOpacity: row.hero_bg_opacity ?? 85,
    heroTitleColor: row.hero_title_color || '#0f172a',
    heroTextColor: row.hero_text_color || '#475569',
    heroStatsColor: row.hero_stats_color || '#0f172a',
    socialLinks: (() => {
      const v = row.social_links
      if (Array.isArray(v)) return v
      if (v && typeof v === 'object') return Object.values(v)
      if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p : [] } catch { return [] } }
      return []
    })(),
    bookingPrices: (() => {
      const v = row.booking_prices
      if (v && typeof v === 'object' && !Array.isArray(v)) return v
      if (typeof v === 'string') { try { const p = JSON.parse(v); return (p && typeof p === 'object' && !Array.isArray(p)) ? p : {} } catch { return {} } }
      return {}
    })()
  }
}

// ---------- Clubs ----------
async function assembleClub(clubRow, courts, settings, adminUsers, offers, bookings, accounting, tournamentTypes, store, memberIds, paymentSharesByBooking = {}) {
  const s = settings?.[0] || {}
  const settingsObj = settingsFromSettingsRow(s)
  return {
    id: clubRow.id,
    name: clubRow.name,
    nameAr: clubRow.name_ar,
    logo: clubRow.logo,
    banner: clubRow.banner,
    tagline: clubRow.tagline,
    taglineAr: clubRow.tagline_ar,
    address: clubRow.address,
    addressAr: clubRow.address_ar,
    phone: clubRow.phone,
    email: clubRow.email,
    website: clubRow.website,
    playtomicVenueId: clubRow.playtomic_venue_id,
    playtomicApiKey: clubRow.playtomic_api_key,
    status: clubRow.status,
    courts: (courts || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map(c => ({
      id: c.id,
      name: c.name,
      nameAr: c.name_ar,
      type: c.type || 'indoor',
      maintenance: !!c.maintenance,
      image: c.image || ''
    })),
    settings: settingsObj,
    tournaments: [],
    members: memberIds || [],
    bookings: (bookings || []).map(b => {
      let data = b.data
      if (typeof data === 'string') {
        try { data = JSON.parse(data) } catch { data = {} }
      }
      const spread = (data && typeof data === 'object') ? data : {}
      const dateVal = b.booking_date
      const dateStr = dateVal ? (typeof dateVal === 'string' ? dateVal.replace(/T.*$/, '') : (dateVal instanceof Date ? (() => { const d = dateVal; return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })() : String(dateVal).replace(/T.*$/, ''))) : (spread.date || spread.startDate || '')
      const bpsKey = `${b.club_id}:${b.id}`
      const sharesFromTable = paymentSharesByBooking[bpsKey] || []
      const paymentShares = sharesFromTable.length > 0 ? sharesFromTable : (spread.paymentShares || [])
      return {
        ...spread,
        paymentShares: Array.isArray(paymentShares) ? paymentShares : [],
        id: b.id,
        courtId: b.court_id,
        memberId: b.member_id,
        date: dateStr,
        startDate: dateStr,
        timeSlot: b.time_slot,
        startTime: b.start_time || b.time_slot,
        endTime: b.end_time || b.time_slot,
        status: b.status,
        lockedAt: b.locked_at,
        paymentDeadlineAt: b.payment_deadline_at,
        totalAmount: parseFloat(b.total_amount) || 0,
        paidAmount: parseFloat(b.paid_amount) || 0,
        initiatorMemberId: b.initiator_member_id
      }
    }),
    offers: (offers || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map(o => ({
      id: o.id,
      title: o.title,
      titleAr: o.title_ar,
      description: o.description,
      descriptionAr: o.description_ar,
      image: o.image,
      validFrom: o.valid_from,
      validUntil: o.valid_until,
      ...(typeof o.data === 'object' ? o.data : {})
    })),
    accounting: (accounting || []).map(a => ({
      id: a.id,
      date: a.entry_date,
      description: a.description,
      amount: Number(a.amount),
      type: a.entry_type,
      category: a.category,
      ...(typeof a.data === 'object' ? a.data : {})
    })),
    // Owner from club_admin_users (is_owner=1) - frontend expects adminEmail/adminPassword for login
    ...(function () {
      const admins = (adminUsers || []).map(u => ({
        id: u.id,
        email: u.email,
        password: u.password_hash,
        isOwner: !!u.is_owner,
        permissions: typeof u.permissions === 'object' ? u.permissions : (u.permissions ? JSON.parse(u.permissions || '[]') : [])
      }))
      const owner = admins.find(u => u.isOwner)
      const nonOwners = admins.filter(u => !u.isOwner)
      return {
        adminEmail: owner?.email || clubRow.email || '',
        adminPassword: owner?.password || '',
        adminUsers: nonOwners
      }
    })(),
    tournamentTypes: (tournamentTypes || []).map(t => ({
      id: t.id,
      name: t.name,
      nameAr: t.name_ar,
      description: t.description,
      descriptionAr: t.description_ar
    })),
    storeEnabled: !!clubRow.store_enabled,
    store: store?.data ? (typeof store.data === 'object' ? store.data : JSON.parse(store.data || '{}')) : { name: '', nameAr: '', categories: [], products: [], sales: [], inventoryMovements: [], offers: [], coupons: [], minStockAlert: 5 },
    tournamentData: typeof clubRow.tournament_data === 'object' ? clubRow.tournament_data : (clubRow.tournament_data ? JSON.parse(clubRow.tournament_data || '{}') : { kingState: null, socialState: null, currentTournamentId: 1 }),
    createdAt: clubRow.created_at?.toISOString?.(),
    updatedAt: clubRow.updated_at?.toISOString?.()
  }
}

export async function getClubsFromNormalized() {
  await ensureClubSettingsBookingColumns()
  const { rows: clubs } = await query(
    `SELECT * FROM clubs WHERE ${SOFT_DELETE_WHERE} ORDER BY name`
  )
  if (clubs.length === 0) return []

  const clubIds = clubs.map(c => c.id)
  const placeholders = clubIds.map(() => '?').join(',')

  let settingsRes
  try {
    settingsRes = await query(`SELECT club_id, default_language, timezone, currency, booking_duration, max_booking_advance, cancellation_policy, opening_time, closing_time, header_bg_color, header_text_color, hero_bg_color, hero_bg_opacity, hero_title_color, hero_text_color, hero_stats_color, social_links, booking_prices, lock_minutes, payment_deadline_minutes, split_manage_minutes, split_payment_deadline_minutes, refund_days, allow_incomplete_bookings, updated_by FROM club_settings WHERE club_id IN (${placeholders})`, clubIds)
  } catch (e) {
    if (e?.message?.includes('Unknown column') && e?.message?.includes('lock_minutes')) {
      await ensureClubSettingsBookingColumns()
      settingsRes = await query(`SELECT * FROM club_settings WHERE club_id IN (${placeholders})`, clubIds)
    } else throw e
  }
  const [courtsRes, adminRes, offersRes, bookingsRes, accountingRes, ttRes, storeRes, mcRes, bpsRes] = await Promise.all([
    query(`SELECT * FROM club_courts WHERE club_id IN (${placeholders}) AND deleted_at IS NULL`, clubIds),
    query(`SELECT * FROM club_admin_users WHERE club_id IN (${placeholders}) AND deleted_at IS NULL`, clubIds),
    query(`SELECT * FROM club_offers WHERE club_id IN (${placeholders}) AND deleted_at IS NULL`, clubIds),
    query(`SELECT * FROM club_bookings WHERE club_id IN (${placeholders}) AND deleted_at IS NULL`, clubIds),
    query(`SELECT * FROM club_accounting WHERE club_id IN (${placeholders}) AND deleted_at IS NULL`, clubIds),
    query(`SELECT * FROM club_tournament_types WHERE club_id IN (${placeholders}) AND deleted_at IS NULL`, clubIds),
    query(`SELECT * FROM club_store WHERE club_id IN (${placeholders})`, clubIds),
    query(`SELECT member_id, club_id FROM member_clubs WHERE club_id IN (${placeholders})`, clubIds),
    (async () => {
      try {
        return await query(`SELECT id, booking_id, club_id, participant_type, member_id, member_name, phone, amount, whatsapp_link, invite_token, paid_at, payment_reference FROM booking_payment_shares WHERE club_id IN (${placeholders})`, clubIds)
      } catch (_) {
        return await query(`SELECT booking_id, club_id, participant_type, member_id, member_name, phone, amount, whatsapp_link FROM booking_payment_shares WHERE club_id IN (${placeholders})`, clubIds)
      }
    })()
  ])

  const byClub = (arr, key = 'club_id') => {
    const m = {}
    ;(arr?.rows || arr || []).forEach(r => { if (!m[r[key]]) m[r[key]] = []; m[r[key]].push(r) })
    return m
  }

  const courtsByClub = byClub(courtsRes)
  const settingsByClub = byClub(settingsRes)
  const adminByClub = byClub(adminRes)
  const offersByClub = byClub(offersRes)
  const bookingsByClub = byClub(bookingsRes)
  const accountingByClub = byClub(accountingRes)
  const ttByClub = byClub(ttRes)
  const storeByClub = byClub(storeRes)
  const membersByClub = {}
  ;(mcRes?.rows || mcRes || []).forEach(r => {
    if (!membersByClub[r.club_id]) membersByClub[r.club_id] = []
    membersByClub[r.club_id].push(r.member_id)
  })

  const paymentSharesByBooking = {}
  ;(bpsRes?.rows || bpsRes || []).forEach(r => {
    const key = `${r.club_id}:${r.booking_id}`
    if (!paymentSharesByBooking[key]) paymentSharesByBooking[key] = []
    paymentSharesByBooking[key].push({
      id: r.id,
      type: r.participant_type || 'registered',
      memberId: r.member_id || undefined,
      memberName: r.member_name || undefined,
      phone: r.phone || undefined,
      amount: parseFloat(r.amount) || 0,
      whatsappLink: r.whatsapp_link || undefined,
      inviteToken: r.invite_token || undefined,
      paidAt: r.paid_at,
      paymentReference: r.payment_reference || undefined
    })
  })

  const result = []
  for (const club of clubs) {
    const cid = club.id
    result.push(await assembleClub(
      club,
      courtsByClub[cid],
      settingsByClub[cid],
      adminByClub[cid],
      offersByClub[cid],
      bookingsByClub[cid],
      accountingByClub[cid],
      ttByClub[cid],
      (storeByClub[cid] || [])[0],
      membersByClub[cid],
      paymentSharesByBooking
    ))
  }
  return result
}

export async function saveClubsToNormalized(items, actor = {}) {
  if (!Array.isArray(items)) return
  const existing = await getClubsFromNormalized()
  const existingIds = new Set(existing.map(c => c.id))
  const newIds = new Set(items.map(c => c?.id).filter(Boolean))

  const clubIdsToSave = items.map(c => c?.id).filter(Boolean)
  const currentClubMembers = new Map()
  if (clubIdsToSave.length > 0) {
    const placeholders = clubIdsToSave.map(() => '?').join(',')
    const { rows } = await query(`SELECT club_id, member_id FROM member_clubs WHERE club_id IN (${placeholders})`, clubIdsToSave)
    for (const r of rows || []) {
      if (!currentClubMembers.has(r.club_id)) currentClubMembers.set(r.club_id, [])
      currentClubMembers.get(r.club_id).push(r.member_id)
    }
  }

  await ensureClubSettingsBookingColumns()
  for (const club of items) {
    if (!club?.id) continue
    const cid = String(club.id)
    const isNew = !existingIds.has(cid)
    const oldClub = existing.find(c => c.id === cid)

    if (isNew) {
      await query(
        `INSERT INTO clubs (id, name, name_ar, logo, banner, tagline, tagline_ar, address, address_ar, phone, email, website, playtomic_venue_id, playtomic_api_key, status, store_enabled, tournament_data, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cid, club.name || '', club.nameAr || null, club.logo || '', club.banner || '',
          club.tagline || '', club.taglineAr || '', club.address || '', club.addressAr || '',
          club.phone || '', club.email || '', club.website || '', club.playtomicVenueId || '', club.playtomicApiKey || '',
          club.status || 'active', club.storeEnabled ? 1 : 0,
          JSON.stringify(club.tournamentData || { kingState: null, socialState: null, currentTournamentId: 1 }),
          actor.actorId || null
        ]
      )
      await logAudit({ tableName: 'clubs', recordId: cid, action: 'INSERT', ...actor, clubId: cid, newValue: { name: club.name } })
    } else {
      await query(
        `UPDATE clubs SET name=?, name_ar=?, logo=?, banner=?, tagline=?, tagline_ar=?, address=?, address_ar=?, phone=?, email=?, website=?, playtomic_venue_id=?, playtomic_api_key=?, status=?, store_enabled=?, tournament_data=?, updated_at=NOW(), updated_by=?
         WHERE id=?`,
        [
          club.name || '', club.nameAr || null, club.logo || '', club.banner || '',
          club.tagline || '', club.taglineAr || '', club.address || '', club.addressAr || '',
          club.phone || '', club.email || '', club.website || '', club.playtomicVenueId || '', club.playtomicApiKey || '',
          club.status || 'active', club.storeEnabled ? 1 : 0,
          JSON.stringify(club.tournamentData || {}),
          actor.actorId || null, cid
        ]
      )
      await logAudit({ tableName: 'clubs', recordId: cid, action: 'UPDATE', ...actor, clubId: cid, newValue: { name: club.name } })
    }

    const s = club.settings || {}
    const toNum = (v, def) => { const n = Number(v); return (v != null && v !== '' && !Number.isNaN(n)) ? n : def }
    const bookingPricesJson = JSON.stringify(s.bookingPrices || {})
    const settingsParamsNoBooking = [
      s.defaultLanguage || 'en', s.timezone || 'Asia/Riyadh', s.currency || 'SAR',
      toNum(s.bookingDuration, 60), toNum(s.maxBookingAdvance, 30), toNum(s.cancellationPolicy, 24),
      s.openingTime || '06:00', s.closingTime || '23:00',
      s.headerBgColor || '#ffffff', s.headerTextColor || '#0f172a',
      s.heroBgColor || '#ffffff', s.heroBgOpacity ?? 85, s.heroTitleColor || '#0f172a', s.heroTextColor || '#475569', s.heroStatsColor || '#0f172a',
      JSON.stringify(s.socialLinks || []), bookingPricesJson, actor.actorId || null, cid
    ]
    try {
      const { rows: existingRow } = await query('SELECT club_id FROM club_settings WHERE club_id = ?', [cid])
      if (existingRow && existingRow.length > 0) {
        await query(
          `UPDATE club_settings SET default_language=?, timezone=?, currency=?, booking_duration=?, max_booking_advance=?, cancellation_policy=?, opening_time=?, closing_time=?, header_bg_color=?, header_text_color=?, hero_bg_color=?, hero_bg_opacity=?, hero_title_color=?, hero_text_color=?, hero_stats_color=?, social_links=?, booking_prices=?, updated_at=NOW(), updated_by=? WHERE club_id=?`,
          settingsParamsNoBooking
        )
      } else {
        const bookingDefaults = [10, 10, 15, 30, 3, 0]
        const insertParams = [cid, ...settingsParamsNoBooking.slice(0, 17), ...bookingDefaults, settingsParamsNoBooking[17]]
        await query(
          `INSERT INTO club_settings (club_id, default_language, timezone, currency, booking_duration, max_booking_advance, cancellation_policy, opening_time, closing_time, header_bg_color, header_text_color, hero_bg_color, hero_bg_opacity, hero_title_color, hero_text_color, hero_stats_color, social_links, booking_prices, lock_minutes, payment_deadline_minutes, split_manage_minutes, split_payment_deadline_minutes, refund_days, allow_incomplete_bookings, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          insertParams
        )
      }
    } catch (e) {
      if (e?.message?.includes('Unknown column') && (e?.message?.includes('lock_minutes') || e?.message?.includes('refund_days') || e?.message?.includes('allow_incomplete'))) {
        await ensureClubSettingsBookingColumns()
        const { rows: existingRow2 } = await query('SELECT club_id FROM club_settings WHERE club_id = ?', [cid])
        if (existingRow2 && existingRow2.length > 0) {
          await query(
            `UPDATE club_settings SET default_language=?, timezone=?, currency=?, booking_duration=?, max_booking_advance=?, cancellation_policy=?, opening_time=?, closing_time=?, header_bg_color=?, header_text_color=?, hero_bg_color=?, hero_bg_opacity=?, hero_title_color=?, hero_text_color=?, hero_stats_color=?, social_links=?, booking_prices=?, updated_at=NOW(), updated_by=? WHERE club_id=?`,
            settingsParamsNoBooking
          )
        } else {
          const bookingDefaults = [10, 10, 15, 30, 3, 0]
          const insertParams = [cid, ...settingsParamsNoBooking.slice(0, 17), ...bookingDefaults, settingsParamsNoBooking[17]]
          await query(
            `INSERT INTO club_settings (club_id, default_language, timezone, currency, booking_duration, max_booking_advance, cancellation_policy, opening_time, closing_time, header_bg_color, header_text_color, hero_bg_color, hero_bg_opacity, hero_title_color, hero_text_color, hero_stats_color, social_links, booking_prices, lock_minutes, payment_deadline_minutes, split_manage_minutes, split_payment_deadline_minutes, refund_days, allow_incomplete_bookings, updated_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            insertParams
          )
        }
      } else throw e
    }

    const courts = club.courts || []
    const courtIds = new Set(courts.map(c => c?.id).filter(Boolean))
    const { rows: existingCourts } = await query('SELECT id FROM club_courts WHERE club_id=? AND deleted_at IS NULL', [cid])
    for (const ec of existingCourts) {
      if (!courtIds.has(ec.id)) {
        await query('UPDATE club_courts SET deleted_at=NOW(), deleted_by=? WHERE club_id=? AND id=?', [actor.actorId || null, cid, ec.id])
        await logAudit({ tableName: 'club_courts', recordId: ec.id, action: 'DELETE', ...actor, clubId: cid })
      }
    }
    let sortOrder = 0
    for (const c of courts) {
      if (!c?.id) continue
      await query(
        `INSERT INTO club_courts (id, club_id, name, name_ar, type, maintenance, image, sort_order, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), name_ar=VALUES(name_ar), type=VALUES(type), maintenance=VALUES(maintenance), image=VALUES(image), sort_order=VALUES(sort_order), updated_at=NOW(), updated_by=VALUES(updated_by), deleted_at=NULL, deleted_by=NULL`,
        [c.id, cid, c.name || '', c.nameAr || null, c.type || 'indoor', c.maintenance ? 1 : 0, c.image || '', sortOrder++, actor.actorId || null]
      )
    }

    // Owner (adminEmail/adminPassword) + additional admins (adminUsers). Frontend sends owner separately.
    const ownerEmail = (club.adminEmail || club.email || '').trim().toLowerCase()
    const ownerPassword = club.adminPassword || ''
    const additionalAdmins = club.adminUsers || []
    const allAdmins = []
    if (ownerEmail) {
      allAdmins.push({
        id: 'owner',
        email: club.adminEmail || club.email,
        password: ownerPassword,
        isOwner: true,
        permissions: ['dashboard', 'members', 'offers', 'store', 'accounting', 'settings', 'users']
      })
    }
    additionalAdmins.forEach(u => {
      if (u?.id && (u.email || '').toLowerCase() !== ownerEmail) {
        allAdmins.push({ ...u, isOwner: false })
      }
    })
    const adminIds = new Set(allAdmins.map(u => u?.id).filter(Boolean))
    const { rows: existingAdmins } = await query('SELECT id FROM club_admin_users WHERE club_id=? AND deleted_at IS NULL', [cid])
    for (const ea of existingAdmins) {
      if (!adminIds.has(ea.id)) {
        await query('UPDATE club_admin_users SET deleted_at=NOW(), deleted_by=? WHERE club_id=? AND id=?', [actor.actorId || null, cid, ea.id])
        await logAudit({ tableName: 'club_admin_users', recordId: ea.id, action: 'DELETE', ...actor, clubId: cid })
      }
    }
    for (const u of allAdmins) {
      if (!u?.id) continue
      const perm = JSON.stringify(u.permissions || [])
      await query(
        `INSERT INTO club_admin_users (id, club_id, email, password_hash, is_owner, permissions, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE email=VALUES(email), password_hash=VALUES(password_hash), is_owner=VALUES(is_owner), permissions=VALUES(permissions), updated_at=NOW(), updated_by=VALUES(updated_by), deleted_at=NULL, deleted_by=NULL`,
        [u.id, cid, u.email || '', u.password || '', u.isOwner ? 1 : 0, perm, actor.actorId || null]
      )
    }

    const offers = club.offers || []
    const offerIds = new Set(offers.map(o => o?.id).filter(Boolean))
    const { rows: existingOffers } = await query('SELECT id FROM club_offers WHERE club_id=? AND deleted_at IS NULL', [cid])
    for (const eo of existingOffers) {
      if (!offerIds.has(eo.id)) {
        await query('UPDATE club_offers SET deleted_at=NOW(), deleted_by=? WHERE club_id=? AND id=?', [actor.actorId || null, cid, eo.id])
        await logAudit({ tableName: 'club_offers', recordId: eo.id, action: 'DELETE', ...actor, clubId: cid })
      }
    }
    let offerSort = 0
    for (const o of offers) {
      if (!o?.id) continue
      const oid = o.id?.toString?.() || 'offer-' + Date.now() + '-' + offerSort
      await query(
        `INSERT INTO club_offers (id, club_id, title, title_ar, description, description_ar, image, valid_from, valid_until, sort_order, data, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE title=VALUES(title), title_ar=VALUES(title_ar), description=VALUES(description), description_ar=VALUES(description_ar), image=VALUES(image), valid_from=VALUES(valid_from), valid_until=VALUES(valid_until), sort_order=VALUES(sort_order), data=VALUES(data), updated_at=NOW(), updated_by=VALUES(updated_by), deleted_at=NULL, deleted_by=NULL`,
        [oid, cid, o.title || '', o.titleAr || null, o.description || null, o.descriptionAr || null, o.image || null, o.validFrom || null, o.validUntil || null, offerSort++, JSON.stringify(o), actor.actorId || null]
      )
    }

    const bookings = club.bookings || []
    const bookingIds = new Set(bookings.map(b => b?.id).filter(Boolean))
    const { rows: existingBookings } = await query('SELECT id FROM club_bookings WHERE club_id=? AND deleted_at IS NULL', [cid])
    for (const eb of existingBookings) {
      if (!bookingIds.has(eb.id)) {
        await query('UPDATE club_bookings SET deleted_at=NOW(), deleted_by=? WHERE club_id=? AND id=?', [actor.actorId || null, cid, eb.id])
        await query('DELETE FROM booking_payment_shares WHERE booking_id = ? AND club_id = ?', [eb.id, cid]).catch(() => {})
        await logAudit({ tableName: 'club_bookings', recordId: eb.id, action: 'DELETE', ...actor, clubId: cid })
      }
    }
    for (const b of bookings) {
      if (!b?.id) continue
      const bid = b.id?.toString?.()
      const bData = { ...b }
      ;['id', 'courtId', 'memberId', 'date', 'timeSlot', 'status', 'startTime', 'endTime', 'lockedAt', 'paymentDeadlineAt', 'totalAmount', 'paidAmount', 'initiatorMemberId'].forEach(k => delete bData[k])
      const startTime = b.startTime || b.timeSlot || null
      const endTime = b.endTime || b.timeSlot || null
      const totalAmount = parseFloat(b.totalAmount ?? b.price ?? b.amount) || 0
      const paidAmount = parseFloat(b.paidAmount) || 0
      try {
        await query(
          `INSERT INTO club_bookings (id, club_id, court_id, member_id, booking_date, time_slot, start_time, end_time, status, total_amount, paid_amount, initiator_member_id, data, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE court_id=VALUES(court_id), member_id=VALUES(member_id), booking_date=VALUES(booking_date), time_slot=VALUES(time_slot), start_time=VALUES(start_time), end_time=VALUES(end_time), status=VALUES(status), total_amount=VALUES(total_amount), paid_amount=VALUES(paid_amount), initiator_member_id=VALUES(initiator_member_id), data=VALUES(data), updated_at=NOW(), updated_by=VALUES(updated_by), deleted_at=NULL, deleted_by=NULL`,
          [bid, cid, b.courtId || null, b.memberId || null, b.date || null, b.timeSlot || null, startTime, endTime, b.status || null, totalAmount, paidAmount, b.initiatorMemberId || b.memberId || null, JSON.stringify(bData), actor.actorId || null]
        )
      } catch (e) {
        if (e?.message?.includes('Unknown column') && (e?.message?.includes('start_time') || e?.message?.includes('total_amount'))) {
          await query(
            `INSERT INTO club_bookings (id, club_id, court_id, member_id, booking_date, time_slot, status, data, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE court_id=VALUES(court_id), member_id=VALUES(member_id), booking_date=VALUES(booking_date), time_slot=VALUES(time_slot), status=VALUES(status), data=VALUES(data), updated_at=NOW(), updated_by=VALUES(updated_by), deleted_at=NULL, deleted_by=NULL`,
            [bid, cid, b.courtId || null, b.memberId || null, b.date || null, b.timeSlot || null, b.status || null, JSON.stringify({ ...bData, startTime, endTime, totalAmount, paidAmount }), actor.actorId || null]
          )
        } else throw e
      }
      const shares = Array.isArray(b.paymentShares) ? b.paymentShares : []
      try {
        const { rows: existingShares } = await query(
          'SELECT id, participant_type, member_id, phone, invite_token, whatsapp_link FROM booking_payment_shares WHERE booking_id = ? AND club_id = ?',
          [bid, cid]
        )
        const tokenByKey = {}
        for (const r of existingShares || []) {
          if (!r.invite_token) continue
          const key = r.participant_type === 'unregistered' ? `u:${(r.phone || '').trim()}` : `r:${(r.member_id || '').trim()}`
          tokenByKey[key] = { token: r.invite_token, wa: r.whatsapp_link }
        }
        await query('DELETE FROM booking_payment_shares WHERE booking_id = ? AND club_id = ?', [bid, cid])
        for (const s of shares) {
          const ptype = (s.type === 'unregistered' ? 'unregistered' : 'registered')
          const mid = ptype === 'registered' ? (s.memberId || null) : null
          const mname = ptype === 'registered' ? (s.memberName || null) : null
          const ph = ptype === 'unregistered' ? (s.phone || null) : null
          const amt = parseFloat(s.amount) || 0
          const key = ptype === 'unregistered' ? `u:${(ph || '').trim()}` : `r:${(mid || '').trim()}`
          const preserved = tokenByKey[key]
          const token = s.inviteToken || preserved?.token || null
          const wa = s.whatsappLink || preserved?.wa || (ptype === 'unregistered' ? null : null)
          await query(
            `INSERT INTO booking_payment_shares (booking_id, club_id, participant_type, member_id, member_name, phone, amount, whatsapp_link, invite_token)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [bid, cid, ptype, mid, mname, ph, amt, wa, token]
          )
        }
      } catch (bpsErr) {
        console.warn('booking_payment_shares: run migration add-booking-payment-shares-table.sql if table missing:', bpsErr?.message)
      }
    }

    const accounting = club.accounting || []
    const accIds = new Set(accounting.map(a => a?.id).filter(Boolean))
    const { rows: existingAcc } = await query('SELECT id FROM club_accounting WHERE club_id=? AND deleted_at IS NULL', [cid])
    for (const ea of existingAcc) {
      if (!accIds.has(ea.id)) {
        await query('UPDATE club_accounting SET deleted_at=NOW(), deleted_by=? WHERE id=?', [actor.actorId || null, ea.id])
        await logAudit({ tableName: 'club_accounting', recordId: String(ea.id), action: 'DELETE', ...actor, clubId: cid })
      }
    }
    for (const a of accounting) {
      const aid = a.id
      const aData = { ...a }; delete aData.id; delete aData.date; delete aData.description; delete aData.amount; delete aData.type; delete aData.category
      if (aid) {
        await query(
          `UPDATE club_accounting SET entry_date=?, description=?, amount=?, entry_type=?, category=?, data=?, updated_at=NOW(), updated_by=? WHERE id=? AND club_id=?`,
          [a.date || null, a.description || '', a.amount ?? 0, a.type || 'income', a.category || '', JSON.stringify(aData), actor.actorId || null, aid, cid]
        )
      } else {
        await query(
          `INSERT INTO club_accounting (club_id, entry_date, description, amount, entry_type, category, data, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [cid, a.date || null, a.description || '', a.amount ?? 0, a.type || 'income', a.category || '', JSON.stringify(aData), actor.actorId || null]
        )
      }
    }

    const tournamentTypes = club.tournamentTypes || []
    const ttIds = new Set(tournamentTypes.map(t => t?.id).filter(Boolean))
    const { rows: existingTT } = await query('SELECT id FROM club_tournament_types WHERE club_id=? AND deleted_at IS NULL', [cid])
    for (const et of existingTT) {
      if (!ttIds.has(et.id)) {
        await query('UPDATE club_tournament_types SET deleted_at=NOW(), deleted_by=? WHERE club_id=? AND id=?', [actor.actorId || null, cid, et.id])
        await logAudit({ tableName: 'club_tournament_types', recordId: et.id, action: 'DELETE', ...actor, clubId: cid })
      }
    }
    for (const t of tournamentTypes) {
      if (!t?.id) continue
      await query(
        `INSERT INTO club_tournament_types (id, club_id, name, name_ar, description, description_ar)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), name_ar=VALUES(name_ar), description=VALUES(description), description_ar=VALUES(description_ar), updated_at=NOW(), deleted_at=NULL, deleted_by=NULL`,
        [t.id, cid, t.name || '', t.nameAr || null, t.description || null, t.descriptionAr || null]
      )
    }

    const storeData = club.store || { name: '', nameAr: '', categories: [], products: [], sales: [], inventoryMovements: [], offers: [], coupons: [], minStockAlert: 5 }
    await query(
      `INSERT INTO club_store (club_id, data, updated_by) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE data=VALUES(data), updated_at=NOW(), updated_by=VALUES(updated_by)`,
      [cid, JSON.stringify(storeData), actor.actorId || null]
    )

    const memberList = club.members || []
    const payloadMemberIds = memberList.map((m) => (m != null && typeof m === 'object' && m.id != null ? String(m.id) : (m != null ? String(m) : null))).filter(Boolean)
    const currentMemberIds = currentClubMembers.get(cid) || []
    const mergedMemberIds = [...new Set([...currentMemberIds, ...payloadMemberIds])]
    // لا نمسح عضويات النادي إذا الطلب أتى بقائمة أعضاء فارغة والـ DB فيها أعضاء (مثلاً عند حذف حجز فقط)
    const preserveMembers = payloadMemberIds.length === 0 && currentMemberIds.length > 0
    if (!preserveMembers) {
      await membershipService.setClubMembers(cid, mergedMemberIds)
    }
  }

  for (const id of existingIds) {
    if (!newIds.has(id)) {
      await query('UPDATE clubs SET deleted_at=NOW(), deleted_by=? WHERE id=?', [actor.actorId || null, id])
      await logAudit({ tableName: 'clubs', recordId: id, action: 'DELETE', ...actor, clubId: id })
    }
  }
}

/**
 * Permanently delete a club and all related data from the database (hard delete).
 * Use with caution - this cannot be undone.
 */
export async function deleteClubPermanent(clubId, actor = {}) {
  if (!clubId) return false
  const cid = String(clubId)
  try {
    await membershipService.removeAllMembershipsForClub(cid)
    await query('DELETE FROM club_courts WHERE club_id = ?', [cid])
    await query('DELETE FROM club_settings WHERE club_id = ?', [cid])
    await query('DELETE FROM booking_payment_shares WHERE club_id = ?', [cid]).catch(() => {})
    await query('DELETE FROM club_admin_users WHERE club_id = ?', [cid])
    await query('DELETE FROM club_offers WHERE club_id = ?', [cid])
    await query('DELETE FROM club_bookings WHERE club_id = ?', [cid])
    await query('DELETE FROM club_accounting WHERE club_id = ?', [cid])
    await query('DELETE FROM club_tournament_types WHERE club_id = ?', [cid])
    await query('DELETE FROM club_store WHERE club_id = ?', [cid])
    await query('DELETE FROM clubs WHERE id = ?', [cid])
    await logAudit({ tableName: 'clubs', recordId: cid, action: 'DELETE', ...actor, clubId: cid, newValue: { permanent: true } })
    return true
  } catch (e) {
    console.error('deleteClubPermanent error:', e)
    return false
  }
}

/**
 * استخراج قيم إعدادات الحجز من كائن settings (يدعم 0 و false بشكل صريح).
 */
function getSettingNum(s, camelKey, snakeKey, def) {
  const v = s[camelKey] ?? s[snakeKey]
  if (v === null || v === undefined || v === '') return def
  const n = Number(v)
  return Number.isNaN(n) ? def : n
}
function getSettingBool(s, camelKey, snakeKey) {
  const v = s[camelKey] ?? s[snakeKey]
  return v === true || v === 1 || v === '1'
}

/**
 * حفظ إعدادات نادٍ واحد في padel_db (جدول club_settings).
 * استراتيجية موثوقة:
 * 1) التأكد من وجود الصف (إدراج بقيم افتراضية إن لم يكن موجوداً).
 * 2) تحديث الأعمدة العامة فقط (بدون أعمدة الحجز) لتفادي أي خلط.
 * 3) تحديث أعمدة الحجز في استعلام UPDATE منفصل بثمانية معاملات فقط.
 */
export async function updateClubSettingsInDb(clubId, settings, actor = {}) {
  if (!clubId || !settings || typeof settings !== 'object') return null
  const cid = String(clubId)
  await ensureClubSettingsBookingColumns()
  const s = settings
  const toNum = (v, def) => { const n = Number(v); return (v != null && v !== '' && !Number.isNaN(n)) ? n : def }
  const bookingPricesJson = JSON.stringify(s.bookingPrices || {})

  const generalParams = [
    s.defaultLanguage || 'en', s.timezone || 'Asia/Riyadh', s.currency || 'SAR',
    toNum(s.bookingDuration, 60), toNum(s.maxBookingAdvance, 30), toNum(s.cancellationPolicy, 24),
    s.openingTime || '06:00', s.closingTime || '23:00',
    s.headerBgColor || '#ffffff', s.headerTextColor || '#0f172a',
    s.heroBgColor || '#ffffff', s.heroBgOpacity ?? 85, s.heroTitleColor || '#0f172a', s.heroTextColor || '#475569', s.heroStatsColor || '#0f172a',
    JSON.stringify(s.socialLinks || []), bookingPricesJson, actor.actorId || null, cid
  ]

  const lockMinutes = getSettingNum(s, 'lockMinutes', 'lock_minutes', 10)
  const paymentDeadlineMinutes = getSettingNum(s, 'paymentDeadlineMinutes', 'payment_deadline_minutes', 10)
  const splitManageMinutes = getSettingNum(s, 'splitManageMinutes', 'split_manage_minutes', 15)
  const splitPaymentDeadlineMinutes = getSettingNum(s, 'splitPaymentDeadlineMinutes', 'split_payment_deadline_minutes', 30)
  const refundDays = getSettingNum(s, 'refundDays', 'refund_days', 3)
  const allowIncomplete = getSettingBool(s, ALLOW_INCOMPLETE_JS, 'allow_incomplete_bookings') ? 1 : 0
  const bookingParams = [lockMinutes, paymentDeadlineMinutes, splitManageMinutes, splitPaymentDeadlineMinutes, refundDays, allowIncomplete, actor.actorId || null, cid]

  const generalUpdateSql = `UPDATE club_settings SET default_language=?, timezone=?, currency=?, booking_duration=?, max_booking_advance=?, cancellation_policy=?, opening_time=?, closing_time=?, header_bg_color=?, header_text_color=?, hero_bg_color=?, hero_bg_opacity=?, hero_title_color=?, hero_text_color=?, hero_stats_color=?, social_links=?, booking_prices=?, updated_at=NOW(), updated_by=? WHERE club_id=?`
  const bookingUpdateSql = `UPDATE club_settings SET lock_minutes=?, payment_deadline_minutes=?, split_manage_minutes=?, split_payment_deadline_minutes=?, refund_days=?, allow_incomplete_bookings=?, updated_at=NOW(), updated_by=? WHERE club_id=?`

  try {
    const { rows: existing } = await query('SELECT club_id FROM club_settings WHERE club_id = ?', [cid])
    if (!existing || existing.length === 0) {
      const insertDefaults = [10, 10, 15, 30, 3, 0]
      const insertParams = [cid, ...generalParams.slice(0, 17), ...insertDefaults, generalParams[17]]
      await query(
        `INSERT INTO club_settings (club_id, default_language, timezone, currency, booking_duration, max_booking_advance, cancellation_policy, opening_time, closing_time, header_bg_color, header_text_color, hero_bg_color, hero_bg_opacity, hero_title_color, hero_text_color, hero_stats_color, social_links, booking_prices, lock_minutes, payment_deadline_minutes, split_manage_minutes, split_payment_deadline_minutes, refund_days, allow_incomplete_bookings, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        insertParams
      )
    } else {
      await query(generalUpdateSql, generalParams)
    }
    await query(bookingUpdateSql, bookingParams)
  } catch (e) {
    if (e?.message?.includes('Unknown column') && (e?.message?.includes('lock_minutes') || e?.message?.includes('refund_days') || e?.message?.includes('allow_incomplete'))) {
      await ensureClubSettingsBookingColumns()
      const { rows: existing2 } = await query('SELECT club_id FROM club_settings WHERE club_id = ?', [cid])
      if (!existing2 || existing2.length === 0) {
        const insertDefaults = [10, 10, 15, 30, 3, 0]
        const insertParams = [cid, ...generalParams.slice(0, 17), ...insertDefaults, generalParams[17]]
        await query(
          `INSERT INTO club_settings (club_id, default_language, timezone, currency, booking_duration, max_booking_advance, cancellation_policy, opening_time, closing_time, header_bg_color, header_text_color, hero_bg_color, hero_bg_opacity, hero_title_color, hero_text_color, hero_stats_color, social_links, booking_prices, lock_minutes, payment_deadline_minutes, split_manage_minutes, split_payment_deadline_minutes, refund_days, allow_incomplete_bookings, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          insertParams
        )
      } else {
        await query(generalUpdateSql, generalParams)
      }
      await query(bookingUpdateSql, bookingParams)
    } else throw e
  }
  return await getClubSettingsFromDb(cid)
}

/** استرجاع إعدادات نادٍ واحد من padel_db بعد الحفظ للتحقق. */
export async function getClubSettingsFromDb(clubId) {
  if (!clubId) return null
  const { rows } = await query('SELECT * FROM club_settings WHERE club_id = ?', [String(clubId)])
  const row = rows && rows[0]
  return row ? settingsFromSettingsRow(row) : null
}
