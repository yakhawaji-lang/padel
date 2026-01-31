import React, { useState, useEffect } from 'react'
import '../pages/common.css'
import './ClubStoreManagement.css'

const defaultStore = () => ({ name: '', nameAr: '', categories: [], products: [] })

const ClubStoreManagement = ({ club, language: langProp, onUpdateClub }) => {
  const [activeTab, setActiveTab] = useState('info') // 'info' | 'categories' | 'products'
  const [store, setStore] = useState(() => club?.store || defaultStore())
  const [categoryForm, setCategoryForm] = useState({ name: '', nameAr: '', order: 0 })
  const [productForm, setProductForm] = useState({ categoryId: '', name: '', nameAr: '', description: '', descriptionAr: '', price: '', image: '', order: 0 })
  const [editingCategory, setEditingCategory] = useState(null)
  const [editingProduct, setEditingProduct] = useState(null)
  const language = langProp || localStorage.getItem(`club_${club?.id}_language`) || 'en'

  useEffect(() => {
    setStore(club?.store ? { ...defaultStore(), ...club.store, categories: club.store.categories || [], products: club.store.products || [] } : defaultStore())
  }, [club?.id, club?.store])

  const saveStore = (updates) => {
    const next = { ...store, ...updates }
    setStore(next)
    onUpdateClub({ store: next })
  }

  const addCategory = () => {
    if (!categoryForm.name?.trim()) return
    const id = `cat-${Date.now()}`
    const cat = { id, name: categoryForm.name.trim(), nameAr: (categoryForm.nameAr || '').trim(), order: Number(categoryForm.order) || 0 }
    saveStore({ categories: [...(store.categories || []), cat].sort((a, b) => (a.order || 0) - (b.order || 0)) })
    setCategoryForm({ name: '', nameAr: '', order: (store.categories?.length || 0) })
    setEditingCategory(null)
  }

  const updateCategory = (id) => {
    const cats = (store.categories || []).map(c => c.id === id ? { ...c, name: categoryForm.name?.trim() || c.name, nameAr: (categoryForm.nameAr || '').trim(), order: Number(categoryForm.order) ?? c.order } : c)
    saveStore({ categories: cats.sort((a, b) => (a.order || 0) - (b.order || 0)) })
    setCategoryForm({ name: '', nameAr: '', order: 0 })
    setEditingCategory(null)
  }

  const deleteCategory = (id) => {
    const cats = (store.categories || []).filter(c => c.id !== id)
    const products = (store.products || []).map(p => p.categoryId === id ? { ...p, categoryId: '' } : p)
    saveStore({ categories: cats, products })
    setEditingCategory(null)
  }

  const addProduct = () => {
    if (!productForm.name?.trim()) return
    const id = `prod-${Date.now()}`
    const prod = {
      id,
      categoryId: (productForm.categoryId || '').trim() || undefined,
      name: productForm.name.trim(),
      nameAr: (productForm.nameAr || '').trim(),
      description: (productForm.description || '').trim(),
      descriptionAr: (productForm.descriptionAr || '').trim(),
      price: String(productForm.price || '').trim(),
      image: (productForm.image || '').trim() || undefined,
      order: Number(productForm.order) || 0
    }
    saveStore({ products: [...(store.products || []), prod].sort((a, b) => (a.order || 0) - (b.order || 0)) })
    setProductForm({ categoryId: '', name: '', nameAr: '', description: '', descriptionAr: '', price: '', image: '', order: (store.products?.length || 0) })
    setEditingProduct(null)
  }

  const updateProduct = (id) => {
    const prods = (store.products || []).map(p => {
      if (p.id !== id) return p
      return {
        ...p,
        categoryId: (productForm.categoryId || '').trim() || undefined,
        name: productForm.name?.trim() || p.name,
        nameAr: (productForm.nameAr || '').trim(),
        description: (productForm.description || '').trim(),
        descriptionAr: (productForm.descriptionAr || '').trim(),
        price: String(productForm.price || '').trim(),
        image: (productForm.image || '').trim() || undefined,
        order: Number(productForm.order) ?? p.order
      }
    })
    saveStore({ products: prods.sort((a, b) => (a.order || 0) - (b.order || 0)) })
    setProductForm({ categoryId: '', name: '', nameAr: '', description: '', descriptionAr: '', price: '', image: '', order: 0 })
    setEditingProduct(null)
  }

  const deleteProduct = (id) => {
    saveStore({ products: (store.products || []).filter(p => p.id !== id) })
    setEditingProduct(null)
  }

  const startEditCategory = (cat) => {
    setEditingCategory(cat.id)
    setCategoryForm({ name: cat.name || '', nameAr: cat.nameAr || '', order: cat.order ?? 0 })
  }

  const startEditProduct = (prod) => {
    setEditingProduct(prod.id)
    setProductForm({
      categoryId: prod.categoryId || '',
      name: prod.name || '',
      nameAr: prod.nameAr || '',
      description: prod.description || '',
      descriptionAr: prod.descriptionAr || '',
      price: prod.price ?? '',
      image: prod.image || '',
      order: prod.order ?? 0
    })
  }

  const t = {
    en: {
      title: 'Sales / Store',
      storeInfo: 'Store info',
      storeName: 'Store name (English)',
      storeNameAr: 'Store name (Arabic)',
      categories: 'Categories',
      products: 'Products',
      addCategory: 'Add category',
      addProduct: 'Add product',
      name: 'Name',
      nameAr: 'Name (Arabic)',
      order: 'Order',
      description: 'Description',
      descriptionAr: 'Description (Arabic)',
      price: 'Price (SAR)',
      image: 'Image URL',
      category: 'Category',
      noCategory: '— No category —',
      save: 'Save',
      cancel: 'Cancel',
      edit: 'Edit',
      delete: 'Delete',
      noCategories: 'No categories yet. Add one to organize products.',
      noProducts: 'No products yet. Add your first product.',
      storeEnabledNote: 'Store visibility is controlled from All Clubs Dashboard (enable/disable per club).'
    },
    ar: {
      title: 'المبيعات / المتجر',
      storeInfo: 'معلومات المتجر',
      storeName: 'اسم المتجر (إنجليزي)',
      storeNameAr: 'اسم المتجر (عربي)',
      categories: 'التصنيفات',
      products: 'المنتجات',
      addCategory: 'إضافة تصنيف',
      addProduct: 'إضافة منتج',
      name: 'الاسم',
      nameAr: 'الاسم (عربي)',
      order: 'الترتيب',
      description: 'الوصف',
      descriptionAr: 'الوصف (عربي)',
      price: 'السعر (ر.س)',
      image: 'رابط الصورة',
      category: 'التصنيف',
      noCategory: '— بدون تصنيف —',
      save: 'حفظ',
      cancel: 'إلغاء',
      edit: 'تعديل',
      delete: 'حذف',
      noCategories: 'لا توجد تصنيفات. أضف تصنيفاً لتنظيم المنتجات.',
      noProducts: 'لا توجد منتجات. أضف أول منتج.',
      storeEnabledNote: 'إظهار المتجر يُتحكم به من لوحة جميع الأندية (تفعيل/إلغاء لكل نادي).'
    }
  }
  const c = t[language]

  if (!club) return <div className="club-admin-page">Loading...</div>

  const categories = store.categories || []
  const products = store.products || []

  return (
    <div className="club-admin-page club-store-management">
      <div className="store-page-header">
        <h2 className="page-title">{club.logo && <img src={club.logo} alt="" className="club-logo" />}{c.title} – {club.name}</h2>
      </div>

      <p className="store-enabled-note">{c.storeEnabledNote}</p>

      <div className="store-tabs">
        <button type="button" className={activeTab === 'info' ? 'active' : ''} onClick={() => setActiveTab('info')}>{c.storeInfo}</button>
        <button type="button" className={activeTab === 'categories' ? 'active' : ''} onClick={() => setActiveTab('categories')}>{c.categories}</button>
        <button type="button" className={activeTab === 'products' ? 'active' : ''} onClick={() => setActiveTab('products')}>{c.products}</button>
      </div>

      {activeTab === 'info' && (
        <div className="store-section">
          <div className="store-form-card">
            <h3>{c.storeInfo}</h3>
            <div className="form-row">
              <label>{c.storeName}</label>
              <input
                type="text"
                value={store.name || ''}
                onChange={(e) => saveStore({ name: e.target.value })}
                placeholder="e.g. Club Shop"
              />
            </div>
            <div className="form-row">
              <label>{c.storeNameAr}</label>
              <input
                type="text"
                value={store.nameAr || ''}
                onChange={(e) => saveStore({ nameAr: e.target.value })}
                placeholder="مثلاً: متجر النادي"
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="store-section">
          <div className="store-form-card">
            <h3>{editingCategory ? (language === 'en' ? 'Edit category' : 'تعديل التصنيف') : c.addCategory}</h3>
            <div className="form-row">
              <label>{c.name}</label>
              <input
                type="text"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Category name"
              />
            </div>
            <div className="form-row">
              <label>{c.nameAr}</label>
              <input
                type="text"
                value={categoryForm.nameAr}
                onChange={(e) => setCategoryForm(f => ({ ...f, nameAr: e.target.value }))}
                placeholder="اسم التصنيف"
              />
            </div>
            <div className="form-row">
              <label>{c.order}</label>
              <input
                type="number"
                min={0}
                value={categoryForm.order}
                onChange={(e) => setCategoryForm(f => ({ ...f, order: Number(e.target.value) || 0 }))}
              />
            </div>
            <div className="form-actions">
              {editingCategory ? (
                <>
                  <button type="button" className="btn-primary" onClick={() => updateCategory(editingCategory)}>{c.save}</button>
                  <button type="button" className="btn-secondary" onClick={() => { setEditingCategory(null); setCategoryForm({ name: '', nameAr: '', order: 0 }); }}>{c.cancel}</button>
                </>
              ) : (
                <button type="button" className="btn-primary" onClick={addCategory}>{c.addCategory}</button>
              )}
            </div>
          </div>
          <div className="store-list-card">
            <h3>{c.categories}</h3>
            {categories.length === 0 ? (
              <p className="empty-msg">{c.noCategories}</p>
            ) : (
              <ul className="store-list">
                {categories.map(cat => (
                  <li key={cat.id} className="store-list-item">
                    <span className="item-order">{cat.order}</span>
                    <span className="item-name">{language === 'en' ? cat.name : (cat.nameAr || cat.name)}</span>
                    <div className="item-actions">
                      <button type="button" className="btn-secondary btn-small" onClick={() => startEditCategory(cat)}>{c.edit}</button>
                      <button type="button" className="btn-danger btn-small" onClick={() => deleteCategory(cat.id)}>{c.delete}</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {activeTab === 'products' && (
        <div className="store-section">
          <div className="store-form-card product-form">
            <h3>{editingProduct ? (language === 'en' ? 'Edit product' : 'تعديل المنتج') : c.addProduct}</h3>
            <div className="form-row">
              <label>{c.category}</label>
              <select
                value={productForm.categoryId}
                onChange={(e) => setProductForm(f => ({ ...f, categoryId: e.target.value }))}
              >
                <option value="">{c.noCategory}</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{language === 'en' ? cat.name : (cat.nameAr || cat.name)}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>{c.name}</label>
              <input type="text" value={productForm.name} onChange={(e) => setProductForm(f => ({ ...f, name: e.target.value }))} placeholder="Product name" />
            </div>
            <div className="form-row">
              <label>{c.nameAr}</label>
              <input type="text" value={productForm.nameAr} onChange={(e) => setProductForm(f => ({ ...f, nameAr: e.target.value }))} placeholder="اسم المنتج" />
            </div>
            <div className="form-row">
              <label>{c.description}</label>
              <textarea value={productForm.description} onChange={(e) => setProductForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Description" />
            </div>
            <div className="form-row">
              <label>{c.descriptionAr}</label>
              <textarea value={productForm.descriptionAr} onChange={(e) => setProductForm(f => ({ ...f, descriptionAr: e.target.value }))} rows={2} placeholder="الوصف" />
            </div>
            <div className="form-row">
              <label>{c.price}</label>
              <input type="text" value={productForm.price} onChange={(e) => setProductForm(f => ({ ...f, price: e.target.value }))} placeholder="0" />
            </div>
            <div className="form-row">
              <label>{c.image}</label>
              <input type="text" value={productForm.image} onChange={(e) => setProductForm(f => ({ ...f, image: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="form-row">
              <label>{c.order}</label>
              <input type="number" min={0} value={productForm.order} onChange={(e) => setProductForm(f => ({ ...f, order: Number(e.target.value) || 0 }))} />
            </div>
            <div className="form-actions">
              {editingProduct ? (
                <>
                  <button type="button" className="btn-primary" onClick={() => updateProduct(editingProduct)}>{c.save}</button>
                  <button type="button" className="btn-secondary" onClick={() => { setEditingProduct(null); setProductForm({ categoryId: '', name: '', nameAr: '', description: '', descriptionAr: '', price: '', image: '', order: 0 }); }}>{c.cancel}</button>
                </>
              ) : (
                <button type="button" className="btn-primary" onClick={addProduct}>{c.addProduct}</button>
              )}
            </div>
          </div>
          <div className="store-list-card">
            <h3>{c.products}</h3>
            {products.length === 0 ? (
              <p className="empty-msg">{c.noProducts}</p>
            ) : (
              <ul className="store-list product-list">
                {products.map(prod => {
                  const cat = categories.find(c => c.id === prod.categoryId)
                  return (
                    <li key={prod.id} className="store-list-item product-item">
                      {prod.image && <img src={prod.image} alt="" className="product-thumb" />}
                      <div className="product-info">
                        <span className="item-name">{language === 'en' ? prod.name : (prod.nameAr || prod.name)}</span>
                        <span className="product-meta">{cat ? (language === 'en' ? cat.name : (cat.nameAr || cat.name)) : c.noCategory} · {prod.price ? `${prod.price} SAR` : '—'}</span>
                      </div>
                      <div className="item-actions">
                        <button type="button" className="btn-secondary btn-small" onClick={() => startEditProduct(prod)}>{c.edit}</button>
                        <button type="button" className="btn-danger btn-small" onClick={() => deleteProduct(prod.id)}>{c.delete}</button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ClubStoreManagement
