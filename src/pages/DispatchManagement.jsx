import { useState } from 'react'
import { Search, Truck, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 10

// API field helpers — backend returns snake_case
const disId       = d => d._id             || d.id            || ''
const disCode     = d => d.dispatch_code   || d.id            || ''
const disCustomer = d => d.customer_name   || d.customer      || ''
const disBranch   = d => d.branch_name     || d.branch        || (d.order_id?.branch_name) || ''
const disVehicle  = d => d.vehicle_number  || d.vehicle       || ''
const disDriver   = d => d.driver_name     || d.driver        || ''
const disDriverMob= d => d.driver_mobile   || d.driverMobile  || ''
const disTransport= d => d.transport_name  || d.transport     || ''
const disLR       = d => d.lr_number       || d.lr            || ''
const disOrderId  = d => d.order_id?._id   || d.order_id      || d.orderId || ''
const disOrderCode= d => d.order_id?.order_code || (typeof d.order_id === 'string' ? d.order_id : '') || d.orderId || ''
const disDispDate = d => d.dispatch_date
  ? new Date(d.dispatch_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
  : (d.dispatchDate || '')
const disExpDate  = d => d.expected_delivery
  ? new Date(d.expected_delivery).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
  : (d.expectedDelivery || '—')
const disExpDays  = d => d.expected_delivery_days || null
const disDelDate  = d => d.delivered_date
  ? new Date(d.delivered_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
  : (d.deliveredDate || null)

// product/qty from populated order_id
const disProduct  = d => d.order_id?.product_name || d.order?.product || ''
const disQty      = d => d.order_id?.qty           || d.order?.qty    || ''

const statusColor = {
  Dispatched:  'badge-blue',
  'In Transit':'badge-yellow',
  Delivered:   'badge-green',
  Returned:    'badge-red',
}

export default function DispatchManagement({ branches = [], dispatches = [], orders = [], markDelivered, markInTransit }) {
  const branchNames = branches.map(b => b.name || b).filter(Boolean)
  const [search,       setSearch]     = useState('')
  const [page,         setPage]       = useState(1)
  const [branchFilter, setBranchFilter] = useState('All')
  const [successMsg,   setSuccessMsg] = useState('')

  const toast = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000) }

  const filtered = dispatches.filter(d =>
    (branchFilter === 'All' || disBranch(d) === branchFilter) &&
    (disCustomer(d).toLowerCase().includes(search.toLowerCase()) ||
    disCode(d).includes(search) ||
    disLR(d).includes(search))
  )

  const handleOutForDelivery = (dispatchId) => {
    markInTransit?.(dispatchId)
    toast('Marked Out for Delivery.')
  }

  const handleDelivered = (dispatchId) => {
    markDelivered?.(dispatchId)
    toast(`Delivery confirmed → Sale entry & receivable auto-created!`)
  }

  // Enrich dispatches with flat order info (order_id may be populated object from API)
  const enriched = filtered.map(d => {
    const orderObj = typeof d.order_id === 'object' && d.order_id !== null ? d.order_id : null
    const fallbackOrder = orders.find(o => (o._id || o.id) === (d.order_id || d.orderId))
    return { ...d, _orderObj: orderObj || fallbackOrder }
  })

  // ── Pagination (10 rows per page) ──────────────────────────
  const total       = enriched.length
  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage    = Math.min(page, totalPages)
  const paged       = enriched.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return (
    <>
      <div className="breadcrumb">
        <span>Business</span><span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-active">Dispatch Management</span>
      </div>

      {successMsg && (
        <div className="alert alert-info" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <CheckCircle style={{ color: 'var(--success)', width: 18 }} />
          <span style={{ fontWeight: 600 }}>{successMsg}</span>
        </div>
      )}

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        {[
          { label: 'Total Dispatches', val: dispatches.length,                                                              color: 'blue'   },
          { label: 'In Transit',       val: dispatches.filter(d => d.status === 'In Transit' || d.status === 'Dispatched').length, color: 'orange' },
          { label: 'Delivered',        val: dispatches.filter(d => d.status === 'Delivered').length,                       color: 'green'  },
          { label: 'Returned',         val: dispatches.filter(d => d.status === 'Returned').length,                        color: 'red'    },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ padding: '14px 16px' }}>
            <div className={`stat-icon ${s.color}`}><Truck /></div>
            <div className="stat-info">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ fontSize: 20 }}>{s.val}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Dispatch Records ({filtered.length})</span>
          <div className="header-actions">
            <div className="search-bar">
              <Search />
              <input placeholder="Search by order, LR, customer…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
            </div>
            {branchNames.length > 0 && (
              <select className="form-control" style={{ width: 160 }} value={branchFilter} onChange={e => { setBranchFilter(e.target.value); setPage(1) }}>
                <option value="All">All Branches</option>
                {branchNames.map(b => <option key={b}>{b}</option>)}
              </select>
            )}
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Dispatch ID</th><th>Branch</th><th>Order Ref</th><th>Customer</th><th>Product</th>
                <th>Vehicle</th><th>Driver</th><th>Transport</th><th>LR No.</th>
                <th>Dispatch Date</th><th>Days</th><th>Exp. Delivery</th><th>Delivered On</th>
                <th>Status</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(d => (
                <tr key={disId(d)}>
                  <td style={{ color: 'var(--primary)', fontWeight: 700 }}>{disCode(d)}</td>
                  <td style={{ fontSize: 12 }}>
                    {disBranch(d) ? <span className="badge badge-blue">{disBranch(d)}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td style={{ color: 'var(--primary)', fontSize: 12 }}>{disOrderCode(d) || String(disOrderId(d)).slice(-6)}</td>
                  <td style={{ fontWeight: 600 }}>{disCustomer(d)}</td>
                  <td style={{ fontSize: 12, maxWidth: 160 }}>{disProduct(d) || d._orderObj?.product_name || ''}</td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 12 }}>{disVehicle(d)}</td>
                  <td>
                    <div className="user-name" style={{ fontSize: 12 }}>{disDriver(d)}</div>
                    <div className="user-role">{disDriverMob(d)}</div>
                  </td>
                  <td style={{ fontSize: 12 }}>{disTransport(d)}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{disLR(d)}</td>
                  <td style={{ fontSize: 12 }}>{disDispDate(d)}</td>
                  <td style={{ textAlign: 'center' }}>
                    {disExpDays(d) ? (
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 12,
                        background: 'var(--warning-bg, #FFF3CD)', color: 'var(--warning, #B45309)',
                        fontWeight: 700, fontSize: 12,
                      }}>
                        {disExpDays(d)}d
                      </span>
                    ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--warning)', fontWeight: 600 }}>{disExpDate(d)}</td>
                  <td style={{ fontSize: 12, color: disDelDate(d) ? 'var(--success)' : 'var(--text-muted)', fontWeight: disDelDate(d) ? 600 : 400 }}>
                    {disDelDate(d) || '—'}
                  </td>
                  <td><span className={`badge ${statusColor[d.status] || 'badge-blue'}`}>{d.status}</span></td>
                  <td>
                    {d.status === 'Dispatched' && (
                      <button
                        className="btn btn-primary btn-xs"
                        style={{ fontSize: 11 }}
                        onClick={() => handleOutForDelivery(disId(d))}
                      >
                        <Truck style={{ width: 12 }} />Out for Delivery
                      </button>
                    )}
                    {d.status === 'In Transit' && (
                      <button
                        className="btn btn-primary btn-xs"
                        style={{ background: 'var(--success)', fontSize: 11 }}
                        onClick={() => handleDelivered(disId(d))}
                      >
                        <CheckCircle style={{ width: 12 }} />Delivered
                      </button>
                    )}
                    {d.status === 'Delivered' && (
                      <span className="badge badge-green" style={{ fontSize: 10 }}>✓ Done</span>
                    )}
                    {d.status === 'Returned' && (
                      <span className="badge badge-red" style={{ fontSize: 10 }}>Returned</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={15} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No dispatches found</td></tr>
              )}
            </tbody>
          </table>
        </div>
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
  )
}
