/**
 * Normalized data layer - قراءة وكتابة الجداول المنظمة
 * يحوّل إلى/من الصيغة التي يتوقعها التطبيق (توافق مع الفرونت إند)
 */
import { query } from './pool.js'
import { logAudit } from './audit.js'

const SOFT_DELETE_WHERE = 'deleted_at IS NULL'

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
  const { rows } = await query(
    `SELECT id, name, name_ar, email, avatar, total_points, total_games, total_wins, points_history
     FROM members WHERE ${SOFT_DELETE_WHERE}`
  )
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

  return rows.map(r => ({
    id: r.id,
    name: r.name,
    nameAr: r.name_ar,
    email: r.email,
    avatar: r.avatar,
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
  const existingIds = new Set(existing.map(m => m.id))
  const newIds = new Set(items.map(m => m?.id).filter(Boolean))

  for (const item of items) {
    if (!item?.id) continue
    const id = String(item.id)
    const isNew = !existingIds.has(id)
    const clubIds = item.clubIds || (item.clubId ? [item.clubId] : [])

    if (isNew) {
      await query(
        `INSERT INTO members (id, name, name_ar, email, avatar, total_points, total_games, total_wins, points_history, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          item.name || '',
          item.nameAr || null,
          item.email || null,
          item.avatar || null,
          item.totalPoints ?? 0,
          item.totalGames ?? 0,
          item.totalWins ?? 0,
          JSON.stringify(item.pointsHistory || []),
          actor.actorId || null
        ]
      )
      await logAudit({ tableName: 'members', recordId: id, action: 'INSERT', ...actor, newValue: { name: item.name } })
    } else {
      await query(
        `UPDATE members SET name=?, name_ar=?, email=?, avatar=?, total_points=?, total_games=?, total_wins=?, points_history=?, updated_at=NOW(), updated_by=?
         WHERE id=?`,
        [
          item.name || '',
          item.nameAr || null,
          item.email || null,
          item.avatar || null,
          item.totalPoints ?? 0,
          item.totalGames ?? 0,
          item.totalWins ?? 0,
          JSON.stringify(item.pointsHistory || []),
          actor.actorId || null,
          id
        ]
      )
      await logAudit({ tableName: 'members', recordId: id, action: 'UPDATE', ...actor, newValue: { name: item.name } })
    }

    await query('DELETE FROM member_clubs WHERE member_id = ?', [id])
    for (const cid of clubIds) {
      if (cid) await query('INSERT IGNORE INTO member_clubs (member_id, club_id) VALUES (?, ?)', [id, cid])
    }
  }

  for (const id of existingIds) {
    if (!newIds.has(id)) {
      await query('UPDATE members SET deleted_at=NOW(), deleted_by=? WHERE id=?', [actor.actorId || null, id])
      await query('DELETE FROM member_clubs WHERE member_id = ?', [id])
      await logAudit({ tableName: 'members', recordId: id, action: 'DELETE', ...actor })
    }
  }
}

// ---------- Clubs ----------
async function assembleClub(clubRow, courts, settings, adminUsers, offers, bookings, accounting, tournamentTypes, store, memberIds) {
  const s = settings?.[0] || {}
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
    settings: {
      defaultLanguage: s.default_language || 'en',
      timezone: s.timezone || 'Asia/Riyadh',
      currency: s.currency || 'SAR',
      bookingDuration: s.booking_duration ?? 60,
      maxBookingAdvance: s.max_booking_advance ?? 30,
      cancellationPolicy: s.cancellation_policy ?? 24,
      openingTime: s.opening_time || '06:00',
      closingTime: s.closing_time || '23:00',
      headerBgColor: s.header_bg_color || '#ffffff',
      headerTextColor: s.header_text_color || '#0f172a',
      heroBgColor: s.hero_bg_color || '#ffffff',
      heroBgOpacity: s.hero_bg_opacity ?? 85,
      heroTitleColor: s.hero_title_color || '#0f172a',
      heroTextColor: s.hero_text_color || '#475569',
      heroStatsColor: s.hero_stats_color || '#0f172a',
      socialLinks: typeof s.social_links === 'object' ? s.social_links : (s.social_links ? JSON.parse(s.social_links || '[]') : [])
    },
    tournaments: [],
    members: memberIds || [],
    bookings: (bookings || []).map(b => ({
      ...(typeof b.data === 'object' ? b.data : {}),
      id: b.id,
      courtId: b.court_id,
      memberId: b.member_id,
      date: b.booking_date,
      timeSlot: b.time_slot,
      status: b.status
    })),
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
  const { rows: clubs } = await query(
    `SELECT * FROM clubs WHERE ${SOFT_DELETE_WHERE} ORDER BY name`
  )
  if (clubs.length === 0) return []

  const clubIds = clubs.map(c => c.id)
  const placeholders = clubIds.map(() => '?').join(',')

  const [courtsRes, settingsRes, adminRes, offersRes, bookingsRes, accountingRes, ttRes, storeRes, mcRes] = await Promise.all([
    query(`SELECT * FROM club_courts WHERE club_id IN (${placeholders}) AND deleted_at IS NULL`, clubIds),
    query(`SELECT * FROM club_settings WHERE club_id IN (${placeholders})`, clubIds),
    query(`SELECT * FROM club_admin_users WHERE club_id IN (${placeholders}) AND deleted_at IS NULL`, clubIds),
    query(`SELECT * FROM club_offers WHERE club_id IN (${placeholders}) AND deleted_at IS NULL`, clubIds),
    query(`SELECT * FROM club_bookings WHERE club_id IN (${placeholders}) AND deleted_at IS NULL`, clubIds),
    query(`SELECT * FROM club_accounting WHERE club_id IN (${placeholders}) AND deleted_at IS NULL`, clubIds),
    query(`SELECT * FROM club_tournament_types WHERE club_id IN (${placeholders}) AND deleted_at IS NULL`, clubIds),
    query(`SELECT * FROM club_store WHERE club_id IN (${placeholders})`, clubIds),
    query(`SELECT member_id, club_id FROM member_clubs WHERE club_id IN (${placeholders})`, clubIds)
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
      membersByClub[cid]
    ))
  }
  return result
}

export async function saveClubsToNormalized(items, actor = {}) {
  if (!Array.isArray(items)) return
  const existing = await getClubsFromNormalized()
  const existingIds = new Set(existing.map(c => c.id))
  const newIds = new Set(items.map(c => c?.id).filter(Boolean))

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
    await query(
      `INSERT INTO club_settings (club_id, default_language, timezone, currency, booking_duration, max_booking_advance, cancellation_policy, opening_time, closing_time, header_bg_color, header_text_color, hero_bg_color, hero_bg_opacity, hero_title_color, hero_text_color, hero_stats_color, social_links, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE default_language=VALUES(default_language), timezone=VALUES(timezone), currency=VALUES(currency), booking_duration=VALUES(booking_duration), max_booking_advance=VALUES(max_booking_advance), cancellation_policy=VALUES(cancellation_policy), opening_time=VALUES(opening_time), closing_time=VALUES(closing_time), header_bg_color=VALUES(header_bg_color), header_text_color=VALUES(header_text_color), hero_bg_color=VALUES(hero_bg_color), hero_bg_opacity=VALUES(hero_bg_opacity), hero_title_color=VALUES(hero_title_color), hero_text_color=VALUES(hero_text_color), hero_stats_color=VALUES(hero_stats_color), social_links=VALUES(social_links), updated_at=NOW(), updated_by=VALUES(updated_by)`,
      [
        cid, s.defaultLanguage || 'en', s.timezone || 'Asia/Riyadh', s.currency || 'SAR',
        s.bookingDuration ?? 60, s.maxBookingAdvance ?? 30, s.cancellationPolicy ?? 24,
        s.openingTime || '06:00', s.closingTime || '23:00',
        s.headerBgColor || '#ffffff', s.headerTextColor || '#0f172a',
        s.heroBgColor || '#ffffff', s.heroBgOpacity ?? 85, s.heroTitleColor || '#0f172a', s.heroTextColor || '#475569', s.heroStatsColor || '#0f172a',
        JSON.stringify(s.socialLinks || []), actor.actorId || null
      ]
    )

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
        await logAudit({ tableName: 'club_bookings', recordId: eb.id, action: 'DELETE', ...actor, clubId: cid })
      }
    }
    for (const b of bookings) {
      if (!b?.id) continue
      const bid = b.id?.toString?.()
      const bData = { ...b }; delete bData.id; delete bData.courtId; delete bData.memberId; delete bData.date; delete bData.timeSlot; delete bData.status
      await query(
        `INSERT INTO club_bookings (id, club_id, court_id, member_id, booking_date, time_slot, status, data, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE court_id=VALUES(court_id), member_id=VALUES(member_id), booking_date=VALUES(booking_date), time_slot=VALUES(time_slot), status=VALUES(status), data=VALUES(data), updated_at=NOW(), updated_by=VALUES(updated_by), deleted_at=NULL, deleted_by=NULL`,
        [bid, cid, b.courtId || null, b.memberId || null, b.date || null, b.timeSlot || null, b.status || null, JSON.stringify(bData), actor.actorId || null]
      )
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

    const memberIds = club.members || []
    await query('DELETE FROM member_clubs WHERE club_id = ?', [cid])
    for (const mid of memberIds) {
      if (mid) await query('INSERT IGNORE INTO member_clubs (member_id, club_id) VALUES (?, ?)', [mid, cid])
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
    await query('DELETE FROM member_clubs WHERE club_id = ?', [cid])
    await query('DELETE FROM club_courts WHERE club_id = ?', [cid])
    await query('DELETE FROM club_settings WHERE club_id = ?', [cid])
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
