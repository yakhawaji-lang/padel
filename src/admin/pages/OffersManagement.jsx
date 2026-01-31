import React, { useState, useEffect } from 'react'
import './OffersManagement.css'
import '../pages/common.css'

const defaultOfferForm = () => ({
  title: '',
  titleAr: '',
  description: '',
  descriptionAr: '',
  discount: '',
  validUntil: '',
  image: ''
})

const OffersManagement = ({ currentClub, clubs, onUpdateClub }) => {
  const [offers, setOffers] = useState(currentClub?.offers || [])
  const [showModal, setShowModal] = useState(false)
  const [editingOffer, setEditingOffer] = useState(null)
  const [formData, setFormData] = useState(defaultOfferForm())
  const [filterStatus, setFilterStatus] = useState('all') // 'all' | 'active' | 'expired'

  useEffect(() => {
    setOffers(currentClub?.offers || [])
  }, [currentClub?.id, currentClub?.offers])

  if (!currentClub) {
    return (
      <div className="admin-page">
        <div className="no-club-selected">
          <p>Please select a club first</p>
        </div>
      </div>
    )
  }

  const openCreate = () => {
    setEditingOffer(null)
    setFormData(defaultOfferForm())
    setShowModal(true)
  }

  const openEdit = (offer) => {
    setEditingOffer(offer)
    setFormData({
      title: offer.title || offer.name || '',
      titleAr: offer.titleAr || offer.nameAr || '',
      description: offer.description || '',
      descriptionAr: offer.descriptionAr || '',
      discount: offer.discount != null ? String(offer.discount) : '',
      validUntil: offer.validUntil || '',
      image: offer.image || ''
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
      alert('Offer title (English) is required.')
      return
    }
    const discountNum = formData.discount === '' ? null : parseInt(formData.discount, 10)
    if (formData.discount !== '' && (isNaN(discountNum) || discountNum < 0 || discountNum > 100)) {
      alert('Discount must be a number between 0 and 100.')
      return
    }
    const offerData = {
      id: editingOffer?.id || `offer-${Date.now()}`,
      name: title,
      title: title,
      titleAr: (formData.titleAr || '').trim() || undefined,
      nameAr: (formData.titleAr || '').trim() || undefined,
      description: (formData.description || '').trim() || undefined,
      descriptionAr: (formData.descriptionAr || '').trim() || undefined,
      discount: discountNum,
      validUntil: (formData.validUntil || '').trim() || undefined,
      image: (formData.image || '').trim() || undefined
    }
    let nextOffers
    if (editingOffer) {
      nextOffers = offers.map(o => o.id === editingOffer.id ? offerData : o)
    } else {
      nextOffers = [...offers, offerData]
    }
    setOffers(nextOffers)
    onUpdateClub({ offers: nextOffers })
    closeModal()
  }

  const handleDelete = (offer) => {
    if (!window.confirm('Are you sure you want to delete this offer?')) return
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

  const filteredOffers = offers.filter(o => {
    if (filterStatus === 'active') return !isExpired(o.validUntil)
    if (filterStatus === 'expired') return isExpired(o.validUntil)
    return true
  })

  return (
    <div className="admin-page">
      <div className="offers-management">
        <div className="offers-page-header">
          <div className="offers-header-top">
            <h2 className="page-title">
              {currentClub.logo && <img src={currentClub.logo} alt="" className="club-logo" />}
              Offers Management — {currentClub.name}
            </h2>
            <button type="button" className="btn-primary btn-create-offer" onClick={openCreate}>
              + Create Offer
            </button>
          </div>
          <div className="offers-filters">
            <span className="offers-filter-label">Filter:</span>
            <button
              type="button"
              className={`offers-filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
              onClick={() => setFilterStatus('all')}
            >
              All ({offers.length})
            </button>
            <button
              type="button"
              className={`offers-filter-btn ${filterStatus === 'active' ? 'active' : ''}`}
              onClick={() => setFilterStatus('active')}
            >
              Active
            </button>
            <button
              type="button"
              className={`offers-filter-btn ${filterStatus === 'expired' ? 'active' : ''}`}
              onClick={() => setFilterStatus('expired')}
            >
              Expired
            </button>
          </div>
        </div>

        <div className="offers-list">
          {filteredOffers.length === 0 ? (
            <div className="offers-empty-state">
              <p>
                {filterStatus === 'all'
                  ? 'No offers yet. Create your first offer to promote your club.'
                  : `No ${filterStatus} offers.`}
              </p>
              {filterStatus === 'all' && (
                <button type="button" className="btn-primary" onClick={openCreate}>
                  + Create Offer
                </button>
              )}
            </div>
          ) : (
            filteredOffers.map(offer => {
              const expired = isExpired(offer.validUntil)
              return (
                <div key={offer.id} className={`offer-card ${expired ? 'expired' : ''}`}>
                  {offer.image && (
                    <div className="offer-card-image-wrap">
                      <img src={offer.image} alt="" className="offer-card-image" />
                      {expired && <span className="offer-card-badge expired">Expired</span>}
                      {!expired && offer.discount != null && (
                        <span className="offer-card-badge discount">-{offer.discount}%</span>
                      )}
                    </div>
                  )}
                  {!offer.image && (
                    <div className="offer-card-no-image">
                      {expired && <span className="offer-card-badge expired">Expired</span>}
                      {!expired && offer.discount != null && (
                        <span className="offer-card-badge discount">-{offer.discount}%</span>
                      )}
                    </div>
                  )}
                  <div className="offer-card-body">
                    <h3 className="offer-card-title">{offer.title || offer.name}</h3>
                    {(offer.titleAr || offer.nameAr) && (
                      <p className="offer-card-title-ar">{offer.titleAr || offer.nameAr}</p>
                    )}
                    {(offer.description || offer.descriptionAr) && (
                      <p className="offer-card-desc">
                        {offer.description || offer.descriptionAr || ''}
                      </p>
                    )}
                    <div className="offer-card-meta">
                      {offer.discount != null && (
                        <span className="offer-meta-item">Discount: {offer.discount}%</span>
                      )}
                      {offer.validUntil && (
                        <span className="offer-meta-item">Valid until: {offer.validUntil}</span>
                      )}
                    </div>
                    <div className="offer-card-actions">
                      <button type="button" className="btn-secondary btn-small" onClick={() => openEdit(offer)}>
                        Edit
                      </button>
                      <button type="button" className="btn-danger btn-small" onClick={() => handleDelete(offer)}>
                        Delete
                      </button>
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
              <h3>{editingOffer ? 'Edit Offer' : 'Create Offer'}</h3>
              <button type="button" className="offers-modal-close" onClick={closeModal} aria-label="Close">×</button>
            </div>
            <div className="offers-modal-body">
              <div className="form-group">
                <label>Title (English) *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Summer Special"
                />
              </div>
              <div className="form-group">
                <label>Title (Arabic)</label>
                <input
                  type="text"
                  value={formData.titleAr}
                  onChange={e => setFormData({ ...formData, titleAr: e.target.value })}
                  placeholder="مثال: عرض الصيف"
                />
              </div>
              <div className="form-group">
                <label>Description (English)</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Short description of the offer"
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>Description (Arabic)</label>
                <textarea
                  value={formData.descriptionAr}
                  onChange={e => setFormData({ ...formData, descriptionAr: e.target.value })}
                  placeholder="وصف قصير للعرض"
                  rows={3}
                />
              </div>
              <div className="form-row two-cols">
                <div className="form-group">
                  <label>Discount (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={formData.discount}
                    onChange={e => setFormData({ ...formData, discount: e.target.value })}
                    placeholder="e.g. 20"
                  />
                </div>
                <div className="form-group">
                  <label>Valid Until (date)</label>
                  <input
                    type="date"
                    value={formData.validUntil}
                    onChange={e => setFormData({ ...formData, validUntil: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Image URL (optional)</label>
                <input
                  type="url"
                  value={formData.image}
                  onChange={e => setFormData({ ...formData, image: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className="offers-modal-footer">
              <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
              <button type="button" className="btn-primary" onClick={handleSave}>
                {editingOffer ? 'Save Changes' : 'Create Offer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default OffersManagement
