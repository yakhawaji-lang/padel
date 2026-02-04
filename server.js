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
// Copy redirect to root so Nginx serves it for /. SPA is at /app/.
const redirectPath = join(root, 'index.redirect.html')
const targets = [root, process.cwd()]
if (existsSync(join(process.cwd(), '..', 'public_html'))) targets.push(join(process.cwd(), '..', 'public_html'))
else if (existsSync(join(process.cwd(), 'public_html'))) targets.push(join(process.cwd(), 'public_html'))
if (existsSync(redirectPath)) {
  for (const dir of targets) {
    try {
      copyFileSync(redirectPath, join(dir, 'index.html'))
      console.log('[server.js] Redirect index ->', dir)
    } catch (e) {}
  }
}

// Copy dist to /app subdir so Nginx can serve SPA directly (avoids redirect loop).
// When user visits /app/, Nginx finds /app/index.html instead of falling back to root redirect.
if (existsSync(distIndex)) {
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
  for (const dir of targets) {
    copyDistToAppDir(dir)
  }
}

import('./server/index.js').catch(err => {
  console.error('[server.js] Failed to start:', err)
  process.exit(1)
})
