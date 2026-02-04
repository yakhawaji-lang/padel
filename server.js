/**
 * Hostinger entry point. Builds frontend if needed, then starts Express.
 */
import { execSync } from 'child_process'
import { existsSync, copyFileSync, mkdirSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distPath = join(__dirname, 'dist')
const distIndex = join(distPath, 'index.html')
const root = __dirname

console.log('[server.js] Starting...')

if (!existsSync(distIndex)) {
  try {
    console.log('[server.js] Building frontend...')
    execSync('npm run build', { stdio: 'inherit', cwd: root })
  } catch (err) {
    console.error('[server.js] Build failed:', err.message)
    console.log('[server.js] Starting API only (no frontend)')
  }
}
// Copy redirect only to public_html (Hostinger). Do NOT overwrite project root index.html (needed for Vite build).
const redirectPath = join(root, 'index.redirect.html')
const deployTargets = []
if (existsSync(join(process.cwd(), '..', 'public_html'))) deployTargets.push(join(process.cwd(), '..', 'public_html'))
else if (existsSync(join(process.cwd(), 'public_html'))) deployTargets.push(join(process.cwd(), 'public_html'))
if (existsSync(redirectPath) && deployTargets.length > 0) {
  for (const dir of deployTargets) {
    try {
      copyFileSync(redirectPath, join(dir, 'index.html'))
      console.log('[server.js] Redirect index ->', dir)
    } catch (e) {}
  }
}

// Copy dist to /app subdir for Hostinger/Nginx (when deployTargets exist).
// For local, Express serves directly from dist - no copy needed.
if (existsSync(distIndex) && deployTargets.length > 0) {
  function copyDistToAppDir(baseDir) {
    const appDir = join(baseDir, 'app')
    const appAssets = join(appDir, 'assets')
    try {
      mkdirSync(appAssets, { recursive: true })
      copyFileSync(distIndex, join(appDir, 'index.html'))
      for (const f of readdirSync(join(distPath, 'assets'))) {
        copyFileSync(join(distPath, 'assets', f), join(appAssets, f))
      }
      const logo = join(distPath, 'logo-playtix.png')
      if (existsSync(logo)) copyFileSync(logo, join(appDir, 'logo-playtix.png'))
      console.log('[server.js] SPA copied to', appDir)
      return true
    } catch (e) {
      console.warn('[server.js] Could not copy to app dir:', e.message)
      return false
    }
  }
  for (const dir of deployTargets) {
    copyDistToAppDir(dir)
  }
}

import('./server/index.js').catch(err => {
  console.error('[server.js] Failed to start:', err)
  process.exit(1)
})
