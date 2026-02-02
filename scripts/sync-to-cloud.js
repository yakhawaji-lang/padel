#!/usr/bin/env node
/**
 * مزامنة البيانات من PostgreSQL المحلي إلى السحابة
 * يستخدم DATABASE_URL (محلي) و DATABASE_URL_CLOUD (سحابة)
 *
 * الاستخدام:
 *   DATABASE_URL=postgresql://...localhost... DATABASE_URL_CLOUD=postgresql://...neon... node scripts/sync-to-cloud.js
 */
import pg from 'pg'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env.local') })
config({ path: join(__dirname, '..', '.env') })

const localUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL
const cloudUrl = process.env.DATABASE_URL_CLOUD || process.env.POSTGRES_URL_CLOUD

if (!localUrl || !cloudUrl) {
  console.error('يحتاج: DATABASE_URL (محلي) و DATABASE_URL_CLOUD (سحابة)')
  console.error('مثال: DATABASE_URL_CLOUD=postgresql://user:pass@host/db node scripts/sync-to-cloud.js')
  process.exit(1)
}

const local = new pg.Client({ connectionString: localUrl })
const cloud = new pg.Client({ connectionString: cloudUrl, ssl: { rejectUnauthorized: false } })

async function ensureSchema(conn) {
  const schema = `
    CREATE TABLE IF NOT EXISTS app_store (key TEXT PRIMARY KEY, value JSONB NOT NULL DEFAULT '[]'::jsonb, updated_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS matches (id SERIAL PRIMARY KEY, club_id TEXT NOT NULL, tournament_type TEXT NOT NULL, tournament_id INTEGER NOT NULL, data JSONB NOT NULL, saved_at BIGINT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS member_stats (id SERIAL PRIMARY KEY, club_id TEXT NOT NULL, member_id TEXT NOT NULL, tournament_id INTEGER NOT NULL, data JSONB NOT NULL, saved_at BIGINT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS tournament_summaries (id SERIAL PRIMARY KEY, club_id TEXT NOT NULL, data JSONB NOT NULL, saved_at BIGINT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW());
  `
  for (const stmt of schema.split(';').filter(Boolean)) {
    await conn.query(stmt.trim())
  }
}

async function sync() {
  await local.connect()
  await cloud.connect()
  await ensureSchema(cloud)

  // app_store: upsert by key
  const { rows: storeRows } = await local.query('SELECT key, value, updated_at FROM app_store')
  for (const r of storeRows) {
    await cloud.query(
      `INSERT INTO app_store (key, value, updated_at) VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = $3`,
      [r.key, r.value, r.updated_at]
    )
  }
  console.log('✓ app_store:', storeRows.length, 'سجلات')

  // matches, member_stats, tournament_summaries: truncate and copy (لتجنب تكرار)
  const tables = [
    ['matches', 'club_id, tournament_type, tournament_id, data, saved_at'],
    ['member_stats', 'club_id, member_id, tournament_id, data, saved_at'],
    ['tournament_summaries', 'club_id, data, saved_at']
  ]
  for (const [table, cols] of tables) {
    const { rows } = await local.query(`SELECT ${cols} FROM ${table}`)
    await cloud.query(`TRUNCATE ${table} RESTART IDENTITY CASCADE`)
    for (const r of rows) {
      const colsArr = cols.split(', ')
      const placeholders = colsArr.map((_, i) => `$${i + 1}`).join(', ')
      await cloud.query(
        `INSERT INTO ${table} (${cols}) VALUES (${placeholders})`,
        colsArr.map(c => r[c])
      )
    }
    console.log('✓', table + ':', rows.length, 'سجلات')
  }

  await local.end()
  await cloud.end()
  console.log('\nتمت المزامنة بنجاح إلى السحابة.')
}

sync().catch(e => {
  console.error(e)
  process.exit(1)
})
