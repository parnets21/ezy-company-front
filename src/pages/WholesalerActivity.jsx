import { useState, useEffect, useCallback } from 'react'
import {
  ShoppingCart, MessageSquare, Users, ArrowLeftRight, RefreshCw, Search,
  AlertCircle, Building2, CreditCard, X, TrendingUp,
} from 'lucide-react'
import { wholesalerApi } from '../api/wholesalerApi'

const PLANS = ['Free', 'Basic', 'Standard', 'Premium', 'Enterprise']

const money = (n) => (n == null || n === '' ? '—' : '₹' + Number(n).toLocaleString('en-IN'))
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')

const statusColor = (s) => {
  switch (s) {
    case 'Delivered': case 'Confirmed': case 'Received': return 'badge-green'
    case 'Dispatched': case 'Replied':  case 'Approved': return 'badge-blue'
    case 'New': case 'Pending': case 'Viewed':           return 'badge-yellow'
    case 'Cancelled': case 'Rejected':                   return 'badge-red'
    default:                                             return 'badge-gray'
  }
}

export default function WholesalerActivity() {
  const [tab, setTab] = useState('orders')   // orders | enquiries | users | transactions
  const [orders, setOrders]       = useState([])
  const [enquiries, setEnquiries] = useState([])
  const [users, setUsers]         = useState([])
  const [txns, setTxns]           = useState([])
  const [txnTotals, setTxnTotals] = useState({})
  const [subs, setSubs]           = useState([])
  const [revenue, setRevenue]     = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [search, setSearch]       = useState('')

  // Set-plan modal
  const [planFor, setPlanFor]   = useState(null)   // company row being edited
  const [planForm, setPlanForm] = useState({ plan: 'Basic', months: '1', enquiry_limit: '0', amount_paid: '' })
  const [saving, setSaving]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [o, e, u, t, s, rev] = await Promise.all([
        wholesalerApi.listOrders().catch(() => ({ data: { orders: [] } })),
        wholesalerApi.listEnquiries().catch(() => ({ data: { enquiries: [] } })),
        wholesalerApi.listUsers().catch(() => ({ data: { users: [] } })),
        wholesalerApi.listTransactions().catch(() => ({ data: { transactions: [], totals: {} } })),
        wholesalerApi.listSubscriptions().catch(() => ({ data: { subscriptions: [] } })),
        wholesalerApi.revenue().catch(() => ({ data: null })),
      ])
      setOrders(o?.data?.orders || o?.orders || [])
      setEnquiries(e?.data?.enquiries || e?.enquiries || [])
      setUsers(u?.data?.users || u?.users || [])
      setTxns(t?.data?.transactions || t?.transactions || [])
      setTxnTotals(t?.data?.totals || t?.totals || {})
      setSubs(s?.data?.subscriptions || s?.subscriptions || [])
      setRevenue(rev?.data || rev || null)
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load wholesaler activity.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const q = search.trim().toLowerCase()
  const match = (...vals) => !q || vals.some(v => (v || '').toLowerCase().includes(q))

  const fOrders    = orders.filter(o => match(o.product_name, o.customer_name, o.order_code, o.company_name))
  const fEnquiries = enquiries.filter(e => match(e.product_name, e.retailer_name, e.enq_code, e.company_name))
  const fUsers     = users.filter(u => match(u.name, u.email, u.mobile, u.company_name))
  const fTxns      = txns.filter(t => match(t.party_name, t.txn_code, t.company_name))
  const fSubs      = subs.filter(s => match(s.company_name, s.plan, s.company_code))

  const openPlan = (row) => {
    setPlanFor(row)
    setPlanForm({ plan: row.plan || 'Basic', months: '1', enquiry_limit: String(row.enquiry_limit || 0), amount_paid: '' })
  }
  const submitPlan = async () => {
    if (!planFor) return
    setSaving(true); setError(null)
    try {
      await wholesalerApi.setCompanyPlan(planFor.company_id, {
        plan: planForm.plan,
        months: parseInt(planForm.months) || 1,
        enquiry_limit: parseInt(planForm.enquiry_limit) || 0,
        amount_paid: parseFloat(planForm.amount_paid) || 0,
      })
      setPlanFor(null)
      await load()
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to update plan.')
    } finally {
      setSaving(false)
    }
  }

  const STATS = [
    { label: 'Orders',        val: orders.length,    icon: ShoppingCart,   cls: 'blue' },
    { label: 'Enquiries',     val: enquiries.length, icon: MessageSquare,  cls: 'orange' },
    { label: 'Users / Staff', val: users.length,     icon: Users,          cls: 'purple' },
    { label: 'Platform Revenue', val: money(revenue?.total_revenue), icon: TrendingUp, cls: 'green' },
  ]

  const TABS = [
    { key: 'orders',        label: `Orders (${orders.length})` },
    { key: 'enquiries',     label: `Enquiries (${enquiries.length})` },
    { key: 'users',         label: `Users / Staff (${users.length})` },
    { key: 'transactions',  label: `Transactions (${txns.length})` },
    { key: 'subscriptions', label: `Subscriptions (${subs.length})` },
  ]

  return (
    <>
      <div className="breadcrumb">
        <span>Wholesaler</span><span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-active">Platform Activity</span>
      </div>

      <div className="page-header" style={{ marginBottom: 18 }}>
        <div className="page-header-left">
          <div className="page-title">Wholesaler Activity (All Companies)</div>
          <div className="page-desc">Orders, enquiries, users and transactions across every wholesaler</div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: 18 }}>
        {STATS.map(s => (
          <div key={s.label} className="stat-card">
            <div className={`stat-icon ${s.cls}`}><s.icon /></div>
            <div className="stat-info">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.val}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="tabs">
        {TABS.map(t => (
          <button key={t.key} className={`tab-btn${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="alert alert-warning" style={{ marginBottom: 14 }}>
          <AlertCircle /><span>{error}</span>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">{TABS.find(t => t.key === tab)?.label}</span>
          <div className="header-actions">
            <div className="search-bar">
              <Search size={14} />
              <input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="table-wrap">
          {/* ORDERS */}
          {tab === 'orders' && (
            <table>
              <thead><tr><th>Code</th><th>Company</th><th>Customer</th><th>Product</th><th>Qty</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 30 }}>Loading…</td></tr>}
                {!loading && fOrders.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No orders found.</td></tr>}
                {!loading && fOrders.map(o => (
                  <tr key={o._id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>{o.order_code}</td>
                    <td>{o.company_name}</td>
                    <td>{o.customer_name || '—'}</td>
                    <td style={{ fontWeight: 600 }}>{o.product_name || '—'}</td>
                    <td>{o.qty}</td>
                    <td style={{ fontWeight: 700 }}>{money(o.total_amount)}</td>
                    <td><span className={`badge ${statusColor(o.status)}`}>{o.status}</span></td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(o.order_date || o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* ENQUIRIES */}
          {tab === 'enquiries' && (
            <table>
              <thead><tr><th>Code</th><th>Company</th><th>Retailer</th><th>Product</th><th>Qty</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30 }}>Loading…</td></tr>}
                {!loading && fEnquiries.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No enquiries found.</td></tr>}
                {!loading && fEnquiries.map(e => (
                  <tr key={e._id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>{e.enq_code || '—'}</td>
                    <td>{e.company_name}</td>
                    <td>{e.retailer_name || '—'}</td>
                    <td style={{ fontWeight: 600 }}>{e.product_name || '—'}</td>
                    <td>{e.qty} {e.unit}</td>
                    <td><span className={`badge ${statusColor(e.status)}`}>{e.status}</span></td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(e.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* USERS */}
          {tab === 'users' && (
            <table>
              <thead><tr><th>Name</th><th>Company</th><th>Mobile</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30 }}>Loading…</td></tr>}
                {!loading && fUsers.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No users found.</td></tr>}
                {!loading && fUsers.map(u => (
                  <tr key={u._id}>
                    <td style={{ fontWeight: 600 }}>{u.name}</td>
                    <td>{u.company_name}</td>
                    <td>{u.mobile || '—'}</td>
                    <td>{u.email || '—'}</td>
                    <td>{u.role}</td>
                    <td><span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* TRANSACTIONS */}
          {tab === 'transactions' && (
            <table>
              <thead><tr><th>Code</th><th>Company</th><th>Type</th><th>Party</th><th>Amount</th><th>Mode</th><th>Date</th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30 }}>Loading…</td></tr>}
                {!loading && fTxns.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No transactions found.</td></tr>}
                {!loading && fTxns.map(t => (
                  <tr key={t._id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>{t.txn_code || '—'}</td>
                    <td>{t.company_name}</td>
                    <td><span className={`badge ${t.type === 'Received' ? 'badge-green' : 'badge-blue'}`}>{t.type}</span></td>
                    <td>{t.party_name || '—'}</td>
                    <td style={{ fontWeight: 700, color: t.type === 'Received' ? '#059669' : '#DC2626' }}>{money(t.amount)}</td>
                    <td>{t.mode}</td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(t.txn_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* SUBSCRIPTIONS */}
          {tab === 'subscriptions' && (
            <table>
              <thead><tr><th>Company</th><th>Plan</th><th>Enquiries</th><th>Expires</th><th>Last Paid</th><th>Status</th><th style={{ textAlign: 'center' }}>Action</th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30 }}>Loading…</td></tr>}
                {!loading && fSubs.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No companies found.</td></tr>}
                {!loading && fSubs.map(s => (
                  <tr key={s.company_id}>
                    <td style={{ fontWeight: 600 }}>{s.company_name}</td>
                    <td><span className="badge badge-blue">{s.plan}</span></td>
                    <td>{s.enquiry_limit > 0 ? `${s.enquiries_used}/${s.enquiry_limit}` : `${s.enquiries_used} (unlimited)`}</td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(s.expires_at)}</td>
                    <td>{money(s.last_amount)}</td>
                    <td><span className={`badge ${statusColor(s.status)}`}>{s.status}</span></td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn btn-sm btn-primary" onClick={() => openPlan(s)}>Manage Plan</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Set-plan modal */}
      {planFor && (
        <div className="modal-overlay" onClick={() => !saving && setPlanFor(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title"><CreditCard size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />Manage Plan — {planFor.company_name}</span>
              <button className="modal-close" onClick={() => !saving && setPlanFor(null)}><X size={18} /></button>
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
              <button className="btn btn-secondary btn-sm" onClick={() => setPlanFor(null)} disabled={saving}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={submitPlan} disabled={saving}>{saving ? 'Saving…' : 'Update Plan'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
