#!/usr/bin/env node
/**
 * Start server + frontend together for Postgres mode
 * Run: node scripts/start-with-postgres.js
 * Or: npm run postgres:dev
 */

import { spawn } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function loadEnv() {
  const env = { ...process.env }
  for (const f of ['.env.local', '.env']) {
    const p = join(root, f)
    if (existsSync(p)) {
      for (const line of readFileSync(p, 'utf8').split('\n')) {
        const m = line.match(/^\s*([^#=]+)=(.*)$/)
        if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
      }
    }
  }
  return env
}

console.log('Starting Padel with PostgreSQL...')
console.log('  Server (API): http://localhost:4000')
console.log('  Frontend:     http://localhost:3000')
console.log('Press Ctrl+C to stop both.\n')

const serverEnv = loadEnv()
if (!serverEnv.DATABASE_URL && !serverEnv.POSTGRES_URL) {
  serverEnv.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/padel'
  console.warn('DATABASE_URL not set, using default. Add to .env.local to customize.\n')
}

const server = spawn('npm', ['run', 'dev'], {
  cwd: join(root, 'server'),
  stdio: 'inherit',
  shell: true,
  env: serverEnv
})
const dev = spawn('npm', ['run', 'dev'], { cwd: root, stdio: 'inherit', shell: true })

function killAll() {
  server.kill('SIGTERM')
  dev.kill('SIGTERM')
  process.exit(0)
}

process.on('SIGINT', killAll)
process.on('SIGTERM', killAll)
