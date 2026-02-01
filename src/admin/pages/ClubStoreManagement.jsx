import React, { useState, useEffect, useMemo } from 'react'
import '../pages/common.css'
import './ClubStoreManagement.css'

const defaultStore = () => ({ name: '', nameAr: '', categories: [], products: [], sales: [], inventoryMovements: [], minStockAlert: 5 })

const ClubStoreManagement = ({ club, language: langProp, onUpdateClub }) => {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [store, setStore] = useState(() => club?.store || defaultStore())
  const [categoryForm, setCategoryForm] = useState({ name: '', nameAr: '', order: 0 })
  const [productForm, setProductForm] = useState({ categoryId: '', name: '', nameAr: '', description: '', descriptionAr: '', price: '', image: '', order: 0, stock: '' })
  const [saleForm, setSaleForm] = useState({ items: [], customerName: '', notes: '', paymentMethod: 'cash' })
  const [editingCategory, setEditingCategory] = useState(null)
  const [editingProduct, setEditingProduct] = useState(null)
  const [statsPeriod, setStatsPeriod] = useState('all') // 'today' | 'week' | 'month' | 'all'
  const [saleProductSelect, setSaleProductSelect] = useState({ productId: '', qty: 1 })
  const [adjustStockProduct, setAdjustStockProduct] = useState(null)
  const [adjustStockForm, setAdjustStockForm] = useState({ qty: '', reason: '', type: 'in' })
  const [inventoryFilter, setInventoryFilter] = useState('all') // 'all' | 'tracked' | 'low' | 'out'
  const [movementFilter, setMovementFilter] = useState('all') // 'all' | 'in' | 'out' | 'sale'
  const language = langProp || localStorage.getItem(`club_${club?.id}_language`) || 'en'

  useEffect(() => {
    setStore(club?.store ? { ...defaultStore(), ...club.store, categories: club.store.categories || [], products: club.store.products || [], sales: club.store.sales || [], inventoryMovements: club.store.inventoryMovements || [], minStockAlert: club.store.minStockAlert ?? 5 } : defaultStore())
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
    const stockVal = productForm.stock === '' || productForm.stock === null ? null : Math.max(0, Number(productForm.stock))
    const prod = {
      id,
      categoryId: (productForm.categoryId || '').trim() || undefined,
      name: productForm.name.trim(),
      nameAr: (productForm.nameAr || '').trim(),
      description: (productForm.description || '').trim(),
      descriptionAr: (productForm.descriptionAr || '').trim(),
      price: String(productForm.price || '').trim(),
      image: (productForm.image || '').trim() || undefined,
      order: Number(productForm.order) || 0,
      stock: stockVal
    }
    saveStore({ products: [...(store.products || []), prod].sort((a, b) => (a.order || 0) - (b.order || 0)) })
    setProductForm({ categoryId: '', name: '', nameAr: '', description: '', descriptionAr: '', price: '', image: '', order: (store.products?.length || 0), stock: '' })
    setEditingProduct(null)
  }

  const updateProduct = (id) => {
    const stockVal = productForm.stock === '' || productForm.stock === null ? null : Math.max(0, Number(productForm.stock))
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
        order: Number(productForm.order) ?? p.order,
        stock: stockVal
      }
    })
    saveStore({ products: prods.sort((a, b) => (a.order || 0) - (b.order || 0)) })
    setProductForm({ categoryId: '', name: '', nameAr: '', description: '', descriptionAr: '', price: '', image: '', order: 0, stock: '' })
    setEditingProduct(null)
  }

  const deleteProduct = (id) => {
    saveStore({ products: (store.products || []).filter(p => p.id !== id) })
    setEditingProduct(null)
  }

  const addSale = () => {
    if (!saleForm.items.length) return
    const currency = club?.settings?.currency || 'SAR'
    const items = saleForm.items.map(it => {
      const p = (store.products || []).find(pr => pr.id === it.productId)
      const price = parseFloat(p?.price || it.price || 0) || 0
      const qty = Math.max(1, it.qty)
      return {
        productId: it.productId,
        productName: p ? (language === 'ar' && p.nameAr ? p.nameAr : p.name) : it.productName,
        qty,
        price,
        total: price * qty
      }
    })
    const totalAmount = items.reduce((s, i) => s + i.total, 0)
    const sale = {
      id: `sale-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5),
      items,
      totalAmount,
      customerName: (saleForm.customerName || '').trim() || undefined,
      notes: (saleForm.notes || '').trim() || undefined,
      paymentMethod: saleForm.paymentMethod || 'cash',
      currency
    }
    const newSales = [...(store.sales || []), sale]
    const movements = []
    const newProducts = (store.products || []).map(p => {
      const item = items.find(i => i.productId === p.id)
      if (!item || p.stock == null) return p
      const prev = p.stock ?? 0
      const next = Math.max(0, prev - item.qty)
      movements.push({
        id: `mov-${Date.now()}-${p.id}`,
        productId: p.id,
        productName: language === 'ar' && p.nameAr ? p.nameAr : p.name,
        date: sale.date,
        time: sale.time,
        type: 'sale',
        qty: -item.qty,
        reason: sale.id,
        previousStock: prev,
        newStock: next
      })
      return { ...p, stock: next }
    })
    const newMovements = [...(store.inventoryMovements || []), ...movements]
    saveStore({ sales: newSales, products: newProducts, inventoryMovements: newMovements })
    setSaleForm({ items: [], customerName: '', notes: '', paymentMethod: 'cash' })
    setSaleProductSelect({ productId: '', qty: 1 })
  }

  const addItemToSale = () => {
    if (!saleProductSelect.productId) return
    const p = (store.products || []).find(pr => pr.id === saleProductSelect.productId)
    if (!p) return
    const qty = Math.max(1, saleProductSelect.qty)
    if (p.stock != null && (p.stock ?? 0) < qty) return
    const existing = saleForm.items.find(i => i.productId === saleProductSelect.productId)
    let newItems
    if (existing) {
      const newQty = existing.qty + qty
      if (p.stock != null && (p.stock ?? 0) < newQty) return
      newItems = saleForm.items.map(i => i.productId === saleProductSelect.productId ? { ...i, qty: newQty } : i)
    } else {
      newItems = [...saleForm.items, { productId: p.id, productName: language === 'ar' && p.nameAr ? p.nameAr : p.name, qty, price: parseFloat(p.price) || 0 }]
    }
    setSaleForm(f => ({ ...f, items: newItems }))
  }

  const removeItemFromSale = (productId) => {
    setSaleForm(f => ({ ...f, items: f.items.filter(i => i.productId !== productId) }))
  }

  const adjustStock = () => {
    if (!adjustStockProduct || !adjustStockForm.qty) return
    const p = (store.products || []).find(pr => pr.id === adjustStockProduct.id)
    if (!p || p.stock == null) return
    const delta = adjustStockForm.type === 'in' ? Math.abs(Number(adjustStockForm.qty) || 0) : -Math.abs(Number(adjustStockForm.qty) || 0)
    const prev = p.stock ?? 0
    const next = Math.max(0, prev + delta)
    const mov = {
      id: `mov-${Date.now()}`,
      productId: p.id,
      productName: language === 'ar' && p.nameAr ? p.nameAr : p.name,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5),
      type: adjustStockForm.type,
      qty: delta,
      reason: (adjustStockForm.reason || '').trim() || undefined,
      previousStock: prev,
      newStock: next
    }
    const newProducts = (store.products || []).map(pr => pr.id === p.id ? { ...pr, stock: next } : pr)
    const newMovements = [...(store.inventoryMovements || []), mov]
    saveStore({ products: newProducts, inventoryMovements: newMovements })
    setAdjustStockProduct(null)
    setAdjustStockForm({ qty: '', reason: '', type: 'in' })
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
      order: prod.order ?? 0,
      stock: prod.stock == null ? '' : prod.stock
    })
  }

  const categories = store.categories || []
  const products = store.products || []
  const sales = store.sales || []
  const movements = store.inventoryMovements || []
  const minStockAlert = store.minStockAlert ?? 5
  const currency = club?.settings?.currency || 'SAR'

  const trackedProducts = products.filter(p => p.stock != null)
  const lowStockProducts = trackedProducts.filter(p => p.stock > 0 && p.stock <= minStockAlert)
  const outOfStockProducts = trackedProducts.filter(p => p.stock <= 0)

  const filteredSales = useMemo(() => {
    if (statsPeriod === 'all') return sales
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const weekAgo = new Date(now)
    weekAgo.setDate(weekAgo.getDate() - 7)
    const monthAgo = new Date(now)
    monthAgo.setMonth(monthAgo.getMonth() - 1)
    return sales.filter(s => {
      const d = s.date || s.createdAt?.split?.('T')[0]
      if (statsPeriod === 'today') return d === today
      if (statsPeriod === 'week') return d >= weekAgo.toISOString().split('T')[0]
      if (statsPeriod === 'month') return d >= monthAgo.toISOString().split('T')[0]
      return true
    })
  }, [sales, statsPeriod])

  const stats = useMemo(() => {
    const totalRevenue = filteredSales.reduce((s, sale) => s + (sale.totalAmount || 0), 0)
    const totalTransactions = filteredSales.length
    const productCount = products.reduce((acc, p) => {
      const sold = filteredSales.flatMap(s => s.items || []).filter(i => i.productId === p.id).reduce((a, i) => a + (i.qty || 0), 0)
      acc[p.id] = { sold, product: p }
      return acc
    }, {})
    const topProducts = Object.entries(productCount)
      .sort((a, b) => (b[1].sold || 0) - (a[1].sold || 0))
      .slice(0, 5)
    const tracked = products.filter(p => p.stock != null)
    const low = tracked.filter(p => p.stock > 0 && p.stock <= (store.minStockAlert ?? 5))
    const out = tracked.filter(p => p.stock <= 0)
    const inventoryValue = tracked.reduce((s, p) => s + ((p.stock ?? 0) * (parseFloat(p.price) || 0)), 0)
    return { totalRevenue, totalTransactions, topProducts, inventoryValue, lowStockCount: low.length, outOfStockCount: out.length }
  }, [filteredSales, products, store.minStockAlert])

  const saleFormTotal = useMemo(() => saleForm.items.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0), [saleForm.items])

  const t = {
    en: {
      title: 'Sales & Store',
      storeInfo: 'Store info',
      storeName: 'Store name (English)',
      storeNameAr: 'Store name (Arabic)',
      categories: 'Categories',
      products: 'Products',
      sales: 'Sales',
      dashboard: 'Dashboard',
      salesHistory: 'Sales History',
      newSale: 'New Sale',
      addCategory: 'Add category',
      addProduct: 'Add product',
      name: 'Name',
      nameAr: 'Name (Arabic)',
      order: 'Order',
      description: 'Description',
      descriptionAr: 'Description (Arabic)',
      price: 'Price',
      image: 'Image URL',
      category: 'Category',
      noCategory: '— No category —',
      save: 'Save',
      cancel: 'Cancel',
      edit: 'Edit',
      delete: 'Delete',
      noCategories: 'No categories yet. Add one to organize products.',
      noProducts: 'No products yet. Add your first product.',
      storeEnabledNote: 'Store visibility is controlled from All Clubs Dashboard (enable/disable per club).',
      totalRevenue: 'Total Revenue',
      totalSales: 'Total Sales',
      topProducts: 'Top Products',
      periodToday: 'Today',
      periodWeek: 'This Week',
      periodMonth: 'This Month',
      periodAll: 'All Time',
      noSalesYet: 'No sales yet.',
      customerName: 'Customer',
      notes: 'Notes',
      paymentMethod: 'Payment',
      cash: 'Cash',
      card: 'Card',
      transfer: 'Transfer',
      other: 'Other',
      qty: 'Qty',
      total: 'Total',
      date: 'Date',
      stock: 'Stock',
      unlimited: 'Unlimited',
      lowStock: 'Low stock',
      inventory: 'Inventory',
      inventoryValue: 'Inventory Value',
      lowStockCount: 'Low Stock',
      outOfStock: 'Out of Stock',
      outOfStockCount: 'Out of Stock',
      minStockAlert: 'Low stock alert threshold',
      addStock: 'Add Stock',
      removeStock: 'Remove Stock',
      adjustStock: 'Adjust Stock',
      movementHistory: 'Movement History',
      movementType: 'Type',
      movementIn: 'In',
      movementOut: 'Out',
      movementSale: 'Sale',
      reason: 'Reason',
      previousStock: 'Prev',
      newStock: 'New',
      trackedOnly: 'Tracked only',
      filterAll: 'All',
      filterLow: 'Low stock',
      filterOut: 'Out of stock'
    },
    ar: {
      title: 'المبيعات والمتجر',
      storeInfo: 'معلومات المتجر',
      storeName: 'اسم المتجر (إنجليزي)',
      storeNameAr: 'اسم المتجر (عربي)',
      categories: 'التصنيفات',
      products: 'المنتجات',
      sales: 'المبيعات',
      dashboard: 'لوحة الإحصائيات',
      salesHistory: 'سجل المبيعات',
      newSale: 'بيع جديد',
      addCategory: 'إضافة تصنيف',
      addProduct: 'إضافة منتج',
      name: 'الاسم',
      nameAr: 'الاسم (عربي)',
      order: 'الترتيب',
      description: 'الوصف',
      descriptionAr: 'الوصف (عربي)',
      price: 'السعر',
      image: 'رابط الصورة',
      category: 'التصنيف',
      noCategory: '— بدون تصنيف —',
      save: 'حفظ',
      cancel: 'إلغاء',
      edit: 'تعديل',
      delete: 'حذف',
      noCategories: 'لا توجد تصنيفات. أضف تصنيفاً لتنظيم المنتجات.',
      noProducts: 'لا توجد منتجات. أضف أول منتج.',
      storeEnabledNote: 'إظهار المتجر يُتحكم به من لوحة جميع الأندية (تفعيل/إلغاء لكل نادي).',
      totalRevenue: 'إجمالي الإيرادات',
      totalSales: 'عدد المعاملات',
      topProducts: 'الأكثر مبيعاً',
      periodToday: 'اليوم',
      periodWeek: 'هذا الأسبوع',
      periodMonth: 'هذا الشهر',
      periodAll: 'كل الفترات',
      noSalesYet: 'لا توجد مبيعات بعد.',
      customerName: 'العميل',
      notes: 'ملاحظات',
      paymentMethod: 'طريقة الدفع',
      cash: 'نقداً',
      card: 'بطاقة',
      transfer: 'تحويل',
      other: 'أخرى',
      qty: 'الكمية',
      total: 'الإجمالي',
      date: 'التاريخ',
      stock: 'المخزون',
      unlimited: 'غير محدود',
      lowStock: 'مخزون منخفض',
      inventory: 'المخزون',
      inventoryValue: 'قيمة المخزون',
      lowStockCount: 'منخفض المخزون',
      outOfStock: 'نفد من المخزون',
      outOfStockCount: 'نفد من المخزون',
      minStockAlert: 'حد تنبيه المخزون المنخفض',
      addStock: 'إضافة مخزون',
      removeStock: 'سحب مخزون',
      adjustStock: 'تعديل المخزون',
      movementHistory: 'سجل الحركات',
      movementType: 'النوع',
      movementIn: 'إدخال',
      movementOut: 'إخراج',
      movementSale: 'بيع',
      reason: 'السبب',
      previousStock: 'قبل',
      newStock: 'بعد',
      trackedOnly: 'مُتتبع فقط',
      filterAll: 'الكل',
      filterLow: 'منخفض',
      filterOut: 'نفد'
    }
  }
  const c = t[language]

  if (!club) return <div className="club-admin-page">Loading...</div>

  const tabs = [
    { id: 'dashboard', label: c.dashboard, icon: '📊' },
    { id: 'inventory', label: c.inventory, icon: '📦' },
    { id: 'info', label: c.storeInfo, icon: '⚙️' },
    { id: 'categories', label: c.categories, icon: '📁' },
    { id: 'products', label: c.products, icon: '🛍️' },
    { id: 'newSale', label: c.newSale, icon: '➕' },
    { id: 'salesHistory', label: c.salesHistory, icon: '📋' }
  ]

  return (
    <div className="club-admin-page club-store-management">
      <div className="store-page-header">
        <h2 className="page-title">
          {club.logo && <img src={club.logo} alt="" className="club-logo" />}
          {c.title} – {language === 'ar' && club.nameAr ? club.nameAr : club.name}
        </h2>
      </div>

      <p className="store-enabled-note">{c.storeEnabledNote}</p>

      <div className="store-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Dashboard */}
      {activeTab === 'dashboard' && (
        <div className="store-dashboard">
          <div className="stats-period-bar">
            {[
              { id: 'today', label: c.periodToday },
              { id: 'week', label: c.periodWeek },
              { id: 'month', label: c.periodMonth },
              { id: 'all', label: c.periodAll }
            ].map(p => (
              <button
                key={p.id}
                type="button"
                className={statsPeriod === p.id ? 'active' : ''}
                onClick={() => setStatsPeriod(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="store-stats-grid">
            <div className="store-stat-card revenue">
              <span className="stat-icon">💰</span>
              <div className="stat-content">
                <span className="stat-value">{stats.totalRevenue.toFixed(2)} {currency}</span>
                <span className="stat-label">{c.totalRevenue}</span>
              </div>
            </div>
            <div className="store-stat-card transactions">
              <span className="stat-icon">🛒</span>
              <div className="stat-content">
                <span className="stat-value">{stats.totalTransactions}</span>
                <span className="stat-label">{c.totalSales}</span>
              </div>
            </div>
            <div className="store-stat-card products-count">
              <span className="stat-icon">📦</span>
              <div className="stat-content">
                <span className="stat-value">{products.length}</span>
                <span className="stat-label">{c.products}</span>
              </div>
            </div>
            <div className="store-stat-card categories-count">
              <span className="stat-icon">📁</span>
              <div className="stat-content">
                <span className="stat-value">{categories.length}</span>
                <span className="stat-label">{c.categories}</span>
              </div>
            </div>
            <div className="store-stat-card inventory-value">
              <span className="stat-icon">📦</span>
              <div className="stat-content">
                <span className="stat-value">{(stats.inventoryValue ?? 0).toFixed(0)} {currency}</span>
                <span className="stat-label">{c.inventoryValue}</span>
              </div>
            </div>
            <div className="store-stat-card low-stock-alert">
              <span className="stat-icon">⚠️</span>
              <div className="stat-content">
                <span className="stat-value">{stats.lowStockCount ?? 0}</span>
                <span className="stat-label">{c.lowStockCount}</span>
              </div>
            </div>
            <div className="store-stat-card out-stock-alert">
              <span className="stat-icon">❌</span>
              <div className="stat-content">
                <span className="stat-value">{stats.outOfStockCount ?? 0}</span>
                <span className="stat-label">{c.outOfStockCount}</span>
              </div>
            </div>
          </div>
          <div className="store-dashboard-bottom">
            <div className="top-products-card">
              <h3>{c.topProducts}</h3>
              {stats.topProducts.length === 0 ? (
                <p className="empty-msg">{c.noSalesYet}</p>
              ) : (
                <ul className="top-products-list">
                  {stats.topProducts.map(([id, { sold, product }], idx) => (
                    <li key={id}>
                      <span className="rank">#{idx + 1}</span>
                      <span className="prod-name">{language === 'ar' && product.nameAr ? product.nameAr : product.name}</span>
                      <span className="prod-sold">{sold} {language === 'en' ? 'sold' : 'مباع'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'info' && (
        <div className="store-section">
          <div className="store-form-card">
            <h3>{c.storeInfo}</h3>
            <div className="form-row">
              <label>{c.storeName}</label>
              <input type="text" value={store.name || ''} onChange={(e) => saveStore({ name: e.target.value })} placeholder="e.g. Club Shop" />
            </div>
            <div className="form-row">
              <label>{c.storeNameAr}</label>
              <input type="text" value={store.nameAr || ''} onChange={(e) => saveStore({ nameAr: e.target.value })} placeholder="مثلاً: متجر النادي" />
            </div>
            <div className="form-row">
              <label>{c.minStockAlert}</label>
              <input type="number" min={0} value={store.minStockAlert ?? 5} onChange={(e) => saveStore({ minStockAlert: Math.max(0, Number(e.target.value) || 0) })} placeholder="5" />
              <span className="form-hint">{language === 'en' ? 'Alert when stock falls at or below this value' : 'تنبيه عندما يصل المخزون لهذه القيمة أو أقل'}</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'inventory' && (
        <div className="store-section store-inventory-section">
          <div className="inventory-stats-row">
            <div className="store-stat-card inventory-value">
              <span className="stat-icon">💰</span>
              <div className="stat-content">
                <span className="stat-value">{stats.inventoryValue?.toFixed(2) ?? 0} {currency}</span>
                <span className="stat-label">{c.inventoryValue}</span>
              </div>
            </div>
            <div className="store-stat-card">
              <span className="stat-icon">⚠️</span>
              <div className="stat-content">
                <span className="stat-value">{stats.lowStockCount}</span>
                <span className="stat-label">{c.lowStockCount}</span>
              </div>
            </div>
            <div className="store-stat-card out-stock">
              <span className="stat-icon">❌</span>
              <div className="stat-content">
                <span className="stat-value">{stats.outOfStockCount}</span>
                <span className="stat-label">{c.outOfStockCount}</span>
              </div>
            </div>
          </div>
          <div className="inventory-controls">
            <div className="inventory-filter-bar">
              {[{ id: 'all', label: c.filterAll }, { id: 'tracked', label: c.trackedOnly }, { id: 'low', label: c.filterLow }, { id: 'out', label: c.filterOut }].map(f => (
                <button key={f.id} type="button" className={inventoryFilter === f.id ? 'active' : ''} onClick={() => setInventoryFilter(f.id)}>{f.label}</button>
              ))}
            </div>
          </div>
          <div className="store-list-card full-width inventory-table-card">
            <h3>{c.inventory}</h3>
            {(() => {
              let invProducts = inventoryFilter === 'tracked' ? trackedProducts : inventoryFilter === 'low' ? lowStockProducts : inventoryFilter === 'out' ? outOfStockProducts : products
              invProducts = invProducts.filter(p => p.stock != null || inventoryFilter === 'all')
              if (inventoryFilter === 'tracked' || inventoryFilter === 'low' || inventoryFilter === 'out') invProducts = invProducts.filter(p => p.stock != null)
              return invProducts.length === 0 ? (
                <p className="empty-msg">{c.noProducts}</p>
              ) : (
                <div className="inventory-table-wrap">
                  <table className="inventory-table">
                    <thead>
                      <tr>
                        <th>{c.name}</th>
                        <th>{c.category}</th>
                        <th>{c.stock}</th>
                        <th>{language === 'en' ? 'Value' : 'القيمة'}</th>
                        <th>{language === 'en' ? 'Status' : 'الحالة'}</th>
                        <th>{language === 'en' ? 'Actions' : 'إجراءات'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invProducts.map(p => {
                        const cat = categories.find(c => c.id === p.categoryId)
                        const val = (p.stock ?? 0) * (parseFloat(p.price) || 0)
                        const status = p.stock == null ? (language === 'en' ? 'Unlimited' : 'غير محدود') : p.stock <= 0 ? c.outOfStock : p.stock <= minStockAlert ? c.lowStock : (language === 'en' ? 'OK' : 'جيد')
                        const canAdjust = p.stock != null
                        return (
                          <tr key={p.id} className={p.stock != null && p.stock <= minStockAlert ? 'row-low' : p.stock === 0 ? 'row-out' : ''}>
                            <td>{language === 'ar' && p.nameAr ? p.nameAr : p.name}</td>
                            <td>{cat ? (language === 'ar' && cat.nameAr ? cat.nameAr : cat.name) : '—'}</td>
                            <td>{p.stock == null ? '∞' : p.stock}</td>
                            <td>{val.toFixed(2)} {currency}</td>
                            <td><span className={`status-badge ${p.stock == null ? '' : p.stock <= 0 ? 'out' : p.stock <= minStockAlert ? 'low' : 'ok'}`}>{status}</span></td>
                            <td>
                              {canAdjust && (
                                <button type="button" className="btn-secondary btn-small" onClick={() => { setAdjustStockProduct(p); setAdjustStockForm({ qty: '', reason: '', type: 'in' }); }}>
                                  {c.adjustStock}
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            })()}
          </div>
          <div className="store-list-card full-width">
            <h3>{c.movementHistory}</h3>
            <div className="movement-filter-bar">
              {[{ id: 'all', label: c.filterAll }, { id: 'in', label: c.movementIn }, { id: 'out', label: c.movementOut }, { id: 'sale', label: c.movementSale }].map(f => (
                <button key={f.id} type="button" className={movementFilter === f.id ? 'active' : ''} onClick={() => setMovementFilter(f.id)}>{f.label}</button>
              ))}
            </div>
            {movements.length === 0 ? (
              <p className="empty-msg">{language === 'en' ? 'No movements yet.' : 'لا توجد حركات بعد.'}</p>
            ) : (
              <div className="movements-table-wrap">
                <table className="movements-table">
                  <thead>
                    <tr>
                      <th>{c.date}</th>
                      <th>{language === 'en' ? 'Time' : 'الوقت'}</th>
                      <th>{c.name}</th>
                      <th>{c.movementType}</th>
                      <th>{c.qty}</th>
                      <th>{c.previousStock}</th>
                      <th>{c.newStock}</th>
                      <th>{c.reason}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...movements]
                      .filter(m => movementFilter === 'all' || m.type === movementFilter)
                      .reverse()
                      .slice(0, 100)
                      .map(m => (
                        <tr key={m.id} className={`mov-type-${m.type}`}>
                          <td>{m.date}</td>
                          <td>{m.time || '—'}</td>
                          <td>{m.productName}</td>
                          <td><span className={`mov-badge ${m.type}`}>{m.type === 'sale' ? c.movementSale : m.type === 'in' ? c.movementIn : c.movementOut}</span></td>
                          <td className={m.qty >= 0 ? 'positive' : 'negative'}>{m.qty >= 0 ? '+' : ''}{m.qty}</td>
                          <td>{m.previousStock ?? '—'}</td>
                          <td>{m.newStock ?? '—'}</td>
                          <td>{m.reason || '—'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {adjustStockProduct && (
            <div className="adjust-stock-modal-overlay" onClick={() => setAdjustStockProduct(null)}>
              <div className="adjust-stock-modal" onClick={e => e.stopPropagation()}>
                <h3>{c.adjustStock} – {language === 'ar' && adjustStockProduct.nameAr ? adjustStockProduct.nameAr : adjustStockProduct.name}</h3>
                <div className="form-row">
                  <label>{language === 'en' ? 'Operation' : 'العملية'}</label>
                  <select value={adjustStockForm.type} onChange={(e) => setAdjustStockForm(f => ({ ...f, type: e.target.value }))}>
                    <option value="in">{c.addStock}</option>
                    <option value="out">{c.removeStock}</option>
                  </select>
                </div>
                <div className="form-row">
                  <label>{c.qty}</label>
                  <input type="number" min={1} value={adjustStockForm.qty} onChange={(e) => setAdjustStockForm(f => ({ ...f, qty: e.target.value }))} placeholder="0" />
                </div>
                <div className="form-row">
                  <label>{c.reason}</label>
                  <input type="text" value={adjustStockForm.reason} onChange={(e) => setAdjustStockForm(f => ({ ...f, reason: e.target.value }))} placeholder={language === 'en' ? 'e.g. Restock, Damage' : 'مثلاً: إعادة توريد، تلف'} />
                </div>
                <div className="form-actions">
                  <button type="button" className="btn-primary" onClick={adjustStock}>{c.save}</button>
                  <button type="button" className="btn-secondary" onClick={() => setAdjustStockProduct(null)}>{c.cancel}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="store-section">
          <div className="store-form-card">
            <h3>{editingCategory ? (language === 'en' ? 'Edit category' : 'تعديل التصنيف') : c.addCategory}</h3>
            <div className="form-row">
              <label>{c.name}</label>
              <input type="text" value={categoryForm.name} onChange={(e) => setCategoryForm(f => ({ ...f, name: e.target.value }))} placeholder="Category name" />
            </div>
            <div className="form-row">
              <label>{c.nameAr}</label>
              <input type="text" value={categoryForm.nameAr} onChange={(e) => setCategoryForm(f => ({ ...f, nameAr: e.target.value }))} placeholder="اسم التصنيف" />
            </div>
            <div className="form-row">
              <label>{c.order}</label>
              <input type="number" min={0} value={categoryForm.order} onChange={(e) => setCategoryForm(f => ({ ...f, order: Number(e.target.value) || 0 }))} />
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
              <select value={productForm.categoryId} onChange={(e) => setProductForm(f => ({ ...f, categoryId: e.target.value }))}>
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
            <div className="form-row form-row-inline">
              <div>
                <label>{c.price} ({currency})</label>
                <input type="text" value={productForm.price} onChange={(e) => setProductForm(f => ({ ...f, price: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <label>{c.stock}</label>
                <input type="text" value={productForm.stock} onChange={(e) => setProductForm(f => ({ ...f, stock: e.target.value }))} placeholder={c.unlimited} title={c.unlimited} />
              </div>
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
                  <button type="button" className="btn-secondary" onClick={() => { setEditingProduct(null); setProductForm({ categoryId: '', name: '', nameAr: '', description: '', descriptionAr: '', price: '', image: '', order: 0, stock: '' }); }}>{c.cancel}</button>
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
                  const isLowStock = prod.stock != null && prod.stock <= minStockAlert
                  return (
                    <li key={prod.id} className={`store-list-item product-item ${isLowStock ? 'low-stock' : ''}`}>
                      {prod.image && <img src={prod.image} alt="" className="product-thumb" />}
                      <div className="product-info">
                        <span className="item-name">{language === 'en' ? prod.name : (prod.nameAr || prod.name)}</span>
                        <span className="product-meta">
                          {cat ? (language === 'en' ? cat.name : (cat.nameAr || cat.name)) : c.noCategory} · {prod.price ? `${prod.price} ${currency}` : '—'}
                          {prod.stock != null && <span className="stock-badge"> · {c.stock}: {prod.stock}</span>}
                          {isLowStock && <span className="low-stock-badge">{c.lowStock}</span>}
                        </span>
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

      {activeTab === 'newSale' && (
        <div className="store-section store-sale-section">
          <div className="store-form-card sale-form-card">
            <h3>{c.newSale}</h3>
            <div className="sale-add-item">
              <select value={saleProductSelect.productId} onChange={(e) => setSaleProductSelect(s => ({ ...s, productId: e.target.value }))}>
                <option value="">{language === 'en' ? 'Select product' : 'اختر منتج'}</option>
                {products.filter(p => p.stock == null || p.stock > 0).map(p => (
                  <option key={p.id} value={p.id}>{language === 'ar' && p.nameAr ? p.nameAr : p.name} – {p.price} {currency}</option>
                ))}
              </select>
              <input type="number" min={1} value={saleProductSelect.qty} onChange={(e) => setSaleProductSelect(s => ({ ...s, qty: Math.max(1, Number(e.target.value) || 1) }))} />
              <button type="button" className="btn-primary" onClick={addItemToSale}>{language === 'en' ? 'Add' : 'إضافة'}</button>
            </div>
            {saleForm.items.length > 0 && (
              <>
                <ul className="sale-items-list">
                  {saleForm.items.map(it => (
                    <li key={it.productId}>
                      <span className="item-name">{it.productName}</span>
                      <span className="item-qty">{it.qty} × {it.price} {currency}</span>
                      <span className="item-total">{(it.qty * it.price).toFixed(2)} {currency}</span>
                      <button type="button" className="btn-icon-remove" onClick={() => removeItemFromSale(it.productId)} aria-label="Remove">×</button>
                    </li>
                  ))}
                </ul>
                <div className="sale-total-row">
                  <strong>{c.total}:</strong>
                  <strong>{saleFormTotal.toFixed(2)} {currency}</strong>
                </div>
                <div className="form-row">
                  <label>{c.customerName}</label>
                  <input type="text" value={saleForm.customerName} onChange={(e) => setSaleForm(f => ({ ...f, customerName: e.target.value }))} placeholder={language === 'en' ? 'Optional' : 'اختياري'} />
                </div>
                <div className="form-row">
                  <label>{c.paymentMethod}</label>
                  <select value={saleForm.paymentMethod} onChange={(e) => setSaleForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                    <option value="cash">{c.cash}</option>
                    <option value="card">{c.card}</option>
                    <option value="transfer">{c.transfer}</option>
                    <option value="other">{c.other}</option>
                  </select>
                </div>
                <div className="form-row">
                  <label>{c.notes}</label>
                  <textarea value={saleForm.notes} onChange={(e) => setSaleForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder={language === 'en' ? 'Optional notes' : 'ملاحظات اختيارية'} />
                </div>
                <button type="button" className="btn-primary btn-complete-sale" onClick={addSale}>
                  {language === 'en' ? 'Complete Sale' : 'إتمام البيع'}
                </button>
              </>
            )}
            {saleForm.items.length === 0 && products.length === 0 && (
              <p className="empty-msg">{c.noProducts}</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'salesHistory' && (
        <div className="store-section">
          <div className="store-list-card full-width">
            <h3>{c.salesHistory}</h3>
            {sales.length === 0 ? (
              <p className="empty-msg">{c.noSalesYet}</p>
            ) : (
              <div className="sales-history-table-wrap">
                <table className="sales-history-table">
                  <thead>
                    <tr>
                      <th>{c.date}</th>
                      <th>{language === 'en' ? 'Time' : 'الوقت'}</th>
                      <th>{c.total}</th>
                      <th>{language === 'en' ? 'Items' : 'العناصر'}</th>
                      <th>{c.paymentMethod}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...sales].reverse().map(sale => (
                      <tr key={sale.id}>
                        <td>{sale.date}</td>
                        <td>{sale.time || '—'}</td>
                        <td className="amount">{sale.totalAmount?.toFixed?.(2) ?? sale.totalAmount} {sale.currency || currency}</td>
                        <td>{(sale.items || []).map(i => `${i.productName || '?'} (×${i.qty})`).join(', ')}</td>
                        <td>{sale.paymentMethod === 'cash' ? c.cash : sale.paymentMethod === 'card' ? c.card : sale.paymentMethod === 'transfer' ? c.transfer : c.other}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ClubStoreManagement
