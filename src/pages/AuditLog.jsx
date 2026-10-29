import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ScrollText, RefreshCw, Search, AlertCircle, X,
  PlusCircle, Pencil, Trash2, Activity, Clock, User as UserIcon,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { auditLogApi } from '../api/systemApi'

// ── Action styling (icon + colour per action) ────────────────
const ACTION_META = {
  CREATE: { label: 'Create', Icon: PlusCircle, color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
  UPDATE: { label: 'Update', Icon: Pencil,     color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  DELETE: { label: 'Delete', Icon: Trash2,     color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
}
const actionMeta = (a) => ACTION_META[a] || { label: a || '—', Icon: Activity, color: '#64748B', bg: '#F1F5F9', border: '#E2E8F0' }

// A 2xx status is a success; everything else is treated as a failure.
const statusOk = (code) => Number(code) >= 200 && Number(code) < 300

// Turn a module key into a readable, singular-ish label: "companies" → "Company",
// "stock_transfer" → "Stock Transfer".
const SINGULAR = {
  companies: 'company', suppliers: 'supplier', products: 'product', users: 'user',
  customers: 'customer', leads: 'lead', followups: 'follow-up', orders: 'order',
  enquiries: 'enquiry', dispatches: 'dispatch', branches: 'branch', warehouses: 'warehouse',
  invoices: 'invoice', quotations: 'quotation', payments: 'payment', expenses: 'expense',
  sales: 'sale', purchases: 'purchase', notifications: 'notification', documents: 'document',
  employees: 'employee', subscriptions: 'subscription',
}
function moduleLabel(module) {
  const key = String(module || '').toLowerCase()
  const base = SINGULAR[key] || key.replace(/_/g, ' ')
  if (!base) return 'record'
  return base
}

// Build a plain-English activity sentence from the audit row, e.g.
// "Created a supplier", "Updated a company", "Deleted a notification".
function describeActivity(l) {
  const verbs = { CREATE: 'Created', UPDATE: 'Updated', DELETE: 'Deleted' }
  const verb = verbs[l.action] || (l.action ? l.action[0] + l.action.slice(1).toLowerCase() : 'Accessed')
  const noun = moduleLabel(l.module)
  const article = /^[aeiou]/i.test(noun) ? 'an' : 'a'
  return `${verb} ${article} ${noun}`
}

const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

// Compact relative time ("2h ago", "3d ago") shown under the absolute time.
function relTime(d) {
  if (!d) return ''
  const diff = Date.now() - new Date(d).getTime()
  if (diff < 0) return ''
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  const dd = Math.floor(h / 24); if (dd < 30) return `${dd}d ago`
  const mo = Math.floor(dd / 30); if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

// Avatar initials from a display name.
const initials = (name) => {
  const parts = String(name || '').trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?'
}

const PAGE_SIZE = 30

export default function AuditLog() {
  const [logs, setLogs]       = useState([])
  const [pagination, setPag]  = useState({ page: 1, pages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  // Filters
  const [search, setSearch]   = useState('')
  const [action, setAction]   = useState('')
  const [moduleF, setModuleF] = useState('')
  const [fromDate, setFrom]   = useState('')
  const [toDate, setTo]       = useState('')
  const [page, setPage]       = useState(1)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const params = { page, limit: PAGE_SIZE }
      if (action)   params.action = action
      if (moduleF)  params.module = moduleF
      if (fromDate) params.from_date = fromDate
      if (toDate)   params.to_date = toDate
      const res = await auditLogApi.list(params)
      const data = res?.data || res || {}
      setLogs(data.logs || [])
      setPag(data.pagination || { page: 1, pages: 1, total: (data.logs || []).length })
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load audit logs.')
    } finally {
      setLoading(false)
    }
  }, [page, action, moduleF, fromDate, toDate])

  useEffect(() => { load() }, [load])

  // Client-side free-text search over the current page.
  const q = search.trim().toLowerCase()
  const match = (...vals) => !q || vals.some(v => (v || '').toLowerCase().includes(q))
  const filtered = useMemo(
    () => logs.filter(l => match(l.user_name, l.user_role, l.module, l.path, l.entity_id, l.action)),
    [logs, q], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // ── Stats for the current page ─────────────────────────────
  const stats = useMemo(() => ({
    create: logs.filter(l => l.action === 'CREATE').length,
    update: logs.filter(l => l.action === 'UPDATE').length,
    delete: logs.filter(l => l.action === 'DELETE').length,
  }), [logs])

  const hasFilters = action || moduleF || fromDate || toDate
  const clearFilters = () => { setPage(1); setAction(''); setModuleF(''); setFrom(''); setTo('') }

  const totalPages = pagination.pages || 1
  const curPage    = pagination.page || page

  const STAT_CARDS = [
    { key: 'All',    label: 'Total Activity', value: pagination.total || logs.length, color: '#6366F1', bg: '#EEF2FF', iconBg: '#E0E7FF', Icon: Activity },
    { key: 'CREATE', label: 'Created',        value: stats.create, color: '#059669', bg: '#ECFDF5', iconBg: '#D1FAE5', Icon: PlusCircle },
    { key: 'UPDATE', label: 'Updated',        value: stats.update, color: '#2563EB', bg: '#EFF6FF', iconBg: '#DBEAFE', Icon: Pencil },
    { key: 'DELETE', label: 'Deleted',        value: stats.delete, color: '#DC2626', bg: '#FEF2F2', iconBg: '#FEE2E2', Icon: Trash2 },
  ]

  return (
    <div>
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <span>Settings</span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-active">Activity History</span>
      </div>

      {/* Page header */}
      <div className="page-header" style={{ marginBottom: 18 }}>
        <div className="page-header-left">
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <ScrollText size={20} style={{ color: '#F26522' }} /> Activity History
          </div>
          <div className="page-desc">A chronological audit trail of every create, update and delete across the system</div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Stat cards — click an action card to filter by it */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 18 }}>
        {STAT_CARDS.map(s => {
          const isActive = action === s.key && s.key !== 'All'
          return (
            <div
              key={s.key}
              onClick={() => { if (s.key === 'All') { clearFilters(); return } setPage(1); setAction(prev => prev === s.key ? '' : s.key) }}
              style={{
                background: isActive ? s.iconBg : s.bg,
                border: `1.5px solid ${isActive ? s.color : s.iconBg}`,
                borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12,
                boxShadow: isActive ? `0 0 0 3px ${s.iconBg}` : 'var(--shadow)',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ width: 42, height: 42, borderRadius: 11, flexShrink: 0, background: s.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <s.Icon size={19} style={{ color: s.color }} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: s.color, marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="card">
        {/* Filter bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
            <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="form-control"
              style={{ paddingLeft: 32, width: '100%' }}
              placeholder="Search user, module, path…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <select className="form-control" style={{ width: 150 }} value={action} onChange={e => { setPage(1); setAction(e.target.value) }}>
            <option value="">All actions</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
          </select>

          <input
            className="form-control"
            style={{ width: 160 }}
            placeholder="Module (e.g. products)"
            value={moduleF}
            onChange={e => { setPage(1); setModuleF(e.target.value.trim()) }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>From</span>
            <input type="date" className="form-control" style={{ width: 150 }} value={fromDate} onChange={e => { setPage(1); setFrom(e.target.value) }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>to</span>
            <input type="date" className="form-control" style={{ width: 150 }} value={toDate} onChange={e => { setPage(1); setTo(e.target.value) }} />
          </div>

          {(hasFilters || search) && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); clearFilters() }}>
              <X size={13} /> Clear
            </button>
          )}
        </div>

        {error && (
          <div className="alert alert-danger" style={{ margin: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} /> {error}
          </div>
        )}

        {/* Table */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>User</th>
                <th>Action</th>
                <th>Activity</th>
                <th style={{ textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  <RefreshCw size={22} style={{ opacity: 0.4, display: 'block', margin: '0 auto 8px', animation: 'spin 1s linear infinite' }} />
                  Loading activity…
                </td></tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                  <ScrollText size={34} style={{ opacity: 0.25, display: 'block', margin: '0 auto 10px' }} />
                  <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>No activity found</div>
                  <div style={{ fontSize: 13 }}>{hasFilters || search ? 'Try adjusting or clearing your filters.' : 'Activity will appear here as users work in the system.'}</div>
                </td></tr>
              )}

              {!loading && filtered.map(l => {
                const am = actionMeta(l.action)
                const ok = statusOk(l.status_code)
                return (
                  <tr key={l._id}>
                    {/* When */}
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>
                        <Clock size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        {fmtDateTime(l.created_at)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, marginLeft: 18 }}>{relTime(l.created_at)}</div>
                    </td>

                    {/* User + role */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                          background: 'linear-gradient(135deg,#FD5C02,#FE8A3A)', color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 800,
                        }}>{initials(l.user_name)}</div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{l.user_name || 'System'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <UserIcon size={10} /> {l.user_role || '—'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Action pill */}
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                        background: am.bg, color: am.color, border: `1px solid ${am.border}`,
                      }}>
                        <am.Icon size={11} /> {am.label}
                      </span>
                    </td>

                    {/* Activity — human-readable sentence + method tag + optional entity ref */}
                    <td style={{ maxWidth: 360 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{describeActivity(l)}</span>
                        {l.method && (
                          <span style={{
                            fontSize: 9.5, fontWeight: 800, letterSpacing: '0.4px',
                            padding: '1px 6px', borderRadius: 4,
                            background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)',
                            fontFamily: 'monospace',
                          }}>{l.method}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {l.entity_id && (
                          <span title={`Entity ID: ${l.entity_id}`} style={{ fontFamily: 'monospace' }}>
                            ref …{String(l.entity_id).slice(-6)}
                          </span>
                        )}
                        {l.path && (
                          <span
                            title={l.path}
                            style={{
                              fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap', maxWidth: 220, opacity: 0.8,
                            }}
                          >{l.path}</span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block', minWidth: 42,
                        fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
                        background: ok ? '#ECFDF5' : '#FEF2F2',
                        color: ok ? '#059669' : '#DC2626',
                        border: `1px solid ${ok ? '#A7F3D0' : '#FECACA'}`,
                      }}>{l.status_code || '—'}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <span className="pagination-info">Page {curPage} of {totalPages} · {pagination.total || logs.length} entries</span>
            <button className="pagination-btn" disabled={curPage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
              <ChevronLeft size={13} />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const n = totalPages <= 5 ? i + 1 : Math.max(1, Math.min(curPage - 2, totalPages - 4)) + i
              return (
                <button key={n} className={`pagination-btn${n === curPage ? ' active' : ''}`} onClick={() => setPage(n)}>
                  {n}
                </button>
              )
            })}
            <button className="pagination-btn" disabled={curPage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
              <ChevronRight size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
