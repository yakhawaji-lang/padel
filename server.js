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
// Copy built files to root so Hostinger/Nginx serves them (index + assets + logo)
if (existsSync(distIndex)) {
  try {
    copyFileSync(distIndex, join(root, 'index.html'))
    const assetsSrc = join(distPath, 'assets')
    const assetsDst = join(root, 'assets')
    if (existsSync(assetsSrc)) {
      mkdirSync(assetsDst, { recursive: true })
      for (const f of readdirSync(assetsSrc)) {
        copyFileSync(join(assetsSrc, f), join(assetsDst, f))
      }
    }
    const logo = join(distPath, 'logo-playtix.png')
    if (existsSync(logo)) copyFileSync(logo, join(root, 'logo-playtix.png'))
    console.log('[server.js] Copied dist/ to root for Nginx static serving')
  } catch (e) {
    console.warn('[server.js] Could not copy to root:', e.message)
  }
}

import('./server/index.js').catch(err => {
  console.error('[server.js] Failed to start:', err)
  process.exit(1)
})
