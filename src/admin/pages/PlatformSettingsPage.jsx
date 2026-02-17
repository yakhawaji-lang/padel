import React, { useState, useEffect } from 'react'
import { useAdminPanel } from '../AdminPanelContext'
import { getStore, setStore, uploadHomepageImage } from '../../api/dbClient'
import './common.css'

const t = (en, ar, lang) => (lang === 'ar' ? ar : en)
const BANNER_PHRASE_KEY = 'homepage_banner_phrase'
const GALLERY_KEYS = ['gallery-1', 'gallery-2', 'gallery-3', 'gallery-4', 'gallery-5', 'gallery-6']

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

export default function PlatformSettingsPage() {
  const { language = 'en' } = useAdminPanel()
  const [phraseAr, setPhraseAr] = useState('')
  const [phraseEn, setPhraseEn] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [messageError, setMessageError] = useState(false)
  const [uploading, setUploading] = useState(null)
  const [selectedBannerFile, setSelectedBannerFile] = useState(null)
  const [selectedGalleryFiles, setSelectedGalleryFiles] = useState({})

  useEffect(() => {
    getStore(BANNER_PHRASE_KEY).then((v) => {
      if (v && typeof v === 'object') {
        setPhraseAr(v.ar || '')
        setPhraseEn(v.en || '')
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const handleSavePhrase = async (e) => {
    e.preventDefault()
    setMessage(null)
    setMessageError(false)
    setSaving(true)
    try {
      await setStore(BANNER_PHRASE_KEY, { ar: phraseAr.trim(), en: phraseEn.trim() })
      setMessage(language === 'ar' ? 'تم الحفظ.' : 'Saved.')
    } catch (err) {
      setMessage(language === 'ar' ? 'فشل الحفظ.' : 'Save failed.')
      setMessageError(true)
    } finally {
      setSaving(false)
    }
  }

  const handleFileUpload = async (key, file) => {
    if (!file || !file.type.startsWith('image/')) return
    setUploading(key)
    setMessage(null)
    setMessageError(false)
    try {
      const dataUrl = await readFileAsDataUrl(file)
      if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
        throw new Error(language === 'ar' ? 'قراءة الملف فشلت.' : 'Failed to read file.')
      }
      await uploadHomepageImage(key, dataUrl)
      setMessage(language === 'ar' ? `تم رفع ${key}.` : `Uploaded ${key}.`)
      setMessageError(false)
      if (key === 'banner') setSelectedBannerFile(null)
      else setSelectedGalleryFiles((prev) => ({ ...prev, [key]: null }))
    } catch (err) {
      const msg = err?.message || (language === 'ar' ? 'فشل الرفع.' : 'Upload failed.')
      setMessage(msg)
      setMessageError(true)
    } finally {
      setUploading(null)
    }
  }

  const c = {
    title: t('Settings', 'إعدادات', language),
    bannerTitle: t('Banner', 'البنر', language),
    bannerIntro: t('Promotional phrase and image for the main homepage banner.', 'العبارة الدعائية وصورة البنر الرئيسي.', language),
    phraseAr: t('Arabic phrase', 'العبارة بالعربية', language),
    phraseEn: t('English phrase', 'العبارة بالإنجليزية', language),
    uploadBanner: t('Upload banner image', 'رفع صورة البنر', language),
    experienceTitle: t('Experience PlayTix', 'لحظات من PlayTix', language),
    experienceIntro: t('Images for the gallery section (6 images).', 'صور قسم المعرض (6 صور).', language),
    upload: t('Upload', 'رفع', language),
    save: t('Save', 'حفظ', language),
    saving: t('Saving...', 'جاري الحفظ...', language),
  }

  if (loading) {
    return <div className="main-admin-page" style={{ padding: 24 }}><p>{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p></div>
  }

  return (
    <div className="main-admin-page" style={{ padding: 24, maxWidth: 640 }}>
      <h1 className="main-admin-page-title" style={{ marginBottom: 24 }}>{c.title}</h1>
      {message && <p style={{ marginBottom: 16, color: messageError ? '#dc2626' : '#059669', fontSize: '0.9rem' }}>{message}</p>}

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: '1.125rem', marginBottom: 8 }}>{c.bannerTitle}</h2>
        <p style={{ color: '#64748b', marginBottom: 16, fontSize: '0.9rem' }}>{c.bannerIntro}</p>
        <form onSubmit={handleSavePhrase}>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>{c.phraseAr}</label>
            <input type="text" dir="rtl" value={phraseAr} onChange={(e) => setPhraseAr(e.target.value)} placeholder="منصتك الاحترافية لأندية البادل" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8 }} disabled={saving} />
          </div>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>{c.phraseEn}</label>
            <input type="text" dir="ltr" value={phraseEn} onChange={(e) => setPhraseEn(e.target.value)} placeholder="Your professional padel club platform" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8 }} disabled={saving} />
          </div>
          <button type="submit" disabled={saving} style={{ padding: '8px 16px', background: saving ? '#94a3b8' : '#0f172a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', marginBottom: 16 }}>
            {saving ? c.saving : c.save}
          </button>
        </form>
        <div className="form-group">
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>{c.uploadBanner}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) setSelectedBannerFile(f); e.target.value = ''; }} disabled={!!uploading} />
            <button type="button" disabled={!selectedBannerFile || uploading === 'banner'} onClick={() => selectedBannerFile && handleFileUpload('banner', selectedBannerFile)} style={{ padding: '8px 16px', background: selectedBannerFile && uploading !== 'banner' ? '#0f172a' : '#94a3b8', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 500, cursor: selectedBannerFile && uploading !== 'banner' ? 'pointer' : 'not-allowed' }}>
              {uploading === 'banner' ? (language === 'ar' ? 'جاري الرفع...' : 'Uploading...') : c.upload}
            </button>
          </div>
          {selectedBannerFile && uploading !== 'banner' && <p style={{ marginTop: 6, fontSize: '0.85rem', color: '#64748b' }}>{selectedBannerFile.name}</p>}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: '1.125rem', marginBottom: 8 }}>{c.experienceTitle}</h2>
        <p style={{ color: '#64748b', marginBottom: 16, fontSize: '0.9rem' }}>{c.experienceIntro}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          {GALLERY_KEYS.map((key) => (
            <div key={key} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>{key}</label>
              <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) setSelectedGalleryFiles((prev) => ({ ...prev, [key]: f })); e.target.value = ''; }} disabled={!!uploading} style={{ fontSize: '0.85rem', marginBottom: 6 }} />
              <button type="button" disabled={!selectedGalleryFiles[key] || !!uploading} onClick={() => selectedGalleryFiles[key] && handleFileUpload(key, selectedGalleryFiles[key])} style={{ padding: '6px 12px', background: selectedGalleryFiles[key] && !uploading ? '#0f172a' : '#94a3b8', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 500, cursor: selectedGalleryFiles[key] && !uploading ? 'pointer' : 'not-allowed', fontSize: '0.85rem', width: '100%' }}>
                {uploading === key ? (language === 'ar' ? 'جاري الرفع...' : 'Uploading...') : c.upload}
              </button>
              {selectedGalleryFiles[key] && uploading !== key && <p style={{ marginTop: 6, fontSize: '0.8rem', color: '#64748b', wordBreak: 'break-all' }}>{selectedGalleryFiles[key].name}</p>}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
