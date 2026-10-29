import { useState, useMemo } from 'react'
import { FileBarChart, Search, Filter, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { purchaseReportApi } from '../api/purchaseInventoryApi'

const PAGE_SIZE = 10

const REPORT_TYPES = [
  { key: 'register',    label: 'Purchase Register',    fn: p => purchaseReportApi.purchaseRegister(p) },
  { key: 'supplier',    label: 'Supplier-wise',        fn: p => purchaseReportApi.supplierWise(p) },
  { key: 'product',     label: 'Product-wise',         fn: p => purchaseReportApi.productWise(p) },
  { key: 'pending_po',  label: 'Pending POs',          fn: p => purchaseReportApi.pendingPOs(p) },
  { key: 'grn',         label: 'GRN Report',           fn: p => purchaseReportApi.grnReport(p) },
  { key: 'returns',     label: 'Purchase Returns',     fn: p => purchaseReportApi.returnReport(p) },
  { key: 'outstanding', label: 'Supplier Outstanding', fn: p => purchaseReportApi.supplierOutstanding(p) },
]

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtN    = n => Number(n || 0).toLocaleString('en-IN')
const fmtC    = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })

export default function PurchaseReports({ purchases = [], products = [], suppliers = [], warehouses = [] }) {
  const [activeReport, setActiveReport] = useState('register')
  const [fromDate,     setFromDate]     = useState('')
  const [toDate,       setToDate]       = useState('')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [productFilter,  setProductFilter]  = useState('')
  const [data,         setData]         = useState([])
  const [loading,      setLoading]      = useState(false)
  const [search,       setSearch]       = useState('')
  const [error,        setError]        = useState('')
  const [page,         setPage]         = useState(1)

  const runReport = async () => {
    setLoading(true); setError('')
    try {
      const params = {}
      if (fromDate)       params.from_date   = fromDate
      if (toDate)         params.to_date     = toDate
      if (supplierFilter) params.supplier_id = supplierFilter
      if (productFilter)  params.product_id  = productFilter
      const rpt  = REPORT_TYPES.find(r => r.key === activeReport)
      const res  = await rpt.fn(params)
      const d    = res?.data || res
      setData(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : []))
    } catch {
      setError('Report generation failed or backend endpoint not yet available.')
      // Fallback: derive from local purchases prop
      setData(purchases.slice(0, 50))
    }
    finally { setLoading(false); setPage(1) }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data
    return data.filter(r => Object.values(r).some(v => String(v || '').toLowerCase().includes(q)))
  }, [data, search])

  const columns = useMemo(() => {
    if (!filtered.length) return []
    const keys = Object.keys(filtered[0]).filter(k => !['_id','__v','company_id'].includes(k))
    return keys.slice(0, 10)
  }, [filtered])

  // ── Pagination (10 rows per page) ──────────────────────────
  const total       = filtered.length
  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage    = Math.min(page, totalPages)
  const paged       = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return (
    <div>
      <div className="breadcrumb"><span>Purchase</span><span className="breadcrumb-sep">›</span><span className="breadcrumb-active">Purchase Reports</span></div>
      <div style={{ marginBottom: 20 }}>
        <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FileBarChart size={22} color="#F26522" /> Purchase Reports</div>
        <div className="page-desc">Generate purchase analysis reports with date and filter options</div>
      </div>

      {/* Report Selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        {REPORT_TYPES.map(r => (
          <button key={r.key} onClick={() => { setActiveReport(r.key); setData([]); setPage(1) }} style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid', fontWeight: 600, fontSize: 13, cursor: 'pointer', background: activeReport === r.key ? '#1E2D4A' : '#fff', color: activeReport === r.key ? '#fff' : '#1E2D4A', borderColor: activeReport === r.key ? '#1E2D4A' : '#E2E8F0' }}>
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
            <label className="form-label">Supplier</label>
            <select className="form-control" value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)}>
              <option value="">All Suppliers</option>
              {suppliers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Product</label>
            <select className="form-control" value={productFilter} onChange={e => setProductFilter(e.target.value)}>
              <option value="">All Products</option>
              {products.map(p => <option key={p._id || p.id} value={p._id || p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={runReport} disabled={loading}>
            <Filter size={14} /> {loading ? 'Generating…' : 'Generate Report'}
          </button>
          <button className="btn btn-secondary" onClick={() => { setFromDate(''); setToDate(''); setSupplierFilter(''); setProductFilter(''); setData([]); setPage(1) }}>Clear</button>
          {data.length > 0 && (
            <span style={{ fontSize: 12, color: '#64748B', marginLeft: 8 }}>{filtered.length} records</span>
          )}
        </div>
      </div>

      {error && (
        <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 16px', marginBottom: 14, fontSize: 13, color: '#92400E' }}>{error}</div>
      )}

      {data.length > 0 && (
        <>
          <div className="card" style={{ padding: '12px 18px', marginBottom: 14 }}>
            <div style={{ position: 'relative', maxWidth: 320 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
              <input className="form-control" style={{ paddingLeft: 32 }} placeholder="Search results…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
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
                {paged.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }} onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={{ padding: '9px 12px', color: '#94A3B8' }}>{(safePage - 1) * PAGE_SIZE + i + 1}</td>
                    {columns.map(c => (
                      <td key={c} style={{ padding: '9px 12px' }}>
                        {typeof row[c] === 'number' && c.includes('amount') ? fmtC(row[c])
                        : typeof row[c] === 'number' ? fmtN(row[c])
                        : row[c] && String(row[c]).match(/^\d{4}-\d{2}-\d{2}/) ? fmtDate(row[c])
                        : String(row[c] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
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
        </>
      )}

      {!loading && data.length === 0 && (
        <div className="card" style={{ padding: '48px 0', textAlign: 'center', color: '#94A3B8' }}>
          <FileBarChart size={40} style={{ opacity: 0.3, marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
          <div style={{ fontSize: 15, fontWeight: 600 }}>Select a report type and click Generate</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Apply date and filter options to narrow down results</div>
        </div>
      )}
    </div>
  )
}
