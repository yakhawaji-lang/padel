/**
 * خدمة صور Gallery — يربط مجلد Gallery بقاعدة البيانات
 * GET /api/gallery/serve?path=clubs/club-123/logo/logo.png
 */
import { Router } from 'express'
import { existsSync } from 'fs'
import { join } from 'path'
import { getGalleryFilePath } from '../lib/galleryService.js'

const router = Router()

router.get('/serve', (req, res) => {
  try {
    const pathParam = req.query.path
    if (!pathParam || typeof pathParam !== 'string') {
      return res.status(400).json({ error: 'Missing path parameter' })
    }
    const decoded = decodeURIComponent(pathParam)
    if (decoded.includes('..') || decoded.startsWith('/')) {
      return res.status(400).json({ error: 'Invalid path' })
    }
    const fp = getGalleryFilePath(decoded)
    if (!existsSync(fp)) {
      return res.status(404).json({ error: 'Image not found' })
    }
    const ext = fp.split('.').pop()?.toLowerCase()
    const types = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' }
    const contentType = types[ext] || 'application/octet-stream'
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.sendFile(fp)
  } catch (e) {
    console.error('[gallery] serve error:', e)
    res.status(500).json({ error: e.message || 'Failed to serve image' })
  }
})

export default router
