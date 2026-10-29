import { useMemo } from 'react'
import {
  LayoutDashboard, ShoppingBag, AlertTriangle, CheckCircle, Building2, Package,
  TrendingUp, IndianRupee, Calendar, BarChart2, FileText, ArrowRight, ChevronDown,
  RefreshCw, Eye, ClipboardList, PackageCheck, Plus,
} from 'lucide-react'
import {
  Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts'

const fmtN = n => Number(n || 0).toLocaleString('en-IN')
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const STATUS_COLOR = {
  Pending:   { bg: '#FFFBEB', color: '#D97706' },
  Approved:  { bg: '#EFF6FF', color: '#2563EB' },
  Received:  { bg: '#ECFDF5', color: '#059669' },
  Completed: { bg: '#F5F3FF', color: '#7C3AED' },
  Cancelled: { bg: '#FEF2F2', color: '#DC2626' },
}

const purCode = p => p.purchase_code || p.po_number || (p._id ? `PO-${String(p._id).slice(-6).toUpperCase()}` : (p.id || ''))
const purSupplier = p => p.supplier_name || p.supplier || ''
const purProduct = p => p.product_name || p.product || ''
const purTotal = p => Number(p.total_amount || p.total || p.amount || 0)
const purStatus = p => p.status || 'Pending'
const purDateRaw = p => p.purchase_date || p.created_at || p.date || ''

const PIE_COLORS = ['#059669', '#2563EB', '#7C3AED', '#D97706', '#DC2626', '#0891B2', '#65A30D', '#9333EA']

export default function PurchaseDashboard({ purchases = [], suppliers = [], products = [] }) {

  const kpis = useMemo(() => {
    const total = purchases.reduce((a, p) => a + purTotal(p), 0)
    const pendingPOs = purchases.filter(p => purStatus(p) === 'Pending').length
    const partialRecv = purchases.filter(p => purStatus(p) === 'Partially Received' || purStatus(p) === 'Approved').length
    const pendingGRNs = purchases.filter(p => purStatus(p) === 'Approved' || purStatus(p) === 'Partially Received').length
    const returns = purchases.filter(p => purStatus(p) === 'Returned' || purStatus(p) === 'Cancelled').length
    const outstanding = purchases
      .filter(p => purStatus(p) !== 'Completed' && purStatus(p) !== 'Cancelled')
      .reduce((a, p) => a + purTotal(p), 0)
    return { total, pendingPOs, partialRecv, pendingGRNs, returns, outstanding }
  }, [purchases])

  const topSuppliers = useMemo(() => {
    const map = new Map()
    purchases.forEach(p => {
      const s = purSupplier(p) || 'Unknown'
      map.set(s, (map.get(s) || 0) + purTotal(p))
    })
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }))
  }, [purchases])

  const topProducts = useMemo(() => {
    const map = new Map()
    purchases.forEach(p => {
      const items = p.items || (p.product_name ? [p] : [])
      items.forEach(it => {
        const nm = it.product_name || it.name || purProduct(it) || 'Unknown'
        const qty = Number(it.qty || it.quantity || 0)
        const amt = Number(it.amount || 0) + Number(it.gst_amount || it.gst || 0) || (Number(it.qty || 0) * Number(it.rate || 0))
        const ex = map.get(nm) || { name: nm, qty: 0, amount: 0 }
        map.set(nm, { name: nm, qty: ex.qty + qty, amount: ex.amount + (amt || (Number(it.qty || 0) * Number(it.rate || 0))) })
      })
    })
    return [...map.values()]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
  }, [purchases])

  const recentPurchases = useMemo(() => {
    return [...purchases]
      .sort((a, b) => {
        const da = new Date(purDateRaw(a) || 0).getTime()
        const db = new Date(purDateRaw(b) || 0).getTime()
        return db - da
      })
      .slice(0, 10)
  }, [purchases])

  const KPI = ({ label, value, icon, color, bg, border }) => (
    <div style={{
      background: bg, border: `1.5px solid ${border}`, borderRadius: 12, padding: '14px 18px',
      display: 'flex', alignItems: 'center', gap: 12, minWidth: 0,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10, background: 'rgba(255,255,255,.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color,
      }}>{icon}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      </div>
    </div>
  )

  return (
    <>
      <div className="breadcrumb">
        <span>Purchase</span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-active">Purchase Dashboard</span>
      </div>

      <div className="card" style={{ marginBottom: 16, background: 'linear-gradient(135deg,#01152D 0%,#02203F 100%)', border: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, padding: '18px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(253,92,2,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LayoutDashboard size={24} color="#FD5C02" />
            </div>
            <div>
              <div style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>Purchase Dashboard</div>
              <div style={{ color: 'rgba(255,255,255,.65)', fontSize: 12, marginTop: 2 }}>
                {purchases.length} purchase records · {suppliers.length} suppliers · {products.length} products
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FD5C02', border: '1px solid #FD5C02' }}>
              <Plus size={14} /> Create PO
            </button>
            <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.08)', color: '#fff', border: '1px solid rgba(255,255,255,.18)' }}>
              <Building2 size={14} /> View Suppliers <ArrowRight size={13} />
            </button>
            <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.08)', color: '#fff', border: '1px solid rgba(255,255,255,.18)' }}>
              <ClipboardList size={14} /> View GRNs <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12, marginBottom: 16 }}>
        <KPI label="Total Purchase Value" value={`₹${fmtN(kpis.total)}`} icon={<IndianRupee size={20} />} color="#059669" bg="#ECFDF5" border="#A7F3D0" />
        <KPI label="Pending POs" value={fmtN(kpis.pendingPOs)} icon={<ShoppingBag size={20} />} color="#D97706" bg="#FFFBEB" border="#FDE68A" />
        <KPI label="Partially Received" value={fmtN(kpis.partialRecv)} icon={<Package size={20} />} color="#2563EB" bg="#EFF6FF" border="#BFDBFE" />
        <KPI label="Pending GRNs" value={fmtN(kpis.pendingGRNs)} icon={<ClipboardList size={20} />} color="#7C3AED" bg="#F5F3FF" border="#DDD6FE" />
        <KPI label="Purchase Returns" value={fmtN(kpis.returns)} icon={<AlertTriangle size={20} />} color="#DC2626" bg="#FEF2F2" border="#FECACA" />
        <KPI label="Supplier Outstanding" value={`₹${fmtN(kpis.outstanding)}`} icon={<TrendingUp size={20} />} color="#0891B2" bg="#ECFEFF" border="#A5F3FC" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building2 size={16} style={{ color: 'var(--primary)' }} />
              <span className="card-title">Top 5 Suppliers</span>
            </div>
          </div>
          <div style={{ padding: '14px 18px' }}>
            {topSuppliers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                <Building2 size={36} style={{ opacity: .2, display: 'block', margin: '0 auto 10px' }} />
                No supplier data yet.
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={topSuppliers}
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={72}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {topSuppliers.map((entry, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={val => [`₹${Number(val).toLocaleString('en-IN')}`, 'Total']}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {topSuppliers.map((s, i) => (
                    <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: PIE_COLORS[i % PIE_COLORS.length] }}>₹{fmtN(s.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PackageCheck size={16} style={{ color: 'var(--primary)' }} />
              <span className="card-title">Top Purchased Products</span>
            </div>
          </div>
          <div style={{ padding: 10 }}>
            {topProducts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                <Package size={36} style={{ opacity: .2, display: 'block', margin: '0 auto 10px' }} />
                No product data yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {topProducts.map((p, i) => {
                  const max = topProducts[0]?.amount || 1
                  const pct = (p.amount / max) * 100
                  return (
                    <div key={p.name} style={{ padding: '10px 12px', borderRadius: 8, background: i === 0 ? '#FFF7ED' : 'transparent' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <span style={{
                            width: 22, height: 22, borderRadius: 6, fontWeight: 800, fontSize: 11,
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            background: i === 0 ? '#FD5C02' : i === 1 ? '#06B6D4' : i === 2 ? '#7C3AED' : '#94A3B8',
                            color: '#fff', flexShrink: 0,
                          }}>{i + 1}</span>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#059669' }}>₹{fmtN(p.amount)}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fmtN(p.qty)} units</div>
                        </div>
                      </div>
                      <div style={{ height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          width: `${pct}%`, height: '100%', borderRadius: 3,
                          background: `linear-gradient(90deg, ${i === 0 ? '#FD5C02' : i === 1 ? '#06B6D4' : i === 2 ? '#7C3AED' : '#94A3B8'}, ${i === 0 ? '#FB923C' : i === 1 ? '#22D3EE' : i === 2 ? '#A78BFA' : '#CBD5E1'})`,
                        }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={16} style={{ color: 'var(--primary)' }} />
              <span className="card-title">Recent Purchase Activity</span>
              <span className="badge badge-blue" style={{ fontSize: 11 }}>Last 10</span>
            </div>
            <div className="header-actions">
              <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Calendar size={12} /> Latest first
              </span>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={th}>PO Number</th>
                  <th style={th}>Date</th>
                  <th style={th}>Supplier</th>
                  <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                  <th style={{ ...th, textAlign: 'center' }}>Status</th>
                  <th style={{ ...th, textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentPurchases.length === 0 && (
                  <tr><td colSpan={6} style={emptyCell}>
                    <ShoppingBag size={32} style={{ opacity: .2, display: 'block', margin: '0 auto 8px' }} />
                    No purchase records yet.
                  </td></tr>
                )}
                {recentPurchases.map((p, i) => {
                  const st = purStatus(p)
                  const sc = STATUS_COLOR[st] || { bg: '#F1F5F9', color: '#64748B' }
                  return (
                    <tr key={p._id || p.id || i}>
                      <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)', fontSize: 12 }}>{purCode(p)}</td>
                      <td style={{ ...td, fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(purDateRaw(p))}</td>
                      <td style={{ ...td, fontSize: 12, fontWeight: 600 }}>{purSupplier(p) || '—'}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: '#059669', fontSize: 13 }}>₹{fmtN(purTotal(p))}</td>
                      <td style={{ ...td, textAlign: 'center' }}>
                        <span style={{
                          background: sc.bg, color: sc.color, borderRadius: 20,
                          padding: '3px 10px', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap',
                          border: `1px solid ${sc.bg === '#FFFBEB' ? '#FDE68A' : sc.bg === '#EFF6FF' ? '#BFDBFE' : sc.bg === '#ECFDF5' ? '#A7F3D0' : sc.bg === '#F5F3FF' ? '#DDD6FE' : sc.bg === '#FEF2F2' ? '#FECACA' : '#E2E8F0'}`,
                        }}>{st}</span>
                      </td>
                      <td style={{ ...td, textAlign: 'center' }}>
                        <button title="View" style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 28, height: 28, borderRadius: 6, cursor: 'pointer',
                          background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#2563EB',
                        }}>
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}

const th = {
  padding: '10px 14px', textAlign: 'left',
  fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px',
  color: 'var(--text-muted)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)',
}
const td = { padding: '11px 14px', fontSize: 13, verticalAlign: 'middle' }
const emptyCell = { textAlign: 'center', padding: 40, color: 'var(--text-muted)' }
