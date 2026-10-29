import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Search, X, Eye, CheckCircle, XCircle, RefreshCw, Sliders } from 'lucide-react'
import { stockAdjustmentApi } from '../api/purchaseInventoryApi'
import usePermissions from '../hooks/usePermissions'
import { MODULES, ACTIONS } from '../config/permissions'

const STATUS_MAP = {
  Pending:  { bg: '#FEF3C7', color: '#D97706', border: '#FDE68A' },
  Approved: { bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' },
  Rejected: { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
}
const ADJ_REASONS = ['Physical count difference', 'System error correction', 'Damage write-off', 'Expiry write-off', 'Initial setup', 'Other']

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtN    = n => Number(n || 0).toLocaleString('en-IN')

function StatusPill({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP['Pending']
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{status || 'Pending'}</span>
}

const EMPTY_FORM = {
  adjustment_date: new Date().toISOString().slice(0, 10),
  warehouse_id: '',
  product_id: '',
  product_name: '',
  adjustment_type: 'Decrease',
  quantity: '',
  unit: 'Box',
  reason: '',
  batch_no: '',
  lot_no: '',
  remarks: '',
}

export default function StockAdjustmentPage({ products = [], warehouses = [], inventory = [] }) {
  const { canPerform } = usePermissions()
  const mayCreate  = canPerform(MODULES.STOCK_ADJUSTMENT, ACTIONS.CREATE)
  const mayApprove = canPerform(MODULES.STOCK_ADJUSTMENT, ACTIONS.APPROVE)

  const [records,      setRecords]      = useState([])
  const [loading,      setLoading]      = useState(false)
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showModal,    setShowModal]    = useState(false)
  const [viewItem,     setViewItem]     = useState(null)
  const [form,         setForm]         = useState(EMPTY_FORM)
  const [saving,       setSaving]       = useState(false)
  const [toast,        setToast]        = useState({ msg: '', type: 'success' })
  const [approveTarget,setApproveTarget]= useState(null)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [remarksText,  setRemarksText]  = useState('')

  const fire = (msg, type = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: 'success' }), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await stockAdjustmentApi.list({ limit: 200 })
      const d = res?.data || res
      setRecords(Array.isArray(d) ? d : (Array.isArray(d?.adjustments) ? d.adjustments : []))
    } catch { fire('Failed to load', 'error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return records.filter(r => {
      const matchS = statusFilter === 'all' || r.status === statusFilter
      const matchQ = !q || [r.adjustment_no, r.product_name, r.warehouse_name].some(v => (v || '').toLowerCase().includes(q))
      return matchS && matchQ
    })
  }, [records, search, statusFilter])

  // Current stock for selected product/warehouse
  const currentStock = useMemo(() => {
    if (!form.product_id || !form.warehouse_id) return null
    const row = inventory.find(i => {
      const pid = i.product_id?._id || i.product_id
      const wid = i.warehouse_id?._id || i.warehouse_id
      return String(pid) === String(form.product_id) && String(wid) === String(form.warehouse_id)
    })
    return row ? (parseFloat(row.available_stock) || parseFloat(row.current_stock) || 0) : null
  }, [form.product_id, form.warehouse_id, inventory])

  const handleSave = async () => {
    if (!form.product_id) return fire('Select a product', 'error')
    if (!form.warehouse_id) return fire('Select a warehouse', 'error')
    if (!form.quantity || parseFloat(form.quantity) <= 0) return fire('Enter quantity', 'error')
    if (!form.reason) return fire('Select a reason', 'error')
    setSaving(true)
    try {
      await stockAdjustmentApi.create(form); fire('Adjustment created'); setShowModal(false); load()
    } catch (e) { fire(e?.response?.data?.message || 'Save failed', 'error') }
    finally { setSaving(false) }
  }

  const handleApprove = async () => {
    try {
      await stockAdjustmentApi.approve(approveTarget._id, remarksText)
      fire('Adjustment approved — inventory updated'); setApproveTarget(null); setRemarksText(''); load()
    } catch { fire('Approve failed', 'error') }
  }

  const handleReject = async () => {
    if (!remarksText.trim()) return fire('Rejection reason required', 'error')
    try {
      await stockAdjustmentApi.reject(rejectTarget._id, remarksText)
      fire('Adjustment rejected'); setRejectTarget(null); setRemarksText(''); load()
    } catch { fire('Reject failed', 'error') }
  }

  return (
    <div>
      {toast.msg && (
        <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 9999, background: toast.type === 'error' ? '#FEF2F2' : '#ECFDF5', border: `1px solid ${toast.type === 'error' ? '#FECACA' : '#A7F3D0'}`, color: toast.type === 'error' ? '#DC2626' : '#059669', padding: '10px 18px', borderRadius: 10, fontWeight: 600, fontSize: 13 }}>{toast.msg}</div>
      )}

      <div className="breadcrumb"><span>Inventory</span><span className="breadcrumb-sep">›</span><span className="breadcrumb-active">Stock Adjustment</span></div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Sliders size={22} color="#F26522" /> Stock Adjustment</div>
          <div className="page-desc">Correct stock discrepancies — approved adjustments update inventory with a full audit trail</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={14} /> Refresh</button>
          {mayCreate && <button className="btn btn-primary" onClick={() => { setForm(EMPTY_FORM); setShowModal(true) }}><Plus size={15} /> New Adjustment</button>}
        </div>
      </div>

      <div className="card" style={{ padding: '12px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input className="form-control" style={{ paddingLeft: 32 }} placeholder="Search adjustment no, product, warehouse…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-control" style={{ width: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            {Object.keys(STATUS_MAP).map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#1E2D4A', color: '#fff' }}>
              {['Adj No','Date','Product','Warehouse','Type','Qty','Unit','Reason','Status','Actions'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Qty' || h === 'Actions' ? 'right' : 'left', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Loading…</td></tr>
            : filtered.length === 0 ? <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>No adjustments found</td></tr>
            : filtered.map(r => (
              <tr key={r._id} style={{ borderBottom: '1px solid #F1F5F9' }} onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                <td style={{ padding: '10px 12px', fontWeight: 700, color: '#F26522' }}>{r.adjustment_no || '—'}</td>
                <td style={{ padding: '10px 12px' }}>{fmtDate(r.adjustment_date)}</td>
                <td style={{ padding: '10px 12px', fontWeight: 600 }}>{r.product_name || '—'}</td>
                <td style={{ padding: '10px 12px' }}>{r.warehouse_name || '—'}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: r.adjustment_type === 'Increase' ? '#ECFDF5' : '#FEF2F2', color: r.adjustment_type === 'Increase' ? '#059669' : '#DC2626' }}>{r.adjustment_type}</span>
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: r.adjustment_type === 'Increase' ? '#059669' : '#DC2626' }}>
                  {r.adjustment_type === 'Increase' ? '+' : '-'}{fmtN(r.quantity)}
                </td>
                <td style={{ padding: '10px 12px' }}>{r.unit}</td>
                <td style={{ padding: '10px 12px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason || '—'}</td>
                <td style={{ padding: '10px 12px' }}><StatusPill status={r.status} /></td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost btn-xs" title="View" onClick={() => setViewItem(r)} style={{ color: '#2563EB' }}><Eye size={13} /></button>
                    {mayApprove && r.status === 'Pending' && (
                      <>
                        <button className="btn btn-ghost btn-xs" title="Approve" onClick={() => { setApproveTarget(r); setRemarksText('') }} style={{ color: '#059669' }}><CheckCircle size={13} /></button>
                        <button className="btn btn-ghost btn-xs" title="Reject"  onClick={() => { setRejectTarget(r); setRemarksText('') }} style={{ color: '#DC2626' }}><XCircle size={13} /></button>
                      </>
                    )}
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
            <div className="modal-header"><span className="modal-title">New Stock Adjustment</span><button className="modal-close" onClick={() => setShowModal(false)}><X size={16} /></button></div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label className="form-label">Date *</label>
                  <input type="date" className="form-control" value={form.adjustment_date} onChange={e => setForm(f => ({ ...f, adjustment_date: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Adjustment Type *</label>
                  <select className="form-control" value={form.adjustment_type} onChange={e => setForm(f => ({ ...f, adjustment_type: e.target.value }))}>
                    <option>Increase</option><option>Decrease</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Product *</label>
                  <select className="form-control" value={form.product_id} onChange={e => {
                    const p = products.find(x => (x._id || x.id) === e.target.value)
                    setForm(f => ({ ...f, product_id: e.target.value, product_name: p?.name || '' }))
                  }}>
                    <option value="">-- Select Product --</option>
                    {products.map(p => <option key={p._id || p.id} value={p._id || p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Warehouse *</label>
                  <select className="form-control" value={form.warehouse_id} onChange={e => setForm(f => ({ ...f, warehouse_id: e.target.value }))}>
                    <option value="">-- Select Warehouse --</option>
                    {warehouses.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
                  </select>
                </div>
                {currentStock !== null && (
                  <div style={{ gridColumn: '1/-1', background: '#EFF6FF', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: '#1E40AF' }}>
                    Current Stock: <b>{fmtN(currentStock)} units</b>
                    {form.quantity && form.adjustment_type === 'Decrease' && (
                      <span style={{ marginLeft: 12 }}>→ After: <b style={{ color: parseFloat(currentStock) - parseFloat(form.quantity) < 0 ? '#DC2626' : '#059669' }}>{fmtN(parseFloat(currentStock) - (parseFloat(form.quantity) || 0))}</b></span>
                    )}
                    {form.quantity && form.adjustment_type === 'Increase' && (
                      <span style={{ marginLeft: 12 }}>→ After: <b style={{ color: '#059669' }}>{fmtN(parseFloat(currentStock) + (parseFloat(form.quantity) || 0))}</b></span>
                    )}
                  </div>
                )}
                <div>
                  <label className="form-label">Quantity *</label>
                  <input type="number" min="0" className="form-control" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Unit</label>
                  <select className="form-control" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                    {['Box','Piece','Sq.Ft','Sq.M','Nos'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Reason *</label>
                  <select className="form-control" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}>
                    <option value="">-- Select Reason --</option>
                    {ADJ_REASONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Batch No</label>
                  <input className="form-control" value={form.batch_no} onChange={e => setForm(f => ({ ...f, batch_no: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Lot No</label>
                  <input className="form-control" value={form.lot_no} onChange={e => setForm(f => ({ ...f, lot_no: e.target.value }))} />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Remarks</label>
                  <textarea className="form-control" rows={2} value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Create Adjustment'}</button>
            </div>
          </div>
        </div>
      )}

      {approveTarget && (
        <div className="modal-overlay" onClick={() => setApproveTarget(null)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Approve Adjustment</span><button className="modal-close" onClick={() => setApproveTarget(null)}><X size={16} /></button></div>
            <div className="modal-body">
              <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>
                This will <b>{approveTarget.adjustment_type.toLowerCase()}</b> inventory by <b>{fmtN(approveTarget.quantity)} {approveTarget.unit}</b>.
              </div>
              <label className="form-label">Remarks</label>
              <textarea className="form-control" rows={2} value={remarksText} onChange={e => setRemarksText(e.target.value)} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setApproveTarget(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleApprove}><CheckCircle size={14} /> Approve</button>
            </div>
          </div>
        </div>
      )}

      {rejectTarget && (
        <div className="modal-overlay" onClick={() => setRejectTarget(null)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Reject Adjustment</span><button className="modal-close" onClick={() => setRejectTarget(null)}><X size={16} /></button></div>
            <div className="modal-body">
              <label className="form-label">Reason *</label>
              <textarea className="form-control" rows={2} value={remarksText} onChange={e => setRemarksText(e.target.value)} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setRejectTarget(null)}>Cancel</button>
              <button className="btn" style={{ background: '#DC2626', color: '#fff' }} onClick={handleReject}><XCircle size={14} /> Reject</button>
            </div>
          </div>
        </div>
      )}

      {viewItem && (
        <div className="modal-overlay" onClick={() => setViewItem(null)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Adjustment — {viewItem.adjustment_no}</span><button className="modal-close" onClick={() => setViewItem(null)}><X size={16} /></button></div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[['Adj No', viewItem.adjustment_no], ['Date', fmtDate(viewItem.adjustment_date)],
                  ['Product', viewItem.product_name || '—'], ['Warehouse', viewItem.warehouse_name || '—'],
                  ['Type', viewItem.adjustment_type], ['Quantity', `${fmtN(viewItem.quantity)} ${viewItem.unit}`],
                  ['Reason', viewItem.reason || '—'], ['Status', null],
                  ['Batch', viewItem.batch_no || '—'], ['Remarks', viewItem.remarks || '—'],
                ].map(([l, v], i) => (
                  <div key={i} style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700 }}>{l}</div>
                    <div style={{ fontWeight: 700, color: '#1E2D4A', marginTop: 2 }}>{v === null ? <StatusPill status={viewItem.status} /> : v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setViewItem(null)}>Close</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
