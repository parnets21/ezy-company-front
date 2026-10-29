import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Plus, Search, X, Eye, Edit2, Trash2, CheckCircle, XCircle,
  ClipboardList, RefreshCw, ChevronDown, FileText, ArrowRight,
  Calendar, Package, Warehouse, AlertCircle, Filter,
} from 'lucide-react'
import { purchaseRequisitionApi } from '../api/purchaseInventoryApi'
import usePermissions from '../hooks/usePermissions'
import { MODULES, ACTIONS } from '../config/permissions'

const STATUS_MAP = {
  Draft:            { bg: '#F1F5F9', color: '#64748B', border: '#CBD5E1' },
  'Pending Approval':{ bg: '#FEF3C7', color: '#D97706', border: '#FDE68A' },
  Approved:         { bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' },
  Rejected:         { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
  'Converted to PO':{ bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' },
  Cancelled:        { bg: '#F9FAFB', color: '#9CA3AF', border: '#E5E7EB' },
}
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent']
const STATUSES   = ['Draft', 'Pending Approval', 'Approved', 'Rejected', 'Converted to PO', 'Cancelled']

const EMPTY_FORM = {
  date: new Date().toISOString().slice(0, 10),
  supplier_id: '',
  warehouse_id: '',
  required_date: '',
  priority: 'Medium',
  reason: '',
  remarks: '',
  items: [{ product_id: '', product_name: '', quantity: '', unit: 'Box', remarks: '' }],
}

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtN    = n => Number(n || 0).toLocaleString('en-IN')

function StatusPill({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP['Draft']
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      whiteSpace: 'nowrap',
    }}>{status || 'Draft'}</span>
  )
}

export default function PurchaseRequisition({ products = [], suppliers = [], warehouses = [] }) {
  const { canPerform } = usePermissions()
  const mayCreate  = canPerform(MODULES.PURCHASE_REQUISITION, ACTIONS.CREATE)
  const mayEdit    = canPerform(MODULES.PURCHASE_REQUISITION, ACTIONS.EDIT)
  const mayDelete  = canPerform(MODULES.PURCHASE_REQUISITION, ACTIONS.DELETE)
  const mayApprove = canPerform(MODULES.PURCHASE_REQUISITION, ACTIONS.APPROVE)
  const mayConvert = canPerform(MODULES.PURCHASE_REQUISITION, ACTIONS.CONVERT)

  const [items,       setItems]       = useState([])
  const [loading,     setLoading]     = useState(false)
  const [search,      setSearch]      = useState('')
  const [statusFilter,setStatusFilter]= useState('all')
  const [showModal,   setShowModal]   = useState(false)
  const [editItem,    setEditItem]    = useState(null)
  const [viewItem,    setViewItem]    = useState(null)
  const [form,        setForm]        = useState(EMPTY_FORM)
  const [saving,      setSaving]      = useState(false)
  const [toast,       setToast]       = useState({ msg: '', type: 'success' })
  const [deleteTarget,setDeleteTarget]= useState(null)
  const [approveTarget,setApproveTarget] = useState(null)
  const [rejectTarget, setRejectTarget]  = useState(null)
  const [remarksText,  setRemarksText]   = useState('')

  const fire = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg: '', type: 'success' }), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await purchaseRequisitionApi.list({ limit: 200 })
      const d = res?.data || res
      setItems(Array.isArray(d) ? d : (Array.isArray(d?.requisitions) ? d.requisitions : []))
    } catch { fire('Failed to load requisitions', 'error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter(r => {
      const matchS = statusFilter === 'all' || r.status === statusFilter
      const matchQ = !q || [r.requisition_no, r.supplier_name, r.priority, r.reason]
        .some(v => (v || '').toLowerCase().includes(q))
      return matchS && matchQ
    })
  }, [items, search, statusFilter])

  const openAdd = () => {
    if (!mayCreate) return fire('No permission to create requisitions', 'error')
    setEditItem(null); setForm(EMPTY_FORM); setShowModal(true)
  }
  const openEdit = r => {
    if (!mayEdit) return fire('No permission to edit requisitions', 'error')
    setEditItem(r)
    setForm({
      date:          r.date?.slice(0, 10) || EMPTY_FORM.date,
      supplier_id:   r.supplier_id?._id || r.supplier_id || '',
      warehouse_id:  r.warehouse_id?._id || r.warehouse_id || '',
      required_date: r.required_date?.slice(0, 10) || '',
      priority:      r.priority || 'Medium',
      reason:        r.reason || '',
      remarks:       r.remarks || '',
      items: (r.items || []).map(i => ({
        product_id:   i.product_id?._id || i.product_id || '',
        product_name: i.product_name || '',
        quantity:     i.quantity || '',
        unit:         i.unit || 'Box',
        remarks:      i.remarks || '',
      })),
    })
    setShowModal(true)
  }

  const setLine = (idx, field, val) =>
    setForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, [field]: val } : it) }))
  const addLine  = () => setForm(f => ({ ...f, items: [...f.items, { product_id: '', product_name: '', quantity: '', unit: 'Box', remarks: '' }] }))
  const delLine  = idx => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))

  const handleSave = async () => {
    if (!form.items.some(i => i.product_name || i.product_id))
      return fire('Add at least one product', 'error')
    setSaving(true)
    try {
      if (editItem) {
        await purchaseRequisitionApi.update(editItem._id, form)
        fire('Requisition updated')
      } else {
        await purchaseRequisitionApi.create(form)
        fire('Requisition created')
      }
      setShowModal(false); load()
    } catch (e) { fire(e?.response?.data?.message || 'Save failed', 'error') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    try {
      await purchaseRequisitionApi.delete(deleteTarget._id)
      fire('Requisition deleted'); setDeleteTarget(null); load()
    } catch { fire('Delete failed', 'error') }
  }

  const handleApprove = async () => {
    try {
      await purchaseRequisitionApi.updateStatus(approveTarget._id, 'Approved', remarksText)
      fire('Requisition approved'); setApproveTarget(null); setRemarksText(''); load()
    } catch { fire('Approve failed', 'error') }
  }

  const handleReject = async () => {
    if (!remarksText.trim()) return fire('Rejection reason required', 'error')
    try {
      await purchaseRequisitionApi.updateStatus(rejectTarget._id, 'Rejected', remarksText)
      fire('Requisition rejected'); setRejectTarget(null); setRemarksText(''); load()
    } catch { fire('Reject failed', 'error') }
  }

  const handleConvert = async r => {
    if (!mayConvert) return fire('No permission to convert', 'error')
    if (!window.confirm(`Convert PR ${r.requisition_no} to a Purchase Order?`)) return
    try {
      await purchaseRequisitionApi.convertToPO(r._id)
      fire('Converted to Purchase Order'); load()
    } catch { fire('Conversion failed', 'error') }
  }

  // KPIs
  const kpi = useMemo(() => ({
    total:    items.length,
    pending:  items.filter(r => r.status === 'Pending Approval').length,
    approved: items.filter(r => r.status === 'Approved').length,
    converted:items.filter(r => r.status === 'Converted to PO').length,
  }), [items])

  return (
    <div>
      {/* Toast */}
      {toast.msg && (
        <div style={{
          position: 'fixed', top: 20, right: 24, zIndex: 9999,
          background: toast.type === 'error' ? '#FEF2F2' : '#ECFDF5',
          border: `1px solid ${toast.type === 'error' ? '#FECACA' : '#A7F3D0'}`,
          color: toast.type === 'error' ? '#DC2626' : '#059669',
          padding: '10px 18px', borderRadius: 10, fontWeight: 600, fontSize: 13,
          boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
        }}>{toast.msg}</div>
      )}

      {/* Header */}
      <div className="breadcrumb">
        <span>Purchase</span><span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-active">Purchase Requisition</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClipboardList size={22} color="#F26522" /> Purchase Requisition
          </div>
          <div className="page-desc">Internal purchase requirements before creating a PO</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
          </button>
          {mayCreate && (
            <button className="btn btn-primary" onClick={openAdd}>
              <Plus size={15} /> New Requisition
            </button>
          )}
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total', value: kpi.total,     color: '#1E2D4A' },
          { label: 'Pending Approval', value: kpi.pending,  color: '#D97706' },
          { label: 'Approved', value: kpi.approved, color: '#059669' },
          { label: 'Converted to PO', value: kpi.converted, color: '#2563EB' },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: k.color, marginTop: 4 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input className="form-control" style={{ paddingLeft: 32 }} placeholder="Search by PR no, supplier, reason…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-control" style={{ width: 180 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#1E2D4A', color: '#fff' }}>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>PR No</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>Date</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>Supplier</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>Warehouse</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>Priority</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>Items</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>Req. Date</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>Status</th>
              <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>
                <ClipboardList size={32} style={{ opacity: 0.3, marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                No requisitions found
              </td></tr>
            ) : filtered.map(r => (
              <tr key={r._id} style={{ borderBottom: '1px solid #F1F5F9' }} onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: '#F26522' }}>{r.requisition_no || '—'}</td>
                <td style={{ padding: '10px 14px' }}>{fmtDate(r.date)}</td>
                <td style={{ padding: '10px 14px' }}>{r.supplier_name || r.supplier_id?.name || '—'}</td>
                <td style={{ padding: '10px 14px' }}>{r.warehouse_name || r.warehouse_id?.name || '—'}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                    background: r.priority === 'Urgent' ? '#FEF2F2' : r.priority === 'High' ? '#FFF7ED' : '#F0FDF4',
                    color: r.priority === 'Urgent' ? '#DC2626' : r.priority === 'High' ? '#EA580C' : '#16A34A',
                  }}>{r.priority || 'Medium'}</span>
                </td>
                <td style={{ padding: '10px 14px' }}>{(r.items || []).length} item{(r.items || []).length !== 1 ? 's' : ''}</td>
                <td style={{ padding: '10px 14px' }}>{fmtDate(r.required_date)}</td>
                <td style={{ padding: '10px 14px' }}><StatusPill status={r.status} /></td>
                <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button className="btn btn-ghost btn-xs" title="View" onClick={() => setViewItem(r)} style={{ color: '#2563EB' }}><Eye size={13} /></button>
                    {mayEdit && r.status === 'Draft' && (
                      <button className="btn btn-ghost btn-xs" title="Edit" onClick={() => openEdit(r)} style={{ color: '#059669' }}><Edit2 size={13} /></button>
                    )}
                    {mayApprove && r.status === 'Pending Approval' && (
                      <>
                        <button className="btn btn-ghost btn-xs" title="Approve" onClick={() => { setApproveTarget(r); setRemarksText('') }} style={{ color: '#059669' }}><CheckCircle size={13} /></button>
                        <button className="btn btn-ghost btn-xs" title="Reject"  onClick={() => { setRejectTarget(r);  setRemarksText('') }} style={{ color: '#DC2626' }}><XCircle size={13} /></button>
                      </>
                    )}
                    {mayConvert && r.status === 'Approved' && (
                      <button className="btn btn-xs" title="Convert to PO" onClick={() => handleConvert(r)} style={{ background: '#2563EB', color: '#fff', gap: 4, fontSize: 11 }}>
                        <ArrowRight size={12} /> To PO
                      </button>
                    )}
                    {mayApprove && r.status === 'Draft' && (
                      <button className="btn btn-ghost btn-xs" title="Submit for Approval" onClick={async () => {
                        try { await purchaseRequisitionApi.updateStatus(r._id, 'Pending Approval'); fire('Submitted for approval'); load() }
                        catch { fire('Submit failed', 'error') }
                      }} style={{ color: '#D97706', fontSize: 11, fontWeight: 700 }}>Submit</button>
                    )}
                    {mayDelete && ['Draft', 'Rejected', 'Cancelled'].includes(r.status) && (
                      <button className="btn btn-ghost btn-xs" title="Delete" onClick={() => setDeleteTarget(r)} style={{ color: '#DC2626' }}><Trash2 size={13} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 820, width: '100%', maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10 }}>
              <span className="modal-title"><ClipboardList size={16} style={{ marginRight: 8 }} />{editItem ? 'Edit Requisition' : 'New Purchase Requisition'}</span>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label className="form-label">Date *</label>
                  <input type="date" className="form-control" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Required By Date</label>
                  <input type="date" className="form-control" value={form.required_date} onChange={e => setForm(f => ({ ...f, required_date: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Priority</label>
                  <select className="form-control" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                    {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Supplier (optional)</label>
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
                  <label className="form-label">Reason</label>
                  <input className="form-control" placeholder="e.g. Stock replenishment" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
                </div>
              </div>

              {/* Line Items */}
              <div style={{ fontWeight: 700, fontSize: 13, color: '#1E2D4A', marginBottom: 8 }}>Products *</div>
              <div className="table-wrap" style={{ overflowX: 'auto', marginBottom: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, width: '35%' }}>Product</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>Qty</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>Unit</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>Remarks</th>
                      <th style={{ padding: '8px 10px', width: 36 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((line, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '6px 8px' }}>
                          <select className="form-control" value={line.product_id} onChange={e => {
                            const p = products.find(x => (x._id || x.id) === e.target.value)
                            setLine(idx, 'product_id', e.target.value)
                            if (p) setLine(idx, 'product_name', p.name)
                          }}>
                            <option value="">-- Select Product --</option>
                            {products
                              .filter(p => p.is_active !== false && p.status !== 'deleted')
                              .map(p => <option key={p._id || p.id} value={p._id || p.id}>{p.name}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <input type="number" min="0" className="form-control" value={line.quantity} onChange={e => setLine(idx, 'quantity', e.target.value)} placeholder="0" style={{ width: 80 }} />
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <select className="form-control" style={{ width: 90 }} value={line.unit} onChange={e => setLine(idx, 'unit', e.target.value)}>
                            {['Box', 'Piece', 'Sq.Ft', 'Sq.M', 'Pallet', 'Nos'].map(u => <option key={u}>{u}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <input className="form-control" value={line.remarks} onChange={e => setLine(idx, 'remarks', e.target.value)} placeholder="Optional" />
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <button type="button" onClick={() => delLine(idx)} style={{ border: 'none', background: 'none', color: '#DC2626', cursor: 'pointer', padding: 4 }}><X size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addLine}><Plus size={13} /> Add Row</button>

              <div style={{ marginTop: 14 }}>
                <label className="form-label">Remarks</label>
                <textarea className="form-control" rows={2} value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} placeholder="Additional notes" />
              </div>
            </div>
            <div className="modal-footer" style={{ position: 'sticky', bottom: 0, background: 'var(--surface)', zIndex: 10 }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editItem ? 'Update' : 'Create Requisition'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewItem && (
        <div className="modal-overlay" onClick={() => setViewItem(null)}>
          <div className="modal" style={{ maxWidth: 700, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Requisition Details</span><button className="modal-close" onClick={() => setViewItem(null)}><X size={16} /></button></div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                {[
                  ['PR No', viewItem.requisition_no], ['Date', fmtDate(viewItem.date)],
                  ['Supplier', viewItem.supplier_name || '—'], ['Warehouse', viewItem.warehouse_name || '—'],
                  ['Priority', viewItem.priority], ['Required By', fmtDate(viewItem.required_date)],
                  ['Reason', viewItem.reason || '—'], ['Status', null],
                ].map(([l, v], i) => (
                  <div key={i} style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700 }}>{l}</div>
                    <div style={{ fontWeight: 700, color: '#1E2D4A', marginTop: 2 }}>
                      {v === null ? <StatusPill status={viewItem.status} /> : v}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Items</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: '#F1F5F9' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>#</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Product</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Qty</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Unit</th>
                </tr></thead>
                <tbody>{(viewItem.items || []).map((it, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '8px 12px' }}>{i + 1}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{it.product_name || it.product_id?.name || '—'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>{fmtN(it.quantity)}</td>
                    <td style={{ padding: '8px 12px' }}>{it.unit}</td>
                  </tr>
                ))}</tbody>
              </table>
              {viewItem.remarks && <div style={{ marginTop: 12, fontSize: 13, color: '#64748B' }}><b>Remarks:</b> {viewItem.remarks}</div>}
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setViewItem(null)}>Close</button></div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Delete Requisition</span><button className="modal-close" onClick={() => setDeleteTarget(null)}><X size={16} /></button></div>
            <div className="modal-body"><p>Delete <b>{deleteTarget.requisition_no}</b>? This cannot be undone.</p></div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn" style={{ background: '#DC2626', color: '#fff' }} onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {approveTarget && (
        <div className="modal-overlay" onClick={() => setApproveTarget(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Approve Requisition</span><button className="modal-close" onClick={() => setApproveTarget(null)}><X size={16} /></button></div>
            <div className="modal-body">
              <p style={{ marginBottom: 12 }}>Approve <b>{approveTarget.requisition_no}</b>?</p>
              <label className="form-label">Remarks (optional)</label>
              <textarea className="form-control" rows={2} value={remarksText} onChange={e => setRemarksText(e.target.value)} placeholder="Approval notes" />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setApproveTarget(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleApprove}><CheckCircle size={14} /> Approve</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectTarget && (
        <div className="modal-overlay" onClick={() => setRejectTarget(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Reject Requisition</span><button className="modal-close" onClick={() => setRejectTarget(null)}><X size={16} /></button></div>
            <div className="modal-body">
              <p style={{ marginBottom: 12 }}>Reject <b>{rejectTarget.requisition_no}</b>?</p>
              <label className="form-label">Reason *</label>
              <textarea className="form-control" rows={2} value={remarksText} onChange={e => setRemarksText(e.target.value)} placeholder="Reason for rejection" />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setRejectTarget(null)}>Cancel</button>
              <button className="btn" style={{ background: '#DC2626', color: '#fff' }} onClick={handleReject}><XCircle size={14} /> Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
