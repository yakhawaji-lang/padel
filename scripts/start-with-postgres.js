#!/usr/bin/env node
/**
 * Start server + frontend together for Postgres mode
 * Run: node scripts/start-with-postgres.js
 * Or: npm run postgres:dev
 */

import { spawn } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

console.log('Starting Padel with PostgreSQL...')
console.log('  Server (API): http://localhost:4000')
console.log('  Frontend:     http://localhost:3000')
console.log('Press Ctrl+C to stop both.\n')

const server = spawn('npm', ['run', 'dev'], { cwd: join(root, 'server'), stdio: 'inherit', shell: true })
const dev = spawn('npm', ['run', 'dev'], { cwd: root, stdio: 'inherit', shell: true })

function killAll() {
  server.kill('SIGTERM')
  dev.kill('SIGTERM')
  process.exit(0)
}

process.on('SIGINT', killAll)
process.on('SIGTERM', killAll)
