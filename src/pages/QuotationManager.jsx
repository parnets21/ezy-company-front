import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Plus, Search, Eye, Trash2, X, ChevronDown, FileText,
  CheckCircle, Send, XCircle, RefreshCw, Download,
  ChevronLeft, ChevronRight, Printer, Edit2, Calendar, Package
} from 'lucide-react'
import api from '../api/index'
import { useErp } from '../context/ErpContext'
import { useAuth } from '../context/AuthContext'

// ── Image URL helpers ─────────────────────────────────────────
const IMG_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'https://ezyenquiry-backend.onrender.com'
function imgUrl(p) {
  if (!p) return null
  if (p.startsWith('http')) return p
  return `${IMG_BASE}${p}`
}

// ── API helpers ───────────────────────────────────────────────
const quotationApi = {
  list:   (p = {}) => api.get('/quotations', { params: p }).then(r => r.data),
  get:    (id)     => api.get(`/quotations/${id}`).then(r => r.data),
  create: (d)      => api.post('/quotations', d).then(r => r.data),
  update: (id, d)  => api.put(`/quotations/${id}`, d).then(r => r.data),
  delete: (id)     => api.delete(`/quotations/${id}`).then(r => r.data),
  updateStatus: (id, status) => api.patch(`/quotations/${id}/status`, { status }).then(r => r.data),
}

// ── Constants ─────────────────────────────────────────────────
const STATUS_META = {
  draft:     { label: 'Draft',     bg: '#F1F5F9', color: '#64748B' },
  expired:   { label: 'Expired',   bg: '#FFFBEB', color: '#D97706' },
  converted: { label: 'Converted', bg: '#EFF6FF', color: '#0284C7' },
  sent:      { label: 'Sent',      bg: '#F0F9FF', color: '#2563EB' },
  accepted:  { label: 'Accepted',  bg: '#ECFDF5', color: '#059669' },
  cancelled: { label: 'Cancelled', bg: '#FEF2F2', color: '#DC2626' },
}

const UNITS = ['Box', 'Sq Ft', 'Sq Mtr', 'Piece', 'Nos']
const GST_RATES = ['0', '5', '12', '18', '28']

const fmt = (n) => {
  const v = parseFloat(n) || 0
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const today   = () => new Date().toISOString().slice(0, 10)
const plusDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

// ── Empty row factory ──────────────────────────────────────────
const emptyRow = () => ({
  _key: Math.random().toString(36).slice(2),
  product_id: '', product_name: '', product_code: '',
  brand_name: '', category_name: '', sub_category_name: '',
  size: '', finish: '', tile_type: '', grade: '',
  color: '', hsn_code: '',
  unit: 'Pcs', gst_percent: 18,
  mrp: '', retail_price: '', dealer_price: '', purchase_price: '',
  pcs_per_box: '', sqft_per_box: '',
  product_image: '',
  qty: 1, rate: '', disc: 0, total: 0,
})

// ── Row total calculator ───────────────────────────────────────
const calcRow = (row) => {
  const qty  = parseFloat(row.qty)  || 0
  const rate = parseFloat(row.rate) || 0
  const disc = parseFloat(row.disc) || 0
  const base = qty * rate * (1 - disc / 100)
  return parseFloat(base.toFixed(2))
}

// ── Searchable product dropdown ────────────────────────────────
function ProductSearch({ value, onChange, products }) {
  const [open, setOpen] = useState(false)
  const [q,    setQ]    = useState('')
  const ref             = useRef()

  const filtered = (products || []).filter(p =>
    (p.name || '').toLowerCase().includes(q.toLowerCase()) ||
    (p.code || '').toLowerCase().includes(q.toLowerCase()) ||
    (p.category_name || '').toLowerCase().includes(q.toLowerCase()) ||
    (p.brand_name || '').toLowerCase().includes(q.toLowerCase())
  ).slice(0, 50)

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const pick = (p) => { onChange(p); setOpen(false); setQ('') }

  // Resolve product thumbnail URL
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
      <input
        className="form-control"
        style={{ fontSize: 12, padding: '5px 8px' }}
        placeholder="Search product…"
        value={open ? q : (value || '')}
        onFocus={() => { setOpen(true); setQ('') }}
        onChange={e => setQ(e.target.value)}
      />
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 1001, marginTop: 2,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.14)',
          minWidth: 340, maxHeight: 320, overflowY: 'auto',
        }}>
          {filtered.length === 0
            ? <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                No products found
              </div>
            : filtered.map(p => {
                const imgSrc = thumb(p)
                return (
                  <div key={p._id || p.id}
                    onMouseDown={() => pick(p)}
                    style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', gap: 10 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Product thumbnail */}
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
                    {/* Product info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.name}
                        </span>
                        <span style={{ fontSize: 10, fontFamily: 'monospace', background: '#FFF3EC',
                          color: '#FD5C02', padding: '1px 6px', borderRadius: 4, fontWeight: 700,
                          flexShrink: 0 }}>
                          {p.code}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2,
                        display: 'flex', flexWrap: 'wrap', gap: '0 8px' }}>
                        {p.category_name && <span>📁 {p.category_name}</span>}
                        {p.brand_name    && <span>🏷 {p.brand_name}</span>}
                        {p.size          && <span>📐 {p.size}</span>}
                        {p.finish        && <span>✨ {p.finish}</span>}
                      </div>
                      {(p.mrp || p.dealer_price || p.retail_price) && (
                        <div style={{ fontSize: 11, color: '#059669', fontWeight: 700, marginTop: 2 }}>
                          MRP ₹{parseFloat(p.mrp || p.dealer_price || p.retail_price).toLocaleString('en-IN')}
                          {p.unit && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> / {p.unit}</span>}
                          {p.gst_percent ? <span style={{ color: '#7C3AED', marginLeft: 6 }}>GST {p.gst_percent}%</span> : null}
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

// ── Items Table inside modal ───────────────────────────────────
function ItemsTable({ rows, onChange, products }) {

  const pickProduct = (idx, p) => {
    // Rate auto-filled from product MRP; fallback to dealer/retail price if MRP not set
    const rate = parseFloat(p.mrp || p.dealer_price || p.retail_price || p.selling_price || 0)
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
        product_image:     (p.image_urls || []).filter(Boolean)[0] || '',
        rate,
      }
      next.total = calcRow(next)
      return next
    })
    onChange(updated)
  }

  const updateRow = (idx, field, val) => {
    const updated = rows.map((r, i) => {
      if (i !== idx) return r
      const next = { ...r, [field]: val }
      next.total = calcRow(next)
      return next
    })
    onChange(updated)
  }

  const addRow = () => onChange([...rows, emptyRow()])
  const delRow = (idx) => onChange(rows.filter((_, i) => i !== idx))

  // shared label
  const lbl = { fontSize:10, fontWeight:700, textTransform:'uppercase',
    letterSpacing:'.05em', color:'var(--text-muted)', marginBottom:3, display:'block' }
  // editable input
  const inp = { fontSize:12, padding:'5px 8px', border:'1px solid var(--border)',
    borderRadius:6, background:'var(--surface)', color:'var(--text)', outline:'none', width:'100%' }
  // read-only chip
  const chip = (val) => ({
    fontSize:12, padding:'5px 8px', border:'1px solid var(--border)',
    borderRadius:6, minHeight:30, display:'flex', alignItems:'center',
    background: val ? '#F8FAFC' : 'var(--bg)',
    color: val ? 'var(--text)' : 'var(--text-muted)',
    fontWeight: val ? 600 : 400, fontStyle: val ? 'normal' : 'italic',
  })
  // price chip
  const priceChip = (val) => ({
    ...chip(val),
    color: val && parseFloat(val) > 0 ? '#059669' : 'var(--text-muted)',
    fontWeight: 700, fontSize:11,
  })

  return (
    <div style={{ marginTop:8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <label style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>
          Products / Items <span style={{ color:'var(--danger)' }}>*</span>
        </label>
        <button type="button" onClick={addRow} className="btn btn-sm btn-outline" style={{ gap:5 }}>
          <Plus size={13}/> Add Row
        </button>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {rows.map((row, idx) => {
          const amount = (parseFloat(row.qty)||0) * (parseFloat(row.rate)||0)
          const discAmt = amount * (parseFloat(row.disc)||0) / 100
          const taxable = amount - discAmt
          const gstAmt  = taxable * (parseFloat(row.gst_percent)||0) / 100
          const total   = taxable + gstAmt

          return (
            <div key={row._key} style={{
              border:`2px solid ${row.product_id ? '#FD5C02' : 'var(--border)'}`,
              borderRadius:12, background:'var(--surface)',
              boxShadow: row.product_id ? '0 2px 10px rgba(253,92,2,.09)' : 'var(--shadow)',
              overflow:'hidden', transition:'border-color .2s',
            }}>

              {/* ── Card top bar: # + Product search + Total ── */}
              <div style={{ display:'flex', alignItems:'center', gap:10,
                padding:'12px 16px', borderBottom:'1px solid var(--border)',
                background: row.product_id ? '#FFF9F5' : 'var(--bg)' }}>
                <span style={{ width:26, height:26, borderRadius:'50%', flexShrink:0,
                  background: row.product_id ? '#FD5C02' : 'var(--border)',
                  color: row.product_id ? '#fff' : 'var(--text-muted)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:11, fontWeight:800 }}>{idx+1}</span>

                {/* Product image thumbnail */}
                {row.product_id && (
                  imgUrl(row.product_image) ? (
                    <img src={imgUrl(row.product_image)} alt={row.product_name}
                      style={{ width:44, height:44, borderRadius:8, objectFit:'cover',
                        border:'1px solid var(--border)', flexShrink:0, background:'#fff' }}
                      onError={(e) => { e.currentTarget.style.display = 'none' }} />
                  ) : (
                    <span style={{ width:44, height:44, borderRadius:8, flexShrink:0,
                      border:'1px solid var(--border)', background:'var(--bg)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      color:'var(--text-muted)' }}>
                      <Package size={18} />
                    </span>
                  )
                )}

                <div style={{ flex:1 }}>
                  <ProductSearch value={row.product_name} products={products}
                    onChange={(p) => pickProduct(idx, p)} />
                  {row.product_code && (
                    <span style={{ fontSize:10, fontFamily:'monospace', fontWeight:800,
                      color:'#FD5C02', marginTop:2, display:'inline-block' }}>
                      {row.product_code}
                    </span>
                  )}
                </div>

                {/* Total display */}
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase',
                    letterSpacing:'.05em', color:'var(--text-muted)' }}>Row Total</div>
                  <div style={{ fontSize:18, fontWeight:900,
                    color: total>0 ? '#FD5C02' : 'var(--text-muted)' }}>
                    {fmt(total)}
                  </div>
                </div>

                {rows.length > 1 && (
                  <button type="button" onClick={() => delRow(idx)} style={{
                    background:'none', border:'1px solid var(--border)', cursor:'pointer',
                    color:'var(--danger)', padding:'5px 7px', borderRadius:6,
                    display:'flex', alignItems:'center', flexShrink:0,
                  }}><X size={13}/></button>
                )}
              </div>

              <div style={{ padding:'14px 16px' }}>

                {/* ── ROW 1: Product Info chips (7 cols) ── */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:8, marginBottom:10 }}>
                  {[
                    ['Code',           row.product_code],
                    ['Brand',          row.brand_name],
                    ['Category',       row.category_name],
                    ['Sub-Category',   row.sub_category_name],
                    ['Size',           row.size],
                    ['Finish',         row.finish],
                    ['Tile Type',      row.tile_type],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <span style={lbl}>{label}</span>
                      <div style={chip(val)}>{val || '—'}</div>
                    </div>
                  ))}
                </div>

                {/* ── ROW 2: More product info (7 cols) ── */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8, marginBottom:12 }}>
                  {[
                    ['Grade',         row.grade],
                    ['Unit / GST',    row.unit ? `${row.unit} / ${row.gst_percent}%` : ''],
                    ['MRP',           row.mrp       ? `₹${parseFloat(row.mrp).toFixed(2)}`       : ''],
                    ['Purchase Rate', row.purchase_price? `₹${parseFloat(row.purchase_price).toFixed(2)}`: ''],
                    ['Pcs/Box · Sqft/Box', [row.pcs_per_box, row.sqft_per_box].filter(Boolean).join(' · ') || ''],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <span style={lbl}>{label}</span>
                      <div style={priceChip(val)}>{val || '—'}</div>
                    </div>
                  ))}
                </div>

                {/* ── ROW 3: Editable fields ── */}
                <div style={{ display:'grid', gridTemplateColumns:'90px 60px 90px', gap:8, marginBottom:10 }}>
                  <div>
                    <span style={lbl}>Qty</span>
                    <input style={{ ...inp, textAlign:'center' }} type="number" min="1"
                      value={row.qty} onChange={e => updateRow(idx,'qty',e.target.value)} />
                  </div>
                  {/* Unit — fixed to Pcs */}
                  <div>
                    <span style={lbl}>Unit</span>
                    <div style={{ ...chip('Pcs'), justifyContent:'center', fontWeight:700, fontSize:12 }}>Pcs</div>
                  </div>
                  <div>
                    <span style={lbl}>Disc%</span>
                    <input style={{ ...inp, textAlign:'center' }} type="number" min="0" max="100" step="0.01"
                      value={row.disc} onChange={e => updateRow(idx,'disc',e.target.value)} />
                  </div>
                </div>

                {/* ── ROW 4: Computed summary ── */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8,
                  background:'var(--bg)', borderRadius:8, padding:'10px 12px',
                  border:'1px solid var(--border)' }}>
                  {[
                    ['Qty',        `${row.qty || 0} Pcs`,            '#2563EB'],
                    ['Amount',     fmt(amount),                       'var(--text)'],
                    ['Discount',   fmt(discAmt),                      '#D97706'],
                    ['GST Amt',    fmt(gstAmt),                       '#7C3AED'],
                    ['Total',      fmt(total),                        '#FD5C02'],
                  ].map(([label, val, color]) => (
                    <div key={label} style={{ textAlign:'center' }}>
                      <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase',
                        letterSpacing:'.05em', color:'var(--text-muted)', marginBottom:3 }}>{label}</div>
                      <div style={{ fontSize:14, fontWeight:800, color }}>{val}</div>
                    </div>
                  ))}
                </div>

              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Totals summary box ─────────────────────────────────────────
function TotalsSummary({ rows, freightCharges, otherCharges }) {
  const subtotal = rows.reduce((s, r) => s + (parseFloat(r.total) || 0), 0)
  const gstAmt   = rows.reduce((s, r) => {
    const base = parseFloat(r.total) || 0
    const gst  = parseFloat(r.gst_percent) || 0
    return s + base * gst / 100
  }, 0)
  const freight  = parseFloat(freightCharges) || 0
  const other    = parseFloat(otherCharges)   || 0
  const grand    = subtotal + gstAmt + freight + other

  return (
    <div style={{ marginLeft: 'auto', width: 300, background: 'var(--bg)',
      border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', marginTop: 12 }}>
      {[
        ['Subtotal',       subtotal],
        ['GST',            gstAmt],
        ['Freight Charges',freight],
        ['Other Charges',  other],
      ].map(([lbl, val]) => (
        <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between',
          fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
          <span>{lbl}</span>
          <span style={{ fontWeight: 600, color: 'var(--text)' }}>{fmt(val)}</span>
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

// ── Enquiry Searchable Dropdown ────────────────────────────────
function EnquirySelect({ value, onChange, enquiries }) {
  const [open, setOpen] = useState(false)
  const [q,    setQ]    = useState('')
  const ref             = useRef()

  const list     = enquiries || []
  const filtered = list
    .filter(e => e.retailer_mobile && e.retailer_email)
    .filter(e =>
      (e.enq_code        || '').toLowerCase().includes(q.toLowerCase()) ||
      (e.retailer_name   || '').toLowerCase().includes(q.toLowerCase()) ||
      (e.retailer_mobile || '').includes(q)
    )
    .slice(0, 50)
  const selected = list.find(e => (e._id || e.id) === value)

  useEffect(() => {
    const h = (ev) => { if (ref.current && !ref.current.contains(ev.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        onClick={() => { setOpen(o => !o); setQ('') }}
        style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'8px 11px', border:'1px solid var(--border)', borderRadius:7,
          background:'var(--surface)', cursor:'pointer', fontSize:13, minHeight:38,
          color: selected ? 'var(--text)' : 'var(--text-muted)', transition:'border-color .15s',
          ...(open && { borderColor:'#FD5C02', boxShadow:'0 0 0 3px rgba(253,92,2,.12)' }),
        }}
      >
      {selected ? (
          <div style={{ flex:1, minWidth:0, overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'nowrap' }}>
              <span style={{
                fontSize:11, fontFamily:'monospace', fontWeight:800,
                color:'#FD5C02', flexShrink:0,
              }}>{selected.enq_code}</span>
              <span style={{
                fontWeight:700, fontSize:13, color:'var(--text)',
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
              }}>{selected.retailer_name}</span>
            </div>
          </div>
        ) : (
          <span style={{ flex:1, color:'var(--text-muted)' }}>Search enquiry…</span>
        )}
        <ChevronDown size={13} style={{ flexShrink:0, marginLeft:6, color:'var(--text-muted)',
          transform: open?'rotate(180deg)':'none', transition:'transform .15s' }} />
      </div>
      {open && (
        <div style={{
          position:'absolute', top:'100%', left:0, right:0, zIndex:1000, marginTop:2,
          background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8,
          boxShadow:'0 8px 28px rgba(0,0,0,.14)', overflow:'hidden',
        }}>
          <div style={{ padding:'7px 8px 4px' }}>
            <input autoFocus className="form-control" style={{ fontSize:12, padding:'6px 9px' }}
              placeholder="Search by ENQ code or customer name…" value={q}
              onChange={e => setQ(e.target.value)} onClick={e => e.stopPropagation()} />
          </div>
          <div style={{ maxHeight:220, overflowY:'auto' }}>
            <div onMouseDown={() => { onChange(null); setOpen(false) }}
              style={{ padding:'8px 14px', fontSize:13, color:'var(--text-muted)', cursor:'pointer',
                borderBottom:'1px solid var(--border)' }}>— None —</div>
            {filtered.length === 0
              ? <div style={{ padding:'10px 14px', fontSize:12, color:'var(--text-muted)' }}>No enquiries found</div>
              : filtered.map(e => (
                <div key={e._id||e.id}
                  onMouseDown={() => { onChange(e); setOpen(false); setQ('') }}
                  style={{
                    padding:'9px 14px', cursor:'pointer',
                    borderBottom:'1px solid var(--border)',
                    background: (e._id||e.id)===value ? '#FFF3EC' : 'transparent',
                  }}
                  onMouseEnter={ev => { if ((e._id||e.id)!==value) ev.currentTarget.style.background='var(--bg)' }}
                  onMouseLeave={ev => { ev.currentTarget.style.background=(e._id||e.id)===value?'#FFF3EC':'transparent' }}
                >
                  {/* Line 1: ENQ code + status */}
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                    <span style={{ fontSize:11, fontFamily:'monospace', fontWeight:800, color:'#FD5C02' }}>
                      {e.enq_code}
                    </span>
                    <span style={{
                      fontSize:10, fontWeight:600, padding:'1px 6px', borderRadius:8,
                      background: e.status==='New'?'#ECFDF5': e.status==='Confirmed'?'#EFF6FF':'#F1F5F9',
                      color:      e.status==='New'?'#059669': e.status==='Confirmed'?'#2563EB':'#64748B',
                    }}>{e.status}</span>
                  </div>
                  {/* Line 2: Customer name — main identifier */}
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>
                    {e.retailer_name}
                  </div>
                  {/* Line 3: Phone + product */}
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:1, display:'flex', flexWrap:'wrap', gap:'0 10px' }}>
                    {e.retailer_mobile && (
                      <span>📱 {e.retailer_mobile}</span>
                    )}
                    {e.retailer_email && (
                      <span>✉️ {e.retailer_email}</span>
                    )}
                    {e.product_name && (
                      <span>📦 {e.product_name}{e.qty ? ` (${e.qty} ${e.unit||''})` : ''}</span>
                    )}
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  )
}

// ── Quotation Form Modal ───────────────────────────────────────
const EMPTY_FORM = {
  quotation_no: '',
  enquiry_id: '', enquiry_no: '',
  customer_name: '', customer_phone: '', customer_email: '',
  delivery_no: '',
  quotation_date: today(), valid_until: plusDays(30),
  freight_charges: '', other_charges: '',
  remarks: '', terms: 'Prices are subject to change. GST extra as applicable.',
  items: [emptyRow()],
}

function QuotationModal({ editData, products: propProducts, enquiries, onSave, onClose, saving }) {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'Super Admin'
  const [form,          setForm]          = useState(EMPTY_FORM)
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
    // Merge live available stock (from /inventory) into the product list so the
    // picker can show "X in stock" next to each product.
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
      } catch {
        return list
      }
    }
    const applyProducts = async (list) => {
      const enriched = await enrichWithStock(list)
      if (!cancelled) { setModalProducts(enriched); setLoadingProds(false) }
    }

    // Resolve a product's creator type — mirrors Product Management's
    // "ADDED BY" badge logic (creatorTypeOf) so the quotation dropdown shows
    // exactly the same admin-added products as the Products page.
    const creatorTypeOf = (p = {}) => {
      if (p.created_by_type) return p.created_by_type
      const role = String(p.created_by?.role || '').toLowerCase()
      if (role.includes('retail')) return 'Retailer'
      if (role.includes('whole'))  return 'Wholesaler'
      if (role.includes('admin'))  return 'Admin'
      const biz = String(p.company_id?.biz_type || '').toLowerCase()
      if (biz.includes('retail')) return 'Retailer'
      if (biz.includes('whole'))  return 'Wholesaler'
      if (String(p.code || '').toUpperCase().startsWith('RPD-')) return 'Retailer'
      if (String(p.source || '').toLowerCase() === 'admin') return 'Admin'
      return 'Unknown'
    }
    // Only show products added by Admin in the quotation dropdown.
    const adminOnly = (list) => (list || []).filter(p => creatorTypeOf(p) === 'Admin')

    const tryFetch = async () => {
      // 1) for-select — works for all roles, Super Admin gets all company products.
      //    admin_only tells the API to return admin-added products only.
      try {
        const res  = await api.get('/products/for-select', { params: { limit: 1000, admin_only: true } })
        const list = adminOnly(parse(res))
        if (!cancelled && list.length > 0) { await applyProducts(list); return }
      } catch { /* fall through */ }
      // 2) For Super Admin: try /products/admin/all
      if (isSuperAdmin) {
        try {
          const res  = await api.get('/products/admin/all', { params: { limit: 1000 } })
          const list = adminOnly(parse(res))
          if (!cancelled && list.length > 0) { await applyProducts(list); return }
        } catch { /* fall through */ }
      }
      // 3) Regular /products fallback
      try {
        const params = isSuperAdmin ? { limit: 1000, all_companies: true } : { limit: 500 }
        const res  = await api.get('/products', { params })
        const list = adminOnly(parse(res))
        if (!cancelled && list.length > 0) { await applyProducts(list); return }
      } catch { /* ignore */ }
      if (!cancelled && propProducts?.length > 0) { await applyProducts(adminOnly(propProducts)); return }
      if (!cancelled) setLoadingProds(false)
    }
    tryFetch()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (editData) {
      setForm({
        quotation_no:    editData.quotation_no    || '',
        enquiry_id:      editData.enquiry_id      || '',
        enquiry_no:      editData.enquiry_no      || '',
        customer_name:   editData.customer_name   || '',
        customer_phone:  editData.customer_phone  || '',
        customer_email:  editData.customer_email  || '',
        delivery_no:     editData.delivery_no     || '',
        quotation_date:  editData.quotation_date?.slice(0,10) || today(),
        valid_until:     editData.valid_until?.slice(0,10)    || plusDays(30),
        freight_charges: editData.freight_charges ?? '',
        other_charges:   editData.other_charges   ?? '',
        remarks:         editData.remarks         || '',
        terms:           editData.terms           || EMPTY_FORM.terms,
        items: (editData.items||[]).length
          ? editData.items.map(it => ({ ...it, _key: Math.random().toString(36).slice(2) }))
          : [emptyRow()],
      })
    } else {
      setForm({ ...EMPTY_FORM, items:[emptyRow()], quotation_date:today(), valid_until:plusDays(30) })
    }
    setErrors({})
  }, [editData])

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  // Pick enquiry → auto-fill customer + pre-fill product row
  const pickEnquiry = (enq) => {
    if (!enq) { setForm(p => ({ ...p, enquiry_id:'', enquiry_no:'' })); return }
    setForm(prev => {
      let items = prev.items
      if (enq.product_name || enq.product_id) {
        const first = items[0]
        if (!first.product_name && !first.product_id) {
          const rate = enq.offered_price || 0
          items = [{
            ...first,
            product_id:   enq.product_id || '',
            product_name: enq.product_name || '',
            qty:          enq.qty || 1,
            unit:         enq.unit || 'Box',
            rate,
            gst_percent:  18,
            total:        calcRow({ qty: enq.qty||1, rate, disc: 0 }),
          }, ...items.slice(1)]
        }
      }
      return {
        ...prev,
        enquiry_id:     enq._id  || enq.id || '',
        enquiry_no:     enq.enq_code || '',
        customer_name:  enq.retailer_name   || prev.customer_name,
        customer_phone: enq.retailer_mobile || prev.customer_phone,
        customer_email: enq.retailer_email  || prev.customer_email,
        items,
      }
    })
  }

  const validate = () => {
    const e = {}
    if (!(form.customer_name||'').trim())
      e.customer_name = 'Customer / Retailer name is required'
    if (!form.quotation_date) e.quotation_date = 'Quotation date is required'
    if (!form.items.some(r => r.product_name || r.product_id)) e.items = 'Add at least one product'
    if (!(form.delivery_no||'').trim()) e.delivery_no = 'Delivery address is required'
    return e
  }

  const buildPayload = () => {
    const subtotal = form.items.reduce((s,r) => s+(parseFloat(r.total)||0), 0)
    const gstAmt   = form.items.reduce((s,r) => s+((parseFloat(r.total)||0)*(parseFloat(r.gst_percent)||0)/100), 0)
    const grand    = subtotal + gstAmt + (parseFloat(form.freight_charges)||0) + (parseFloat(form.other_charges)||0)
    return {
      ...form,
      quotation_no: form.quotation_no.trim() || undefined,
      items: form.items.map(({_key,...rest})=>rest),
      subtotal, gst_amount:gstAmt, grand_total:grand,
    }
  }

  const handleSubmit = () => {
    const e = validate(); if (Object.keys(e).length){ setErrors(e); return }
    onSave(buildPayload())
  }
  const handlePrint = () => {
    const e = validate(); if (Object.keys(e).length){ setErrors(e); return }
    printQuotation({ ...buildPayload(), quotation_no: editData?.quotation_no || 'PREVIEW' })
  }

  const fc = (extra={}) => ({ className:'form-control', style:{ fontSize:13, ...extra } })

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background:'var(--surface)', borderRadius:14,
        boxShadow:'0 20px 60px rgba(0,0,0,.18)',
        width:'100%', maxWidth:980, maxHeight:'94vh', overflowY:'auto',
        animation:'modalIn .2s ease',
      }}>

        {/* ── Sticky Header ── */}
        <div style={{
          padding:'18px 24px 14px', borderBottom:'1px solid var(--border)',
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
          position:'sticky', top:0, background:'var(--surface)', zIndex:10,
          borderRadius:'14px 14px 0 0',
        }}>
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:'var(--text)' }}>
              {editData ? `Edit Quotation${editData.quotation_no ? ` — ${editData.quotation_no}` : ''}` : 'New Quotation'}
            </div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
              Select an enquiry to auto-fill customer details, add products, save or print
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer',
            color:'var(--text-muted)', padding:6, borderRadius:6, display:'flex', alignItems:'center' }}>
            <X size={18}/>
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ padding:'22px 24px' }}>

          {/* ═══ SECTION 1: Quotation Info ═══ */}
          <div style={{
            background: 'linear-gradient(135deg, #FFF9F5 0%, #FFF3EC 100%)',
            border: '1.5px solid #FFD9BE',
            borderRadius: 12,
            padding: '16px 18px',
            marginBottom: 18,
            boxShadow: '0 2px 8px rgba(253,92,2,0.07)',
          }}>
          <div style={{ fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:'.07em',
            color:'#FD5C02', marginBottom:14, paddingBottom:6, borderBottom:'2px solid #FFF3EC' }}>
            Quotation Information
          </div>

          {/* Row: Quotation No | Enquiry | Quotation Date | Valid Until */}
          <div style={{ display:'grid', gridTemplateColumns:'180px 1fr 1fr 1fr', gap:14, marginBottom:20 }}>

            <div>
              <label className="form-label">Quotation Number</label>
              <input
                {...fc({ fontFamily:'monospace', fontWeight:700, letterSpacing:'.04em' })}
                value={form.quotation_no}
                onChange={e => set('quotation_no', e.target.value)}
                placeholder="e.g. QT-0001"
              />
              <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:3 }}>
                Leave blank to auto-generate
              </div>
            </div>

            <div>
              <label className="form-label">Quotation Date <span style={{ color:'var(--danger)' }}>*</span></label>
              <input {...fc(errors.quotation_date ? { borderColor:'var(--danger)' } : {})}
                type="date" value={form.quotation_date}
                onChange={e => set('quotation_date', e.target.value)} />
              {errors.quotation_date && <div className="form-error">{errors.quotation_date}</div>}
            </div>

            <div>
              <label className="form-label">Valid Until</label>
              <input {...fc()} type="date" value={form.valid_until}
                onChange={e => set('valid_until', e.target.value)} />
            </div>
          </div>
          </div>

          {/* ═══ SECTION 2: Customer Details ═══ */}
          <div style={{
            background: 'linear-gradient(135deg, #F0F7FF 0%, #EFF6FF 100%)',
            border: '1.5px solid #BFDBFE',
            borderRadius: 12,
            padding: '16px 18px',
            marginBottom: 18,
            boxShadow: '0 2px 8px rgba(37,99,235,0.07)',
          }}>
          <div style={{ fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:'.07em',
            color:'#2563EB', marginBottom:14, paddingBottom:6, borderBottom:'2px solid #EFF6FF' }}>
            Customer Details
          </div>

          {/* Row: Customer | Mobile | Email */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14, marginBottom:22 }}>
            <div>
              <label className="form-label">Customer / Retailer <span style={{ color:'var(--danger)' }}>*</span></label>
              <input {...fc()} value={form.customer_name}
                onChange={e => set('customer_name', e.target.value)}
                placeholder="Customer or retailer name"
                className={`form-control${errors.customer_name ? ' error' : ''}`} />
              {errors.customer_name && <div className="form-error">{errors.customer_name}</div>}
            </div>
            <div>
              <label className="form-label">Mobile</label>
              <input {...fc()} type="tel" value={form.customer_phone}
                onChange={e => set('customer_phone', e.target.value)}
                placeholder="Mobile number" />
            </div>
            <div>
              <label className="form-label">Email</label>
              <input {...fc()} type="email" value={form.customer_email}
                onChange={e => set('customer_email', e.target.value)}
                placeholder="Email address" />
            </div>
          </div>
          </div>
          {/* Delivery Address — required */}
          <div className="form-group" style={{ marginBottom:18 }}>
            <label className="form-label">
              Delivery Address <span style={{ color:'var(--danger)' }}>*</span>
            </label>
            <textarea className="form-control" rows={2}
              value={form.delivery_no || ''}
              onChange={e => set('delivery_no', e.target.value)}
              placeholder="Full delivery address — street, city, pincode"
              style={{ resize:'vertical' }}
            />
            {!(form.delivery_no?.trim()) && errors.delivery_no ? (
              <div className="form-error" style={{ display:'flex', alignItems:'center', gap:4, marginTop:3 }}>
                📍 {errors.delivery_no}
              </div>
            ) : null}
          </div>

          {/* ═══ SECTION 3: Products ═══ */}
          <div style={{
            background: 'var(--surface)',
            border: '1.5px solid var(--border)',
            borderRadius: 12,
            padding: '16px 18px',
            marginBottom: 18,
            boxShadow: 'var(--shadow)',
          }}>
          <div style={{ fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:'.07em',
            color:'#FD5C02', marginBottom:10, paddingBottom:6, borderBottom:'2px solid #FFF3EC' }}>
            Products / Items
          </div>
          {errors.items && (
            <div className="alert alert-danger" style={{ marginBottom:8, padding:'8px 12px', fontSize:12 }}>
              {errors.items}
            </div>
          )}
          <ItemsTable rows={form.items} products={modalProducts} onChange={items => set('items', items)} />
          {loadingProds && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Loading products…
            </div>
          )}

          {/* Charges + Totals inline */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:14, marginTop:16,
            background:'var(--bg)', borderRadius:10, padding:'14px 16px', border:'1px solid var(--border)' }}>
            {[['freight_charges','Freight Charges (₹)'],['other_charges','Other Charges (₹)']].map(([k,lbl]) => (
              <div key={k}>
                <label className="form-label" style={{ fontSize:11 }}>{lbl}</label>
                <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)',
                    fontSize:12, color:'var(--text-muted)', pointerEvents:'none' }}>₹</span>
                  <input {...fc({ paddingLeft:20, fontSize:12 })} type="number" min="0" step=".01"
                    value={form[k]} onChange={e => set(k, e.target.value)} placeholder="0" />
                </div>
              </div>
            ))}
            {/* Live subtotal + grand total */}
            {(() => {
              const sub   = form.items.reduce((s,r) => s+(parseFloat(r.total)||0), 0)
              const gst   = form.items.reduce((s,r) => s+((parseFloat(r.total)||0)*(parseFloat(r.gst_percent)||0)/100), 0)
              const grand = sub + gst + (parseFloat(form.freight_charges)||0) + (parseFloat(form.other_charges)||0)
              return <>
                <div style={{ display:'flex', flexDirection:'column', justifyContent:'center' }}>
                  <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase',
                    letterSpacing:'.05em', color:'var(--text-muted)', marginBottom:3 }}>Subtotal + GST</div>
                  <div style={{ fontSize:16, fontWeight:800, color:'var(--text)' }}>{fmt(sub + gst)}</div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', justifyContent:'center',
                  borderLeft:'2px solid #FD5C02', paddingLeft:14 }}>
                  <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase',
                    letterSpacing:'.05em', color:'#FD5C02', marginBottom:3 }}>Grand Total</div>
                  <div style={{ fontSize:20, fontWeight:900, color:'#FD5C02' }}>{fmt(grand)}</div>
                </div>
              </>
            })()}
          </div>
          </div>

          {/* Remarks + Terms */}
          <div style={{
            background: '#FAFAFA',
            border: '1.5px solid #E2E8F0',
            borderRadius: 12,
            padding: '16px 18px',
            marginBottom: 18,
          }}>
          <div style={{ fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:'.07em',
            color:'#64748B', marginBottom:14, paddingBottom:6, borderBottom:'2px solid #F1F5F9' }}>
            Remarks &amp; Terms
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginTop:0 }}>
            <div>
              <label className="form-label">Remarks</label>
              <textarea {...fc()} rows={3} value={form.remarks}
                onChange={e => set('remarks', e.target.value)} placeholder="Internal remarks…" />
            </div>
            <div>
              <label className="form-label">Terms &amp; Conditions</label>
              <textarea {...fc()} rows={3} value={form.terms} onChange={e => set('terms', e.target.value)} />
            </div>
          </div>
          </div>
        </div>

        {/* ── Sticky Footer ── */}
        <div style={{
          padding:'14px 24px', borderTop:'1px solid var(--border)',
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:10,
          position:'sticky', bottom:0, background:'var(--surface)', zIndex:10,
          borderRadius:'0 0 14px 14px',
        }}>
          <button type="button" className="btn btn-secondary" onClick={handlePrint} style={{ gap:6 }}>
            <Printer size={14}/> Print / Download
          </button>
          <div style={{ display:'flex', gap:10 }}>
            <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving} style={{ minWidth:170 }}>
              {saving
                ? <><span className="spinner" style={{ width:13,height:13,borderWidth:2,margin:'0 6px 0 0' }}/>Saving…</>
                : (editData ? 'Update Quotation' : '+ SAVE Quotation')
              }
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

// ── View Quotation Modal ───────────────────────────────────────
function ViewModal({ q, onClose, onPrint }) {
  if (!q) return null
  const items   = q.items || []
  const sub     = parseFloat(q.subtotal)    || items.reduce((s,r) => s+(parseFloat(r.total)||0), 0)
  const gstAmt  = parseFloat(q.gst_amount)  || items.reduce((s,r) => s+((parseFloat(r.total)||0)*(parseFloat(r.gst_percent)||0)/100), 0)
  const freight = parseFloat(q.freight_charges) || 0
  const other   = parseFloat(q.other_charges)   || 0
  const grand   = parseFloat(q.grand_total) || (sub + gstAmt + freight + other)
  const sm      = STATUS_META[q.status] || STATUS_META.draft

  const InfoCard = ({ label, value, accent }) => (
    <div style={{ background:'var(--bg)', borderRadius:8, padding:'10px 14px',
      border: accent ? `1px solid ${accent}44` : '1px solid var(--border)' }}>
      <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em',
        color: accent || 'var(--text-muted)', marginBottom:3 }}>{label}</div>
      <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', wordBreak:'break-word' }}>{value || '—'}</div>
    </div>
  )

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background:'var(--surface)', borderRadius:14, width:'100%', maxWidth:900,
        maxHeight:'92vh', overflowY:'auto', animation:'modalIn .2s ease',
        boxShadow:'0 24px 64px rgba(0,0,0,.2)',
      }}>

        {/* ── Header ── */}
        <div style={{
          padding:'18px 24px 14px', borderBottom:'1px solid var(--border)',
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
          position:'sticky', top:0, background:'var(--surface)', zIndex:10, borderRadius:'14px 14px 0 0',
        }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
              <h2 style={{ fontSize:18, fontWeight:900, color:'var(--text)', margin:0 }}>
                Quotation Details
              </h2>
              <span style={{ fontFamily:'monospace', fontWeight:800, fontSize:14,
                color:'#FD5C02', background:'#FFF3EC', padding:'2px 10px', borderRadius:6 }}>
                {q.quotation_no || '—'}
              </span>
              <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700,
                background:sm.bg, color:sm.color }}>
                {sm.label}
              </span>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, flexShrink:0 }}>
            <button className="btn btn-secondary btn-sm" onClick={onPrint}>
              <Printer size={13}/> Print / Download
            </button>
            <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer',
              color:'var(--text-muted)', padding:6, borderRadius:6, display:'flex', alignItems:'center' }}>
              <X size={18}/>
            </button>
          </div>
        </div>

        <div style={{ padding:'20px 24px' }}>

          {/* ── Section: Quotation Info ── */}
          <div style={{ fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:'.07em',
            color:'#FD5C02', marginBottom:12, paddingBottom:6, borderBottom:'2px solid #FFF3EC' }}>
            Quotation Information
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:20 }}>
            <InfoCard label="Quotation #"    value={q.quotation_no}       accent="#FD5C02"/>
            <InfoCard label="Quotation Date" value={fmtDate(q.quotation_date)}/>
            <InfoCard label="Valid Until"    value={fmtDate(q.valid_until)}/>
          </div>

          {/* ── Section: Customer ── */}
          <div style={{ fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:'.07em',
            color:'#FD5C02', marginBottom:12, paddingBottom:6, borderBottom:'2px solid #FFF3EC' }}>
            Customer / Retailer
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:20 }}>
            <InfoCard label="Customer / Retailer" value={q.customer_name}/>
            <InfoCard label="Mobile"  value={q.customer_phone}/>
            <InfoCard label="Email"   value={q.customer_email}/>
          </div>
          {q.delivery_no && (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em',
                color:'var(--text-muted)', marginBottom:6 }}>Delivery Address</div>
              <div style={{
                fontSize:13, background:'var(--bg)', padding:'10px 14px',
                borderRadius:8, border:'1px solid var(--border)', lineHeight:1.6,
                display:'flex', alignItems:'flex-start', gap:8,
              }}>
                <span style={{flexShrink:0, marginTop:2}}>📍</span>
                <span style={{fontWeight:600, color:'var(--text)'}}>{q.delivery_no}</span>
              </div>
            </div>
          )}

          {/* ── Section: Created By ── */}
          <div style={{ fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:'.07em',
            color:'#FD5C02', marginBottom:12, paddingBottom:6, borderBottom:'2px solid #FFF3EC' }}>
            Created By{(q.created_by_type || q.source) ? ` (${q.created_by_type || q.source})` : ''}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:12 }}>
            <InfoCard label="Name" value={q.created_by_person || q.created_by_name || '—'}/>
            <InfoCard label="Company" value={q.created_by_company || '—'}/>
            <InfoCard label="Source" value={q.source || q.created_by_type || (q.buyer_company_id ? 'Retailer App' : 'Admin')}/>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:20 }}>
            <InfoCard label="Phone" value={q.created_by_mobile || '—'}/>
            <InfoCard label="Email" value={q.created_by_email || '—'}/>
            <InfoCard label="Requested On" value={fmtDate(q.created_at)}/>
          </div>

          {/* ── Section: Products ── */}
          <div style={{ fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:'.07em',
            color:'#FD5C02', marginBottom:12, paddingBottom:6, borderBottom:'2px solid #FFF3EC' }}>
            Products / Items ({items.length})
          </div>

          {items.length === 0 ? (
            <div style={{ textAlign:'center', padding:'20px', color:'var(--text-muted)', fontSize:13 }}>No products added</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:18 }}>
              {items.map((it, i) => {
                const amount  = (parseFloat(it.qty)||0)*(parseFloat(it.rate)||0)
                const disc    = amount*(parseFloat(it.disc)||0)/100
                const taxable = amount - disc
                const gst     = taxable*(parseFloat(it.gst_percent)||0)/100
                const total   = taxable + gst
                return (
                  <div key={i} style={{
                    border:'1px solid var(--border)', borderRadius:10, overflow:'hidden',
                    boxShadow:'var(--shadow)',
                  }}>
                    {/* Product header */}
                    <div style={{
                      display:'flex', alignItems:'center', justifyContent:'space-between',
                      padding:'10px 16px', background:'#FFF9F5',
                      borderBottom:'1px solid var(--border)',
                    }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <span style={{ width:24, height:24, borderRadius:'50%', background:'#FD5C02',
                          color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:11, fontWeight:800, flexShrink:0 }}>{i+1}</span>
                        <div>
                          <div style={{ fontWeight:800, fontSize:14, color:'var(--text)' }}>{it.product_name || '—'}</div>
                          {it.product_code && (
                            <span style={{ fontSize:10, fontFamily:'monospace', fontWeight:700,
                              color:'#FD5C02' }}>{it.product_code}</span>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase',
                          letterSpacing:'.05em', color:'var(--text-muted)' }}>Row Total</div>
                        <div style={{ fontSize:18, fontWeight:900, color:'#FD5C02' }}>{fmt(total)}</div>
                      </div>
                    </div>

                    <div style={{ padding:'14px 16px' }}>

                      {/* ── ROW 1: Product Identification (7 cols) ── */}
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:8, marginBottom:8 }}>
                        {[
                          ['Code',         it.product_code],
                          ['Brand',        it.brand_name],
                          ['Category',     it.category_name],
                          ['Sub-Category', it.sub_category_name],
                          ['Size',         it.size],
                          ['Finish',       it.finish],
                          ['Tile Type',    it.tile_type],
                        ].map(([lbl, val]) => (
                          <div key={lbl}>
                            <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase',
                              letterSpacing:'.05em', color:'var(--text-muted)', marginBottom:3 }}>{lbl}</div>
                            <div style={{
                              fontSize:11, fontWeight: val ? 600 : 400, fontStyle: val ? 'normal' : 'italic',
                              color: val ? 'var(--text)' : 'var(--text-muted)',
                              background: val ? '#F8FAFC' : 'var(--bg)',
                              border:'1px solid var(--border)', borderRadius:6,
                              padding:'5px 8px', minHeight:28, display:'flex', alignItems:'center',
                            }}>{val || '—'}</div>
                          </div>
                        ))}
                      </div>

                      {/* ── ROW 2: More Product Details ── */}
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8, marginBottom:12 }}>
                        {[
                          ['Grade',             it.grade],
                          ['Color',             it.color],
                          ['HSN Code',          it.hsn_code],
                          ['Unit / GST',        it.unit ? `${it.unit} / ${it.gst_percent || 0}%` : ''],
                          ['MRP',               it.mrp           ? `₹${parseFloat(it.mrp).toFixed(2)}`            : ''],
                        ].map(([lbl, val]) => (
                          <div key={lbl}>
                            <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase',
                              letterSpacing:'.05em', color:'var(--text-muted)', marginBottom:3 }}>{lbl}</div>
                            <div style={{
                              fontSize:11,
                              fontWeight: val ? 700 : 400,
                              fontStyle: val ? 'normal' : 'italic',
                              color: lbl==='MRP' && val
                                ? '#059669'
                                : val ? 'var(--text)' : 'var(--text-muted)',
                              background: val ? '#F0FDF4' : 'var(--bg)',
                              border: `1px solid ${(lbl==='MRP'||lbl==='Retail Price'||lbl==='Dealer Price') && val ? '#A7F3D0' : 'var(--border)'}`,
                              borderRadius:6, padding:'5px 8px', minHeight:28, display:'flex', alignItems:'center',
                            }}>{val || '—'}</div>
                          </div>
                        ))}
                      </div>

                      {/* ── ROW 3: Pcs/Box & Sqft/Box ── */}
                      {(it.pcs_per_box || it.sqft_per_box || it.purchase_price) && (
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:8, marginBottom:12 }}>
                          {[
                            ['Purchase Price',  it.purchase_price ? `₹${parseFloat(it.purchase_price).toFixed(2)}` : ''],
                            ['Pcs / Box',       it.pcs_per_box ? String(it.pcs_per_box) : ''],
                            ['Sqft / Box',      it.sqft_per_box ? String(it.sqft_per_box) : ''],
                          ].map(([lbl, val]) => (
                            <div key={lbl}>
                              <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase',
                                letterSpacing:'.05em', color:'var(--text-muted)', marginBottom:3 }}>{lbl}</div>
                              <div style={{
                                fontSize:11, fontWeight: val ? 700 : 400, fontStyle: val ? 'normal' : 'italic',
                                color: lbl==='Purchase Price' && val ? '#7C3AED' : val ? 'var(--text)' : 'var(--text-muted)',
                                background: lbl==='Purchase Price' && val ? '#F5F3FF' : val ? '#F8FAFC' : 'var(--bg)',
                                border:`1px solid ${lbl==='Purchase Price' && val ? '#DDD6FE' : 'var(--border)'}`,
                                borderRadius:6, padding:'5px 8px', minHeight:28, display:'flex', alignItems:'center',
                              }}>{val || '—'}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* ── ROW 4: Pricing Calculation Summary ── */}
                      <div style={{
                        display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:8,
                        background:'linear-gradient(135deg, #FFF9F5 0%, #FFF3EC 100%)',
                        borderRadius:10, padding:'12px 14px',
                        border:'1.5px solid #FFD9BE',
                      }}>
                        {[
                          ['Qty',       `${it.qty || 0} ${it.unit || ''}`,            '#2563EB'],
                          ['Rate',      fmt(it.rate),                                   '#374151'],
                          ['Amount',    fmt(amount),                                    '#374151'],
                          ['Discount',  `${it.disc||0}% = ${fmt(disc)}`,               '#D97706'],
                          ['GST',       `${it.gst_percent||0}% = ${fmt(gst)}`,         '#7C3AED'],
                          ['Row Total', fmt(total),                                     '#FD5C02'],
                        ].map(([lbl, val, color]) => (
                          <div key={lbl} style={{ textAlign:'center' }}>
                            <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase',
                              letterSpacing:'.05em', color:'var(--text-muted)', marginBottom:4 }}>{lbl}</div>
                            <div style={{
                              fontSize: lbl==='Row Total' ? 15 : 12,
                              fontWeight: lbl==='Row Total' ? 900 : 700,
                              color,
                              padding: lbl==='Row Total' ? '4px 0' : 0,
                            }}>{val}</div>
                          </div>
                        ))}
                      </div>

                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Totals summary ── */}
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:16 }}>
            <div style={{ minWidth:280, background:'var(--bg)', border:'1px solid var(--border)',
              borderRadius:10, padding:'14px 18px' }}>
              {[
                ['Subtotal',        sub,     'var(--text)'],
                ['GST Amount',      gstAmt,  '#7C3AED'],
                ['Freight Charges', freight, 'var(--text)'],
                ['Other Charges',   other,   'var(--text)'],
              ].map(([lbl, val, color]) => (
                <div key={lbl} style={{ display:'flex', justifyContent:'space-between',
                  fontSize:12, marginBottom:7, alignItems:'center' }}>
                  <span style={{ color:'var(--text-muted)', fontWeight:500 }}>{lbl}</span>
                  <span style={{ fontWeight:600, color }}>{fmt(val)}</span>
                </div>
              ))}
              <div style={{ borderTop:'2px solid #FD5C02', paddingTop:10, marginTop:6,
                display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontWeight:800, fontSize:14, color:'var(--text)' }}>Grand Total</span>
                <span style={{ fontWeight:900, fontSize:20, color:'#FD5C02' }}>{fmt(grand)}</span>
              </div>
            </div>
          </div>

          {/* ── Remarks / Terms ── */}
          {(q.remarks || q.terms) && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              {q.remarks && (
                <div>
                  <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase',
                    letterSpacing:'.06em', color:'var(--text-muted)', marginBottom:6 }}>Remarks</div>
                  <div style={{ fontSize:13, background:'var(--bg)', padding:'12px 14px',
                    borderRadius:8, border:'1px solid var(--border)', lineHeight:1.6 }}>{q.remarks}</div>
                </div>
              )}
              {q.terms && (
                <div>
                  <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase',
                    letterSpacing:'.06em', color:'var(--text-muted)', marginBottom:6 }}>Terms &amp; Conditions</div>
                  <div style={{ fontSize:13, background:'var(--bg)', padding:'12px 14px',
                    borderRadius:8, border:'1px solid var(--border)', lineHeight:1.6 }}>{q.terms}</div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ── Print helper ───────────────────────────────────────────────
// Convert a number to Indian-system words (e.g. 96000 -> "Ninety Six Thousand").
function numberToIndianWords(num) {
  num = Math.round(parseFloat(num) || 0)
  if (num === 0) return 'Zero'
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
  const two = (n) => n < 20 ? ones[n] : tens[Math.floor(n/10)] + (n%10 ? ' ' + ones[n%10] : '')
  const three = (n) => {
    const h = Math.floor(n/100), r = n%100
    return (h ? ones[h] + ' Hundred' + (r ? ' ' : '') : '') + (r ? two(r) : '')
  }
  let words = ''
  const crore = Math.floor(num/10000000); num %= 10000000
  const lakh  = Math.floor(num/100000);   num %= 100000
  const thou  = Math.floor(num/1000);      num %= 1000
  const hund  = num
  if (crore) words += three(crore) + ' Crore '
  if (lakh)  words += three(lakh)  + ' Lakh '
  if (thou)  words += three(thou)  + ' Thousand '
  if (hund)  words += three(hund)
  return words.trim()
}

function printQuotation(q) {
  if (!q) return

  const subtotal = (q.items||[]).reduce((s,r) => s+(parseFloat(r.total)||0), 0)
  const gstAmt   = (q.items||[]).reduce((s,r) => {
    const base = parseFloat(r.total)||0
    const gst  = parseFloat(r.gst_percent)||0
    return s + base * gst / 100
  }, 0)
  const freight  = parseFloat(q.freight_charges)||0
  const other    = parseFloat(q.other_charges)||0
  const grand    = parseFloat(q.grand_total) || (subtotal + gstAmt + freight + other)

  const fmtINR = (n) => '₹' + (parseFloat(n)||0).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 })
  const fmtD   = (d) => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—'

  // ── Tally-style number helpers ──
  const fmtNum = (n) => (parseFloat(n)||0).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 })
  const fmtDueD = (d) => d ? new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'2-digit'}).replace(/ /g,'-') : ''

  // amount (before GST) and total qty for the voucher table
  const totalQty = (q.items||[]).reduce((s,r) => s+(parseFloat(r.qty)||0), 0)
  const taxableTotal = (q.items||[]).reduce((s,r) => {
    const amt = (parseFloat(r.qty)||0) * (parseFloat(r.rate)||0)
    return s + (amt - amt * (parseFloat(r.disc)||0) / 100)
  }, 0)
  // Round off to the nearest rupee for the grand total line (Tally behaviour)
  const gstTotalAmt = (q.items||[]).reduce((s,r) => {
    const amt = (parseFloat(r.qty)||0) * (parseFloat(r.rate)||0)
    const taxable = amt - amt * (parseFloat(r.disc)||0) / 100
    return s + taxable * (parseFloat(r.gst_percent)||0) / 100
  }, 0)
  const preRound = taxableTotal + gstTotalAmt + freight + other
  const roundedGrand = Math.round(preRound)
  const roundOff = roundedGrand - preRound

  // Build voucher table rows (SI No | Description | HSN | Part No | Due on | Qty | Rate | per | Disc% | Amount)
  const voucherRows = (q.items||[]).map((it, i) => {
    const amt     = (parseFloat(it.qty)||0) * (parseFloat(it.rate)||0)
    const discAmt = amt * (parseFloat(it.disc)||0) / 100
    const lineAmt = amt - discAmt
    const unit = it.unit || 'BOX'
    return `
      <tr>
        <td class="c-si">${i+1}</td>
        <td class="c-desc"><b>${it.product_name||'—'}</b></td>
        <td class="c-hsn">${it.hsn_code||''}</td>
        <td class="c-part">${it.product_code||''}</td>
        <td class="c-due">${fmtDueD(q.quotation_date || q.valid_until)}</td>
        <td class="c-qty"><b>${(parseFloat(it.qty)||0).toLocaleString('en-IN')} ${unit.toUpperCase()}</b></td>
        <td class="c-rate">${fmtNum(it.rate)}</td>
        <td class="c-per">${unit.toUpperCase()}</td>
        <td class="c-disc">${it.disc ? it.disc + ' %' : ''}</td>
        <td class="c-amt"><b>${fmtNum(lineAmt)}</b></td>
      </tr>`
  }).join('')

  // Amount in words (Indian system)
  const amountInWords = numberToIndianWords(roundedGrand)

  // Seller company details — fall back to BDM defaults if not supplied on the record.
  const seller = {
    name:    q.company_name    || 'EzyEnquiry',
    address: q.company_address || 'Sy. No. 15, Rampura Village, Virgonagar Post,\nBidrahalli Hobli, Bengaluru 560049',
    state:   q.company_state   || 'Karnataka, Code : 29',
    email:   q.company_email   || 'bdmtiles@gmail.com',
  }
  const buyerName  = q.customer_name  || '—'
  const buyerPhone = q.customer_phone || ''
  const buyerAddr  = q.shipping_address || q.billing_address || q.customer_address || ''
  const voucherNo  = q.quotation_no || q.order_no || 'PREVIEW'

  const sellerAddrHtml = seller.address.replace(/\n/g, '<br/>')
  const buyerAddrHtml  = (buyerAddr || '').replace(/\n/g, '<br/>')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Sales Order – ${voucherNo}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Times New Roman',Georgia,serif;font-size:12px;color:#000;background:#fff;padding:24px 28px}
  .title{text-align:center;font-weight:700;font-size:15px;margin-bottom:10px;letter-spacing:.5px}
  table{border-collapse:collapse;width:100%}
  .frame{border:1px solid #000}
  /* ── Top info block ── */
  .top td{border:1px solid #000;vertical-align:top;padding:4px 7px}
  .seller-name{font-weight:700;font-size:13px}
  .lbl{font-size:10px;color:#333}
  .val{font-weight:700}
  .party-lbl{font-size:11px;color:#333;border-top:1px solid #000;padding-top:3px}
  /* ── Items table ── */
  .items{margin-top:-1px}
  .items th{border:1px solid #000;padding:4px 6px;font-size:11px;font-weight:700;background:#fff}
  .items td{border-left:1px solid #000;border-right:1px solid #000;padding:3px 6px;font-size:11px;vertical-align:top}
  .c-si{text-align:center;width:28px}
  .c-desc{min-width:220px}
  .c-hsn{text-align:center}
  .c-part{text-align:center}
  .c-due{text-align:center;font-style:italic}
  .c-qty{text-align:right;white-space:nowrap}
  .c-rate{text-align:right}
  .c-per{text-align:center}
  .c-disc{text-align:center}
  .c-amt{text-align:right;white-space:nowrap}
  .items .spacer td{border-left:1px solid #000;border-right:1px solid #000;height:140px}
  .subtotal-row td{border:1px solid #000;border-left:1px solid #000;border-right:1px solid #000;text-align:right;font-weight:700;padding:3px 6px}
  .roundoff td{border-left:1px solid #000;border-right:1px solid #000;padding:2px 6px;font-size:11px;font-style:italic;font-weight:700;text-align:right}
  .total-row td{border:1px solid #000;font-weight:700;padding:4px 6px}
  .words{border:1px solid #000;border-top:none;padding:5px 7px}
  .words-lbl{font-size:10px;color:#333}
  .words-val{font-weight:700;font-size:12px}
  .eoe{text-align:right;font-style:italic;font-size:11px;padding:2px 7px}
  @media print{ body{padding:12px 16px} .no-print{display:none} }
</style>
</head>
<body>

<div class="title">SALES ORDER</div>

<!-- ── Top info block ── -->
<table class="frame top">
  <tr>
    <td rowspan="3" style="width:52%">
      <div class="seller-name">${seller.name}</div>
      <div>${sellerAddrHtml}</div>
      <div>State Name : ${seller.state}</div>
      <div>E-Mail : ${seller.email}</div>
    </td>
    <td style="width:24%"><div class="lbl">Voucher No.</div><div class="val">${voucherNo}</div></td>
    <td style="width:24%"><div class="lbl">Dated</div><div class="val">${fmtDueD(q.quotation_date)}</div></td>
  </tr>
  <tr>
    <td><div class="lbl">Buyer's Ref./Order No.</div><div class="val">${q.enquiry_no || voucherNo}</div></td>
    <td><div class="lbl">Mode/Terms of Payment</div><div class="val">${q.payment_terms || ''}</div></td>
  </tr>
  <tr>
    <td><div class="lbl">Dispatched through</div><div class="val">${q.dispatch_through || ''}</div></td>
    <td><div class="lbl">Destination</div><div class="val">${q.destination || ''}</div></td>
  </tr>
  <tr>
    <td style="border-top:1px solid #000">
      <div class="party-lbl">Consignee (Ship to)</div>
      <div class="val">${buyerName}${buyerPhone ? ' (' + buyerPhone + ')' : ''}</div>
      <div>${buyerAddrHtml}</div>
    </td>
    <td colspan="2" rowspan="2"><div class="lbl">Terms of Delivery</div><div>${q.terms || ''}</div></td>
  </tr>
  <tr>
    <td>
      <div class="party-lbl">Buyer (Bill to)</div>
      <div class="val">${buyerName}${buyerPhone ? ' (' + buyerPhone + ')' : ''}</div>
      <div>${buyerAddrHtml}</div>
    </td>
  </tr>
</table>

<!-- ── Items table ── -->
<table class="frame items">
  <thead>
    <tr>
      <th class="c-si">Sl<br/>No.</th>
      <th class="c-desc">Description of Goods</th>
      <th class="c-hsn">HSN/SAC</th>
      <th class="c-part">Part No.</th>
      <th class="c-due">Due on</th>
      <th class="c-qty">Quantity</th>
      <th class="c-rate">Rate</th>
      <th class="c-per">per</th>
      <th class="c-disc">Disc. %</th>
      <th class="c-amt">Amount</th>
    </tr>
  </thead>
  <tbody>
    ${voucherRows}
    <tr class="spacer"><td class="c-si"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr class="subtotal-row">
      <td colspan="9" style="text-align:right;border-right:1px solid #000">&nbsp;</td>
      <td class="c-amt">${fmtNum(taxableTotal + gstTotalAmt + freight + other)}</td>
    </tr>
    ${roundOff ? `<tr class="roundoff"><td colspan="9" style="text-align:right"><i>Round Off</i></td><td class="c-amt">${roundOff < 0 ? '(-)' : ''}${fmtNum(Math.abs(roundOff))}</td></tr>` : ''}
    <tr class="total-row">
      <td colspan="5" style="text-align:right">Total</td>
      <td class="c-qty">${totalQty.toLocaleString('en-IN')} ${(q.items?.[0]?.unit||'BOX').toUpperCase()}</td>
      <td colspan="3"></td>
      <td class="c-amt">₹ ${fmtNum(roundedGrand)}</td>
    </tr>
  </tbody>
</table>

<!-- ── Amount in words ── -->
<div class="words">
  <span class="words-lbl">Amount Chargeable (in words)</span>
  <span class="eoe" style="float:right">E. &amp; O.E</span>
  <div class="words-val">INR ${amountInWords} Only</div>
</div>

<script>window.onload = () => window.print()<\/script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=1000,height=750')
  if (win) {
    win.document.write(html)
    win.document.close()
  } else {
    // fallback: download as HTML file
    const blob = new Blob([html], { type: 'text/html' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `SalesOrder_${voucherNo||'draft'}.html`
    document.body.appendChild(a); a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }
}

// ══════════════════════════════════════════════════════════════
// MAIN PAGE — QuotationManager
// ══════════════════════════════════════════════════════════════
export default function QuotationManager({ products: propProducts = [], customers = [], enquiries = [] }) {
  const erpCtx = useErp()
  // Use context products first, fall back to prop, then local fetch
  const ctxProducts = erpCtx?.products || []

  const [quotations,  setQuotations]  = useState([])
  const [products,    setProducts]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [showModal,   setShowModal]   = useState(false)
  const [editData,    setEditData]    = useState(null)
  const [viewData,    setViewData]    = useState(null)
  const [search,      setSearch]      = useState('')
  const [statusFilter,setStatusFilter]= useState('')
  const [dateFrom,    setDateFrom]    = useState('')
  const [dateTo,      setDateTo]      = useState('')
  const [page,        setPage]        = useState(1)
  const [toast,       setToast]       = useState(null)
  const PER_PAGE = 20

  // Merge all product sources — context wins if populated
  useEffect(() => {
    const best = ctxProducts.length > 0 ? ctxProducts
               : propProducts.length > 0 ? propProducts
               : []
    if (best.length > 0) setProducts(best)
  }, [ctxProducts, propProducts])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Fetch products directly as a guaranteed fallback ───────
  const fetchProducts = useCallback(async () => {
    try {
      // First try the unguarded for-select endpoint (needs backend restart)
      const res     = await api.get('/products/for-select', { params: { limit: 500 } })
      const payload = res?.data ?? res
      const inner   = payload?.data ?? payload
      const list    = Array.isArray(inner)           ? inner
                    : Array.isArray(inner?.products) ? inner.products
                    : []
      if (list.length > 0) { setProducts(list); return }
    } catch { /* fall through to guarded endpoint */ }

    try {
      // Fallback: guarded /products (works for Company Owner / Manager)
      const res     = await api.get('/products', { params: { limit: 500 } })
      const payload = res?.data ?? res
      const inner   = payload?.data ?? payload
      const list    = Array.isArray(inner)           ? inner
                    : Array.isArray(inner?.products) ? inner.products
                    : []
      if (list.length > 0) setProducts(list)
    } catch (e) {
      console.error('[QM] fetchProducts FAILED →', e?.response?.status, e?.response?.data?.message || e?.message)
    }
  }, [])

  // ── Fetch ──────────────────────────────────────────────────
  const fetchQuotations = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await quotationApi.list({ limit: 200 })
      const d    = res?.data?.data || res?.data || res
      const list = Array.isArray(d)             ? d
                 : Array.isArray(d?.quotations) ? d.quotations
                 : []
      setQuotations(list)
    } catch {
      setQuotations([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchQuotations()
    fetchProducts()
  }, [fetchQuotations, fetchProducts])

  // ── Derived stats ──────────────────────────────────────────
  const stats = {
    total:     quotations.length,
    draft:     quotations.filter(q => q.status === 'draft').length,
    sent:      quotations.filter(q => q.status === 'sent').length,
    accepted:  quotations.filter(q => q.status === 'accepted').length,
    converted: quotations.filter(q => q.status === 'converted').length,
    expired:   quotations.filter(q => q.status === 'expired').length,
    cancelled: quotations.filter(q => q.status === 'cancelled').length,
    totalValue:quotations.reduce((s,q) => s+(parseFloat(q.grand_total)||0), 0),
  }

  // ── Filter + Search ────────────────────────────────────────
  const filtered = quotations.filter(q => {
    const matchSearch = !search ||
      (q.quotation_no||'').toLowerCase().includes(search.toLowerCase()) ||
      (q.customer_name||'').toLowerCase().includes(search.toLowerCase()) ||
      (q.customer_phone||'').includes(search) ||
      (q.enquiry_no||'').toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || q.status === statusFilter
    const qDate = q.quotation_date ? q.quotation_date.slice(0,10) : ''
    const matchFrom = !dateFrom || qDate >= dateFrom
    const matchTo   = !dateTo   || qDate <= dateTo
    return matchSearch && matchStatus && matchFrom && matchTo
  })
  const totalPages  = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const paginated   = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  // ── CRUD ───────────────────────────────────────────────────
  const handleSave = async (data) => {
    setSaving(true)
    try {
      if (editData) {
        const res = await quotationApi.update(editData._id || editData.id, data)
        const updated = res?.data || res
        setQuotations(prev => prev.map(q =>
          (q._id === (editData._id||editData.id) || q.id === (editData._id||editData.id))
            ? { ...q, ...updated } : q
        ))
        showToast('Quotation updated successfully')
      } else {
        const res = await quotationApi.create(data)
        const created = res?.data || res
        setQuotations(prev => [created, ...prev])
        showToast('Quotation created successfully')
      }
      setShowModal(false); setEditData(null)
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to save quotation', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (q) => {
    if (!window.confirm(`Delete quotation ${q.quotation_no || ''}?`)) return
    try {
      await quotationApi.delete(q._id || q.id)
      setQuotations(prev => prev.filter(x => x._id !== (q._id||q.id) && x.id !== (q._id||q.id)))
      showToast('Quotation deleted')
    } catch {
      showToast('Failed to delete', 'error')
    }
  }

  const handleStatusChange = async (q, status) => {
    try {
      const res = await quotationApi.updateStatus(q._id || q.id, status)
      const updated = res?.data || res
      const finalStatus = updated?.status || status
      setQuotations(prev => prev.map(x =>
        (x._id === (q._id||q.id) || x.id === (q._id||q.id)) ? { ...x, ...updated, status: finalStatus } : x
      ))
      showToast(
        status === 'accepted'
          ? 'Quotation accepted — order, purchase & sale created'
          : `Status changed to ${STATUS_META[finalStatus]?.label || finalStatus}`
      )
    } catch {
      showToast('Status update failed', 'error')
    }
  }

  const openEdit = (q) => { setEditData(q); setShowModal(true) }
  const openNew  = () => { setEditData(null); setShowModal(true) }

  // ── Render ─────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100%' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 24, zIndex: 9999,
          background: toast.type === 'error' ? '#FEF2F2' : '#ECFDF5',
          color: toast.type === 'error' ? '#991B1B' : '#065F46',
          border: `1px solid ${toast.type === 'error' ? '#FECACA' : '#A7F3D0'}`,
          padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0,0,0,.12)', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {toast.type === 'error' ? <XCircle size={15}/> : <CheckCircle size={15}/>}
          {toast.msg}
        </div>
      )}

      {/* Page header + Stats in one block */}
      <div style={{ marginBottom: 18 }}>
        {/* Title row */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between',
          gap:16, marginBottom:14, flexWrap:'wrap' }}>
          <div>
            <h1 className="page-title">Quotation Manager</h1>
            <p className="page-desc">Create quotations, send to customers, convert to Sales Orders</p>
          </div>
          <div style={{ display:'flex', gap:8, flexShrink:0 }}>
            <button className="btn btn-secondary btn-sm" onClick={fetchQuotations} title="Refresh">
              <RefreshCw size={13}/>
            </button>
            <button className="btn btn-primary" onClick={openNew}>
              <Plus size={14}/> New Quotation
            </button>
          </div>
        </div>

        {/* Stats boxes — right below the title */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10 }}>
          {[
            { label:'Accepted',  val:stats.accepted,  bg:'#ECFDF5', color:'#059669', icon:<CheckCircle size={15}/>, status:'accepted' },
            { label:'Converted', val:stats.converted, bg:'#EFF6FF', color:'#2563EB', icon:<Send size={15}/>,        status:'converted' },
            { label:'Expired',   val:stats.expired,   bg:'#FFFBEB', color:'#D97706', icon:<XCircle size={15}/>,    status:'expired' },
            { label:'Cancelled', val:stats.cancelled, bg:'#FEF2F2', color:'#DC2626', icon:<XCircle size={15}/>,    status:'cancelled' },
            { label:'Total Value', val:null, rawVal:fmt(stats.totalValue), bg:'#FFF3EC', color:'#FD5C02', icon:<Download size={15}/>, status:'' },
          ].map(s => (
            <div key={s.label}
              onClick={() => { if (s.status) { setStatusFilter(sf => sf===s.status ? '' : s.status); setPage(1) } }}
              style={{
                background:'var(--surface)', border:`1px solid ${statusFilter===s.status && s.status ? s.color+'55' : 'var(--border)'}`,
                borderRadius:10, padding:'12px 14px', display:'flex', alignItems:'center', gap:10,
                boxShadow: statusFilter===s.status && s.status ? `0 0 0 2px ${s.color}25` : 'var(--shadow)',
                cursor: s.status ? 'pointer' : 'default', transition:'all .15s',
              }}
              onMouseEnter={e => { if (s.status) e.currentTarget.style.boxShadow='var(--shadow-md)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = statusFilter===s.status&&s.status ? `0 0 0 2px ${s.color}25` : 'var(--shadow)' }}
            >
              <div style={{ width:38, height:38, borderRadius:9, flexShrink:0,
                background:s.bg, color:s.color, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {s.icon}
              </div>
              <div>
                <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase',
                  letterSpacing:'.05em', color:'var(--text-muted)', marginBottom:1 }}>{s.label}</div>
                <div style={{ fontSize: s.rawVal ? 14 : 22, fontWeight:900,
                  color: s.rawVal ? s.color : 'var(--text)', lineHeight:1.1 }}>
                  {s.rawVal ?? s.val}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div style={{
        display:'flex', alignItems:'center', gap:10, marginBottom:14, flexWrap:'wrap',
        background:'var(--surface)', border:'1px solid var(--border)',
        borderRadius:10, padding:'10px 14px', boxShadow:'var(--shadow)',
      }}>
        <div className="search-bar" style={{ minWidth:240, flex:1 }}>
          <Search size={14}/>
          <input placeholder="Search quotation #, customer, enquiry…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <div style={{ position:'relative' }}>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
            style={{ padding:'7px 30px 7px 10px', border:'1px solid var(--border)', borderRadius:7,
              background:'var(--surface)', fontSize:12, appearance:'none', outline:'none',
              color:'var(--text)', cursor:'pointer', minWidth:120 }}
            onFocus={e => e.target.style.borderColor='#FD5C02'}
            onBlur={e => e.target.style.borderColor='var(--border)'}>
            <option value="">All Status</option>
            {Object.entries(STATUS_META).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <ChevronDown size={12} style={{ position:'absolute', right:8, top:'50%',
            transform:'translateY(-50%)', pointerEvents:'none', color:'var(--text-muted)' }}/>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <Calendar size={13} style={{ color:'var(--text-muted)', flexShrink:0 }}/>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }}
            style={{ padding:'5px 8px', border:'1px solid var(--border)', borderRadius:7,
              fontSize:12, outline:'none', color:'var(--text)', background:'var(--surface)' }}
            onFocus={e => e.target.style.borderColor='#FD5C02'}
            onBlur={e => e.target.style.borderColor='var(--border)'}/>
          <span style={{ fontSize:11, color:'var(--text-muted)' }}>to</span>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }}
            style={{ padding:'5px 8px', border:'1px solid var(--border)', borderRadius:7,
              fontSize:12, outline:'none', color:'var(--text)', background:'var(--surface)' }}
            onFocus={e => e.target.style.borderColor='#FD5C02'}
            onBlur={e => e.target.style.borderColor='var(--border)'}/>
        </div>
        {(search || statusFilter || dateFrom || dateTo) && (
          <button className="btn btn-secondary btn-sm"
            onClick={() => { setSearch(''); setStatusFilter(''); setDateFrom(''); setDateTo(''); setPage(1) }}>
            <RefreshCw size={12}/> Reset
          </button>
        )}
        <span style={{ marginLeft:'auto', fontSize:12, color:'var(--text-muted)', flexShrink:0 }}>
          <b style={{ color:'var(--text)' }}>{filtered.length}</b> result{filtered.length!==1?'s':''}
        </span>
      </div>

      {/* Main table */}
      <div className="card">
        {loading ? (
          <div className="loading-state"><div className="spinner"/><p>Loading quotations…</p></div>
        ) : paginated.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><FileText size={48} strokeWidth={1}/></div>
            <h3>No quotations found</h3>
            <p>{search || statusFilter ? 'Try adjusting your filters' : 'Create your first quotation to get started'}</p>
            {!search && !statusFilter && (
              <button className="btn btn-primary" onClick={openNew}><Plus size={14}/> New Quotation</button>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table style={{ fontSize:12 }}>
              <thead>
                <tr>
                  <th style={{ whiteSpace:'nowrap' }}>Quotation #</th>
                  <th style={{ whiteSpace:'nowrap' }}>Enquiry No</th>
                  <th style={{ whiteSpace:'nowrap' }}>Quotation Date</th>
                  <th style={{ whiteSpace:'nowrap' }}>Customer</th>
                  <th style={{ whiteSpace:'nowrap' }}>Created By</th>
                  <th style={{ whiteSpace:'nowrap' }}>Products</th>
                  <th style={{ whiteSpace:'nowrap', textAlign:'right' }}>Subtotal</th>
                  <th style={{ whiteSpace:'nowrap', textAlign:'right' }}>GST</th>
                  <th style={{ whiteSpace:'nowrap', textAlign:'right' }}>Grand Total</th>
                  <th style={{ whiteSpace:'nowrap', textAlign:'center' }}>Status</th>
                  <th style={{ whiteSpace:'nowrap', textAlign:'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(q => {
                  const sm       = STATUS_META[q.status] || STATUS_META.draft
                  const items    = q.items || []
                  const subtotal = parseFloat(q.subtotal) || items.reduce((s,r) => s+(parseFloat(r.total)||0), 0)
                  const gstAmt   = parseFloat(q.gst_amount) || items.reduce((s,r) => s+((parseFloat(r.total)||0)*(parseFloat(r.gst_percent)||0)/100), 0)
                  const grand    = parseFloat(q.grand_total) || 0
                  // Build product name summary
                  const prodSummary = items.length
                    ? items.map(it => it.product_name || '—').filter(Boolean).join(', ')
                    : '—'

                  return (
                    <tr key={q._id || q.id}>

                      {/* Quotation # */}
                      <td>
                        <span style={{ fontWeight:800, color:'#FD5C02', cursor:'pointer',
                          fontFamily:'monospace', fontSize:12 }}
                          onClick={() => setViewData(q)}>
                          {q.quotation_no || '—'}
                        </span>
                      </td>

                      {/* Enquiry No */}
                      <td>
                        {q.enquiry_no
                          ? <span style={{ fontFamily:'monospace', fontWeight:700, color:'#FD5C02',
                              background:'#FFF3EC', padding:'2px 6px', borderRadius:4, fontSize:11 }}>
                              {q.enquiry_no}
                            </span>
                          : <span style={{ color:'var(--text-muted)' }}>—</span>}
                      </td>

                      {/* Quotation Date */}
                      <td style={{ whiteSpace:'nowrap' }}>{fmtDate(q.quotation_date)}</td>

                      {/* Customer (whom the quotation is for) */}
                      <td>
                        <div style={{ fontWeight:600 }}>{q.customer_name || '—'}</div>
                        {q.customer_phone && (
                          <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:1 }}>{q.customer_phone}</div>
                        )}
                      </td>

                      {/* Created By — name + source badge in one cell */}
                      <td style={{ whiteSpace:'nowrap' }}>
                        {(() => {
                          const src = q.source || q.created_by_type || (q.buyer_company_id ? 'Retailer App' : 'Admin')
                          const c = src === 'Retailer App'
                            ? { bg:'#EFF6FF', color:'#2563EB' }
                            : src === 'Staff App'
                              ? { bg:'#F5F3FF', color:'#7C3AED' }
                              : { bg:'#F1F5F9', color:'#64748B' }
                          return (
                            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                              {q.created_by_name && (
                                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                  <div style={{ width:24, height:24, borderRadius:12, background:c.bg,
                                    color:c.color, display:'flex', alignItems:'center', justifyContent:'center',
                                    fontWeight:800, fontSize:11, flexShrink:0 }}>
                                    {String(q.created_by_name).trim().charAt(0).toUpperCase()}
                                  </div>
                                  <span style={{ fontWeight:600, fontSize:12 }}>{q.created_by_name}</span>
                                </div>
                              )}
                              <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:10,
                                fontSize:10, fontWeight:700, background:c.bg, color:c.color, alignSelf:'flex-start' }}>
                                {src}
                              </span>
                            </div>
                          )
                        })()}
                      </td>

                      {/* Products */}
                      <td style={{ maxWidth:200 }}>
                        <div style={{ fontSize:11, color:'var(--text)', lineHeight:1.5 }}>
                          {items.slice(0,2).map((it,i) => (
                            <div key={i} style={{ whiteSpace:'nowrap', overflow:'hidden',
                              textOverflow:'ellipsis', maxWidth:190 }}>
                              <span style={{ fontWeight:600 }}>{it.product_name || '—'}</span>
                              {it.qty ? <span style={{ color:'var(--text-muted)' }}> × {it.qty} {it.unit}</span> : ''}
                            </div>
                          ))}
                          {items.length > 2 && (
                            <div style={{ fontSize:10, color:'#2563EB', marginTop:1 }}>+{items.length-2} more</div>
                          )}
                          {items.length === 0 && <span style={{ color:'var(--text-muted)' }}>—</span>}
                        </div>
                      </td>

                      {/* Subtotal */}
                      <td style={{ textAlign:'right', fontWeight:600 }}>{fmt(subtotal)}</td>

                      {/* GST */}
                      <td style={{ textAlign:'right', color:'#7C3AED', fontWeight:600 }}>{fmt(gstAmt)}</td>

                      {/* Grand Total */}
                      <td style={{ textAlign:'right', fontWeight:800, fontSize:13, color:'#FD5C02',
                        whiteSpace:'nowrap' }}>
                        {fmt(grand)}
                      </td>

                      {/* Status */}
                      <td style={{ textAlign:'center' }}>
                        <span style={{
                          padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700,
                          background:sm.bg, color:sm.color, whiteSpace:'nowrap', display:'inline-block',
                          border:`1px solid ${sm.color}33`,
                        }}>
                          {sm.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td>
                        {(() => {
                          const btn = { display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:6, cursor:'pointer' }
                          return (
                            <div style={{ display:'flex', gap:4, justifyContent:'center', alignItems:'center', flexWrap:'nowrap' }}>

                              {/* View — always visible */}
                              <button title="View" onClick={() => setViewData(q)}
                                style={{ ...btn, border:'1px solid #BFDBFE', background:'#EFF6FF', color:'#2563EB' }}>
                                <Eye size={13}/>
                              </button>

                              {/* Edit */}
                              <button title="Edit" onClick={() => openEdit(q)}
                                style={{ ...btn, border:'1px solid #FED7AA', background:'#FFF7ED', color:'#EA580C' }}>
                                <Edit2 size={13}/>
                              </button>

                              {/* Delete */}
                              <button title="Delete" onClick={() => handleDelete(q)}
                                style={{ ...btn, border:'1px solid #FECACA', background:'#FEF2F2', color:'#DC2626' }}>
                                <Trash2 size={13}/>
                              </button>

                              {/* Accept — shown when quotation is draft or sent */}
                              {(q.status === 'draft' || q.status === 'sent') && (
                                <button
                                  title="Accept — creates order, purchase & sale"
                                  onClick={() => handleStatusChange(q, 'accepted')}
                                  style={{ display:'flex', alignItems:'center', gap:4, height:28, padding:'0 10px',
                                    borderRadius:6, border:'1px solid #A7F3D0', background:'#059669',
                                    color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
                                  <CheckCircle size={12}/> Accept
                                </button>
                              )}

                              {/* Convert — shown when quotation is accepted */}
                              {q.status === 'accepted' && (
                                <button
                                  title="Convert to Sales Order"
                                  onClick={() => handleStatusChange(q, 'converted')}
                                  style={{ display:'flex', alignItems:'center', gap:4, height:28, padding:'0 10px',
                                    borderRadius:6, border:'1px solid #BAE6FD', background:'#0284C7',
                                    color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
                                  <RefreshCw size={12}/> Convert
                                </button>
                              )}

                            </div>
                          )
                        })()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="pagination">
            <span className="pagination-info">
              {(page-1)*PER_PAGE+1}–{Math.min(page*PER_PAGE, filtered.length)} of {filtered.length}
            </span>
            <button className="pagination-btn" disabled={page===1} onClick={() => setPage(p=>p-1)}>
              <ChevronLeft size={13}/>
            </button>
            {Array.from({length: Math.min(totalPages,5)}, (_,i) => {
              const n = totalPages <= 5 ? i+1 : Math.max(1, Math.min(page-2, totalPages-4)) + i
              return (
                <button key={n} className={`pagination-btn${n===page?' active':''}`} onClick={() => setPage(n)}>
                  {n}
                </button>
              )
            })}
            <button className="pagination-btn" disabled={page===totalPages} onClick={() => setPage(p=>p+1)}>
              <ChevronRight size={13}/>
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {showModal && (
        <QuotationModal
          editData={editData}
          products={products}
          enquiries={enquiries}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditData(null) }}
          saving={saving}
        />
      )}
      {viewData && (
        <ViewModal
          q={viewData}
          onClose={() => setViewData(null)}
          onPrint={() => printQuotation(viewData)}
        />
      )}
    </div>
  )
}
