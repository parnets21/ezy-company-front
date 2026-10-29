/**
 * RetailerManagement.jsx
 * Admin hub for all retailer app connections.
 *
 * Tabs: Overview | Companies | Orders | Enquiries | Users | Subscriptions
 *       + everything else the retailer app produces:
 *       Sales | Purchases | Expenses | Payments | Invoices | Quotations
 *       Customers | Leads | Follow-ups | Inventory | Dispatch
 *
 * All data comes from /api/retailer/admin/* (retailerAdminVisibilityController),
 * which is Super-Admin gated and scoped to retailer companies only.
 */
import { useState, useEffect, useCallback } from 'react'
import {
  Building2, ShoppingCart, MessageSquare, Users, CreditCard,
  RefreshCw, Search, Eye, CheckCircle, XCircle, AlertCircle,
  X, TrendingUp, ShieldOff, ShieldCheck,
  Wallet, Receipt, Truck, Target,
  IndianRupee, AlertTriangle, ClipboardList, UserCheck,
  MapPin, Phone, Mail, Package, Tag, Clock, FileText, Hash,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { retailerApi } from '../api/retailerApi'

const PAGE_SIZE = 10

// ─── helpers ─────────────────────────────────────────────────
const money   = n => n == null ? '—' : '₹' + Number(n).toLocaleString('en-IN')
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const STATUS_BADGE = {
  Approved: 'badge-green', Active: 'badge-green', Delivered: 'badge-green', Confirmed: 'badge-green',
  Paid: 'badge-green', Received: 'badge-green', Completed: 'badge-green', Done: 'badge-green',
  Converted: 'badge-green', accepted: 'badge-green', Qualified: 'badge-green',
  Pending: 'badge-yellow', New: 'badge-yellow', Viewed: 'badge-yellow', Draft: 'badge-yellow',
  draft: 'badge-yellow', 'Partially Paid': 'badge-yellow', Partial: 'badge-yellow',
  'Follow-up': 'badge-yellow', Interested: 'badge-yellow', Contacted: 'badge-yellow',
  Reserved: 'badge-yellow', Picking: 'badge-yellow', Due: 'badge-yellow', Missed: 'badge-red',
  Rejected: 'badge-red', Suspended: 'badge-red', Cancelled: 'badge-red', cancelled: 'badge-red',
  Overdue: 'badge-red', Lost: 'badge-red', Returned: 'badge-red', Expired: 'badge-red',
  expired: 'badge-red', 'Not Interested': 'badge-gray',
  Dispatched: 'badge-blue', Replied: 'badge-blue', 'In Transit': 'badge-blue', sent: 'badge-blue',
  Packed: 'badge-blue', 'Ready for Dispatch': 'badge-blue',
}
const badge = s => STATUS_BADGE[s] || 'badge-gray'

const PLANS = ['Free', 'Retailer Basic', 'Retailer Pro']

/**
 * Generic admin table.
 *
 * The eleven retailer-data tabs all render the same shape — a search box, a
 * loading/empty state, and a table of columns — so one component keeps them
 * consistent instead of copy-pasting the markup eleven times.
 *   columns = [{ key, header, render?(row), align? }]
 */
function DataTable({ title, searchPlaceholder, search, onSearch, rows, loading, emptyText, columns, note }) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">{title}</span>
        <div className="header-actions">
          <div className="search-bar">
            <Search size={14} />
            <input placeholder={searchPlaceholder} value={search} onChange={e => onSearch(e.target.value)} />
          </div>
        </div>
      </div>
      {note ? <div style={{ padding: '0 18px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{note}</div> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map(c => (
                <th key={c.key} style={c.align ? { textAlign: c.align } : undefined}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={columns.length} style={{ textAlign: 'center', padding: 30 }}>Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                  {emptyText}
                </td>
              </tr>
            )}
            {!loading && rows.map((r, i) => (
              <tr key={r._id || i}>
                {columns.map(c => (
                  <td key={c.key} style={c.tdStyle}>{c.render ? c.render(r) : (r[c.key] ?? '—')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Shared cell renderers
const codeCell  = v => <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#F26522', fontSize: 12 }}>{v || '—'}</span>
const badgeCell = v => <span className={`badge ${badge(v)}`}>{v || '—'}</span>
const moneyCell = v => <span style={{ fontWeight: 700 }}>{money(v)}</span>
const dateCell  = v => <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(v)}</span>

// ── Enquiry detail-modal helpers ──────────────────────────────
// A small section header with an icon, styled like the View-Company modal's
// KYC block label so the detail view reads as a set of grouped field grids.
function SectionLabel({ icon: Icon, text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 18, marginBottom: 10, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)' }}>
      <Icon size={13} style={{ color: '#EA580C' }} />{text}
    </div>
  )
}

// A 2-column grid of label/value pairs. `fields` is an array of [label, value]
// where value may be a string or a React node (badge, money, icon row).
function FieldGrid({ fields }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      {fields.map(([label, val]) => (
        <div key={label}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', wordBreak: 'break-word' }}>{val ?? '—'}</div>
        </div>
      ))}
    </div>
  )
}

// A full-width label/value row for free-text fields (replies, notes, remarks).
function NoteRow({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{
        fontSize: 13, fontWeight: 500, color: value ? 'var(--text)' : 'var(--text-muted)',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        padding: '8px 11px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)',
        minHeight: 34,
      }}>
        {value || '— no notes —'}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// When a `view` prop is passed (from a dedicated route), that single section
// is shown and the in-page tab bar is hidden. Without `view`, the original
// tabbed hub behaviour is kept (back-compat).
export default function RetailerManagement({ view }) {
  const [tab, setTab] = useState(view || 'companies')
  const [page, setPage] = useState(1)

  // Keep the active section in sync with the route-driven `view` prop.
  useEffect(() => { if (view) setTab(view) }, [view])

  const routed = !!view   // true = dedicated page (no tab bar)

  // data
  const [companies,   setCompanies]   = useState([])
  const [orders,      setOrders]      = useState([])
  const [enquiries,   setEnquiries]   = useState([])
  const [users,       setUsers]       = useState([])
  const [subs,        setSubs]        = useState([])
  const [revenue,     setRevenue]     = useState(null)

  // ── Everything else the retailer app produces ──────────────
  const [sales,        setSales]        = useState([])
  const [purchases,    setPurchases]    = useState([])
  const [expenses,     setExpenses]     = useState([])
  const [transactions, setTransactions] = useState([])
  const [invoices,     setInvoices]     = useState([])
  const [quotations,   setQuotations]   = useState([])
  const [customers,    setCustomers]    = useState([])
  const [leads,        setLeads]        = useState([])
  const [followups,    setFollowups]    = useState([])
  const [inventory,    setInventory]    = useState([])
  const [dispatches,   setDispatches]   = useState([])
  const [summary,      setSummary]      = useState(null)

  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  // Labels of the sections whose fetch failed. Surfaced as a banner so an
  // undeployed/renamed endpoint shows up as a clear message instead of a
  // silently empty table.
  const [failed,  setFailed]  = useState([])
  const [search,  setSearch]  = useState('')
  const [toast,   setToast]   = useState({ msg: '', ok: true })

  // modals
  const [viewCompany,    setViewCompany]    = useState(null)
  const [viewEnquiry,    setViewEnquiry]    = useState(null)
  const [rejectFor,      setRejectFor]      = useState(null)
  const [rejectReason,   setRejectReason]   = useState('')
  const [suspendFor,     setSuspendFor]     = useState(null)
  const [suspendReason,  setSuspendReason]  = useState('')
  const [planFor,        setPlanFor]        = useState(null)
  const [planForm,       setPlanForm]       = useState({ plan: 'Free', months: '1', enquiry_limit: '0', amount_paid: '' })
  const [saving,         setSaving]         = useState(false)

  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast({ msg: '', ok: true }), 3500) }

  // ── Load all data ──────────────────────────────────────────
  // Every call goes through `safe()` below, so one failing module (an empty
  // collection, or an endpoint that is not deployed yet) can never blank the
  // whole admin page — it degrades to an empty table plus a named warning.
  const load = useCallback(async () => {
    setLoading(true); setError('')
    const asArray = v => (Array.isArray(v) ? v : [])
    /**
     * Unwrap `{ data: { <key>: rows } }` → rows, tolerating every shape the API
     * has used. **Guaranteed to return an array.**
     *
     * This used to be `res?.data?.[key] || res?.[key] || res?.data || []`, whose
     * final fallback returned `res.data` — an OBJECT whenever the key was absent
     * (e.g. a failed request caught into `{ data: {} }`). The page then crashed
     * on `sales.filter is not a function`, taking the whole admin screen down
     * rather than showing an empty table. Never let this return a non-array.
     */
    const rows = (res, key) => {
      if (!res) return []
      const data = res.data
      if (Array.isArray(data)) return data                    // { data: [...] }
      if (data && Array.isArray(data[key])) return data[key]  // { data: { sales: [...] } }
      if (Array.isArray(res[key])) return res[key]            // { sales: [...] }
      return []
    }
    // Record which sections failed so the user sees a reason, not just empty
    // tables. Most likely cause: the endpoint is not deployed yet (the CRM
    // defaults to the Render backend — see VITE_API_URL in src/api/index.js).
    const failures = []
    const safe = (label, promise) =>
      promise.catch(() => { failures.push(label); return { data: {} } })
    try {
      const [
        c, o, e, u, s, rev, sum,
        sl, pu, ex, tx, iv, qu, cu, ld, fu, inv, di,
      ] = await Promise.all([
        safe('Companies',   retailerApi.listCompanies({ limit: 200 })),
        safe('Orders',      retailerApi.listOrders({ limit: 200 })),
        safe('Enquiries',   retailerApi.listEnquiries({ limit: 200 })),
        safe('Users',       retailerApi.listUsers({ limit: 200 })),
        safe('Subscriptions', retailerApi.listSubscriptions()),
        safe('Revenue',     retailerApi.revenue()),
        safe('Summary',     retailerApi.activitySummary()),
        safe('Sales',       retailerApi.listSales({ limit: 200 })),
        safe('Purchases',   retailerApi.listPurchases({ limit: 200 })),
        safe('Expenses',    retailerApi.listExpenses({ limit: 200 })),
        safe('Payments',    retailerApi.listTransactions({ limit: 200 })),
        safe('Invoices',    retailerApi.listInvoices({ limit: 200 })),
        safe('Quotations',  retailerApi.listQuotations({ limit: 200 })),
        safe('Customers',   retailerApi.listCustomers({ limit: 200 })),
        safe('Leads',       retailerApi.listLeads({ limit: 200 })),
        safe('Follow-ups',  retailerApi.listFollowups({ limit: 200 })),
        safe('Inventory',   retailerApi.listInventory({ limit: 200 })),
        safe('Dispatch',    retailerApi.listDispatches({ limit: 200 })),
      ])
      setFailed(failures)
      setCompanies (rows(c, 'companies'))
      setOrders    (rows(o, 'orders'))
      setEnquiries (rows(e, 'enquiries'))
      setUsers     (rows(u, 'users'))
      setSubs      (asArray(s?.data?.subscriptions ?? s?.subscriptions))
      setRevenue   (rev?.data || rev || null)
      setSummary   (sum?.data || sum || null)
      setSales        (rows(sl,  'sales'))
      setPurchases    (rows(pu,  'purchases'))
      setExpenses     (rows(ex,  'expenses'))
      setTransactions (rows(tx,  'transactions'))
      setInvoices     (rows(iv,  'invoices'))
      setQuotations   (rows(qu,  'quotations'))
      setCustomers    (rows(cu,  'customers'))
      setLeads        (rows(ld,  'leads'))
      setFollowups    (rows(fu,  'followups'))
      setInventory    (rows(inv, 'inventory'))
      setDispatches   (rows(di,  'dispatches'))
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load retailer data.')
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
  const handleApprove = async (id, name) => {
    setSaving(true)
    try {
      await retailerApi.approveCompany(id)
      showToast(`${name} approved.`)
      load()
    } catch (e) { showToast(e?.response?.data?.message || 'Approve failed.', false) }
    finally { setSaving(false) }
  }

  const handleReject = async () => {
    if (!rejectFor) return
    setSaving(true)
    try {
      await retailerApi.rejectCompany(rejectFor.id || rejectFor._id, rejectReason)
      showToast(`${rejectFor.name} rejected.`)
      setRejectFor(null); setRejectReason(''); load()
    } catch (e) { showToast(e?.response?.data?.message || 'Reject failed.', false) }
    finally { setSaving(false) }
  }

  const handleSuspend = async () => {
    if (!suspendFor) return
    setSaving(true)
    try {
      await retailerApi.suspendCompany(suspendFor.id || suspendFor._id, suspendReason)
      showToast(`${suspendFor.name} suspended.`)
      setSuspendFor(null); setSuspendReason(''); load()
    } catch (e) { showToast(e?.response?.data?.message || 'Suspend failed.', false) }
    finally { setSaving(false) }
  }

  const handleReinstate = async (id, name) => {
    setSaving(true)
    try {
      await retailerApi.reinstateCompany(id)
      showToast(`${name} reinstated.`)
      load()
    } catch (e) { showToast(e?.response?.data?.message || 'Reinstate failed.', false) }
    finally { setSaving(false) }
  }

  const handlePlan = async () => {
    if (!planFor) return
    setSaving(true)
    try {
      await retailerApi.setCompanyPlan(planFor.company_id || planFor.id || planFor._id, {
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

  // ── Filtered data ─────────────────────────────────────────
  const q     = search.trim().toLowerCase()
  const match = (...vals) => !q || vals.some(v => (v || '').toLowerCase().includes(q))

  const fCompanies = companies.filter(c => match(c.name, c.owner_name, c.mobile, c.email, c.company_code))
  const fOrders    = orders.filter(o    => match(o.order_code, o.company_name, o.customer_name, o.product_name))
  const fEnquiries = enquiries.filter(e => match(e.enq_code, e.company_name, e.retailer_name, e.retailer_mobile, e.product_name, e.product_code, e.location))
  const fUsers     = users.filter(u     => match(u.name, u.mobile, u.email, u.company_name))
  const fSubs      = subs.filter(s      => match(s.company_name, s.plan, s.company_code))

  const fSales        = sales.filter(r        => match(r.sale_code, r.customer_name, r.product_name, r.company_name, r.invoice_number))
  const fPurchases    = purchases.filter(r    => match(r.purchase_code, r.supplier_name, r.product_name, r.company_name, r.invoice_number))
  const fExpenses     = expenses.filter(r     => match(r.category, r.description, r.reference, r.company_name))
  const fTransactions = transactions.filter(r => match(r.txn_code, r.party_name, r.reference, r.company_name))
  const fInvoices     = invoices.filter(r     => match(r.invoice_no, r.customer_name, r.product_name, r.company_name))
  const fQuotations   = quotations.filter(r   => match(r.quotation_no, r.customer_name, r.product_name, r.company_name))
  const fCustomers    = customers.filter(r    => match(r.name, r.mobile, r.email, r.city, r.gst_number, r.company_name))
  const fLeads        = leads.filter(r        => match(r.name, r.mobile, r.email, r.source, r.company_name))
  const fFollowups    = followups.filter(r    => match(r.notes, r.assigned_to?.name, r.company_name))
  const fInventory    = inventory.filter(r    => match(r.product_id?.name, r.product_id?.code, r.warehouse_id?.name, r.company_name))
  const fDispatches   = dispatches.filter(r   => match(r.dispatch_code, r.customer_name, r.vehicle_number, r.lr_number, r.company_name))

  // ── Stats ─────────────────────────────────────────────────
  // Prefer the aggregated summary (counts EVERY row, not just the first 200
  // fetched for the tables); fall back to the loaded array length.
  const pendingCount   = companies.filter(c => c.status === 'Pending').length
  const approvedCount  = companies.filter(c => c.status === 'Approved').length
  const suspendedCount = companies.filter(c => c.status === 'Suspended').length

  const STATS = [
    { label: 'Total Retailers',   val: summary?.companies ?? companies.length, icon: Building2,     color: '#7C3AED', bg: '#F5F3FF' },
    { label: 'Pending Approval',  val: pendingCount,      icon: AlertCircle,   color: '#D97706', bg: '#FFFBEB' },
    { label: 'Approved',          val: approvedCount,     icon: CheckCircle,   color: '#059669', bg: '#ECFDF5' },
    { label: 'Suspended',         val: suspendedCount,    icon: ShieldOff,     color: '#DC2626', bg: '#FEF2F2' },
    { label: 'Total Sales',       val: money(summary?.sales?.total),     icon: TrendingUp,   color: '#059669', bg: '#ECFDF5' },
    { label: 'Purchases',         val: money(summary?.purchases?.total), icon: ShoppingCart, color: '#2563EB', bg: '#EFF6FF' },
    { label: 'Expenses',          val: money(summary?.expenses?.total),  icon: Wallet,       color: '#DC2626', bg: '#FEF2F2' },
    { label: 'Receivable Due',    val: money(summary?.receivable_due),   icon: IndianRupee,  color: '#D97706', bg: '#FFFBEB' },
    { label: 'Payable Due',       val: money(summary?.payable_due),      icon: IndianRupee,  color: '#EA580C', bg: '#FFF7ED' },
    { label: 'Orders',            val: summary?.orders ?? orders.length,       icon: ClipboardList, color: '#2563EB', bg: '#EFF6FF' },
    { label: 'Enquiries',         val: summary?.enquiries ?? enquiries.length, icon: MessageSquare, color: '#EA580C', bg: '#FFF7ED' },
    { label: 'Dispatches',        val: summary?.dispatches ?? dispatches.length, icon: Truck,      color: '#7C3AED', bg: '#F5F3FF' },
    { label: 'Customers',         val: summary?.customers ?? customers.length, icon: UserCheck,   color: '#0891B2', bg: '#ECFEFF' },
    { label: 'Leads',             val: summary?.leads ?? leads.length,         icon: Target,      color: '#DB2777', bg: '#FDF2F8' },
    { label: 'Invoices',          val: summary?.invoices ?? invoices.length,   icon: Receipt,     color: '#4F46E5', bg: '#EEF2FF' },
    { label: 'Users',             val: summary?.users ?? users.length,         icon: Users,       color: '#0891B2', bg: '#ECFEFF' },
    { label: 'Platform Revenue',  val: money(revenue?.total_revenue),          icon: CreditCard,  color: '#059669', bg: '#ECFDF5' },
  ]

  // Low-stock / out-of-stock alerts surfaced straight from the summary.
  const stockAlerts = (summary?.low_stock || 0) + (summary?.out_of_stock || 0)

  const TABS = [
    { key: 'overview',     label: 'Overview' },
    { key: 'companies',    label: `Companies (${companies.length})` },
    { key: 'orders',       label: `Orders (${orders.length})` },
    { key: 'enquiries',    label: `Enquiries (${enquiries.length})` },
    { key: 'sales',        label: `Sales (${sales.length})` },
    { key: 'purchases',    label: `Purchases (${purchases.length})` },
    { key: 'expenses',     label: `Expenses (${expenses.length})` },
    { key: 'transactions', label: `Payments (${transactions.length})` },
    { key: 'invoices',     label: `Invoices (${invoices.length})` },
    { key: 'quotations',   label: `Quotations (${quotations.length})` },
    { key: 'customers',    label: `Customers (${customers.length})` },
    { key: 'leads',        label: `Leads (${leads.length})` },
    { key: 'followups',    label: `Follow-ups (${followups.length})` },
    { key: 'inventory',    label: `Inventory (${inventory.length})` },
    { key: 'dispatches',   label: `Dispatch (${dispatches.length})` },
    { key: 'users',        label: `Users (${users.length})` },
    { key: 'subs',         label: `Subscriptions (${subs.length})` },
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
          <div className="page-title">{routed ? `Retailer ${(TABS.find(t => t.key === tab)?.label || '').replace(/\s*\(\d+\)$/, '')}` : 'Retailer Management'}</div>
          <div className="page-desc">Manage retailer app registrations, approvals, orders and subscriptions</div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-warning" style={{ marginBottom: 14 }}><AlertCircle size={15} style={{ marginRight: 8 }} />{error}</div>}

      {/* Partial-load notice. Without this, a 404 from an endpoint that has not
          been deployed yet looks identical to "this retailer has no data". */}
      {!loading && failed.length > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: 14 }}>
          <AlertCircle size={15} style={{ marginRight: 8, flexShrink: 0 }} />
          <span>
            {failed.length} section{failed.length > 1 ? 's' : ''} failed to load
            ({failed.join(', ')}). The tables below are empty because the request
            failed, not because there is no data — check that the backend is
            deployed and running the latest routes.
          </span>
        </div>
      )}

      {/* ── Tabs (only in the legacy hub view; hidden on dedicated pages) ── */}
      {!routed && (
        <div className="tabs" style={{ marginBottom: 18, flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t.key} className={`tab-btn${tab === t.key ? ' active' : ''}`} onClick={() => { setTab(t.key); setSearch('') }}>
              {t.label}
              {t.key === 'companies' && pendingCount > 0 && (
                <span style={{ marginLeft: 6, background: '#DC2626', color: '#fff', borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 800 }}>{pendingCount}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ══ OVERVIEW ══════════════════════════════════════════ */}
      {tab === 'overview' && (
        <>
          {/* Stats grid — auto-fill so 17 cards lay out cleanly at any width */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14, marginBottom: 20 }}>
            {STATS.map(({ label, val, icon: Icon, color, bg }) => (
              <div key={label} style={{ background: bg, borderRadius: 14, padding: '16px 20px', border: `1px solid ${color}22`, display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={20} color={color} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color, marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{val}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Stock alerts pulled straight from the aggregated summary */}
          {stockAlerts > 0 && (
            <div className="alert alert-warning" style={{ marginBottom: 16 }}>
              <AlertTriangle size={15} style={{ marginRight: 8 }} />
              <strong>{summary?.low_stock || 0}</strong> low-stock and <strong>{summary?.out_of_stock || 0}</strong> out-of-stock
              item(s) across all retailer companies.
              <button className="btn btn-sm btn-secondary" style={{ marginLeft: 12 }} onClick={() => { setTab('inventory'); setSearch('') }}>
                View inventory
              </button>
            </div>
          )}

          {/* Pending approvals */}
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                Pending Approvals
                {pendingCount > 0 && <span style={{ background: '#DC2626', color: '#fff', borderRadius: 20, padding: '1px 9px', fontSize: 11, fontWeight: 800 }}>{pendingCount}</span>}
              </span>
              <button className="btn btn-secondary btn-sm" onClick={() => setTab('companies')}>View All Companies</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Company</th><th>Owner</th><th>Mobile</th><th>Email</th><th>Biz Type</th><th>Registered</th><th style={{ textAlign: 'center' }}>Actions</th></tr></thead>
                <tbody>
                  {loading && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30 }}>Loading…</td></tr>}
                  {!loading && companies.filter(c => c.status === 'Pending').length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                      <CheckCircle size={20} color="#059669" style={{ marginBottom: 6, display: 'block', margin: '0 auto 6px' }} />
                      No pending approvals — you're all caught up!
                    </td></tr>
                  )}
                  {!loading && companies.filter(c => c.status === 'Pending').slice(0, 10).map(c => (
                    <tr key={c._id || c.id}>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{c.company_code}</div>
                      </td>
                      <td>{c.owner_name}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{c.mobile}</td>
                      <td style={{ fontSize: 12 }}>{c.email}</td>
                      <td>{c.biz_type || 'Retailer'}</td>
                      <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(c.created_at)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button className="btn btn-sm btn-primary" style={{ background: '#059669', fontSize: 11 }} disabled={saving}
                            onClick={() => handleApprove(c._id || c.id, c.name)}>
                            <CheckCircle size={12} /> Approve
                          </button>
                          <button className="btn btn-sm btn-danger" style={{ fontSize: 11 }}
                            onClick={() => { setRejectFor(c); setRejectReason('') }}>
                            <XCircle size={12} /> Reject
                          </button>
                          <button className="btn btn-sm btn-secondary" style={{ fontSize: 11 }}
                            onClick={() => setViewCompany(c)}>
                            <Eye size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ══ COMPANIES ═════════════════════════════════════════ */}
      {tab === 'companies' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">All Retailer Companies</span>
            <div className="header-actions">
              <div className="search-bar"><Search size={14} /><input placeholder="Search companies…" value={search} onChange={e => setSearch(e.target.value)} /></div>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Company</th><th>Owner</th><th>Mobile</th><th>Email</th>
                  <th>GST</th><th>Status</th><th>Registered</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 30 }}>Loading…</td></tr>}
                {!loading && fCompanies.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No retailer companies found.</td></tr>
                )}
                {!loading && pageSlice(fCompanies).map(c => (
                  <tr key={c._id || c.id}>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{c.company_code}</div>
                    </td>
                    <td>{c.owner_name}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{c.mobile}</td>
                    <td style={{ fontSize: 12 }}>{c.email}</td>
                    <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{c.gst_number || '—'}</td>
                    <td><span className={`badge ${badge(c.status)}`}>{c.status}</span></td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(c.created_at)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 5, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button className="btn btn-sm btn-secondary" title="View" onClick={() => setViewCompany(c)}><Eye size={12} /></button>
                        {c.status === 'Pending' && <>
                          <button className="btn btn-sm btn-primary" style={{ background: '#059669', fontSize: 11 }} disabled={saving}
                            onClick={() => handleApprove(c._id || c.id, c.name)}>
                            <CheckCircle size={12} /> Approve
                          </button>
                          <button className="btn btn-sm btn-danger" style={{ fontSize: 11 }}
                            onClick={() => { setRejectFor(c); setRejectReason('') }}>
                            <XCircle size={12} /> Reject
                          </button>
                        </>}
                        {c.status === 'Approved' && (
                          <button className="btn btn-sm btn-secondary" style={{ fontSize: 11, color: '#DC2626' }}
                            onClick={() => { setSuspendFor(c); setSuspendReason('') }}>
                            <ShieldOff size={12} /> Suspend
                          </button>
                        )}
                        {c.status === 'Suspended' && (
                          <button className="btn btn-sm btn-primary" style={{ fontSize: 11, background: '#059669' }} disabled={saving}
                            onClick={() => handleReinstate(c._id || c.id, c.name)}>
                            <ShieldCheck size={12} /> Reinstate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager total={fCompanies.length} />
        </div>
      )}

      {/* ══ ORDERS ════════════════════════════════════════════ */}
      {tab === 'orders' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">All Retailer Orders</span>
            <div className="header-actions">
              <div className="search-bar"><Search size={14} /><input placeholder="Search orders…" value={search} onChange={e => setSearch(e.target.value)} /></div>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Code</th><th>Company</th><th>Customer</th><th>Product</th><th>Qty</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 30 }}>Loading…</td></tr>}
                {!loading && fOrders.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No orders found.</td></tr>}
                {!loading && pageSlice(fOrders).map((o, i) => (
                  <tr key={o._id || i}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#F26522', fontSize: 12 }}>{o.order_code || '—'}</td>
                    <td>{o.company_name || '—'}</td>
                    <td>{o.customer_name || '—'}</td>
                    <td style={{ fontWeight: 600 }}>{o.product_name || '—'}</td>
                    <td>{o.qty || '—'}</td>
                    <td style={{ fontWeight: 700 }}>{money(o.total_amount)}</td>
                    <td><span className={`badge ${badge(o.status)}`}>{o.status}</span></td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(o.created_at)}</td>
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
            <span className="card-title">All Retailer Enquiries</span>
            <div className="header-actions">
              <div className="search-bar"><Search size={14} /><input placeholder="Search enquiries…" value={search} onChange={e => setSearch(e.target.value)} /></div>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Company</th>
                  <th>Retailer</th>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Offered Price</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 30 }}>Loading…</td></tr>}
                {!loading && fEnquiries.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No enquiries found.</td></tr>}
                {!loading && pageSlice(fEnquiries).map((e, i) => (
                  <tr key={e._id || i} style={{ cursor: 'pointer' }} onClick={() => setViewEnquiry(e)}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#F26522', fontSize: 12 }}>{e.enq_code || '—'}</td>
                    <td>{e.company_name || '—'}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{e.retailer_name || '—'}</div>
                      {e.retailer_mobile && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.retailer_mobile}</div>}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{e.product_name || '—'}</div>
                      {e.product_code && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{e.product_code}</div>}
                    </td>
                    <td>{e.qty} {e.unit || ''}</td>
                    <td>{e.offered_price != null ? <span style={{ fontWeight: 700 }}>₹{Number(e.offered_price).toLocaleString('en-IN')}</span> : '—'}</td>
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
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn btn-secondary btn-sm" title="View details" onClick={(ev) => { ev.stopPropagation(); setViewEnquiry(e) }}>
                        <Eye size={13} style={{ verticalAlign: 'middle' }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager total={fEnquiries.length} />
        </div>
      )}

      {/* ══ SALES (ERP) ═══════════════════════════════════════ */}
      {tab === 'sales' && (
        <DataTable
          title="Retailer Sales" searchPlaceholder="Search sales…"
          search={search} onSearch={setSearch}
          rows={pageSlice(fSales)} loading={loading} emptyText="No sales recorded by any retailer yet."
          columns={[
            { key: 'sale_code',     header: 'Code',     render: r => codeCell(r.sale_code) },
            { key: 'company_name',  header: 'Company' },
            { key: 'customer_name', header: 'Customer' },
            { key: 'product_name',  header: 'Product',  render: r => <span style={{ fontWeight: 600 }}>{r.product_name || '—'}</span> },
            { key: 'qty',           header: 'Qty' },
            { key: 'total_amount',  header: 'Total',    render: r => moneyCell(r.total_amount) },
            { key: 'sale_status',   header: 'Status',   render: r => badgeCell(r.sale_status) },
            { key: 'sale_date',     header: 'Date',     render: r => dateCell(r.sale_date || r.created_at) },
          ]}
        />
      )}
      {tab === 'sales' && <Pager total={fSales.length} />}

      {/* ══ PURCHASES (ERP) ═══════════════════════════════════ */}
      {tab === 'purchases' && (
        <DataTable
          title="Retailer Purchases" searchPlaceholder="Search purchases…"
          search={search} onSearch={setSearch}
          rows={pageSlice(fPurchases)} loading={loading} emptyText="No purchases recorded yet."
          columns={[
            { key: 'purchase_code', header: 'Code',     render: r => codeCell(r.purchase_code) },
            { key: 'company_name',  header: 'Company' },
            { key: 'supplier_name', header: 'Supplier' },
            { key: 'product_name',  header: 'Product',  render: r => <span style={{ fontWeight: 600 }}>{r.product_name || '—'}</span> },
            { key: 'qty',           header: 'Qty' },
            { key: 'total_amount',  header: 'Total',    render: r => moneyCell(r.total_amount) },
            { key: 'status',        header: 'Status',   render: r => badgeCell(r.status) },
            { key: 'purchase_date', header: 'Date',     render: r => dateCell(r.purchase_date || r.created_at) },
          ]}
        />
      )}
      {tab === 'purchases' && <Pager total={fPurchases.length} />}

      {/* ══ EXPENSES ══════════════════════════════════════════ */}
      {tab === 'expenses' && (
        <DataTable
          title="Retailer Expenses" searchPlaceholder="Search expenses…"
          search={search} onSearch={setSearch}
          rows={pageSlice(fExpenses)} loading={loading} emptyText="No expenses recorded yet."
          note={`Total across all retailers: ${money(summary?.expenses?.total)} (${summary?.expenses?.count ?? expenses.length} entries)`}
          columns={[
            { key: 'company_name',  header: 'Company' },
            { key: 'category',      header: 'Category', render: r => <span style={{ fontWeight: 600 }}>{r.category || '—'}</span> },
            { key: 'description',   header: 'Description', render: r => <span style={{ fontSize: 12 }}>{r.description || '—'}</span> },
            { key: 'amount',        header: 'Amount',   render: r => <span style={{ fontWeight: 700, color: '#DC2626' }}>{money(r.amount)}</span> },
            { key: 'payment_mode',  header: 'Mode' },
            { key: 'expense_date',  header: 'Date',     render: r => dateCell(r.expense_date || r.created_at) },
          ]}
        />
      )}
      {tab === 'expenses' && <Pager total={fExpenses.length} />}

      {/* ══ PAYMENTS / TRANSACTIONS ═══════════════════════════ */}
      {tab === 'transactions' && (
        <DataTable
          title="Retailer Payments" searchPlaceholder="Search payments…"
          search={search} onSearch={setSearch}
          rows={pageSlice(fTransactions)} loading={loading} emptyText="No payments recorded yet."
          note={`Receivable due ${money(summary?.receivable_due)} · Payable due ${money(summary?.payable_due)}`}
          columns={[
            { key: 'txn_code',     header: 'Code',   render: r => codeCell(r.txn_code) },
            { key: 'company_name', header: 'Company' },
            { key: 'type',         header: 'Type',   render: r => <span className={`badge ${r.type === 'Received' ? 'badge-green' : 'badge-blue'}`}>{r.type}</span> },
            { key: 'party_name',   header: 'Party' },
            { key: 'amount',       header: 'Amount', render: r => moneyCell(r.amount) },
            { key: 'mode',         header: 'Mode' },
            { key: 'reference',    header: 'Reference', render: r => <span style={{ fontSize: 12 }}>{r.reference || '—'}</span> },
            { key: 'txn_date',     header: 'Date',   render: r => dateCell(r.txn_date || r.created_at) },
          ]}
        />
      )}
      {tab === 'transactions' && <Pager total={fTransactions.length} />}

      {/* ══ INVOICES ══════════════════════════════════════════ */}
      {tab === 'invoices' && (
        <DataTable
          title="Retailer Invoices" searchPlaceholder="Search invoices…"
          search={search} onSearch={setSearch}
          rows={pageSlice(fInvoices)} loading={loading} emptyText="No invoices yet."
          columns={[
            { key: 'invoice_no',    header: 'Invoice',  render: r => codeCell(r.invoice_no) },
            { key: 'company_name',  header: 'Company' },
            { key: 'customer_name', header: 'Customer' },
            { key: 'product_name',  header: 'Product',  render: r => <span style={{ fontWeight: 600 }}>{r.product_name || '—'}</span> },
            { key: 'grand_total',   header: 'Total',    render: r => moneyCell(r.grand_total) },
            { key: 'payment_status', header: 'Payment', render: r => badgeCell(r.payment_status) },
            { key: 'status',        header: 'Status',   render: r => badgeCell(r.status) },
            { key: 'created_at',    header: 'Date',     render: r => dateCell(r.created_at) },
          ]}
        />
      )}
      {tab === 'invoices' && <Pager total={fInvoices.length} />}

      {/* ══ QUOTATIONS ════════════════════════════════════════ */}
      {tab === 'quotations' && (
        <DataTable
          title="Retailer Quotations" searchPlaceholder="Search quotations…"
          search={search} onSearch={setSearch}
          rows={pageSlice(fQuotations)} loading={loading} emptyText="No quotations yet."
          columns={[
            { key: 'quotation_no',  header: 'Quote',    render: r => codeCell(r.quotation_no) },
            { key: 'company_name',  header: 'Company' },
            { key: 'customer_name', header: 'Customer' },
            { key: 'product_name',  header: 'Product',  render: r => <span style={{ fontWeight: 600 }}>{r.product_name || '—'}</span> },
            { key: 'qty',           header: 'Qty' },
            { key: 'total',         header: 'Total',    render: r => moneyCell(r.total) },
            { key: 'status',        header: 'Status',   render: r => badgeCell(r.status) },
            { key: 'created_at',    header: 'Date',     render: r => dateCell(r.created_at) },
          ]}
        />
      )}
      {tab === 'quotations' && <Pager total={fQuotations.length} />}

      {/* ══ CUSTOMERS ═════════════════════════════════════════ */}
      {tab === 'customers' && (
        <DataTable
          title="Retailer Customers" searchPlaceholder="Search customers…"
          search={search} onSearch={setSearch}
          rows={pageSlice(fCustomers)} loading={loading} emptyText="No customers added yet."
          columns={[
            { key: 'name',         header: 'Name',    render: r => <span style={{ fontWeight: 700 }}>{r.name || '—'}</span> },
            { key: 'company_name', header: 'Company' },
            { key: 'mobile',       header: 'Mobile',  render: r => <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{r.mobile || '—'}</span> },
            { key: 'city',         header: 'City' },
            { key: 'biz_type',     header: 'Type' },
            { key: 'gst_number',   header: 'GSTIN',   render: r => <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{r.gst_number || '—'}</span> },
            { key: 'credit_limit', header: 'Credit',  render: r => moneyCell(r.credit_limit) },
            { key: 'created_at',   header: 'Added',   render: r => dateCell(r.created_at) },
          ]}
        />
      )}
      {tab === 'customers' && <Pager total={fCustomers.length} />}

      {/* ══ LEADS ═════════════════════════════════════════════ */}
      {tab === 'leads' && (
        <DataTable
          title="Retailer Leads" searchPlaceholder="Search leads…"
          search={search} onSearch={setSearch}
          rows={pageSlice(fLeads)} loading={loading} emptyText="No leads yet."
          columns={[
            { key: 'name',         header: 'Name',    render: r => <span style={{ fontWeight: 700 }}>{r.name || '—'}</span> },
            { key: 'company_name', header: 'Company' },
            { key: 'mobile',       header: 'Mobile',  render: r => <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{r.mobile || '—'}</span> },
            { key: 'source',       header: 'Source',  render: r => <span style={{ fontSize: 12 }}>{r.source || '—'}</span> },
            { key: 'status',       header: 'Status',  render: r => badgeCell(r.status) },
            { key: 'assigned_to',  header: 'Assigned', render: r => r.assigned_to?.name || 'Unassigned' },
            { key: 'created_at',   header: 'Created', render: r => dateCell(r.created_at) },
          ]}
        />
      )}
      {tab === 'leads' && <Pager total={fLeads.length} />}

      {/* ══ FOLLOW-UPS ════════════════════════════════════════ */}
      {tab === 'followups' && (
        <DataTable
          title="Retailer Follow-ups" searchPlaceholder="Search follow-ups…"
          search={search} onSearch={setSearch}
          rows={pageSlice(fFollowups)} loading={loading} emptyText="No follow-ups scheduled."
          columns={[
            { key: 'company_name',  header: 'Company' },
            { key: 'notes',         header: 'Notes',   render: r => <span style={{ fontSize: 12 }}>{r.notes || '—'}</span> },
            { key: 'followup_date', header: 'Due',     render: r => dateCell(r.followup_date) },
            { key: 'status',        header: 'Status',  render: r => badgeCell(r.status) },
            { key: 'assigned_to',   header: 'Assigned', render: r => r.assigned_to?.name || 'Unassigned' },
            { key: 'done_at',       header: 'Done',    render: r => dateCell(r.done_at) },
          ]}
        />
      )}
      {tab === 'followups' && <Pager total={fFollowups.length} />}

      {/* ══ INVENTORY ═════════════════════════════════════════ */}
      {tab === 'inventory' && (
        <DataTable
          title="Retailer Inventory" searchPlaceholder="Search by product or warehouse…"
          search={search} onSearch={setSearch}
          rows={pageSlice(fInventory)} loading={loading} emptyText="No stock records yet."
          note={stockAlerts > 0
            ? `⚠ ${summary?.low_stock || 0} low-stock and ${summary?.out_of_stock || 0} out-of-stock item(s) across all retailers.`
            : 'All stock levels healthy.'}
          columns={[
            { key: 'product',      header: 'Product',  render: r => <span style={{ fontWeight: 700 }}>{r.product_id?.name || '—'}</span> },
            { key: 'code',         header: 'Code',     render: r => codeCell(r.product_id?.code) },
            { key: 'company_name', header: 'Company' },
            { key: 'warehouse',    header: 'Warehouse', render: r => r.warehouse_id?.name || '—' },
            { key: 'available_stock', header: 'Available', render: r => <span style={{ fontWeight: 700, color: (r.available_stock || 0) <= 0 ? '#DC2626' : '#059669' }}>{r.available_stock ?? 0}</span> },
            { key: 'current_stock',   header: 'Physical' },
            { key: 'reserved_stock',  header: 'Reserved' },
            { key: 'low_stock_alert', header: 'Alert @' },
          ]}
        />
      )}
      {tab === 'inventory' && <Pager total={fInventory.length} />}

      {/* ══ DISPATCH ══════════════════════════════════════════ */}
      {tab === 'dispatches' && (
        <DataTable
          title="Retailer Dispatches" searchPlaceholder="Search dispatches…"
          search={search} onSearch={setSearch}
          rows={pageSlice(fDispatches)} loading={loading} emptyText="No dispatches yet."
          columns={[
            { key: 'dispatch_code',  header: 'Code',     render: r => codeCell(r.dispatch_code) },
            { key: 'company_name',   header: 'Company' },
            { key: 'customer_name',  header: 'Customer' },
            { key: 'vehicle_number', header: 'Vehicle',  render: r => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.vehicle_number || '—'}</span> },
            { key: 'lr_number',      header: 'LR No.',   render: r => <span style={{ fontSize: 12 }}>{r.lr_number || '—'}</span> },
            { key: 'qty',            header: 'Qty' },
            { key: 'status',         header: 'Status',   render: r => badgeCell(r.status) },
            { key: 'dispatch_date',  header: 'Dispatched', render: r => dateCell(r.dispatch_date || r.created_at) },
          ]}
        />
      )}
      {tab === 'dispatches' && <Pager total={fDispatches.length} />}

      {/* ══ USERS ═════════════════════════════════════════════ */}
      {tab === 'users' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Retailer App Users</span>
            <div className="header-actions">
              <div className="search-bar"><Search size={14} /><input placeholder="Search users…" value={search} onChange={e => setSearch(e.target.value)} /></div>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Company</th><th>Mobile</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30 }}>Loading…</td></tr>}
                {!loading && fUsers.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No users found.</td></tr>}
                {!loading && pageSlice(fUsers).map((u, i) => (
                  <tr key={u._id || i}>
                    <td style={{ fontWeight: 600 }}>{u.name}</td>
                    <td>{u.company_name || '—'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{u.mobile || '—'}</td>
                    <td style={{ fontSize: 12 }}>{u.email || '—'}</td>
                    <td>{u.role || 'Retailer'}</td>
                    <td><span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
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
            <span className="card-title">Retailer Subscriptions</span>
            <div className="header-actions">
              <div className="search-bar"><Search size={14} /><input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} /></div>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Company</th><th>Plan</th><th>Enquiries</th><th>Expires</th><th>Last Paid</th><th>Status</th><th style={{ textAlign: 'center' }}>Action</th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30 }}>Loading…</td></tr>}
                {!loading && fSubs.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No subscriptions found.</td></tr>}
                {!loading && pageSlice(fSubs).map(s => (
                  <tr key={s.company_id}>
                    <td style={{ fontWeight: 600 }}>{s.company_name}</td>
                    <td><span className="badge badge-blue">{s.plan}</span></td>
                    <td>{s.enquiry_limit > 0 ? `${s.enquiries_used}/${s.enquiry_limit}` : `${s.enquiries_used} (unlimited)`}</td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(s.expires_at)}</td>
                    <td>{money(s.last_amount)}</td>
                    <td><span className={`badge ${badge(s.status)}`}>{s.status}</span></td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn btn-sm btn-primary"
                        onClick={() => { setPlanFor(s); setPlanForm({ plan: s.plan || 'Free', months: '1', enquiry_limit: String(s.enquiry_limit || 0), amount_paid: '' }) }}>
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

      {/* View Company */}
      {viewCompany && (
        <div className="modal-overlay" onClick={() => setViewCompany(null)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title"><Building2 size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />{viewCompany.name}</span>
              <button className="modal-close" onClick={() => setViewCompany(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {[
                  ['Company Code',    viewCompany.company_code],
                  ['Owner',          viewCompany.owner_name],
                  ['Mobile',         viewCompany.mobile],
                  ['Email',          viewCompany.email],
                  ['Business Type',  viewCompany.biz_type],
                  ['GST Number',     viewCompany.gst_number],
                  ['PAN Number',     viewCompany.pan_number],
                  ['Status',         viewCompany.status],
                  ['Address',        viewCompany.address],
                  ['City / State',   [viewCompany.city, viewCompany.state].filter(Boolean).join(', ')],
                  ['Pincode',        viewCompany.pin_code],
                  ['Registered',     fmtDate(viewCompany.created_at)],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', wordBreak: 'break-word' }}>{val || '—'}</div>
                  </div>
                ))}
              </div>

              {/* KYC docs status */}
              <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: 8 }}>KYC Documents</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {[['GST', viewCompany.docs_gst], ['PAN', viewCompany.docs_pan], ['Address', viewCompany.docs_address], ['Business', viewCompany.docs_biz]].map(([label, ok]) => (
                    <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: ok ? '#ECFDF5' : '#FEF2F2', color: ok ? '#059669' : '#DC2626', border: `1px solid ${ok ? '#A7F3D0' : '#FECACA'}` }}>
                      {ok ? <CheckCircle size={11} /> : <XCircle size={11} />}{label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setViewCompany(null)}>Close</button>
              {viewCompany.status === 'Pending' && (
                <>
                  <button className="btn btn-primary btn-sm" style={{ background: '#059669' }} disabled={saving}
                    onClick={() => { handleApprove(viewCompany._id || viewCompany.id, viewCompany.name); setViewCompany(null) }}>
                    <CheckCircle size={13} style={{ marginRight: 4 }} />Approve
                  </button>
                  <button className="btn btn-danger btn-sm"
                    onClick={() => { setRejectFor(viewCompany); setViewCompany(null); setRejectReason('') }}>
                    <XCircle size={13} style={{ marginRight: 4 }} />Reject
                  </button>
                </>
              )}
              {viewCompany.status === 'Approved' && (
                <button className="btn btn-secondary btn-sm" style={{ color: '#DC2626' }}
                  onClick={() => { setSuspendFor(viewCompany); setViewCompany(null); setSuspendReason('') }}>
                  <ShieldOff size={13} style={{ marginRight: 4 }} />Suspend
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject Company */}
      {rejectFor && (
        <div className="modal-overlay" onClick={() => !saving && setRejectFor(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title"><XCircle size={15} style={{ marginRight: 6, verticalAlign: 'middle', color: '#DC2626' }} />Reject — {rejectFor.name}</span>
              <button className="modal-close" onClick={() => setRejectFor(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Reason (optional)</label>
                <textarea className="form-control" rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="e.g. Incomplete documents" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" disabled={saving} onClick={() => setRejectFor(null)}>Cancel</button>
              <button className="btn btn-danger btn-sm" disabled={saving} onClick={handleReject}>{saving ? 'Rejecting…' : 'Reject'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Company */}
      {suspendFor && (
        <div className="modal-overlay" onClick={() => !saving && setSuspendFor(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title"><ShieldOff size={15} style={{ marginRight: 6, verticalAlign: 'middle', color: '#DC2626' }} />Suspend — {suspendFor.name}</span>
              <button className="modal-close" onClick={() => setSuspendFor(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Reason <span style={{ color: '#DC2626' }}>*</span></label>
                <textarea className="form-control" rows={3} value={suspendReason} onChange={e => setSuspendReason(e.target.value)} placeholder="e.g. Policy violation" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" disabled={saving} onClick={() => setSuspendFor(null)}>Cancel</button>
              <button className="btn btn-danger btn-sm" disabled={saving || !suspendReason.trim()} onClick={handleSuspend}>{saving ? 'Suspending…' : 'Suspend'}</button>
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

      {/* ══ Enquiry Detail ═════════════════════════════════════ */}
      {viewEnquiry && (
        <div className="modal-overlay" onClick={() => setViewEnquiry(null)}>
          <div className="modal" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">
                <MessageSquare size={15} style={{ marginRight: 6, verticalAlign: 'middle', color: '#EA580C' }} />
                Enquiry {viewEnquiry.enq_code ? <span style={{ fontFamily: 'monospace', color: '#F26522' }}>{viewEnquiry.enq_code}</span> : ''}
              </span>
              <button className="modal-close" onClick={() => setViewEnquiry(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">

              {/* Status + broadcast banner */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
                <span className={`badge ${badge(viewEnquiry.status)}`} style={{ fontSize: 12, padding: '5px 12px' }}>{viewEnquiry.status || '—'}</span>
                {viewEnquiry.company_name && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE' }}>
                    <Building2 size={11} />{viewEnquiry.company_name}
                  </span>
                )}
              </div>

              {/* Section: Enquiry Info */}
              <SectionLabel icon={Hash} text="Enquiry Information" />
              <FieldGrid fields={[
                ['Enquiry Code',   <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#F26522' }}>{viewEnquiry.enq_code || '—'}</span>],
                ['Status',         <span className={`badge ${badge(viewEnquiry.status)}`}>{viewEnquiry.status}</span>],
                ['Created',        fmtDate(viewEnquiry.created_at)],
                ['Last Updated',   fmtDate(viewEnquiry.updated_at)],
              ]} />

              {/* Section: Retailer / Buyer */}
              <SectionLabel icon={UserCheck} text="Retailer / Buyer Details" />
              <FieldGrid fields={[
                ['Retailer Name',  viewEnquiry.retailer_name],
                ['Mobile',         viewEnquiry.retailer_mobile ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Phone size={11} />{viewEnquiry.retailer_mobile}</span> : '—'],
                ['Email',          viewEnquiry.retailer_email ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Mail size={11} />{viewEnquiry.retailer_email}</span> : '—'],
                ['Location',       viewEnquiry.location ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MapPin size={11} />{viewEnquiry.location}</span> : '—'],
                ['Owning Company', viewEnquiry.company_name],
              ]} />

              {/* Section: Product & Pricing */}
              <SectionLabel icon={Package} text="Product & Pricing" />
              <FieldGrid fields={[
                ['Product Name',   <span style={{ fontWeight: 700 }}>{viewEnquiry.product_name || '—'}</span>],
                ['Product Code',   viewEnquiry.product_code ? <span style={{ fontFamily: 'monospace' }}>{viewEnquiry.product_code}</span> : '—'],
                ['Quantity',       viewEnquiry.qty != null ? `${viewEnquiry.qty} ${viewEnquiry.unit || ''}` : '—'],
                ['Offered Price',  viewEnquiry.offered_price != null ? <span style={{ fontWeight: 700, color: '#059669' }}>₹{Number(viewEnquiry.offered_price).toLocaleString('en-IN')}</span> : '—'],
                ['Available Qty',  viewEnquiry.available_quantity != null ? `${viewEnquiry.available_quantity} ${viewEnquiry.unit || ''}` : '—'],
                ['Delivery Timeline', viewEnquiry.delivery_timeline || '—'],
              ]} />

              {/* Section: Replies roster — who answered, and who is still silent */}
              {(() => {
                const replied  = viewEnquiry.replies?.replied  || []
                const awaiting = viewEnquiry.replies?.awaiting || []
                const isBroadcast = (viewEnquiry.recipient_count || 1) > 1 || replied.length + awaiting.length > 1
                // Single-recipient enquiry: keep the simple notes view.
                if (!isBroadcast) {
                  return (
                    <>
                      <SectionLabel icon={FileText} text="Negotiation & Notes" />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <NoteRow label="Distributor Reply"  value={viewEnquiry.distributor_reply} />
                        <NoteRow label="Negotiation Note"   value={viewEnquiry.negotiation_note} />
                        <NoteRow label="Remarks"            value={viewEnquiry.remarks} />
                      </div>
                    </>
                  )
                }
                return (
                  <>
                    <SectionLabel icon={MessageSquare} text="Replies" />
                    {replied.length === 0 && (
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>No wholesaler has replied yet.</div>
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
    </>
  )
}
