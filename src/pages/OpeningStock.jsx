import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Search, X, Eye, Trash2, RefreshCw, Archive, AlertCircle } from 'lucide-react'
import { openingStockApi } from '../api/purchaseInventoryApi'
import usePermissions from '../hooks/usePermissions'
import { MODULES, ACTIONS } from '../config/permissions'

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtN    = n => Number(n || 0).toLocaleString('en-IN')
const fmtC    = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const EMPTY_FORM = {
  date: new Date().toISOString().slice(0, 10),
  warehouse_id: '',
  remarks: '',
  items: [{ product_id: '', product_name: '', quantity: '', unit: 'Box', cost: '', batch_no: '', lot_no: '', shade: '', caliber: '', grade: '' }],
}

export default function OpeningStock({ products = [], warehouses = [] }) {
  const { canPerform } = usePermissions()
  const mayCreate = canPerform(MODULES.OPENING_STOCK, ACTIONS.CREATE)
  const mayDelete = canPerform(MODULES.OPENING_STOCK, ACTIONS.DELETE)

  const [entries,     setEntries]     = useState([])
  const [loading,     setLoading]     = useState(false)
  const [search,      setSearch]      = useState('')
  const [showModal,   setShowModal]   = useState(false)
  const [viewItem,    setViewItem]    = useState(null)
  const [form,        setForm]        = useState(EMPTY_FORM)
  const [saving,      setSaving]      = useState(false)
  const [toast,       setToast]       = useState({ msg: '', type: 'success' })
  const [deleteTarget,setDeleteTarget]= useState(null)

  const fire = (msg, type = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: 'success' }), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await openingStockApi.list({ limit: 200 })
      const d = res?.data || res
      setEntries(Array.isArray(d) ? d : (Array.isArray(d?.opening_stocks) ? d.opening_stocks : []))
    } catch { fire('Failed to load', 'error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return entries
    return entries.filter(e => [e.entry_no, e.warehouse_name].some(v => (v || '').toLowerCase().includes(q)))
  }, [entries, search])

  const setLine = (idx, field, val) =>
    setForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, [field]: val } : it) }))
  const addLine  = () => setForm(f => ({ ...f, items: [...f.items, { product_id: '', product_name: '', quantity: '', unit: 'Box', cost: '', batch_no: '', lot_no: '', shade: '', caliber: '', grade: '' }] }))
  const delLine  = idx => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))

  const totalValue = useMemo(() => form.items.reduce((a, i) => a + (parseFloat(i.quantity) || 0) * (parseFloat(i.cost) || 0), 0), [form.items])

  const handleSave = async () => {
    if (!form.warehouse_id) return fire('Select a warehouse', 'error')
    if (!form.items.some(i => i.product_id)) return fire('Add at least one product', 'error')
    setSaving(true)
    try {
      await openingStockApi.create(form)
      fire('Opening stock entry created — inventory updated')
      setShowModal(false); load()
    } catch (e) { fire(e?.response?.data?.message || 'Save failed', 'error') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    try { await openingStockApi.delete(deleteTarget._id); fire('Entry deleted'); setDeleteTarget(null); load() }
    catch { fire('Delete failed', 'error') }
  }

  return (
    <div>
      {toast.msg && (
        <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 9999, background: toast.type === 'error' ? '#FEF2F2' : '#ECFDF5', border: `1px solid ${toast.type === 'error' ? '#FECACA' : '#A7F3D0'}`, color: toast.type === 'error' ? '#DC2626' : '#059669', padding: '10px 18px', borderRadius: 10, fontWeight: 600, fontSize: 13 }}>{toast.msg}</div>
      )}

      <div className="breadcrumb"><span>Inventory</span><span className="breadcrumb-sep">›</span><span className="breadcrumb-active">Opening Stock</span></div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Archive size={22} color="#F26522" /> Opening Stock</div>
          <div className="page-desc">Enter initial stock when starting the ERP — creates inventory transactions</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={14} /> Refresh</button>
          {mayCreate && <button className="btn btn-primary" onClick={() => { setForm(EMPTY_FORM); setShowModal(true) }}><Plus size={15} /> Add Opening Stock</button>}
        </div>
      </div>

      <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, display: 'flex', gap: 10 }}>
        <AlertCircle size={16} color="#2563EB" style={{ flexShrink: 0 }} />
        <span style={{ color: '#1E40AF' }}>Opening stock creates an inventory transaction and updates available stock. Use this only for initial setup — do not enter ongoing purchases here.</span>
      </div>

      <div className="card" style={{ padding: '12px 18px', marginBottom: 16 }}>
        <div style={{ position: 'relative', maxWidth: 360 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input className="form-control" style={{ paddingLeft: 32 }} placeholder="Search entry no, warehouse…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#1E2D4A', color: '#fff' }}>
              {['Entry No','Date','Warehouse','Items','Total Qty','Total Value','Remarks','Actions'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: ['Total Qty','Total Value','Actions'].includes(h) ? 'right' : 'left', fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Loading…</td></tr>
            : filtered.length === 0 ? <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>
              <Archive size={32} style={{ opacity: 0.3, marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />No opening stock entries
            </td></tr>
            : filtered.map(e => {
              const totalQty = (e.items || []).reduce((a, i) => a + (parseFloat(i.quantity) || 0), 0)
              const totalVal = (e.items || []).reduce((a, i) => a + (parseFloat(i.quantity) || 0) * (parseFloat(i.cost) || 0), 0)
              return (
                <tr key={e._id} style={{ borderBottom: '1px solid #F1F5F9' }} onMouseEnter={ev => ev.currentTarget.style.background = '#FAFAFA'} onMouseLeave={ev => ev.currentTarget.style.background = ''}>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: '#F26522' }}>{e.entry_no || '—'}</td>
                  <td style={{ padding: '10px 14px' }}>{fmtDate(e.date)}</td>
                  <td style={{ padding: '10px 14px' }}>{e.warehouse_name || '—'}</td>
                  <td style={{ padding: '10px 14px' }}>{(e.items || []).length}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtN(totalQty)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmtC(totalVal)}</td>
                  <td style={{ padding: '10px 14px', color: '#64748B' }}>{e.remarks || '—'}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-xs" title="View" onClick={() => setViewItem(e)} style={{ color: '#2563EB' }}><Eye size={13} /></button>
                      {mayDelete && <button className="btn btn-ghost btn-xs" title="Delete" onClick={() => setDeleteTarget(e)} style={{ color: '#DC2626' }}><Trash2 size={13} /></button>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 1000, width: '100%', maxHeight: '93vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10 }}>
              <span className="modal-title"><Archive size={16} style={{ marginRight: 8 }} />Add Opening Stock</span>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label className="form-label">Date *</label>
                  <input type="date" className="form-control" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Warehouse *</label>
                  <select className="form-control" value={form.warehouse_id} onChange={e => setForm(f => ({ ...f, warehouse_id: e.target.value }))}>
                    <option value="">-- Select Warehouse --</option>
                    {warehouses.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Remarks</label>
                  <input className="form-control" value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} />
                </div>
              </div>

              <div style={{ fontWeight: 700, fontSize: 13, color: '#1E2D4A', marginBottom: 8 }}>Stock Items *</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 850 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {['Product','Qty','Unit','Cost/Unit','Value','Batch','Lot','Shade','Grade',''].map(h => (
                        <th key={h} style={{ padding: '7px 8px', textAlign: 'left', fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((line, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '5px 6px' }}>
                          <select className="form-control" value={line.product_id} onChange={e => {
                            const p = products.find(x => (x._id || x.id) === e.target.value)
                            setLine(idx, 'product_id', e.target.value)
                            if (p) setLine(idx, 'product_name', p.name)
                          }}>
                            <option value="">-- Product --</option>
                            {products.map(p => <option key={p._id || p.id} value={p._id || p.id}>{p.name}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '5px 6px' }}><input type="number" min="0" className="form-control" value={line.quantity} onChange={e => setLine(idx, 'quantity', e.target.value)} style={{ width: 80 }} /></td>
                        <td style={{ padding: '5px 6px' }}>
                          <select className="form-control" value={line.unit} onChange={e => setLine(idx, 'unit', e.target.value)} style={{ width: 80 }}>
                            {['Box','Piece','Sq.Ft','Sq.M','Pallet','Nos'].map(u => <option key={u}>{u}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '5px 6px' }}><input type="number" min="0" className="form-control" value={line.cost} onChange={e => setLine(idx, 'cost', e.target.value)} style={{ width: 90 }} /></td>
                        <td style={{ padding: '5px 6px', fontFamily: 'monospace', fontWeight: 700, color: '#059669' }}>{fmtC((parseFloat(line.quantity) || 0) * (parseFloat(line.cost) || 0))}</td>
                        <td style={{ padding: '5px 6px' }}><input className="form-control" value={line.batch_no} onChange={e => setLine(idx, 'batch_no', e.target.value)} style={{ width: 80 }} /></td>
                        <td style={{ padding: '5px 6px' }}><input className="form-control" value={line.lot_no} onChange={e => setLine(idx, 'lot_no', e.target.value)} style={{ width: 80 }} /></td>
                        <td style={{ padding: '5px 6px' }}><input className="form-control" value={line.shade} onChange={e => setLine(idx, 'shade', e.target.value)} style={{ width: 70 }} /></td>
                        <td style={{ padding: '5px 6px' }}>
                          <select className="form-control" value={line.grade} onChange={e => setLine(idx, 'grade', e.target.value)} style={{ width: 100 }}>
                            <option value="">Grade</option>
                            {['Grade A','Grade B','First Quality','Second Quality'].map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '5px 6px' }}><button type="button" onClick={() => delLine(idx)} style={{ border: 'none', background: 'none', color: '#DC2626', cursor: 'pointer' }}><X size={14} /></button></td>
                      </tr>
                    ))}
                    <tr style={{ background: '#F0FDF4' }}>
                      <td colSpan={3} style={{ padding: '8px 10px', fontWeight: 800, textAlign: 'right' }}>Total Value</td>
                      <td colSpan={2} style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 800, fontSize: 15, color: '#059669' }}>{fmtC(totalValue)}</td>
                      <td colSpan={5}></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 10 }} onClick={addLine}><Plus size={13} /> Add Row</button>
            </div>
            <div className="modal-footer" style={{ position: 'sticky', bottom: 0, background: 'var(--surface)', zIndex: 10 }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Opening Stock'}</button>
            </div>
          </div>
        </div>
      )}

      {/* View */}
      {viewItem && (
        <div className="modal-overlay" onClick={() => setViewItem(null)}>
          <div className="modal" style={{ maxWidth: 800, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Opening Stock — {viewItem.entry_no}</span><button className="modal-close" onClick={() => setViewItem(null)}><X size={16} /></button></div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                {[['Entry No', viewItem.entry_no], ['Date', fmtDate(viewItem.date)], ['Warehouse', viewItem.warehouse_name || '—']].map(([l, v], i) => (
                  <div key={i} style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700 }}>{l}</div>
                    <div style={{ fontWeight: 700, color: '#1E2D4A', marginTop: 2 }}>{v}</div>
                  </div>
                ))}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: '#F1F5F9' }}>
                  {['#','Product','Qty','Unit','Cost','Value','Batch','Grade'].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: ['Qty','Cost','Value'].includes(h) ? 'right' : 'left', fontWeight: 700 }}>{h}</th>)}
                </tr></thead>
                <tbody>{(viewItem.items || []).map((it, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '8px 10px' }}>{i + 1}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{it.product_name || '—'}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtN(it.quantity)}</td>
                    <td style={{ padding: '8px 10px' }}>{it.unit}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtC(it.cost)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#059669' }}>{fmtC((parseFloat(it.quantity) || 0) * (parseFloat(it.cost) || 0))}</td>
                    <td style={{ padding: '8px 10px' }}>{it.batch_no || '—'}</td>
                    <td style={{ padding: '8px 10px' }}>{it.grade || '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setViewItem(null)}>Close</button></div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Delete Entry</span><button className="modal-close" onClick={() => setDeleteTarget(null)}><X size={16} /></button></div>
            <div className="modal-body"><p>Delete entry <b>{deleteTarget.entry_no}</b>? This will reverse the stock transaction.</p></div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn" style={{ background: '#DC2626', color: '#fff' }} onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
