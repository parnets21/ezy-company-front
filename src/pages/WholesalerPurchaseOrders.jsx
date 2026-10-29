import { useState, useEffect, useCallback } from 'react'
import { ShoppingCart, RefreshCw, Search, AlertCircle, Eye, X, Check, Ban, CheckCircle, Trash2 } from 'lucide-react'
import { wholesalerApi } from '../api/wholesalerApi'

const money = (n) => (n == null || n === '' ? '—' : '₹' + Number(n).toLocaleString('en-IN'))

const statusColor = (s) => {
  switch (s) {
    case 'Received':  return 'badge-green'
    case 'Completed': return 'badge-blue'
    case 'Pending':   return 'badge-yellow'
    case 'Approved':  return 'badge-cyan'
    case 'Cancelled': return 'badge-red'
    default:          return 'badge-gray'
  }
}

// A purchase-order still awaiting an admin decision.
const isPending = (p) => p.status !== 'Approved' && p.status !== 'Cancelled'

export default function WholesalerPurchaseOrders() {
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [search, setSearch]       = useState('')

  const [viewItem, setViewItem] = useState(null)   // purchase being viewed
  const [acting, setActing]     = useState(false)  // approve/reject in-flight
  const [notice, setNotice]     = useState(null)   // success banner after approve
  const [deleteFor, setDeleteFor] = useState(null) // purchase to delete
  const [deleting, setDeleting]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await wholesalerApi.listPurchases().catch(() => ({ data: { purchases: [] } }))
      setPurchases(res?.data?.purchases || res?.purchases || [])
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load purchase orders.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const approve = async () => {
    if (!viewItem) return
    setActing(true); setError(null)
    try {
      const res = await wholesalerApi.approvePurchase(viewItem._id)
      const inv = res?.data?.invoice?.invoice_no || res?.invoice?.invoice_no || ''
      setViewItem(null)
      setNotice(`Order approved and moved to Order Management. Invoice ${inv} generated.`)
      await load()
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to approve order.')
    } finally {
      setActing(false)
    }
  }

  const reject = async () => {
    if (!viewItem) return
    setActing(true); setError(null)
    try {
      await wholesalerApi.rejectPurchase(viewItem._id)
      setViewItem(null)
      setNotice('Order rejected.')
      await load()
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to reject order.')
    } finally {
      setActing(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteFor) return
    setDeleting(true); setError(null)
    try {
      await wholesalerApi.deletePurchase(deleteFor._id)
      setDeleteFor(null)
      setNotice('Purchase order deleted.')
      await load()
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to delete order.')
    } finally {
      setDeleting(false)
    }
  }

  const q = search.trim().toLowerCase()
  const filtered = purchases.filter(p =>
    !q ||
    (p.product_name || '').toLowerCase().includes(q) ||
    (p.supplier_name || '').toLowerCase().includes(q) ||
    (p.purchase_code || '').toLowerCase().includes(q) ||
    (p.company_name || '').toLowerCase().includes(q)
  )
  const pendingCount = purchases.filter(isPending).length

  return (
    <>
      <div className="breadcrumb">
        <span>Wholesaler</span><span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-active">Purchase Orders</span>
      </div>

      <div className="page-header" style={{ marginBottom: 18 }}>
        <div className="page-header-left">
          <div className="page-title">Purchase Orders</div>
          <div className="page-desc">Orders placed from the Wholesaler App — approve to generate an invoice</div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {notice && (
        <div className="alert alert-success" style={{ marginBottom: 14 }}>
          <CheckCircle /><span>{notice}</span>
          <button className="modal-close" style={{ marginLeft: 'auto' }} onClick={() => setNotice(null)}><X size={16} /></button>
        </div>
      )}
      {error && (
        <div className="alert alert-warning" style={{ marginBottom: 14 }}>
          <AlertCircle /><span>{error}</span>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <ShoppingCart size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Purchase Orders ({filtered.length}{pendingCount ? ` · ${pendingCount} pending` : ''})
          </span>
          <div className="header-actions">
            <div className="search-bar">
              <Search size={14} />
              <input placeholder="Search product, supplier, code…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th><th>Company</th><th>Supplier</th><th>Product</th>
                <th>Qty</th><th>Rate</th><th>Total</th><th>Status</th><th>Date</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={10} style={{ textAlign: 'center', padding: 30 }}>Loading…</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No purchase orders found.</td></tr>
              )}
              {!loading && filtered.map(p => (
                <tr key={p._id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>{p.purchase_code}</td>
                  <td>{p.company_name || '—'}</td>
                  <td>{p.supplier_name || '—'}</td>
                  <td style={{ fontWeight: 600 }}>{p.product_name || '—'}</td>
                  <td>{p.qty}</td>
                  <td>{money(p.rate)}</td>
                  <td style={{ fontWeight: 700 }}>{money(p.total_amount)}</td>
                  <td><span className={`badge ${statusColor(p.status)}`}>{p.status}</span></td>
                  <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                    {p.purchase_date ? new Date(p.purchase_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td>
                    <div className="table-actions" style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button className="btn btn-ghost btn-xs" title="View" onClick={() => setViewItem(p)} style={{ color: '#3B82F6' }}>
                        <Eye size={14} />
                      </button>
                      <button
                        className="btn btn-ghost btn-xs"
                        title={p.status === 'Approved' ? 'Approved orders cannot be deleted' : 'Delete'}
                        onClick={() => setDeleteFor(p)}
                        disabled={p.status === 'Approved'}
                        style={{ color: p.status === 'Approved' ? '#CBD5E1' : '#EF4444' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* View + Approve/Reject modal */}
      {viewItem && (
        <div className="modal-overlay" onClick={() => !acting && setViewItem(null)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Purchase Order</span>
              <button className="modal-close" onClick={() => !acting && setViewItem(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{viewItem.product_name || '—'}</div>
                  <div style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{viewItem.purchase_code}</div>
                </div>
                <span className={`badge ${statusColor(viewItem.status)}`}>{viewItem.status}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', marginBottom: 16 }}>
                <Detail label="Company" value={viewItem.company_name} />
                <Detail label="Supplier" value={viewItem.supplier_name} />
                <Detail label="Quantity" value={viewItem.qty} />
                <Detail label="Date" value={viewItem.purchase_date ? new Date(viewItem.purchase_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} />
                {viewItem.invoice_number ? <Detail label="Invoice" value={viewItem.invoice_number} /> : null}
                <Detail label="Notes" value={viewItem.notes} />
              </div>

              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: 'var(--text-muted)' }}>AMOUNT BREAKUP</div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <PriceRow label="Rate" value={money(viewItem.rate)} />
                <PriceRow label="Amount" value={money(viewItem.amount)} />
                <PriceRow label={`GST (${viewItem.gst_percent ?? 18}%)`} value={money(viewItem.gst_amount)} />
                <PriceRow label="Total" value={money(viewItem.total_amount)} last />
              </div>

              {viewItem.status === 'Approved' && (
                <div className="alert alert-success" style={{ marginTop: 14 }}>
                  <CheckCircle /><span>Approved — moved to Order Management. Invoice {viewItem.invoice_number || 'generated'}.</span>
                </div>
              )}
              {viewItem.status === 'Cancelled' && (
                <div className="alert alert-warning" style={{ marginTop: 14 }}>
                  <Ban /><span>This order was rejected.</span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              {isPending(viewItem) ? (
                <>
                  <button className="btn btn-danger" onClick={reject} disabled={acting}>
                    <Ban size={14} /> {acting ? 'Working…' : 'Reject'}
                  </button>
                  <button className="btn btn-primary" onClick={approve} disabled={acting}>
                    <Check size={14} /> {acting ? 'Working…' : 'Approve & Generate Invoice'}
                  </button>
                </>
              ) : (
                <button className="btn btn-secondary" onClick={() => setViewItem(null)}>Close</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteFor && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteFor(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Delete Purchase Order</span>
              <button className="modal-close" onClick={() => !deleting && setDeleteFor(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0 }}>
                Delete order <strong>{deleteFor.purchase_code}</strong> ({deleteFor.product_name || '—'})? This cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteFor(null)} disabled={deleting}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDelete} disabled={deleting}>
                <Trash2 size={14} /> {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Detail({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{value == null || value === '' ? '—' : value}</div>
    </div>
  )
}

function PriceRow({ label, value, last }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', padding: '9px 12px',
      borderBottom: last ? 'none' : '1px solid var(--border)',
      background: last ? 'var(--bg-subtle, #f8fafc)' : 'transparent',
      fontWeight: last ? 800 : 500,
    }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: last ? 'var(--primary)' : 'inherit' }}>{value}</span>
    </div>
  )
}
