/**
 * Hostinger entry point. Builds frontend if needed, then starts Express.
 */
import { execSync } from 'child_process'
import { existsSync, copyFileSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distPath = join(__dirname, 'dist')
const distIndex = join(distPath, 'index.html')
const root = __dirname

console.log('[server.js] Starting... cwd=%s', process.cwd())

if (!existsSync(distIndex)) {
  try {
    console.log('[server.js] Building frontend...')
    execSync('npm run build', { stdio: 'inherit', cwd: root })
  } catch (err) {
    console.error('[server.js] Build failed:', err.message)
    console.log('[server.js] Starting API only (no frontend)')
  }
}
// Copy redirect + dist to public_html (Hostinger). Project runs from public_html.
// database.config.json stays in parent (domains/playtix.app/) outside public_html.
const redirectPath = join(root, 'index.redirect.html')
const deployTargets = []
const candidates = [
  join(root, '..', 'public_html'),      // project in public_html: root/../public_html = public_html
  join(root, '..', '..'),               // public_html/.builds/project/ -> public_html (Hostinger Node في .builds)
  join(process.cwd(), '..', 'public_html'),
  join(process.cwd(), 'public_html'),
  join(process.cwd(), '..', '..'),
  join(root, 'public_html')
]
for (const p of candidates) {
  if (!existsSync(p) || !statSync(p).isDirectory()) continue
  // عند استخدام root/../.. تأكد أنه public_html (يحتوي .htaccess أو .builds)
  if (p === join(root, '..', '..') || p === join(process.cwd(), '..', '..')) {
    if (!existsSync(join(p, '.htaccess')) && !existsSync(join(p, '.builds'))) continue
  }
  if (!deployTargets.includes(p)) deployTargets.push(p)
}
if (deployTargets.length > 0) {
  console.log('[server.js] public_html targets:', deployTargets)
}
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
    const srcAssets = join(distPath, 'assets')
    try {
      mkdirSync(appAssets, { recursive: true })
      copyFileSync(distIndex, join(appDir, 'index.html'))
      if (existsSync(srcAssets)) {
        for (const f of readdirSync(srcAssets)) {
          copyFileSync(join(srcAssets, f), join(appAssets, f))
        }
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

import('./server/index.js').then(() => {
  console.log('[server.js] Express app loaded successfully')
}).catch(err => {
  console.error('[server.js] Failed to start:', err?.message || err)
  console.error('[server.js] Stack:', err?.stack)
  process.exit(1)
})
