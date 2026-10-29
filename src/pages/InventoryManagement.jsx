import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Search, AlertTriangle, Package, Warehouse as WarehouseIcon, RefreshCw, X,
  Eye, Edit3, Boxes, ShieldAlert, PackageX, Plus, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { inventoryApi } from '../api/inventoryApi'
import StockAdjustmentModal from '../components/StockAdjustmentModal'

const PAGE_SIZE = 10

/* ─────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────── */
const fmtN = n => Number(n || 0).toLocaleString('en-IN')

// A row's sellable quantity (backward-compat with legacy current_stock).
const availOf = row => (Number(row.available_stock) || 0) > 0
  ? Number(row.available_stock)
  : (Number(row.current_stock) || 0)
const physOf = row => (Number(row.physical_stock) || 0) > 0
  ? Number(row.physical_stock)
  : (Number(row.current_stock) || 0)

function stockStatus(row) {
  const avail = availOf(row)
  const alert = Number(row.low_stock_alert) || 0
  if (avail <= 0)                  return 'out'
  if (alert > 0 && avail <= alert) return 'low'
  return 'ok'
}

const STATUS_STYLE = {
  ok:  { bg:'#ecfdf5', color:'#059669', border:'#a7f3d0', label:'In Stock' },
  low: { bg:'#fffbeb', color:'#d97706', border:'#fde68a', label:'Low Stock' },
  out: { bg:'#fef2f2', color:'#dc2626', border:'#fecaca', label:'Out of Stock' },
}

/* ─────────────────────────────────────────────────────────────
   Main component
───────────────────────────────────────────────────────────── */
export default function InventoryManagement() {
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all')   // all | ok | low | out | damaged
  const [warehouseFilter, setWFilter]   = useState('all')
  const [page, setPage]                 = useState(1)

  // Stock Details (View) panel
  const [viewTarget, setViewTarget] = useState(null)   // the inventory row
  const [viewDetail, setViewDetail] = useState(null)   // fetched detail (+movements)
  const [viewLoading, setViewLoading] = useState(false)

  const [inventory,  setInventory]  = useState([])
  const [summary,    setSummary]    = useState(null)
  const [warehouses, setWarehouses] = useState([])
  const [loading,    setLoading]    = useState(false)

  const [adjModalOpen, setAdjModalOpen] = useState(false)

  // Per-row quick adjust
  const [adjustTarget, setAdjustTarget] = useState(null)
  const [adjForm,      setAdjForm]      = useState({ adjustment: '', reason: '', purchase_rate: '' })
  const [adjSaving,    setAdjSaving]    = useState(false)
  const [adjMsg,       setAdjMsg]       = useState('')

  // ── Load ─────────────────────────────────────────────────
  const loadInventory = useCallback(async () => {
    setLoading(true)
    try {
      const params = { limit: 500, _t: Date.now() }
      if (warehouseFilter !== 'all') params.warehouse_id = warehouseFilter
      const [invRes, sumRes, whRes] = await Promise.allSettled([
        inventoryApi.list(params),
        inventoryApi.getSummary ? inventoryApi.getSummary() : Promise.resolve(null),
        inventoryApi.listWarehouses ? inventoryApi.listWarehouses() : Promise.resolve(null),
      ])
      if (invRes.status === 'fulfilled') {
        const d = invRes.value?.data || invRes.value
        setInventory(Array.isArray(d) ? d : (Array.isArray(d?.inventory) ? d.inventory : []))
      }
      if (sumRes.status === 'fulfilled' && sumRes.value) {
        setSummary(sumRes.value?.data || sumRes.value)
      }
      if (whRes.status === 'fulfilled' && whRes.value) {
        const d = whRes.value?.data || whRes.value
        setWarehouses(Array.isArray(d) ? d : (Array.isArray(d?.warehouses) ? d.warehouses : []))
      }
    } finally {
      setLoading(false)
    }
  }, [warehouseFilter])

  useEffect(() => { loadInventory() }, [loadInventory])

  // ── Filter ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return inventory.filter(inv => {
      if (!inv.product_id) return false
      const hay = [inv.product_name, inv.product_code, inv.brand_name, inv.category_name, inv.warehouse_name]
        .map(v => (v || '').toLowerCase())
      const matchSearch = !q || hay.some(h => h.includes(q))
      const st = stockStatus(inv)
      let matchStatus = true
      if (statusFilter === 'damaged') matchStatus = (Number(inv.blocked_stock) || 0) > 0
      else if (statusFilter !== 'all') matchStatus = st === statusFilter
      return matchSearch && matchStatus
    })
  }, [inventory, search, statusFilter])

  // ── Pagination (10 rows per page) ──────────────────────────
  const total       = filtered.length
  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage    = Math.min(page, totalPages)
  const paged       = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // ── KPI totals (prefer server summary, fall back to rows) ─
  const kpis = useMemo(() => {
    const rows = inventory
    return {
      available: summary?.total_available ?? rows.reduce((a, r) => a + availOf(r), 0),
      damaged:   summary?.total_blocked   ?? rows.reduce((a, r) => a + (Number(r.blocked_stock) || 0), 0),
      low:       summary?.low_stock       ?? rows.filter(r => stockStatus(r) === 'low').length,
      out:       summary?.out_of_stock    ?? rows.filter(r => stockStatus(r) === 'out').length,
    }
  }, [inventory, summary])

  // Products currently at/below their alert threshold — for the alert banner.
  const lowStockItems = useMemo(
    () => inventory.filter(r => stockStatus(r) === 'low'),
    [inventory],
  )
  const outStockItems = useMemo(
    () => inventory.filter(r => stockStatus(r) === 'out'),
    [inventory],
  )

  // ── Quick adjust submit ──────────────────────────────────
  const handleAdjust = async () => {
    if (!adjustTarget) return
    const adj = parseFloat(adjForm.adjustment)
    if (!adj || isNaN(adj)) { setAdjMsg('Enter a valid non-zero quantity.'); return }
    setAdjSaving(true); setAdjMsg('')
    try {
      const payload = {
        product_id:   adjustTarget.product_id?._id || adjustTarget.product_id,
        warehouse_id: adjustTarget.warehouse_id?._id || adjustTarget.warehouse_id || undefined,
        adjustment:   adj,
        reason:       adjForm.reason || (adj > 0 ? 'Manual stock in' : 'Manual stock out'),
        reference_type: 'Manual',
      }
      if (adjForm.purchase_rate) payload.purchase_rate = parseFloat(adjForm.purchase_rate)
      await inventoryApi.adjust(payload)
      setAdjMsg(`✓ Stock ${adj > 0 ? 'added' : 'deducted'} successfully.`)
      setTimeout(() => {
        setAdjustTarget(null)
        setAdjForm({ adjustment: '', reason: '', purchase_rate: '' })
        setAdjMsg('')
        loadInventory()
      }, 1000)
    } catch (e) {
      setAdjMsg(e?.response?.data?.message || 'Adjustment failed.')
    } finally {
      setAdjSaving(false)
    }
  }

  // ── Open Stock Details (View) ────────────────────────────
  const openView = async (row) => {
    setViewTarget(row)
    setViewDetail(null)
    const id = row._id || row.id
    if (!id) return
    setViewLoading(true)
    try {
      const res = await inventoryApi.get(id)
      setViewDetail(res?.data || res)
    } catch { setViewDetail(null) } finally { setViewLoading(false) }
  }

  const KPI = ({ label, value, icon, color, bg, border, filterKey }) => (
    <div
      onClick={() => { if (filterKey) { setStatusFilter(prev => prev === filterKey ? 'all' : filterKey); setPage(1) } }}
      style={{
        background: bg, border:`1.5px solid ${border}`, borderRadius:12, padding:'14px 18px',
        display:'flex', alignItems:'center', gap:12, cursor: filterKey ? 'pointer' : 'default',
        outline: statusFilter === filterKey ? `2px solid ${color}` : 'none', minWidth:0,
      }}>
      <div style={{ width:40, height:40, borderRadius:10, background:'rgba(255,255,255,.7)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color }}>{icon}</div>
      <div style={{ minWidth:0 }}>
        <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em', color, marginBottom:2 }}>{label}</div>
        <div style={{ fontSize:22, fontWeight:900, color, lineHeight:1 }}>{value}</div>
      </div>
    </div>
  )

  return (
    <>
      <div className="breadcrumb">
        <span>Purchase &amp; Inventory</span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-active">Inventory Management</span>
      </div>

      {/* ── KPI strip ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
        <KPI label="Available Stock" value={fmtN(kpis.available)} icon={<Boxes size={18}/>}        color="#059669" bg="#ecfdf5" border="#a7f3d0" />
        <KPI label="Low Stock SKUs"  value={fmtN(kpis.low)}       icon={<AlertTriangle size={18}/>} color="#d97706" bg="#fffbeb" border="#fde68a" filterKey="low" />
        <KPI label="Out of Stock"    value={fmtN(kpis.out)}       icon={<ShieldAlert size={18}/>}   color="#dc2626" bg="#fef2f2" border="#fecaca" filterKey="out" />
        <KPI label="Damaged / QC"    value={fmtN(kpis.damaged)}   icon={<PackageX size={18}/>}      color="#b45309" bg="#fff7ed" border="#fed7aa" filterKey="damaged" />
      </div>

      {/* ── Low / out of stock alert banner ── */}
      {(lowStockItems.length > 0 || outStockItems.length > 0) && (
        <div style={{
          display:'flex', alignItems:'flex-start', gap:12, padding:'12px 16px', marginBottom:16,
          background:'#fffbeb', border:'1px solid #fde68a', borderRadius:12,
        }}>
          <AlertTriangle size={20} color="#d97706" style={{ flexShrink:0, marginTop:2 }}/>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:800, color:'#b45309' }}>
              {outStockItems.length > 0 && `${outStockItems.length} product${outStockItems.length > 1 ? 's' : ''} out of stock`}
              {outStockItems.length > 0 && lowStockItems.length > 0 && ' · '}
              {lowStockItems.length > 0 && `${lowStockItems.length} running low`}
            </div>
            <div style={{ fontSize:12, color:'#92400e', marginTop:3 }}>
              {[...outStockItems, ...lowStockItems].slice(0, 4).map(r => r.product_name).filter(Boolean).join(', ')}
              {(outStockItems.length + lowStockItems.length) > 4 ? ' and more…' : ''}
            </div>
          </div>
          <button
            onClick={() => { setStatusFilter(outStockItems.length ? 'out' : 'low'); setPage(1) }}
            style={{ background:'#d97706', color:'#fff', border:'none', borderRadius:8, padding:'6px 12px', fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
            Review
          </button>
        </div>
      )}

      {/* ── Table card ── */}
      <div className="card">
        <div className="card-header" style={{ flexWrap:'wrap', gap:10 }}>
          <span className="card-title">Live Stock ({filtered.length})</span>
          <div className="header-actions" style={{ flexWrap:'wrap', gap:8 }}>
            <div className="search-bar">
              <Search size={14}/>
              <input placeholder="Search product, code, brand, warehouse…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}/>
            </div>
            <select className="form-control" style={{ width:150 }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
              <option value="all">All Status</option>
              <option value="ok">In Stock</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
              <option value="damaged">Has Damaged</option>
            </select>
            {warehouses.length > 0 && (
              <select className="form-control" style={{ width:150 }} value={warehouseFilter} onChange={e => { setWFilter(e.target.value); setPage(1) }}>
                <option value="all">All Warehouses</option>
                {warehouses.map(w => <option key={w._id||w.id} value={w._id||w.id}>{w.name}</option>)}
              </select>
            )}
            <button className="btn btn-secondary" onClick={loadInventory} disabled={loading} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}/>
              Refresh
            </button>
            <button className="btn btn-primary" onClick={() => setAdjModalOpen(true)} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <Plus size={15}/> Create Stock Adjustment
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={th}>#</th>
                <th style={th}>Product</th>
                <th style={th}>Warehouse</th>
                <th style={th}>Added By</th>
                <th style={{ ...th, textAlign:'right' }}>Avg Price</th>
                <th style={{ ...th, textAlign:'center' }}>GST</th>
                <th style={{ ...th, textAlign:'right' }}>Stock Value</th>
                <th style={{ ...th, textAlign:'center' }}>Total Qty</th>
                <th style={{ ...th, textAlign:'center' }}>Available</th>
                <th style={{ ...th, textAlign:'center' }}>Damaged</th>
                <th style={{ ...th, textAlign:'center' }}>Min Level</th>
                <th style={{ ...th, textAlign:'center' }}>Status</th>
                <th style={{ ...th, textAlign:'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={13} style={emptyCell}>
                  <RefreshCw size={24} style={{ opacity:.3, display:'block', margin:'0 auto 8px', animation:'spin 1s linear infinite' }}/>
                  Loading inventory…
                </td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={13} style={emptyCell}>
                  <Package size={32} style={{ opacity:.2, display:'block', margin:'0 auto 8px' }}/>
                  {search || statusFilter !== 'all'
                    ? 'No matching records.'
                    : 'No inventory yet. Use “Create Stock Adjustment” to add stock.'}
                </td></tr>
              )}
              {!loading && paged.map((inv, i) => {
                const id    = String(inv._id || inv.id || i)
                const rowNo = (safePage - 1) * PAGE_SIZE + i + 1
                const st    = stockStatus(inv)
                const ss    = STATUS_STYLE[st]
                const avail = availOf(inv)
                const phys  = physOf(inv)
                const blk   = Number(inv.blocked_stock)  || 0
                const alert = Number(inv.low_stock_alert) || 0
                const unit  = inv.unit || ''
                const rate  = Number(inv.purchase_rate)  || 0
                const gst   = inv.gst_percent
                const value = avail * rate
                const hsn   = inv.hsn_code || inv.product_id?.hsn_code || ''

                return (
                  <>
                    <tr key={id} className={st === 'out' ? 'row-out' : st === 'low' ? 'row-low' : ''}>
                      <td style={{ ...td, color:'var(--text-muted)', fontSize:12 }}>{rowNo}</td>

                      <td style={td}>
                        <div style={{ fontWeight:700, fontSize:13 }}>{inv.product_name || '—'}</div>
                        {inv.product_code && <div style={{ fontFamily:'monospace', fontSize:11, color:'var(--primary)', marginTop:2 }}>{inv.product_code}</div>}
                        <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
                          {[inv.brand_name, inv.category_name].filter(Boolean).join(' · ')}
                          {hsn ? `${(inv.brand_name || inv.category_name) ? ' · ' : ''}HSN ${hsn}` : ''}
                        </div>
                      </td>

                      <td style={{ ...td, fontSize:12 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                          <WarehouseIcon size={12} style={{ color:'var(--text-muted)', flexShrink:0 }}/>
                          <span style={{ fontWeight:600 }}>{inv.warehouse_name || '—'}</span>
                        </div>
                      </td>

                      {/* Added By */}
                      <td style={{ ...td, fontSize:12 }}>
                        <AddedBy type={inv.added_by_type} name={inv.added_by_name} />
                      </td>

                      {/* Avg Price */}
                      <td style={{ ...td, textAlign:'right', fontSize:12 }}>
                        {rate > 0 ? `₹${fmtN(rate)}` : '—'}
                      </td>

                      {/* GST */}
                      <td style={{ ...td, textAlign:'center', fontSize:12, color:'var(--text-muted)' }}>
                        {gst != null ? `${gst}%` : '—'}
                      </td>

                      {/* Stock Value */}
                      <td style={{ ...td, textAlign:'right', fontWeight:700, fontSize:12, color:'#0f766e' }}>
                        {value > 0 ? `₹${fmtN(value)}` : '—'}
                      </td>

                      {/* Total Qty (physical) */}
                      <td style={{ ...td, textAlign:'center', fontWeight:700, color:'#1d4ed8' }}>{fmtN(phys)}</td>

                      {/* Available — prominent */}
                      <td style={{ ...td, textAlign:'center' }}>
                        <div style={{ display:'inline-block', padding:'4px 12px', borderRadius:20, fontSize:14, fontWeight:900, background: ss.bg, color: ss.color }}>
                          {fmtN(avail)}
                        </div>
                        {unit && <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>{unit}</div>}
                      </td>

                      {/* Damaged (blocked) */}
                      <td style={{ ...td, textAlign:'center' }}>
                        {blk > 0
                          ? <span style={{ display:'inline-block', padding:'2px 9px', borderRadius:20, fontSize:12, fontWeight:800, background:'#fff7ed', color:'#b45309', border:'1px solid #fed7aa' }}>{fmtN(blk)}</span>
                          : <span style={{ color:'var(--text-muted)' }}>—</span>}
                      </td>

                      {/* Min level */}
                      <td style={{ ...td, textAlign:'center', color:'var(--text-muted)', fontSize:12 }}>
                        {alert > 0 ? fmtN(alert) : '—'}
                      </td>

                      {/* Status */}
                      <td style={{ ...td, textAlign:'center' }}>
                        <span style={{ background:ss.bg, color:ss.color, border:`1px solid ${ss.border}`, borderRadius:20, padding:'3px 10px', fontWeight:700, fontSize:11, whiteSpace:'nowrap' }}>
                          {ss.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ ...td, textAlign:'center' }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                          <button title="View stock details" onClick={() => openView(inv)}
                            style={{ ...iconBtn, background:'#eff6ff', border:'1px solid #bfdbfe', color:'#2563eb' }}>
                            <Eye size={14}/>
                          </button>
                          <button title="Adjust stock" onClick={() => { setAdjustTarget(inv); setAdjForm({ adjustment:'', reason:'', purchase_rate: inv.purchase_rate||'' }); setAdjMsg('') }}
                            style={{ ...iconBtn, background:'#f0fdf4', border:'1px solid #a7f3d0', color:'#059669' }}>
                            <Edit3 size={14}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  </>
                )
              })}
            </tbody>
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

      {/* ── Quick adjust modal ── */}
      {adjustTarget && (
        <div className="modal-overlay" onClick={() => { setAdjustTarget(null); setAdjMsg('') }}>
          <div className="modal" style={{ maxWidth:480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <Edit3 size={16} style={{ color:'var(--primary)' }}/>
                <span className="modal-title">Adjust Stock</span>
              </div>
              <button className="modal-close" onClick={() => { setAdjustTarget(null); setAdjMsg('') }}><X size={16}/></button>
            </div>
            <div style={{ padding:20 }}>
              <div style={{ background:'var(--bg)', borderRadius:8, padding:'10px 14px', marginBottom:16, border:'1px solid var(--border)' }}>
                <div style={{ fontWeight:800, fontSize:14 }}>{adjustTarget.product_name}</div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:3 }}>
                  {adjustTarget.product_code && <span style={{ fontFamily:'monospace' }}>{adjustTarget.product_code} · </span>}
                  Available: <strong>{fmtN(availOf(adjustTarget))} {adjustTarget.unit}</strong>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Adjustment Quantity *</label>
                <input className="form-control" type="number" step="any"
                  placeholder="+ to add   /   − to remove"
                  value={adjForm.adjustment}
                  onChange={e => setAdjForm(f => ({ ...f, adjustment: e.target.value }))}/>
                {adjForm.adjustment && Number(adjForm.adjustment) !== 0 && (
                  <div style={{ marginTop:6, fontSize:12, fontWeight:600, color: Number(adjForm.adjustment) > 0 ? '#059669' : '#dc2626' }}>
                    {Number(adjForm.adjustment) > 0
                      ? `▲ Add ${fmtN(Math.abs(Number(adjForm.adjustment)))} ${adjustTarget.unit}`
                      : `▼ Remove ${fmtN(Math.abs(Number(adjForm.adjustment)))} ${adjustTarget.unit}`}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Reason / Note</label>
                <input className="form-control"
                  placeholder="e.g. Physical count correction, damaged goods"
                  value={adjForm.reason}
                  onChange={e => setAdjForm(f => ({ ...f, reason: e.target.value }))}/>
              </div>

              {adjMsg && (
                <div style={{
                  padding:'8px 12px', borderRadius:8, fontSize:12, fontWeight:600,
                  background: adjMsg.startsWith('✓') ? '#ecfdf5' : '#fef2f2',
                  color:      adjMsg.startsWith('✓') ? '#059669' : '#dc2626',
                  border:     `1px solid ${adjMsg.startsWith('✓') ? '#a7f3d0' : '#fecaca'}`,
                }}>
                  {adjMsg}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setAdjustTarget(null); setAdjMsg('') }}>Cancel</button>
              <button className="btn btn-primary" disabled={adjSaving || !adjForm.adjustment} onClick={handleAdjust}>
                {adjSaving ? 'Saving…' : 'Apply Adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Stock Details (View) panel ── */}
      {viewTarget && (() => {
        const d      = viewDetail || viewTarget
        const avail  = availOf(d)
        const phys   = physOf(d)
        const res    = Number(d.reserved_stock) || 0
        const blk    = Number(d.blocked_stock)  || 0
        const packed = Number(d.packed_stock)   || 0
        const disp   = Number(d.dispatched_qty) || 0
        const rate   = Number(d.purchase_rate)  || 0
        const value  = avail * rate
        const prod   = viewDetail?.product_id && typeof viewDetail.product_id === 'object' ? viewDetail.product_id : {}
        const st     = stockStatus(d)
        const ss     = STATUS_STYLE[st]
        const moves  = viewDetail?.movements || []
        const unit   = d.unit || prod.unit || ''

        return (
          <div className="modal-overlay" onClick={() => setViewTarget(null)}>
            <div className="modal" style={{ maxWidth:820, width:'96%', maxHeight:'92vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <Package size={17} style={{ color:'var(--primary)' }}/>
                  <span className="modal-title">Stock Details — {d.product_name || prod.name || d.product_code}</span>
                </div>
                <button className="modal-close" onClick={() => setViewTarget(null)}><X size={18}/></button>
              </div>

              <div style={{ padding:20 }}>
                {/* Status badge line */}
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                  <span style={{ background:ss.bg, color:ss.color, border:`1px solid ${ss.border}`, borderRadius:20, padding:'4px 12px', fontWeight:800, fontSize:12 }}>{ss.label}</span>
                  {viewLoading && <span style={{ fontSize:12, color:'var(--text-muted)' }}><RefreshCw size={12} style={{ verticalAlign:'-2px', animation:'spin 1s linear infinite' }}/> Loading…</span>}
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                  {/* Product Information */}
                  <div style={{ background:'#f0f7ff', border:'1px solid #dbeafe', borderRadius:12, padding:16 }}>
                    <div style={secLabel}>Product Information</div>
                    <InfoRow label="Product Code" value={d.product_code || prod.code || '—'} mono />
                    <InfoRow label="Item Name"    value={d.product_name || prod.name || '—'} />
                    <InfoRow label="Brand"        value={d.brand_name || prod.brand_id?.name || '—'} />
                    <InfoRow label="Category"     value={d.category_name || prod.category_id?.name || '—'} />
                    {prod.hsn_code && <InfoRow label="HSN Code" value={prod.hsn_code} mono />}
                    {prod.size && <InfoRow label="Size" value={prod.size} />}
                    <InfoRow label="Unit"         value={unit || '—'} />
                  </div>

                  {/* Stock Summary */}
                  <div style={{ background:'#f8fafc', border:'1px solid var(--border)', borderRadius:12, padding:16 }}>
                    <div style={secLabel}>Stock Summary</div>
                    <InfoRow label="Warehouse"       value={d.warehouse_name || 'Unassigned'} />
                    <InfoRow label="Physical (Total)" value={`${fmtN(phys)} ${unit}`} strong />
                    <InfoRow label="Available (Net)"  value={`${fmtN(avail)} ${unit}`} valueColor={ss.color} strong />
                    <InfoRow label="Reserved"         value={`${fmtN(res)} ${unit}`} valueColor={res > 0 ? '#7c3aed' : undefined} />
                    <InfoRow label="Packed"           value={`${fmtN(packed)} ${unit}`} />
                    <InfoRow label="Damaged / QC"     value={`${fmtN(blk)} ${unit}`} valueColor={blk > 0 ? '#b45309' : undefined} />
                    <InfoRow label="Total Dispatched" value={`${fmtN(disp)} ${unit}`} />
                    <InfoRow label="Total Stock Value" value={value > 0 ? `₹${fmtN(value)}` : '—'} />
                  </div>
                </div>

                {/* Movement history */}
                <div style={{ marginTop:16 }}>
                  <div style={secLabel}>Recent Stock Movements</div>
                  {moves.length === 0 ? (
                    <div style={{ textAlign:'center', color:'var(--text-muted)', fontSize:13, padding:'20px 0', border:'1px dashed var(--border)', borderRadius:10 }}>
                      No stock movement history yet.
                    </div>
                  ) : (
                    <div className="table-wrap" style={{ border:'1px solid var(--border)', borderRadius:10 }}>
                      <table>
                        <thead>
                          <tr>
                            <th style={th}>Date</th>
                            <th style={th}>Type</th>
                            <th style={th}>Reference</th>
                            <th style={{ ...th, textAlign:'center' }}>Qty In</th>
                            <th style={{ ...th, textAlign:'center' }}>Qty Out</th>
                            <th style={{ ...th, textAlign:'center' }}>Balance</th>
                            <th style={th}>Remarks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {moves.map((m, i) => {
                            const isIn = m.movement_type === 'Stock In' || m.movement_type === 'Transfer In'
                            const ref  = movementRef(m)
                            return (
                              <tr key={m._id || i}>
                                <td style={{ ...td, fontSize:12, whiteSpace:'nowrap' }}>{m.movement_date ? new Date(m.movement_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—'}</td>
                                <td style={{ ...td, fontSize:12 }}>
                                  <span style={{
                                    display:'inline-block', padding:'2px 8px', borderRadius:5, fontSize:11, fontWeight:700,
                                    color: isIn ? '#059669' : '#dc2626',
                                    background: isIn ? '#ecfdf5' : '#fef2f2',
                                    border: `1px solid ${isIn ? '#a7f3d0' : '#fecaca'}`,
                                  }}>{isIn ? 'IN' : 'OUT'}</span>
                                  <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>{ref.source}</div>
                                </td>
                                <td style={{ ...td, fontSize:11.5 }}>
                                  <div style={{ fontFamily:'monospace', fontWeight:600 }}>{ref.code}</div>
                                </td>
                                <td style={{ ...td, textAlign:'center', fontWeight:700, color:'#059669' }}>{isIn ? fmtN(m.quantity) : '—'}</td>
                                <td style={{ ...td, textAlign:'center', fontWeight:700, color:'#dc2626' }}>{!isIn ? fmtN(m.quantity) : '—'}</td>
                                <td style={{ ...td, textAlign:'center', fontSize:12, fontWeight:700 }}>{fmtN(m.new_stock)}</td>
                                <td style={{ ...td, fontSize:12, color:'var(--text-muted)', maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.notes || '—'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Create Stock Adjustment (multi-product add/remove) ── */}
      <StockAdjustmentModal
        open={adjModalOpen}
        onClose={() => setAdjModalOpen(false)}
        onSaved={loadInventory}
      />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  )
}

/* ── Friendly source label + reference code for a stock movement ── */
function movementRef(m) {
  const rt = String(m.reference_type || '').toLowerCase()
  const source = rt.includes('purchase') ? 'Purchase / GRN'
    : rt.includes('sale')     ? 'Sale / Dispatch'
    : rt.includes('order')    ? 'Order'
    : rt.includes('transfer') ? 'Transfer'
    : rt.includes('manual')   ? 'Manual Adjustment'
    : (m.reference_type || '—')
  const code = m.invoice_number || m.reference_id || '—'
  return { source, code }
}

/* ── "Added By" badge — Admin / Staff App / Retailer App + person name ── */
function AddedBy({ type, name }) {
  const t = String(type || '').toLowerCase()
  const cfg = t.includes('staff')
    ? { label: 'Staff App',    color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' }
    : t.includes('retail')
    ? { label: 'Retailer App', color: '#0369a1', bg: '#eff6ff', border: '#bfdbfe' }
    : t.includes('whole')
    ? { label: 'Wholesaler',   color: '#b45309', bg: '#fff7ed', border: '#fed7aa' }
    : t.includes('admin')
    ? { label: 'Admin',        color: '#1d4ed8', bg: '#eef2ff', border: '#c7d2fe' }
    : { label: 'Unknown',      color: '#475569', bg: '#f1f5f9', border: '#e2e8f0' }
  return (
    <div>
      <span style={{
        display:'inline-block', fontSize:10, fontWeight:800, letterSpacing:'.03em',
        color: cfg.color, background: cfg.bg, border:`1px solid ${cfg.border}`,
        borderRadius:5, padding:'2px 7px',
      }}>{cfg.label}</span>
      {name ? <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:3 }}>{name}</div> : null}
    </div>
  )
}

/* ── Label/value row used in the Stock Details panel ── */
function InfoRow({ label, value, mono, strong, valueColor }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:12, padding:'5px 0', borderBottom:'1px dashed rgba(0,0,0,.06)' }}>
      <span style={{ fontSize:12, color:'var(--text-muted)' }}>{label}</span>
      <span style={{
        fontSize:13, textAlign:'right',
        fontWeight: strong ? 800 : 600,
        fontFamily: mono ? 'monospace' : 'inherit',
        color: valueColor || 'var(--text)',
      }}>{value}</span>
    </div>
  )
}

/* ── Shared micro-styles ── */
const th = {
  padding:'9px 12px', textAlign:'left',
  fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.4px',
  color:'var(--text-muted)', whiteSpace:'nowrap', borderBottom:'1px solid var(--border)',
}
const td = { padding:'10px 12px', fontSize:13, verticalAlign:'middle' }
const emptyCell = { textAlign:'center', padding:40, color:'var(--text-muted)' }
const iconBtn = { display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:7, cursor:'pointer', flexShrink:0 }
const secLabel = { fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:'.06em', color:'var(--primary)', marginBottom:10 }
