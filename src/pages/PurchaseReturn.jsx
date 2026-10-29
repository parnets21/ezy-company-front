import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Plus, Search, X, Eye, CheckCircle, RefreshCw,
  Send, AlertCircle, RotateCcw,
} from 'lucide-react'
import { purchaseReturnApi, grnApi, purchaseOrderApi } from '../api/purchaseInventoryApi'
import usePermissions from '../hooks/usePermissions'
import { MODULES, ACTIONS } from '../config/permissions'

const STATUS_MAP = {
  Draft:     { bg: '#F1F5F9', color: '#64748B', border: '#CBD5E1' },
  Pending:   { bg: '#FEF3C7', color: '#D97706', border: '#FDE68A' },
  Approved:  { bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' },
  Completed: { bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' },
  Cancelled: { bg: '#F9FAFB', color: '#9CA3AF', border: '#E5E7EB' },
}

const RETURN_REASONS = [
  'Damaged goods', 'Wrong product delivered', 'Quality not as per PO',
  'Excess quantity', 'Expired goods', 'Short shipment compensation',
  'Other',
]

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtN    = n => Number(n || 0).toLocaleString('en-IN')
const fmtC    = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function StatusPill({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP['Draft']
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{status || 'Draft'}</span>
}

const EMPTY_FORM = {
  return_date: new Date().toISOString().slice(0, 10),
  po_id: '',
  grn_id: '',
  supplier_id: '',
  warehouse_id: '',
  reason: '',
  remarks: '',
  items: [],
}

export default function PurchaseReturn({ products = [], suppliers = [], warehouses = [] }) {
  const { canPerform } = usePermissions()
  const mayCreate  = canPerform(MODULES.PURCHASE_RETURN, ACTIONS.CREATE)
  const mayApprove = canPerform(MODULES.PURCHASE_RETURN, ACTIONS.APPROVE)

  const [returns,      setReturns]      = useState([])
  const [pos,          setPOs]          = useState([])
  const [grns,         setGrns]         = useState([])
  const [loading,      setLoading]      = useState(false)
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
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
      const [retRes, poRes, grnRes] = await Promise.allSettled([
        purchaseReturnApi.list({ limit: 200 }),
        purchaseOrderApi.list({ limit: 200, status: 'Fully Received,Partially Received' }),
        grnApi.list({ limit: 200, status: 'Approved' }),
      ])
      if (retRes.status === 'fulfilled') {
        const d = retRes.value?.data || retRes.value
        setReturns(Array.isArray(d) ? d : (Array.isArray(d?.returns) ? d.returns : []))
      }
      if (poRes.status === 'fulfilled') {
        const d = poRes.value?.data || poRes.value
        setPOs(Array.isArray(d) ? d : (Array.isArray(d?.purchase_orders) ? d.purchase_orders : []))
      }
      if (grnRes.status === 'fulfilled') {
        const d = grnRes.value?.data || grnRes.value
        setGrns(Array.isArray(d) ? d : (Array.isArray(d?.grns) ? d.grns : []))
      }
    } catch { fire('Failed to load', 'error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return returns.filter(r => {
      const matchS = statusFilter === 'all' || r.status === statusFilter
      const matchQ = !q || [r.return_no, r.po_number, r.supplier_name]
        .some(v => (v || '').toLowerCase().includes(q))
      return matchS && matchQ
    })
  }, [returns, search, statusFilter])

  // When GRN selected, pre-fill items
  const onGRNSelect = (grnId) => {
    const grn = grns.find(g => g._id === grnId)
    if (!grn) { setForm(f => ({ ...f, grn_id: grnId, items: [] })); return }
    setForm(f => ({
      ...f,
      grn_id: grnId,
      supplier_id: grn.supplier_id?._id || grn.supplier_id || f.supplier_id,
      warehouse_id: grn.warehouse_id?._id || grn.warehouse_id || f.warehouse_id,
      items: (grn.items || []).map(i => ({
        product_id:   i.product_id?._id || i.product_id || '',
        product_name: i.product_name || '',
        received_qty: parseFloat(i.received_qty) || 0,
        return_qty:   '',
        unit:         i.unit || 'Box',
        rate:         i.rate || '',
        reason:       '',
        batch_no:     i.batch_no || '',
        lot_no:       i.lot_no || '',
      })),
    }))
  }

  const setLine = (idx, field, val) =>
    setForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, [field]: val } : it) }))

  const totalReturnValue = useMemo(() => {
    return form.items.reduce((a, i) => {
      const qty  = parseFloat(i.return_qty) || 0
      const rate = parseFloat(i.rate) || 0
      return a + qty * rate
    }, 0)
  }, [form.items])

  const handleSave = async () => {
    if (!form.supplier_id) return fire('Supplier is required', 'error')
    if (!form.items.some(i => parseFloat(i.return_qty) > 0)) return fire('Enter return quantity for at least one item', 'error')
    if (!form.reason) return fire('Return reason is required', 'error')
    setSaving(true)
    try {
      await purchaseReturnApi.create(form)
      fire('Purchase return created'); setShowModal(false); load()
    } catch (e) { fire(e?.response?.data?.message || 'Save failed', 'error') }
    finally { setSaving(false) }
  }

  const handleApprove = async () => {
    try {
      await purchaseReturnApi.updateStatus(approveTarget._id, 'Approved', remarksText)
      fire('Return approved — stock reduced')
      setApproveTarget(null); setRemarksText(''); load()
    } catch { fire('Approve failed', 'error') }
  }

  const kpi = useMemo(() => ({
    total:     returns.length,
    pending:   returns.filter(r => r.status === 'Pending').length,
    completed: returns.filter(r => r.status === 'Completed').length,
    totalValue:returns.filter(r => r.status !== 'Cancelled').reduce((a, r) => a + (parseFloat(r.total_return_value) || 0), 0),
  }), [returns])

  return (
    <div>
      {toast.msg && (
        <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 9999, background: toast.type === 'error' ? '#FEF2F2' : '#ECFDF5', border: `1px solid ${toast.type === 'error' ? '#FECACA' : '#A7F3D0'}`, color: toast.type === 'error' ? '#DC2626' : '#059669', padding: '10px 18px', borderRadius: 10, fontWeight: 600, fontSize: 13, boxShadow: '0 4px 16px rgba(0,0,0,0.10)' }}>{toast.msg}</div>
      )}

      <div className="breadcrumb"><span>Purchase</span><span className="breadcrumb-sep">›</span><span className="breadcrumb-active">Purchase Return</span></div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><RotateCcw size={22} color="#F26522" /> Purchase Return</div>
          <div className="page-desc">Return goods to supplier — reduces inventory stock upon approval</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={14} /> Refresh</button>
          {mayCreate && <button className="btn btn-primary" onClick={() => { setForm(EMPTY_FORM); setShowModal(true) }}><Plus size={15} /> New Return</button>}
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total Returns', value: kpi.total, color: '#1E2D4A' },
          { label: 'Pending', value: kpi.pending, color: '#D97706' },
          { label: 'Completed', value: kpi.completed, color: '#059669' },
          { label: 'Return Value', value: fmtC(kpi.totalValue), color: '#DC2626' },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{k.label}</div>
            <div style={{ fontSize: k.value.toString().length > 8 ? 18 : 24, fontWeight: 900, color: k.color, marginTop: 4 }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
        <AlertCircle size={16} color="#DC2626" />
        <span style={{ color: '#991B1B' }}>Approved returns <b>reduce inventory stock</b> and create a supplier payable adjustment.</span>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input className="form-control" style={{ paddingLeft: 32 }} placeholder="Search return no, PO no, supplier…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-control" style={{ width: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            {Object.keys(STATUS_MAP).map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#1E2D4A', color: '#fff' }}>
              {['Return No','Date','PO No','Supplier','Warehouse','Items','Return Value','Reason','Status','Actions'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Return Value' || h === 'Actions' ? 'right' : 'left', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>
                <RotateCcw size={32} style={{ opacity: 0.3, marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />No returns found
              </td></tr>
            ) : filtered.map(r => (
              <tr key={r._id} style={{ borderBottom: '1px solid #F1F5F9' }} onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                <td style={{ padding: '10px 12px', fontWeight: 700, color: '#F26522' }}>{r.return_no || '—'}</td>
                <td style={{ padding: '10px 12px' }}>{fmtDate(r.return_date)}</td>
                <td style={{ padding: '10px 12px' }}>{r.po_number || '—'}</td>
                <td style={{ padding: '10px 12px' }}>{r.supplier_name || '—'}</td>
                <td style={{ padding: '10px 12px' }}>{r.warehouse_name || '—'}</td>
                <td style={{ padding: '10px 12px' }}>{(r.items || []).length}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#DC2626' }}>{fmtC(r.total_return_value)}</td>
                <td style={{ padding: '10px 12px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason || '—'}</td>
                <td style={{ padding: '10px 12px' }}><StatusPill status={r.status} /></td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost btn-xs" title="View" onClick={() => setViewItem(r)} style={{ color: '#2563EB' }}><Eye size={13} /></button>
                    {mayApprove && r.status === 'Pending' && (
                      <button className="btn btn-ghost btn-xs" title="Approve" onClick={() => { setApproveTarget(r); setRemarksText('') }} style={{ color: '#059669' }}><CheckCircle size={13} /></button>
                    )}
                    {r.status === 'Draft' && (
                      <button className="btn btn-ghost btn-xs" title="Submit" onClick={async () => {
                        try { await purchaseReturnApi.updateStatus(r._id, 'Pending'); fire('Submitted for approval'); load() }
                        catch { fire('Submit failed', 'error') }
                      }} style={{ color: '#D97706', fontSize: 11, fontWeight: 700 }}>Submit</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 900, width: '100%', maxHeight: '93vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10 }}>
              <span className="modal-title"><RotateCcw size={16} style={{ marginRight: 8 }} />New Purchase Return</span>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 14 }}>
                <div>
                  <label className="form-label">Return Date *</label>
                  <input type="date" className="form-control" value={form.return_date} onChange={e => setForm(f => ({ ...f, return_date: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Select GRN (Approved) *</label>
                  <select className="form-control" value={form.grn_id} onChange={e => onGRNSelect(e.target.value)}>
                    <option value="">-- Select GRN --</option>
                    {grns.map(g => <option key={g._id} value={g._id}>{g.grn_number} — {g.supplier_name || '—'}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Supplier</label>
                  <select className="form-control" value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}>
                    <option value="">-- Select Supplier --</option>
                    {suppliers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Warehouse</label>
                  <select className="form-control" value={form.warehouse_id} onChange={e => setForm(f => ({ ...f, warehouse_id: e.target.value }))}>
                    <option value="">-- Select Warehouse --</option>
                    {warehouses.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Return Reason *</label>
                  <select className="form-control" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}>
                    <option value="">-- Select Reason --</option>
                    {RETURN_REASONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Remarks</label>
                  <input className="form-control" value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} />
                </div>
              </div>

              {form.items.length > 0 && (
                <>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#1E2D4A', marginBottom: 8 }}>Return Items</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#F8FAFC' }}>
                          <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, width: '25%' }}>Product</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>Received</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#DC2626' }}>Return Qty *</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>Unit</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>Rate ₹</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>Amount ₹</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>Batch</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.items.map((line, idx) => {
                          const returnQty = parseFloat(line.return_qty) || 0
                          const rate = parseFloat(line.rate) || 0
                          const amt = returnQty * rate
                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{line.product_name || '—'}</td>
                              <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#64748B' }}>{fmtN(line.received_qty)}</td>
                              <td style={{ padding: '6px 8px' }}>
                                <input type="number" min="0" max={line.received_qty} className="form-control" value={line.return_qty} onChange={e => setLine(idx, 'return_qty', e.target.value)} style={{ textAlign: 'right', width: 80, borderColor: '#DC2626' }} />
                              </td>
                              <td style={{ padding: '6px 8px', color: '#64748B' }}>{line.unit}</td>
                              <td style={{ padding: '6px 8px' }}><input type="number" min="0" className="form-control" value={line.rate} onChange={e => setLine(idx, 'rate', e.target.value)} style={{ textAlign: 'right', width: 90 }} /></td>
                              <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#DC2626' }}>{fmtC(amt)}</td>
                              <td style={{ padding: '6px 8px' }}><input className="form-control" value={line.batch_no} onChange={e => setLine(idx, 'batch_no', e.target.value)} style={{ width: 80 }} /></td>
                              <td style={{ padding: '6px 8px' }}>
                                <select className="form-control" value={line.reason} onChange={e => setLine(idx, 'reason', e.target.value)} style={{ width: 150 }}>
                                  <option value="">—</option>
                                  {RETURN_REASONS.map(r => <option key={r}>{r}</option>)}
                                </select>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: '#FEF2F2' }}>
                          <td colSpan={5} style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'right' }}>Total Return Value</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, fontSize: 15, color: '#DC2626' }}>{fmtC(totalReturnValue)}</td>
                          <td colSpan={2}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}
              {!form.grn_id && <div style={{ textAlign: 'center', padding: 20, color: '#94A3B8', fontSize: 13 }}>Select an approved GRN to load items</div>}
            </div>
            <div className="modal-footer" style={{ position: 'sticky', bottom: 0, background: 'var(--surface)', zIndex: 10 }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Create Return'}</button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewItem && (
        <div className="modal-overlay" onClick={() => setViewItem(null)}>
          <div className="modal" style={{ maxWidth: 780, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Return — {viewItem.return_no}</span><button className="modal-close" onClick={() => setViewItem(null)}><X size={16} /></button></div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                {[['Return No', viewItem.return_no], ['Date', fmtDate(viewItem.return_date)], ['Status', null],
                  ['Supplier', viewItem.supplier_name || '—'], ['Warehouse', viewItem.warehouse_name || '—'], ['PO No', viewItem.po_number || '—'],
                  ['Reason', viewItem.reason || '—'], ['Total Value', fmtC(viewItem.total_return_value)], ['Remarks', viewItem.remarks || '—'],
                ].map(([l, v], i) => (
                  <div key={i} style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700 }}>{l}</div>
                    <div style={{ fontWeight: 700, color: '#1E2D4A', marginTop: 2 }}>{v === null ? <StatusPill status={viewItem.status} /> : v}</div>
                  </div>
                ))}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: '#F1F5F9' }}>
                  {['#','Product','Return Qty','Unit','Rate','Amount'].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: ['Return Qty','Rate','Amount'].includes(h) ? 'right' : 'left', fontWeight: 700 }}>{h}</th>)}
                </tr></thead>
                <tbody>{(viewItem.items || []).map((it, i) => {
                  const amt = (parseFloat(it.return_qty) || 0) * (parseFloat(it.rate) || 0)
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '8px 10px' }}>{i + 1}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>{it.product_name || '—'}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#DC2626' }}>{fmtN(it.return_qty)}</td>
                      <td style={{ padding: '8px 10px' }}>{it.unit}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtC(it.rate)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#DC2626' }}>{fmtC(amt)}</td>
                    </tr>
                  )
                })}</tbody>
              </table>
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setViewItem(null)}>Close</button></div>
          </div>
        </div>
      )}

      {/* Approve */}
      {approveTarget && (
        <div className="modal-overlay" onClick={() => setApproveTarget(null)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Approve Return</span><button className="modal-close" onClick={() => setApproveTarget(null)}><X size={16} /></button></div>
            <div className="modal-body">
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#991B1B' }}>
                Approving will <b>reduce inventory stock</b> by the return quantities.
              </div>
              <label className="form-label">Remarks</label>
              <textarea className="form-control" rows={2} value={remarksText} onChange={e => setRemarksText(e.target.value)} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setApproveTarget(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleApprove}><CheckCircle size={14} /> Approve & Reduce Stock</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
