import { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import {
  TrendingUp, ShoppingBag, MessageSquare, Package, CreditCard,
  AlertTriangle, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import './Dashboard.css'

const statusColors = {
  New: 'badge-blue', Viewed: 'badge-cyan', Replied: 'badge-yellow',
  Negotiation: 'badge-orange', Confirmed: 'badge-green', Cancelled: 'badge-red',
}

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

export default function Dashboard({
  inventory = [], purchases = [], enquiries = [], orders = [],
  dispatches = [], sales = [], payments = { receivables: [], payables: [], history: [] },
  notifications = [], dashboardStats = null,
}) {
  // ── Prefer live dashboardStats from API, fall back to local calcs ─
  const todaySales      = dashboardStats?.todaySales      ?? sales.reduce((a, s) => a + (s.total_amount || s.total || 0), 0)
  const totalPurchase   = dashboardStats?.totalPurchase   ?? purchases.reduce((a, p) => a + (p.total_amount || p.total || 0), 0)
  const pendingOrders   = dashboardStats?.pendingOrders   ?? orders.filter(o => !['Delivered', 'Cancelled'].includes(o.status)).length
  const activeEnquiries = enquiries.filter(e => !['Confirmed', 'Cancelled'].includes(e.status)).length
  const newEnquiries    = enquiries.filter(e => e.status === 'New').length
  const inTransit       = dispatches.filter(d => ['Dispatched', 'In Transit'].includes(d.status)).length

  // Stock derived values
  const totalStock    = dashboardStats?.totalStock ?? inventory.reduce((a, i) => a + (i.current_stock ?? i.current ?? 0), 0)
  const lowStockItems = inventory.filter(i => (i.current_stock ?? i.current ?? 0) <= (i.low_stock_alert ?? i.lowAlert ?? 0))
  const outstandingRcv = dashboardStats?.totalOutstanding ?? (payments.receivables || []).reduce((a, r) => a + (r.outstanding || 0), 0)

  // Chart data — last 6 months, fully dynamic from purchases + sales props
  const rawTrend = dashboardStats?.trend || []
  const chartData = useMemo(() => {
    if (rawTrend.length > 0) {
      return rawTrend.map(t => ({
        month:    t.period || t.month || '',
        sales:    t.total_sales    || t.sales    || 0,
        purchase: t.total_purchase || t.purchase || 0,
        profit:   (t.total_sales || t.sales || 0) - (t.total_purchase || t.purchase || 0),
      }))
    }

    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const now = new Date()
    const slots = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      slots.push({
        key:      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        month:    `${MONTH_NAMES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
        sales:    0,
        purchase: 0,
        profit:   0,
      })
    }

    purchases.forEach(p => {
      const raw = p.purchase_date || p.date || ''
      if (!raw) return
      const d = new Date(raw)
      if (isNaN(d.getTime())) return
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const slot = slots.find(s => s.key === key)
      if (slot) slot.purchase += (p.total_amount || p.total || 0)
    })

    sales.forEach(s => {
      const raw = s.sale_date || s.date || s.created_at || ''
      if (!raw) return
      const d = new Date(raw)
      if (isNaN(d.getTime())) return
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const slot = slots.find(sl => sl.key === key)
      if (slot) slot.sales += (s.total_amount || s.amount || s.total || 0)
    })

    slots.forEach(s => { s.profit = s.sales - s.purchase })
    return slots
  }, [rawTrend, purchases, sales])

  const recentEnquiries = dashboardStats?.recentEnquiries || enquiries.slice(0, 5)
  const unreadCount = notifications.filter(n => !(n.is_read || n.read)).length

  // ── Month-wise profit map (from raw sales + purchases) so the admin can
  //    view profit for any month via the calendar picker in the banner. ──
  const monthlyMap = useMemo(() => {
    const map = {}   // key 'YYYY-MM' -> { sales, purchase }
    const bump = (raw, field, val) => {
      if (!raw) return
      const d = new Date(raw)
      if (isNaN(d.getTime())) return
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      map[key] = map[key] || { sales: 0, purchase: 0 }
      map[key][field] += (val || 0)
    }
    sales.forEach(s => bump(s.sale_date || s.date || s.created_at, 'sales', s.total_amount || s.amount || s.total || 0))
    purchases.forEach(p => bump(p.purchase_date || p.date, 'purchase', p.total_amount || p.total || 0))
    return map
  }, [sales, purchases])

  const nowKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const [selectedMonth, setSelectedMonth] = useState(nowKey)

  // Profit + metrics for the selected month.
  const selMonthData = monthlyMap[selectedMonth] || { sales: 0, purchase: 0 }
  const selProfit = selMonthData.sales - selMonthData.purchase

  // ── KPI card definitions (data unchanged, presentation refined) ──
  const kpis = [
    {
      label: "Today's Sales", value: inr(todaySales), icon: TrendingUp, tint: 'tint-blue',
      foot: `From ${sales.length} invoice${sales.length !== 1 ? 's' : ''}`,
    },
    {
      label: 'Active Enquiries', value: activeEnquiries, icon: MessageSquare, tint: 'tint-green',
      trend: newEnquiries > 0 ? { dir: 'up', text: `${newEnquiries} new` } : null,
      foot: 'Awaiting response',
    },
    {
      label: 'Pending Orders', value: pendingOrders, icon: ShoppingBag, tint: 'tint-orange',
      foot: `${inTransit} in transit`,
    },
    {
      label: 'Stock Available', value: `${Number(totalStock).toLocaleString('en-IN', { maximumFractionDigits: 2 })} Pcs`, icon: Package, tint: 'tint-purple',
      trend: lowStockItems.length > 0 ? { dir: 'down', text: `${lowStockItems.length} low` } : { dir: 'up', text: 'All OK' },
      foot: 'Across all products',
    },
    {
      label: 'Purchase', value: inr(totalPurchase), icon: ShoppingBag, tint: 'tint-cyan',
      foot: `${purchases.length} entries`,
    },
    {
      label: 'Outstanding (Recv.)', value: inr(outstandingRcv), icon: CreditCard, tint: 'tint-red',
      trend: outstandingRcv > 0 ? { dir: 'down', text: `${(payments.receivables || []).filter(r => r.outstanding > 0).length} pending` } : null,
      foot: 'Money customers owe',
    },
  ]

  // Metrics reflect the month chosen in the banner picker.
  const profitMetrics = [
    { label: 'Total Sales',    val: inr(selMonthData.sales) },
    { label: 'Total Purchase', val: inr(selMonthData.purchase) },
    { label: 'Margin',         val: selMonthData.sales > 0 ? `${Math.round((selProfit / selMonthData.sales) * 100)}%` : '—' },
  ]

  return (
    <>
      {/* ── Header ── */}
      <div className="dash-head">
        <div>
          <div className="dash-head-title">Dashboard</div>
          <div className="dash-head-sub">{dashboardStats?.companyName || 'Business overview & performance'}</div>
        </div>
        <div className="dash-head-meta">
          {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="kpi-grid">
        {kpis.map((k) => {
          const Icon = k.icon
          return (
            <div className="kpi" key={k.label}>
              <div className="kpi-top">
                <div className={`kpi-icon ${k.tint}`}><Icon /></div>
                {k.trend && (
                  <span className={`kpi-trend ${k.trend.dir}`}>
                    {k.trend.dir === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {k.trend.text}
                  </span>
                )}
              </div>
              <div>
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-value">{k.value}</div>
              </div>
              <div className="kpi-foot">{k.foot}</div>
            </div>
          )
        })}
      </div>

      {/* ── Profit banner (with month picker) ── */}
      <div className="profit-banner">
        <div>
          <div className="profit-label-row">
            <span className="profit-label">Net Profit</span>
            <input
              type="month"
              className="profit-month-input"
              value={selectedMonth}
              max={nowKey}
              onChange={e => setSelectedMonth(e.target.value || nowKey)}
            />
          </div>
          <div className="profit-value">{inr(selProfit)}</div>
        </div>
        <div className="profit-metrics">
          {profitMetrics.map(item => (
            <div key={item.label}>
              <div className="profit-metric-label">{item.label}</div>
              <div className="profit-metric-value">{item.val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Chart + Alerts ── */}
      <div className="page-grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Sales vs Purchase vs Profit</span>
            <span className="badge badge-blue">{new Date().getFullYear()}</span>
          </div>
          <div className="card-body" style={{ paddingTop: 8 }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barSize={10}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={{ stroke: '#E2E8F0' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                <Tooltip formatter={v => inr(v)} cursor={{ fill: 'rgba(1,21,45,0.04)' }} />
                <Bar dataKey="sales"    fill="#FD5C02" radius={[4,4,0,0]} name="Sales" />
                <Bar dataKey="purchase" fill="#06B6D4" radius={[4,4,0,0]} name="Purchase" />
                <Bar dataKey="profit"   fill="#10B981" radius={[4,4,0,0]} name="Profit" />
              </BarChart>
            </ResponsiveContainer>
            <div className="chart-legend">
              {[['#FD5C02','Sales'],['#06B6D4','Purchase'],['#10B981','Profit']].map(([c,l]) => (
                <span key={l}><span className="dot" style={{ background: c }} />{l}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Alerts & Notifications</span>
            <span className="badge badge-red">{unreadCount} New</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {notifications.slice(0, 4).map(n => (
              <div key={n._id || n.id} className={`alert ${n.is_read || n.read ? 'alert-info' : 'alert-warning'}`} style={{ fontSize: 12 }}>
                <AlertTriangle style={{ width: 14, flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: (n.is_read || n.read) ? 400 : 600 }}>{n.title || n.msg || n.message}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    {n.created_at ? new Date(n.created_at).toLocaleDateString('en-IN') : (n.time || '')}
                  </div>
                </div>
              </div>
            ))}
            {lowStockItems.map((item, i) => (
              <div key={`ls-${i}`} className="alert alert-warning" style={{ fontSize: 12 }}>
                <AlertTriangle style={{ width: 14 }} />
                <span><strong>{item.product_name || item.name || item.productCode || '—'}</strong> — only {item.current_stock ?? item.current ?? 0} units left (Low Stock)</span>
              </div>
            ))}
            {outstandingRcv > 0 && (
              <div className="alert alert-danger" style={{ fontSize: 12 }}>
                <CreditCard style={{ width: 14 }} />
                <span>Outstanding receivable: <strong>{inr(outstandingRcv)}</strong></span>
              </div>
            )}
            {notifications.length === 0 && lowStockItems.length === 0 && outstandingRcv === 0 && (
              <div className="dash-empty">No alerts right now. You're all caught up.</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Recent Enquiries + Orders ── */}
      <div className="page-grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Enquiries</span>
            <span className="badge badge-blue">{enquiries.length} total</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Retailer</th><th>Product</th><th>Qty</th><th>Status</th></tr></thead>
              <tbody>
                {(recentEnquiries.length ? recentEnquiries : enquiries.slice(0, 5)).map(e => (
                  <tr key={e._id || e.id}>
                    <td style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 12 }}>{e.enq_code || e.id || ''}</td>
                    <td style={{ fontWeight: 600 }}>{e.retailer_name || e.retailer || ''}</td>
                    <td style={{ fontSize: 11, maxWidth: 140 }}>{e.product_name || e.product || ''}</td>
                    <td>{e.qty} {e.unit}</td>
                    <td><span className={`badge ${statusColors[e.status] || 'badge-gray'}`}>{e.status}</span></td>
                  </tr>
                ))}
                {enquiries.length === 0 && (
                  <tr><td colSpan={5} className="dash-empty">No enquiries yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Orders</span>
            <span className="badge badge-green">{orders.length} total</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Order</th><th>Customer</th><th>Product</th><th>Total</th><th>Status</th></tr></thead>
              <tbody>
                {orders.slice(0, 5).map(o => (
                  <tr key={o._id || o.id}>
                    <td style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 12 }}>{o.order_code || o.id || ''}</td>
                    <td style={{ fontWeight: 600 }}>{o.customer_name || o.customer || ''}</td>
                    <td style={{ fontSize: 11 }}>{o.product_name || o.product || ''}</td>
                    <td style={{ fontWeight: 700, color: 'var(--success)' }}>{inr(o.total_amount || o.total || 0)}</td>
                    <td><span className={`badge ${
                      o.status === 'Delivered'        ? 'badge-green' :
                      o.status === 'Out for Delivery' ? 'badge-purple' :
                      o.status === 'Dispatched'       ? 'badge-orange' :
                      o.status === 'Packing'          ? 'badge-yellow' : 'badge-cyan'
                    }`}>{o.status}</span></td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr><td colSpan={5} className="dash-empty">No orders yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Inventory snapshot ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Current Inventory Snapshot</span>
          <span className="badge badge-blue">Live</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Product</th><th>Stock In</th><th>Stock Out</th><th>Current Stock</th><th>Status</th></tr></thead>
            <tbody>
              {inventory.map((inv, i) => {
                const current = inv.current_stock ?? inv.current ?? 0
                const lowAlert = inv.low_stock_alert ?? inv.lowAlert ?? 0
                const status = current === 0 ? 'Out' : current <= lowAlert ? 'Low' : 'OK'
                return (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{inv.product_name || inv.name || inv.productCode || '—'}</td>
                    <td style={{ color: 'var(--success)', fontWeight: 600 }}>+{inv.stock_in ?? inv.stockIn ?? 0}</td>
                    <td style={{ color: (inv.stock_out ?? inv.stockOut ?? 0) > 0 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 600 }}>
                      {(inv.stock_out ?? inv.stockOut ?? 0) > 0 ? `-${inv.stock_out ?? inv.stockOut}` : '—'}
                    </td>
                    <td style={{
                      fontWeight: 800, fontSize: 16,
                      color: current === 0 ? 'var(--danger)' : current <= lowAlert ? 'var(--warning)' : 'var(--text)'
                    }}>{Number(current).toLocaleString('en-IN', { maximumFractionDigits: 2 })} Pcs</td>
                    <td>
                      <span className={`badge ${status === 'OK' ? 'badge-green' : status === 'Low' ? 'badge-yellow' : 'badge-red'}`}>
                        {status === 'OK' ? 'In Stock' : status === 'Low' ? 'Low Stock' : 'Out of Stock'}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {inventory.length === 0 && (
                <tr><td colSpan={5} className="dash-empty">No inventory data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
