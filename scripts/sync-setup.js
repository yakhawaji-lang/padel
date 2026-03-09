#!/usr/bin/env node
/**
 * إعداد متغيرات البيئة للمزامنة ثنائية الاتجاه
 * يضيف DATABASE_URL_CLOUD إلى .env.local إذا لم يكن موجوداً
 *
 * الاستخدام: npm run sync:setup
 */
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const envLocalPath = join(root, '.env.local')
const envExamplePath = join(root, '.env.example')

const SYNC_COMMENT = `
# مزامنة ثنائية الاتجاه (sync-to-cloud / sync-from-cloud):
# أزل التعليق وضَع رابط Neon من لوحة التحكم
# DATABASE_URL_CLOUD=postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`

function main() {
  console.log('=== إعداد المزامنة ثنائية الاتجاه ===\n')

  let content = ''
  if (existsSync(envLocalPath)) {
    content = readFileSync(envLocalPath, 'utf8')
  } else if (existsSync(envExamplePath)) {
    content = readFileSync(envExamplePath, 'utf8')
    writeFileSync(envLocalPath, content.trim() + '\n')
    console.log('تم إنشاء .env.local من .env.example')
  } else {
    content = '# Padel Platform\nDATABASE_URL=postgresql://postgres:postgres@localhost:5432/padel' + SYNC_COMMENT + '\n'
    writeFileSync(envLocalPath, content.trim() + '\n')
    console.log('تم إنشاء .env.local')
  }

  if (!content.includes('DATABASE_URL_CLOUD')) {
    const updated = content.trim() + SYNC_COMMENT + '\n'
    writeFileSync(envLocalPath, updated)
    console.log('تم إضافة DATABASE_URL_CLOUD (معطّل) إلى .env.local')
  } else {
    console.log('.env.local يحتوي بالفعل على DATABASE_URL_CLOUD')
  }

  console.log('\nالخطوات التالية:')
  console.log('  1. افتح .env.local')
  console.log('  2. أزل # من سطر DATABASE_URL_CLOUD وضع رابط Neon الحقيقي')
  console.log('  3. npm run sync-to-cloud   — من المحلي للسحابة')
  console.log('  4. npm run sync-from-cloud — من السحابة للمحلي')
}

main()
