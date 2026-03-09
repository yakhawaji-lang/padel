/**
 * فحص سلامة قاعدة البيانات padel_db
 * يشغّل من جذر المشروع: node server/scripts/db-integrity-check.js
 * يتحقق من: member_clubs، club_bookings، وأي صفوف يتيمة أو غير متسقة.
 */
import { query } from '../db/pool.js'

async function run() {
  const issues = []
  const ok = []

  try {
    const normalized = await query('SELECT 1 FROM clubs LIMIT 1').then(() => true).catch(() => false)
    if (!normalized) {
      console.log('الجداول المنظمة غير موجودة. تشغيل المخطط أولاً.')
      process.exit(1)
    }

    const { rows: mcRows } = await query(`
      SELECT mc.member_id, mc.club_id
      FROM member_clubs mc
      LEFT JOIN members m ON m.id = mc.member_id AND m.deleted_at IS NULL
      LEFT JOIN clubs c ON c.id = mc.club_id AND c.deleted_at IS NULL
      WHERE m.id IS NULL OR c.id IS NULL
    `)
    if (mcRows.length > 0) {
      issues.push({ table: 'member_clubs', message: 'صفوف عضويات تشير لعضو أو نادي محذوف أو غير موجود', count: mcRows.length, sample: mcRows.slice(0, 3) })
    } else {
      const { rows: countMc } = await query('SELECT COUNT(*) as n FROM member_clubs')
      ok.push({ table: 'member_clubs', message: 'جميع الصفوف مرتبطة بأعضاء ونوادي موجودين', count: countMc[0]?.n ?? 0 })
    }

    const { rows: cbOrphan } = await query(`
      SELECT cb.id, cb.club_id
      FROM club_bookings cb
      LEFT JOIN clubs c ON c.id = cb.club_id AND c.deleted_at IS NULL
      WHERE c.id IS NULL AND cb.deleted_at IS NULL
    `)
    if (cbOrphan.length > 0) {
      issues.push({ table: 'club_bookings', message: 'حجوزات لنوادي محذوفة أو غير موجودة', count: cbOrphan.length, sample: cbOrphan.slice(0, 3) })
    } else {
      const { rows: countCb } = await query('SELECT COUNT(*) as n FROM club_bookings WHERE deleted_at IS NULL')
      ok.push({ table: 'club_bookings', message: 'جميع الحجوزات النشطة مرتبطة بنوادي موجودة', count: countCb[0]?.n ?? 0 })
    }

    const { rows: locks } = await query('SELECT COUNT(*) as n FROM booking_slot_locks WHERE expires_at < NOW()')
    if (locks[0]?.n > 0) {
      ok.push({ table: 'booking_slot_locks', message: `${locks[0].n} قفل منتهي (يمكن تنظيفه بواسطة Cron)`, count: locks[0].n })
    }

    console.log('--- فحص السلامة (padel_db) ---\n')
    ok.forEach(o => console.log('✓', o.table, '—', o.message, o.count != null ? `(${o.count})` : ''))
    if (issues.length > 0) {
      console.log('\n--- مشاكل ---')
      issues.forEach(i => {
        console.log('✗', i.table, '—', i.message, `(${i.count})`)
        if (i.sample?.length) console.log('  عينة:', i.sample)
      })
      process.exit(1)
    }
    console.log('\nتم الفحص: لا توجد تناقضات.')
    process.exit(0)
  } catch (e) {
    console.error('فشل الفحص:', e?.message || e)
    process.exit(1)
  }
}

run()
