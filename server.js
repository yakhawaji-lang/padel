/**
 * Hostinger entry point. Builds frontend if needed, then starts Express.
 */
import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distPath = join(__dirname, 'dist')
const distIndex = join(distPath, 'index.html')

console.log('[server.js] Starting...')

// Only build if DO_BUILD=1 (Hostinger may run build separately). Skip by default for fast startup.
if (process.env.DO_BUILD === '1' && !existsSync(distIndex)) {
  try {
    console.log('[server.js] Building frontend...')
    execSync('npm run build', { stdio: 'inherit', cwd: __dirname })
  } catch (err) {
    console.error('[server.js] Build failed:', err.message)
  }
} else if (!existsSync(distIndex)) {
  console.log('[server.js] No dist/, starting API only. Set DO_BUILD=1 to build.')
}

try {
  await import('./server/index.js')
} catch (err) {
  console.error('[server.js] Failed to start:', err)
  process.exit(1)
}
