/**
 * نسخ محتويات المشروع من nodejs إلى public_html
 * يشغّل تلقائياً بعد البناء (postbuild) على Hostinger
 */
import { cpSync, existsSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const target = join(root, '..', 'public_html')

if (!existsSync(target)) {
  console.log('[copy-to-public-html] public_html not found (local dev?) — skipping')
  process.exit(0)
}

const exclude = new Set(['node_modules', '.git', 'tmp'])
const items = readdirSync(root)

console.log('[copy-to-public-html] Copying from', root, 'to', target)

for (const name of items) {
  if (exclude.has(name)) continue
  const src = join(root, name)
  const dest = join(target, name)
  try {
    cpSync(src, dest, { recursive: true })
    console.log('  copied:', name)
  } catch (e) {
    console.warn('  skip', name, ':', e.message)
  }
}

console.log('[copy-to-public-html] Running npm install in public_html...')
try {
  execSync('npm install --omit=dev', { cwd: target, stdio: 'inherit' })
  console.log('[copy-to-public-html] Done. App will run from public_html.')
} catch (e) {
  console.warn('[copy-to-public-html] npm install failed:', e.message)
  console.log('[copy-to-public-html] Copy done. Run "npm install" in public_html manually.')
}
