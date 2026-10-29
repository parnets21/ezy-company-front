import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Search, X, Eye, CheckCircle, RefreshCw, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import { damageApi } from '../api/purchaseInventoryApi'

const PAGE_SIZE = 10
import usePermissions from '../hooks/usePermissions'
import { MODULES, ACTIONS } from '../config/permissions'

const STATUS_MAP = {
  Pending:  { bg: '#FEF3C7', color: '#D97706', border: '#FDE68A' },
  Approved: { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
  Rejected: { bg: '#F1F5F9', color: '#64748B', border: '#CBD5E1' },
}
const DAMAGE_REASONS = ['Handling damage','Transit damage','Water damage','Breakage','Manufacturing defect','Storage damage','Other']

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtN    = n => Number(n || 0).toLocaleString('en-IN')

const EMPTY_FORM = {
  damage_date: new Date().toISOString().slice(0, 10),
  warehouse_id: '',
  product_id: '',
  product_name: '',
  quantity: '',
  unit: 'Box',
  damage_reason: '',
  batch_no: '',
  lot_no: '',
  shade: '',
  caliber: '',
  reported_by: '',
  remarks: '',
}

function StatusPill({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP['Pending']
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{status || 'Pending'}</span>
}

export default function DamageBreakage({ products = [], warehouses = [], inventory = [] }) {
  const { canPerform } = usePermissions()
  const mayCreate  = canPerform(MODULES.DAMAGE_BREAKAGE, ACTIONS.CREATE)
  const mayApprove = canPerform(MODULES.DAMAGE_BREAKAGE, ACTIONS.APPROVE)

  const [records,      setRecords]      = useState([])
  const [loading,      setLoading]      = useState(false)
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page,         setPage]         = useState(1)
  const [showModal,    setShowModal]    = useState(false)
  const [viewItem,     setViewItem]     = useState(null)
  const [form,         setForm]         = useState(EMPTY_FORM)
  const [saving,       setSaving]       = useState(false)
  const [toast,        setToast]        = useState({ msg: '', type: 'success' })
  const [approveTarget,setApproveTarget]= useState(null)
  const [remarksText,  setRemarksText]  = useState('')

  const fire = (msg, type = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: 'success' }), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await damageApi.list({ limit: 200 })
      const d = res?.data || res
      setRecords(Array.isArray(d) ? d : (Array.isArray(d?.damages) ? d.damages : []))
    } catch { fire('Failed to load', 'error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return records.filter(r => {
      const matchS = statusFilter === 'all' || r.status === statusFilter
      const matchQ = !q || [r.damage_no, r.product_name, r.warehouse_name, r.damage_reason].some(v => (v || '').toLowerCase().includes(q))
      return matchS && matchQ
    })
  }, [records, search, statusFilter])

  // ── Pagination (10 rows per page) ──────────────────────────
  const total       = filtered.length
  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage    = Math.min(page, totalPages)
  const paged       = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const handleSave = async () => {
    if (!form.product_id) return fire('Select a product', 'error')
    if (!form.warehouse_id) return fire('Select a warehouse', 'error')
    if (!form.quantity || parseFloat(form.quantity) <= 0) return fire('Enter quantity', 'error')
    if (!form.damage_reason) return fire('Select damage reason', 'error')
    setSaving(true)
    try {
      await damageApi.create(form); fire('Damage record created'); setShowModal(false); load()
    } catch (e) { fire(e?.response?.data?.message || 'Save failed', 'error') }
    finally { setSaving(false) }
  }

  const handleApprove = async () => {
    try {
      await damageApi.approve(approveTarget._id, remarksText)
      fire('Damage approved — stock moved to damaged category')
      setApproveTarget(null); setRemarksText(''); load()
    } catch { fire('Approve failed', 'error') }
  }

  const kpi = useMemo(() => ({
    total:    records.length,
    pending:  records.filter(r => r.status === 'Pending').length,
    approved: records.filter(r => r.status === 'Approved').length,
    totalQty: records.filter(r => r.status === 'Approved').reduce((a, r) => a + (parseFloat(r.quantity) || 0), 0),
  }), [records])

  return (
    <div>
      {toast.msg && (
        <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 9999, background: toast.type === 'error' ? '#FEF2F2' : '#ECFDF5', border: `1px solid ${toast.type === 'error' ? '#FECACA' : '#A7F3D0'}`, color: toast.type === 'error' ? '#DC2626' : '#059669', padding: '10px 18px', borderRadius: 10, fontWeight: 600, fontSize: 13 }}>{toast.msg}</div>
      )}

      <div className="breadcrumb"><span>Inventory</span><span className="breadcrumb-sep">›</span><span className="breadcrumb-active">Damage / Breakage</span></div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={22} color="#F26522" /> Damage / Breakage</div>
          <div className="page-desc">Record damaged or broken tiles — approved records move stock from saleable to damaged</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={14} /> Refresh</button>
          {mayCreate && <button className="btn btn-primary" onClick={() => { setForm(EMPTY_FORM); setShowModal(true) }}><Plus size={15} /> Record Damage</button>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total Records', value: kpi.total, color: '#1E2D4A' },
          { label: 'Pending Approval', value: kpi.pending, color: '#D97706' },
          { label: 'Approved', value: kpi.approved, color: '#DC2626' },
          { label: 'Total Damaged', value: `${fmtN(kpi.totalQty)} units`, color: '#DC2626' },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{k.label}</div>
            <div style={{ fontSize: k.value.toString().length > 8 ? 18 : 24, fontWeight: 900, color: k.color, marginTop: 4 }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: '12px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input className="form-control" style={{ paddingLeft: 32 }} placeholder="Search damage no, product, warehouse…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
          </div>
          <select className="form-control" style={{ width: 160 }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
            <option value="all">All Statuses</option>
            {Object.keys(STATUS_MAP).map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#1E2D4A', color: '#fff' }}>
              {['Damage No','Date','Product','Warehouse','Qty','Unit','Reason','Batch','Status','Actions'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Qty' || h === 'Actions' ? 'right' : 'left', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Loading…</td></tr>
            : filtered.length === 0 ? <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>No damage records found</td></tr>
            : paged.map(r => (
              <tr key={r._id} style={{ borderBottom: '1px solid #F1F5F9' }} onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                <td style={{ padding: '10px 12px', fontWeight: 700, color: '#F26522' }}>{r.damage_no || '—'}</td>
                <td style={{ padding: '10px 12px' }}>{fmtDate(r.damage_date)}</td>
                <td style={{ padding: '10px 12px', fontWeight: 600 }}>{r.product_name || '—'}</td>
                <td style={{ padding: '10px 12px' }}>{r.warehouse_name || '—'}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#DC2626' }}>{fmtN(r.quantity)}</td>
                <td style={{ padding: '10px 12px' }}>{r.unit}</td>
                <td style={{ padding: '10px 12px' }}>{r.damage_reason || '—'}</td>
                <td style={{ padding: '10px 12px' }}>{r.batch_no || '—'}</td>
                <td style={{ padding: '10px 12px' }}><StatusPill status={r.status} /></td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost btn-xs" title="View" onClick={() => setViewItem(r)} style={{ color: '#2563EB' }}><Eye size={13} /></button>
                    {mayApprove && r.status === 'Pending' && (
                      <button className="btn btn-ghost btn-xs" title="Approve" onClick={() => { setApproveTarget(r); setRemarksText('') }} style={{ color: '#DC2626' }}><CheckCircle size={13} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

      {/* Create */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title"><AlertTriangle size={16} style={{ marginRight: 8 }} />Record Damage / Breakage</span><button className="modal-close" onClick={() => setShowModal(false)}><X size={16} /></button></div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label className="form-label">Date *</label>
                  <input type="date" className="form-control" value={form.damage_date} onChange={e => setForm(f => ({ ...f, damage_date: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Damage Reason *</label>
                  <select className="form-control" value={form.damage_reason} onChange={e => setForm(f => ({ ...f, damage_reason: e.target.value }))}>
                    <option value="">-- Select Reason --</option>
                    {DAMAGE_REASONS.map(r => <option key={r}>{r}</option>)}
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
                <div>
                  <label className="form-label">Batch No</label>
                  <input className="form-control" value={form.batch_no} onChange={e => setForm(f => ({ ...f, batch_no: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Lot No</label>
                  <input className="form-control" value={form.lot_no} onChange={e => setForm(f => ({ ...f, lot_no: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Reported By</label>
                  <input className="form-control" value={form.reported_by} onChange={e => setForm(f => ({ ...f, reported_by: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Remarks</label>
                  <input className="form-control" value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Approve */}
      {approveTarget && (
        <div className="modal-overlay" onClick={() => setApproveTarget(null)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Approve Damage Record</span><button className="modal-close" onClick={() => setApproveTarget(null)}><X size={16} /></button></div>
            <div className="modal-body">
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#991B1B' }}>
                Approving will move <b>{fmtN(approveTarget.quantity)} {approveTarget.unit}</b> of <b>{approveTarget.product_name}</b> from saleable stock to damaged stock.
              </div>
              <label className="form-label">Remarks</label>
              <textarea className="form-control" rows={2} value={remarksText} onChange={e => setRemarksText(e.target.value)} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setApproveTarget(null)}>Cancel</button>
              <button className="btn" style={{ background: '#DC2626', color: '#fff' }} onClick={handleApprove}><CheckCircle size={14} /> Approve</button>
            </div>
          </div>
        </div>
      )}

      {viewItem && (
        <div className="modal-overlay" onClick={() => setViewItem(null)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Damage Record — {viewItem.damage_no}</span><button className="modal-close" onClick={() => setViewItem(null)}><X size={16} /></button></div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[['Damage No', viewItem.damage_no], ['Date', fmtDate(viewItem.damage_date)], ['Product', viewItem.product_name || '—'], ['Warehouse', viewItem.warehouse_name || '—'],
                  ['Quantity', `${fmtN(viewItem.quantity)} ${viewItem.unit}`], ['Reason', viewItem.damage_reason || '—'],
                  ['Batch', viewItem.batch_no || '—'], ['Status', null],
                  ['Reported By', viewItem.reported_by || '—'], ['Remarks', viewItem.remarks || '—'],
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
