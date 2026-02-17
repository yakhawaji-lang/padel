/**
 * Upload homepage images (banner, gallery) - base64 JSON body.
 * Allowed keys: banner, gallery-1, gallery-2, gallery-3, gallery-4, gallery-5, gallery-6
 */
import { Router } from 'express'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..', '..')
const HOMEPAGE_DIR = join(root, 'public', 'homepage')

const ALLOWED_KEYS = ['banner', 'gallery-1', 'gallery-2', 'gallery-3', 'gallery-4', 'gallery-5', 'gallery-6']

const router = Router()

router.post('/homepage-image', (req, res) => {
  try {
    const { key, image } = req.body || {}
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

    if (!existsSync(HOMEPAGE_DIR)) mkdirSync(HOMEPAGE_DIR, { recursive: true })
    const filePath = join(HOMEPAGE_DIR, `${key}.${ext}`)
    writeFileSync(filePath, buf)
    return res.json({ ok: true, path: `/homepage/${key}.${ext}` })
  } catch (e) {
    console.error('[settingsUpload]', e)
    return res.status(500).json({ error: e.message || 'Upload failed' })
  }
})

export default router
