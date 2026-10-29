import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Search, X, Eye, Edit2, Trash2, RefreshCw, Layers } from 'lucide-react'
import { batchLotApi } from '../api/purchaseInventoryApi'
import usePermissions from '../hooks/usePermissions'
import { MODULES, ACTIONS } from '../config/permissions'

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtN    = n => Number(n || 0).toLocaleString('en-IN')

const EMPTY_FORM = {
  batch_no: '', lot_no: '', product_id: '', product_name: '', warehouse_id: '',
  quantity: '', unit: 'Box', date: new Date().toISOString().slice(0, 10),
  supplier_id: '', grn_ref: '', purchase_rate: '', expiry_date: '', remarks: '',
}

export default function BatchLotManagement({ products = [], warehouses = [], inventory = [] }) {
  const { canPerform } = usePermissions()
  const mayCreate = canPerform(MODULES.BATCH_LOT, ACTIONS.CREATE)
  const mayEdit   = canPerform(MODULES.BATCH_LOT, ACTIONS.EDIT)
  const mayDelete = canPerform(MODULES.BATCH_LOT, ACTIONS.DELETE)

  const [batches,     setBatches]     = useState([])
  const [loading,     setLoading]     = useState(false)
  const [search,      setSearch]      = useState('')
  const [showModal,   setShowModal]   = useState(false)
  const [editItem,    setEditItem]    = useState(null)
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
      const res = await batchLotApi.list({ limit: 300 })
      const d = res?.data || res
      setBatches(Array.isArray(d) ? d : (Array.isArray(d?.batches) ? d.batches : []))
    } catch { fire('Failed to load', 'error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return batches
    return batches.filter(b => [b.batch_no, b.lot_no, b.product_name, b.warehouse_name].some(v => (v || '').toLowerCase().includes(q)))
  }, [batches, search])

  const openEdit = b => {
    setEditItem(b)
    setForm({ batch_no: b.batch_no || '', lot_no: b.lot_no || '', product_id: b.product_id?._id || b.product_id || '', product_name: b.product_name || '', warehouse_id: b.warehouse_id?._id || b.warehouse_id || '', quantity: b.quantity || '', unit: b.unit || 'Box', date: b.date?.slice(0,10) || EMPTY_FORM.date, supplier_id: b.supplier_id || '', grn_ref: b.grn_ref || '', purchase_rate: b.purchase_rate || '', expiry_date: b.expiry_date?.slice(0,10) || '', remarks: b.remarks || '' })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.batch_no) return fire('Batch number required', 'error')
    if (!form.product_id) return fire('Select a product', 'error')
    setSaving(true)
    try {
      if (editItem) { await batchLotApi.update(editItem._id, form); fire('Updated') }
      else          { await batchLotApi.create(form); fire('Batch/Lot created') }
      setShowModal(false); load()
    } catch (e) { fire(e?.response?.data?.message || 'Save failed', 'error') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    try { await batchLotApi.delete(deleteTarget._id); fire('Deleted'); setDeleteTarget(null); load() }
    catch { fire('Delete failed', 'error') }
  }

  return (
    <div>
      {toast.msg && (
        <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 9999, background: toast.type === 'error' ? '#FEF2F2' : '#ECFDF5', border: `1px solid ${toast.type === 'error' ? '#FECACA' : '#A7F3D0'}`, color: toast.type === 'error' ? '#DC2626' : '#059669', padding: '10px 18px', borderRadius: 10, fontWeight: 600, fontSize: 13 }}>{toast.msg}</div>
      )}

      <div className="breadcrumb"><span>Inventory</span><span className="breadcrumb-sep">›</span><span className="breadcrumb-active">Batch / Lot</span></div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Layers size={22} color="#F26522" /> Batch / Lot Management</div>
          <div className="page-desc">Track stock by batch and lot numbers for full traceability</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={14} /> Refresh</button>
          {mayCreate && <button className="btn btn-primary" onClick={() => { setEditItem(null); setForm(EMPTY_FORM); setShowModal(true) }}><Plus size={15} /> Add Batch/Lot</button>}
        </div>
      </div>

      <div className="card" style={{ padding: '12px 18px', marginBottom: 16 }}>
        <div style={{ position: 'relative', maxWidth: 360 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input className="form-control" style={{ paddingLeft: 32 }} placeholder="Search batch no, lot no, product…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#1E2D4A', color: '#fff' }}>
              {['Batch No','Lot No','Product','Warehouse','Date','Qty','Unit','GRN Ref','Expiry','Actions'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Qty' || h === 'Actions' ? 'right' : 'left', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Loading…</td></tr>
            : filtered.length === 0 ? <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>
              <Layers size={32} style={{ opacity: 0.3, marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />No batches found
            </td></tr>
            : filtered.map(b => (
              <tr key={b._id} style={{ borderBottom: '1px solid #F1F5F9' }} onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                <td style={{ padding: '10px 12px', fontWeight: 700, color: '#F26522' }}>{b.batch_no || '—'}</td>
                <td style={{ padding: '10px 12px', fontWeight: 600 }}>{b.lot_no || '—'}</td>
                <td style={{ padding: '10px 12px' }}>{b.product_name || '—'}</td>
                <td style={{ padding: '10px 12px' }}>{b.warehouse_name || '—'}</td>
                <td style={{ padding: '10px 12px' }}>{fmtDate(b.date)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmtN(b.quantity)}</td>
                <td style={{ padding: '10px 12px' }}>{b.unit}</td>
                <td style={{ padding: '10px 12px', color: '#2563EB' }}>{b.grn_ref || '—'}</td>
                <td style={{ padding: '10px 12px', color: b.expiry_date && new Date(b.expiry_date) < new Date() ? '#DC2626' : '' }}>{fmtDate(b.expiry_date)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost btn-xs" onClick={() => setViewItem(b)} style={{ color: '#2563EB' }}><Eye size={13} /></button>
                    {mayEdit   && <button className="btn btn-ghost btn-xs" onClick={() => openEdit(b)} style={{ color: '#059669' }}><Edit2 size={13} /></button>}
                    {mayDelete && <button className="btn btn-ghost btn-xs" onClick={() => setDeleteTarget(b)} style={{ color: '#DC2626' }}><Trash2 size={13} /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">{editItem ? 'Edit Batch/Lot' : 'Add Batch/Lot'}</span><button className="modal-close" onClick={() => setShowModal(false)}><X size={16} /></button></div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div><label className="form-label">Batch No *</label><input className="form-control" value={form.batch_no} onChange={e => setForm(f => ({ ...f, batch_no: e.target.value }))} placeholder="e.g. BATCH-001" /></div>
                <div><label className="form-label">Lot No</label><input className="form-control" value={form.lot_no} onChange={e => setForm(f => ({ ...f, lot_no: e.target.value }))} placeholder="e.g. LOT-2026-001" /></div>
                <div><label className="form-label">Product *</label>
                  <select className="form-control" value={form.product_id} onChange={e => { const p = products.find(x => (x._id || x.id) === e.target.value); setForm(f => ({ ...f, product_id: e.target.value, product_name: p?.name || '' })) }}>
                    <option value="">-- Select Product --</option>
                    {products.map(p => <option key={p._id || p.id} value={p._id || p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div><label className="form-label">Warehouse</label>
                  <select className="form-control" value={form.warehouse_id} onChange={e => setForm(f => ({ ...f, warehouse_id: e.target.value }))}>
                    <option value="">-- Select --</option>
                    {warehouses.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
                  </select>
                </div>
                <div><label className="form-label">Date</label><input type="date" className="form-control" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
                <div><label className="form-label">Expiry Date</label><input type="date" className="form-control" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} /></div>
                <div><label className="form-label">Quantity</label><input type="number" min="0" className="form-control" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} /></div>
                <div><label className="form-label">Unit</label>
                  <select className="form-control" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                    {['Box','Piece','Sq.Ft','Sq.M','Nos'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div><label className="form-label">GRN Reference</label><input className="form-control" value={form.grn_ref} onChange={e => setForm(f => ({ ...f, grn_ref: e.target.value }))} /></div>
                <div><label className="form-label">Purchase Rate ₹</label><input type="number" min="0" className="form-control" value={form.purchase_rate} onChange={e => setForm(f => ({ ...f, purchase_rate: e.target.value }))} /></div>
                <div style={{ gridColumn: '1/-1' }}><label className="form-label">Remarks</label><input className="form-control" value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} /></div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : editItem ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {viewItem && (
        <div className="modal-overlay" onClick={() => setViewItem(null)}>
          <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Batch — {viewItem.batch_no}</span><button className="modal-close" onClick={() => setViewItem(null)}><X size={16} /></button></div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[['Batch No', viewItem.batch_no], ['Lot No', viewItem.lot_no || '—'], ['Product', viewItem.product_name || '—'], ['Warehouse', viewItem.warehouse_name || '—'],
                  ['Date', fmtDate(viewItem.date)], ['Expiry', fmtDate(viewItem.expiry_date)], ['Qty', `${fmtN(viewItem.quantity)} ${viewItem.unit}`], ['GRN Ref', viewItem.grn_ref || '—'],
                  ['Purchase Rate', viewItem.purchase_rate ? `₹${fmtN(viewItem.purchase_rate)}` : '—'], ['Remarks', viewItem.remarks || '—'],
                ].map(([l, v], i) => (
                  <div key={i} style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700 }}>{l}</div>
                    <div style={{ fontWeight: 700, color: '#1E2D4A', marginTop: 2 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setViewItem(null)}>Close</button></div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Delete Batch</span><button className="modal-close" onClick={() => setDeleteTarget(null)}><X size={16} /></button></div>
            <div className="modal-body"><p>Delete batch <b>{deleteTarget.batch_no}</b>?</p></div>
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
