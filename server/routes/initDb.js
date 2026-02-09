import { Router } from 'express'
import { query, isConnected } from '../db/pool.js'
import { getEntities, setEntities } from '../db/dataHelpers.js'

const router = Router()

const STMTS = [
  `CREATE TABLE IF NOT EXISTS app_store (\`key\` VARCHAR(255) PRIMARY KEY, value JSON NOT NULL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS entities (id INT AUTO_INCREMENT PRIMARY KEY, entity_type VARCHAR(50) NOT NULL, entity_id VARCHAR(255) NOT NULL, data JSON NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY uk_entity (entity_type, entity_id), INDEX idx_entity_type (entity_type))`,
  `CREATE TABLE IF NOT EXISTS app_settings (\`key\` VARCHAR(255) PRIMARY KEY, value JSON, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS matches (id INT AUTO_INCREMENT PRIMARY KEY, club_id VARCHAR(255) NOT NULL, tournament_type VARCHAR(255) NOT NULL, tournament_id INT NOT NULL, data JSON NOT NULL, saved_at BIGINT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, INDEX idx_matches_club (club_id), INDEX idx_matches_tournament (club_id, tournament_type, tournament_id), INDEX idx_matches_saved_at (saved_at))`,
  `CREATE TABLE IF NOT EXISTS member_stats (id INT AUTO_INCREMENT PRIMARY KEY, club_id VARCHAR(255) NOT NULL, member_id VARCHAR(255) NOT NULL, tournament_id INT NOT NULL, data JSON NOT NULL, saved_at BIGINT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, INDEX idx_member_stats_club (club_id), INDEX idx_member_stats_member (member_id))`,
  `CREATE TABLE IF NOT EXISTS tournament_summaries (id INT AUTO_INCREMENT PRIMARY KEY, club_id VARCHAR(255) NOT NULL, data JSON NOT NULL, saved_at BIGINT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, INDEX idx_tournament_summaries_club (club_id))`,
  `INSERT IGNORE INTO app_store (\`key\`, value) VALUES ('admin_clubs', '[]')`,
  `INSERT IGNORE INTO app_store (\`key\`, value) VALUES ('all_members', '[]')`,
  `INSERT IGNORE INTO app_store (\`key\`, value) VALUES ('padel_members', '[]')`,
  `INSERT IGNORE INTO app_store (\`key\`, value) VALUES ('platform_admins', '[]')`,
  `INSERT IGNORE INTO app_store (\`key\`, value) VALUES ('admin_settings', '{}')`,
  `INSERT IGNORE INTO app_store (\`key\`, value) VALUES ('bookings', '[]')`,
  `INSERT IGNORE INTO app_settings (\`key\`, value) VALUES ('admin_settings', '{}')`,
  `INSERT IGNORE INTO app_settings (\`key\`, value) VALUES ('app_language', '"en"')`,
  `INSERT IGNORE INTO app_settings (\`key\`, value) VALUES ('current_member_id', 'null')`,
  `INSERT IGNORE INTO app_settings (\`key\`, value) VALUES ('admin_current_club_id', 'null')`,
  `INSERT IGNORE INTO app_settings (\`key\`, value) VALUES ('platform_admin_session', 'null')`,
  `INSERT IGNORE INTO app_settings (\`key\`, value) VALUES ('club_admin_session', 'null')`,
  `INSERT IGNORE INTO app_settings (\`key\`, value) VALUES ('current_club_admin_id', 'null')`,
  `INSERT IGNORE INTO app_settings (\`key\`, value) VALUES ('password_reset_tokens', '{}')`
]

router.get('/', async (req, res) => {
  const hasDb = isConnected() || !!process.env.DATABASE_URL
  // GET /api/init-db?reset=1 — إعادة تهيئة كاملة: حذف البيانات وإعادة الإنشاء (لـ u502561206_padel_db)
  if (req.query.reset === '1' && hasDb) {
    try {
      await query('SET FOREIGN_KEY_CHECKS = 0')
      await query('TRUNCATE TABLE matches')
      await query('TRUNCATE TABLE member_stats')
      await query('TRUNCATE TABLE tournament_summaries')
      await query('DELETE FROM entities')
      await query('DELETE FROM app_settings')
      await query('TRUNCATE TABLE app_store')
      for (const t of ['booking_payment_shares', 'member_clubs', 'club_courts', 'club_settings', 'club_admin_users', 'club_offers', 'club_bookings', 'club_accounting', 'club_tournament_types', 'club_store', 'clubs', 'members', 'platform_admins', 'audit_log']) {
        try { await query(`TRUNCATE TABLE \`${t}\``) } catch (_) { /* table may not exist */ }
      }
      await query('SET FOREIGN_KEY_CHECKS = 1')
      // Run normal init
      for (let i = 0; i < STMTS.length; i++) {
        try {
          await query(STMTS[i])
        } catch (stmtErr) {
          console.error('init-db reset stmt', i, 'failed:', stmtErr.message)
        }
      }
      // لا إنشاء نوادي افتراضية — النظام يبدأ فارغاً
      const defaultOwner = {
        id: 'super-admin-default',
        email: 'admin@playtix.app',
        password: 'Admin@123456',
        role: 'owner',
        permissions: ['all-clubs', 'manage-clubs', 'all-members', 'admin-users'],
        createdAt: new Date().toISOString()
      }
      await query('INSERT INTO entities (entity_type, entity_id, data) VALUES (?, ?, ?)', ['platform_admin', defaultOwner.id, JSON.stringify(defaultOwner)])
      try {
        const { migrateEntitiesToNormalized } = await import('../db/migrateToNormalized.js')
        await migrateEntitiesToNormalized()
      } catch (migErr) {
        console.warn('[init-db reset] migrate to normalized:', migErr.message)
      }
      try {
        const { runInitRelational } = await import('../db/initRelational.js')
        await runInitRelational()
      } catch (relErr) {
        console.warn('[init-db reset] init-relational:', relErr.message)
      }
      return res.json({ ok: true, message: 'Database reset and reinitialized successfully' })
    } catch (e) {
      console.error('init-db reset error:', e)
      return res.status(500).json({ error: e.message })
    }
  }
  // GET /api/init-db?init=1 — تهيئة من المتصفح (بديل لـ POST عند صعوبة تنفيذ الأوامر)
  if (req.query.init === '1' && hasDb) {
    try {
      for (let i = 0; i < STMTS.length; i++) {
        try {
          await query(STMTS[i])
        } catch (stmtErr) {
          console.error('init-db stmt', i, 'failed:', stmtErr.message)
          throw new Error(`Statement ${i + 1} failed: ${stmtErr.message}`)
        }
      }
      const { rows: clubRows } = await query('SELECT COUNT(*) as n FROM entities WHERE entity_type = ?', ['club'])
      if (clubRows[0]?.n === 0) {
        const { rows: storeRows } = await query('SELECT `key`, value FROM app_store WHERE `key` IN (?, ?, ?, ?)', ['admin_clubs', 'all_members', 'padel_members', 'platform_admins'])
        const byType = { club: [], member: [], platform_admin: [] }
        const memberById = new Map()
        for (const r of storeRows) {
          const arr = Array.isArray(r.value) ? r.value : (typeof r.value === 'string' ? JSON.parse(r.value || '[]') : [])
          if (r.key === 'admin_clubs') byType.club = arr
          else if (r.key === 'platform_admins') byType.platform_admin = arr
          else if (r.key === 'all_members' || r.key === 'padel_members') {
            arr.forEach(m => { if (m?.id) memberById.set(m.id, { ...memberById.get(m.id), ...m }) })
          }
        }
        byType.member = Array.from(memberById.values())
        for (const [type, items] of Object.entries(byType)) {
          for (const item of items) {
            const id = (item?.id || 'item-' + Date.now()).toString()
            await query('INSERT IGNORE INTO entities (entity_type, entity_id, data) VALUES (?, ?, ?)', [type, id, JSON.stringify(item)])
          }
        }
        const { rows: settingsRows } = await query('SELECT `key`, value FROM app_store WHERE `key` IN (?, ?, ?, ?, ?, ?)', ['admin_settings', 'app_language', 'current_member_id', 'admin_current_club_id', 'bookings', 'password_reset_tokens'])
        for (const r of settingsRows) {
          await query('INSERT IGNORE INTO app_settings (`key`, value) VALUES (?, ?)', [r.key, JSON.stringify(r.value)])
        }
      }
      // لا إنشاء نوادي — النظام يبدأ فارغاً
      const { rows: paRows } = await query('SELECT COUNT(*) as n FROM entities WHERE entity_type = ?', ['platform_admin'])
      if (paRows[0]?.n === 0) {
        const defaultOwner = {
          id: 'super-admin-default',
          email: 'admin@playtix.app',
          password: 'Admin@123456',
          role: 'owner',
          permissions: ['all-clubs', 'manage-clubs', 'all-members', 'admin-users'],
          createdAt: new Date().toISOString()
        }
        await query('INSERT INTO entities (entity_type, entity_id, data) VALUES (?, ?, ?)', ['platform_admin', defaultOwner.id, JSON.stringify(defaultOwner)])
      }
      try {
        const { migrateEntitiesToNormalized } = await import('../db/migrateToNormalized.js')
        await migrateEntitiesToNormalized()
      } catch (migErr) {
        console.warn('[init-db init] migrate to normalized:', migErr.message)
      }
      try {
        const { runInitRelational } = await import('../db/initRelational.js')
        await runInitRelational()
      } catch (relErr) {
        console.warn('[init-db init] init-relational:', relErr.message)
      }
      return res.json({ ok: true, message: 'Database initialized successfully (via browser)' })
    } catch (e) {
      console.error('init-db GET error:', e)
      return res.status(500).json({ error: e.message })
    }
  }
  res.json({
    configured: hasDb,
    hint: !hasDb ? 'Add database.config.json or DATABASE_URL' : 'Add ?init=1 to URL to initialize tables from browser, or use POST'
  })
})

/** GET /api/init-db/stats - إحصائيات من الاستعلامات */
router.get('/stats', async (req, res) => {
  try {
    if (!isConnected()) return res.status(503).json({ error: 'Database not connected' })
    const { getStatsTotals, getTopMembersByPoints, getClubMatchCounts, getClubMemberCounts } = await import('../db/queries.js')
    const [totals, topMembers, matchCounts, memberCounts] = await Promise.all([
      getStatsTotals().catch(() => ({ clubs: 0, members: 0, matches: 0 })),
      getTopMembersByPoints(5).catch(() => []),
      getClubMatchCounts().catch(() => []),
      getClubMemberCounts().catch(() => [])
    ])
    res.json({ ok: true, totals, topMembers, matchCounts, memberCounts })
  } catch (e) {
    console.error('init-db stats:', e)
    res.status(500).json({ error: e.message })
  }
})

/** GET /api/init-db/tables - Verify all required tables exist */
router.get('/tables', async (req, res) => {
  try {
    if (!isConnected()) {
      return res.json({ ok: false, tables: [], hint: 'Database not connected. Set DATABASE_URL or database.config.json' })
    }
    const required = ['entities', 'app_settings', 'app_store', 'matches', 'member_stats', 'tournament_summaries']
    const normalized = ['clubs', 'members', 'platform_admins', 'audit_log']
    const results = []
    for (const t of required) {
      try {
        await query(`SELECT 1 FROM \`${t}\` LIMIT 1`)
        results.push({ name: t, exists: true, type: 'required' })
      } catch (e) {
        results.push({ name: t, exists: false, error: e.message, type: 'required' })
      }
    }
    for (const t of normalized) {
      try {
        await query(`SELECT 1 FROM \`${t}\` LIMIT 1`)
        results.push({ name: t, exists: true, type: 'normalized' })
      } catch (e) {
        results.push({ name: t, exists: false, error: e.message, type: 'normalized' })
      }
    }
    const requiredOk = results.filter(r => r.type === 'required').every(r => r.exists)
    const normalizedOk = results.filter(r => r.type === 'normalized').every(r => r.exists)
    res.json({ ok: requiredOk, tables: results, normalizedReady: normalizedOk, hint: !requiredOk ? 'Run POST /api/init-db to create missing tables' : !normalizedOk ? 'Run /api/init-db/migrate-to-normalized for normalized schema' : 'All tables ready' })
  } catch (e) {
    res.status(500).json({ ok: false, tables: [], error: e.message })
  }
})

const migrateClubSettingsHandler = async (req, res) => {
  try {
    if (!isConnected()) {
      return res.status(503).json({ error: 'Database not connected' })
    }
    const { hasNormalizedTables, saveClubsToNormalized } = await import('../db/normalizedData.js')
    const clubs = await getEntities('club')
    let updated = 0
    const defaults = {
      logo: '',
      banner: '',
      adminUsers: []
    }
    const settingsDefaults = {
      headerBgColor: '#ffffff',
      headerTextColor: '#0f172a',
      heroBgColor: '#ffffff',
      heroBgOpacity: 85,
      heroTitleColor: '#0f172a',
      heroTextColor: '#475569',
      heroStatsColor: '#0f172a',
      socialLinks: []
    }
    const mergedClubs = []
    for (const club of clubs) {
      let changed = false
      const merged = { ...club }
      for (const [k, v] of Object.entries(defaults)) {
        if (merged[k] === undefined) { merged[k] = v; changed = true }
      }
      merged.settings = merged.settings || {}
      for (const [k, v] of Object.entries(settingsDefaults)) {
        if (merged.settings[k] === undefined) { merged.settings[k] = v; changed = true }
      }
      const defaultCourts = [
        { id: 'court-1', name: 'Court 1', nameAr: 'الملعب 1', type: 'indoor', maintenance: false, image: '' },
        { id: 'court-2', name: 'Court 2', nameAr: 'الملعب 2', type: 'indoor', maintenance: false, image: '' },
        { id: 'court-3', name: 'Court 3', nameAr: 'الملعب 3', type: 'indoor', maintenance: false, image: '' },
        { id: 'court-4', name: 'Court 4', nameAr: 'الملعب 4', type: 'indoor', maintenance: false, image: '' }
      ]
      merged.courts = merged.courts && Array.isArray(merged.courts) ? merged.courts : []
      const existingIds = new Set(merged.courts.map(c => c.id))
      defaultCourts.forEach(dc => {
        if (!existingIds.has(dc.id)) {
          merged.courts.push({ ...dc })
          changed = true
        }
      })
      if (merged.courts.length > 0) {
        const needsCourtUpdate = merged.courts.some(c => c.maintenance === undefined || c.image === undefined)
        if (needsCourtUpdate) {
          merged.courts = merged.courts.map(c => ({
            ...c,
            maintenance: c.maintenance ?? false,
            image: c.image ?? ''
          }))
          changed = true
        }
      }
      mergedClubs.push(merged)
      if (changed) updated++
    }
    if (updated > 0) {
      const normalized = await hasNormalizedTables()
      if (normalized) {
        await saveClubsToNormalized(mergedClubs, { actorType: 'system', actorId: null })
      } else {
        for (const club of mergedClubs) {
          await query(
            'UPDATE entities SET data = ?, updated_at = NOW() WHERE entity_type = ? AND entity_id = ?',
            [JSON.stringify(club), 'club', club.id]
          )
        }
      }
    }
    res.json({ ok: true, message: `Migrated ${updated} club(s) - added missing courts (e.g. Court 4) and settings` })
  } catch (e) {
    console.error('migrate-club-settings:', e)
    res.status(500).json({ error: e.message })
  }
}

/** GET/POST /api/init-db/migrate-club-settings - Add missing courts (e.g. Court 4) and Club Settings to existing clubs */
router.get('/migrate-club-settings', migrateClubSettingsHandler)
router.post('/migrate-club-settings', migrateClubSettingsHandler)

/** GET/POST /api/init-db/sync-member-clubs - ربط الأعضاء في members بجدول member_clubs إذا كان الربط ناقصاً */
const syncMemberClubsHandler = async (req, res) => {
  try {
    if (!isConnected()) return res.status(503).json({ error: 'Database not connected' })
    const { hasNormalizedTables, syncMemberClubs } = await import('../db/normalizedData.js')
    if (!(await hasNormalizedTables())) {
      return res.status(400).json({ error: 'Normalized tables required. Run migrate-to-normalized first.' })
    }
    const result = await syncMemberClubs()
    res.json({ ok: true, message: 'Member-club links synced', ...result })
  } catch (e) {
    console.error('sync-member-clubs:', e)
    res.status(500).json({ error: e.message })
  }
}
router.get('/sync-member-clubs', syncMemberClubsHandler)
router.post('/sync-member-clubs', syncMemberClubsHandler)

/** GET/POST /api/init-db/init-relational - تهيئة الجداول العلائقية الإضافية */
router.get('/init-relational', async (req, res) => {
  try {
    if (!isConnected()) return res.status(503).json({ error: 'Database not connected' })
    const { runInitRelational } = await import('../db/initRelational.js')
    const result = await runInitRelational()
    try {
      const { hasNormalizedTables, syncMemberClubs } = await import('../db/normalizedData.js')
      if (await hasNormalizedTables()) {
        const syncResult = await syncMemberClubs()
        if (syncResult.synced > 0) Object.assign(result, { memberClubsSynced: syncResult.synced })
      }
    } catch (syncErr) {
      console.warn('init-relational sync-member-clubs:', syncErr?.message)
    }
    res.json({ ok: true, message: 'Relational tables initialized', ...result })
  } catch (e) {
    console.error('init-relational:', e)
    res.status(500).json({ error: e.message })
  }
})
router.post('/init-relational', async (req, res) => {
  try {
    if (!isConnected()) return res.status(503).json({ error: 'Database not connected' })
    const { runInitRelational } = await import('../db/initRelational.js')
    const result = await runInitRelational()
    try {
      const { hasNormalizedTables, syncMemberClubs } = await import('../db/normalizedData.js')
      if (await hasNormalizedTables()) {
        const syncResult = await syncMemberClubs()
        if (syncResult.synced > 0) Object.assign(result, { memberClubsSynced: syncResult.synced })
      }
    } catch (syncErr) {
      console.warn('init-relational sync-member-clubs:', syncErr?.message)
    }
    res.json({ ok: true, message: 'Relational tables initialized', ...result })
  } catch (e) {
    console.error('init-relational:', e)
    res.status(500).json({ error: e.message })
  }
})

/** GET/POST /api/init-db/migrate-to-normalized - إنشاء الجداول المنظمة وترحيل البيانات من entities */
router.get('/migrate-to-normalized', async (req, res) => {
  try {
    if (!isConnected()) return res.status(503).json({ error: 'Database not connected' })
    const { migrateEntitiesToNormalized } = await import('../db/migrateToNormalized.js')
    const stats = await migrateEntitiesToNormalized()
    res.json({ ok: true, message: 'Migration completed', ...stats })
  } catch (e) {
    console.error('migrate-to-normalized:', e)
    res.status(500).json({ error: e.message })
  }
})
router.post('/migrate-to-normalized', async (req, res) => {
  try {
    if (!isConnected()) return res.status(503).json({ error: 'Database not connected' })
    const { migrateEntitiesToNormalized } = await import('../db/migrateToNormalized.js')
    const stats = await migrateEntitiesToNormalized()
    res.json({ ok: true, message: 'Migration completed', ...stats })
  } catch (e) {
    console.error('migrate-to-normalized:', e)
    res.status(500).json({ error: e.message })
  }
})

/** GET/POST /api/init-db/purge-soft-deleted - حذف نهائي للسجلات المحذوفة منذ أكثر من 3 أشهر */
router.get('/purge-soft-deleted', async (req, res) => {
  try {
    if (!isConnected()) return res.status(503).json({ error: 'Database not connected' })
    const { purgeSoftDeleted } = await import('../db/purgeSoftDeleted.js')
    const stats = await purgeSoftDeleted()
    res.json({ ok: true, message: 'Purge completed', ...stats })
  } catch (e) {
    console.error('purge-soft-deleted:', e)
    res.status(500).json({ error: e.message })
  }
})
router.post('/purge-soft-deleted', async (req, res) => {
  try {
    if (!isConnected()) return res.status(503).json({ error: 'Database not connected' })
    const { purgeSoftDeleted } = await import('../db/purgeSoftDeleted.js')
    const stats = await purgeSoftDeleted()
    res.json({ ok: true, message: 'Purge completed', ...stats })
  } catch (e) {
    console.error('purge-soft-deleted:', e)
    res.status(500).json({ error: e.message })
  }
})

/** POST /api/init-db/seed-platform-owner - Create super-admin when no admins */
router.post('/seed-platform-owner', async (req, res) => {
  try {
    const admins = await getEntities('platform_admin')
    if (admins.length > 0) {
      return res.json({ ok: true, message: 'Platform admins already exist' })
    }
    const defaultOwner = {
      id: 'super-admin-default',
      email: 'admin@playtix.app',
      password: 'Admin@123456',
      role: 'owner',
      permissions: ['all-clubs', 'manage-clubs', 'all-members', 'admin-users'],
      createdAt: new Date().toISOString()
    }
    await setEntities('platform_admin', [defaultOwner])
    res.json({ ok: true, message: 'Super admin (admin@playtix.app) created' })
  } catch (e) {
    console.error('seed-platform-owner:', e)
    res.status(500).json({ error: e.message })
  }
})

router.post('/', async (req, res) => {
  const secret = process.env.INIT_DB_SECRET
  if (secret && req.headers['x-init-secret'] !== secret) {
    return res.status(403).json({ error: 'Invalid or missing X-Init-Secret' })
  }
  try {
    for (let i = 0; i < STMTS.length; i++) {
      try {
        await query(STMTS[i])
      } catch (stmtErr) {
        console.error('init-db stmt', i, 'failed:', stmtErr.message)
        throw new Error(`Statement ${i + 1} failed: ${stmtErr.message}`)
      }
    }
    // Migrate app_store to entities + app_settings if entities empty
    const { rows: clubRows } = await query('SELECT COUNT(*) as n FROM entities WHERE entity_type = ?', ['club'])
    if (clubRows[0]?.n === 0) {
      const { rows: storeRows } = await query('SELECT `key`, value FROM app_store WHERE `key` IN (?, ?, ?, ?)', ['admin_clubs', 'all_members', 'padel_members', 'platform_admins'])
      const byType = { club: [], member: [], platform_admin: [] }
      const memberById = new Map()
      for (const r of storeRows) {
        const arr = Array.isArray(r.value) ? r.value : (typeof r.value === 'string' ? JSON.parse(r.value || '[]') : [])
        if (r.key === 'admin_clubs') byType.club = arr
        else if (r.key === 'platform_admins') byType.platform_admin = arr
        else if (r.key === 'all_members' || r.key === 'padel_members') {
          arr.forEach(m => { if (m?.id) memberById.set(m.id, { ...memberById.get(m.id), ...m }) })
        }
      }
      byType.member = Array.from(memberById.values())
      for (const [type, items] of Object.entries(byType)) {
        for (const item of items) {
          const id = (item?.id || 'item-' + Date.now()).toString()
          await query('INSERT IGNORE INTO entities (entity_type, entity_id, data) VALUES (?, ?, ?)', [type, id, JSON.stringify(item)])
        }
      }
      const { rows: settingsRows } = await query('SELECT `key`, value FROM app_store WHERE `key` IN (?, ?, ?, ?, ?, ?)', ['admin_settings', 'app_language', 'current_member_id', 'admin_current_club_id', 'bookings', 'password_reset_tokens'])
      for (const r of settingsRows) {
        await query('INSERT IGNORE INTO app_settings (`key`, value) VALUES (?, ?)', [r.key, JSON.stringify(r.value)])
      }
    }
    // لا إنشاء نوادي افتراضية — النظام يبدأ فارغاً
    const { rows: paRows } = await query('SELECT COUNT(*) as n FROM entities WHERE entity_type = ?', ['platform_admin'])
    if (paRows[0]?.n === 0) {
      const defaultOwner = {
        id: 'super-admin-default',
        email: 'admin@playtix.app',
        password: 'Admin@123456',
        role: 'owner',
        permissions: ['all-clubs', 'manage-clubs', 'all-members', 'admin-users'],
        createdAt: new Date().toISOString()
      }
      await query(
        'INSERT INTO entities (entity_type, entity_id, data) VALUES (?, ?, ?)',
        ['platform_admin', defaultOwner.id, JSON.stringify(defaultOwner)]
      )
    }
    try {
      const { migrateEntitiesToNormalized } = await import('../db/migrateToNormalized.js')
      await migrateEntitiesToNormalized()
    } catch (migErr) {
      console.warn('[init-db POST] migrate to normalized:', migErr.message)
    }
    try {
      const { runInitRelational } = await import('../db/initRelational.js')
      await runInitRelational()
    } catch (relErr) {
      console.warn('[init-db POST] init-relational:', relErr.message)
    }
    res.json({ ok: true, message: 'Database initialized successfully' })
  } catch (e) {
    console.error('init-db error:', e)
    res.status(500).json({
      error: e.message || 'Database init failed',
      hint: !process.env.DATABASE_URL ? 'Set DATABASE_URL in Hostinger env' : 'Check MySQL credentials and that DB exists'
    })
  }
})

export default router
