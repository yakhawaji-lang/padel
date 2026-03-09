/**
 * ربط مجلد Gallery بقاعدة البيانات
 * يحفظ الصور في Gallery ويخزن المسار في DB
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..', '..')
export const GALLERY_ROOT = join(root, 'Gallery')

const GALLERY_API_PREFIX = '/api/gallery/serve'

/** هل النص base64 data URL؟ */
export function isBase64Image(str) {
  return typeof str === 'string' && str.startsWith('data:image/')
}

/** استخراج الامتداد من base64 */
function getExtFromBase64(dataUrl) {
  const m = dataUrl.match(/^data:image\/(\w+);/)
  if (!m) return 'png'
  return m[1] === 'jpeg' ? 'jpg' : m[1]
}

/**
 * حفظ صورة base64 في Gallery وإرجاع مسار API
 * @param {string} base64Data - data:image/...;base64,...
 * @param {string} relativePath - مثل clubs/club-123/logo/logo.png
 * @returns {string} مسار API مثل /api/gallery/serve?path=clubs/club-123/logo/logo.png
 */
export function saveBase64ToGallery(base64Data, relativePath) {
  if (!base64Data || !isBase64Image(base64Data)) return null
  const m = base64Data.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!m) return null
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1]
  const buf = Buffer.from(m[2], 'base64')
  if (buf.length > 8 * 1024 * 1024) return null // max 8MB

  const safePath = relativePath.replace(/\.\./g, '').replace(/^\/+/, '')
  const fullPath = join(GALLERY_ROOT, safePath)
  const dir = dirname(fullPath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(fullPath, buf)
  return `${GALLERY_API_PREFIX}?path=${encodeURIComponent(safePath)}`
}

/**
 * حفظ شعار/بنر نادي في Gallery
 */
export function saveClubImageToGallery(clubId, type, base64Data, filename = null) {
  if (!clubId || !base64Data || !isBase64Image(base64Data)) return null
  const ext = getExtFromBase64(base64Data)
  const name = filename || `image.${ext}`
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const relativePath = `clubs/${String(clubId)}/${type}/${safeName}`
  return saveBase64ToGallery(base64Data, relativePath)
}

/**
 * حفظ صورة ملعب في Gallery
 */
export function saveCourtImageToGallery(clubId, courtId, base64Data) {
  if (!clubId || !courtId || !base64Data || !isBase64Image(base64Data)) return null
  const ext = getExtFromBase64(base64Data)
  const relativePath = `clubs/${String(clubId)}/courts/${String(courtId)}.${ext}`
  return saveBase64ToGallery(base64Data, relativePath)
}

/**
 * حفظ صورة عرض في Gallery
 */
export function saveOfferImageToGallery(clubId, offerId, base64Data) {
  if (!clubId || !offerId || !base64Data || !isBase64Image(base64Data)) return null
  const ext = getExtFromBase64(base64Data)
  const relativePath = `clubs/${String(clubId)}/offers/${String(offerId)}.${ext}`
  return saveBase64ToGallery(base64Data, relativePath)
}

/**
 * حفظ صورة منصة (homepage) في Gallery
 */
export function savePlatformImageToGallery(key, base64Data) {
  if (!key || !base64Data || !isBase64Image(base64Data)) return null
  const ext = getExtFromBase64(base64Data)
  const relativePath = `platform/homepage/${key}.${ext}`
  return saveBase64ToGallery(base64Data, relativePath)
}

/**
 * الحصول على المسار المطلق لملف في Gallery
 */
export function getGalleryFilePath(relativePath) {
  const safe = String(relativePath).replace(/\.\./g, '').replace(/^\/+/, '')
  return join(GALLERY_ROOT, safe)
}

/**
 * قراءة ملف من Gallery
 */
export function readGalleryFile(relativePath) {
  const fp = getGalleryFilePath(relativePath)
  if (!existsSync(fp)) return null
  return readFileSync(fp)
}
