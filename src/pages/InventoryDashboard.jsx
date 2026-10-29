import { useState, useEffect, useMemo } from 'react'
import { Boxes, AlertTriangle, Package, Warehouse, RefreshCw, TrendingDown, TrendingUp, BarChart3, ArrowLeftRight } from 'lucide-react'
import { inventoryApi } from '../api/inventoryApi'

const fmtN = n => Number(n || 0).toLocaleString('en-IN')
const fmtC = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })

export default function InventoryDashboard({ inventory = [], products = [], warehouses = [] }) {
  const [summary,   setSummary]   = useState(null)
  const [movements, setMovements] = useState([])
  const [loading,   setLoading]   = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [sumRes, movRes] = await Promise.allSettled([
        inventoryApi.getSummary(),
        inventoryApi.listMovements({ limit: 10 }),
      ])
      if (sumRes.status === 'fulfilled') { const d = sumRes.value?.data || sumRes.value; setSummary(d) }
      if (movRes.status === 'fulfilled') { const d = movRes.value?.data || movRes.value; setMovements(Array.isArray(d) ? d : (Array.isArray(d?.movements) ? d.movements : [])) }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  // Compute stats from local inventory if summary not available
  const stats = useMemo(() => {
    if (summary) return summary
    const rows = inventory
    return {
      total_products: rows.length,
      total_physical: rows.reduce((a, r) => a + (parseFloat(r.physical_stock) || parseFloat(r.current_stock) || 0), 0),
      total_available: rows.reduce((a, r) => a + (parseFloat(r.available_stock) || parseFloat(r.current_stock) || 0), 0),
      low_stock: rows.filter(r => { const a = parseFloat(r.available_stock) || 0; const alert = parseFloat(r.low_stock_alert) || 0; return alert > 0 && a <= alert && a > 0 }).length,
      out_of_stock: rows.filter(r => (parseFloat(r.available_stock) || 0) <= 0).length,
      total_value: rows.reduce((a, r) => a + (parseFloat(r.available_stock) || 0) * (parseFloat(r.purchase_rate) || 0), 0),
    }
  }, [summary, inventory])

  // Warehouse breakdown from inventory
  const warehouseStats = useMemo(() => {
    const map = {}
    inventory.forEach(r => {
      const wh = r.warehouse_name || r.warehouse_id?.name || 'Unknown'
      if (!map[wh]) map[wh] = { name: wh, products: 0, total: 0, value: 0 }
      map[wh].products++
      map[wh].total += parseFloat(r.available_stock) || 0
      map[wh].value  += (parseFloat(r.available_stock) || 0) * (parseFloat(r.purchase_rate) || 0)
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [inventory])

  // Low stock items
  const lowStockItems = useMemo(() =>
    inventory.filter(r => {
      const avail = parseFloat(r.available_stock) || 0
      const alert = parseFloat(r.low_stock_alert) || 0
      return alert > 0 && avail <= alert && avail > 0
    }).slice(0, 8)
  , [inventory])

  const outOfStock = useMemo(() => inventory.filter(r => (parseFloat(r.available_stock) || 0) <= 0).slice(0, 8), [inventory])

  const kpis = [
    { label: 'Total Products', value: fmtN(stats?.total_products || inventory.length), icon: Package,     color: '#2563EB', bg: '#EFF6FF' },
    { label: 'Available Stock', value: fmtN(stats?.total_available || 0),              icon: Boxes,       color: '#059669', bg: '#ECFDF5' },
    { label: 'Low Stock',       value: fmtN(stats?.low_stock || lowStockItems.length), icon: AlertTriangle,color:'#D97706', bg: '#FEF3C7' },
    { label: 'Out of Stock',    value: fmtN(stats?.out_of_stock || outOfStock.length), icon: TrendingDown, color: '#DC2626', bg: '#FEF2F2' },
    { label: 'Warehouses',      value: fmtN(warehouses.length || warehouseStats.length),icon: Warehouse,   color: '#7C3AED', bg: '#F5F3FF' },
    { label: 'Stock Value',     value: fmtC(stats?.total_value || 0),                  icon: BarChart3,   color: '#059669', bg: '#ECFDF5' },
  ]

  return (
    <div>
      <div className="breadcrumb"><span>Inventory</span><span className="breadcrumb-sep">›</span><span className="breadcrumb-active">Inventory Dashboard</span></div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Boxes size={22} color="#F26522" /> Inventory Dashboard</div>
          <div className="page-desc">Real-time overview of stock levels, movements and warehouse status</div>
        </div>
        <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh</button>
      </div>

      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
        {kpis.map(k => (
          <div key={k.label} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <k.icon size={22} color={k.color} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: k.color, marginTop: 2 }}>{k.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
        {/* Low Stock */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <AlertTriangle size={16} color="#D97706" />
            <span style={{ fontWeight: 800, fontSize: 14, color: '#1E2D4A' }}>Low Stock Items</span>
            <span style={{ background: '#FEF3C7', color: '#D97706', borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: 700, marginLeft: 'auto' }}>{lowStockItems.length}</span>
          </div>
          {lowStockItems.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94A3B8', padding: '24px 0', fontSize: 13 }}>All stock levels are healthy</div>
          ) : lowStockItems.map((r, i) => {
            const avail = parseFloat(r.available_stock) || 0
            const alert = parseFloat(r.low_stock_alert) || 0
            const pct = alert > 0 ? Math.min(100, (avail / alert) * 100) : 100
            return (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                  <span style={{ fontWeight: 600, color: '#1E2D4A' }}>{r.product_name || '—'}</span>
                  <span style={{ color: '#D97706', fontWeight: 700 }}>{fmtN(avail)} / {fmtN(alert)}</span>
                </div>
                <div style={{ height: 6, background: '#FEF3C7', borderRadius: 3 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: pct < 25 ? '#DC2626' : '#D97706', borderRadius: 3 }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Out of Stock */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <TrendingDown size={16} color="#DC2626" />
            <span style={{ fontWeight: 800, fontSize: 14, color: '#1E2D4A' }}>Out of Stock</span>
            <span style={{ background: '#FEF2F2', color: '#DC2626', borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: 700, marginLeft: 'auto' }}>{outOfStock.length}</span>
          </div>
          {outOfStock.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94A3B8', padding: '24px 0', fontSize: 13 }}>No out-of-stock items</div>
          ) : outOfStock.map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F5F9', fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: '#1E2D4A' }}>{r.product_name || '—'}</span>
              <span style={{ color: '#64748B' }}>{r.warehouse_name || '—'}</span>
              <span style={{ background: '#FEF2F2', color: '#DC2626', fontWeight: 700, fontSize: 11, padding: '1px 8px', borderRadius: 8 }}>OUT</span>
            </div>
          ))}
        </div>
      </div>

      {/* Warehouse Stock */}
      <div className="card" style={{ padding: '18px 20px' }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: '#1E2D4A', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Warehouse size={16} color="#F26522" /> Warehouse-wise Stock
        </div>
        {warehouseStats.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#94A3B8', padding: 24 }}>No warehouse data</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
            {warehouseStats.map((w, i) => (
              <div key={i} style={{ background: '#F8FAFC', borderRadius: 10, padding: '14px 16px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontWeight: 700, color: '#1E2D4A', marginBottom: 8 }}>{w.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748B', marginBottom: 4 }}>
                  <span>Products</span><b style={{ color: '#1E2D4A' }}>{w.products}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748B', marginBottom: 4 }}>
                  <span>Total Stock</span><b style={{ color: '#059669' }}>{fmtN(w.total)}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748B' }}>
                  <span>Value</span><b style={{ color: '#F26522' }}>{fmtC(w.value)}</b>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
