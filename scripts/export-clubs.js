/**
 * تصدير بيانات النوادي من Supabase إلى ملف data/seed-clubs.json
 * يشغّل من جذر المشروع: node scripts/export-clubs.js
 * يتطلّب .env.local مع VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function loadEnv() {
  const envPath = path.join(root, '.env.local')
  if (!fs.existsSync(envPath)) {
    console.warn('.env.local not found. Create it with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
    return {}
  }
  const content = fs.readFileSync(envPath, 'utf8')
  const env = {}
  content.split('\n').forEach(line => {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  })
  return env
}

async function main() {
  const env = loadEnv()
  const url = env.VITE_SUPABASE_URL
  const key = env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
    process.exit(1)
  }

  const apiUrl = `${url.replace(/\/$/, '')}/rest/v1/app_store?key=eq.admin_clubs&select=value`
  const res = await fetch(apiUrl, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    }
  })
  if (!res.ok) {
    console.error('Supabase request failed:', res.status, await res.text())
    process.exit(1)
  }
  const rows = await res.json()
  const value = rows?.[0]?.value
  const clubs = Array.isArray(value) ? value : []

  const dataDir = path.join(root, 'data')
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  const outPath = path.join(dataDir, 'seed-clubs.json')
  fs.writeFileSync(outPath, JSON.stringify(clubs, null, 2), 'utf8')
  console.log('Exported', clubs.length, 'clubs to', outPath)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
