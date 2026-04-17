/**
 * رفع صور الصفحة الرئيسية (بانر + معرض) — تُحفظ فقط في uploads/platform/homepage
 * ويُعاد مسار /api/gallery/serve?path=... للعرض وللحفظ في app_settings.
 */
import { Router } from 'express'
import { saveBase64ToGallery } from '../lib/galleryService.js'

const ALLOWED_KEYS = ['banner', 'gallery-1', 'gallery-2', 'gallery-3', 'gallery-4', 'gallery-5', 'gallery-6']

const router = Router()

router.post('/homepage-image', (req, res) => {
  try {
    const body = req.body
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Missing or invalid body (check Content-Type and size limit)' })
    }
    const { key, image } = body
    if (!key || !ALLOWED_KEYS.includes(key)) {
      return res.status(400).json({ error: 'Invalid key. Use: banner, gallery-1, ... gallery-6' })
    }
    if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
      return res.status(400).json({ error: 'image must be a data URL (data:image/...;base64,...)' })
    }
    const match = image.match(/^data:image\/(\w+);base64,(.+)$/)
    if (!match) return res.status(400).json({ error: 'Invalid image data URL' })
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1]
    if (!['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
      return res.status(400).json({ error: 'Allowed formats: png, jpg, webp' })
    }
    const buf = Buffer.from(match[2], 'base64')
    if (buf.length > 8 * 1024 * 1024) return res.status(400).json({ error: 'Image too large (max 8MB)' })

    const relativePath = `platform/homepage/${key}.${ext}`
    const apiPath = saveBase64ToGallery(image, relativePath)
    if (!apiPath) {
      return res.status(500).json({ error: 'Failed to save image' })
    }
    console.log('[settingsUpload] Saved', relativePath, '→ uploads')
    return res.json({ ok: true, path: apiPath, relativePath })
  } catch (e) {
    console.error('[settingsUpload]', e)
    return res.status(500).json({ error: e.message || 'Upload failed' })
  }
})

export default router
