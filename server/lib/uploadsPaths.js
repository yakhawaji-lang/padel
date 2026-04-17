/**
 * مسارات رفع الملفات الموحّدة — PlayTix uploads
 * PLAYTIX_UPLOADS_DIR: مسار مطلق اختياري (مثلاً على Hostinger خارج public_html)
 */
import { existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** جذر المستودع (مجلد يحتوي server/ و package.json) */
export const PROJECT_ROOT = join(__dirname, '..', '..')

/** مجلد المرفوعات الحالي (كل الصور/الملفات المرفوعة ديناميكياً) */
export function getUploadsRoot () {
  const env = process.env.PLAYTIX_UPLOADS_DIR
  if (env != null && String(env).trim() !== '') {
    return String(env).trim().replace(/\/+$/, '')
  }
  return join(PROJECT_ROOT, 'uploads')
}

/** مجلد Gallery القديم — للقراءة فقط عند عدم وجود الملف في uploads */
export function getLegacyGalleryRoot () {
  return join(PROJECT_ROOT, 'Gallery')
}

/** الجزء النسبي تحت uploads/ لكل مرفوعات النوادي (شعار، بنر، ملاعب، عروض) */
export const CLUB_UPLOADS_SEGMENT = 'clubs'

/**
 * هيكل موصى به:
 *   uploads/platform/homepage   — بنر ومعرض الصفحة الرئيسية
 *   uploads/platform/assets     — أصول المنصة (أعلام، إلخ) عبر الرفع لاحقاً
 *   uploads/platform/files      — ملفات عامة للمنصة (PDF، إلخ)
 *   uploads/clubs/<clubId>/...  — شعارات، بنرات، ملاعب، عروض (يُنشأ فرعياً عند الحفظ)
 *   uploads/system/temp         — مؤقت / معالجة لاحقة
 */
const ENSURE_SUBDIRS = [
  'platform/homepage',
  'platform/assets',
  'platform/files',
  CLUB_UPLOADS_SEGMENT,
  'system/temp'
]

export function ensureUploadDirectoryTree () {
  const root = getUploadsRoot()
  if (!existsSync(root)) mkdirSync(root, { recursive: true })
  for (const sub of ENSURE_SUBDIRS) {
    const p = join(root, sub)
    if (!existsSync(p)) mkdirSync(p, { recursive: true })
  }
}

/** يضمن وجود uploads/clubs قبل أي حفظ لنوادي (يُستدعى من مسار حفظ النوادي) */
export function ensureClubUploadsRoot () {
  const p = join(getUploadsRoot(), CLUB_UPLOADS_SEGMENT)
  if (!existsSync(p)) mkdirSync(p, { recursive: true })
}
