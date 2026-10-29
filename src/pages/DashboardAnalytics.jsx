import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Users, ShoppingCart, CreditCard,
  Package, Target, Activity, RefreshCw, Star, Award,
} from 'lucide-react'
import { reportApi } from '../api/systemApi'

const PIE_COLORS = ['#FD5C02', '#06B6D4', '#10B981', '#F59E0B', '#8B5CF6', '#3B82F6', '#EC4899', '#64748B']

function StatCard({ label, value, sub, color, Icon, up }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}><Icon size={18} /></div>
      <div className="stat-info">
        <div className="stat-label">{label}</div>
        <div className="stat-value" style={{ fontSize: 18 }}>{value}</div>
        {sub && <div className={`stat-change ${up ? 'up' : 'down'}`}>{sub}</div>}
      </div>
    </div>
  )
}

function SectionTitle({ title, badge, badgeColor = 'badge-blue' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <span style={{ fontWeight: 800, fontSize: 15 }}>{title}</span>
      {badge && <span className={`badge ${badgeColor}`}>{badge}</span>}
    </div>
  )
}

export default function DashboardAnalytics() {
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [salesTab, setSalesTab] = useState('monthly')

  const fetch = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await reportApi.getDashboardStats()
      setStats(res?.data || res)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load analytics.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <RefreshCw style={{ width: 28, animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
      </div>
    )
  }

  if (error) {
    return <div className="alert alert-danger">{error}</div>
  }

  const s = stats || {}
  const fmt = (v) => `₹${(parseFloat(v) || 0).toLocaleString('en-IN')}`

  // ── KPI cards ──────────────────────────────────────────────
  const kpis = [
    { label: 'Revenue (Month)',     value: fmt(s.monthSales),       sub: `${fmt(s.yearSales)} YTD`,        color: 'blue',   Icon: TrendingUp,   up: true  },
    { label: 'Total Orders',        value: (s.totalOrders||0).toString(),  sub: `${s.pendingOrders||0} pending`, color: 'green',  Icon: ShoppingCart, up: true  },
    { label: 'Total Customers',     value: (s.totalCustomers||0).toString(),sub: 'registered',               color: 'cyan',   Icon: Users,        up: true  },
    { label: 'Total Products',      value: (s.totalProducts||0).toString(), sub: `${s.lowStockCount||0} low stock`, color: 'orange', Icon: Package,  up: (s.lowStockCount||0) === 0 },
    { label: 'Outstanding Rcv.',    value: fmt(s.totalOutstanding), sub: 'accounts receivable',             color: 'red',    Icon: TrendingDown, up: false },
    { label: 'Revenue (Today)',     value: fmt(s.todaySales),       sub: 'today',                           color: 'purple', Icon: Activity,     up: true  },
    { label: 'Total Enquiries',     value: (s.totalEnquiries||0).toString(),sub: 'all time',                color: 'yellow', Icon: Target,       up: true  },
    { label: 'Dispatches',          value: (s.totalDispatches||0).toString(),sub: 'completed',              color: 'green',  Icon: CreditCard,   up: true  },
  ]

  // ── Trend chart data ───────────────────────────────────────
  const trend = (s.trend || []).map(t => ({
    month:   t.month  || '',
    sales:   t.sales  || 0,
    profit:  t.profit || 0,
  }))

  // ── Daily (last 30 days from trend if monthly — show last entry) ──
  // We'll show monthly trend for all tabs since that's what the API returns
  const chartData = trend

  // ── Top products ───────────────────────────────────────────
  const topProducts = (s.topProducts || []).map((p, i) => ({
    name:        p.name || p.code || `Product ${i + 1}`,
    total_sales: p.total_sales || 0,
    total_qty:   p.total_qty   || 0,
    color:       PIE_COLORS[i % PIE_COLORS.length],
  }))
  const totalProdSales = Math.max(topProducts.reduce((a, p) => a + p.total_sales, 0), 1)

  // ── Top customers ──────────────────────────────────────────
  const topCustomers = s.topCustomers || []
  const totalCustRev = Math.max(topCustomers.reduce((a, c) => a + (c.total_sales || 0), 0), 1)

  // ── Retailers & Wholesalers ────────────────────────────────
  const topRetailers   = s.topRetailers   || []
  const topWholesalers = s.topWholesalers || []

  const fmtDt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      <div className="breadcrumb">
        <span>Reports</span><span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-active">Dashboard Analytics</span>
      </div>

      {/* Refresh */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-secondary btn-sm" onClick={fetch} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw style={{ width: 13 }} /> Refresh
        </button>
      </div>

      {/* ── KPI Grid ── */}
      <div className="page-grid-4" style={{ marginBottom: 20 }}>
        {kpis.map(k => <StatCard key={k.label} {...k} />)}
      </div>

      {/* ══════════════ SALES ANALYTICS ══════════════ */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">Sales Analytics</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['daily','Daily'],['monthly','Monthly'],['yearly','Yearly']].map(([k, l]) => (
              <button key={k} className={`btn btn-xs ${salesTab === k ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSalesTab(k)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="card-body">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="aGrad1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#FD5C02" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#FD5C02" stopOpacity={0}    />
                  </linearGradient>
                  <linearGradient id="aGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10B981" stopOpacity={0.2}  />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => fmt(v)} />
                <Legend />
                <Area dataKey="sales"  stroke="#FD5C02" fill="url(#aGrad1)" name="Revenue" strokeWidth={2} />
                <Area dataKey="profit" stroke="#10B981" fill="url(#aGrad2)" name="Profit"  strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
              Sales trend data will appear once orders are recorded.
            </div>
          )}
        </div>
      </div>

      {/* ══════════════ PROFIT ANALYTICS ══════════════ */}
      <div className="page-grid-2" style={{ gap: 16, marginBottom: 16 }}>
        {/* Revenue vs Profit bar */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Profit Analytics</span>
            <span className="badge badge-green">Revenue · Profit</span>
          </div>
          <div className="card-body">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} barSize={10}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => fmt(v)} />
                  <Legend />
                  <Bar dataKey="sales"  fill="#4F46E5" name="Revenue" radius={[3,3,0,0]} />
                  <Bar dataKey="profit" fill="#10B981" name="Profit"  radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>No data yet</div>
            )}
          </div>
        </div>

        {/* Top Products Pie */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Top Selling Products</span>
            <span className="badge badge-orange">{topProducts.length} products</span>
          </div>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {topProducts.length > 0 ? (
              <>
                <ResponsiveContainer width="45%" height={200}>
                  <PieChart>
                    <Pie data={topProducts} cx="50%" cy="50%" innerRadius={48} outerRadius={80}
                      dataKey="total_sales" paddingAngle={2}>
                      {topProducts.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={v => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {topProducts.map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: p.color, flexShrink: 0 }} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                      <span style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>{fmt(p.total_sales)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32, width: '100%' }}>
                Product sales data will appear once orders are delivered.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════ BUSINESS ANALYTICS ══════════════ */}
      <div style={{ marginBottom: 12 }}>
        <SectionTitle title="Business Analytics" badge="Live Data" badgeColor="badge-blue" />
      </div>

      {/* Best Customers + Top Retailers + Top Wholesalers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Best Customers */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Star style={{ width: 14, color: '#F59E0B' }} /> Best Customers
            </span>
            <span className="badge badge-blue">{topCustomers.length}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Customer</th><th>Revenue</th><th>Share</th></tr></thead>
              <tbody>
                {topCustomers.length > 0 ? topCustomers.slice(0, 8).map((c, i) => {
                  const share = (((c.total_sales || 0) / totalCustRev) * 100).toFixed(1)
                  return (
                    <tr key={i}>
                      <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{i + 1}</td>
                      <td style={{ fontWeight: 600, fontSize: 12 }}>{c.name || '—'}</td>
                      <td style={{ fontWeight: 700, color: 'var(--success)', fontSize: 12 }}>{fmt(c.total_sales)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div className="progress-bar" style={{ flex: 1 }}>
                            <div className="progress-fill" style={{ width: `${share}%`, background: '#FD5C02' }} />
                          </div>
                          <span style={{ fontSize: 10, width: 30 }}>{share}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                }) : (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 12 }}>
                    No data yet
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Best Retailers */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Award style={{ width: 14, color: '#06B6D4' }} /> Best Retailers
            </span>
            <span className="badge badge-cyan">{topRetailers.length}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Retailer</th><th>Orders</th><th>Revenue</th></tr></thead>
              <tbody>
                {topRetailers.length > 0 ? topRetailers.slice(0, 8).map((c, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{i + 1}</td>
                    <td style={{ fontWeight: 600, fontSize: 12 }}>{c.name || '—'}</td>
                    <td style={{ fontSize: 12 }}>{c.order_count || 0}</td>
                    <td style={{ fontWeight: 700, color: 'var(--success)', fontSize: 12 }}>{fmt(c.total_sales)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 12 }}>
                    No retailer data yet
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Best Wholesalers */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Award style={{ width: 14, color: '#8B5CF6' }} /> Best Wholesalers
            </span>
            <span className="badge badge-purple">{topWholesalers.length}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Wholesaler</th><th>Orders</th><th>Revenue</th></tr></thead>
              <tbody>
                {topWholesalers.length > 0 ? topWholesalers.slice(0, 8).map((c, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{i + 1}</td>
                    <td style={{ fontWeight: 600, fontSize: 12 }}>{c.name || '—'}</td>
                    <td style={{ fontSize: 12 }}>{c.order_count || 0}</td>
                    <td style={{ fontWeight: 700, color: 'var(--success)', fontSize: 12 }}>{fmt(c.total_sales)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 12 }}>
                    No wholesaler data yet
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ══════════════ SLOW MOVING PRODUCTS ══════════════ */}
      {(s.topProducts || []).length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Slow Moving Products</span>
            <span className="badge badge-yellow">Low velocity</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Product</th><th>Total Qty Sold</th><th>Revenue</th><th>Velocity</th></tr></thead>
              <tbody>
                {[...(s.topProducts || [])].sort((a, b) => (a.total_qty || 0) - (b.total_qty || 0)).slice(0, 5).map((p, i) => {
                  const maxQty = Math.max(...(s.topProducts || []).map(x => x.total_qty || 0), 1)
                  const pct = (((p.total_qty || 0) / maxQty) * 100).toFixed(0)
                  return (
                    <tr key={i}>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                      <td style={{ fontWeight: 600 }}>{p.name || p.code || '—'}</td>
                      <td style={{ fontWeight: 600 }}>{(p.total_qty || 0).toLocaleString()}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{fmt(p.total_sales)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="progress-bar" style={{ flex: 1 }}>
                            <div className="progress-fill" style={{ width: `${pct}%`, background: '#F59E0B' }} />
                          </div>
                          <span style={{ fontSize: 11, width: 30 }}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════ RECENT ENQUIRIES ══════════════ */}
      {(s.recentEnquiries || []).length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <span className="card-title">Recent Enquiries</span>
            <span className="badge badge-orange">Latest 5</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Code</th><th>Retailer</th><th>Product</th><th>Qty</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {(s.recentEnquiries || []).map((e, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 700 }}>{e.enq_code || '—'}</td>
                    <td style={{ fontWeight: 600 }}>{e.retailer_name || '—'}</td>
                    <td style={{ fontSize: 12 }}>{e.product_name || '—'}</td>
                    <td style={{ fontSize: 12 }}>{e.qty || 0} {e.unit || ''}</td>
                    <td>
                      <span className={`badge ${e.status === 'Confirmed' ? 'badge-green' : e.status === 'New' ? 'badge-blue' : 'badge-gray'}`}>
                        {e.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {fmtDt(e.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
