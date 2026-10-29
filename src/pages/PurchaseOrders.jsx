import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Plus, Search, X, Eye, Edit2, Trash2, CheckCircle, XCircle,
  FileText, RefreshCw, Send, Package, Truck, ArrowRight,
  ChevronDown, Calendar, DollarSign,
} from 'lucide-react'
import { purchaseOrderApi } from '../api/purchaseInventoryApi'
import usePermissions from '../hooks/usePermissions'
import { MODULES, ACTIONS } from '../config/permissions'

const STATUS_MAP = {
  Draft:              { bg: '#F1F5F9', color: '#64748B', border: '#CBD5E1' },
  'Pending Approval': { bg: '#FEF3C7', color: '#D97706', border: '#FDE68A' },
  Approved:           { bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' },
  Sent:               { bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' },
  'Partially Received':{ bg: '#FFF7ED', color: '#EA580C', border: '#FED7AA' },
  'Fully Received':   { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' },
  Cancelled:          { bg: '#F9FAFB', color: '#9CA3AF', border: '#E5E7EB' },
  Closed:             { bg: '#F5F3FF', color: '#7C3AED', border: '#DDD6FE' },
}
const STATUSES = Object.keys(STATUS_MAP)
const PAYMENT_TERMS = ['Immediate', 'Net 7', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Advance', 'LC']
const GST_RATES = [0, 5, 12, 18, 28]

const EMPTY_FORM = {
  date: new Date().toISOString().slice(0, 10),
  supplier_id: '',
  warehouse_id: '',
  expected_delivery_date: '',
  payment_terms: 'Net 30',
  freight_charges: '',
  other_charges: '',
  remarks: '',
  items: [{ product_id: '', product_name: '', quantity: '', unit: 'Box', rate: '', gst_percent: 18, discount: '' }],
}

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtN    = n => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function StatusPill({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP['Draft']
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: 'nowrap' }}>{status || 'Draft'}</span>
}

function calcTotals(items, freight = 0, other = 0) {
  let subtotal = 0, gstTotal = 0
  items.forEach(it => {
    const qty  = parseFloat(it.quantity) || 0
    const rate = parseFloat(it.rate) || 0
    const disc = parseFloat(it.discount) || 0
    const gst  = parseFloat(it.gst_percent) || 0
    const lineAmt = qty * rate * (1 - disc / 100)
    subtotal  += lineAmt
    gstTotal  += lineAmt * gst / 100
  })
  const grand = subtotal + gstTotal + (parseFloat(freight) || 0) + (parseFloat(other) || 0)
  return { subtotal, gstTotal, grand }
}

export default function PurchaseOrders({ products = [], suppliers = [], warehouses = [] }) {
  const { canPerform } = usePermissions()
  const mayCreate  = canPerform(MODULES.PURCHASE_ORDERS, ACTIONS.CREATE)
  const mayEdit    = canPerform(MODULES.PURCHASE_ORDERS, ACTIONS.EDIT)
  const mayDelete  = canPerform(MODULES.PURCHASE_ORDERS, ACTIONS.DELETE)
  const mayApprove = canPerform(MODULES.PURCHASE_ORDERS, ACTIONS.APPROVE)
  const maySend    = canPerform(MODULES.PURCHASE_ORDERS, ACTIONS.SEND)

  const [items,        setItems]        = useState([])
  const [loading,      setLoading]      = useState(false)
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showModal,    setShowModal]    = useState(false)
  const [editItem,     setEditItem]     = useState(null)
  const [viewItem,     setViewItem]     = useState(null)
  const [form,         setForm]         = useState(EMPTY_FORM)
  const [saving,       setSaving]       = useState(false)
  const [toast,        setToast]        = useState({ msg: '', type: 'success' })
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [statusTarget, setStatusTarget] = useState(null) // { item, newStatus }
  const [remarksText,  setRemarksText]  = useState('')

  const fire = (msg, type = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: 'success' }), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await purchaseOrderApi.list({ limit: 200 })
      const d = res?.data || res
      setItems(Array.isArray(d) ? d : (Array.isArray(d?.purchase_orders) ? d.purchase_orders : []))
    } catch { fire('Failed to load purchase orders', 'error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter(r => {
      const matchS = statusFilter === 'all' || r.status === statusFilter
      const matchQ = !q || [r.po_number, r.supplier_name, r.warehouse_name]
        .some(v => (v || '').toLowerCase().includes(q))
      return matchS && matchQ
    })
  }, [items, search, statusFilter])

  const openAdd = () => {
    if (!mayCreate) return fire('No permission', 'error')
    setEditItem(null); setForm(EMPTY_FORM); setShowModal(true)
  }
  const openEdit = r => {
    if (!mayEdit) return fire('No permission', 'error')
    setEditItem(r)
    setForm({
      date: r.date?.slice(0, 10) || EMPTY_FORM.date,
      supplier_id: r.supplier_id?._id || r.supplier_id || '',
      warehouse_id: r.warehouse_id?._id || r.warehouse_id || '',
      expected_delivery_date: r.expected_delivery_date?.slice(0, 10) || '',
      payment_terms: r.payment_terms || 'Net 30',
      freight_charges: r.freight_charges || '',
      other_charges: r.other_charges || '',
      remarks: r.remarks || '',
      items: (r.items || []).map(i => ({
        product_id:   i.product_id?._id || i.product_id || '',
        product_name: i.product_name || '',
        quantity:     i.quantity || '',
        unit:         i.unit || 'Box',
        rate:         i.rate || '',
        gst_percent:  i.gst_percent ?? 18,
        discount:     i.discount || '',
      })),
    })
    setShowModal(true)
  }

  const setLine = (idx, field, val) =>
    setForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, [field]: val } : it) }))
  const addLine  = () => setForm(f => ({ ...f, items: [...f.items, { product_id: '', product_name: '', quantity: '', unit: 'Box', rate: '', gst_percent: 18, discount: '' }] }))
  const delLine  = idx => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))

  const totals = useMemo(() => calcTotals(form.items, form.freight_charges, form.other_charges), [form])

  const handleSave = async () => {
    if (!form.supplier_id) return fire('Select a supplier', 'error')
    if (!form.items.some(i => i.product_id || i.product_name)) return fire('Add at least one product', 'error')
    setSaving(true)
    try {
      if (editItem) { await purchaseOrderApi.update(editItem._id, form); fire('PO updated') }
      else          { await purchaseOrderApi.create(form); fire('PO created') }
      setShowModal(false); load()
    } catch (e) { fire(e?.response?.data?.message || 'Save failed', 'error') }
    finally { setSaving(false) }
  }

  const handleStatusChange = async () => {
    try {
      await purchaseOrderApi.updateStatus(statusTarget.item._id, statusTarget.newStatus, remarksText)
      fire(`PO ${statusTarget.newStatus}`)
      setStatusTarget(null); setRemarksText(''); load()
    } catch { fire('Status update failed', 'error') }
  }

  const handleSendPO = async r => {
    if (!maySend) return fire('No permission to send PO', 'error')
    try { await purchaseOrderApi.send(r._id); fire('PO sent to supplier'); load() }
    catch { fire('Send failed', 'error') }
  }

  const handleDelete = async () => {
    try { await purchaseOrderApi.delete(deleteTarget._id); fire('PO deleted'); setDeleteTarget(null); load() }
    catch { fire('Delete failed', 'error') }
  }

  const kpi = useMemo(() => ({
    total:     items.length,
    pending:   items.filter(r => r.status === 'Pending Approval').length,
    partial:   items.filter(r => r.status === 'Partially Received').length,
    totalValue:items.reduce((a, r) => a + (parseFloat(r.grand_total) || 0), 0),
  }), [items])

  return (
    <div>
      {toast.msg && (
        <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 9999, background: toast.type === 'error' ? '#FEF2F2' : '#ECFDF5', border: `1px solid ${toast.type === 'error' ? '#FECACA' : '#A7F3D0'}`, color: toast.type === 'error' ? '#DC2626' : '#059669', padding: '10px 18px', borderRadius: 10, fontWeight: 600, fontSize: 13, boxShadow: '0 4px 16px rgba(0,0,0,0.10)' }}>{toast.msg}</div>
      )}

      <div className="breadcrumb"><span>Purchase</span><span className="breadcrumb-sep">›</span><span className="breadcrumb-active">Purchase Orders</span></div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FileText size={22} color="#F26522" /> Purchase Orders</div>
          <div className="page-desc">Manage purchase orders and track receiving status</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={14} /> Refresh</button>
          {mayCreate && <button className="btn btn-primary" onClick={openAdd}><Plus size={15} /> New PO</button>}
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total POs', value: kpi.total, color: '#1E2D4A' },
          { label: 'Pending Approval', value: kpi.pending, color: '#D97706' },
          { label: 'Partially Received', value: kpi.partial, color: '#EA580C' },
          { label: 'Total Value', value: `₹${Number(kpi.totalValue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: '#059669' },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: k.color, marginTop: 4 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input className="form-control" style={{ paddingLeft: 32 }} placeholder="Search PO no, supplier, warehouse…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-control" style={{ width: 200 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#1E2D4A', color: '#fff' }}>
              {['PO No', 'Date', 'Supplier', 'Warehouse', 'Items', 'Ordered', 'Received', 'Grand Total', 'Exp. Delivery', 'Status', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Grand Total' || h === 'Actions' ? 'right' : 'left', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={11} style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>
                <FileText size={32} style={{ opacity: 0.3, marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />No purchase orders found
              </td></tr>
            ) : filtered.map(r => {
              const totalOrdered  = (r.items || []).reduce((a, i) => a + (parseFloat(i.quantity) || 0), 0)
              const totalReceived = (r.items || []).reduce((a, i) => a + (parseFloat(i.received_qty) || 0), 0)
              return (
                <tr key={r._id} style={{ borderBottom: '1px solid #F1F5F9' }} onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: '#F26522' }}>{r.po_number || '—'}</td>
                  <td style={{ padding: '10px 14px' }}>{fmtDate(r.date)}</td>
                  <td style={{ padding: '10px 14px' }}>{r.supplier_name || r.supplier_id?.name || '—'}</td>
                  <td style={{ padding: '10px 14px' }}>{r.warehouse_name || r.warehouse_id?.name || '—'}</td>
                  <td style={{ padding: '10px 14px' }}>{(r.items || []).length}</td>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{fmtN(totalOrdered)}</td>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>
                    <span style={{ color: totalReceived >= totalOrdered && totalOrdered > 0 ? '#059669' : totalReceived > 0 ? '#EA580C' : '#64748B' }}>{fmtN(totalReceived)}</span>
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>₹{fmtN(r.grand_total)}</td>
                  <td style={{ padding: '10px 14px' }}>{fmtDate(r.expected_delivery_date)}</td>
                  <td style={{ padding: '10px 14px' }}><StatusPill status={r.status} /></td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-xs" title="View" onClick={() => setViewItem(r)} style={{ color: '#2563EB' }}><Eye size={13} /></button>
                      {mayEdit && ['Draft', 'Pending Approval'].includes(r.status) && (
                        <button className="btn btn-ghost btn-xs" title="Edit" onClick={() => openEdit(r)} style={{ color: '#059669' }}><Edit2 size={13} /></button>
                      )}
                      {mayApprove && r.status === 'Pending Approval' && (
                        <button className="btn btn-ghost btn-xs" title="Approve" onClick={() => { setStatusTarget({ item: r, newStatus: 'Approved' }); setRemarksText('') }} style={{ color: '#059669' }}><CheckCircle size={13} /></button>
                      )}
                      {maySend && r.status === 'Approved' && (
                        <button className="btn btn-ghost btn-xs" title="Send to Supplier" onClick={() => handleSendPO(r)} style={{ color: '#2563EB' }}><Send size={13} /></button>
                      )}
                      {mayApprove && r.status === 'Draft' && (
                        <button className="btn btn-ghost btn-xs" title="Submit" onClick={() => { setStatusTarget({ item: r, newStatus: 'Pending Approval' }); setRemarksText('') }} style={{ color: '#D97706', fontSize: 11 }}>Submit</button>
                      )}
                      {mayDelete && ['Draft', 'Cancelled'].includes(r.status) && (
                        <button className="btn btn-ghost btn-xs" title="Delete" onClick={() => setDeleteTarget(r)} style={{ color: '#DC2626' }}><Trash2 size={13} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 960, width: '100%', maxHeight: '93vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10 }}>
              <span className="modal-title"><FileText size={16} style={{ marginRight: 8 }} />{editItem ? 'Edit Purchase Order' : 'New Purchase Order'}</span>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 14 }}>
                <div>
                  <label className="form-label">PO Date *</label>
                  <input type="date" className="form-control" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Supplier *</label>
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
                  <label className="form-label">Expected Delivery</label>
                  <input type="date" className="form-control" value={form.expected_delivery_date} onChange={e => setForm(f => ({ ...f, expected_delivery_date: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Payment Terms</label>
                  <select className="form-control" value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))}>
                    {PAYMENT_TERMS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Remarks</label>
                  <input className="form-control" value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} placeholder="Optional" />
                </div>
              </div>

              {/* Line Items */}
              <div style={{ fontWeight: 700, fontSize: 13, color: '#1E2D4A', marginBottom: 8 }}>Order Items *</div>
              <div style={{ overflowX: 'auto', marginBottom: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 750 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 700, width: '28%' }}>Product</th>
                      <th style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 700, width: '8%' }}>Qty</th>
                      <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 700, width: '9%' }}>Unit</th>
                      <th style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 700, width: '10%' }}>Rate ₹</th>
                      <th style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 700, width: '8%' }}>Disc%</th>
                      <th style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 700, width: '8%' }}>GST%</th>
                      <th style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 700, width: '14%' }}>Amount ₹</th>
                      <th style={{ padding: '8px 8px', width: 36 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((line, idx) => {
                      const qty  = parseFloat(line.quantity) || 0
                      const rate = parseFloat(line.rate) || 0
                      const disc = parseFloat(line.discount) || 0
                      const gst  = parseFloat(line.gst_percent) || 0
                      const base = qty * rate * (1 - disc / 100)
                      const amt  = base + base * gst / 100
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '5px 6px' }}>
                            <select className="form-control" value={line.product_id} onChange={e => {
                              const p = products.find(x => (x._id || x.id) === e.target.value)
                              setLine(idx, 'product_id', e.target.value)
                              if (p) { setLine(idx, 'product_name', p.name); setLine(idx, 'gst_percent', p.gst_percent || 18) }
                            }}>
                              <option value="">-- Select --</option>
                              {products.map(p => <option key={p._id || p.id} value={p._id || p.id}>{p.name}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: '5px 6px' }}><input type="number" min="0" className="form-control" value={line.quantity} onChange={e => setLine(idx, 'quantity', e.target.value)} style={{ textAlign: 'right' }} /></td>
                          <td style={{ padding: '5px 6px' }}>
                            <select className="form-control" value={line.unit} onChange={e => setLine(idx, 'unit', e.target.value)}>
                              {['Box','Piece','Sq.Ft','Sq.M','Pallet','Nos'].map(u => <option key={u}>{u}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: '5px 6px' }}><input type="number" min="0" className="form-control" value={line.rate} onChange={e => setLine(idx, 'rate', e.target.value)} style={{ textAlign: 'right' }} /></td>
                          <td style={{ padding: '5px 6px' }}><input type="number" min="0" max="100" className="form-control" value={line.discount} onChange={e => setLine(idx, 'discount', e.target.value)} style={{ textAlign: 'right' }} /></td>
                          <td style={{ padding: '5px 6px' }}>
                            <select className="form-control" value={line.gst_percent} onChange={e => setLine(idx, 'gst_percent', e.target.value)}>
                              {GST_RATES.map(g => <option key={g} value={g}>{g}%</option>)}
                            </select>
                          </td>
                          <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>₹{fmtN(amt)}</td>
                          <td style={{ padding: '5px 6px' }}><button type="button" onClick={() => delLine(idx)} style={{ border: 'none', background: 'none', color: '#DC2626', cursor: 'pointer' }}><X size={14} /></button></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addLine}><Plus size={13} /> Add Row</button>

              {/* Charges + Totals */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 300px', gap: 14, marginTop: 16, alignItems: 'start' }}>
                <div>
                  <label className="form-label">Freight Charges ₹</label>
                  <input type="number" min="0" className="form-control" value={form.freight_charges} onChange={e => setForm(f => ({ ...f, freight_charges: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Other Charges ₹</label>
                  <input type="number" min="0" className="form-control" value={form.other_charges} onChange={e => setForm(f => ({ ...f, other_charges: e.target.value }))} />
                </div>
                <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '14px 16px' }}>
                  {[['Subtotal', totals.subtotal], ['GST', totals.gstTotal], ['Freight', parseFloat(form.freight_charges) || 0], ['Other', parseFloat(form.other_charges) || 0]].map(([l, v]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span style={{ color: '#64748B' }}>{l}</span><span style={{ fontFamily: 'monospace' }}>₹{fmtN(v)}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15, borderTop: '2px solid #E2E8F0', paddingTop: 8, marginTop: 6 }}>
                    <span>Grand Total</span><span style={{ color: '#F26522', fontFamily: 'monospace' }}>₹{fmtN(totals.grand)}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ position: 'sticky', bottom: 0, background: 'var(--surface)', zIndex: 10 }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : editItem ? 'Update PO' : 'Create PO'}</button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewItem && (
        <div className="modal-overlay" onClick={() => setViewItem(null)}>
          <div className="modal" style={{ maxWidth: 780, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">PO Details — {viewItem.po_number}</span><button className="modal-close" onClick={() => setViewItem(null)}><X size={16} /></button></div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                {[['PO No', viewItem.po_number], ['Date', fmtDate(viewItem.date)], ['Status', null],
                  ['Supplier', viewItem.supplier_name || '—'], ['Warehouse', viewItem.warehouse_name || '—'], ['Payment Terms', viewItem.payment_terms || '—'],
                  ['Exp. Delivery', fmtDate(viewItem.expected_delivery_date)], ['Grand Total', `₹${fmtN(viewItem.grand_total)}`], ['Remarks', viewItem.remarks || '—'],
                ].map(([l, v], i) => (
                  <div key={i} style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700 }}>{l}</div>
                    <div style={{ fontWeight: 700, color: '#1E2D4A', marginTop: 2 }}>{v === null ? <StatusPill status={viewItem.status} /> : v}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Order Items</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: '#F1F5F9' }}>
                  {['#','Product','Ordered','Received','Pending','Unit','Rate','GST','Amount'].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: h === '#' ? 'center' : ['Ordered','Received','Pending','Rate','Amount'].includes(h) ? 'right' : 'left', fontWeight: 700 }}>{h}</th>)}
                </tr></thead>
                <tbody>{(viewItem.items || []).map((it, i) => {
                  const ordered  = parseFloat(it.quantity) || 0
                  const received = parseFloat(it.received_qty) || 0
                  const pending  = ordered - received
                  const rate = parseFloat(it.rate) || 0
                  const disc = parseFloat(it.discount) || 0
                  const gst  = parseFloat(it.gst_percent) || 0
                  const base = ordered * rate * (1 - disc / 100)
                  const amt  = base + base * gst / 100
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>{i + 1}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>{it.product_name || it.product_id?.name || '—'}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtN(ordered)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#059669' }}>{fmtN(received)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: pending > 0 ? '#EA580C' : '#059669' }}>{fmtN(pending)}</td>
                      <td style={{ padding: '8px 10px' }}>{it.unit}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>₹{fmtN(rate)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{gst}%</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>₹{fmtN(amt)}</td>
                    </tr>
                  )
                })}</tbody>
              </table>
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setViewItem(null)}>Close</button></div>
          </div>
        </div>
      )}

      {/* Status Change Modal */}
      {statusTarget && (
        <div className="modal-overlay" onClick={() => setStatusTarget(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">{statusTarget.newStatus} — {statusTarget.item.po_number}</span><button className="modal-close" onClick={() => setStatusTarget(null)}><X size={16} /></button></div>
            <div className="modal-body">
              <label className="form-label">Remarks (optional)</label>
              <textarea className="form-control" rows={2} value={remarksText} onChange={e => setRemarksText(e.target.value)} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setStatusTarget(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleStatusChange}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Delete PO</span><button className="modal-close" onClick={() => setDeleteTarget(null)}><X size={16} /></button></div>
            <div className="modal-body"><p>Delete <b>{deleteTarget.po_number}</b>? This cannot be undone.</p></div>
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
