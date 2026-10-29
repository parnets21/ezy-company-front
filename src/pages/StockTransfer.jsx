import { useState } from 'react'
import { Plus, Search, ArrowLeftRight, CheckCircle, Clock, XCircle, Eye, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 10

const statusBadge = { Completed: 'badge-green', 'In Transit': 'badge-cyan', Pending: 'badge-yellow', Cancelled: 'badge-red' }

const REASONS = ['Restock', 'Return', 'Customer Order', 'Overflow', 'Quality Check', 'Other']

// Normalise a backend transfer doc into the shape the table renders.
function normalizeTransfer(t) {
  const id = t._id || t.id
  return {
    _id:        id,
    ref:        t.transfer_code || (id ? `TRF-${String(id).slice(-4).toUpperCase()}` : ''),
    date:       t.created_at ? new Date(t.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
    from:       t.from_warehouse_name || t.from || '—',
    to:         t.to_warehouse_name   || t.to   || '—',
    product:    t.product_name || t.product || '—',
    qty:        t.quantity ?? t.qty ?? 0,
    reason:     t.reason || '',
    notes:      t.notes || '',
    status:     t.status || 'Pending',
    approvedBy: t.transferred_by_name || t.approved_by_name || '',
    raw:        t,
  }
}

export default function StockTransfer({
  transfers = [], warehouses = [], products = [],
  createTransfer, updateTransferStatus, deleteTransfer,
}) {
  const rows = transfers.map(normalizeTransfer)

  const [search, setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [page, setPage]           = useState(1)
  const [showModal, setShowModal]  = useState(false)
  const [saving, setSaving]        = useState(false)
  const [form, setForm] = useState({ from: '', to: '', product_id: '', qty: '', reason: 'Restock', notes: '' })

  const [viewItem, setViewItem]     = useState(null)
  const [deleteItem, setDeleteItem] = useState(null)
  const [busyId, setBusyId]         = useState(null)

  const whId = (w) => w._id || w.id
  const prodId = (p) => p._id || p.id

  const filtered = rows.filter(t => {
    const q = search.toLowerCase()
    return (statusFilter === 'All' || t.status === statusFilter) &&
      (t.ref.toLowerCase().includes(q) ||
       t.product.toLowerCase().includes(q) ||
       t.from.toLowerCase().includes(q) ||
       t.to.toLowerCase().includes(q))
  })

  // ── Pagination (10 rows per page) ──────────────────────────
  const total       = filtered.length
  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage    = Math.min(page, totalPages)
  const paged       = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const resetForm = () => setForm({ from: '', to: '', product_id: '', qty: '', reason: 'Restock', notes: '' })

  const handleCreate = async () => {
    if (!form.from || !form.to || !form.product_id || !form.qty)
      return alert('Please select warehouses, product and quantity.')
    if (form.from === form.to)
      return alert('From and To warehouses must be different.')
    if (parseFloat(form.qty) <= 0)
      return alert('Quantity must be greater than 0.')

    setSaving(true)
    const res = await createTransfer({
      from_warehouse: form.from,
      to_warehouse:   form.to,
      product_id:     form.product_id,
      quantity:       parseFloat(form.qty),
      reason:         form.reason,
      notes:          form.notes,
    })
    setSaving(false)
    if (res?.success) {
      setShowModal(false)
      resetForm()
    } else {
      alert(res?.message || res?.error || 'Failed to create transfer.')
    }
  }

  const changeStatus = async (t, status) => {
    setBusyId(t._id)
    const res = await updateTransferStatus(t._id, status)
    setBusyId(null)
    if (!res?.success) alert(res?.message || res?.error || 'Failed to update status.')
  }

  const confirmDelete = async () => {
    const t = deleteItem
    setBusyId(t._id)
    const res = await deleteTransfer(t._id)
    setBusyId(null)
    setDeleteItem(null)
    if (!res?.success) alert(res?.message || res?.error || 'Failed to delete transfer.')
  }

  return (
    <>
      <div className="breadcrumb">
        <span>Inventory</span><span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-active">Stock Transfer</span>
      </div>

      <div className="page-header">
        <div className="page-header-left">
          <div className="page-title">Stock Transfer</div>
          <div className="page-desc">Move inventory between warehouses with full approval workflow</div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={14} /> New Transfer</button>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        {[
          { label: 'Total Transfers', val: rows.length,                                       color: 'blue',   icon: ArrowLeftRight },
          { label: 'Completed',       val: rows.filter(t => t.status === 'Completed').length,  color: 'green',  icon: CheckCircle },
          { label: 'In Transit',      val: rows.filter(t => t.status === 'In Transit').length, color: 'cyan',   icon: ArrowLeftRight },
          { label: 'Pending',         val: rows.filter(t => t.status === 'Pending').length,    color: 'orange', icon: Clock },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className={`stat-icon ${s.color}`}><s.icon size={18} /></div>
            <div className="stat-info"><div className="stat-label">{s.label}</div><div className="stat-value">{s.val}</div></div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Transfer Log ({filtered.length})</span>
          <div className="header-actions">
            <div className="search-bar"><Search size={14} /><input placeholder="Search transfers…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} /></div>
            <select className="form-control" style={{ width: 140 }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
              <option value="All">All Status</option>
              {['Pending', 'In Transit', 'Completed', 'Cancelled'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Transfer ID</th><th>Date</th><th>From Warehouse</th><th>To Warehouse</th><th>Product</th><th>Qty</th><th>Reason</th><th>Approved By</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {paged.map(t => (
                <tr key={t._id}>
                  <td style={{ color: 'var(--primary)', fontWeight: 700 }}>{t.ref}</td>
                  <td style={{ fontSize: 12 }}>{t.date}</td>
                  <td style={{ fontSize: 12, maxWidth: 140 }}>{t.from}</td>
                  <td style={{ fontSize: 12, maxWidth: 140 }}>{t.to}</td>
                  <td style={{ fontWeight: 600, fontSize: 12 }}>{t.product}</td>
                  <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{t.qty}</td>
                  <td style={{ fontSize: 12 }}>{t.reason || '—'}</td>
                  <td style={{ fontSize: 12 }}>{t.approvedBy || <span className="badge badge-gray">Pending</span>}</td>
                  <td><span className={`badge ${statusBadge[t.status] || 'badge-gray'}`}>{t.status}</span></td>
                  <td>
                    <div className="table-actions" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {t.status === 'Pending' && (
                        <button className="btn btn-success btn-xs" disabled={busyId === t._id} onClick={() => changeStatus(t, 'In Transit')}>Approve</button>
                      )}
                      {t.status === 'In Transit' && (
                        <button className="btn btn-primary btn-xs" disabled={busyId === t._id} onClick={() => changeStatus(t, 'Completed')}>Complete</button>
                      )}
                      <button title="View" onClick={() => setViewItem(t)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, color: '#3B82F6', display: 'flex', alignItems: 'center' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#EFF6FF'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      ><Eye size={15} /></button>
                      {t.status !== 'Completed' && (
                        <button title="Delete" disabled={busyId === t._id} onClick={() => setDeleteItem(t)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, color: '#EF4444', display: 'flex', alignItems: 'center' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#FEF2F2'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        ><Trash2 size={15} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={10}><div className="empty-state"><div className="empty-state-icon">🔄</div><h3>No transfers found</h3><p>Create a new stock transfer to get started.</p></div></td></tr>
              )}
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

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Create Stock Transfer</span>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">From Warehouse *</label>
                  <select className="form-control" value={form.from} onChange={e => setForm(f => ({ ...f, from: e.target.value }))}>
                    <option value="">Select warehouse</option>
                    {warehouses.map(w => <option key={whId(w)} value={whId(w)}>{w.name}{w.city ? ` – ${w.city}` : ''}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">To Warehouse *</label>
                  <select className="form-control" value={form.to} onChange={e => setForm(f => ({ ...f, to: e.target.value }))}>
                    <option value="">Select warehouse</option>
                    {warehouses.map(w => <option key={whId(w)} value={whId(w)}>{w.name}{w.city ? ` – ${w.city}` : ''}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Product *</label>
                <select className="form-control" value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}>
                  <option value="">Select product</option>
                  {products.map(p => <option key={prodId(p)} value={prodId(p)}>{p.name}{p.code ? ` (${p.code})` : ''}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Quantity *</label>
                  <input className="form-control" type="number" min={1} placeholder="0" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Reason</label>
                  <select className="form-control" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}>
                    {REASONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-control" rows={2} placeholder="Additional notes…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={saving} onClick={handleCreate}>{saving ? 'Creating…' : 'Create Transfer'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── VIEW MODAL ── */}
      {viewItem && (
        <div className="modal-overlay" onClick={() => setViewItem(null)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Transfer Details — {viewItem.ref}</span>
              <button className="modal-close" onClick={() => setViewItem(null)}>✕</button>
            </div>
            <div className="modal-body">
              {[
                ['Transfer ID', viewItem.ref],
                ['Date', viewItem.date],
                ['From Warehouse', viewItem.from],
                ['To Warehouse', viewItem.to],
                ['Product', viewItem.product],
                ['Quantity', viewItem.qty],
                ['Reason', viewItem.reason || '—'],
                ['Notes', viewItem.notes || '—'],
                ['Approved By', viewItem.approvedBy || 'Not yet approved'],
                ['Status', viewItem.status],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', padding: '8px 0', borderBottom: '1px solid #F1F5F9', gap: 12 }}>
                  <span style={{ width: 150, fontSize: 12, color: '#64748B', fontWeight: 600, flexShrink: 0 }}>{label}</span>
                  <span style={{ fontSize: 13, color: '#1E293B', fontWeight: label === 'Transfer ID' ? 700 : 400 }}>{val}</span>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setViewItem(null)}>Close</button>
              {viewItem.status === 'In Transit' && (
                <button className="btn btn-warning" onClick={() => { changeStatus(viewItem, 'Cancelled'); setViewItem(null) }}>Cancel Transfer</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM MODAL ── */}
      {deleteItem && (
        <div className="modal-overlay" onClick={() => setDeleteItem(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title" style={{ color: '#EF4444' }}>Delete Transfer</span>
              <button className="modal-close" onClick={() => setDeleteItem(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center', padding: '24px 20px' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
              <p style={{ fontSize: 14, color: '#1E293B', fontWeight: 600 }}>
                Are you sure you want to delete <span style={{ color: '#EF4444' }}>{deleteItem.ref}</span>?
              </p>
              <p style={{ fontSize: 12, color: '#64748B', marginTop: 6 }}>
                {deleteItem.product} — {deleteItem.from} → {deleteItem.to}
              </p>
              <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>Stock movement will be reversed. This cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteItem(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={busyId === deleteItem._id} onClick={confirmDelete} style={{ background: '#EF4444', color: '#fff', border: 'none' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
