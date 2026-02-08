/**
 * استعلامات u502561206_padel_db — دوال قابلة للتنفيذ
 */
import { query } from './pool.js'

// --- app_settings ---
export async function getSetting(key) {
  const { rows } = await query('SELECT value FROM app_settings WHERE `key` = ?', [key])
  const raw = rows[0]?.value
  return raw === undefined || raw === null ? null : (typeof raw === 'object' ? raw : JSON.parse(raw || 'null'))
}

export async function setSetting(key, value) {
  await query(
    'INSERT INTO app_settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()',
    [key, JSON.stringify(value)]
  )
}

// --- platform_admins ---
export async function getPlatformAdmins() {
  const { rows } = await query(
    'SELECT id, email, password_hash, role, permissions FROM platform_admins WHERE deleted_at IS NULL ORDER BY email'
  )
  return rows.map(r => ({
    id: r.id,
    email: r.email,
    password: r.password_hash,
    role: r.role,
    permissions: typeof r.permissions === 'object' ? r.permissions : (r.permissions ? JSON.parse(r.permissions || '[]') : [])
  }))
}

export async function getPlatformAdminByEmail(email) {
  const { rows } = await query('SELECT * FROM platform_admins WHERE email = ? AND deleted_at IS NULL', [email])
  return rows[0] || null
}

// --- members ---
export async function getMembers() {
  const { rows } = await query(
    'SELECT id, name, name_ar, email, avatar, total_points, total_games, total_wins, points_history FROM members WHERE deleted_at IS NULL ORDER BY name'
  )
  return rows
}

export async function getMembersByClub(clubId) {
  const { rows } = await query(
    'SELECT m.* FROM members m JOIN member_clubs mc ON m.id = mc.member_id WHERE mc.club_id = ? AND m.deleted_at IS NULL',
    [clubId]
  )
  return rows
}

// --- clubs ---
export async function getClubs() {
  const { rows } = await query('SELECT * FROM clubs WHERE deleted_at IS NULL ORDER BY name')
  return rows
}

export async function getClubById(id) {
  const { rows } = await query('SELECT * FROM clubs WHERE id = ? AND deleted_at IS NULL', [id])
  return rows[0] || null
}

export async function getPendingClubs() {
  const { rows } = await query('SELECT * FROM clubs WHERE status = ? AND deleted_at IS NULL', ['pending'])
  return rows
}

// --- member_clubs ---
export async function getMemberClubIds(memberId) {
  const { rows } = await query('SELECT club_id FROM member_clubs WHERE member_id = ?', [memberId])
  return rows.map(r => r.club_id)
}

export async function getClubMemberCounts() {
  const { rows } = await query('SELECT club_id, COUNT(*) as count FROM member_clubs GROUP BY club_id')
  return rows
}

// --- club_courts ---
export async function getClubCourts(clubId) {
  const { rows } = await query(
    'SELECT * FROM club_courts WHERE club_id = ? AND deleted_at IS NULL ORDER BY sort_order',
    [clubId]
  )
  return rows
}

// --- club_offers ---
export async function getClubOffers(clubId) {
  const { rows } = await query(
    'SELECT * FROM club_offers WHERE club_id = ? AND deleted_at IS NULL ORDER BY sort_order',
    [clubId]
  )
  return rows
}

// --- club_accounting ---
export async function getClubAccounting(clubId) {
  const { rows } = await query(
    'SELECT * FROM club_accounting WHERE club_id = ? AND deleted_at IS NULL ORDER BY entry_date DESC',
    [clubId]
  )
  return rows
}

export async function getClubIncomeTotal(clubId) {
  const { rows } = await query(
    'SELECT COALESCE(SUM(amount), 0) as total FROM club_accounting WHERE club_id = ? AND entry_type = ? AND deleted_at IS NULL',
    [clubId, 'income']
  )
  return Number(rows[0]?.total ?? 0)
}

// --- matches ---
export async function getMatches(opts = {}) {
  let q = 'SELECT * FROM matches WHERE deleted_at IS NULL'
  const params = []
  if (opts.clubId) { q += ' AND club_id = ?'; params.push(opts.clubId) }
  if (opts.tournamentType) { q += ' AND tournament_type = ?'; params.push(opts.tournamentType) }
  if (opts.tournamentId != null) { q += ' AND tournament_id = ?'; params.push(opts.tournamentId) }
  q += ' ORDER BY saved_at ASC'
  const { rows } = await query(q, params)
  return rows
}

// --- member_stats ---
export async function getMemberStats(opts = {}) {
  let q = 'SELECT * FROM member_stats WHERE deleted_at IS NULL'
  const params = []
  if (opts.clubId) { q += ' AND club_id = ?'; params.push(opts.clubId) }
  if (opts.memberId) { q += ' AND member_id = ?'; params.push(opts.memberId) }
  q += ' ORDER BY saved_at DESC'
  const { rows } = await query(q, params)
  return rows
}

// --- tournament_summaries ---
export async function getTournamentSummaries(clubId) {
  const { rows } = await query(
    'SELECT * FROM tournament_summaries WHERE club_id = ? AND deleted_at IS NULL ORDER BY saved_at DESC',
    [clubId]
  )
  return rows
}

// --- audit_log ---
export async function getAuditLog(opts = {}) {
  let q = 'SELECT * FROM audit_log WHERE 1=1'
  const params = []
  if (opts.tableName) { q += ' AND table_name = ?'; params.push(opts.tableName) }
  if (opts.recordId) { q += ' AND record_id = ?'; params.push(opts.recordId) }
  if (opts.actorType) { q += ' AND actor_type = ?'; params.push(opts.actorType) }
  if (opts.actorId) { q += ' AND actor_id = ?'; params.push(opts.actorId) }
  if (opts.clubId) { q += ' AND club_id = ?'; params.push(opts.clubId) }
  q += ' ORDER BY created_at DESC LIMIT ' + (opts.limit || 100)
  const { rows } = await query(q, params)
  return rows
}

// --- إحصائيات ---
export async function getStatsTotals() {
  const [clubsRes, membersRes, matchesRes] = await Promise.all([
    query('SELECT COUNT(*) as n FROM clubs WHERE deleted_at IS NULL'),
    query('SELECT COUNT(*) as n FROM members WHERE deleted_at IS NULL'),
    query('SELECT COUNT(*) as n FROM matches WHERE deleted_at IS NULL')
  ])
  return {
    clubs: clubsRes.rows[0]?.n ?? 0,
    members: membersRes.rows[0]?.n ?? 0,
    matches: matchesRes.rows[0]?.n ?? 0
  }
}

export async function getTopMembersByPoints(limit = 10) {
  const { rows } = await query(
    'SELECT id, name, name_ar, total_points, total_games, total_wins FROM members WHERE deleted_at IS NULL ORDER BY total_points DESC LIMIT ?',
    [limit]
  )
  return rows
}

export async function getClubMatchCounts() {
  const { rows } = await query(
    'SELECT club_id, COUNT(*) as count FROM matches WHERE deleted_at IS NULL GROUP BY club_id'
  )
  return rows
}
