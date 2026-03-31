import React, { useEffect, useMemo, useRef, useState } from 'react'
import { subscribeGlobalSaving } from '../api/dbClient'
import './GlobalSavingOverlay.css'

const SHOW_DELAY_MS = 180
const MIN_VISIBLE_MS = 550

function getUiLanguage() {
  if (typeof document === 'undefined') return 'en'
  const l = String(document.documentElement?.lang || 'en').toLowerCase()
  return l.startsWith('ar') ? 'ar' : 'en'
}

export default function GlobalSavingOverlay() {
  const [pendingCount, setPendingCount] = useState(0)
  const [visible, setVisible] = useState(false)
  const showTimerRef = useRef(null)
  const hideTimerRef = useRef(null)
  const visibleSinceRef = useRef(0)

  useEffect(() => {
    const unsubscribe = subscribeGlobalSaving((state) => {
      setPendingCount(state?.pendingCount || 0)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (pendingCount > 0) {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }
      if (!visible && !showTimerRef.current) {
        showTimerRef.current = setTimeout(() => {
          visibleSinceRef.current = Date.now()
          setVisible(true)
          showTimerRef.current = null
        }, SHOW_DELAY_MS)
      }
      return
    }

    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current)
      showTimerRef.current = null
    }
    if (!visible) return

    const elapsed = Date.now() - visibleSinceRef.current
    const waitMore = Math.max(0, MIN_VISIBLE_MS - elapsed)
    hideTimerRef.current = setTimeout(() => {
      setVisible(false)
      hideTimerRef.current = null
    }, waitMore)
  }, [pendingCount, visible])

  useEffect(() => {
    return () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [])

  const lang = getUiLanguage()
  const text = useMemo(() => {
    if (lang === 'ar') {
      return {
        title: 'لحظات من فضلك...',
        body: 'نُجهّز بياناتك الآن بعناية، وسيظهر كل شيء خلال ثوانٍ',
      }
    }
    return {
      title: 'Just a few moments, please...',
      body: 'We are carefully preparing your data, and it will be ready in seconds',
    }
  }, [lang])

  if (!visible) return null

  return (
    <div className="global-saving-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="global-saving-overlay__card">
        <span className="global-saving-overlay__spinner" aria-hidden />
        <div className="global-saving-overlay__content">
          <p className="global-saving-overlay__title">{text.title}</p>
          <p className="global-saving-overlay__body">{text.body}</p>
        </div>
      </div>
    </div>
  )
}
