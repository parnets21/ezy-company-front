import { useState, useCallback, useEffect } from 'react'
import {
  Download, FileText, BarChart3, TrendingUp, Package, Users,
  ShoppingBag, Receipt, UserCog, RefreshCw, AlertCircle,
  FileSpreadsheet, CheckCircle, ChevronLeft, ChevronRight,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from 'recharts'
import { reportApi } from '../api/systemApi'
import { profitLossApi } from '../api/financeApi'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

const PAGE_SIZE = 10

// ── Report type config ────────────────────────────────────────
const REPORT_TYPES = [
  { key: 'sales',     label: 'Sales Report',     icon: TrendingUp,     color: '#2563EB', badge: 'badge-blue',   desc: 'Daily/monthly revenue, GST, order count' },
  { key: 'purchase',  label: 'Purchase Report',  icon: ShoppingBag,    color: '#7C3AED', badge: 'badge-purple', desc: 'Supplier-wise purchase & cost analysis' },
  { key: 'expense',   label: 'Expense Report',   icon: Receipt,        color: '#F97316', badge: 'badge-orange', desc: 'Category-wise expenses breakdown' },
  { key: 'profit',    label: 'Profit Report',    icon: BarChart3,      color: '#10B981', badge: 'badge-green',  desc: 'P&L — revenue, cost, net profit' },
  { key: 'customer',  label: 'Customer Report',  icon: Users,          color: '#06B6D4', badge: 'badge-cyan',   desc: 'Top customers, revenue, outstanding' },
  { key: 'supplier',  label: 'Supplier Report',  icon: ShoppingBag,    color: '#8B5CF6', badge: 'badge-purple', desc: 'Supplier purchase totals & payables' },
  { key: 'inventory', label: 'Inventory Report', icon: Package,        color: '#F59E0B', badge: 'badge-yellow', desc: 'Stock levels, low-stock alerts' },
  { key: 'employee',  label: 'Employee Report',  icon: UserCog,        color: '#64748B', badge: 'badge-gray',   desc: 'Employee salary & attendance summary' },
]

const defaultFrom = () => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0] }
const defaultTo   = () => new Date().toISOString().split('T')[0]
const fmt   = (v) => `₹${(parseFloat(v) || 0).toLocaleString('en-IN')}`
const fmtDt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

// ── Column definitions per report type ───────────────────────
const COLUMNS = {
  sales:     [['#','30'],['Period','120'],['Revenue (incl. GST)','150'],['Base Amount','130'],['GST','100'],['Orders','80']],
  purchase:  [['#','30'],['Supplier','150'],['Total Purchase','140'],['Orders','80'],['Last Date','120']],
  expense:   [['#','30'],['Category','140'],['Amount','130'],['Count','80'],['% of Total','120']],
  profit:    [['Item','250'],['Amount','150']],
  customer:  [['#','30'],['Customer','150'],['Orders','80'],['Revenue','130'],['Outstanding','130'],['Last Order','120']],
  supplier:  [['#','30'],['Supplier','150'],['Total Purchase','140'],['Orders','80'],['Outstanding','130'],['Last Date','120']],
  inventory: [['#','30'],['Product','160'],['Code','80'],['Category','120'],['Warehouse','120'],['In','70'],['Out','70'],['Current','90'],['Status','90']],
  employee:  [['#','30'],['Code','70'],['Name','140'],['Department','120'],['Gross','110'],['Deductions','110'],['Net Salary','110'],['Days Present','100'],['Salary Status','110']],
}

function getRows(type, data) {
  const rows = data?.rows || []
  if (type === 'sales') return rows.map((r, i) => [i+1, r.period||'—', fmt(r.total_sales), fmt(r.base_amount), fmt(r.total_gst), r.order_count||0])
  if (type === 'purchase') return rows.map((r, i) => [i+1, r.supplier_name||'—', fmt(r.total), r.count||0, fmtDt(r.last_date)])
  if (type === 'expense') {
    const total = Math.max(rows.reduce((a, r) => a + (r.total||0), 0), 1)
    return rows.map((r, i) => [i+1, r.category||'—', fmt(r.total), r.count||0, `${(((r.total||0)/total)*100).toFixed(1)}%`])
  }
  if (type === 'profit') return [
    ['Sales Revenue',          fmt(data.totalSales)],
    ['(-) Purchase Cost',      fmt(data.totalPurchase)],
    ['(-) Operating Expenses', fmt(data.operatingExpenses)],
    ['(-) Salary',             fmt(data.totalSalary)],
    ['(-) Marketing',          fmt(data.marketingCost)],
    ['= Gross Profit',         fmt(data.grossProfit)],
    ['= Net Profit',           fmt(data.netProfit)],
  ]
  if (type === 'customer') return rows.map((r, i) => [i+1, r.customer_name||'—', r.order_count||0, fmt(r.total_sales), fmt(r.outstanding), fmtDt(r.last_order)])
  if (type === 'supplier') return rows.map((r, i) => [i+1, r.supplier_name||'—', fmt(r.total), r.count||0, fmt(r.outstanding), fmtDt(r.last_date)])
  if (type === 'inventory') {
    return rows.map((r, i) => {
      const st = r.current_stock === 0 ? 'Out of Stock' : r.current_stock <= r.low_stock_alert ? 'Low Stock' : 'In Stock'
      return [i+1, r.product_name||'—', r.product_code||'—', r.category_name||'—', r.warehouse_name||'—', r.stock_in||0, r.stock_out||0, r.current_stock||0, st]
    })
  }
  if (type === 'employee') return rows.map((r, i) => [i+1, r.emp_code||'—', r.name||'—', r.department||'—', fmt(r.gross_salary), fmt(r.total_deductions), fmt(r.net_salary), r.present_days||0, r.status||'Pending'])
  return []
}

// ── PDF export ────────────────────────────────────────────────
function exportPDF(type, data, label, dateFrom, dateTo) {
  const doc      = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const colDefs  = COLUMNS[type] || []
  const head     = [colDefs.map(c => c[0])]
  const body     = getRows(type, data)
  const pageW    = doc.internal.pageSize.getWidth()

  // Header gradient bar
  doc.setFillColor(1, 21, 45)
  doc.rect(0, 0, pageW, 20, 'F')
  doc.setFillColor(253, 92, 2)
  doc.rect(pageW - 60, 0, 60, 20, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14); doc.setFont('helvetica', 'bold')
  doc.text('EzyEnquiry ERP', 10, 8)
  doc.setFontSize(10); doc.setFont('helvetica', 'normal')
  doc.text(label, 10, 14)
  doc.setFontSize(9)
  doc.text(`${dateFrom}  →  ${dateTo}`, pageW - 58, 8)
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, pageW - 58, 14)

  autoTable(doc, {
    head, body,
    startY: 24,
    styles: { fontSize: 9, cellPadding: 3, font: 'helvetica' },
    headStyles: { fillColor: [1, 21, 45], textColor: 255, fontStyle: 'bold', halign: 'left' },
    alternateRowStyles: { fillColor: [248, 250, 255] },
    columnStyles: Object.fromEntries(colDefs.map((c, i) => [i, { cellWidth: parseFloat(c[1]) * 0.35 }])),
    tableLineColor: [203, 213, 225], tableLineWidth: 0.1,
    didDrawPage: (d) => {
      const pg = doc.internal.getNumberOfPages()
      doc.setFontSize(8); doc.setTextColor(148, 163, 184)
      doc.text(`Page ${d.pageNumber} of ${pg}`, pageW / 2, doc.internal.pageSize.getHeight() - 5, { align: 'center' })
    },
  })

  doc.save(`${type}_report_${dateFrom}_${dateTo}.pdf`)
}

// ── Excel export ──────────────────────────────────────────────
function exportExcel(type, data, label, dateFrom, dateTo) {
  const colDefs = COLUMNS[type] || []
  const header  = colDefs.map(c => c[0])
  const rows    = getRows(type, data)
  const ws      = XLSX.utils.aoa_to_sheet([header, ...rows])

  // Column widths
  ws['!cols'] = colDefs.map(c => ({ wch: Math.max(12, Math.floor(parseFloat(c[1]) / 6)) }))

  // Style header row bold (basic)
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  for (let C = range.s.c; C <= range.e.c; C++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })]
    if (cell) { cell.s = { font: { bold: true }, fill: { patternType: 'solid', fgColor: { rgb: '01152D' } } } }
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, label.slice(0, 31))

  // Summary sheet for non-detail reports
  if (['sales','purchase','expense','customer','supplier'].includes(type)) {
    const totals = data?.totals || {}
    const summaryData = [
      ['Report', label],
      ['Period', `${dateFrom} to ${dateTo}`],
      ['Generated', new Date().toLocaleString('en-IN')],
      [],
      ...Object.entries(totals).map(([k, v]) => [k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), typeof v === 'number' ? v : String(v)]),
    ]
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')
  }

  XLSX.writeFile(wb, `${type}_report_${dateFrom}_${dateTo}.xlsx`)
}

export default function ReportCenter() {
  const [selected,    setSelected]    = useState('sales')
  const [dateFrom,    setDateFrom]    = useState(defaultFrom)
  const [dateTo,      setDateTo]      = useState(defaultTo)
  const [groupBy,     setGroupBy]     = useState('month')
  const [empMonth,    setEmpMonth]    = useState(new Date().getMonth() + 1)
  const [empYear,     setEmpYear]     = useState(new Date().getFullYear())
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)
  const [reportData,  setReportData]  = useState(null)
  const [successMsg,  setSuccessMsg]  = useState('')

  const currentReport = REPORT_TYPES.find(r => r.key === selected)

  const fetchReport = useCallback(async () => {
    setLoading(true); setError(null); setReportData(null)
    try {
      let res
      if (selected === 'sales')     res = await reportApi.getSalesReport({ from_date: dateFrom, to_date: dateTo, group_by: groupBy })
      else if (selected === 'purchase')  res = await reportApi.getPurchaseReport({ from_date: dateFrom, to_date: dateTo })
      else if (selected === 'expense')   res = await reportApi.getExpenseReport({ from_date: dateFrom, to_date: dateTo })
      else if (selected === 'profit')    res = await profitLossApi.get({ from_date: dateFrom, to_date: dateTo })
      else if (selected === 'customer')  res = await reportApi.getCustomerReport({ from_date: dateFrom, to_date: dateTo })
      else if (selected === 'supplier')  res = await reportApi.getSupplierReport({ from_date: dateFrom, to_date: dateTo })
      else if (selected === 'inventory') res = await reportApi.getInventoryReport()
      else if (selected === 'employee')  res = await reportApi.getEmployeeReport({ month: empMonth, year: empYear })
      setReportData(res?.data || res)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load report.')
    } finally {
      setLoading(false)
    }
  }, [selected, dateFrom, dateTo, groupBy, empMonth, empYear])

  const handleExport = (format) => {
    if (!reportData) { fetchReport(); return }
    const label = currentReport?.label || selected
    if (format === 'pdf')   exportPDF(selected, reportData, label, dateFrom, dateTo)
    if (format === 'excel') exportExcel(selected, reportData, label, dateFrom, dateTo)
    setSuccessMsg(`${format.toUpperCase()} exported!`)
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  const rows = reportData?.rows || []
  const totals = reportData?.totals || {}

  return (
    <>
      <div className="breadcrumb">
        <span>Reports</span><span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-active">Report Center</span>
      </div>

      {successMsg && (
        <div className="alert alert-info" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle style={{ color: 'var(--success)', width: 16 }} />
          <span style={{ fontWeight: 600 }}>{successMsg}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, alignItems: 'start' }}>

        {/* ── Left: Report selector ── */}
        <div className="card" style={{ position: 'sticky', top: 16 }}>
          <div className="card-header" style={{ padding: '12px 16px' }}>
            <span className="card-title">Reports</span>
          </div>
          <div style={{ padding: '4px 0 8px' }}>
            {REPORT_TYPES.map(r => {
              const Icon = r.icon
              const active = selected === r.key
              return (
                <button key={r.key}
                  onClick={() => { setSelected(r.key); setReportData(null); setError(null) }}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%',
                    padding: '10px 16px', border: 'none', cursor: 'pointer', textAlign: 'left',
                    background: active ? r.color + '12' : 'transparent',
                    borderLeft: `3px solid ${active ? r.color : 'transparent'}`,
                    transition: 'all .15s',
                  }}>
                  <Icon style={{ width: 16, color: active ? r.color : 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? r.color : 'var(--text)' }}>
                      {r.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>
                      {r.desc}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Right: Filters + Output ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Filter bar */}
          <div className="card">
            <div className="card-body" style={{ padding: '14px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>

                {selected !== 'inventory' && selected !== 'employee' && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>From</label>
                      <input type="date" className="form-control" value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)} style={{ width: 150 }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>To</label>
                      <input type="date" className="form-control" value={dateTo}
                        onChange={e => setDateTo(e.target.value)} style={{ width: 150 }} />
                    </div>
                  </>
                )}

                {selected === 'sales' && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[['day','Daily'],['month','Monthly']].map(([g, l]) => (
                      <button key={g} className={`btn btn-sm ${groupBy === g ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setGroupBy(g)}>{l}</button>
                    ))}
                  </div>
                )}

                {selected === 'employee' && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Month</label>
                      <select className="form-control" style={{ width: 110 }} value={empMonth}
                        onChange={e => setEmpMonth(Number(e.target.value))}>
                        {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                          <option key={i} value={i + 1}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Year</label>
                      <input type="number" className="form-control" style={{ width: 90 }} value={empYear}
                        onChange={e => setEmpYear(Number(e.target.value))} min={2020} max={2035} />
                    </div>
                  </>
                )}

                {selected === 'inventory' && (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Shows current live stock</span>
                )}

                <button className="btn btn-primary" onClick={fetchReport} disabled={loading}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <RefreshCw style={{ width: 13, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                  {loading ? 'Loading…' : 'Generate Report'}
                </button>

                {reportData && (
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleExport('pdf')}
                      style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <FileText style={{ width: 13, color: '#EF4444' }} /> Export PDF
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleExport('excel')}
                      style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <FileSpreadsheet style={{ width: 13, color: '#10B981' }} /> Export Excel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="alert alert-danger" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle style={{ width: 16 }} />{error}
            </div>
          )}

          {/* Empty state */}
          {!reportData && !loading && !error && (
            <div className="card">
              <div className="card-body" style={{ textAlign: 'center', padding: '48px 24px' }}>
                <BarChart3 style={{ width: 48, height: 48, margin: '0 auto 16px', color: 'var(--text-light)', display: 'block' }} />
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Select a report and click Generate</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                  Set the date range, then click <strong>Generate Report</strong>. Export as PDF or Excel once generated.
                </div>
                <button className="btn btn-primary" onClick={fetchReport}>
                  <RefreshCw style={{ width: 13 }} /> Generate Now
                </button>
              </div>
            </div>
          )}

          {/* Summary KPI bar */}
          {reportData && totals && Object.keys(totals).length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              {Object.entries(totals).map(([k, v]) => (
                <div key={k} className="stat-card" style={{ padding: '12px 16px' }}>
                  <div className="stat-info">
                    <div className="stat-label" style={{ textTransform: 'capitalize' }}>
                      {k.replace(/_/g, ' ')}
                    </div>
                    <div className="stat-value" style={{ fontSize: 16 }}>
                      {typeof v === 'number' && k.toLowerCase().includes('total') && !k.includes('count') && !k.includes('days') && !k.includes('paid')
                        ? fmt(v) : typeof v === 'number' ? v.toLocaleString() : String(v)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Chart */}
          {reportData && ['sales', 'purchase', 'expense'].includes(selected) && rows.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">{currentReport?.label} — Chart</span>
                <span className="badge" style={{ background: (currentReport?.color || '#2563EB') + '18', color: currentReport?.color }}>
                  {rows.length} records
                </span>
              </div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={rows.map(r => ({
                      label: r.period || r.supplier_name || r.category || '—',
                      value: r.total_sales || r.total || r.amount || 0,
                    }))}
                    barSize={selected === 'expense' ? 20 : 14}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={v => fmt(v)} />
                    <Bar dataKey="value" fill={currentReport?.color || 'var(--primary)'} radius={[4, 4, 0, 0]} name={currentReport?.label} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* P&L chart */}
          {reportData && selected === 'profit' && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">P&L Overview</span>
                <span className="badge badge-green">Live</span>
              </div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart barSize={32} data={[
                    { label: 'Revenue',  value: reportData.totalSales    || 0, fill: '#2563EB' },
                    { label: 'Purchase', value: reportData.totalPurchase || 0, fill: '#EF4444' },
                    { label: 'Expenses', value: reportData.totalExpenses || 0, fill: '#F97316' },
                    { label: 'Net Profit',value:reportData.netProfit     || 0, fill: '#10B981' },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={v => fmt(v)} />
                    <Bar dataKey="value" name="Amount" radius={[4,4,0,0]}>
                      {[
                        { label: 'Revenue', fill: '#2563EB' },
                        { label: 'Purchase', fill: '#EF4444' },
                        { label: 'Expenses', fill: '#F97316' },
                        { label: 'Net Profit', fill: '#10B981' },
                      ].map((entry, i) => (
                        <rect key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Data table */}
          {reportData && <ReportTable type={selected} data={reportData} color={currentReport?.color} />}
        </div>
      </div>
    </>
  )
}

// ── Report Table ──────────────────────────────────────────────
function ReportTable({ type, data, color }) {
  const rows   = data?.rows || []
  const totals = data?.totals || {}
  const fmt    = (v) => `₹${(parseFloat(v) || 0).toLocaleString('en-IN')}`
  const fmtDt  = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  // ── Pagination (10 rows per page) ──────────────────────────
  const [page, setPage] = useState(1)
  useEffect(() => { setPage(1) }, [type, rows.length])
  const total       = rows.length
  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage    = Math.min(page, totalPages)
  const offset      = (safePage - 1) * PAGE_SIZE
  const paged       = rows.slice(offset, safePage * PAGE_SIZE)
  const Pager = () => totalPages <= 1 ? null : (
    <div className="pagination">
      <span className="pagination-info">
        {offset + 1}–{Math.min(safePage * PAGE_SIZE, total)} of {total}
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

  if (type === 'profit') {
    return (
      <div className="card">
        <div className="card-header">
          <span className="card-title">P&L Statement</span>
          <span className="badge badge-green">Live Data</span>
        </div>
        <div className="card-body" style={{ padding: '0 20px 16px' }}>
          <table style={{ width: '100%', maxWidth: 500, borderCollapse: 'collapse' }}>
            <tbody>
              {[
                { label: 'Sales Revenue',          val: data.totalSales,        indent: false, bold: false, color: 'var(--success)' },
                { label: '(-) Purchase / COGS',    val: data.totalPurchase,     indent: true,  bold: false, color: 'var(--danger)' },
                { label: '(-) Operating Expenses', val: data.operatingExpenses, indent: true,  bold: false, color: 'var(--danger)' },
                { label: '(-) Salary / Payroll',   val: data.totalSalary,       indent: true,  bold: false, color: 'var(--danger)' },
                { label: '(-) Marketing Cost',     val: data.marketingCost,     indent: true,  bold: false, color: 'var(--danger)' },
                { label: '= Gross Profit',         val: data.grossProfit,       indent: false, bold: true,  color: 'var(--primary)' },
                { label: '= Net Profit',           val: data.netProfit,         indent: false, bold: true,  color: (data.netProfit||0) >= 0 ? 'var(--success)' : 'var(--danger)' },
              ].map((r, i) => (
                <tr key={i} style={{ background: r.bold ? 'var(--bg)' : 'transparent' }}>
                  <td style={{ padding: '9px 6px', borderBottom: '1px solid var(--border)', fontWeight: r.bold ? 700 : 400, paddingLeft: r.indent ? 24 : 6 }}>{r.label}</td>
                  <td style={{ padding: '9px 6px', borderBottom: '1px solid var(--border)', textAlign: 'right', fontWeight: r.bold ? 800 : 500, color: r.color }}>
                    {fmt(r.val || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (!rows.length) {
    return (
      <div className="card">
        <div className="card-body" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
          No data found for selected period.
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Report Data</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="badge" style={{ background: (color||'#2563EB') + '18', color: color || '#2563EB' }}>
            {rows.length} records
          </span>
          {totals.total && (
            <span className="badge badge-green">Total: {fmt(totals.total)}</span>
          )}
        </div>
      </div>
      <div className="table-wrap">
        {/* Sales */}
        {type === 'sales' && (
          <table>
            <thead><tr><th>#</th><th>Period</th><th>Revenue (incl. GST)</th><th>Base Amount</th><th>GST</th><th>Orders</th></tr></thead>
            <tbody>
              {paged.map((r, i) => (
                <tr key={i}>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{offset + i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{r.period || '—'}</td>
                  <td style={{ fontWeight: 700, color: 'var(--success)' }}>{fmt(r.total_sales)}</td>
                  <td>{fmt(r.base_amount)}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{fmt(r.total_gst)}</td>
                  <td style={{ fontWeight: 600 }}>{r.order_count || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Purchase */}
        {type === 'purchase' && (
          <table>
            <thead><tr><th>#</th><th>Supplier</th><th>Total Purchase</th><th>Orders</th><th>Last Date</th></tr></thead>
            <tbody>
              {paged.map((r, i) => (
                <tr key={i}>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{offset + i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{r.supplier_name || '—'}</td>
                  <td style={{ fontWeight: 700, color: '#7C3AED' }}>{fmt(r.total)}</td>
                  <td>{r.count || 0}</td>
                  <td style={{ fontSize: 12 }}>{fmtDt(r.last_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Expense */}
        {type === 'expense' && (
          <table>
            <thead><tr><th>#</th><th>Category</th><th>Amount</th><th>Count</th><th>% of Total</th></tr></thead>
            <tbody>
              {paged.map((r, i) => {
                const total = Math.max(rows.reduce((a, x) => a + (x.total || 0), 0), 1)
                const pct = (((r.total || 0) / total) * 100).toFixed(1)
                return (
                  <tr key={i}>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{offset + i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{r.category || '—'}</td>
                    <td style={{ fontWeight: 700, color: 'var(--danger)' }}>{fmt(r.total)}</td>
                    <td>{r.count || 0}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="progress-bar" style={{ flex: 1 }}>
                          <div className="progress-fill" style={{ width: `${pct}%`, background: '#EF4444' }} />
                        </div>
                        <span style={{ fontSize: 11, width: 36 }}>{pct}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {/* Customer */}
        {type === 'customer' && (
          <table>
            <thead><tr><th>#</th><th>Customer</th><th>Orders</th><th>Revenue</th><th>Outstanding</th><th>Last Order</th></tr></thead>
            <tbody>
              {paged.map((r, i) => (
                <tr key={i}>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{offset + i + 1}</td>
                  <td style={{ fontWeight: 700 }}>{r.customer_name || '—'}</td>
                  <td style={{ fontWeight: 600 }}>{r.order_count || 0}</td>
                  <td style={{ fontWeight: 700, color: 'var(--success)' }}>{fmt(r.total_sales)}</td>
                  <td style={{ fontWeight: 700, color: (r.outstanding||0) > 0 ? 'var(--danger)' : 'var(--success)' }}>{fmt(r.outstanding)}</td>
                  <td style={{ fontSize: 12 }}>{fmtDt(r.last_order)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Supplier */}
        {type === 'supplier' && (
          <table>
            <thead><tr><th>#</th><th>Supplier</th><th>Total Purchase</th><th>Orders</th><th>Outstanding</th><th>Last Date</th></tr></thead>
            <tbody>
              {paged.map((r, i) => (
                <tr key={i}>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{offset + i + 1}</td>
                  <td style={{ fontWeight: 700 }}>{r.supplier_name || '—'}</td>
                  <td style={{ fontWeight: 700, color: '#7C3AED' }}>{fmt(r.total)}</td>
                  <td>{r.count || 0}</td>
                  <td style={{ fontWeight: 700, color: (r.outstanding||0) > 0 ? 'var(--danger)' : 'var(--success)' }}>{fmt(r.outstanding)}</td>
                  <td style={{ fontSize: 12 }}>{fmtDt(r.last_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Inventory */}
        {type === 'inventory' && (
          <table>
            <thead>
              <tr><th>#</th><th>Product</th><th>Code</th><th>Category</th><th>Warehouse</th><th>In</th><th>Out</th><th>Current Stock</th><th>Status</th></tr>
            </thead>
            <tbody>
              {paged.map((r, i) => {
                const st = r.current_stock === 0 ? 'Out' : r.current_stock <= r.low_stock_alert ? 'Low' : 'OK'
                return (
                  <tr key={i}>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{offset + i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{r.product_name || '—'}</td>
                    <td style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--primary)' }}>{r.product_code || '—'}</td>
                    <td style={{ fontSize: 12 }}>{r.category_name || '—'}</td>
                    <td style={{ fontSize: 12 }}>{r.warehouse_name || '—'}</td>
                    <td style={{ color: 'var(--success)', fontWeight: 600 }}>+{r.stock_in || 0}</td>
                    <td style={{ color: 'var(--danger)', fontWeight: 600 }}>-{r.stock_out || 0}</td>
                    <td style={{ fontWeight: 800, color: st === 'Out' ? 'var(--danger)' : st === 'Low' ? 'var(--warning)' : 'var(--text)' }}>
                      {r.current_stock || 0}
                    </td>
                    <td>
                      <span className={`badge ${st === 'OK' ? 'badge-green' : st === 'Low' ? 'badge-yellow' : 'badge-red'}`}>
                        {st === 'OK' ? 'In Stock' : st === 'Low' ? 'Low Stock' : 'Out of Stock'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {/* Employee */}
        {type === 'employee' && (
          <table>
            <thead>
              <tr><th>#</th><th>Code</th><th>Name</th><th>Department</th><th>Gross</th><th>Deductions</th><th>Net Salary</th><th>Present Days</th><th>Status</th></tr>
            </thead>
            <tbody>
              {paged.map((r, i) => (
                <tr key={i}>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{offset + i + 1}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.emp_code || '—'}</td>
                  <td style={{ fontWeight: 700 }}>{r.name || '—'}</td>
                  <td style={{ fontSize: 12 }}>{r.department || '—'}</td>
                  <td style={{ fontWeight: 600 }}>{fmt(r.gross_salary)}</td>
                  <td style={{ color: 'var(--danger)' }}>{fmt(r.total_deductions)}</td>
                  <td style={{ fontWeight: 700, color: 'var(--success)' }}>{fmt(r.net_salary)}</td>
                  <td style={{ textAlign: 'center' }}>{r.present_days || 0}</td>
                  <td>
                    <span className={`badge ${r.status === 'Paid' ? 'badge-green' : 'badge-yellow'}`}>{r.status || 'Pending'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Pager />
    </div>
  )
}
