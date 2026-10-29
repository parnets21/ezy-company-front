import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import {
  TrendingUp, Search, Download, Plus, RefreshCw, Receipt, IndianRupee,
  AlertCircle, CheckCircle, Clock, ChevronLeft, ChevronRight,
} from 'lucide-react'

const PAGE_SIZE = 10

/* ─────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────── */
const fmtMoney = n => `₹${Number(n || 0).toLocaleString('en-IN')}`
const fmtDate  = d => d
  ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
  : '—'

const todayStr   = () => new Date().toISOString().split('T')[0]
const monthStart = () => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0] }
const yearStart  = () => new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]

const PAYMENT_STATUS = {
  Paid:     { cls:'badge-green',  icon:<CheckCircle  size={11}/>, label:'Paid'     },
  Partial:  { cls:'badge-yellow', icon:<Clock        size={11}/>, label:'Partial'  },
  Pending:  { cls:'badge-red',    icon:<AlertCircle  size={11}/>, label:'Pending'  },
  Received: { cls:'badge-green',  icon:<CheckCircle  size={11}/>, label:'Received' },
}

const EMPTY_FORM = {
  customer_name: '', customer_id: '',
  product_name: '', product_id: '',
  qty: '', rate: '', unit: 'Pcs',
  gst_percent: '18',
  payment_status: 'Pending',
  payment_mode: 'Cash',
  paid_amount: '0',
  sale_date: todayStr(),
  notes: '',
}

export default function SalesManagement({
  branches = [], sales = [], orders = [], customers = [], products = [],
  addSale, updateSale,
}) {
  const [search,      setSearch]      = useState('')
  const [page,        setPage]        = useState(1)
  const [fromDate,    setFromDate]    = useState(monthStart())
  const [toDate,      setToDate]      = useState(todayStr())
  const [payFilter,   setPayFilter]   = useState('All')
  const [showModal,   setShowModal]   = useState(false)
  const [form,        setForm]        = useState(EMPTY_FORM)
  const [errors,      setErrors]      = useState({})
  const [saving,      setSaving]      = useState(false)
  const [toast,       setToast]       = useState('')

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3500) }

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  /* ── Date-range filtered sales ── */
  const rangeFiltered = useMemo(() => {
    const from = new Date(fromDate + 'T00:00:00')
    const to   = new Date(toDate   + 'T23:59:59')
    return sales.filter(s => {
      const d = s.sale_date ? new Date(s.sale_date) : null
      return d && d >= from && d <= to
    })
  }, [sales, fromDate, toDate])

  /* ── Table filter ── */
  const filtered = useMemo(() => rangeFiltered.filter(s =>
    (payFilter === 'All' || (s.payment_status || 'Pending') === payFilter) &&
    (
      (s.customer_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.product_name  || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.sale_code     || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.order_code    || '').toLowerCase().includes(search.toLowerCase())
    )
  ), [rangeFiltered, payFilter, search])

  /* ── Pagination (10 rows per page) ── */
  const total       = filtered.length
  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage    = Math.min(page, totalPages)
  const paged       = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  /* ── KPIs ── */
  const kpis = useMemo(() => {
    const totalRev  = sales.reduce((a, s) => a + (Number(s.grand_total || s.total_amount) || 0), 0)
    const rangRev   = rangeFiltered.reduce((a, s) => a + (Number(s.grand_total || s.total_amount) || 0), 0)
    const pending   = sales.filter(s => (s.payment_status || 'Pending') !== 'Paid')
                           .reduce((a, s) => a + (Number(s.outstanding || s.grand_total || s.total_amount) || 0), 0)
    const paid      = sales.filter(s => s.payment_status === 'Paid').length
    return { totalRev, rangRev, pending, paid, total: sales.length }
  }, [sales, rangeFiltered])

  /* ── Trend (last 6 months) ── */
  const trendData = useMemo(() => {
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const now = new Date()
    const slots = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      return {
        key:   `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,
        label: `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
        total: 0,
      }
    })
    sales.forEach(s => {
      if (!s.sale_date) return
      const d = new Date(s.sale_date); if (isNaN(d)) return
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      const slot = slots.find(sl => sl.key === key)
      if (slot) slot.total += Number(s.grand_total || s.total_amount) || 0
    })
    return slots
  }, [sales])

  /* ── Form computed ── */
  const formAmt   = Math.round((Number(form.qty) * Number(form.rate)) || 0)
  const formGst   = Math.round(formAmt * (Number(form.gst_percent) || 0) / 100)
  const formTotal = formAmt + formGst

  /* ── Validate ── */
  const validate = () => {
    const e = {}
    if (!form.customer_name.trim()) e.customer_name = 'Customer required'
    if (!form.product_name.trim())  e.product_name  = 'Product required'
    if (!form.qty  || Number(form.qty)  <= 0) e.qty  = 'Valid qty required'
    if (!form.rate || Number(form.rate) <= 0) e.rate = 'Valid rate required'
    return e
  }

  /* ── Save ── */
  const handleSave = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    const paid = Math.min(Number(form.paid_amount) || 0, formTotal)
    const result = await addSale?.({
      customer_name:  form.customer_name,
      customer_id:    form.customer_id   || undefined,
      product_name:   form.product_name,
      product_id:     form.product_id    || undefined,
      qty:            Number(form.qty),
      unit:           form.unit,
      rate:           Number(form.rate),
      amount:         formAmt,
      gst_percent:    Number(form.gst_percent),
      gst_amount:     formGst,
      total_amount:   formTotal,
      grand_total:    formTotal,
      paid_amount:    paid,
      outstanding:    formTotal - paid,
      payment_status: form.payment_status,
      payment_mode:   form.payment_mode,
      sale_date:      form.sale_date,
      notes:          form.notes,
    })
    setSaving(false)
    if (result?.success === false) { showToast(`Error: ${result.message}`); return }
    setForm(EMPTY_FORM); setErrors({})
    setShowModal(false)
    showToast(`Sale recorded — ${fmtMoney(formTotal)}`)
  }

  /* ── Quick date range presets ── */
  const applyPreset = (key) => {
    if (key === 'today')  { setFromDate(todayStr());   setToDate(todayStr()) }
    if (key === 'month')  { setFromDate(monthStart()); setToDate(todayStr()) }
    if (key === 'year')   { setFromDate(yearStart());  setToDate(todayStr()) }
    setPage(1)
  }

  return (
    <>
      <div className="breadcrumb">
        <span>Finance</span><span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-active">Sales Management</span>
      </div>

      {toast && <div className="alert alert-info" style={{ marginBottom:14 }}>✓ {toast}</div>}

      {/* ── KPI Strip ── */}
      <div className="stats-grid" style={{ gridTemplateColumns:'repeat(4,1fr)', marginBottom:20 }}>
        {[
          { label:'Total Revenue',    val: fmtMoney(kpis.totalRev),  color:'blue',   icon:<TrendingUp size={18}/>  },
          { label:'Total Sales',      val: kpis.total,               color:'green',  icon:<Receipt size={18}/>     },
          { label:'Outstanding',      val: fmtMoney(kpis.pending),   color:'red',    icon:<AlertCircle size={18}/> },
          { label:'Fully Settled',    val: `${kpis.paid} sales`,     color:'purple', icon:<CheckCircle size={18}/> },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ padding:'14px 16px' }}>
            <div className={`stat-icon ${s.color}`}>{s.icon}</div>
            <div className="stat-info">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ fontSize:18 }}>{s.val}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Trend Chart ── */}
      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-header" style={{ justifyContent:'space-between' }}>
          <span className="card-title">Sales Trend (Last 6 Months)</span>
          <div style={{ display:'flex', gap:6 }}>
            {['today','month','year'].map(k => (
              <button key={k} className="btn btn-secondary btn-xs" onClick={() => applyPreset(k)}>
                {k === 'today' ? 'Today' : k === 'month' ? 'This Month' : 'This Year'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ padding:'12px 20px 16px' }}>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={trendData} margin={{ top:4, right:8, left:0, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize:11 }} />
              <YAxis tick={{ fontSize:11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} width={52} />
              <Tooltip formatter={v => [fmtMoney(v), 'Sales']} labelStyle={{ fontWeight:700 }} />
              <Line type="monotone" dataKey="total" stroke="#4F46E5" strokeWidth={2.5} dot={{ r:4, fill:'#4F46E5' }} name="Sales" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Sales Table ── */}
      <div className="card">
        <div className="card-header" style={{ flexWrap:'wrap', gap:10 }}>
          <span className="card-title">
            Sales Entries ({filtered.length})
            {kpis.rangRev > 0 && (
              <span style={{ fontWeight:400, fontSize:12, color:'var(--text-muted)', marginLeft:10 }}>
                {fmtMoney(kpis.rangRev)} in period
              </span>
            )}
          </span>
          <div className="header-actions" style={{ flexWrap:'wrap', gap:8 }}>
            {/* Date range */}
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <input type="date" className="form-control" style={{ width:145 }} value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1) }} />
              <span style={{ color:'var(--text-muted)', fontSize:12 }}>to</span>
              <input type="date" className="form-control" style={{ width:145 }} value={toDate}   onChange={e => { setToDate(e.target.value); setPage(1) }} />
            </div>
            <div className="search-bar">
              <Search size={14}/>
              <input placeholder="Search sale, customer, product…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
            </div>
            <select className="form-control" style={{ width:140 }} value={payFilter} onChange={e => { setPayFilter(e.target.value); setPage(1) }}>
              <option value="All">All Payments</option>
              <option value="Paid">Paid</option>
              <option value="Partial">Partial</option>
              <option value="Pending">Pending</option>
            </select>
            <button className="btn btn-secondary" style={{ display:'flex', alignItems:'center', gap:6 }}>
              <Download size={14}/> Export
            </button>
            {addSale && (
              <button className="btn btn-primary" style={{ display:'flex', alignItems:'center', gap:6 }}
                onClick={() => { setForm(EMPTY_FORM); setErrors({}); setShowModal(true) }}>
                <Plus size={14}/> Add Sale
              </button>
            )}
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={th}>Sale ID</th>
                <th style={th}>Date</th>
                <th style={th}>Customer</th>
                <th style={th}>Product</th>
                <th style={{ ...th, textAlign:'center' }}>Qty</th>
                <th style={{ ...th, textAlign:'right' }}>Rate</th>
                <th style={{ ...th, textAlign:'right' }}>Amount</th>
                <th style={{ ...th, textAlign:'right' }}>GST</th>
                <th style={{ ...th, textAlign:'right' }}>Total</th>
                <th style={th}>Order Ref</th>
                <th style={{ ...th, textAlign:'center' }}>Payment</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={11} style={emptyCell}>
                  No sales in this period. Sales are created automatically when orders are delivered, or add manually.
                </td></tr>
              )}
              {paged.map(s => {
                const ps = s.payment_status || 'Pending'
                const badge = PAYMENT_STATUS[ps] || PAYMENT_STATUS.Pending
                return (
                  <tr key={s._id || s.id}>
                    <td style={{ color:'var(--primary)', fontWeight:700, fontFamily:'monospace', fontSize:12 }}>
                      {s.sale_code || '—'}
                    </td>
                    <td style={cellSm}>{fmtDate(s.sale_date)}</td>
                    <td style={{ fontWeight:600 }}>{s.customer_name || '—'}</td>
                    <td style={cellSm}>
                      <div>{s.product_name || '—'}</div>
                      {s.invoice_number && (
                        <div style={{ fontSize:10, fontFamily:'monospace', color:'var(--text-muted)' }}>{s.invoice_number}</div>
                      )}
                    </td>
                    <td style={{ textAlign:'center', fontSize:12 }}>{(s.qty || 0).toLocaleString('en-IN')} {s.unit || ''}</td>
                    <td style={{ textAlign:'right', fontSize:12 }}>{fmtMoney(s.rate)}</td>
                    <td style={{ textAlign:'right', fontSize:12 }}>{fmtMoney(s.amount)}</td>
                    <td style={{ textAlign:'right', fontSize:12, color:'var(--text-muted)' }}>{fmtMoney(s.gst_amount)}</td>
                    <td style={{ textAlign:'right', fontWeight:700, color:'var(--success)' }}>{fmtMoney(s.grand_total || s.total_amount)}</td>
                    <td style={{ fontSize:11 }}>
                      {s.order_code
                        ? <span style={{ fontFamily:'monospace', color:'var(--primary)', fontWeight:600 }}>{s.order_code}</span>
                        : <span style={{ color:'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ textAlign:'center' }}>
                      <span className={`badge ${badge.cls}`} style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11 }}>
                        {badge.icon}{badge.label}
                      </span>
                      {s.outstanding > 0 && (
                        <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>
                          {fmtMoney(s.outstanding)} due
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr style={{ borderTop:'2px solid var(--border)', background:'var(--bg)' }}>
                  <td colSpan={6} style={{ ...cellSm, fontWeight:800, textAlign:'right', paddingRight:12 }}>Period Total</td>
                  <td style={{ textAlign:'right', fontWeight:700 }}>{fmtMoney(filtered.reduce((a,s)=>a+(s.amount||0),0))}</td>
                  <td style={{ textAlign:'right', fontWeight:700, color:'var(--text-muted)' }}>{fmtMoney(filtered.reduce((a,s)=>a+(s.gst_amount||0),0))}</td>
                  <td style={{ textAlign:'right', fontWeight:900, color:'var(--success)' }}>{fmtMoney(filtered.reduce((a,s)=>a+(s.grand_total||s.total_amount||0),0))}</td>
                  <td colSpan={2}/>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {totalPages > 1 && (
          <div className="pagination">
            <span className="pagination-info">
              {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, total)} of {total}
            </span>
            <button className="pagination-btn" disabled={safePage === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
              <ChevronLeft size={13} />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const n = totalPages <= 5 ? i + 1 : Math.max(1, Math.min(safePage - 2, totalPages - 4)) + i
              return (
                <button key={n} className={`pagination-btn${n === safePage ? ' active' : ''}`} onClick={() => setPage(n)}>
                  {n}
                </button>
              )
            })}
            <button className="pagination-btn" disabled={safePage === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
              <ChevronRight size={13} />
            </button>
          </div>
        )}
      </div>

      {/* ── Add Sale Modal ── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth:580 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <IndianRupee size={16} style={{ color:'var(--primary)' }}/>
                <span className="modal-title">Add Sale Entry</span>
              </div>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={{ padding:20 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {/* Customer */}
                <div>
                  <label style={lbl}>Customer <span style={{ color:'var(--danger)' }}>*</span></label>
                  {customers.length > 0 ? (
                    <select className={`form-control${errors.customer_name?' error':''}`}
                      value={form.customer_id || form.customer_name}
                      onChange={e => {
                        const c = customers.find(c => (c._id||c.id) === e.target.value)
                        set('customer_id',   c ? (c._id||c.id) : '')
                        set('customer_name', c ? (c.name||c.customer_name) : e.target.value)
                      }}>
                      <option value="">— Select Customer —</option>
                      {customers.map(c => (
                        <option key={c._id||c.id} value={c._id||c.id}>
                          {c.name||c.customer_name}{c.mobile ? ` · ${c.mobile}` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input className={`form-control${errors.customer_name?' error':''}`}
                      placeholder="Customer name" value={form.customer_name}
                      onChange={e => set('customer_name', e.target.value)}/>
                  )}
                  {errors.customer_name && <div className="form-error">{errors.customer_name}</div>}
                </div>

                {/* Sale Date */}
                <div>
                  <label style={lbl}>Sale Date</label>
                  <input type="date" className="form-control" value={form.sale_date}
                    onChange={e => set('sale_date', e.target.value)}/>
                </div>

                {/* Product */}
                <div style={{ gridColumn:'span 2' }}>
                  <label style={lbl}>Product <span style={{ color:'var(--danger)' }}>*</span></label>
                  {products.length > 0 ? (
                    <select className={`form-control${errors.product_name?' error':''}`}
                      value={form.product_id || form.product_name}
                      onChange={e => {
                        const p = products.find(p => (p._id||p.id) === e.target.value)
                        if (p) {
                          set('product_id',   p._id||p.id)
                          set('product_name', p.name||p.product_name)
                          set('rate',  String(p.selling_price||p.rate||p.retail_price||p.dealer_price||''))
                          set('gst_percent', String(p.gst_percent||'18'))
                          set('unit', p.unit||'Pcs')
                        }
                      }}>
                      <option value="">— Select Product —</option>
                      {products.map(p => (
                        <option key={p._id||p.id} value={p._id||p.id}>
                          {p.name||p.product_name}{p.code ? ` [${p.code}]` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input className={`form-control${errors.product_name?' error':''}`}
                      placeholder="Product name" value={form.product_name}
                      onChange={e => set('product_name', e.target.value)}/>
                  )}
                  {errors.product_name && <div className="form-error">{errors.product_name}</div>}
                </div>

                {/* Qty */}
                <div>
                  <label style={lbl}>Quantity <span style={{ color:'var(--danger)' }}>*</span></label>
                  <div style={{ display:'flex', gap:6 }}>
                    <input className={`form-control${errors.qty?' error':''}`}
                      type="number" min="0" placeholder="0" value={form.qty}
                      onChange={e => set('qty', e.target.value)} style={{ flex:1 }}/>
                    <select className="form-control" style={{ width:80 }} value={form.unit}
                      onChange={e => set('unit', e.target.value)}>
                      {['Pcs','Box','Sqft','Kg','Mtr','Ltr','Set'].map(u => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                  {errors.qty && <div className="form-error">{errors.qty}</div>}
                </div>

                {/* Rate */}
                <div>
                  <label style={lbl}>Rate (₹) <span style={{ color:'var(--danger)' }}>*</span></label>
                  <input className={`form-control${errors.rate?' error':''}`}
                    type="number" min="0" placeholder="0.00" value={form.rate}
                    onChange={e => set('rate', e.target.value)}/>
                  {errors.rate && <div className="form-error">{errors.rate}</div>}
                </div>

                {/* GST */}
                <div>
                  <label style={lbl}>GST %</label>
                  <select className="form-control" value={form.gst_percent}
                    onChange={e => set('gst_percent', e.target.value)}>
                    {['0','5','12','18','28'].map(g => <option key={g}>{g}%</option>)}
                  </select>
                </div>

                {/* Payment mode */}
                <div>
                  <label style={lbl}>Payment Mode</label>
                  <select className="form-control" value={form.payment_mode}
                    onChange={e => set('payment_mode', e.target.value)}>
                    {['Cash','Bank Transfer','UPI','Cheque','Card','Other'].map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Totals summary */}
              <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 16px', margin:'14px 0', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, textAlign:'center' }}>
                {[
                  { label:'Amount',  val: fmtMoney(formAmt) },
                  { label:`GST (${form.gst_percent}%)`, val: fmtMoney(formGst) },
                  { label:'Total',   val: fmtMoney(formTotal), strong:true },
                ].map(i => (
                  <div key={i.label}>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:3 }}>{i.label}</div>
                    <div style={{ fontWeight: i.strong ? 900 : 700, fontSize: i.strong ? 18 : 14, color: i.strong ? 'var(--success)' : 'var(--text)' }}>{i.val}</div>
                  </div>
                ))}
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {/* Paid amount */}
                <div>
                  <label style={lbl}>Amount Paid Now (₹)</label>
                  <input className="form-control" type="number" min="0" max={formTotal}
                    placeholder="0" value={form.paid_amount}
                    onChange={e => {
                      const paid = Math.min(Number(e.target.value)||0, formTotal)
                      set('paid_amount', String(paid))
                      set('payment_status', paid >= formTotal ? 'Paid' : paid > 0 ? 'Partial' : 'Pending')
                    }}/>
                </div>

                {/* Payment status */}
                <div>
                  <label style={lbl}>Payment Status</label>
                  <select className="form-control" value={form.payment_status}
                    onChange={e => set('payment_status', e.target.value)}>
                    {['Pending','Partial','Paid'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>

                {/* Notes */}
                <div style={{ gridColumn:'span 2' }}>
                  <label style={lbl}>Notes</label>
                  <input className="form-control" placeholder="Optional notes…"
                    value={form.notes} onChange={e => set('notes', e.target.value)}/>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={saving} onClick={handleSave}
                style={{ display:'flex', alignItems:'center', gap:6 }}>
                {saving ? <><RefreshCw size={14} style={{ animation:'spin 1s linear infinite' }}/> Saving…</> : <><TrendingUp size={14}/> Save Sale</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  )
}

/* ── Micro-styles ── */
const th = {
  padding:'9px 12px', textAlign:'left',
  fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.4px',
  color:'var(--text-muted)', whiteSpace:'nowrap', borderBottom:'1px solid var(--border)',
}
const cellSm  = { fontSize:12 }
const emptyCell = { textAlign:'center', padding:32, color:'var(--text-muted)' }
const lbl = { display:'block', fontSize:12, fontWeight:700, color:'var(--text-muted)', marginBottom:4, textTransform:'uppercase', letterSpacing:'.03em' }
