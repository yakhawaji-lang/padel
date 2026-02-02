#!/usr/bin/env node
/**
 * Postgres setup script - Creates .env.local and initializes database
 * Run: node scripts/postgres-setup.js
 * Or: npm run postgres:setup
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const envLocalPath = join(root, '.env.local')
const envExamplePath = join(root, '.env.example')

// Default connection string for local PostgreSQL
const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/padel'

function main() {
  console.log('=== Postgres Setup for Padel Platform ===\n')

  // 1. Create or update .env.local for Postgres
  let content = ''
  if (existsSync(envLocalPath)) {
    content = readFileSync(envLocalPath, 'utf8')
  } else if (existsSync(envExamplePath)) {
    content = readFileSync(envExamplePath, 'utf8')
  }
  const needsWrite = !existsSync(envLocalPath) ||
    !content.includes('VITE_USE_POSTGRES=true') ||
    (!content.match(/DATABASE_URL=.+/) && !process.env.DATABASE_URL)
  if (needsWrite) {
    if (!content.includes('VITE_USE_POSTGRES')) {
      content += '\n# PostgreSQL\nVITE_USE_POSTGRES=true\nDATABASE_URL=' + DEFAULT_DATABASE_URL + '\n'
    } else {
      content = content.replace(/VITE_USE_POSTGRES=false/, 'VITE_USE_POSTGRES=true')
      if (!content.match(/DATABASE_URL=.+/)) {
        content += '\nDATABASE_URL=' + DEFAULT_DATABASE_URL + '\n'
      }
    }
    writeFileSync(envLocalPath, content.trim() + '\n')
    console.log('Created/updated .env.local with VITE_USE_POSTGRES=true')
  } else {
    console.log('.env.local already configured')
  }

  // 2. Run db:init (loads DATABASE_URL from env or .env)
  console.log('\nInitializing database...')
  const init = spawn('npm', ['run', 'db:init'], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL || DEFAULT_DATABASE_URL }
  })

  init.on('close', (code) => {
    if (code !== 0) {
      console.warn('\nDatabase init may have failed. Ensure PostgreSQL is running and DATABASE_URL is correct.')
      console.warn('You can set DATABASE_URL in .env.local or run: set DATABASE_URL=postgresql://...')
    } else {
      console.log('\nDatabase initialized successfully.')
    }
    console.log('\nNext steps:')
    console.log('  1. npm run postgres:dev   - Start server + frontend (or run in two terminals: npm run server & npm run dev)')
  })
}

main()
