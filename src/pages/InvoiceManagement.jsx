import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Plus, Search, Eye, Trash2, X, ChevronDown, FileText,
  CheckCircle, Send, XCircle, RefreshCw, Download,
  ChevronLeft, ChevronRight, Printer, Edit2, Calendar,
  IndianRupee, CreditCard, Clock, AlertCircle
} from 'lucide-react'
import api from '../api/index'
import { useAuth } from '../context/AuthContext'

// ── API helpers ───────────────────────────────────────────────
const invoiceApi = {
  list:          (p = {})      => api.get('/invoices', { params: p }).then(r => r.data),
  get:           (id)          => api.get(`/invoices/${id}`).then(r => r.data),
  create:        (d)           => api.post('/invoices', d).then(r => r.data),
  update:        (id, d)       => api.put(`/invoices/${id}`, d).then(r => r.data),
  delete:        (id)          => api.delete(`/invoices/${id}`).then(r => r.data),
  updateStatus:  (id, status)  => api.patch(`/invoices/${id}/status`, { status }).then(r => r.data),
  recordPayment: (id, d)       => api.post(`/invoices/${id}/payment`, d).then(r => r.data),
  summary:       ()            => api.get('/invoices/summary').then(r => r.data),
}

// ── Constants ──────────────────────────────────────────────────
const STATUS_META = {
  draft:          { label: 'Draft',          bg: '#F1F5F9', color: '#64748B' },
  sent:           { label: 'Sent',           bg: '#F0F9FF', color: '#2563EB' },
  paid:           { label: 'Paid',           bg: '#ECFDF5', color: '#059669' },
  partially_paid: { label: 'Partially Paid', bg: '#FFFBEB', color: '#D97706' },
  overdue:        { label: 'Overdue',        bg: '#FEF2F2', color: '#DC2626' },
  cancelled:      { label: 'Cancelled',      bg: '#F1F5F9', color: '#94A3B8' },
}

const PAYMENT_STATUS_META = {
  Unpaid:          { label: 'Unpaid',         bg: '#FEF2F2', color: '#DC2626' },
  'Partially Paid':{ label: 'Partly Paid',    bg: '#FFFBEB', color: '#D97706' },
  Paid:            { label: 'Paid',           bg: '#ECFDF5', color: '#059669' },
  Overdue:         { label: 'Overdue',        bg: '#FEF2F2', color: '#B91C1C' },
  Cancelled:       { label: 'Cancelled',      bg: '#F1F5F9', color: '#94A3B8' },
}

const UNITS     = ['Box', 'Sq Ft', 'Sq Mtr', 'Piece', 'Nos']
const GST_RATES = ['0', '5', '12', '18', '28']
const PAYMENT_MODES = ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card', 'Other']

const fmt = (n) => {
  const v = parseFloat(n) || 0
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—'
const today    = () => new Date().toISOString().slice(0, 10)
const plusDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

// ── Empty row / form factories ─────────────────────────────────
const emptyRow = () => ({
  _key:              Math.random().toString(36).slice(2),
  product_id: '', product_name: '', product_code: '',
  brand_name: '', category_name: '', sub_category_name: '',
  size: '', finish: '', tile_type: '', grade: '', color: '',
  hsn_code: '', unit: 'Pcs', gst_percent: 18,
  mrp: '', retail_price: '', dealer_price: '', purchase_price: '',
  pcs_per_box: '', sqft_per_box: '',
  qty: 1, rate: '', disc: 0,
  taxable_amount: 0, gst_amount: 0, total: 0,
})

const calcRow = (row) => {
  const qty   = parseFloat(row.qty)  || 0
  const rate  = parseFloat(row.rate) || 0
  const disc  = parseFloat(row.disc) || 0
  const gstP  = parseFloat(row.gst_percent) || 0
  const base  = qty * rate
  const discAmt  = base * disc / 100
  const taxable  = parseFloat((base - discAmt).toFixed(2))
  const gstAmt   = parseFloat((taxable * gstP / 100).toFixed(2))
  const total    = parseFloat((taxable + gstAmt).toFixed(2))
  return { taxable_amount: taxable, gst_amount: gstAmt, total }
}

const EMPTY_FORM = {
  invoice_no: '', quotation_id: '', quotation_no: '',
  sale_id: '', sale_code: '', order_id: '', order_no: '',
  customer_id: '', customer_name: '', customer_phone: '',
  customer_email: '', billing_address: '', shipping_address: '', gstin: '',
  invoice_date: today(), due_date: plusDays(30),
  items: [emptyRow()],
  freight_charges: '', other_charges: '', discount_amount: '', round_off: '',
  remarks: '', terms: 'Payment due within 30 days. GST as applicable.',
  paid_amount: 0,
}

// ── Searchable Product Dropdown ────────────────────────────────
function ProductSearch({ value, onChange, products }) {
  const [open, setOpen] = useState(false)
  const [q,    setQ]    = useState('')
  const ref             = useRef()

  const filtered = (products || []).filter(p =>
    (p.name || '').toLowerCase().includes(q.toLowerCase()) ||
    (p.code || '').toLowerCase().includes(q.toLowerCase()) ||
    (p.category_name || '').toLowerCase().includes(q.toLowerCase())
  ).slice(0, 50)

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const thumb = (p) => {
    const raw = Array.isArray(p.image_urls) ? p.image_urls.filter(Boolean)[0] : (p.product_image || '')
    if (!raw) return null
    if (raw.startsWith('http')) return raw
    const base = import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace('/api', '')
      : 'https://ezyenquiry-backend.onrender.com'
    return `${base}${raw}`
  }

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 200 }}>
      <input className="form-control" style={{ fontSize: 12, padding: '5px 8px' }}
        placeholder="Search product…"
        value={open ? q : (value || '')}
        onFocus={() => { setOpen(true); setQ('') }}
        onChange={e => setQ(e.target.value)} />
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 1002, marginTop: 2,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.14)',
          minWidth: 340, maxHeight: 320, overflowY: 'auto',
        }}>
          {filtered.length === 0
            ? <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>No products</div>
            : filtered.map(p => {
                const imgSrc = thumb(p)
                return (
                  <div key={p._id || p.id} onMouseDown={() => { onChange(p); setOpen(false); setQ('') }}
                    style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', gap: 10 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    {/* Thumbnail */}
                    {imgSrc
                      ? <img src={imgSrc} alt={p.name}
                          style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6,
                            border: '1px solid var(--border)', flexShrink: 0, background: '#f8fafc' }}
                          onError={e => { e.currentTarget.style.display = 'none' }} />
                      : <div style={{ width: 44, height: 44, borderRadius: 6, flexShrink: 0,
                          border: '1px solid var(--border)', background: 'var(--bg)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 18, color: 'var(--text-muted)' }}>📦</div>
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                        <span style={{ fontSize: 10, fontFamily: 'monospace', background: '#FFF3EC',
                          color: '#FD5C02', padding: '1px 6px', borderRadius: 4, fontWeight: 700,
                          flexShrink: 0 }}>{p.code}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {p.category_name && <span>📁 {p.category_name} </span>}
                        {p.brand_name    && <span>🏷 {p.brand_name}</span>}
                        {p.size          && <span> · 📐 {p.size}</span>}
                      </div>
                      {(p.mrp || p.dealer_price || p.retail_price) && (
                        <div style={{ fontSize: 11, color: '#059669', fontWeight: 700, marginTop: 2 }}>
                          MRP ₹{parseFloat(p.mrp || p.dealer_price || p.retail_price).toLocaleString('en-IN')}
                          {p.gst_percent ? <span style={{ color: '#7C3AED', marginLeft: 6, fontWeight: 400 }}>GST {p.gst_percent}%</span> : null}
                        </div>
                      )}
                      {p.available_stock != null && (
                        <div style={{ fontSize: 10.5, fontWeight: 700, marginTop: 2,
                          color: Number(p.available_stock) <= 0 ? '#DC2626' : '#0369A1' }}>
                          {Number(p.available_stock) <= 0
                            ? 'Out of stock'
                            : `${Number(p.available_stock).toLocaleString('en-IN')} ${p.unit || ''} in stock`}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
          }
        </div>
      )}
    </div>
  )
}

// ── Items Table ────────────────────────────────────────────────
function ItemsTable({ rows, onChange, products }) {
  const pickProduct = (idx, p) => {
    // Rate auto-filled from product MRP; fallback to dealer/retail price if MRP not set
    const rate = parseFloat(p.mrp || p.dealer_price || p.retail_price || 0)
    const updated = rows.map((r, i) => {
      if (i !== idx) return r
      const next = {
        ...r,
        product_id:        p._id || p.id || '',
        product_name:      p.name || '',
        product_code:      p.code || '',
        brand_name:        p.brand_name || '',
        category_name:     p.category_name || '',
        sub_category_name: p.sub_category_name || '',
        size:              p.size || '',
        finish:            p.finish || '',
        tile_type:         p.tile_type || '',
        grade:             p.grade || '',
        color:             p.color || '',
        hsn_code:          p.hsn_code || '',
        unit:              'Pcs',
        gst_percent:       p.gst_percent ?? 18,
        mrp:               p.mrp || '',
        retail_price:      p.retail_price || '',
        dealer_price:      p.dealer_price || '',
        purchase_price:    p.purchase_price || '',
        pcs_per_box:       p.pcs_per_box || '',
        sqft_per_box:      p.sqft_per_box || '',
        rate,
      }
      return { ...next, ...calcRow(next) }
    })
    onChange(updated)
  }

  const updateRow = (idx, field, val) => {
    const updated = rows.map((r, i) => {
      if (i !== idx) return r
      const next = { ...r, [field]: val }
      return { ...next, ...calcRow(next) }
    })
    onChange(updated)
  }

  const addRow = () => onChange([...rows, emptyRow()])
  const delRow = (idx) => onChange(rows.filter((_, i) => i !== idx))

  const inp = { fontSize: 12, padding: '5px 8px', border: '1px solid var(--border)',
    borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', outline: 'none', width: '100%' }
  const lbl = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: 3, display: 'block' }
  const chip = (val) => ({
    fontSize: 12, padding: '5px 8px', border: '1px solid var(--border)',
    borderRadius: 6, minHeight: 30, display: 'flex', alignItems: 'center',
    background: val ? '#F8FAFC' : 'var(--bg)',
    color: val ? 'var(--text)' : 'var(--text-muted)', fontWeight: val ? 600 : 400,
  })

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
          Products / Items <span style={{ color: 'var(--danger)' }}>*</span>
        </label>
        <button type="button" onClick={addRow} className="btn btn-sm btn-outline" style={{ gap: 5 }}>
          <Plus size={13} /> Add Row
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {rows.map((row, idx) => (
          <div key={row._key} style={{
            border: `2px solid ${row.product_id ? '#FD5C02' : 'var(--border)'}`,
            borderRadius: 12, background: 'var(--surface)',
            boxShadow: row.product_id ? '0 2px 10px rgba(253,92,2,.09)' : 'var(--shadow)',
            overflow: 'hidden',
          }}>
            {/* Top bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 16px', borderBottom: '1px solid var(--border)',
              background: row.product_id ? '#FFF9F5' : 'var(--bg)' }}>
              <span style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                background: row.product_id ? '#FD5C02' : 'var(--border)',
                color: row.product_id ? '#fff' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 800 }}>{idx + 1}</span>
              <div style={{ flex: 1 }}>
                <ProductSearch value={row.product_name} products={products}
                  onChange={(p) => pickProduct(idx, p)} />
                {row.product_code && (
                  <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 800,
                    color: '#FD5C02', marginTop: 2, display: 'inline-block' }}>{row.product_code}</span>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '.05em', color: 'var(--text-muted)' }}>Row Total</div>
                <div style={{ fontSize: 18, fontWeight: 900,
                  color: row.total > 0 ? '#FD5C02' : 'var(--text-muted)' }}>{fmt(row.total)}</div>
              </div>
              {rows.length > 1 && (
                <button type="button" onClick={() => delRow(idx)} style={{
                  background: 'none', border: '1px solid var(--border)', cursor: 'pointer',
                  color: 'var(--danger)', padding: '5px 7px', borderRadius: 6,
                  display: 'flex', alignItems: 'center', flexShrink: 0,
                }}><X size={13} /></button>
              )}
            </div>
            <div style={{ padding: '14px 16px' }}>
              {/* Product info chips */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 8, marginBottom: 10 }}>
                {[['Code', row.product_code], ['Brand', row.brand_name], ['Category', row.category_name],
                  ['Sub-Category', row.sub_category_name], ['Size', row.size],
                  ['Finish', row.finish], ['HSN Code', row.hsn_code]].map(([label, val]) => (
                  <div key={label}><span style={lbl}>{label}</span>
                    <div style={chip(val)}>{val || '—'}</div></div>
                ))}
              </div>
              {/* Editable fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '90px 60px 90px', gap: 8, marginBottom: 10 }}>
                <div><span style={lbl}>Qty</span>
                  <input style={{ ...inp, textAlign: 'center' }} type="number" min="1"
                    value={row.qty} onChange={e => updateRow(idx, 'qty', e.target.value)} /></div>
                {/* Unit — fixed to Pcs */}
                <div><span style={lbl}>Unit</span>
                  <div style={{ ...chip('Pcs'), justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>Pcs</div>
                </div>
                <div><span style={lbl}>Disc%</span>
                  <input style={{ ...inp, textAlign: 'center' }} type="number" min="0" max="100" step="0.01"
                    value={row.disc} onChange={e => updateRow(idx, 'disc', e.target.value)} /></div>
              </div>
              {/* Computed summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8,
                background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)' }}>
                {[['Qty', `${row.qty || 0} Pcs`, '#2563EB'],
                  ['Amount', fmt((parseFloat(row.qty)||0)*(parseFloat(row.rate)||0)), 'var(--text)'],
                  ['Discount', fmt((parseFloat(row.qty)||0)*(parseFloat(row.rate)||0)*(parseFloat(row.disc)||0)/100), '#D97706'],
                  ['GST Amt', fmt(row.gst_amount), '#7C3AED'],
                  ['Total', fmt(row.total), '#FD5C02']].map(([label, val, color]) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Totals Summary ─────────────────────────────────────────────
function TotalsSummary({ rows, freightCharges, otherCharges, discountAmount, roundOff }) {
  const subtotal  = rows.reduce((s, r) => s + (parseFloat(r.taxable_amount) || 0), 0)
  const gstAmt    = rows.reduce((s, r) => s + (parseFloat(r.gst_amount)     || 0), 0)
  const freight   = parseFloat(freightCharges)  || 0
  const other     = parseFloat(otherCharges)    || 0
  const discount  = parseFloat(discountAmount)  || 0
  const roundOff_ = parseFloat(roundOff)        || 0
  const grand     = subtotal + gstAmt + freight + other - discount + roundOff_

  return (
    <div style={{ marginLeft: 'auto', width: 320, background: 'var(--bg)',
      border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', marginTop: 12 }}>
      {[
        ['Taxable Amount', subtotal, 'var(--text)'],
        ['Total GST',      gstAmt,   '#7C3AED'],
        ['Freight',        freight,  'var(--text)'],
        ['Other Charges',  other,    'var(--text)'],
        ['Discount (-)',   discount, '#DC2626'],
        ['Round Off',      roundOff_,'var(--text-muted)'],
      ].map(([lbl, val, color]) => (
        <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between',
          fontSize: 12, marginBottom: 6 }}>
          <span style={{ color: 'var(--text-muted)' }}>{lbl}</span>
          <span style={{ fontWeight: 600, color }}>{fmt(val)}</span>
        </div>
      ))}
      <div style={{ borderTop: '2px solid var(--border)', paddingTop: 8, marginTop: 4,
        display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>Grand Total</span>
        <span style={{ fontWeight: 800, fontSize: 16, color: '#FD5C02' }}>{fmt(grand)}</span>
      </div>
    </div>
  )
}

// ── Invoice Form Modal ────────────────────────────────────────
function InvoiceModal({ editData, products: propProducts, customers, onSave, onClose, saving }) {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'Super Admin'
  const [form,          setForm]          = useState({ ...EMPTY_FORM, items: [emptyRow()] })
  const [errors,        setErrors]        = useState({})
  const [modalProducts, setModalProducts] = useState(propProducts || [])
  const [loadingProds,  setLoadingProds]  = useState(true)

  // Always fetch fresh products when modal mounts
  useEffect(() => {
    let cancelled = false
    const parse = (res) => {
      const p = res?.data ?? res
      const i = p?.data ?? p
      return Array.isArray(i) ? i : (Array.isArray(i?.products) ? i.products : [])
    }
    // Merge live available stock so the picker shows "X in stock".
    const enrichWithStock = async (list) => {
      try {
        const res = await api.get('/inventory', { params: { limit: 1000, _t: Date.now() } })
        const p = res?.data ?? res
        const invs = Array.isArray(p?.data?.inventory) ? p.data.inventory
          : Array.isArray(p?.inventory) ? p.inventory
          : Array.isArray(p?.data) ? p.data : []
        const stockMap = new Map()
        for (const inv of invs) {
          const pid = String(inv.product_id?._id || inv.product_id || '')
          if (!pid) continue
          const avail = (Number(inv.available_stock) || 0) > 0 ? Number(inv.available_stock) : (Number(inv.current_stock) || 0)
          stockMap.set(pid, (stockMap.get(pid) || 0) + avail)
        }
        return list.map(p => {
          const pid = String(p._id || p.id || '')
          return stockMap.has(pid) ? { ...p, available_stock: stockMap.get(pid) } : { ...p, available_stock: p.available_stock ?? null }
        })
      } catch { return list }
    }
    const applyProducts = async (list) => {
      const enriched = await enrichWithStock(list)
      if (!cancelled) { setModalProducts(enriched); setLoadingProds(false) }
    }

    const tryFetch = async () => {
      // 1) for-select — handles Super Admin too (no company_id filter)
      try {
        const list = parse(await api.get('/products/for-select', { params: { limit: 1000 } }))
        if (!cancelled && list.length > 0) { await applyProducts(list); return }
      } catch { /* fall through */ }
      // 2) Super Admin: /products/admin/all
      if (isSuperAdmin) {
        try {
          const list = parse(await api.get('/products/admin/all', { params: { limit: 1000 } }))
          if (!cancelled && list.length > 0) { await applyProducts(list); return }
        } catch { /* fall through */ }
      }
      // 3) Regular /products fallback
      try {
        const params = isSuperAdmin ? { limit: 1000, all_companies: true } : { limit: 500 }
        const list = parse(await api.get('/products', { params }))
        if (!cancelled && list.length > 0) { await applyProducts(list); return }
      } catch { /* ignore */ }
      if (!cancelled && propProducts?.length > 0) { await applyProducts(propProducts); return }
      if (!cancelled) setLoadingProds(false)
    }
    tryFetch()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (editData) {
      setForm({
        invoice_no:       editData.invoice_no       || '',
        quotation_id:     editData.quotation_id     || '',
        quotation_no:     editData.quotation_no     || '',
        sale_id:          editData.sale_id          || '',
        sale_code:        editData.sale_code        || '',
        order_id:         editData.order_id         || '',
        order_no:         editData.order_no         || '',
        customer_id:      editData.customer_id      || '',
        customer_name:    editData.customer_name    || '',
        customer_phone:   editData.customer_phone   || '',
        customer_email:   editData.customer_email   || '',
        billing_address:  editData.billing_address  || '',
        shipping_address: editData.shipping_address || '',
        gstin:            editData.gstin            || '',
        invoice_date:     editData.invoice_date?.slice(0, 10) || today(),
        due_date:         editData.due_date?.slice(0, 10)     || plusDays(30),
        items: (editData.items || []).length
          ? editData.items.map(it => ({ ...it, _key: Math.random().toString(36).slice(2) }))
          : [emptyRow()],
        freight_charges:  editData.freight_charges  ?? '',
        other_charges:    editData.other_charges    ?? '',
        discount_amount:  editData.discount_amount  ?? '',
        round_off:        editData.round_off        ?? '',
        remarks:          editData.remarks          || '',
        terms:            editData.terms            || EMPTY_FORM.terms,
        paid_amount:      editData.paid_amount      || 0,
      })
    } else {
      setForm({ ...EMPTY_FORM, items: [emptyRow()], invoice_date: today(), due_date: plusDays(30) })
    }
    setErrors({})
  }, [editData])

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  const buildPayload = () => {
    const subtotal     = form.items.reduce((s, r) => s + (parseFloat(r.taxable_amount) || 0), 0)
    const gst_amount   = form.items.reduce((s, r) => s + (parseFloat(r.gst_amount)     || 0), 0)
    const freight      = parseFloat(form.freight_charges) || 0
    const other        = parseFloat(form.other_charges)   || 0
    const discount     = parseFloat(form.discount_amount) || 0
    const roundOff     = parseFloat(form.round_off)       || 0
    const grand_total  = subtotal + gst_amount + freight + other - discount + roundOff
    return {
      ...form,
      invoice_no: form.invoice_no.trim() || undefined,
      items: form.items.map(({ _key, ...rest }) => rest),
      subtotal, gst_amount, grand_total,
      freight_charges: freight, other_charges: other,
      discount_amount: discount, round_off: roundOff,
    }
  }

  const validate = () => {
    const e = {}
    if (!(form.customer_name || '').trim()) e.customer_name = 'Customer name is required'
    if (!form.invoice_date)                 e.invoice_date  = 'Invoice date is required'
    if (!form.items.some(r => r.product_name || r.product_id)) e.items = 'Add at least one product'
    return e
  }

  const handleSubmit = () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    onSave(buildPayload())
  }

  const inp = (extra = {}) => ({
    className: 'form-control',
    style: { fontSize: 13, padding: '8px 11px', ...extra },
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      zIndex: 1000, overflowY: 'auto', padding: '24px 16px' }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%',
        maxWidth: 1000, boxShadow: '0 24px 64px rgba(0,0,0,.28)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid var(--border)',
          background: 'linear-gradient(135deg,#FD5C02,#FF8A42)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileText size={22} color="#fff" />
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>
                {editData ? 'Edit Invoice' : 'Create New Invoice'}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.8)' }}>
                {editData ? `Editing ${editData.invoice_no}` : 'Fill in invoice details below'}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.2)',
            border: 'none', borderRadius: 8, cursor: 'pointer',
            color: '#fff', padding: '6px 10px', display: 'flex', alignItems: 'center' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 24 }}>

          {/* ── Section: Invoice Details ── */}
          <div style={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase',
            letterSpacing: '.08em', color: '#FD5C02', marginBottom: 12 }}>Invoice Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Invoice No (auto if blank)
              </label>
              <input {...inp()} placeholder="e.g. INV-0001"
                value={form.invoice_no} onChange={e => set('invoice_no', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Invoice Date <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input {...inp()} type="date"
                value={form.invoice_date} onChange={e => set('invoice_date', e.target.value)} />
              {errors.invoice_date && <span style={{ fontSize: 11, color: 'var(--danger)' }}>{errors.invoice_date}</span>}
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Due Date
              </label>
              <input {...inp()} type="date"
                value={form.due_date} onChange={e => set('due_date', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Quotation No (ref)
              </label>
              <input {...inp()} placeholder="e.g. QT-0001"
                value={form.quotation_no} onChange={e => set('quotation_no', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Order No (ref)
              </label>
              <input {...inp()} placeholder="e.g. ORD-0001"
                value={form.order_no} onChange={e => set('order_no', e.target.value)} />
            </div>
          </div>

          {/* ── Section: Customer Info ── */}
          <div style={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase',
            letterSpacing: '.08em', color: '#FD5C02', marginBottom: 12 }}>Customer Information</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Customer Name <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input {...inp()} placeholder="Customer / Party name"
                value={form.customer_name} onChange={e => set('customer_name', e.target.value)} />
              {errors.customer_name && <span style={{ fontSize: 11, color: 'var(--danger)' }}>{errors.customer_name}</span>}
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Phone</label>
              <input {...inp()} placeholder="Mobile number"
                value={form.customer_phone} onChange={e => set('customer_phone', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Email</label>
              <input {...inp()} type="email" placeholder="customer@email.com"
                value={form.customer_email} onChange={e => set('customer_email', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>GSTIN</label>
              <input {...inp()} placeholder="22AAAAA0000A1Z5"
                value={form.gstin} onChange={e => set('gstin', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Billing Address</label>
              <input {...inp()} placeholder="Billing address"
                value={form.billing_address} onChange={e => set('billing_address', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Shipping Address</label>
              <input {...inp()} placeholder="Same as billing / different"
                value={form.shipping_address} onChange={e => set('shipping_address', e.target.value)} />
            </div>
          </div>

          {/* ── Items Table ── */}
          {errors.items && <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8 }}>{errors.items}</div>}
          <ItemsTable rows={form.items} products={modalProducts}
            onChange={(items) => set('items', items)} />
          {loadingProds && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              ⏳ Loading products…
            </div>
          )}

          {/* ── Charges & Totals ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginTop: 20 }}>
            {[
              ['Freight Charges', 'freight_charges'],
              ['Other Charges',   'other_charges'],
              ['Discount (₹)',    'discount_amount'],
              ['Round Off',       'round_off'],
            ].map(([label, key]) => (
              <div key={key}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{label}</label>
                <input {...inp()} type="number" min="0" step=".01" placeholder="0.00"
                  value={form[key]} onChange={e => set(key, e.target.value)} />
              </div>
            ))}
          </div>

          <TotalsSummary rows={form.items} freightCharges={form.freight_charges}
            otherCharges={form.other_charges} discountAmount={form.discount_amount} roundOff={form.round_off} />

          {/* ── Remarks & Terms ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 20 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Remarks</label>
              <textarea {...inp()} rows={3} placeholder="Internal remarks…"
                value={form.remarks} onChange={e => set('remarks', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Terms & Conditions</label>
              <textarea {...inp()} rows={3}
                value={form.terms} onChange={e => set('terms', e.target.value)} />
            </div>
          </div>

          {/* ── Actions ── */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24,
            paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <button onClick={onClose} className="btn btn-outline" disabled={saving}>Cancel</button>
            <button onClick={handleSubmit} className="btn btn-primary" disabled={saving}
              style={{ background: '#FD5C02', borderColor: '#FD5C02', minWidth: 120 }}>
              {saving ? 'Saving…' : editData ? 'Update Invoice' : 'Create Invoice'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Record Payment Modal ───────────────────────────────────────
function PaymentModal({ invoice, onSave, onClose, saving }) {
  const [form, setForm] = useState({
    amount: '', payment_date: today(), payment_mode: 'Cash', reference_no: '', note: '',
  })
  const [error, setError] = useState('')
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  const handleSubmit = () => {
    if (!form.amount || parseFloat(form.amount) <= 0) {
      setError('Enter a valid payment amount'); return
    }
    if (parseFloat(form.amount) > (invoice.balance_due || 0) + 0.01) {
      setError(`Amount cannot exceed balance due of ${fmt(invoice.balance_due)}`); return
    }
    setError('')
    onSave(form)
  }

  const inp = { className: 'form-control', style: { fontSize: 13, padding: '8px 11px' } }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 14, width: 420,
        boxShadow: '0 20px 60px rgba(0,0,0,.28)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)',
          background: 'linear-gradient(135deg,#059669,#10B981)', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IndianRupee size={20} color="#fff" />
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>Record Payment</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.8)' }}>
                Balance: {fmt(invoice.balance_due)} · {invoice.invoice_no}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.2)',
            border: 'none', borderRadius: 8, cursor: 'pointer', color: '#fff', padding: '5px 8px' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA',
            borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#DC2626' }}>{error}</div>}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Amount (₹) <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input {...inp} type="number" min="0.01" step=".01"
              placeholder={`Max: ${fmt(invoice.balance_due)}`}
              value={form.amount} onChange={e => set('amount', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Payment Mode</label>
            <select {...inp} value={form.payment_mode} onChange={e => set('payment_mode', e.target.value)}>
              {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Payment Date</label>
              <input {...inp} type="date" value={form.payment_date} onChange={e => set('payment_date', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Reference No</label>
              <input {...inp} placeholder="Txn / Cheque no"
                value={form.reference_no} onChange={e => set('reference_no', e.target.value)} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Note</label>
            <input {...inp} placeholder="Optional note"
              value={form.note} onChange={e => set('note', e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button onClick={onClose} className="btn btn-outline" disabled={saving}>Cancel</button>
            <button onClick={handleSubmit} className="btn btn-primary" disabled={saving}
              style={{ background: '#059669', borderColor: '#059669', minWidth: 120 }}>
              {saving ? 'Saving…' : 'Record Payment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── View Invoice Detail Modal ─────────────────────────────────
function ViewModal({ invoice, onClose, onEdit, onPayment, onStatusChange }) {
  if (!invoice) return null
  const sm = STATUS_META[invoice.status]         || STATUS_META.draft
  const pm = PAYMENT_STATUS_META[invoice.payment_status] || PAYMENT_STATUS_META.Unpaid

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      zIndex: 1000, overflowY: 'auto', padding: '24px 16px' }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%',
        maxWidth: 820, boxShadow: '0 24px 64px rgba(0,0,0,.28)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid var(--border)',
          background: 'linear-gradient(135deg,#01152D,#0A2040)' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#fff' }}>
              {invoice.invoice_no || '—'}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)' }}>
              {fmtDate(invoice.invoice_date)} · Due {fmtDate(invoice.due_date)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px',
              borderRadius: 20, background: pm.bg, color: pm.color }}>{pm.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px',
              borderRadius: 20, background: sm.bg, color: sm.color }}>{sm.label}</span>
            {invoice.status !== 'cancelled' && invoice.payment_status !== 'Paid' && (
              <button onClick={() => onPayment(invoice)} className="btn btn-sm"
                style={{ background: '#059669', color: '#fff', border: 'none', gap: 5 }}>
                <IndianRupee size={13} /> Pay
              </button>
            )}
            <button onClick={() => onEdit(invoice)} className="btn btn-sm btn-outline"
              style={{ color: '#FD5C02', borderColor: '#FD5C02' }}>
              <Edit2 size={13} />
            </button>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,.12)',
              border: 'none', borderRadius: 8, cursor: 'pointer',
              color: '#fff', padding: '6px 10px', display: 'flex', alignItems: 'center' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div style={{ padding: 24 }}>
          {/* Customer & Invoice info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '.06em', color: '#FD5C02', marginBottom: 8 }}>Customer</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 4 }}>
                {invoice.customer_name || '—'}</div>
              {invoice.customer_phone && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>📱 {invoice.customer_phone}</div>}
              {invoice.customer_email && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>✉️ {invoice.customer_email}</div>}
              {invoice.gstin          && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>🏢 GSTIN: {invoice.gstin}</div>}
              {invoice.billing_address && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{invoice.billing_address}</div>}
              {/* Who generated the invoice — name, company, phone, email. */}
              {(invoice.created_by_name || invoice.created_by_company || invoice.created_by_mobile) && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: 4 }}>
                    Created By{invoice.created_by_type ? ` (${invoice.created_by_type})` : ''}
                  </div>
                  {(invoice.created_by_person || invoice.created_by_name) && <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{invoice.created_by_person || invoice.created_by_name}</div>}
                  {invoice.created_by_company && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>🏢 {invoice.created_by_company}</div>}
                  {invoice.created_by_mobile && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>📱 {invoice.created_by_mobile}</div>}
                  {invoice.created_by_email && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>✉️ {invoice.created_by_email}</div>}
                </div>
              )}
            </div>
            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '.06em', color: '#FD5C02', marginBottom: 8 }}>Invoice Summary</div>
              {[
                ['Grand Total',  fmt(invoice.grand_total)],
                ['Paid Amount',  fmt(invoice.paid_amount)],
                ['Balance Due',  fmt(invoice.balance_due)],
              ].map(([lbl, val]) => (
                <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between',
                  fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{lbl}</span>
                  <span style={{ fontWeight: 700, color: lbl === 'Balance Due' && invoice.balance_due > 0 ? '#DC2626' : 'var(--text)' }}>{val}</span>
                </div>
              ))}
              {invoice.quotation_no && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>QT: {invoice.quotation_no}</div>}
              {invoice.order_no     && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Order: {invoice.order_no}</div>}
            </div>
          </div>

          {/* Linked Dispatch */}
          {invoice.dispatch && (
            <div style={{ marginBottom: 20, background: 'var(--bg)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '.06em', color: '#FD5C02', marginBottom: 8 }}>Linked Dispatch</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 8 }}>
                {invoice.dispatch.dispatch_code || '—'}
              </div>
              {[
                ['Status', invoice.dispatch.status?.replace(/_/g, ' ') || '—'],
                ['Driver', invoice.dispatch.driver_name || '—'],
                ['Mobile', invoice.dispatch.driver_mobile || '—'],
                ['Vehicle', invoice.dispatch.vehicle_number || '—'],
                ['Transport', invoice.dispatch.transport_name || '—'],
                ['LR Number', invoice.dispatch.lr_number || '—'],
                ['Dispatch Date', invoice.dispatch.dispatch_date ? fmtDate(invoice.dispatch.dispatch_date) : '—'],
                ['Expected Delivery', invoice.dispatch.expected_delivery ? fmtDate(invoice.dispatch.expected_delivery) : '—'],
                ['Delivered Date', invoice.dispatch.delivered_date ? fmtDate(invoice.dispatch.delivered_date) : '—'],
              ].filter(([, val]) => val && val !== '—').map(([lbl, val]) => (
                <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between',
                  fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{lbl}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>{val}</span>
                </div>
              ))}
              {invoice.dispatch.notes && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
                  📝 {invoice.dispatch.notes}
                </div>
              )}
            </div>
          )}

          {/* Items */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--text)' }}>
              Items ({invoice.items?.length || 0})
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--bg)' }}>
                    {['#', 'Product', 'Code', 'HSN', 'Qty', 'Rate', 'Disc%', 'Taxable', 'GST', 'Total'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: h === '#' ? 'center' : 'left',
                        fontWeight: 700, color: 'var(--text-muted)', borderBottom: '2px solid var(--border)',
                        textTransform: 'uppercase', letterSpacing: '.04em', fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(invoice.items || []).map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>{i + 1}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>{item.product_name || '—'}</td>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: '#FD5C02' }}>{item.product_code || '—'}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{item.hsn_code || '—'}</td>
                      <td style={{ padding: '8px 10px' }}>{item.qty} {item.unit}</td>
                      <td style={{ padding: '8px 10px' }}>{fmt(item.rate)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>{item.disc || 0}%</td>
                      <td style={{ padding: '8px 10px' }}>{fmt(item.taxable_amount)}</td>
                      <td style={{ padding: '8px 10px', color: '#7C3AED' }}>{fmt(item.gst_amount)} ({item.gst_percent}%)</td>
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: '#FD5C02' }}>{fmt(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment History */}
          {(invoice.payment_history || []).length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
                Payment History
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {invoice.payment_history.map((ph, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: '#ECFDF5', borderRadius: 8, padding: '8px 12px', border: '1px solid #A7F3D0' }}>
                    <div>
                      <span style={{ fontWeight: 700, color: '#059669', fontSize: 14 }}>{fmt(ph.amount)}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                        {ph.payment_mode} · {fmtDate(ph.payment_date)}
                      </span>
                      {ph.reference_no && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>Ref: {ph.reference_no}</span>}
                    </div>
                    {ph.note && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>{ph.note}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Remarks & Terms */}
          {(invoice.remarks || invoice.terms) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {invoice.remarks && (
                <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Remarks</div>
                  <div style={{ fontSize: 13, color: 'var(--text)' }}>{invoice.remarks}</div>
                </div>
              )}
              {invoice.terms && (
                <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Terms</div>
                  <div style={{ fontSize: 13, color: 'var(--text)' }}>{invoice.terms}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────
export default function InvoiceManagement({ products: propProducts = [], customers = [] }) {
  const [invoices,    setInvoices]    = useState([])
  const [products,    setProducts]    = useState(propProducts)
  const [summary,     setSummary]     = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [total,       setTotal]       = useState(0)
  const [page,        setPage]        = useState(1)
  const LIMIT = 20

  // filters
  const [search,         setSearch]        = useState('')
  const [filterStatus,   setFilterStatus]  = useState('')
  const [filterPayment,  setFilterPayment] = useState('')
  const [fromDate,       setFromDate]      = useState('')
  const [toDate,         setToDate]        = useState('')

  // modals
  const [showForm,    setShowForm]    = useState(false)
  const [editData,    setEditData]    = useState(null)
  const [viewInvoice, setViewInvoice] = useState(null)
  const [payInvoice,  setPayInvoice]  = useState(null)
  const [toast,       setToast]       = useState(null)

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  const loadInvoices = useCallback(async (pg = 1) => {
    setLoading(true)
    try {
      const res = await invoiceApi.list({
        page: pg, limit: LIMIT,
        search:         search         || undefined,
        status:         filterStatus   || undefined,
        payment_status: filterPayment  || undefined,
        from_date:      fromDate       || undefined,
        to_date:        toDate         || undefined,
      })
      setInvoices(res.data?.invoices || [])
      setTotal(res.data?.total       || 0)
      setPage(pg)
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to load invoices', 'error')
    } finally {
      setLoading(false)
    }
  }, [search, filterStatus, filterPayment, fromDate, toDate, showToast])

  const loadSummary = useCallback(async () => {
    try {
      const res = await invoiceApi.summary()
      setSummary(res.data)
    } catch { /* silent */ }
  }, [])

  useEffect(() => { loadInvoices(1); loadSummary() }, [loadInvoices, loadSummary])

  // ── Fetch products for dropdown (bypasses moduleAccess guard) ─
  const fetchProducts = useCallback(async () => {
    const parse = (res) => {
      const payload = res?.data ?? res
      const inner   = payload?.data ?? payload
      return Array.isArray(inner) ? inner : (Array.isArray(inner?.products) ? inner.products : [])
    }
    try {
      const list = parse(await api.get('/products/for-select', { params: { limit: 500 } }))
      if (list.length > 0) { setProducts(list); return }
    } catch { /* fall through */ }
    try {
      const list = parse(await api.get('/products', { params: { limit: 500 } }))
      if (list.length > 0) { setProducts(list); return }
    } catch { /* keep prop */ }
    if (propProducts.length > 0) setProducts(propProducts)
  }, [propProducts])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  // ── CRUD handlers ─────────────────────────────────────────
  const handleSave = async (payload) => {
    setSaving(true)
    try {
      if (editData) {
        const res = await invoiceApi.update(editData._id, payload)
        setInvoices(prev => prev.map(i => i._id === editData._id ? res.data : i))
        if (viewInvoice?._id === editData._id) setViewInvoice(res.data)
        showToast('Invoice updated successfully')
      } else {
        await invoiceApi.create(payload)
        showToast('Invoice created successfully')
        loadInvoices(1)
        loadSummary()
      }
      setShowForm(false)
      setEditData(null)
    } catch (err) {
      showToast(err?.response?.data?.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (inv) => {
    if (!window.confirm(`Delete invoice ${inv.invoice_no}? This cannot be undone.`)) return
    try {
      await invoiceApi.delete(inv._id)
      setInvoices(prev => prev.filter(i => i._id !== inv._id))
      setTotal(t => t - 1)
      if (viewInvoice?._id === inv._id) setViewInvoice(null)
      showToast('Invoice deleted')
      loadSummary()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Delete failed', 'error')
    }
  }

  const handleStatusChange = async (inv, status) => {
    try {
      const res = await invoiceApi.updateStatus(inv._id, status)
      setInvoices(prev => prev.map(i => i._id === inv._id ? res.data : i))
      if (viewInvoice?._id === inv._id) setViewInvoice(res.data)
      showToast(`Status updated to "${status}"`)
    } catch (err) {
      showToast(err?.response?.data?.message || 'Status update failed', 'error')
    }
  }

  const handlePayment = async (payload) => {
    setSaving(true)
    try {
      const res = await invoiceApi.recordPayment(payInvoice._id, payload)
      setInvoices(prev => prev.map(i => i._id === payInvoice._id ? res.data : i))
      if (viewInvoice?._id === payInvoice._id) setViewInvoice(res.data)
      setPayInvoice(null)
      showToast('Payment recorded successfully')
      loadSummary()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Payment failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const pages = Math.ceil(total / LIMIT)

  // ── Render ─────────────────────────────────────────────────
  return (
    <div style={{ padding: 24, minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999, maxWidth: 340,
          background: toast.type === 'error' ? '#FEF2F2' : '#ECFDF5',
          border: `1px solid ${toast.type === 'error' ? '#FCA5A5' : '#6EE7B7'}`,
          borderRadius: 10, padding: '12px 16px', boxShadow: '0 4px 20px rgba(0,0,0,.14)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {toast.type === 'error'
            ? <XCircle size={18} color="#DC2626" />
            : <CheckCircle size={18} color="#059669" />}
          <span style={{ fontSize: 13, fontWeight: 600,
            color: toast.type === 'error' ? '#DC2626' : '#059669' }}>{toast.msg}</span>
        </div>
      )}

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
            Invoice Management
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Create, manage, and track invoices & payments
          </p>
        </div>
        <button onClick={() => { setEditData(null); setShowForm(true) }}
          className="btn btn-primary"
          style={{ background: '#FD5C02', borderColor: '#FD5C02', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Plus size={16} /> New Invoice
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Total Invoices', value: summary.summary?.total_invoices || 0,
              sub: 'All time', icon: FileText, color: '#2563EB', bg: '#EFF6FF' },
            { label: 'Total Amount', value: fmt(summary.summary?.total_amount || 0),
              sub: 'Billed', icon: IndianRupee, color: '#FD5C02', bg: '#FFF3EC' },
            { label: 'Paid Amount', value: fmt(summary.summary?.paid_amount || 0),
              sub: 'Collected', icon: CheckCircle, color: '#059669', bg: '#ECFDF5' },
            { label: 'Balance Due', value: fmt(summary.summary?.balance_due || 0),
              sub: 'Outstanding', icon: AlertCircle,
              color: (summary.summary?.balance_due || 0) > 0 ? '#DC2626' : '#059669',
              bg:    (summary.summary?.balance_due || 0) > 0 ? '#FEF2F2' : '#ECFDF5' },
          ].map(c => (
            <div key={c.label} style={{ background: 'var(--surface)', borderRadius: 12,
              padding: '16px 20px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '.06em', color: 'var(--text-muted)' }}>{c.label}</span>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: c.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <c.icon size={16} color={c.color} />
                </div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{c.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{c.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '16px 20px',
        border: '1px solid var(--border)', marginBottom: 20, boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
              display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Search</label>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%',
                transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input className="form-control" style={{ paddingLeft: 32, fontSize: 13 }}
                placeholder="Invoice no, customer, order…"
                value={search} onChange={e => { setSearch(e.target.value); loadInvoices(1) }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
              display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>Status</label>
            <select className="form-control" style={{ fontSize: 13 }}
              value={filterStatus} onChange={e => { setFilterStatus(e.target.value); loadInvoices(1) }}>
              <option value="">All Statuses</option>
              {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
              display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>Payment</label>
            <select className="form-control" style={{ fontSize: 13 }}
              value={filterPayment} onChange={e => { setFilterPayment(e.target.value); loadInvoices(1) }}>
              <option value="">All Payments</option>
              {Object.keys(PAYMENT_STATUS_META).map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
              display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>From Date</label>
            <input className="form-control" style={{ fontSize: 13 }} type="date"
              value={fromDate} onChange={e => { setFromDate(e.target.value); loadInvoices(1) }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
              display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>To Date</label>
            <input className="form-control" style={{ fontSize: 13 }} type="date"
              value={toDate} onChange={e => { setToDate(e.target.value); loadInvoices(1) }} />
          </div>
          <button onClick={() => { setSearch(''); setFilterStatus(''); setFilterPayment('');
            setFromDate(''); setToDate(''); setTimeout(() => loadInvoices(1), 0) }}
            className="btn btn-outline" style={{ whiteSpace: 'nowrap', marginTop: 20 }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--surface)', borderRadius: 12,
        border: '1px solid var(--border)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
            Invoices ({total})
          </span>
          {loading && <RefreshCw size={16} style={{ color: 'var(--text-muted)', animation: 'spin 1s linear infinite' }} />}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                {['Invoice No', 'Customer', 'Date', 'Due Date', 'Grand Total',
                  'Paid', 'Balance', 'Status', 'Payment', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left',
                    fontWeight: 700, color: 'var(--text-muted)', borderBottom: '2px solid var(--border)',
                    textTransform: 'uppercase', letterSpacing: '.04em', fontSize: 11,
                    whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 && !loading && (
                <tr>
                  <td colSpan={10} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <FileText size={32} style={{ opacity: .3, marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                    No invoices found
                  </td>
                </tr>
              )}
              {invoices.map(inv => {
                const sm = STATUS_META[inv.status]                 || STATUS_META.draft
                const pm = PAYMENT_STATUS_META[inv.payment_status] || PAYMENT_STATUS_META.Unpaid
                return (
                  <tr key={inv._id} style={{ borderBottom: '1px solid var(--border)',
                    transition: 'background .15s', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#FD5C02', fontSize: 13 }}>
                        {inv.invoice_no || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{inv.customer_name || '—'}</div>
                      {inv.customer_phone && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{inv.customer_phone}</div>}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {fmtDate(inv.invoice_date)}
                    </td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                      <span style={{ color: inv.balance_due > 0 && new Date(inv.due_date) < new Date() ? '#DC2626' : 'var(--text-muted)' }}>
                        {fmtDate(inv.due_date)}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text)' }}>
                      {fmt(inv.grand_total)}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#059669', fontWeight: 600 }}>
                      {fmt(inv.paid_amount)}
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 700,
                      color: inv.balance_due > 0 ? '#DC2626' : '#059669' }}>
                      {fmt(inv.balance_due)}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px',
                        borderRadius: 20, background: sm.bg, color: sm.color, whiteSpace: 'nowrap' }}>
                        {sm.label}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px',
                        borderRadius: 20, background: pm.bg, color: pm.color, whiteSpace: 'nowrap' }}>
                        {pm.label}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button onClick={async () => {
                          try {
                            const res = await invoiceApi.get(inv._id)
                            if (res.success) setViewInvoice(res.data)
                          } catch (err) {
                            console.error('Failed to load invoice:', err)
                            setViewInvoice(inv) // Fallback to list data
                          }
                        }}
                          style={{ background: 'none', border: '1px solid var(--border)',
                            borderRadius: 6, cursor: 'pointer', padding: '4px 7px',
                            color: '#2563EB', display: 'flex', alignItems: 'center' }}
                          title="View"><Eye size={13} /></button>
                        <button onClick={() => { setEditData(inv); setShowForm(true) }}
                          style={{ background: 'none', border: '1px solid var(--border)',
                            borderRadius: 6, cursor: 'pointer', padding: '4px 7px',
                            color: '#FD5C02', display: 'flex', alignItems: 'center' }}
                          title="Edit"><Edit2 size={13} /></button>
                        {inv.payment_status !== 'Paid' && inv.status !== 'cancelled' && (
                          <button onClick={() => setPayInvoice(inv)}
                            style={{ background: '#ECFDF5', border: '1px solid #A7F3D0',
                              borderRadius: 6, cursor: 'pointer', padding: '4px 7px',
                              color: '#059669', display: 'flex', alignItems: 'center' }}
                            title="Record Payment"><IndianRupee size={13} /></button>
                        )}
                        <button onClick={() => handleDelete(inv)}
                          style={{ background: 'none', border: '1px solid var(--border)',
                            borderRadius: 6, cursor: 'pointer', padding: '4px 7px',
                            color: 'var(--danger)', display: 'flex', alignItems: 'center' }}
                          title="Delete"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Page {page} of {pages} · {total} invoices
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => loadInvoices(page - 1)} disabled={page <= 1} className="btn btn-outline btn-sm">
                <ChevronLeft size={14} />
              </button>
              <button onClick={() => loadInvoices(page + 1)} disabled={page >= pages} className="btn btn-outline btn-sm">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showForm && (
        <InvoiceModal editData={editData} products={products} customers={customers}
          saving={saving} onSave={handleSave}
          onClose={() => { setShowForm(false); setEditData(null) }} />
      )}
      {viewInvoice && (
        <ViewModal invoice={viewInvoice} onClose={() => setViewInvoice(null)}
          onEdit={(inv) => { setEditData(inv); setShowForm(true); setViewInvoice(null) }}
          onPayment={(inv) => { setPayInvoice(inv); setViewInvoice(null) }}
          onStatusChange={handleStatusChange} />
      )}
      {payInvoice && (
        <PaymentModal invoice={payInvoice} saving={saving}
          onSave={handlePayment} onClose={() => setPayInvoice(null)} />
      )}
    </div>
  )
}
