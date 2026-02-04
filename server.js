/**
 * Hostinger entry point. Builds frontend if needed, then starts Express.
 */
import { execSync } from 'child_process'
import { existsSync, copyFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distPath = join(__dirname, 'dist')
const distIndex = join(distPath, 'index.html')

console.log('[server.js] Starting...')

if (!existsSync(distIndex)) {
  try {
    console.log('[server.js] Building frontend...')
    execSync('npm run build', { stdio: 'inherit', cwd: __dirname })
  } catch (err) {
    console.error('[server.js] Build failed:', err.message)
    console.log('[server.js] Starting API only (no frontend)')
  }
}
// Copy built index to root so Hostinger/Nginx serves correct file for /
if (existsSync(distIndex)) {
  try {
    copyFileSync(distIndex, join(__dirname, 'index.html'))
    console.log('[server.js] Copied dist/index.html to root for static serving')
  } catch (e) {
    console.warn('[server.js] Could not copy index:', e.message)
  }
}

import('./server/index.js').catch(err => {
  console.error('[server.js] Failed to start:', err)
  process.exit(1)
})
