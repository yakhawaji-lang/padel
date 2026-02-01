import React, { useState, useEffect } from 'react'
import './OffersManagement.css'
import '../pages/common.css'
import { getAppLanguage } from '../../storage/languageStorage'

const defaultOfferForm = () => ({
  title: '',
  titleAr: '',
  description: '',
  descriptionAr: '',
  discountType: 'percentage',
  discount: '',
  fixedAmount: '',
  validFrom: '',
  validUntil: '',
  image: '',
  active: true,
  order: 0
})

const OffersManagement = ({ currentClub, clubs, onUpdateClub, language: langProp }) => {
  const language = langProp || getAppLanguage()
  const [offers, setOffers] = useState(currentClub?.offers || [])
  const [showModal, setShowModal] = useState(false)
  const [editingOffer, setEditingOffer] = useState(null)
  const [formData, setFormData] = useState(defaultOfferForm())
  const [filterStatus, setFilterStatus] = useState('all') // 'all' | 'active' | 'expired'
  const [imageSource, setImageSource] = useState('url')

  useEffect(() => {
    setOffers(currentClub?.offers || [])
  }, [currentClub?.id, currentClub?.offers])

  if (!currentClub) {
    return (
      <div className="club-admin-page">
        <div className="offers-no-club">
          <p>{language === 'ar' ? 'يرجى اختيار نادي أولاً' : 'Please select a club first'}</p>
        </div>
      </div>
    )
  }

  const currency = currentClub?.settings?.currency || 'SAR'
  const t = {
    en: {
      title: 'Offers Management',
      subtitle: 'Create and manage promotional offers for your club',
      create: 'Create Offer',
      filter: 'Filter',
      all: 'All',
      active: 'Active',
      expired: 'Expired',
      noOffers: 'No offers yet.',
      noOffersHint: 'Create your first offer to promote your club on the public page.',
      edit: 'Edit',
      delete: 'Delete',
      editOffer: 'Edit Offer',
      createOffer: 'Create Offer',
      titleEn: 'Title (English)',
      titleAr: 'Title (Arabic)',
      description: 'Description',
      descriptionAr: 'Description (Arabic)',
      discountType: 'Discount type',
      percentage: 'Percentage',
      fixedAmount: 'Fixed amount',
      discount: 'Discount',
      validFrom: 'Valid from',
      validUntil: 'Valid until',
      image: 'Image',
      fromUrl: 'URL',
      fromDevice: 'From device',
      chooseImage: 'Choose image',
      active: 'Active',
      order: 'Display order',
      cancel: 'Cancel',
      save: 'Save',
      deleteConfirm: 'Are you sure you want to delete this offer?',
      stats: { total: 'Total', active: 'Active', expired: 'Expired' }
    },
    ar: {
      title: 'إدارة العروض',
      subtitle: 'إنشاء وإدارة العروض الترويجية للنادي',
      create: 'إنشاء عرض',
      filter: 'تصفية',
      all: 'الكل',
      active: 'نشط',
      expired: 'منتهي',
      noOffers: 'لا توجد عروض بعد.',
      noOffersHint: 'أنشئ أول عرض لترويج النادي على الصفحة العامة.',
      edit: 'تعديل',
      delete: 'حذف',
      editOffer: 'تعديل العرض',
      createOffer: 'إنشاء عرض',
      titleEn: 'العنوان (إنجليزي)',
      titleAr: 'العنوان (عربي)',
      description: 'الوصف',
      descriptionAr: 'الوصف (عربي)',
      discountType: 'نوع الخصم',
      percentage: 'نسبة مئوية',
      fixedAmount: 'مبلغ ثابت',
      discount: 'الخصم',
      validFrom: 'صالح من',
      validUntil: 'صالح حتى',
      image: 'الصورة',
      fromUrl: 'رابط',
      fromDevice: 'من الجهاز',
      chooseImage: 'اختر صورة',
      active: 'نشط',
      order: 'ترتيب العرض',
      cancel: 'إلغاء',
      save: 'حفظ',
      deleteConfirm: 'هل أنت متأكد من حذف هذا العرض؟',
      stats: { total: 'الإجمالي', active: 'نشط', expired: 'منتهي' }
    }
  }
  const c = t[language]

  const openCreate = () => {
    setEditingOffer(null)
    setFormData(defaultOfferForm())
    setImageSource('url')
    setShowModal(true)
  }

  const openEdit = (offer) => {
    setEditingOffer(offer)
    setImageSource(offer.image?.startsWith?.('data:') ? 'device' : 'url')
    setFormData({
      title: offer.title || offer.name || '',
      titleAr: offer.titleAr || offer.nameAr || '',
      description: offer.description || '',
      descriptionAr: offer.descriptionAr || '',
      discountType: offer.discountType || (offer.fixedAmount != null ? 'fixed' : 'percentage'),
      discount: offer.discount != null ? String(offer.discount) : '',
      fixedAmount: offer.fixedAmount != null ? String(offer.fixedAmount) : '',
      validFrom: offer.validFrom || '',
      validUntil: offer.validUntil || '',
      image: offer.image || '',
      active: offer.active !== false,
      order: offer.order ?? 0
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingOffer(null)
    setFormData(defaultOfferForm())
  }

  const handleSave = () => {
    const title = (formData.title || '').trim()
    if (!title) {
      alert(language === 'ar' ? 'العنوان (إنجليزي) مطلوب' : 'Offer title (English) is required.')
      return
    }
    const discountNum = formData.discountType === 'percentage' && formData.discount !== '' ? parseInt(formData.discount, 10) : null
    if (formData.discountType === 'percentage' && formData.discount !== '' && (isNaN(discountNum) || discountNum < 0 || discountNum > 100)) {
      alert(language === 'ar' ? 'الخصم يجب أن يكون بين 0 و 100' : 'Discount must be between 0 and 100.')
      return
    }
    const fixedNum = formData.discountType === 'fixed' && formData.fixedAmount !== ''
      ? parseFloat(formData.fixedAmount)
      : undefined
    const offerData = {
      id: editingOffer?.id || `offer-${Date.now()}`,
      name: title,
      title: title,
      titleAr: (formData.titleAr || '').trim() || undefined,
      nameAr: (formData.titleAr || '').trim() || undefined,
      description: (formData.description || '').trim() || undefined,
      descriptionAr: (formData.descriptionAr || '').trim() || undefined,
      discountType: formData.discountType || 'percentage',
      discount: discountNum,
      fixedAmount: fixedNum != null ? fixedNum : undefined,
      validFrom: (formData.validFrom || '').trim() || undefined,
      validUntil: (formData.validUntil || '').trim() || undefined,
      image: (formData.image || '').trim() || undefined,
      active: formData.active,
      order: Number(formData.order) || 0
    }
    let nextOffers
    if (editingOffer) {
      nextOffers = offers.map(o => o.id === editingOffer.id ? offerData : o)
    } else {
      nextOffers = [...offers, offerData]
    }
    nextOffers.sort((a, b) => (a.order || 0) - (b.order || 0))
    setOffers(nextOffers)
    onUpdateClub({ offers: nextOffers })
    closeModal()
  }

  const handleDelete = (offer) => {
    if (!window.confirm(c.deleteConfirm)) return
    const nextOffers = offers.filter(o => o.id !== offer.id)
    setOffers(nextOffers)
    onUpdateClub({ offers: nextOffers })
  }

  const isExpired = (validUntil) => {
    if (!validUntil) return false
    try {
      const end = new Date(validUntil)
      end.setHours(23, 59, 59, 999)
      return end < new Date()
    } catch (e) {
      return false
    }
  }

  const isActive = (offer) => {
    if (offer.active === false) return false
    if (offer.validFrom) {
      const start = new Date(offer.validFrom)
      start.setHours(0, 0, 0, 0)
      if (start > new Date()) return false
    }
    return !isExpired(offer.validUntil)
  }

  const filteredOffers = offers.filter(o => {
    if (filterStatus === 'active') return isActive(o)
    if (filterStatus === 'expired') return isExpired(o.validUntil)
    return true
  })

  const stats = {
    total: offers.length,
    active: offers.filter(o => isActive(o)).length,
    expired: offers.filter(o => isExpired(o.validUntil)).length
  }

  return (
    <div className="club-admin-page offers-management-page">
      <div className="offers-management">
        <div className="offers-page-header">
          <div className="offers-header-top">
            <div className="offers-title-wrap">
              <h2 className="page-title">
                {currentClub.logo && <img src={currentClub.logo} alt="" className="club-logo" />}
                {c.title} — {language === 'ar' && currentClub.nameAr ? currentClub.nameAr : currentClub.name}
              </h2>
              <p className="offers-subtitle">{c.subtitle}</p>
            </div>
            <button type="button" className="btn-primary btn-create-offer" onClick={openCreate}>
              + {c.create}
            </button>
          </div>
          <div className="offers-stats-row">
            <div className="offer-stat-card">
              <span className="offer-stat-value">{stats.total}</span>
              <span className="offer-stat-label">{c.stats.total}</span>
            </div>
            <div className="offer-stat-card active">
              <span className="offer-stat-value">{stats.active}</span>
              <span className="offer-stat-label">{c.stats.active}</span>
            </div>
            <div className="offer-stat-card expired">
              <span className="offer-stat-value">{stats.expired}</span>
              <span className="offer-stat-label">{c.stats.expired}</span>
            </div>
          </div>
          <div className="offers-filters">
            <span className="offers-filter-label">{c.filter}:</span>
            <button
              type="button"
              className={`offers-filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
              onClick={() => setFilterStatus('all')}
            >
              {c.all} ({offers.length})
            </button>
            <button
              type="button"
              className={`offers-filter-btn ${filterStatus === 'active' ? 'active' : ''}`}
              onClick={() => setFilterStatus('active')}
            >
              {c.active}
            </button>
            <button
              type="button"
              className={`offers-filter-btn ${filterStatus === 'expired' ? 'active' : ''}`}
              onClick={() => setFilterStatus('expired')}
            >
              {c.expired}
            </button>
          </div>
        </div>

        <div className="offers-list">
          {filteredOffers.length === 0 ? (
            <div className="offers-empty-state">
              <div className="offers-empty-icon">🎁</div>
              <p className="offers-empty-title">{c.noOffers}</p>
              <p className="offers-empty-hint">{c.noOffersHint}</p>
              {filterStatus === 'all' ? (
                <button type="button" className="btn-primary" onClick={openCreate}>+ {c.create}</button>
              ) : (
                <button type="button" className="btn-secondary" onClick={() => setFilterStatus('all')}>{c.all}</button>
              )}
            </div>
          ) : (
            filteredOffers.map(offer => {
              const expired = isExpired(offer.validUntil)
              const active = isActive(offer)
              const displayDiscount = offer.discountType === 'fixed' && offer.fixedAmount != null
                ? `${offer.fixedAmount} ${currency}`
                : offer.discount != null ? `${offer.discount}%` : null
              return (
                <div key={offer.id} className={`offer-card ${expired ? 'expired' : ''} ${!active ? 'inactive' : ''}`}>
                  <div className="offer-card-media">
                    {offer.image ? (
                      <img src={offer.image} alt="" className="offer-card-image" />
                    ) : (
                      <div className="offer-card-placeholder">
                        <span className="offer-placeholder-icon">🎯</span>
                      </div>
                    )}
                    <div className="offer-card-badges">
                      {expired && <span className="offer-badge expired">{c.expired}</span>}
                      {!expired && !offer.active && <span className="offer-badge inactive">{c.active}</span>}
                      {active && displayDiscount && <span className="offer-badge discount">−{displayDiscount}</span>}
                    </div>
                  </div>
                  <div className="offer-card-body">
                    <h3 className="offer-card-title">{language === 'ar' && (offer.titleAr || offer.nameAr) ? (offer.titleAr || offer.nameAr) : (offer.title || offer.name)}</h3>
                    {(offer.description || offer.descriptionAr) && (
                      <p className="offer-card-desc">
                        {language === 'ar' && offer.descriptionAr ? offer.descriptionAr : (offer.description || offer.descriptionAr)}
                      </p>
                    )}
                    <div className="offer-card-meta">
                      {displayDiscount && <span className="offer-meta-chip">{displayDiscount}</span>}
                      {offer.validFrom && <span className="offer-meta-chip">{c.validFrom} {offer.validFrom}</span>}
                      {offer.validUntil && <span className="offer-meta-chip">{c.validUntil} {offer.validUntil}</span>}
                    </div>
                    <div className="offer-card-actions">
                      <button type="button" className="btn-secondary btn-small" onClick={() => openEdit(offer)}>{c.edit}</button>
                      <button type="button" className="btn-danger btn-small" onClick={() => handleDelete(offer)}>{c.delete}</button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {showModal && (
        <div className="offers-modal-overlay" onClick={closeModal}>
          <div className="offers-modal" onClick={e => e.stopPropagation()}>
            <div className="offers-modal-header">
              <h3>{editingOffer ? c.editOffer : c.createOffer}</h3>
              <button type="button" className="offers-modal-close" onClick={closeModal} aria-label="Close">×</button>
            </div>
            <div className="offers-modal-body">
              <div className="form-group">
                <label>{c.titleEn} *</label>
                <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="e.g. Summer Special" />
              </div>
              <div className="form-group">
                <label>{c.titleAr}</label>
                <input type="text" value={formData.titleAr} onChange={e => setFormData({ ...formData, titleAr: e.target.value })} placeholder="مثال: عرض الصيف" />
              </div>
              <div className="form-group">
                <label>{c.description}</label>
                <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Short description" rows={2} />
              </div>
              <div className="form-group">
                <label>{c.descriptionAr}</label>
                <textarea value={formData.descriptionAr} onChange={e => setFormData({ ...formData, descriptionAr: e.target.value })} placeholder="وصف قصير" rows={2} />
              </div>
              <div className="form-group">
                <label>{c.discountType}</label>
                <select value={formData.discountType} onChange={e => setFormData({ ...formData, discountType: e.target.value })}>
                  <option value="percentage">{c.percentage}</option>
                  <option value="fixed">{c.fixedAmount}</option>
                </select>
              </div>
              {formData.discountType === 'percentage' ? (
                <div className="form-group">
                  <label>{c.discount} (%)</label>
                  <input type="number" min={0} max={100} value={formData.discount} onChange={e => setFormData({ ...formData, discount: e.target.value })} placeholder="20" />
                </div>
              ) : (
                <div className="form-group">
                  <label>{c.fixedAmount} ({currency})</label>
                  <input type="text" value={formData.fixedAmount} onChange={e => setFormData({ ...formData, fixedAmount: e.target.value })} placeholder="50" />
                </div>
              )}
              <div className="form-row two-cols">
                <div className="form-group">
                  <label>{c.validFrom}</label>
                  <input type="date" value={formData.validFrom} onChange={e => setFormData({ ...formData, validFrom: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>{c.validUntil}</label>
                  <input type="date" value={formData.validUntil} onChange={e => setFormData({ ...formData, validUntil: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>{c.image}</label>
                <div className="offers-image-source-tabs">
                  <button type="button" className={imageSource === 'url' ? 'active' : ''} onClick={() => setImageSource('url')}>{c.fromUrl}</button>
                  <button type="button" className={imageSource === 'device' ? 'active' : ''} onClick={() => setImageSource('device')}>{c.fromDevice}</button>
                </div>
                {imageSource === 'url' ? (
                  <input type="text" value={formData.image} onChange={e => setFormData({ ...formData, image: e.target.value })} placeholder="https://..." />
                ) : (
                  <div className="offers-image-upload">
                    <input type="file" accept="image/*" id="offer-img-upload" className="hidden-file" onChange={e => {
                      const file = e.target.files?.[0]
                      if (file?.type.startsWith?.('image/')) {
                        const r = new FileReader()
                        r.onload = () => setFormData(f => ({ ...f, image: r.result }))
                        r.readAsDataURL(file)
                      }
                      e.target.value = ''
                    }} />
                    <label htmlFor="offer-img-upload" className="offers-upload-label">{c.chooseImage}</label>
                    {formData.image?.startsWith?.('data:') && (
                      <div className="offers-image-preview">
                        <img src={formData.image} alt="" />
                        <button type="button" className="offers-remove-img" onClick={() => setFormData(f => ({ ...f, image: '' }))}>×</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="form-row two-cols">
                <div className="form-group">
                  <label>{c.order}</label>
                  <input type="number" min={0} value={formData.order} onChange={e => setFormData({ ...formData, order: e.target.value })} />
                </div>
                <div className="form-group offers-active-check">
                  <label><input type="checkbox" checked={formData.active} onChange={e => setFormData({ ...formData, active: e.target.checked })} /> {c.active}</label>
                </div>
              </div>
            </div>
            <div className="offers-modal-footer">
              <button type="button" className="btn-secondary" onClick={closeModal}>{c.cancel}</button>
              <button type="button" className="btn-primary" onClick={handleSave}>{c.save}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default OffersManagement
