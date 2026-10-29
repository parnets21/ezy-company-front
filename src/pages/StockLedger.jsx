import { useState, useEffect, useCallback, useMemo } from 'react'
import { Search, RefreshCw, Download, BookOpen, Filter } from 'lucide-react'
import { stockLedgerApi } from '../api/purchaseInventoryApi'
import { inventoryApi } from '../api/inventoryApi'

const TX_TYPE_COLOR = {
  'Opening Stock':      '#2563EB',
  'Purchase Receipt':   '#059669',
  'Purchase Return':    '#DC2626',
  'Stock Transfer In':  '#7C3AED',
  'Stock Transfer Out': '#EA580C',
  'Stock Adjustment':   '#D97706',
  'Damage':             '#DC2626',
  'Breakage':           '#DC2626',
  'Sale':               '#F26522',
  'Other Stock In':     '#059669',
  'Other Stock Out':    '#DC2626',
}

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtN    = n => Number(n || 0).toLocaleString('en-IN')

export default function StockLedger({ products = [], warehouses = [] }) {
  const [entries,      setEntries]      = useState([])
  const [loading,      setLoading]      = useState(false)
  const [search,       setSearch]       = useState('')
  const [productFilter,setProductFilter]= useState('')
  const [whFilter,     setWhFilter]     = useState('')
  const [typeFilter,   setTypeFilter]   = useState('')
  const [fromDate,     setFromDate]     = useState('')
  const [toDate,       setToDate]       = useState('')
  const [toast,        setToast]        = useState({ msg: '', type: 'success' })

  const fire = (msg, type = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: 'success' }), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { limit: 500 }
      if (productFilter) params.product_id = productFilter
      if (whFilter)      params.warehouse_id = whFilter
      if (typeFilter)    params.transaction_type = typeFilter
      if (fromDate)      params.from_date = fromDate
      if (toDate)        params.to_date = toDate

      // Try dedicated ledger API, fall back to inventory movements
      let data = []
      try {
        const res = await stockLedgerApi.list(params)
        const d = res?.data || res
        data = Array.isArray(d) ? d : (Array.isArray(d?.entries) ? d.entries : (Array.isArray(d?.ledger) ? d.ledger : []))
      } catch {
        const res = await inventoryApi.listMovements(params)
        const d = res?.data || res
        data = Array.isArray(d) ? d : (Array.isArray(d?.movements) ? d.movements : [])
      }
      setEntries(data)
    } catch { fire('Failed to load ledger', 'error') }
    finally { setLoading(false) }
  }, [productFilter, whFilter, typeFilter, fromDate, toDate])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return entries
    return entries.filter(e =>
      [e.product_name, e.warehouse_name, e.transaction_type, e.reference_no]
        .some(v => (v || '').toLowerCase().includes(q))
    )
  }, [entries, search])

  const txTypes = useMemo(() => [...new Set(entries.map(e => e.transaction_type).filter(Boolean))], [entries])

  return (
    <div>
      {toast.msg && (
        <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 9999, background: toast.type === 'error' ? '#FEF2F2' : '#ECFDF5', border: `1px solid ${toast.type === 'error' ? '#FECACA' : '#A7F3D0'}`, color: toast.type === 'error' ? '#DC2626' : '#059669', padding: '10px 18px', borderRadius: 10, fontWeight: 600, fontSize: 13 }}>{toast.msg}</div>
      )}

      <div className="breadcrumb"><span>Inventory</span><span className="breadcrumb-sep">›</span><span className="breadcrumb-active">Stock Ledger</span></div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><BookOpen size={22} color="#F26522" /> Stock Ledger</div>
          <div className="page-desc">Complete history of every stock movement — traceable to source document</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={14} /> Refresh</button>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '16px 18px', marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr) repeat(2,1fr)', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <label className="form-label">Product</label>
            <select className="form-control" value={productFilter} onChange={e => setProductFilter(e.target.value)}>
              <option value="">All Products</option>
              {products.map(p => <option key={p._id || p.id} value={p._id || p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Warehouse</label>
            <select className="form-control" value={whFilter} onChange={e => setWhFilter(e.target.value)}>
              <option value="">All Warehouses</option>
              {warehouses.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Transaction Type</label>
            <select className="form-control" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="">All Types</option>
              {txTypes.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">From Date</label>
            <input type="date" className="form-control" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="form-label">To Date</label>
            <input type="date" className="form-control" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input className="form-control" style={{ paddingLeft: 32 }} placeholder="Search product, type, reference…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={load}><Filter size={14} /> Apply Filters</button>
          <button className="btn btn-secondary" onClick={() => { setProductFilter(''); setWhFilter(''); setTypeFilter(''); setFromDate(''); setToDate(''); setSearch('') }}>Clear</button>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="card" style={{ padding: '10px 18px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div><span style={{ fontSize: 11, color: '#64748B', fontWeight: 700 }}>TOTAL ENTRIES</span><div style={{ fontSize: 20, fontWeight: 900, color: '#1E2D4A' }}>{filtered.length}</div></div>
          <div><span style={{ fontSize: 11, color: '#64748B', fontWeight: 700 }}>STOCK IN</span><div style={{ fontSize: 20, fontWeight: 900, color: '#059669' }}>{fmtN(filtered.filter(e => (e.qty_change || 0) > 0).reduce((a, e) => a + Math.abs(e.qty_change || 0), 0))}</div></div>
          <div><span style={{ fontSize: 11, color: '#64748B', fontWeight: 700 }}>STOCK OUT</span><div style={{ fontSize: 20, fontWeight: 900, color: '#DC2626' }}>{fmtN(filtered.filter(e => (e.qty_change || 0) < 0).reduce((a, e) => a + Math.abs(e.qty_change || 0), 0))}</div></div>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#1E2D4A', color: '#fff' }}>
              {['Date','Product','Warehouse','Transaction Type','Reference','Batch/Lot','In (+)','Out (-)','Balance','Cost','User'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: ['In (+)','Out (-)','Balance','Cost'].includes(h) ? 'right' : 'left', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Loading ledger…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={11} style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>
                <BookOpen size={32} style={{ opacity: 0.3, marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />No ledger entries found. Apply filters or check if data exists.
              </td></tr>
            ) : filtered.map((e, i) => {
              const change = parseFloat(e.qty_change || e.quantity || 0)
              const isIn   = change > 0
              const color  = TX_TYPE_COLOR[e.transaction_type] || '#64748B'
              return (
                <tr key={e._id || i} style={{ borderBottom: '1px solid #F1F5F9' }} onMouseEnter={ev => ev.currentTarget.style.background = '#FAFAFA'} onMouseLeave={ev => ev.currentTarget.style.background = ''}>
                  <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>{fmtDate(e.date || e.created_at)}</td>
                  <td style={{ padding: '9px 12px', fontWeight: 600 }}>{e.product_name || '—'}</td>
                  <td style={{ padding: '9px 12px' }}>{e.warehouse_name || '—'}</td>
                  <td style={{ padding: '9px 12px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: color + '18', color }}>{e.transaction_type || '—'}</span>
                  </td>
                  <td style={{ padding: '9px 12px', color: '#2563EB', fontWeight: 600 }}>{e.reference_no || e.reference_document || '—'}</td>
                  <td style={{ padding: '9px 12px', color: '#64748B' }}>{[e.batch_no, e.lot_no].filter(Boolean).join(' / ') || '—'}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#059669' }}>{isIn ? fmtN(Math.abs(change)) : ''}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#DC2626' }}>{!isIn ? fmtN(Math.abs(change)) : ''}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{e.balance_qty != null ? fmtN(e.balance_qty) : '—'}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{e.rate || e.cost ? `₹${fmtN(e.rate || e.cost)}` : '—'}</td>
                  <td style={{ padding: '9px 12px', color: '#64748B' }}>{e.user_name || e.created_by_name || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
