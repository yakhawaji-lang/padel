import React, { useState, useEffect } from 'react'
import { useAdminPanel } from '../AdminPanelContext'
import { getStore, setStore } from '../../api/dbClient'
import './common.css'

const t = (en, ar, lang) => (lang === 'ar' ? ar : en)
const STORE_KEY = 'homepage_banner_phrase'

export default function BannerSettingsPage() {
  const { language = 'en' } = useAdminPanel()
  const [phraseAr, setPhraseAr] = useState('')
  const [phraseEn, setPhraseEn] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    getStore(STORE_KEY).then((v) => {
      if (v && typeof v === 'object') {
        setPhraseAr(v.ar || '')
        setPhraseEn(v.en || '')
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage(null)
    setSaving(true)
    try {
      await setStore(STORE_KEY, { ar: phraseAr.trim(), en: phraseEn.trim() })
      setMessage(language === 'ar' ? 'تم حفظ عبارة البنر بنجاح.' : 'Banner phrase saved successfully.')
    } catch (err) {
      setMessage(language === 'ar' ? 'فشل الحفظ.' : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const c = {
    title: t('Homepage banner', 'بنر الصفحة الرئيسية', language),
    intro: t('Promotional phrase shown on the main banner. Leave empty to use the default.', 'العبارة الدعائية على البنر. اتركها فارغة للنص الافتراضي.', language),
    phraseAr: t('Arabic phrase', 'العبارة بالعربية', language),
    phraseEn: t('English phrase', 'العبارة بالإنجليزية', language),
    save: t('Save', 'حفظ', language),
    saving: t('Saving...', 'جاري الحفظ...', language),
  }

  if (loading) {
    return <div className="main-admin-page" style={{ padding: 24 }}><p>{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p></div>
  }

  return (
    <div className="main-admin-page" style={{ padding: 24, maxWidth: 560 }}>
      <h1 className="main-admin-page-title" style={{ marginBottom: 8 }}>{c.title}</h1>
      <p style={{ color: '#64748b', marginBottom: 24, fontSize: '0.9rem' }}>{c.intro}</p>
      <form onSubmit={handleSubmit}>
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label htmlFor="banner-ar" style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>{c.phraseAr}</label>
          <input id="banner-ar" type="text" dir="rtl" value={phraseAr} onChange={(e) => setPhraseAr(e.target.value)} placeholder="منصتك الاحترافية لأندية البادل" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8 }} disabled={saving} />
        </div>
        <div className="form-group" style={{ marginBottom: 20 }}>
          <label htmlFor="banner-en" style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>{c.phraseEn}</label>
          <input id="banner-en" type="text" dir="ltr" value={phraseEn} onChange={(e) => setPhraseEn(e.target.value)} placeholder="Your professional padel club platform" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8 }} disabled={saving} />
        </div>
        {message && <p style={{ marginBottom: 16, color: '#059669', fontSize: '0.9rem' }}>{message}</p>}
        <button type="submit" disabled={saving} style={{ padding: '10px 20px', background: saving ? '#94a3b8' : '#0f172a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? c.saving : c.save}
        </button>
      </form>
    </div>
  )
}
