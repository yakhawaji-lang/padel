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
// Copy redirect to root so Nginx serves it for /. SPA is at /app/ served by Node.
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

import('./server/index.js').catch(err => {
  console.error('[server.js] Failed to start:', err)
  process.exit(1)
})
