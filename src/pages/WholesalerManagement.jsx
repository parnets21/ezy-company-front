/**
 * WholesalerManagement.jsx
 * Unified Wholesaler Management hub — replaces the 4 scattered wholesaler pages.
 * Tabs: Overview | Products | Purchase Orders | Product Requests | Users | Subscriptions
 */
import { useState, useEffect, useCallback } from 'react'
import {
  Package, ShoppingCart, MessageSquare, Users, CreditCard,
  RefreshCw, Search, Eye, Trash2, CheckCircle, XCircle,
  TrendingUp, Building2, AlertCircle, X, FileText, Clock,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { wholesalerApi } from '../api/wholesalerApi'

const PAGE_SIZE = 10

// ─── helpers ─────────────────────────────────────────────────
const money  = n  => n == null ? '—' : '₹' + Number(n).toLocaleString('en-IN')
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const STATUS_BADGE = {
  Delivered: 'badge-green', Confirmed: 'badge-green', Received: 'badge-green', Approved: 'badge-blue',
  Dispatched: 'badge-blue', Replied: 'badge-blue', Quoted: 'badge-blue',
  New: 'badge-yellow', Pending: 'badge-yellow', Viewed: 'badge-yellow',
  Cancelled: 'badge-red', Rejected: 'badge-red',
}
const badge = s => STATUS_BADGE[s] || 'badge-gray'

const PLANS = ['Free', 'Basic', 'Standard', 'Premium', 'Enterprise']

// ═══════════════════════════════════════════════════════════════
// When a `view` prop is passed (from a dedicated route), that single
// section is shown and the in-page tab bar is hidden. Without `view`,
// the original tabbed hub behaviour is kept (back-compat).
export default function WholesalerManagement({ view }) {
  const [tab, setTab] = useState(view || 'overview')
  const [page, setPage] = useState(1)

  // Keep the active section in sync with the route-driven `view` prop.
  useEffect(() => { if (view) setTab(view) }, [view])

  const routed = !!view   // true = dedicated page (no tab bar)

  // data
  const [products,  setProducts]  = useState([])
  const [purchases, setPurchases] = useState([])
  const [requests,  setRequests]  = useState([])
  const [orders,    setOrders]    = useState([])
  const [enquiries, setEnquiries] = useState([])
  const [users,     setUsers]     = useState([])
  const [txns,      setTxns]      = useState([])
  const [subs,      setSubs]      = useState([])
  const [revenue,   setRevenue]   = useState(null)

  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [search,  setSearch]  = useState('')
  const [toast,   setToast]   = useState({ msg: '', ok: true })

  // modals
  const [viewProduct,  setViewProduct]  = useState(null)
  const [viewPurchase, setViewPurchase] = useState(null)
  const [viewOrder,    setViewOrder]    = useState(null)
  const [viewEnquiry,  setViewEnquiry]  = useState(null)
  const [viewUser,     setViewUser]     = useState(null)
  const [delProduct,   setDelProduct]   = useState(null)
  const [delPurchase,  setDelPurchase]  = useState(null)
  const [rejectFor,    setRejectFor]    = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [quoteFor,     setQuoteFor]     = useState(null)
  const [quoteRate,    setQuoteRate]    = useState('')
  const [planFor,      setPlanFor]      = useState(null)
  const [planForm,     setPlanForm]     = useState({ plan: 'Basic', months: '1', enquiry_limit: '0', amount_paid: '' })
  const [saving,       setSaving]       = useState(false)

  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast({ msg: '', ok: true }), 3500) }

  // ── Load all data ──────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [p, pu, rq, o, e, u, t, s, rev] = await Promise.all([
        wholesalerApi.listProducts().catch(() => ({ data: [] })),
        wholesalerApi.listPurchases().catch(() => ({ data: { purchases: [] } })),
        wholesalerApi.listRequests().catch(() => ({ data: { quotations: [] } })),
        wholesalerApi.listOrders().catch(() => ({ data: { orders: [] } })),
        wholesalerApi.listEnquiries().catch(() => ({ data: { enquiries: [] } })),
        wholesalerApi.listUsers().catch(() => ({ data: { users: [] } })),
        wholesalerApi.listTransactions().catch(() => ({ data: { transactions: [] } })),
        wholesalerApi.listSubscriptions().catch(() => ({ data: { subscriptions: [] } })),
        wholesalerApi.revenue().catch(() => null),
      ])
      setProducts (p?.data?.products  || p?.products  || p?.data || [])
      setPurchases(pu?.data?.purchases || pu?.purchases || [])
      setRequests (rq?.data?.quotations || rq?.quotations || [])
      setOrders   (o?.data?.orders    || o?.orders    || [])
      setEnquiries(e?.data?.enquiries || e?.enquiries || [])
      setUsers    (u?.data?.users     || u?.users     || [])
      setTxns     (t?.data?.transactions || t?.transactions || [])
      setSubs     (s?.data?.subscriptions || s?.subscriptions || [])
      setRevenue  (rev?.data || rev || null)
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load wholesaler data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Reset to page 1 whenever the active tab or search query changes.
  useEffect(() => { setPage(1) }, [tab, search])

  // ── Pagination helpers (10 rows per page) ──────────────────
  // Slice any filtered array down to the current page.
  const pageSlice = (arr) => {
    const tp = Math.max(1, Math.ceil(arr.length / PAGE_SIZE))
    const sp = Math.min(page, tp)
    return arr.slice((sp - 1) * PAGE_SIZE, sp * PAGE_SIZE)
  }
  // Reusable numbered pager (uses the shared `page`/`setPage`/`PAGE_SIZE`).
  const Pager = ({ total }) => {
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
    const safePage   = Math.min(page, totalPages)
    if (totalPages <= 1) return null
    return (
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
    )
  }

  // ── Actions ────────────────────────────────────────────────
  const handleApprove = async (id) => {
    setSaving(true)
    try {
      await wholesalerApi.approvePurchase(id)
      showToast('Purchase order approved.')
      load()
    } catch (e) { showToast(e?.response?.data?.message || 'Approve failed.', false) }
    finally { setSaving(false) }
  }

  const handleReject = async () => {
    if (!rejectFor) return
    setSaving(true)
    try {
      await wholesalerApi.rejectPurchase(rejectFor._id, rejectReason)
      showToast('Purchase order rejected.')
      setRejectFor(null); setRejectReason('')
      load()
    } catch (e) { showToast(e?.response?.data?.message || 'Reject failed.', false) }
    finally { setSaving(false) }
  }

  const handleDelProduct = async () => {
    if (!delProduct) return
    setSaving(true)
    try {
      await wholesalerApi.deleteProduct(delProduct._id)
      showToast('Product deleted.')
      setDelProduct(null); load()
    } catch (e) { showToast(e?.response?.data?.message || 'Delete failed.', false) }
    finally { setSaving(false) }
  }

  const handleDelPurchase = async () => {
    if (!delPurchase) return
    setSaving(true)
    try {
      await wholesalerApi.deletePurchase(delPurchase._id)
      showToast('Purchase order deleted.')
      setDelPurchase(null); load()
    } catch (e) { showToast(e?.response?.data?.message || 'Delete failed.', false) }
    finally { setSaving(false) }
  }

  const handleSendQuote = async () => {
    if (!quoteFor || !quoteRate) return
    setSaving(true)
    try {
      await wholesalerApi.sendQuote(quoteFor._id, { rate: parseFloat(quoteRate) })
      showToast('Quote sent.')
      setQuoteFor(null); setQuoteRate(''); load()
    } catch (e) { showToast(e?.response?.data?.message || 'Quote failed.', false) }
    finally { setSaving(false) }
  }

  const handlePlan = async () => {
    if (!planFor) return
    setSaving(true)
    try {
      await wholesalerApi.setCompanyPlan(planFor.company_id, {
        plan: planForm.plan,
        months: parseInt(planForm.months) || 1,
        enquiry_limit: parseInt(planForm.enquiry_limit) || 0,
        amount_paid: parseFloat(planForm.amount_paid) || 0,
      })
      showToast('Plan updated.')
      setPlanFor(null); load()
    } catch (e) { showToast(e?.response?.data?.message || 'Plan update failed.', false) }
    finally { setSaving(false) }
  }

  // ── Search filter ──────────────────────────────────────────
  const q = search.trim().toLowerCase()
  const match = (...vals) => !q || vals.some(v => (v || '').toLowerCase().includes(q))

  const fProducts  = products.filter(p  => match(p.product_code, p.name, p.company_name))
  const fPurchases = purchases.filter(p => match(p.purchase_code || p.order_code, p.company_name, p.product_name, p.supplier_name))
  const fRequests  = requests.filter(r  => match(r.req_code, r.company_name, r.product_name))
  const fOrders    = orders.filter(o    => match(o.order_code, o.company_name, o.customer_name, o.product_name))
  const fEnquiries = enquiries.filter(e => match(e.enq_code, e.company_name, e.retailer_name, e.product_name))
  const fUsers     = users.filter(u     => match(u.name, u.mobile, u.email, u.company_name))
  const fSubs      = subs.filter(s      => match(s.company_name, s.plan, s.company_code))

  const TABS = [
    { key: 'overview',   label: 'Overview' },
    { key: 'products',   label: `Products (${products.length})` },
    { key: 'purchases',  label: `Purchase Orders (${purchases.length})` },
    { key: 'requests',   label: `Product Requests (${requests.length})` },
    { key: 'orders',     label: `Orders (${orders.length})` },
    { key: 'enquiries',  label: `Enquiries (${enquiries.length})` },
    { key: 'users',      label: `Users (${users.length})` },
    { key: 'subs',       label: `Subscriptions (${subs.length})` },
  ]

  const STATS = [
    { label: 'Total Products',   val: products.length,  icon: Package,      color: '#7C3AED', bg: '#F5F3FF' },
    { label: 'Purchase Orders',  val: purchases.length, icon: ShoppingCart, color: '#2563EB', bg: '#EFF6FF' },
    { label: 'Product Requests', val: requests.length,  icon: FileText,     color: '#EA580C', bg: '#FFF7ED' },
    { label: 'Active Orders',    val: orders.filter(o => !['Delivered','Cancelled'].includes(o.status)).length, icon: TrendingUp, color: '#059669', bg: '#ECFDF5' },
    { label: 'Enquiries',        val: enquiries.length, icon: MessageSquare,color: '#D97706', bg: '#FFFBEB' },
    { label: 'Users / Staff',    val: users.length,     icon: Users,        color: '#0891B2', bg: '#ECFEFF' },
    { label: 'Companies',        val: subs.length,      icon: Building2,    color: '#4F46E5', bg: '#EEF2FF' },
    { label: 'Platform Revenue', val: money(revenue?.total_revenue), icon: CreditCard, color: '#DC2626', bg: '#FEF2F2' },
  ]

  return (
    <>
      {/* ── Toast ── */}
      {toast.msg && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, background: toast.ok ? '#059669' : '#DC2626', color: '#fff', padding: '10px 18px', borderRadius: 10, fontWeight: 700, fontSize: 13, boxShadow: '0 4px 20px rgba(0,0,0,.2)', maxWidth: 380 }}>
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div className="page-header" style={{ marginBottom: 18 }}>
        <div className="page-header-left">
          <div className="page-title">{routed ? `Wholesaler ${(TABS.find(t => t.key === tab)?.label || '').replace(/\s*\(\d+\)$/, '')}` : 'Wholesaler Management'}</div>
          <div className="page-desc">Manage wholesaler app companies, products, orders, and subscriptions</div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-warning" style={{ marginBottom: 14 }}><AlertCircle size={15} style={{ marginRight: 8 }} />{error}</div>}

      {/* ── Tabs (only in the legacy hub view; hidden on dedicated pages) ── */}
      {!routed && (
        <div className="tabs" style={{ marginBottom: 18, flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t.key} className={`tab-btn${tab === t.key ? ' active' : ''}`} onClick={() => { setTab(t.key); setSearch('') }}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* ══ OVERVIEW ══════════════════════════════════════════ */}
      {tab === 'overview' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
            {STATS.map(({ label, val, icon: Icon, color, bg }) => (
              <div key={label} style={{ background: bg, borderRadius: 14, padding: '16px 20px', border: `1px solid ${color}22`, display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={20} color={color} />
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color, marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color }}>{val}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Recent purchase orders needing action */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Pending Purchase Orders</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setTab('purchases')}>View All</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Code</th><th>Company</th><th>Product</th><th>Qty</th><th>Total</th><th>Status</th><th>Date</th><th>Action</th></tr></thead>
                <tbody>
                  {purchases.filter(p => p.status === 'Pending').slice(0, 8).map(p => (
                    <tr key={p._id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#F26522' }}>{p.purchase_code || p.order_code || '—'}</td>
                      <td>{p.company_name}</td>
                      <td style={{ fontWeight: 600 }}>{p.product_name || '—'}</td>
                      <td>{p.qty}</td>
                      <td style={{ fontWeight: 700 }}>{money(p.total_amount)}</td>
                      <td><span className={`badge ${badge(p.status)}`}>{p.status}</span></td>
                      <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(p.created_at)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-sm btn-primary" style={{ background: '#059669', fontSize: 11 }} disabled={saving} onClick={() => handleApprove(p._id)}>
                            <CheckCircle size={12} /> Approve
                          </button>
                          <button className="btn btn-sm btn-danger" style={{ fontSize: 11 }} onClick={() => { setRejectFor(p); setRejectReason('') }}>
                            <XCircle size={12} /> Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {purchases.filter(p => p.status === 'Pending').length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No pending purchase orders.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ══ PRODUCTS ══════════════════════════════════════════ */}
      {tab === 'products' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Wholesaler Products</span>
            <div className="header-actions">
              <div className="search-bar"><Search size={14} /><input placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)} /></div>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Code</th><th>Name</th><th>Company</th><th>Size</th><th>Purchase</th><th>Selling</th><th>MRP</th><th>GST%</th><th>Unit</th><th style={{ textAlign: 'center' }}>Actions</th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={10} style={{ textAlign: 'center', padding: 30 }}>Loading…</td></tr>}
                {!loading && fProducts.length === 0 && <tr><td colSpan={10} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No products found.</td></tr>}
                {!loading && pageSlice(fProducts).map(p => (
                  <tr key={p._id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#F26522', fontSize: 12 }}>{p.product_code || '—'}</td>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td>{p.company_name || '—'}</td>
                    <td>{p.size || '—'}</td>
                    <td>{money(p.purchase_price)}</td>
                    <td>{money(p.selling_price)}</td>
                    <td>{money(p.mrp)}</td>
                    <td>{p.gst_percent != null ? `${p.gst_percent}%` : '—'}</td>
                    <td>{p.unit || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button className="btn btn-sm btn-secondary" title="View" onClick={() => setViewProduct(p)}><Eye size={13} /></button>
                        <button className="btn btn-sm btn-danger" title="Delete" onClick={() => setDelProduct(p)}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager total={fProducts.length} />
        </div>
      )}

      {/* ══ PURCHASE ORDERS ═══════════════════════════════════ */}
      {tab === 'purchases' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Purchase Orders (Wholesaler App)</span>
            <div className="header-actions">
              <div className="search-bar"><Search size={14} /><input placeholder="Search orders…" value={search} onChange={e => setSearch(e.target.value)} /></div>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Code</th><th>Company</th><th>Supplier</th><th>Product</th><th>Qty</th><th>Total</th><th>Status</th><th>Date</th><th style={{ textAlign: 'center' }}>Actions</th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 30 }}>Loading…</td></tr>}
                {!loading && fPurchases.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No purchase orders found.</td></tr>}
                {!loading && pageSlice(fPurchases).map(p => (
                  <tr key={p._id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#F26522', fontSize: 12 }}>{p.purchase_code || p.order_code || '—'}</td>
                    <td>{p.company_name}</td>
                    <td>{p.supplier_name || '—'}</td>
                    <td style={{ fontWeight: 600 }}>{p.product_name || '—'}</td>
                    <td>{p.qty}</td>
                    <td style={{ fontWeight: 700 }}>{money(p.total_amount)}</td>
                    <td><span className={`badge ${badge(p.status)}`}>{p.status}</span></td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(p.created_at)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 5, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => setViewPurchase(p)}><Eye size={12} /></button>
                        {p.status === 'Pending' && <>
                          <button className="btn btn-sm btn-primary" style={{ background: '#059669', fontSize: 11 }} disabled={saving} onClick={() => handleApprove(p._id)}>
                            <CheckCircle size={12} /> Approve
                          </button>
                          <button className="btn btn-sm btn-danger" style={{ fontSize: 11 }} onClick={() => { setRejectFor(p); setRejectReason('') }}>
                            <XCircle size={12} /> Reject
                          </button>
                        </>}
                        {p.status !== 'Approved' && (
                          <button className="btn btn-sm btn-danger" style={{ fontSize: 11 }} onClick={() => setDelPurchase(p)}><Trash2 size={12} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager total={fPurchases.length} />
        </div>
      )}

      {/* ══ PRODUCT REQUESTS ══════════════════════════════════ */}
      {tab === 'requests' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Product / Quotation Requests</span>
            <div className="header-actions">
              <div className="search-bar"><Search size={14} /><input placeholder="Search requests…" value={search} onChange={e => setSearch(e.target.value)} /></div>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Code</th><th>Company</th><th>Product</th><th>Qty</th><th>Note</th><th>Quoted Rate</th><th>Status</th><th style={{ textAlign: 'center' }}>Action</th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 30 }}>Loading…</td></tr>}
                {!loading && fRequests.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No product requests found.</td></tr>}
                {!loading && pageSlice(fRequests).map(r => (
                  <tr key={r._id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#F26522', fontSize: 12 }}>{r.req_code || r.enq_code || '—'}</td>
                    <td>{r.company_name}</td>
                    <td style={{ fontWeight: 600 }}>{r.product_name || '—'}</td>
                    <td>{r.qty} {r.unit || ''}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.note || '—'}</td>
                    <td style={{ fontWeight: 700 }}>{r.quoted_rate ? money(r.quoted_rate) : '—'}</td>
                    <td><span className={`badge ${badge(r.status)}`}>{r.status}</span></td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn btn-sm btn-primary" style={{ fontSize: 11 }} onClick={() => { setQuoteFor(r); setQuoteRate(r.quoted_rate || '') }}>
                        {r.quoted_rate ? 'Update Quote' : 'Send Quote'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager total={fRequests.length} />
        </div>
      )}

      {/* ══ ORDERS ════════════════════════════════════════════ */}
      {tab === 'orders' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">All Wholesaler Orders</span>
            <div className="header-actions">
              <div className="search-bar"><Search size={14} /><input placeholder="Search orders…" value={search} onChange={e => setSearch(e.target.value)} /></div>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Code</th><th>Company</th><th>Customer</th><th>Product</th><th>Qty</th><th>Total</th><th>Status</th><th>Date</th><th style={{ textAlign: 'center' }}>Actions</th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 30 }}>Loading…</td></tr>}
                {!loading && fOrders.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No orders found.</td></tr>}
                {!loading && pageSlice(fOrders).map(o => (
                  <tr key={o._id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#F26522', fontSize: 12 }}>{o.order_code}</td>
                    <td>{o.company_name}</td>
                    <td>{o.customer_name || '—'}</td>
                    <td style={{ fontWeight: 600 }}>{o.product_name || '—'}</td>
                    <td>{o.qty}</td>
                    <td style={{ fontWeight: 700 }}>{money(o.total_amount)}</td>
                    <td><span className={`badge ${badge(o.status)}`}>{o.status}</span></td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(o.order_date || o.created_at)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button className="btn btn-sm btn-secondary" title="View" onClick={() => setViewOrder(o)}><Eye size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager total={fOrders.length} />
        </div>
      )}

      {/* ══ ENQUIRIES ═════════════════════════════════════════ */}
      {tab === 'enquiries' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">All Wholesaler Enquiries</span>
            <div className="header-actions">
              <div className="search-bar"><Search size={14} /><input placeholder="Search enquiries…" value={search} onChange={e => setSearch(e.target.value)} /></div>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Code</th><th>Company</th><th>Retailer</th><th>Product</th><th>Qty</th><th>Status</th><th>Date</th><th style={{ textAlign: 'center' }}>Actions</th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 30 }}>Loading…</td></tr>}
                {!loading && fEnquiries.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No enquiries found.</td></tr>}
                {!loading && pageSlice(fEnquiries).map(e => (
                  <tr key={e._id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#F26522', fontSize: 12 }}>{e.enq_code || '—'}</td>
                    <td>{e.company_name}</td>
                    <td>{e.retailer_name || '—'}</td>
                    <td style={{ fontWeight: 600 }}>{e.product_name || '—'}</td>
                    <td>{e.qty} {e.unit || ''}</td>
                    <td>
                      {e.recipient_count > 1 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                          {e.status_rollup?.replied   > 0 && <span className="badge badge-green" style={{ fontSize: 10 }}>{e.status_rollup.replied} replied</span>}
                          {e.status_rollup?.viewed    > 0 && <span className="badge badge-blue"  style={{ fontSize: 10 }}>{e.status_rollup.viewed} viewed</span>}
                          {e.status_rollup?.new       > 0 && <span className="badge badge-gray"  style={{ fontSize: 10 }}>{e.status_rollup.new} new</span>}
                          {e.status_rollup?.cancelled > 0 && <span className="badge badge-red"   style={{ fontSize: 10 }}>{e.status_rollup.cancelled} cancelled</span>}
                        </div>
                      ) : (
                        <span className={`badge ${badge(e.status)}`}>{e.status}</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(e.created_at)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button className="btn btn-sm btn-secondary" title="View" onClick={() => setViewEnquiry(e)}><Eye size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager total={fEnquiries.length} />
        </div>
      )}

      {/* ══ USERS ═════════════════════════════════════════════ */}
      {tab === 'users' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Wholesaler App Users</span>
            <div className="header-actions">
              <div className="search-bar"><Search size={14} /><input placeholder="Search users…" value={search} onChange={e => setSearch(e.target.value)} /></div>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Company</th><th>Mobile</th><th>Email</th><th>Role</th><th>Status</th><th style={{ textAlign: 'center' }}>Actions</th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30 }}>Loading…</td></tr>}
                {!loading && fUsers.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No users found.</td></tr>}
                {!loading && pageSlice(fUsers).map(u => (
                  <tr key={u._id}>
                    <td style={{ fontWeight: 600 }}>{u.name}</td>
                    <td>{u.company_name}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{u.mobile || '—'}</td>
                    <td style={{ fontSize: 12 }}>{u.email || '—'}</td>
                    <td>{u.role}</td>
                    <td><span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button className="btn btn-sm btn-secondary" title="View" onClick={() => setViewUser(u)}><Eye size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager total={fUsers.length} />
        </div>
      )}

      {/* ══ SUBSCRIPTIONS ═════════════════════════════════════ */}
      {tab === 'subs' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Company Subscriptions</span>
            <div className="header-actions">
              <div className="search-bar"><Search size={14} /><input placeholder="Search companies…" value={search} onChange={e => setSearch(e.target.value)} /></div>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Company</th><th>Plan</th><th>Enquiries Used</th><th>Expires</th><th>Last Paid</th><th>Status</th><th style={{ textAlign: 'center' }}>Action</th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30 }}>Loading…</td></tr>}
                {!loading && fSubs.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No companies found.</td></tr>}
                {!loading && pageSlice(fSubs).map(s => (
                  <tr key={s.company_id}>
                    <td style={{ fontWeight: 600 }}>{s.company_name}</td>
                    <td><span className="badge badge-blue">{s.plan}</span></td>
                    <td>{s.enquiry_limit > 0 ? `${s.enquiries_used}/${s.enquiry_limit}` : `${s.enquiries_used} (unlimited)`}</td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(s.expires_at)}</td>
                    <td>{money(s.last_amount)}</td>
                    <td><span className={`badge ${badge(s.status)}`}>{s.status}</span></td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn btn-sm btn-primary" onClick={() => { setPlanFor(s); setPlanForm({ plan: s.plan || 'Basic', months: '1', enquiry_limit: String(s.enquiry_limit || 0), amount_paid: '' }) }}>
                        Manage Plan
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager total={fSubs.length} />
        </div>
      )}

      {/* ════ MODALS ════════════════════════════════════════════ */}

      {/* View Product */}
      {viewProduct && (
        <div className="modal-overlay" onClick={() => setViewProduct(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title"><Package size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />{viewProduct.name}</span>
              <button className="modal-close" onClick={() => setViewProduct(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  ['Code', viewProduct.product_code], ['Company', viewProduct.company_name],
                  ['Size', viewProduct.size], ['Finish', viewProduct.finish],
                  ['Purchase Price', money(viewProduct.purchase_price)], ['Selling Price', money(viewProduct.selling_price)],
                  ['Wholesale Price', money(viewProduct.wholesale_price)], ['MRP', money(viewProduct.mrp)],
                  ['GST %', viewProduct.gst_percent != null ? `${viewProduct.gst_percent}%` : '—'],
                  ['Per Box', viewProduct.per_box_qty], ['Unit', viewProduct.unit],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{val || '—'}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setViewProduct(null)}>Close</button>
              <button className="btn btn-danger btn-sm" onClick={() => { setDelProduct(viewProduct); setViewProduct(null) }}>
                <Trash2 size={13} style={{ marginRight: 4 }} />Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Purchase */}
      {viewPurchase && (
        <div className="modal-overlay" onClick={() => setViewPurchase(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Purchase Order — {viewPurchase.purchase_code || viewPurchase.order_code || '—'}</span>
              <button className="modal-close" onClick={() => setViewPurchase(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  ['Company', viewPurchase.company_name], ['Supplier', viewPurchase.supplier_name],
                  ['Product', viewPurchase.product_name], ['Qty', viewPurchase.qty],
                  ['Rate', money(viewPurchase.rate)], ['Total', money(viewPurchase.total_amount)],
                  ['Status', viewPurchase.status], ['Date', fmtDate(viewPurchase.created_at)],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{val || '—'}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setViewPurchase(null)}>Close</button>
              {viewPurchase.status === 'Pending' && (
                <>
                  <button className="btn btn-primary btn-sm" style={{ background: '#059669' }} disabled={saving} onClick={() => { handleApprove(viewPurchase._id); setViewPurchase(null) }}>
                    <CheckCircle size={13} style={{ marginRight: 4 }} />Approve
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => { setRejectFor(viewPurchase); setViewPurchase(null); setRejectReason('') }}>
                    <XCircle size={13} style={{ marginRight: 4 }} />Reject
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View Order */}
      {viewOrder && (
        <div className="modal-overlay" onClick={() => setViewOrder(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title"><ShoppingCart size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />Order — {viewOrder.order_code || '—'}</span>
              <button className="modal-close" onClick={() => setViewOrder(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  ['Company', viewOrder.company_name], ['Customer', viewOrder.customer_name],
                  ['Product', viewOrder.product_name], ['Qty', viewOrder.qty],
                  ['Rate', money(viewOrder.rate)], ['Total', money(viewOrder.total_amount)],
                  ['Status', viewOrder.status], ['Date', fmtDate(viewOrder.order_date || viewOrder.created_at)],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{val ?? '—'}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setViewOrder(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* View Enquiry */}
      {viewEnquiry && (
        <div className="modal-overlay" onClick={() => setViewEnquiry(null)}>
          <div className="modal" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title"><MessageSquare size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />Enquiry — {viewEnquiry.enq_code || '—'}</span>
              <button className="modal-close" onClick={() => setViewEnquiry(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {/* Basic info grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                {[
                  ['Company', viewEnquiry.company_name], ['Retailer', viewEnquiry.retailer_name],
                  ['Product', viewEnquiry.product_name], ['Qty', `${viewEnquiry.qty ?? '—'} ${viewEnquiry.unit || ''}`],
                  ['Status', viewEnquiry.status], ['Date', fmtDate(viewEnquiry.created_at)],
                  ['Offered Price', viewEnquiry.offered_price != null ? money(viewEnquiry.offered_price) : '—'],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{val ?? '—'}</div>
                  </div>
                ))}
              </div>

              {viewEnquiry.note && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: 2 }}>Note</div>
                  <div style={{ fontSize: 13 }}>{viewEnquiry.note}</div>
                </div>
              )}

              {/* Reply roster — who answered, who is still silent */}
              {(() => {
                const replied  = viewEnquiry.replies?.replied  || []
                const awaiting = viewEnquiry.replies?.awaiting || []
                const isBroadcast = (viewEnquiry.recipient_count || 1) > 1 || replied.length + awaiting.length > 1
                if (!isBroadcast) {
                  // Single-recipient: show simple note fields
                  return (viewEnquiry.distributor_reply || viewEnquiry.negotiation_note || viewEnquiry.remarks) ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {viewEnquiry.distributor_reply && <div style={{ fontSize: 12 }}><b>Reply:</b> {viewEnquiry.distributor_reply}</div>}
                      {viewEnquiry.negotiation_note  && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}><b>Note:</b> {viewEnquiry.negotiation_note}</div>}
                      {viewEnquiry.remarks           && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}><b>Remarks:</b> {viewEnquiry.remarks}</div>}
                    </div>
                  ) : null
                }
                return (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: 8 }}>
                      <MessageSquare size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                      Replies
                    </div>
                    {replied.length === 0 && (
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '4px 0' }}>No one has replied yet.</div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {replied.map(rep => (
                        <div key={rep.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', background: 'var(--bg)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                            <span style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              <Building2 size={13} style={{ color: '#7C3AED' }} />
                              {rep.company?.name || '—'}
                              {rep.company?.company_code && <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>({rep.company.company_code})</span>}
                            </span>
                            <span className={`badge ${badge(rep.status)}`} style={{ fontSize: 11 }}>{rep.status}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12 }}>
                            <span><span style={{ color: 'var(--text-muted)' }}>Price: </span><b style={{ color: '#059669' }}>{rep.offered_price != null ? `₹${Number(rep.offered_price).toLocaleString('en-IN')}` : '—'}</b></span>
                            <span><span style={{ color: 'var(--text-muted)' }}>Available: </span><b>{rep.available_quantity != null ? `${rep.available_quantity} ${rep.unit || ''}` : '—'}</b></span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={11} style={{ color: 'var(--text-muted)' }} />{rep.delivery_timeline || '—'}</span>
                          </div>
                          {rep.message && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text)' }}>{rep.message}</div>}
                          {rep.negotiation_note && <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}>Note: {rep.negotiation_note}</div>}
                        </div>
                      ))}
                    </div>
                  </>
                )
              })()}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setViewEnquiry(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* View User */}
      {viewUser && (
        <div className="modal-overlay" onClick={() => setViewUser(null)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title"><Users size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />{viewUser.name}</span>
              <button className="modal-close" onClick={() => setViewUser(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  ['Company', viewUser.company_name], ['Role', viewUser.role],
                  ['Mobile', viewUser.mobile], ['Email', viewUser.email],
                  ['Status', viewUser.is_active ? 'Active' : 'Inactive'],
                  ['Last Login', viewUser.last_login ? fmtDate(viewUser.last_login) : '—'],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{val || '—'}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setViewUser(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject */}
      {rejectFor && (
        <div className="modal-overlay" onClick={() => !saving && setRejectFor(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title"><XCircle size={15} style={{ marginRight: 6, verticalAlign: 'middle', color: '#DC2626' }} />Reject Order — {rejectFor.purchase_code || rejectFor.order_code || '—'}</span>
              <button className="modal-close" onClick={() => setRejectFor(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Reason (optional)</label>
                <textarea className="form-control" rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="e.g. Out of stock" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" disabled={saving} onClick={() => setRejectFor(null)}>Cancel</button>
              <button className="btn btn-danger btn-sm" disabled={saving} onClick={handleReject}>{saving ? 'Rejecting…' : 'Reject Order'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Product */}
      {delProduct && (
        <div className="modal-overlay" onClick={() => !saving && setDelProduct(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title"><Trash2 size={15} style={{ marginRight: 6, verticalAlign: 'middle', color: '#DC2626' }} />Delete Product</span>
              <button className="modal-close" onClick={() => setDelProduct(null)}><X size={18} /></button>
            </div>
            <div className="modal-body"><p style={{ margin: 0 }}>Delete <strong>{delProduct.name}</strong>? This cannot be undone.</p></div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" disabled={saving} onClick={() => setDelProduct(null)}>Cancel</button>
              <button className="btn btn-danger btn-sm" disabled={saving} onClick={handleDelProduct}>{saving ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Purchase */}
      {delPurchase && (
        <div className="modal-overlay" onClick={() => !saving && setDelPurchase(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title"><Trash2 size={15} style={{ marginRight: 6, verticalAlign: 'middle', color: '#DC2626' }} />Delete Purchase Order</span>
              <button className="modal-close" onClick={() => setDelPurchase(null)}><X size={18} /></button>
            </div>
            <div className="modal-body"><p style={{ margin: 0 }}>Delete purchase order <strong>{delPurchase.purchase_code || delPurchase.order_code || '—'}</strong>?</p></div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" disabled={saving} onClick={() => setDelPurchase(null)}>Cancel</button>
              <button className="btn btn-danger btn-sm" disabled={saving} onClick={handleDelPurchase}>{saving ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Send Quote */}
      {quoteFor && (
        <div className="modal-overlay" onClick={() => !saving && setQuoteFor(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Send Quote — {quoteFor.product_name}</span>
              <button className="modal-close" onClick={() => setQuoteFor(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Rate per unit (₹) <span style={{ color: '#DC2626' }}>*</span></label>
                <input type="number" min="0" className="form-control" value={quoteRate} onChange={e => setQuoteRate(e.target.value)} placeholder="0.00" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" disabled={saving} onClick={() => setQuoteFor(null)}>Cancel</button>
              <button className="btn btn-primary btn-sm" disabled={saving || !quoteRate} onClick={handleSendQuote}>{saving ? 'Sending…' : 'Send Quote'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Plan */}
      {planFor && (
        <div className="modal-overlay" onClick={() => !saving && setPlanFor(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title"><CreditCard size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />Manage Plan — {planFor.company_name}</span>
              <button className="modal-close" onClick={() => setPlanFor(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Plan</label>
                <select className="form-control" value={planForm.plan} onChange={e => setPlanForm(f => ({ ...f, plan: e.target.value }))}>
                  {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Extend (months)</label>
                  <input type="number" min="1" className="form-control" value={planForm.months} onChange={e => setPlanForm(f => ({ ...f, months: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Enquiry Limit (0 = unlimited)</label>
                  <input type="number" min="0" className="form-control" value={planForm.enquiry_limit} onChange={e => setPlanForm(f => ({ ...f, enquiry_limit: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Amount Paid (₹)</label>
                <input type="number" min="0" className="form-control" placeholder="0" value={planForm.amount_paid} onChange={e => setPlanForm(f => ({ ...f, amount_paid: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" disabled={saving} onClick={() => setPlanFor(null)}>Cancel</button>
              <button className="btn btn-primary btn-sm" disabled={saving} onClick={handlePlan}>{saving ? 'Saving…' : 'Update Plan'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
