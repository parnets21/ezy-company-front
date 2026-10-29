import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Plus, Search, X, Eye, Edit2, Trash2, CheckCircle,
  PackageCheck, RefreshCw, Truck, AlertCircle,
} from 'lucide-react'
import { grnApi, purchaseOrderApi } from '../api/purchaseInventoryApi'
import usePermissions from '../hooks/usePermissions'
import { MODULES, ACTIONS } from '../config/permissions'

const STATUS_MAP = {
  Draft:    { bg: '#F1F5F9', color: '#64748B', border: '#CBD5E1' },
  Pending:  { bg: '#FEF3C7', color: '#D97706', border: '#FDE68A' },
  Approved: { bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' },
  Cancelled:{ bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
}

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtN    = n => Number(n || 0).toLocaleString('en-IN')

const EMPTY_FORM = {
  grn_date: new Date().toISOString().slice(0, 10),
  po_id: '',
  supplier_invoice_no: '',
  supplier_invoice_date: '',
  warehouse_id: '',
  vehicle_number: '',
  driver_name: '',
  remarks: '',
  items: [],
}

function StatusPill({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP['Draft']
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{status || 'Draft'}</span>
}

export default function GRNManagement({ products = [], suppliers = [], warehouses = [] }) {
  const { canPerform } = usePermissions()
  const mayCreate  = canPerform(MODULES.GRN, ACTIONS.CREATE)
  const mayApprove = canPerform(MODULES.GRN, ACTIONS.APPROVE)
  const mayDelete  = canPerform(MODULES.GRN, ACTIONS.DELETE)

  const [grns,         setGrns]         = useState([])
  const [pos,          setPOs]          = useState([])
  const [loading,      setLoading]      = useState(false)
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showModal,    setShowModal]    = useState(false)
  const [editItem,     setEditItem]     = useState(null)
  const [viewItem,     setViewItem]     = useState(null)
  const [form,         setForm]         = useState(EMPTY_FORM)
  const [saving,       setSaving]       = useState(false)
  const [toast,        setToast]        = useState({ msg: '', type: 'success' })
  const [approveTarget,setApproveTarget]= useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [remarksText,  setRemarksText]  = useState('')

  const fire = (msg, type = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: 'success' }), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [grnRes, poRes] = await Promise.allSettled([
        grnApi.list({ limit: 200 }),
        purchaseOrderApi.list({ limit: 200, status: 'Approved,Sent,Partially Received' }),
      ])
      if (grnRes.status === 'fulfilled') {
        const d = grnRes.value?.data || grnRes.value
        setGrns(Array.isArray(d) ? d : (Array.isArray(d?.grns) ? d.grns : []))
      }
      if (poRes.status === 'fulfilled') {
        const d = poRes.value?.data || poRes.value
        setPOs(Array.isArray(d) ? d : (Array.isArray(d?.purchase_orders) ? d.purchase_orders : []))
      }
    } catch { fire('Failed to load GRNs', 'error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return grns.filter(g => {
      const matchS = statusFilter === 'all' || g.status === statusFilter
      const matchQ = !q || [g.grn_number, g.supplier_name, g.po_number, g.supplier_invoice_no]
        .some(v => (v || '').toLowerCase().includes(q))
      return matchS && matchQ
    })
  }, [grns, search, statusFilter])

  // When PO is selected in form, pre-fill items from PO
  const onPOSelect = (poId) => {
    const po = pos.find(p => p._id === poId)
    if (!po) { setForm(f => ({ ...f, po_id: poId, warehouse_id: '', items: [] })); return }
    setForm(f => ({
      ...f,
      po_id:       poId,
      warehouse_id: po.warehouse_id?._id || po.warehouse_id || f.warehouse_id,
      items: (po.items || []).map(i => ({
        product_id:      i.product_id?._id || i.product_id || '',
        product_name:    i.product_name || i.product_id?.name || '',
        ordered_qty:     i.quantity || 0,
        received_qty:    '',
        short_qty:       '',
        damaged_qty:     '',
        unit:            i.unit || 'Box',
        batch_no:        '',
        lot_no:          '',
        shade:           '',
        caliber:         '',
        grade:           '',
        remarks:         '',
      })),
    }))
  }

  const setLine = (idx, field, val) => {
    setForm(f => {
      const items = f.items.map((it, i) => {
        if (i !== idx) return it
        const updated = { ...it, [field]: val }
        // Auto-calc short qty = ordered - received
        if (field === 'received_qty') {
          const ordered  = parseFloat(updated.ordered_qty) || 0
          const received = parseFloat(val) || 0
          updated.short_qty = Math.max(0, ordered - received)
        }
        return updated
      })
      return { ...f, items }
    })
  }

  const handleSave = async () => {
    if (!form.po_id) return fire('Select a Purchase Order', 'error')
    if (!form.items.length) return fire('No items to receive', 'error')
    setSaving(true)
    try {
      if (editItem) { await grnApi.update(editItem._id, form); fire('GRN updated') }
      else          { await grnApi.create(form); fire('GRN created') }
      setShowModal(false); load()
    } catch (e) { fire(e?.response?.data?.message || 'Save failed', 'error') }
    finally { setSaving(false) }
  }

  const handleApprove = async () => {
    try {
      await grnApi.approve(approveTarget._id, remarksText)
      fire('GRN approved — stock updated in inventory')
      setApproveTarget(null); setRemarksText(''); load()
    } catch { fire('Approve failed', 'error') }
  }

  const handleDelete = async () => {
    try { await grnApi.delete(deleteTarget._id); fire('GRN deleted'); setDeleteTarget(null); load() }
    catch { fire('Delete failed', 'error') }
  }

  const kpi = useMemo(() => ({
    total:    grns.length,
    pending:  grns.filter(g => g.status === 'Pending').length,
    approved: grns.filter(g => g.status === 'Approved').length,
    totalReceived: grns.filter(g => g.status === 'Approved').reduce((a, g) => a + (g.items || []).reduce((b, i) => b + (parseFloat(i.received_qty) || 0), 0), 0),
  }), [grns])

  return (
    <div>
      {toast.msg && (
        <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 9999, background: toast.type === 'error' ? '#FEF2F2' : '#ECFDF5', border: `1px solid ${toast.type === 'error' ? '#FECACA' : '#A7F3D0'}`, color: toast.type === 'error' ? '#DC2626' : '#059669', padding: '10px 18px', borderRadius: 10, fontWeight: 600, fontSize: 13, boxShadow: '0 4px 16px rgba(0,0,0,0.10)' }}>{toast.msg}</div>
      )}

      <div className="breadcrumb"><span>Purchase</span><span className="breadcrumb-sep">›</span><span className="breadcrumb-active">GRN / Goods Receipt</span></div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><PackageCheck size={22} color="#F26522" /> GRN / Goods Receipt</div>
          <div className="page-desc">Record actual goods received against Purchase Orders. Approved GRN increases inventory stock.</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={14} /> Refresh</button>
          {mayCreate && <button className="btn btn-primary" onClick={() => { setEditItem(null); setForm(EMPTY_FORM); setShowModal(true) }}><Plus size={15} /> New GRN</button>}
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total GRNs',    value: kpi.total,    color: '#1E2D4A' },
          { label: 'Pending',       value: kpi.pending,  color: '#D97706' },
          { label: 'Approved',      value: kpi.approved, color: '#059669' },
          { label: 'Total Received',value: fmtN(kpi.totalReceived) + ' units', color: '#2563EB' },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{k.label}</div>
            <div style={{ fontSize: k.value.toString().length > 6 ? 18 : 24, fontWeight: 900, color: k.color, marginTop: 4 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Alert */}
      <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
        <AlertCircle size={16} color="#EA580C" />
        <span style={{ color: '#9A3412' }}><b>Important:</b> Stock increases only after GRN is <b>Approved</b>. Actual received quantity — not PO quantity — is added to inventory.</span>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input className="form-control" style={{ paddingLeft: 32 }} placeholder="Search GRN no, PO no, supplier invoice…" value={search} onChange={e => setSearch(e.target.value)} />
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
              {['GRN No','Date','PO No','Supplier','Warehouse','Supplier Inv','Items','Received','Status','Actions'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Actions' || h === 'Received' ? 'right' : 'left', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>
                <PackageCheck size={32} style={{ opacity: 0.3, marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />No GRNs found
              </td></tr>
            ) : filtered.map(g => {
              const totalReceived = (g.items || []).reduce((a, i) => a + (parseFloat(i.received_qty) || 0), 0)
              return (
                <tr key={g._id} style={{ borderBottom: '1px solid #F1F5F9' }} onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: '#F26522' }}>{g.grn_number || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{fmtDate(g.grn_date)}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{g.po_number || g.po_id?.po_number || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{g.supplier_name || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{g.warehouse_name || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{g.supplier_invoice_no || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{(g.items || []).length}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmtN(totalReceived)}</td>
                  <td style={{ padding: '10px 12px' }}><StatusPill status={g.status} /></td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-xs" title="View" onClick={() => setViewItem(g)} style={{ color: '#2563EB' }}><Eye size={13} /></button>
                      {g.status === 'Draft' && (
                        <button className="btn btn-ghost btn-xs" title="Edit" onClick={() => { setEditItem(g); setForm({ grn_date: g.grn_date?.slice(0,10)||'', po_id: g.po_id?._id||g.po_id||'', supplier_invoice_no: g.supplier_invoice_no||'', supplier_invoice_date: g.supplier_invoice_date?.slice(0,10)||'', warehouse_id: g.warehouse_id?._id||g.warehouse_id||'', vehicle_number: g.vehicle_number||'', driver_name: g.driver_name||'', remarks: g.remarks||'', items: (g.items||[]).map(i=>({...i, product_id: i.product_id?._id||i.product_id||''})) }); setShowModal(true) }} style={{ color: '#059669' }}><Edit2 size={13} /></button>
                      )}
                      {mayApprove && g.status === 'Pending' && (
                        <button className="btn btn-ghost btn-xs" title="Approve & Stock In" onClick={() => { setApproveTarget(g); setRemarksText('') }} style={{ color: '#059669' }}><CheckCircle size={13} /></button>
                      )}
                      {mayApprove && g.status === 'Draft' && (
                        <button className="btn btn-ghost btn-xs" title="Submit for Approval" onClick={async () => {
                          try { await grnApi.update(g._id, { status: 'Pending' }); fire('Submitted for approval'); load() }
                          catch { fire('Submit failed', 'error') }
                        }} style={{ color: '#D97706', fontSize: 11, fontWeight: 700 }}>Submit</button>
                      )}
                      {mayDelete && g.status === 'Draft' && (
                        <button className="btn btn-ghost btn-xs" title="Delete" onClick={() => setDeleteTarget(g)} style={{ color: '#DC2626' }}><Trash2 size={13} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 980, width: '100%', maxHeight: '93vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10 }}>
              <span className="modal-title"><PackageCheck size={16} style={{ marginRight: 8 }} />{editItem ? 'Edit GRN' : 'New Goods Receipt Note'}</span>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 14 }}>
                <div>
                  <label className="form-label">GRN Date *</label>
                  <input type="date" className="form-control" value={form.grn_date} onChange={e => setForm(f => ({ ...f, grn_date: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Purchase Order *</label>
                  <select className="form-control" value={form.po_id} onChange={e => onPOSelect(e.target.value)} disabled={!!editItem}>
                    <option value="">-- Select PO --</option>
                    {pos.map(p => <option key={p._id} value={p._id}>{p.po_number} — {p.supplier_name || '—'}</option>)}
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
                  <label className="form-label">Supplier Invoice No</label>
                  <input className="form-control" value={form.supplier_invoice_no} onChange={e => setForm(f => ({ ...f, supplier_invoice_no: e.target.value }))} placeholder="Supplier's invoice number" />
                </div>
                <div>
                  <label className="form-label">Supplier Invoice Date</label>
                  <input type="date" className="form-control" value={form.supplier_invoice_date} onChange={e => setForm(f => ({ ...f, supplier_invoice_date: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Vehicle Number</label>
                  <input className="form-control" value={form.vehicle_number} onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value }))} placeholder="e.g. KA01AB1234" />
                </div>
                <div>
                  <label className="form-label">Driver Name</label>
                  <input className="form-control" value={form.driver_name} onChange={e => setForm(f => ({ ...f, driver_name: e.target.value }))} />
                </div>
                <div style={{ gridColumn: '2 / -1' }}>
                  <label className="form-label">Remarks</label>
                  <input className="form-control" value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} />
                </div>
              </div>

              {/* Items */}
              {form.items.length > 0 && (
                <>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#1E2D4A', marginBottom: 8 }}>Received Items</div>
                  <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#9A3412' }}>
                    Enter <b>actual received quantity</b>. Short and damaged quantities are tracked separately.
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 900 }}>
                      <thead>
                        <tr style={{ background: '#F8FAFC' }}>
                          {['Product','Ordered','Received *','Short','Damaged','Unit','Batch','Lot','Shade','Grade','Remarks'].map(h => (
                            <th key={h} style={{ padding: '7px 8px', textAlign: h === 'Ordered' || h === 'Received *' || h === 'Short' || h === 'Damaged' ? 'right' : 'left', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {form.items.map((line, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '5px 6px', fontWeight: 600, whiteSpace: 'nowrap' }}>{line.product_name || '—'}</td>
                            <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'monospace', color: '#64748B' }}>{fmtN(line.ordered_qty)}</td>
                            <td style={{ padding: '5px 6px' }}><input type="number" min="0" className="form-control" value={line.received_qty} onChange={e => setLine(idx, 'received_qty', e.target.value)} style={{ textAlign: 'right', width: 75, borderColor: '#059669' }} /></td>
                            <td style={{ padding: '5px 6px' }}><input type="number" min="0" className="form-control" value={line.short_qty} onChange={e => setLine(idx, 'short_qty', e.target.value)} style={{ textAlign: 'right', width: 65, background: '#FEF9C3' }} readOnly /></td>
                            <td style={{ padding: '5px 6px' }}><input type="number" min="0" className="form-control" value={line.damaged_qty} onChange={e => setLine(idx, 'damaged_qty', e.target.value)} style={{ textAlign: 'right', width: 65, background: '#FEF2F2' }} /></td>
                            <td style={{ padding: '5px 6px' }}><span style={{ fontSize: 12, color: '#64748B' }}>{line.unit}</span></td>
                            <td style={{ padding: '5px 6px' }}><input className="form-control" value={line.batch_no} onChange={e => setLine(idx, 'batch_no', e.target.value)} placeholder="Batch" style={{ width: 80 }} /></td>
                            <td style={{ padding: '5px 6px' }}><input className="form-control" value={line.lot_no} onChange={e => setLine(idx, 'lot_no', e.target.value)} placeholder="Lot" style={{ width: 80 }} /></td>
                            <td style={{ padding: '5px 6px' }}><input className="form-control" value={line.shade} onChange={e => setLine(idx, 'shade', e.target.value)} placeholder="Shade" style={{ width: 70 }} /></td>
                            <td style={{ padding: '5px 6px' }}>
                              <select className="form-control" value={line.grade} onChange={e => setLine(idx, 'grade', e.target.value)} style={{ width: 90 }}>
                                <option value="">Grade</option>
                                {['Grade A','Grade B','Grade C','First Quality','Second Quality'].map(g => <option key={g} value={g}>{g}</option>)}
                              </select>
                            </td>
                            <td style={{ padding: '5px 6px' }}><input className="form-control" value={line.remarks} onChange={e => setLine(idx, 'remarks', e.target.value)} placeholder="Notes" style={{ width: 90 }} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {form.items.length === 0 && form.po_id && (
                <div style={{ textAlign: 'center', padding: 20, color: '#94A3B8', fontSize: 13 }}>Select a PO to load items</div>
              )}
              {!form.po_id && (
                <div style={{ textAlign: 'center', padding: 20, color: '#94A3B8', fontSize: 13 }}>Select a Purchase Order to begin</div>
              )}
            </div>
            <div className="modal-footer" style={{ position: 'sticky', bottom: 0, background: 'var(--surface)', zIndex: 10 }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : editItem ? 'Update GRN' : 'Create GRN'}</button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewItem && (
        <div className="modal-overlay" onClick={() => setViewItem(null)}>
          <div className="modal" style={{ maxWidth: 860, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">GRN — {viewItem.grn_number}</span><button className="modal-close" onClick={() => setViewItem(null)}><X size={16} /></button></div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                {[['GRN No', viewItem.grn_number], ['Date', fmtDate(viewItem.grn_date)], ['Status', null],
                  ['PO No', viewItem.po_number || '—'], ['Supplier', viewItem.supplier_name || '—'], ['Warehouse', viewItem.warehouse_name || '—'],
                  ['Supplier Inv', viewItem.supplier_invoice_no || '—'], ['Vehicle', viewItem.vehicle_number || '—'], ['Driver', viewItem.driver_name || '—'],
                ].map(([l, v], i) => (
                  <div key={i} style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700 }}>{l}</div>
                    <div style={{ fontWeight: 700, color: '#1E2D4A', marginTop: 2 }}>{v === null ? <StatusPill status={viewItem.status} /> : v}</div>
                  </div>
                ))}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: '#F1F5F9' }}>
                  {['#','Product','Ordered','Received','Short','Damaged','Unit','Batch','Lot','Shade','Grade'].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: ['Ordered','Received','Short','Damaged'].includes(h) ? 'right' : 'left', fontWeight: 700 }}>{h}</th>)}
                </tr></thead>
                <tbody>{(viewItem.items || []).map((it, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '8px 10px' }}>{i+1}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{it.product_name || '—'}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtN(it.ordered_qty)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#059669', fontWeight: 700 }}>{fmtN(it.received_qty)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: parseFloat(it.short_qty) > 0 ? '#D97706' : '#64748B' }}>{fmtN(it.short_qty)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: parseFloat(it.damaged_qty) > 0 ? '#DC2626' : '#64748B' }}>{fmtN(it.damaged_qty)}</td>
                    <td style={{ padding: '8px 10px' }}>{it.unit}</td>
                    <td style={{ padding: '8px 10px' }}>{it.batch_no || '—'}</td>
                    <td style={{ padding: '8px 10px' }}>{it.lot_no || '—'}</td>
                    <td style={{ padding: '8px 10px' }}>{it.shade || '—'}</td>
                    <td style={{ padding: '8px 10px' }}>{it.grade || '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setViewItem(null)}>Close</button></div>
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {approveTarget && (
        <div className="modal-overlay" onClick={() => setApproveTarget(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Approve GRN — {approveTarget.grn_number}</span><button className="modal-close" onClick={() => setApproveTarget(null)}><X size={16} /></button></div>
            <div className="modal-body">
              <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#065F46' }}>
                <CheckCircle size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Approving this GRN will <b>increase inventory stock</b> by the received quantities.
              </div>
              <label className="form-label">Remarks (optional)</label>
              <textarea className="form-control" rows={2} value={remarksText} onChange={e => setRemarksText(e.target.value)} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setApproveTarget(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleApprove}><CheckCircle size={14} /> Approve & Update Stock</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Delete GRN</span><button className="modal-close" onClick={() => setDeleteTarget(null)}><X size={16} /></button></div>
            <div className="modal-body"><p>Delete <b>{deleteTarget.grn_number}</b>? This cannot be undone.</p></div>
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
