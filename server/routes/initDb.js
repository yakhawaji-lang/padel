import { Router } from 'express'
import { query } from '../db/pool.js'
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
  `INSERT IGNORE INTO app_settings (\`key\`, value) VALUES ('app_language', '"en"')`
]

router.get('/', async (req, res) => {
  const hasDb = !!process.env.DATABASE_URL
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
      const { rows: clubCountRows } = await query('SELECT COUNT(*) as n FROM entities WHERE entity_type = ?', ['club'])
      if (clubCountRows[0]?.n === 0) {
        const halaPadel = {
          id: 'hala-padel',
          name: 'Hala Padel',
          nameAr: 'هلا بادل',
          tagline: 'Indoor courts • King of the Court & Social tournaments • For all levels',
          taglineAr: 'ملاعب داخلية • بطولات ملك الملعب وسوشيال • لجميع المستويات',
          address: 'Arid District, 11234, Riyadh',
          addressAr: 'حي العارض، 11234، الرياض',
          phone: '', email: '', website: 'https://playtomic.com/clubs/hala-padel',
          playtomicVenueId: 'hala-padel', playtomicApiKey: '',
          courts: [
            { id: 'court-1', name: 'Court 1', nameAr: 'الملعب 1', type: 'indoor' },
            { id: 'court-2', name: 'Court 2', nameAr: 'الملعب 2', type: 'indoor' },
            { id: 'court-3', name: 'Court 3', nameAr: 'الملعب 3', type: 'indoor' },
            { id: 'court-4', name: 'Court 4', nameAr: 'الملعب 4', type: 'indoor' }
          ],
          settings: { defaultLanguage: 'en', timezone: 'Asia/Riyadh', currency: 'SAR', bookingDuration: 60, maxBookingAdvance: 30, cancellationPolicy: 24, openingTime: '06:00', closingTime: '23:00' },
          tournaments: [], members: [], bookings: [], offers: [], accounting: [],
          tournamentTypes: [
            { id: 'king-of-court', name: 'King of the Court', nameAr: 'ملك الملعب', description: 'Winners stay on court', descriptionAr: 'الفائزون يبقون على الملعب' },
            { id: 'social', name: 'Social Tournament', nameAr: 'بطولة سوشيال', description: 'Round-robin format', descriptionAr: 'نظام دوري' }
          ],
          storeEnabled: false,
          store: { name: '', nameAr: '', categories: [], products: [], sales: [], inventoryMovements: [], offers: [], coupons: [], minStockAlert: 5 },
          tournamentData: { kingState: null, socialState: null, currentTournamentId: 1 },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        await query('INSERT IGNORE INTO entities (entity_type, entity_id, data) VALUES (?, ?, ?)', ['club', 'hala-padel', JSON.stringify(halaPadel)])
      }
      const { rows: paRows } = await query('SELECT COUNT(*) as n FROM entities WHERE entity_type = ?', ['platform_admin'])
      if (paRows[0]?.n === 0) {
        const defaultOwner = {
          id: 'platform-owner-default',
          email: '2@2.com',
          password: '123456',
          role: 'owner',
          permissions: ['all-clubs', 'manage-clubs', 'all-members', 'admin-users'],
          createdAt: new Date().toISOString()
        }
        await query('INSERT IGNORE INTO entities (entity_type, entity_id, data) VALUES (?, ?, ?)', ['platform_admin', defaultOwner.id, JSON.stringify(defaultOwner)])
      }
      return res.json({ ok: true, message: 'Database initialized successfully (via browser)' })
    } catch (e) {
      console.error('init-db GET error:', e)
      return res.status(500).json({ error: e.message })
    }
  }
  res.json({
    configured: hasDb,
    hint: !hasDb ? 'Add DATABASE_URL in Hostinger Environment Variables' : 'Add ?init=1 to URL to initialize tables from browser, or use POST'
  })
})

/** GET /api/init-db/tables - Verify all required tables exist */
router.get('/tables', async (req, res) => {
  try {
    if (!process.env.DATABASE_URL?.trim()) {
      return res.json({ ok: false, tables: [], hint: 'DATABASE_URL not set' })
    }
    const required = ['entities', 'app_settings', 'app_store', 'matches', 'member_stats', 'tournament_summaries']
    const results = []
    for (const t of required) {
      try {
        await query(`SELECT 1 FROM \`${t}\` LIMIT 1`)
        results.push({ name: t, exists: true })
      } catch (e) {
        results.push({ name: t, exists: false, error: e.message })
      }
    }
    const allOk = results.every(r => r.exists)
    res.json({ ok: allOk, tables: results, hint: allOk ? 'All tables ready' : 'Run POST /api/init-db to create missing tables' })
  } catch (e) {
    res.status(500).json({ ok: false, tables: [], error: e.message })
  }
})

/** POST /api/init-db/seed-platform-owner - Create default 2@2.com / 123456 when no admins */
router.post('/seed-platform-owner', async (req, res) => {
  try {
    const admins = await getEntities('platform_admin')
    if (admins.length > 0) {
      return res.json({ ok: true, message: 'Platform admins already exist' })
    }
    const defaultOwner = {
      id: 'platform-owner-default',
      email: '2@2.com',
      password: '123456',
      role: 'owner',
      permissions: ['all-clubs', 'manage-clubs', 'all-members', 'admin-users'],
      createdAt: new Date().toISOString()
    }
    await setEntities('platform_admin', [defaultOwner])
    res.json({ ok: true, message: 'Default platform owner (2@2.com) created' })
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
    // If no clubs exist, insert default Hala Padel
    const { rows: clubCountRows } = await query('SELECT COUNT(*) as n FROM entities WHERE entity_type = ?', ['club'])
    if (clubCountRows[0]?.n === 0) {
      const halaPadel = {
        id: 'hala-padel',
        name: 'Hala Padel',
        nameAr: 'هلا بادل',
        tagline: 'Indoor courts • King of the Court & Social tournaments • For all levels',
        taglineAr: 'ملاعب داخلية • بطولات ملك الملعب وسوشيال • لجميع المستويات',
        address: 'Arid District, 11234, Riyadh',
        addressAr: 'حي العارض، 11234، الرياض',
        phone: '', email: '', website: 'https://playtomic.com/clubs/hala-padel',
        playtomicVenueId: 'hala-padel', playtomicApiKey: '',
        courts: [
          { id: 'court-1', name: 'Court 1', nameAr: 'الملعب 1', type: 'indoor' },
          { id: 'court-2', name: 'Court 2', nameAr: 'الملعب 2', type: 'indoor' },
          { id: 'court-3', name: 'Court 3', nameAr: 'الملعب 3', type: 'indoor' },
          { id: 'court-4', name: 'Court 4', nameAr: 'الملعب 4', type: 'indoor' }
        ],
        settings: { defaultLanguage: 'en', timezone: 'Asia/Riyadh', currency: 'SAR', bookingDuration: 60, maxBookingAdvance: 30, cancellationPolicy: 24, openingTime: '06:00', closingTime: '23:00' },
        tournaments: [], members: [], bookings: [], offers: [], accounting: [],
        tournamentTypes: [
          { id: 'king-of-court', name: 'King of the Court', nameAr: 'ملك الملعب', description: 'Winners stay on court', descriptionAr: 'الفائزون يبقون على الملعب' },
          { id: 'social', name: 'Social Tournament', nameAr: 'بطولة سوشيال', description: 'Round-robin format', descriptionAr: 'نظام دوري' }
        ],
        storeEnabled: false,
        store: { name: '', nameAr: '', categories: [], products: [], sales: [], inventoryMovements: [], offers: [], coupons: [], minStockAlert: 5 },
        tournamentData: { kingState: null, socialState: null, currentTournamentId: 1 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      await query('INSERT IGNORE INTO entities (entity_type, entity_id, data) VALUES (?, ?, ?)', ['club', 'hala-padel', JSON.stringify(halaPadel)])
      console.log('[init-db] Inserted default Hala Padel club')
    }
    // Ensure default platform owner 2@2.com / 123456 exists for admin login
    const { rows: paRows } = await query('SELECT COUNT(*) as n FROM entities WHERE entity_type = ?', ['platform_admin'])
    if (paRows[0]?.n === 0) {
      const defaultOwner = {
        id: 'platform-owner-default',
        email: '2@2.com',
        password: '123456',
        role: 'owner',
        permissions: ['all-clubs', 'manage-clubs', 'all-members', 'admin-users'],
        createdAt: new Date().toISOString()
      }
      await query(
        'INSERT IGNORE INTO entities (entity_type, entity_id, data) VALUES (?, ?, ?)',
        ['platform_admin', defaultOwner.id, JSON.stringify(defaultOwner)]
      )
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
