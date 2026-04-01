/**
 * إعداد ملفات public_html للنشر اليدوي على Hostinger
 * يشغّل البناء ثم ينسخ الملفات إلى deploy-public_html/
 * ارفع محتويات هذا المجلد إلى public_html في Hostinger
 *
 * الاستخدام: npm run prepare-public-html
 */
import { execSync } from 'child_process'
import { existsSync, copyFileSync, mkdirSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const distPath = join(root, 'dist')
const distIndex = join(distPath, 'index.html')
const outputDir = join(root, 'deploy-public_html')
const appSpaHtaccess = join(root, 'scripts', 'hostinger-app-spa.htaccess')

console.log('[prepare-public-html] Building...')
execSync('npm run build', { stdio: 'inherit', cwd: root })

if (!existsSync(distIndex)) {
  console.error('[prepare-public-html] Build failed - dist/index.html not found')
  process.exit(1)
}

console.log('[prepare-public-html] Copying to', outputDir)

// index.html في الجذر (تحويل إلى /app/)
const redirectPath = join(root, 'index.redirect.html')
mkdirSync(outputDir, { recursive: true })
copyFileSync(redirectPath, join(outputDir, 'index.html'))

// app/index.html و app/assets/
const appDir = join(outputDir, 'app')
const appAssets = join(appDir, 'assets')
const srcAssets = join(distPath, 'assets')
mkdirSync(appAssets, { recursive: true })
copyFileSync(distIndex, join(appDir, 'index.html'))
if (existsSync(srcAssets)) {
  for (const f of readdirSync(srcAssets)) {
    copyFileSync(join(srcAssets, f), join(appAssets, f))
  }
}
const logo = join(distPath, 'logo-playtix.png')
if (existsSync(logo)) copyFileSync(logo, join(appDir, 'logo-playtix.png'))
const swSrc = join(distPath, 'sw.js')
if (existsSync(swSrc)) {
  copyFileSync(swSrc, join(appDir, 'sw.js'))
  console.log('[prepare-public-html] Copied app/sw.js (Web Push)')
} else {
  console.warn('[prepare-public-html] dist/sw.js missing — Web Push will fail until build outputs it')
}
if (existsSync(appSpaHtaccess)) {
  copyFileSync(appSpaHtaccess, join(appDir, '.htaccess'))
  console.log('[prepare-public-html] Wrote app/.htaccess (SPA + DirectoryIndex)')
}

console.log('[prepare-public-html] Done! Upload contents of deploy-public_html/ to Hostinger public_html')
console.log('  Path:', outputDir)
