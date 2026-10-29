/**
 * StockAdjustmentModal.jsx
 * Reusable "Create Stock Adjustment" modal used inside Inventory Management.
 *
 * Lets the user pick Add/Remove, a reason + remarks, then add one or more
 * ADMIN-created products with a quantity each. On save it applies every line
 * via PATCH /inventory/adjust (positive = add, negative = remove).
 *
 * Props:
 *   open      - boolean, whether the modal is shown
 *   onClose   - () => void
 *   onSaved   - () => void, called after a successful adjustment (to refresh)
 */
import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  Search, Package, ArrowUpCircle, ArrowDownCircle, RefreshCw, X, Check, Plus, Trash2,
} from 'lucide-react'
import { inventoryApi } from '../api/inventoryApi'
import { productApi } from '../api/productApi'
import { useAuth } from '../context/AuthContext'

const fmtN = n => Number(n || 0).toLocaleString('en-IN')

const IMG_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'https://ezyenquiry-backend.onrender.com'
const imgUrl = (u) => {
  if (Array.isArray(u)) u = u[0]
  if (!u) return ''
  return String(u).startsWith('http') ? u : `${IMG_BASE}${u}`
}

// Mirrors the "ADDED BY" badge logic in Products Management.
function creatorTypeOf(product = {}) {
  if (product.created_by_type) return product.created_by_type
  const creatorRole = String(product.created_by?.role || '').toLowerCase()
  if (creatorRole.includes('retail')) return 'Retailer'
  if (creatorRole.includes('whole'))  return 'Wholesaler'
  if (creatorRole.includes('admin'))  return 'Admin'
  const companyType = String(product.company_id?.biz_type || '').toLowerCase()
  if (companyType.includes('retail')) return 'Retailer'
  if (companyType.includes('whole'))  return 'Wholesaler'
  if (String(product.code || '').toUpperCase().startsWith('RPD-')) return 'Retailer'
  return 'Unknown'
}

// Reasons (all optional), by direction.
const REASONS = {
  in:  ['New Purchase', 'Opening Stock', 'Stock Return', 'Stock Correction', 'Other'],
  out: ['Damage / Breakage', 'Expiry', 'Sample / Free Issue', 'Stock Correction', 'Other'],
}

const lbl = { display:'block', fontSize:12, fontWeight:700, color:'var(--text-muted)', marginBottom:6, textTransform:'uppercase', letterSpacing:'.03em' }
const th = { padding:'9px 12px', textAlign:'left', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.4px', color:'var(--text-muted)', whiteSpace:'nowrap', borderBottom:'1px solid var(--border)' }
const td = { padding:'10px 12px', fontSize:13, verticalAlign:'middle' }

export default function StockAdjustmentModal({ open, onClose, onSaved }) {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'Super Admin'

  const [products, setProducts] = useState([])
  const [invByProduct, setInvByProduct] = useState({})   // product_id -> available

  const [type, setType]       = useState('in')     // 'in' (add) | 'out' (remove)
  const [warehouse, setWarehouse] = useState('')   // optional
  const [reason, setReason]   = useState('')        // optional
  const [remarks, setRemarks] = useState('')
  const [lines, setLines]     = useState([])       // [{ product_id, name, code, unit, image, available, qty, rate }]
  const [picker, setPicker]   = useState(false)
  const [pQuery, setPQuery]   = useState('')
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState(null)

  // Load admin products + current stock when the modal opens.
  const load = useCallback(async () => {
    // Products
    let prodList = []
    try {
      if (isSuperAdmin) {
        let page = 1, hasNext = true
        while (hasNext && page <= 20) {
          const res = await productApi.listAll({ page, limit: 200 })
          const d = res?.data || res
          const list = Array.isArray(d?.products) ? d.products : (Array.isArray(d) ? d : [])
          prodList.push(...list)
          const pg = d?.pagination
          hasNext = pg ? (pg.hasNext ?? (page < (pg.totalPages || pg.pages || 1))) : false
          page += 1
        }
      } else {
        const res = await productApi.list({ limit: 1000, _t: Date.now() })
        const d = res?.data || res
        prodList = Array.isArray(d?.products) ? d.products : (Array.isArray(d) ? d : [])
      }
    } catch { prodList = [] }
    setProducts(prodList.filter(p => creatorTypeOf(p) === 'Admin'))

    // Current stock
    try {
      const res = await inventoryApi.list({ limit: 1000, _t: Date.now() })
      const d = res?.data || res
      const invs = Array.isArray(d) ? d : (Array.isArray(d?.inventory) ? d.inventory : [])
      const map = {}
      for (const inv of invs) {
        const pid = String(inv.product_id?._id || inv.product_id || '')
        if (!pid) continue
        const avail = (Number(inv.available_stock) || 0) > 0 ? Number(inv.available_stock) : (Number(inv.current_stock) || 0)
        map[pid] = (map[pid] || 0) + avail
      }
      setInvByProduct(map)
    } catch { setInvByProduct({}) }
  }, [isSuperAdmin])

  useEffect(() => {
    if (open) {
      setType('in'); setWarehouse(''); setReason(''); setRemarks(''); setLines([]); setMsg(null); setPicker(false); setPQuery('')
      load()
    }
  }, [open, load])

  const pickerRows = useMemo(() => {
    const added = new Set(lines.map(l => l.product_id))
    const q = pQuery.trim().toLowerCase()
    return products
      .filter(p => {
        const pid = String(p._id || p.id || '')
        if (added.has(pid)) return false
        if (!q) return true
        return (p.name || '').toLowerCase().includes(q) ||
          (p.code || '').toLowerCase().includes(q) ||
          (p.brand_name || p.brand_id?.name || '').toLowerCase().includes(q) ||
          (p.category_name || p.category_id?.name || '').toLowerCase().includes(q)
      })
      .slice(0, 60)
  }, [products, lines, pQuery])

  const addLine = (p) => {
    const pid = String(p._id || p.id || '')
    if (lines.some(l => l.product_id === pid)) { setPicker(false); return }
    setLines(prev => [...prev, {
      product_id: pid,
      name:  p.name || '',
      code:  p.code || '',
      unit:  p.unit || '',
      image: imgUrl(p.image_urls || p.images),
      available: invByProduct[pid] || 0,
      qty: '',
    }])
    setPicker(false); setPQuery('')
  }
  const updateLine = (pid, field, value) =>
    setLines(prev => prev.map(l => l.product_id === pid ? { ...l, [field]: value } : l))
  const removeLine = (pid) =>
    setLines(prev => prev.filter(l => l.product_id !== pid))

  const save = async () => {
    setMsg(null)
    // Reason is optional. Only a product with a valid quantity is required.
    if (lines.length === 0) { setMsg({ type:'err', text:'Add at least one product.' }); return }
    for (const l of lines) {
      const n = parseFloat(l.qty)
      if (!n || isNaN(n) || n <= 0) { setMsg({ type:'err', text:`Enter a valid quantity for ${l.name}.` }); return }
      if (type === 'out' && n > l.available) {
        setMsg({ type:'err', text:`${l.name}: only ${fmtN(l.available)} available.` }); return
      }
    }

    setSaving(true)
    const fallback = type === 'in' ? 'Manual stock in' : 'Manual stock out'
    // Warehouse is a free-text label here (not a linked warehouse record), so
    // fold it into the note rather than sending an invalid warehouse_id.
    const whNote = warehouse.trim() ? `Warehouse: ${warehouse.trim()}` : ''
    const notes = [reason, remarks, whNote].filter(Boolean).join(' — ') || fallback
    let ok = 0
    const failed = []
    for (const l of lines) {
      const n = parseFloat(l.qty)
      const payload = {
        product_id:     l.product_id,
        adjustment:     type === 'in' ? n : -n,
        reason:         notes,
        reference_type: 'Manual',
      }
      try { await inventoryApi.adjust(payload); ok++ }
      catch (e) { failed.push(`${l.name}: ${e?.response?.data?.message || 'failed'}`) }
    }
    setSaving(false)

    if (failed.length === 0) {
      setMsg({ type:'ok', text:`✓ Stock ${type === 'in' ? 'added' : 'removed'} for ${ok} product${ok > 1 ? 's' : ''}.` })
      setTimeout(() => { onSaved?.(); onClose?.() }, 900)
    } else {
      setMsg({ type:'err', text:`${ok} succeeded, ${failed.length} failed. ${failed.join('; ')}` })
      onSaved?.()
    }
  }

  if (!open) return null

  return (
    <>
      <div className="modal-overlay" onClick={() => { if (!saving) onClose?.() }}>
        <div className="modal" style={{ maxWidth:760, width:'94%', maxHeight:'92vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <span className="modal-title">Create Stock Adjustment</span>
            <button className="modal-close" onClick={() => { if (!saving) onClose?.() }}><X size={18}/></button>
          </div>

          <div style={{ padding:20 }}>
            {/* Adjustment details */}
            <div style={{ background:'#f0f7ff', border:'1px solid #dbeafe', borderRadius:12, padding:16, marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:800, color:'#1d4ed8', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:12 }}>Adjustment Details</div>

              {/* Row 1: Warehouse (text) + Add/Remove dropdown */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12 }}>
                <div>
                  <label style={lbl}>Warehouse <span style={{ color:'var(--text-muted)', fontWeight:400, textTransform:'none' }}>(optional)</span></label>
                  <input className="form-control" type="text"
                    placeholder="e.g. Main Warehouse"
                    value={warehouse} onChange={e => setWarehouse(e.target.value)}/>
                </div>
                <div>
                  <label style={lbl}>Adjustment Type <span style={{ color:'#dc2626' }}>*</span></label>
                  <select className="form-control" value={type} onChange={e => { setType(e.target.value); setReason('') }}>
                    <option value="in">Add Stock (+)</option>
                    <option value="out">Remove Stock (−)</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Reason (small field) */}
              <div style={{ marginTop:12, maxWidth:'50%' }}>
                <label style={lbl}>Reason <span style={{ color:'var(--text-muted)', fontWeight:400, textTransform:'none' }}>(optional)</span></label>
                <select className="form-control" value={reason} onChange={e => setReason(e.target.value)}>
                  <option value="">Select Reason</option>
                  {REASONS[type].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {/* Additional remarks */}
              <div style={{ marginTop:12 }}>
                <label style={lbl}>Additional Remarks</label>
                <textarea className="form-control" rows={2}
                  placeholder="Any additional notes about this adjustment…"
                  value={remarks} onChange={e => setRemarks(e.target.value)}/>
              </div>
            </div>

            {/* Products */}
            <div style={{ border:'1px solid var(--border)', borderRadius:12, padding:16, marginBottom:16 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <span style={{ fontSize:14, fontWeight:800 }}>Products</span>
                <button className="btn btn-primary btn-sm" onClick={() => { setPicker(true); setPQuery('') }} style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <Plus size={14}/> Add Products
                </button>
              </div>

              {lines.length === 0 ? (
                <div style={{ textAlign:'center', color:'var(--text-muted)', padding:'26px 0' }}>
                  <Package size={30} style={{ opacity:.2 }}/>
                  <div style={{ marginTop:8, fontSize:13 }}>No products added yet</div>
                  <button onClick={() => { setPicker(true); setPQuery('') }}
                    style={{ marginTop:6, background:'none', border:'none', color:'var(--primary)', cursor:'pointer', fontSize:12, fontWeight:700 }}>
                    Click “Add Products” to start
                  </button>
                </div>
              ) : (
                <div className="table-wrap" style={{ border:'1px solid var(--border)', borderRadius:8 }}>
                  <table>
                    <thead>
                      <tr>
                        <th style={th}>Product</th>
                        <th style={{ ...th, textAlign:'center' }}>Current</th>
                        <th style={{ ...th, textAlign:'center', width:120 }}>Qty to {type === 'in' ? 'Add' : 'Remove'}</th>
                        <th style={{ ...th, textAlign:'center', width:44 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map(l => (
                        <tr key={l.product_id}>
                          <td style={td}>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              {l.image
                                ? <img src={l.image} alt={l.name} style={{ width:32, height:32, borderRadius:6, objectFit:'cover', border:'1px solid var(--border)', flexShrink:0 }}/>
                                : <div style={{ width:32, height:32, borderRadius:6, background:'#eef2ff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><Package size={14} color="#4f46e5"/></div>}
                              <div style={{ minWidth:0 }}>
                                <div style={{ fontWeight:700, fontSize:12 }}>{l.name}</div>
                                <div style={{ fontFamily:'monospace', fontSize:10, color:'var(--text-muted)' }}>{l.code || '—'}{l.unit ? ` · ${l.unit}` : ''}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ ...td, textAlign:'center', fontWeight:700, color:'#1d4ed8', fontSize:13 }}>{fmtN(l.available)}</td>
                          <td style={{ ...td, textAlign:'center' }}>
                            <input className="form-control" type="number" min="0" step="any" style={{ width:100, textAlign:'center' }}
                              placeholder="0" value={l.qty}
                              onChange={e => updateLine(l.product_id, 'qty', e.target.value.replace(/[^\d.]/g, ''))}/>
                          </td>
                          <td style={{ ...td, textAlign:'center' }}>
                            <button title="Remove" onClick={() => removeLine(l.product_id)}
                              style={{ background:'#fef2f2', border:'1px solid #fecaca', color:'#dc2626', borderRadius:6, width:28, height:28, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
                              <Trash2 size={13}/>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {msg && (
              <div style={{
                display:'flex', alignItems:'center', gap:8, padding:'10px 14px', borderRadius:8, marginBottom:16,
                background: msg.type === 'ok' ? '#ecfdf5' : '#fef2f2',
                border: `1px solid ${msg.type === 'ok' ? '#a7f3d0' : '#fecaca'}`,
                color: msg.type === 'ok' ? '#059669' : '#dc2626', fontSize:13, fontWeight:600,
              }}>
                {msg.type === 'ok' ? <Check size={16}/> : <X size={16}/>} {msg.text}
              </div>
            )}

            <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
              <button className="btn btn-secondary" onClick={() => { if (!saving) onClose?.() }} disabled={saving}>Cancel</button>
              <button onClick={save} disabled={saving}
                style={{
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'10px 22px',
                  borderRadius:8, border:'none', color:'#fff', fontWeight:700, fontSize:14,
                  background: type === 'in' ? '#059669' : '#dc2626',
                  cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .6 : 1,
                }}>
                {saving
                  ? <><RefreshCw size={16} style={{ animation:'spin 1s linear infinite' }}/> Saving…</>
                  : type === 'in'
                    ? <><ArrowUpCircle size={16}/> Add Stock ({lines.length})</>
                    : <><ArrowDownCircle size={16}/> Remove Stock ({lines.length})</>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Product picker */}
      {picker && (
        <div className="modal-overlay" style={{ zIndex: 1200 }} onClick={() => setPicker(false)}>
          <div className="modal" style={{ maxWidth:560, width:'92%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Add Products</span>
              <button className="modal-close" onClick={() => setPicker(false)}><X size={18}/></button>
            </div>
            <div style={{ padding:16 }}>
              <div className="search-bar" style={{ marginBottom:12 }}>
                <Search size={14}/>
                <input autoFocus placeholder="Search product, code, brand, category…"
                  value={pQuery} onChange={e => setPQuery(e.target.value)}/>
              </div>
              <div style={{ maxHeight:'50vh', overflowY:'auto', border:'1px solid var(--border)', borderRadius:8 }}>
                {pickerRows.length === 0 && (
                  <div style={{ textAlign:'center', color:'var(--text-muted)', fontSize:13, padding:24 }}>No products found.</div>
                )}
                {pickerRows.map(p => {
                  const pid = String(p._id || p.id || '')
                  const img = imgUrl(p.image_urls || p.images)
                  return (
                    <div key={pid} onClick={() => addLine(p)}
                      style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderBottom:'1px solid var(--border)', cursor:'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                      {img
                        ? <img src={img} alt={p.name} style={{ width:38, height:38, borderRadius:6, objectFit:'cover', border:'1px solid var(--border)', flexShrink:0 }}/>
                        : <div style={{ width:38, height:38, borderRadius:6, background:'#eef2ff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><Package size={16} color="#4f46e5"/></div>}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, fontSize:13, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.name}</div>
                        <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                          <span style={{ fontFamily:'monospace' }}>{p.code || '—'}</span> · Available: <strong>{fmtN(invByProduct[pid] || 0)} {p.unit || ''}</strong>
                        </div>
                      </div>
                      <Plus size={16} color="var(--primary)"/>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
