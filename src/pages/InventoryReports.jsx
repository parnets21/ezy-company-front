import { useState, useMemo } from 'react'
import { PieChart, Search, Filter } from 'lucide-react'
import { inventoryReportApi } from '../api/purchaseInventoryApi'

const REPORT_TYPES = [
  { key: 'current_stock', label: 'Current Stock',    fn: p => inventoryReportApi.currentStock(p) },
  { key: 'valuation',     label: 'Stock Valuation',  fn: p => inventoryReportApi.stockValuation(p) },
  { key: 'low_stock',     label: 'Low Stock',        fn: p => inventoryReportApi.lowStock(p) },
  { key: 'movements',     label: 'Movement Report',  fn: p => inventoryReportApi.movementReport(p) },
  { key: 'damage',        label: 'Damage Report',    fn: p => inventoryReportApi.damageReport(p) },
  { key: 'batch',         label: 'Batch Report',     fn: p => inventoryReportApi.batchReport(p) },
  { key: 'transfers',     label: 'Transfer Report',  fn: p => inventoryReportApi.transferReport(p) },
]

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtN    = n => Number(n || 0).toLocaleString('en-IN')
const fmtC    = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })

export default function InventoryReports({ inventory = [], products = [], warehouses = [] }) {
  const [activeReport, setActiveReport] = useState('current_stock')
  const [fromDate,     setFromDate]     = useState('')
  const [toDate,       setToDate]       = useState('')
  const [warehouseFilter, setWhFilter]  = useState('')
  const [productFilter,   setProFilter] = useState('')
  const [data,         setData]         = useState([])
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [search,       setSearch]       = useState('')

  const runReport = async () => {
    setLoading(true); setError('')
    try {
      const params = {}
      if (fromDate)       params.from_date   = fromDate
      if (toDate)         params.to_date     = toDate
      if (warehouseFilter)params.warehouse_id= warehouseFilter
      if (productFilter)  params.product_id  = productFilter
      const rpt = REPORT_TYPES.find(r => r.key === activeReport)
      const res = await rpt.fn(params)
      const d   = res?.data || res
      setData(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : []))
    } catch {
      setError('Report generation failed or backend endpoint not yet available.')
      // Fallback to local inventory
      if (activeReport === 'current_stock' || activeReport === 'valuation') {
        setData(inventory.slice(0, 50))
      } else {
        setData([])
      }
    }
    finally { setLoading(false) }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data
    return data.filter(r => Object.values(r).some(v => String(v || '').toLowerCase().includes(q)))
  }, [data, search])

  const columns = useMemo(() => {
    if (!filtered.length) return []
    return Object.keys(filtered[0]).filter(k => !['_id','__v','company_id'].includes(k)).slice(0, 10)
  }, [filtered])

  // Summary stats for current stock
  const summaryStats = useMemo(() => {
    if (activeReport !== 'current_stock' && activeReport !== 'valuation') return null
    const rows = filtered.length ? filtered : inventory
    return {
      totalProducts: rows.length,
      totalQty: rows.reduce((a, r) => a + (parseFloat(r.available_stock) || parseFloat(r.current_stock) || 0), 0),
      totalValue: rows.reduce((a, r) => a + (parseFloat(r.available_stock) || 0) * (parseFloat(r.purchase_rate) || 0), 0),
    }
  }, [filtered, inventory, activeReport])

  return (
    <div>
      <div className="breadcrumb"><span>Inventory</span><span className="breadcrumb-sep">›</span><span className="breadcrumb-active">Inventory Reports</span></div>
      <div style={{ marginBottom: 20 }}>
        <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><PieChart size={22} color="#F26522" /> Inventory Reports</div>
        <div className="page-desc">Stock analysis, valuation, movement and batch reports</div>
      </div>

      {/* Report Selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        {REPORT_TYPES.map(r => (
          <button key={r.key} onClick={() => { setActiveReport(r.key); setData([]) }} style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid', fontWeight: 600, fontSize: 13, cursor: 'pointer', background: activeReport === r.key ? '#1E2D4A' : '#fff', color: activeReport === r.key ? '#fff' : '#1E2D4A', borderColor: activeReport === r.key ? '#1E2D4A' : '#E2E8F0' }}>
            {r.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '16px 18px', marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 12 }}>
          <div>
            <label className="form-label">From Date</label>
            <input type="date" className="form-control" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="form-label">To Date</label>
            <input type="date" className="form-control" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Warehouse</label>
            <select className="form-control" value={warehouseFilter} onChange={e => setWhFilter(e.target.value)}>
              <option value="">All Warehouses</option>
              {warehouses.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Product</label>
            <select className="form-control" value={productFilter} onChange={e => setProFilter(e.target.value)}>
              <option value="">All Products</option>
              {products.map(p => <option key={p._id || p.id} value={p._id || p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={runReport} disabled={loading}>
            <Filter size={14} /> {loading ? 'Generating…' : 'Generate Report'}
          </button>
          <button className="btn btn-secondary" onClick={() => { setFromDate(''); setToDate(''); setWhFilter(''); setProFilter(''); setData([]) }}>Clear</button>
          {data.length > 0 && <span style={{ fontSize: 12, color: '#64748B', marginLeft: 8 }}>{filtered.length} records</span>}
        </div>
      </div>

      {error && (
        <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 16px', marginBottom: 14, fontSize: 13, color: '#92400E' }}>{error}</div>
      )}

      {/* Summary for stock reports */}
      {summaryStats && (data.length > 0 || inventory.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 16 }}>
          {[
            { label: 'Total Products', value: fmtN(summaryStats.totalProducts), color: '#2563EB' },
            { label: 'Total Qty',      value: fmtN(summaryStats.totalQty),      color: '#059669' },
            { label: 'Total Value',    value: fmtC(summaryStats.totalValue),    color: '#F26522' },
          ].map(k => (
            <div key={k.label} className="card" style={{ padding: '14px 18px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: k.color, marginTop: 4 }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {data.length > 0 && (
        <>
          <div className="card" style={{ padding: '12px 18px', marginBottom: 14 }}>
            <div style={{ position: 'relative', maxWidth: 320 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
              <input className="form-control" style={{ paddingLeft: 32 }} placeholder="Search results…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#1E2D4A', color: '#fff' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>#</th>
                  {columns.map(c => (
                    <th key={c} style={{ padding: '10px 12px', fontWeight: 700, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                      {c.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }} onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={{ padding: '9px 12px', color: '#94A3B8' }}>{i + 1}</td>
                    {columns.map(c => (
                      <td key={c} style={{ padding: '9px 12px' }}>
                        {typeof row[c] === 'number' && (c.includes('value') || c.includes('amount') || c.includes('rate')) ? fmtC(row[c])
                        : typeof row[c] === 'number' ? fmtN(row[c])
                        : row[c] && String(row[c]).match(/^\d{4}-\d{2}-\d{2}/) ? fmtDate(row[c])
                        : String(row[c] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && data.length === 0 && (
        <div className="card" style={{ padding: '48px 0', textAlign: 'center', color: '#94A3B8' }}>
          <PieChart size={40} style={{ opacity: 0.3, marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
          <div style={{ fontSize: 15, fontWeight: 600 }}>Select a report type and click Generate</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Filter by date range, warehouse, or product to narrow results</div>
        </div>
      )}
    </div>
  )
}
