import React, { useMemo, useState, useEffect } from 'react'
import './ClubAccountingHub.css'
import { fetchClubInvoices } from '../../api/dbClient'

const TERMINAL_STATUSES = ['cancelled', 'expired', 'cancelled_awaiting_refund_ack']

function isTerminalBooking(b) {
  return TERMINAL_STATUSES.includes(String(b?.status || '').toLowerCase())
}

function formatMoney(amount, currency, lang) {
  try {
    return new Intl.NumberFormat(lang === 'ar' ? 'ar-SA' : 'en-US', {
      style: 'currency',
      currency: currency || 'SAR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(amount) || 0)
  } catch {
    return `${(Number(amount) || 0).toFixed(2)} ${currency || 'SAR'}`
  }
}

function courtLabel(club, courtId, lang) {
  const c = (club?.courts || []).find(x => String(x.id) === String(courtId))
  if (!c) return '—'
  return lang === 'ar' ? (c.nameAr || c.name) : (c.name || c.nameAr)
}

function InvoiceCustomerDetail({ inv, t }) {
  const name = (inv?.customer_name != null ? String(inv.customer_name) : '').trim()
  const phone = (inv?.customer_phone != null ? String(inv.customer_phone) : '').trim()
  const mid = (inv?.customer_member_id != null ? String(inv.customer_member_id) : '').trim()
  const sharePt = String(inv?.share_participant_type || '').toLowerCase()
  const guestBadge = sharePt === 'unregistered' && !mid

  return (
    <div className="acc-invoice-customer">
      <div className="acc-invoice-customer__row acc-invoice-customer__name">
        <span>{name || '—'}</span>
        {guestBadge ? (
          <span className="acc-invoice-customer__badge" title={t('No linked member', 'بدون عضو مرتبط')}>
            {t('Guest', 'ضيف')}
          </span>
        ) : null}
      </div>
      {phone ? (
        <div className="acc-invoice-customer__row acc-invoice-customer__meta western-numerals" title={t('Phone', 'الجوال')}>
          {phone}
        </div>
      ) : null}
      {mid ? (
        <div className="acc-invoice-customer__row acc-invoice-customer__meta">
          <span className="acc-invoice-customer__label">{t('Member', 'عضو')}</span>
          <code className="acc-code acc-code--sub">{mid}</code>
        </div>
      ) : null}
    </div>
  )
}

function getInvoiceStatusLabel(inv, lang = 'en') {
  const status = String(inv?.status || '').toLowerCase()
  const sourceType = String(inv?.source_type || '').toLowerCase()
  // Share/full booking refunds currently void invoice records; present them as refunded in UI.
  if (status === 'void' && (sourceType === 'booking_share' || sourceType === 'booking_full')) {
    return lang === 'ar' ? 'مسترجع' : 'Refunded'
  }
  if (lang === 'ar') {
    if (status === 'paid') return 'مدفوع'
    if (status === 'issued') return 'صادرة'
    if (status === 'partially_paid') return 'مدفوع جزئياً'
    if (status === 'void') return 'ملغاة'
  }
  return inv?.status || '—'
}

function monthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const toYmd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { start: toYmd(start), end: toYmd(end) }
}

const SUB_TABS = [
  { id: 'overview', icon: '📈', en: 'Overview', ar: 'نظرة عامة' },
  { id: 'bookings', icon: '📅', en: 'Court revenue', ar: 'إيرادات الملاعب' },
  { id: 'invoices', icon: '🧾', en: 'Invoices', ar: 'الفواتير' },
  { id: 'ledger', icon: '📒', en: 'Ledger', ar: 'دفتر القيود' },
  { id: 'reports', icon: '📤', en: 'Reports', ar: 'التقارير' }
]

export default function ClubAccountingHub({ club, language, onUpdateClub }) {
  const lang = language === 'ar' ? 'ar' : 'en'
  const currency = club?.settings?.currency || 'SAR'
  const [subTab, setSubTab] = useState('overview')
  const [bookingSearch, setBookingSearch] = useState('')
  const [bookingPayFilter, setBookingPayFilter] = useState('all')
  const [reportFrom, setReportFrom] = useState(monthRange().start)
  const [reportTo, setReportTo] = useState(monthRange().end)

  const invoiceRangeStart = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 120)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])
  const [invoiceFrom, setInvoiceFrom] = useState(invoiceRangeStart)
  const [invoiceTo, setInvoiceTo] = useState(() => new Date().toISOString().split('T')[0])
  const [invoiceQuery, setInvoiceQuery] = useState('')
  const [invoices, setInvoices] = useState([])
  const [invoicesLoading, setInvoicesLoading] = useState(false)
  const [invoicingEnabled, setInvoicingEnabled] = useState(true)

  const t = (en, ar) => (lang === 'ar' ? ar : en)

  useEffect(() => {
    if (subTab !== 'invoices' || !club?.id) return
    let cancelled = false
    ;(async () => {
      setInvoicesLoading(true)
      try {
        const r = await fetchClubInvoices(club.id, { from: invoiceFrom, to: invoiceTo, limit: 250, offset: 0 })
        if (!cancelled && r?.ok !== false) {
          setInvoices(Array.isArray(r.invoices) ? r.invoices : [])
          setInvoicingEnabled(r.invoicingEnabled !== false)
        }
      } catch {
        if (!cancelled) {
          setInvoices([])
          setInvoicingEnabled(false)
        }
      } finally {
        if (!cancelled) setInvoicesLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [subTab, club?.id, invoiceFrom, invoiceTo])

  const filteredInvoices = useMemo(() => {
    const q = invoiceQuery.trim().toLowerCase()
    if (!q) return invoices
    return invoices.filter((inv) => {
      const num = String(inv.invoice_number || '').toLowerCase()
      const cust = String(inv.customer_name || '').toLowerCase()
      const phone = String(inv.customer_phone || '').toLowerCase()
      const mid = String(inv.customer_member_id || '').toLowerCase()
      const pid = String(inv.public_id || '').toLowerCase()
      const src = String(inv.source_ref || '').toLowerCase()
      const st = String(inv.status || '').toLowerCase()
      return (
        num.includes(q) ||
        cust.includes(q) ||
        phone.includes(q) ||
        mid.includes(q) ||
        pid.includes(q) ||
        src.includes(q) ||
        st.includes(q)
      )
    })
  }, [invoices, invoiceQuery])

  const bookings = useMemo(() => (Array.isArray(club?.bookings) ? club.bookings : []), [club?.bookings])
  const accounting = useMemo(() => (Array.isArray(club?.accounting) ? club.accounting : []), [club?.accounting])
  const sales = useMemo(() => (Array.isArray(club?.store?.sales) ? club.store.sales : []), [club?.store?.sales])

  const stats = useMemo(() => {
    const active = bookings.filter(b => !isTerminalBooking(b))
    let gross = 0
    let collected = 0
    let outstanding = 0
    active.forEach(b => {
      const total = parseFloat(b.totalAmount) || 0
      const paid = parseFloat(b.paidAmount) || 0
      gross += total
      collected += paid
      outstanding += Math.max(0, total - paid)
    })

    const mr = monthRange()
    const inMonth = active.filter(b => {
      const d = (b.date || b.startDate || '').toString().split('T')[0]
      return d >= mr.start && d <= mr.end
    })
    let monthCollected = 0
    inMonth.forEach(b => {
      monthCollected += parseFloat(b.paidAmount) || 0
    })

    const storeTotal = sales.reduce((s, x) => s + (parseFloat(x.totalAmount) || 0), 0)

    let ledgerIncome = 0
    let ledgerExpense = 0
    accounting.forEach(a => {
      const amt = parseFloat(a.amount) || 0
      const typ = String(a.type || a.entry_type || 'income').toLowerCase()
      if (typ === 'expense') ledgerExpense += amt
      else ledgerIncome += amt
    })

    const avgTicket = active.length > 0 ? gross / active.length : 0

    return {
      bookingCount: active.length,
      gross,
      collected,
      outstanding,
      monthCollected,
      storeTotal,
      ledgerIncome,
      ledgerExpense,
      ledgerNet: ledgerIncome - ledgerExpense,
      avgTicket
    }
  }, [bookings, accounting, sales])

  const filteredBookings = useMemo(() => {
    const q = bookingSearch.trim().toLowerCase()
    return bookings
      .filter(b => {
        if (isTerminalBooking(b)) return false
        const total = parseFloat(b.totalAmount) || 0
        const paid = parseFloat(b.paidAmount) || 0
        if (bookingPayFilter === 'paid' && paid < total - 0.01) return false
        if (bookingPayFilter === 'partial' && (paid <= 0.01 || paid >= total - 0.01)) return false
        if (bookingPayFilter === 'unpaid' && paid > 0.01) return false
        if (!q) return true
        const id = String(b.id || '')
        const court = courtLabel(club, b.courtId, lang).toLowerCase()
        return id.toLowerCase().includes(q) || court.includes(q)
      })
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  }, [bookings, bookingSearch, bookingPayFilter, club, lang])

  const recentBookingSnapshots = useMemo(() => {
    return bookings
      .filter(b => !isTerminalBooking(b))
      .map(b => ({
        id: b.id,
        date: (b.date || b.startDate || '').toString().split('T')[0],
        court: courtLabel(club, b.courtId, lang),
        total: parseFloat(b.totalAmount) || 0,
        paid: parseFloat(b.paidAmount) || 0
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8)
  }, [bookings, club, lang])

  const [ledgerForm, setLedgerForm] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    type: 'income',
    category: ''
  })

  const addLedgerEntry = async () => {
    const amt = parseFloat(ledgerForm.amount)
    if (!ledgerForm.description.trim() || Number.isNaN(amt) || amt === 0) return
    const next = [
      ...(accounting || []),
      {
        id: `acc-${Date.now()}`,
        date: ledgerForm.date,
        description: ledgerForm.description.trim(),
        amount: amt,
        type: ledgerForm.type,
        category: ledgerForm.category.trim() || undefined
      }
    ]
    await onUpdateClub({ accounting: next })
    setLedgerForm(f => ({ ...f, description: '', amount: '', category: '' }))
  }

  const removeLedgerEntry = async (id) => {
    if (!id || !window.confirm(t('Remove this entry?', 'حذف هذا السجل؟'))) return
    const next = accounting.filter(a => String(a.id) !== String(id))
    await onUpdateClub({ accounting: next })
  }

  const exportCsv = () => {
    const rows = []
    rows.push(['PlayTix Accounting export', club?.name || '', reportFrom, reportTo].join(','))
    rows.push([])
    rows.push([t('Booking date', 'تاريخ الحجز'), t('Court', 'الملعب'), t('Total', 'الإجمالي'), t('Paid', 'المدفوع'), t('Outstanding', 'المتبقي')].join(','))
    bookings
      .filter(b => !isTerminalBooking(b))
      .filter(b => {
        const d = (b.date || b.startDate || '').toString().split('T')[0]
        return d >= reportFrom && d <= reportTo
      })
      .forEach(b => {
        const total = parseFloat(b.totalAmount) || 0
        const paid = parseFloat(b.paidAmount) || 0
        const out = Math.max(0, total - paid)
        rows.push(
          [
            (b.date || '').toString().split('T')[0],
            `"${courtLabel(club, b.courtId, lang).replace(/"/g, '""')}"`,
            total.toFixed(2),
            paid.toFixed(2),
            out.toFixed(2)
          ].join(',')
        )
      })
    rows.push([])
    rows.push([t('Ledger', 'دفتر القيود')].join(','))
    rows.push([t('Date', 'التاريخ'), t('Description', 'البيان'), t('Type', 'النوع'), t('Amount', 'المبلغ')].join(','))
    accounting.forEach(a => {
      rows.push(
        [
          a.date || '',
          `"${String(a.description || '').replace(/"/g, '""')}"`,
          a.type || 'income',
          (parseFloat(a.amount) || 0).toFixed(2)
        ].join(',')
      )
    })
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `accounting-${club?.id || 'club'}-${reportFrom}-${reportTo}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="acc-hub" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <header className="acc-hub__hero">
        <div className="acc-hub__hero-text">
          <p className="acc-hub__eyebrow">{t('Finance center', 'مركز المالية')}</p>
          <h1 className="acc-hub__title">{t('Accounting', 'المحاسبة')}</h1>
          <p className="acc-hub__lead">
            {t(
              'Live booking collections, store turnover, and manual ledger — unified for your club.',
              'تحصيلات الحجوزات، مبيعات المتجر، ودفتر القيود اليدوي — في لوحة واحدة للنادي.'
            )}
          </p>
        </div>
        <div className="acc-hub__hero-badge" aria-hidden>
          <span className="acc-hub__hero-badge-inner">💼</span>
        </div>
      </header>

      <section className="acc-hub__kpi" aria-label={t('Accounting statistics', 'إحصائيات المحاسبة')}>
        <article className="acc-kpi acc-kpi--indigo">
          <span className="acc-kpi__label">{t('Booking revenue (gross)', 'إيراد الحجوزات (إجمالي)')}</span>
          <strong className="acc-kpi__value western-numerals">{formatMoney(stats.gross, currency, lang)}</strong>
          <span className="acc-kpi__hint">
            {stats.bookingCount} {t('active bookings', 'حجوزات نشطة')} · {t('Avg.', 'متوسط')} {formatMoney(stats.avgTicket, currency, lang)}
          </span>
        </article>
        <article className="acc-kpi acc-kpi--emerald">
          <span className="acc-kpi__label">{t('Collected (bookings)', 'المحصّل (حجوزات)')}</span>
          <strong className="acc-kpi__value western-numerals">{formatMoney(stats.collected, currency, lang)}</strong>
          <span className="acc-kpi__hint">{t('All non-cancelled reservations', 'كل الحجوزات غير الملغاة')}</span>
        </article>
        <article className="acc-kpi acc-kpi--amber">
          <span className="acc-kpi__label">{t('Outstanding', 'المستحق')}</span>
          <strong className="acc-kpi__value western-numerals">{formatMoney(stats.outstanding, currency, lang)}</strong>
          <span className="acc-kpi__hint">{t('Yet to collect on court bookings', 'متبقٍّ على حجوزات الملاعب')}</span>
        </article>
        <article className="acc-kpi acc-kpi--violet">
          <span className="acc-kpi__label">{t('This month (collected)', 'هذا الشهر (المحصّل)')}</span>
          <strong className="acc-kpi__value western-numerals">{formatMoney(stats.monthCollected, currency, lang)}</strong>
          <span className="acc-kpi__hint">{monthRange().start.slice(0, 7)}</span>
        </article>
        <article className="acc-kpi acc-kpi--slate">
          <span className="acc-kpi__label">{t('Store sales (all time)', 'مبيعات المتجر (كل الفترات)')}</span>
          <strong className="acc-kpi__value western-numerals">{formatMoney(stats.storeTotal, currency, lang)}</strong>
          <span className="acc-kpi__hint">{t('From club store module', 'من وحدة المتجر')}</span>
        </article>
        <article className="acc-kpi acc-kpi--rose">
          <span className="acc-kpi__label">{t('Manual ledger net', 'صافي الدفتر اليدوي')}</span>
          <strong className="acc-kpi__value western-numerals">{formatMoney(stats.ledgerNet, currency, lang)}</strong>
          <span className="acc-kpi__hint">
            {t('Income', 'وارد')} {formatMoney(stats.ledgerIncome, currency, lang)} — {t('Expense', 'مصروف')}{' '}
            {formatMoney(stats.ledgerExpense, currency, lang)}
          </span>
        </article>
      </section>

      <div className="acc-hub__tabs-wrap">
        <div className="acc-hub__tabs" role="tablist" aria-label={t('Accounting sections', 'أقسام المحاسبة')}>
          {SUB_TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={subTab === tab.id}
              className={`acc-hub__tab ${subTab === tab.id ? 'acc-hub__tab--active' : ''}`}
              onClick={() => setSubTab(tab.id)}
            >
              <span className="acc-hub__tab-icon" aria-hidden>
                {tab.icon}
              </span>
              <span className="acc-hub__tab-label">{lang === 'ar' ? tab.ar : tab.en}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="acc-hub__panel">
        {subTab === 'overview' && (
          <div className="acc-panel acc-panel--overview">
            <div className="acc-split">
              <div className="acc-card acc-card--accent">
                <h2 className="acc-card__title">{t('Collection health', 'صحة التحصيل')}</h2>
                <div className="acc-meter-wrap">
                  <div className="acc-meter" role="presentation">
                    <div
                      className="acc-meter__fill"
                      style={{
                        width:
                          stats.gross > 0
                            ? `${Math.min(100, (stats.collected / stats.gross) * 100)}%`
                            : '0%'
                      }}
                    />
                  </div>
                </div>
                <p className="acc-meter-caption">
                  {stats.gross > 0
                    ? t(
                        `${((stats.collected / stats.gross) * 100).toFixed(1)}% of booking gross is collected.`,
                        `تم تحصيل ${((stats.collected / stats.gross) * 100).toFixed(1)}% من إجمالي الحجوزات.`
                      )
                    : t('No active booking amounts yet.', 'لا توجد مبالغ حجوزات نشطة بعد.')}
                </p>
              </div>
              <div className="acc-card">
                <h2 className="acc-card__title">{t('Recent booking payments', 'آخر مدفوعات الحجز')}</h2>
                {recentBookingSnapshots.length === 0 ? (
                  <p className="acc-empty">{t('No items to show.', 'لا توجد عناصر.')}</p>
                ) : (
                  <ul className="acc-timeline">
                    {recentBookingSnapshots.map(row => (
                      <li key={row.id} className="acc-timeline__item">
                        <span className="acc-timeline__date western-numerals">{row.date}</span>
                        <span className="acc-timeline__meta">{row.court}</span>
                        <span className="acc-timeline__amt western-numerals">
                          {formatMoney(row.paid, currency, lang)} / {formatMoney(row.total, currency, lang)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {subTab === 'invoices' && (
          <div className="acc-panel acc-panel--invoices">
            {!invoicingEnabled ? (
              <div className="acc-card acc-invoice-hint acc-invoice-hint--warn">
                <p className="acc-invoice-hint__title">{t('Invoicing is not available', 'الفوترة غير مفعّلة')}</p>
                <p className="acc-invoice-hint__body">
                  {t(
                    'Install invoicing tables on the server or confirm payments from Bookings to sync when enabled.',
                    'ثبّت جداول الفوترة على السيرفر، أو أكّد المدفوعات من الحجوزات عندما تكون الفوترة جاهزة.'
                  )}
                </p>
              </div>
            ) : null}
            <div className="acc-toolbar acc-toolbar--wrap">
              <input
                type="search"
                className="acc-input acc-input--grow acc-input--prominent"
                placeholder={t(
                  'Search invoice #, name, phone, member id, booking ref…',
                  'بحث برقم الفاتورة، الاسم، الجوال، رقم العضو، مرجع الحجز…'
                )}
                value={invoiceQuery}
                onChange={(e) => setInvoiceQuery(e.target.value)}
                aria-label={t('Search invoices', 'بحث في الفواتير')}
              />
              <label className="acc-field acc-field--inline">
                <span className="acc-field__label">{t('From', 'من')}</span>
                <input
                  type="date"
                  className="acc-input western-numerals"
                  value={invoiceFrom}
                  onChange={(e) => setInvoiceFrom(e.target.value)}
                />
              </label>
              <label className="acc-field acc-field--inline">
                <span className="acc-field__label">{t('To', 'إلى')}</span>
                <input
                  type="date"
                  className="acc-input western-numerals"
                  value={invoiceTo}
                  onChange={(e) => setInvoiceTo(e.target.value)}
                />
              </label>
            </div>
            <p className="acc-invoice-count">
              {invoicesLoading
                ? t('Loading…', 'جاري التحميل…')
                : t(`${filteredInvoices.length} invoice(s)`, `${filteredInvoices.length} فاتورة`)}
            </p>
            <div className="acc-table-wrap">
              <table className="acc-table acc-table--invoices">
                <thead>
                  <tr>
                    <th>{t('Invoice #', 'رقم الفاتورة')}</th>
                    <th>{t('Issued', 'الإصدار')}</th>
                    <th>{t('Customer', 'العميل')}</th>
                    <th>{t('Total', 'الإجمالي')}</th>
                    <th>{t('Status', 'الحالة')}</th>
                    <th>{t('Source', 'المصدر')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="acc-table__empty">
                        {t('No invoices in this range.', 'لا توجد فواتير في هذه الفترة.')}
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv) => (
                      <tr key={inv.public_id || inv.invoice_number}>
                        <td>
                          <code className="acc-code">{inv.invoice_number || '—'}</code>
                        </td>
                        <td className="western-numerals">
                          {inv.issued_at
                            ? String(inv.issued_at).split('T')[0]
                            : '—'}
                        </td>
                        <td className="acc-table__customer">
                          <InvoiceCustomerDetail inv={inv} t={t} />
                        </td>
                        <td className="western-numerals">
                          {formatMoney(inv.total ?? inv.amount_paid, inv.currency || currency, lang)}
                        </td>
                        <td>
                          <span className="acc-pill acc-pill--income">{getInvoiceStatusLabel(inv, lang)}</span>
                        </td>
                        <td className="acc-invoice-source">
                          <span className="acc-invoice-source-type">{inv.source_type || '—'}</span>
                          {inv.source_ref ? (
                            <code className="acc-code acc-code--sub">{String(inv.source_ref).slice(0, 24)}</code>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {subTab === 'bookings' && (
          <div className="acc-panel">
            <div className="acc-toolbar">
              <input
                type="search"
                className="acc-input acc-input--grow"
                placeholder={t('Search booking ID or court…', 'بحث برقم الحجز أو الملعب…')}
                value={bookingSearch}
                onChange={e => setBookingSearch(e.target.value)}
              />
              <select
                className="acc-select"
                value={bookingPayFilter}
                onChange={e => setBookingPayFilter(e.target.value)}
              >
                <option value="all">{t('All payment states', 'كل حالات الدفع')}</option>
                <option value="paid">{t('Fully paid', 'مدفوع بالكامل')}</option>
                <option value="partial">{t('Partially paid', 'مدفوع جزئياً')}</option>
                <option value="unpaid">{t('Unpaid', 'غير مدفوع')}</option>
              </select>
            </div>
            <div className="acc-table-wrap">
              <table className="acc-table">
                <thead>
                  <tr>
                    <th>{t('Date', 'التاريخ')}</th>
                    <th>{t('Court', 'الملعب')}</th>
                    <th>{t('Booking', 'الحجز')}</th>
                    <th>{t('Total', 'الإجمالي')}</th>
                    <th>{t('Paid', 'المدفوع')}</th>
                    <th>{t('Due', 'المستحق')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="acc-table__empty">
                        {t('No bookings match your filters.', 'لا توجد حجوزات مطابقة.')}
                      </td>
                    </tr>
                  ) : (
                    filteredBookings.map(b => {
                      const total = parseFloat(b.totalAmount) || 0
                      const paid = parseFloat(b.paidAmount) || 0
                      const due = Math.max(0, total - paid)
                      return (
                        <tr key={b.id}>
                          <td className="western-numerals">{(b.date || b.startDate || '').toString().split('T')[0]}</td>
                          <td>{courtLabel(club, b.courtId, lang)}</td>
                          <td>
                            <code className="acc-code">{String(b.id).slice(0, 12)}</code>
                          </td>
                          <td className="western-numerals">{formatMoney(total, currency, lang)}</td>
                          <td className="western-numerals">{formatMoney(paid, currency, lang)}</td>
                          <td className="western-numerals acc-due">{formatMoney(due, currency, lang)}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {subTab === 'ledger' && (
          <div className="acc-panel">
            <div className="acc-ledger-form acc-card">
              <h2 className="acc-card__title">{t('Add manual entry', 'إضافة قيد يدوي')}</h2>
              <div className="acc-form-grid">
                <label className="acc-field">
                  <span>{t('Date', 'التاريخ')}</span>
                  <input
                    type="date"
                    className="acc-input western-numerals"
                    value={ledgerForm.date}
                    onChange={e => setLedgerForm(f => ({ ...f, date: e.target.value }))}
                  />
                </label>
                <label className="acc-field">
                  <span>{t('Type', 'النوع')}</span>
                  <select
                    className="acc-select"
                    value={ledgerForm.type}
                    onChange={e => setLedgerForm(f => ({ ...f, type: e.target.value }))}
                  >
                    <option value="income">{t('Income', 'وارد')}</option>
                    <option value="expense">{t('Expense', 'مصروف')}</option>
                  </select>
                </label>
                <label className="acc-field acc-field--wide">
                  <span>{t('Description', 'البيان')}</span>
                  <input
                    type="text"
                    className="acc-input"
                    value={ledgerForm.description}
                    onChange={e => setLedgerForm(f => ({ ...f, description: e.target.value }))}
                    placeholder={t('e.g. Pro shop restock', 'مثال: توريد المحل')}
                  />
                </label>
                <label className="acc-field">
                  <span>{t('Category (optional)', 'التصنيف (اختياري)')}</span>
                  <input
                    type="text"
                    className="acc-input"
                    value={ledgerForm.category}
                    onChange={e => setLedgerForm(f => ({ ...f, category: e.target.value }))}
                  />
                </label>
                <label className="acc-field">
                  <span>{t('Amount', 'المبلغ')}</span>
                  <input
                    type="number"
                    step="0.01"
                    className="acc-input western-numerals"
                    value={ledgerForm.amount}
                    onChange={e => setLedgerForm(f => ({ ...f, amount: e.target.value }))}
                  />
                </label>
                <div className="acc-field acc-field--action">
                  <span className="acc-field-spacer" />
                  <button type="button" className="acc-btn acc-btn--primary" onClick={addLedgerEntry}>
                    {t('Add to ledger', 'إضافة للدفتر')}
                  </button>
                </div>
              </div>
            </div>
            <div className="acc-table-wrap acc-table-wrap--mt">
              <table className="acc-table">
                <thead>
                  <tr>
                    <th>{t('Date', 'التاريخ')}</th>
                    <th>{t('Description', 'البيان')}</th>
                    <th>{t('Category', 'التصنيف')}</th>
                    <th>{t('Type', 'النوع')}</th>
                    <th>{t('Amount', 'المبلغ')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {accounting.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="acc-table__empty">
                        {t('No ledger entries yet.', 'لا توجد قيود بعد.')}
                      </td>
                    </tr>
                  ) : (
                    [...accounting].reverse().map(row => (
                      <tr key={row.id || `${row.date}-${row.description}`}>
                        <td className="western-numerals">{row.date || '—'}</td>
                        <td>{row.description}</td>
                        <td>{row.category || '—'}</td>
                        <td>
                          <span className={`acc-pill acc-pill--${row.type === 'expense' ? 'expense' : 'income'}`}>
                            {row.type === 'expense' ? t('Expense', 'مصروف') : t('Income', 'وارد')}
                          </span>
                        </td>
                        <td className="western-numerals">{formatMoney(row.amount, currency, lang)}</td>
                        <td>
                          <button
                            type="button"
                            className="acc-btn acc-btn--ghost acc-btn--sm"
                            onClick={() => removeLedgerEntry(row.id)}
                          >
                            {t('Remove', 'حذف')}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {subTab === 'reports' && (
          <div className="acc-panel acc-panel--reports">
            <div className="acc-card acc-card--reports">
              <h2 className="acc-card__title">{t('Export period', 'فترة التصدير')}</h2>
              <div className="acc-form-grid acc-form-grid--reports">
                <label className="acc-field">
                  <span>{t('From', 'من')}</span>
                  <input
                    type="date"
                    className="acc-input western-numerals"
                    value={reportFrom}
                    onChange={e => setReportFrom(e.target.value)}
                  />
                </label>
                <label className="acc-field">
                  <span>{t('To', 'إلى')}</span>
                  <input
                    type="date"
                    className="acc-input western-numerals"
                    value={reportTo}
                    onChange={e => setReportTo(e.target.value)}
                  />
                </label>
                <div className="acc-field acc-field--action">
                  <button type="button" className="acc-btn acc-btn--primary" onClick={exportCsv}>
                    {t('Download CSV', 'تنزيل CSV')}
                  </button>
                </div>
              </div>
              <p className="acc-reports-hint">
                {t(
                  'Includes court booking totals for the selected window and the full manual ledger.',
                  'يتضمن إجماليات حجوزات الملاعب للفترة المحددة ودفتر القيود اليدوي كاملاً.'
                )}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
