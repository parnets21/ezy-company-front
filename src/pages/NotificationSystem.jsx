import { useState, useEffect } from 'react'
import { Bell, CheckCircle, Package, ShoppingCart, Truck, CreditCard, MessageSquare, Send, X, Megaphone, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { notificationApi } from '../api/systemApi'
import { companyApi } from '../api/companyApi'

const PAGE_SIZE = 10

const TYPE_CONFIG = {
  enquiry:  { Icon: MessageSquare, color: '#4F46E5', bg: '#eef2ff',  badgeCls: 'badge-blue'   },
  order:    { Icon: ShoppingCart,  color: '#06B6D4', bg: '#ecfeff',  badgeCls: 'badge-cyan'   },
  dispatch: { Icon: Truck,         color: '#7C3AED', bg: '#f5f3ff',  badgeCls: 'badge-purple' },
  delivery: { Icon: CheckCircle,   color: '#10B981', bg: '#f0fdf4',  badgeCls: 'badge-green'  },
  payment:  { Icon: CreditCard,    color: '#EF4444', bg: '#fef2f2',  badgeCls: 'badge-red'    },
  purchase: { Icon: Package,       color: '#F59E0B', bg: '#fffbeb',  badgeCls: 'badge-yellow' },
  warehouse:{ Icon: Package,       color: '#F97316', bg: '#fff7ed',  badgeCls: 'badge-orange' },
  info:     { Icon: Bell,          color: '#6B7280', bg: '#f9fafb',  badgeCls: 'badge-gray'   },
}

function NotifIcon({ type }) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.info
  return <cfg.Icon style={{ width: 16, color: cfg.color }} />
}

const TYPE_FILTERS = [
  { key: 'all',       label: 'All'        },
  { key: 'unread',    label: 'Unread'     },
  { key: 'enquiry',   label: 'Enquiries'  },
  { key: 'order',     label: 'Orders'     },
  { key: 'dispatch',  label: 'Dispatch'   },
  { key: 'delivery',  label: 'Delivery'   },
  { key: 'payment',   label: 'Payments'   },
  { key: 'purchase',  label: 'Purchase'   },
]

export default function NotificationSystem({ notifications = [], markNotifRead, markAllNotifsRead, deleteNotif, clearAllNotifs }) {
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [clearing, setClearing] = useState(false)

  // ── Compose / broadcast (Super Admin) ──────────────────────
  const isSuperAdmin = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}')?.role === 'Super Admin' } catch { return false }
  })()
  const [showCompose, setShowCompose] = useState(false)
  const [companies, setCompanies] = useState([])
  const [composeMode, setComposeMode] = useState('single') // 'single' | 'broadcast'
  const [compose, setCompose] = useState({ company_id: '', title: '', message: '', type: 'info', status: 'Approved' })
  const [sending, setSending] = useState(false)
  const [composeMsg, setComposeMsg] = useState(null)

  useEffect(() => {
    if (!showCompose || companies.length > 0 || !isSuperAdmin) return
    companyApi.list({ limit: 500 })
      .then(res => setCompanies(res?.data?.companies || res?.companies || res?.data || []))
      .catch(() => {})
  }, [showCompose, isSuperAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  const submitCompose = async () => {
    setComposeMsg(null)
    if (!compose.title.trim() || !compose.message.trim()) {
      setComposeMsg({ ok: false, text: 'Title and message are required.' }); return
    }
    if (composeMode === 'single' && !compose.company_id) {
      setComposeMsg({ ok: false, text: 'Please select a company.' }); return
    }
    setSending(true)
    try {
      if (composeMode === 'broadcast') {
        const r = await notificationApi.broadcast({
          title: compose.title.trim(), message: compose.message.trim(), type: compose.type, status: compose.status,
        })
        setComposeMsg({ ok: true, text: r?.message || 'Broadcast sent.' })
      } else {
        const r = await notificationApi.send({
          company_id: compose.company_id, title: compose.title.trim(), message: compose.message.trim(), type: compose.type,
        })
        setComposeMsg({ ok: true, text: r?.message || 'Notification sent.' })
      }
      setCompose(c => ({ ...c, title: '', message: '' }))
    } catch (e) {
      setComposeMsg({ ok: false, text: e?.response?.data?.message || e?.message || 'Failed to send.' })
    } finally {
      setSending(false)
    }
  }

  // Normalize both old (read/msg/time) and new (is_read/message/created_at) shapes
  const normalize = (n) => ({
    ...n,
    _id:     n._id || n.id,
    is_read: n.is_read ?? n.read ?? false,
    message: n.message || n.msg || n.title || '',
    created_at: n.created_at || n.time || '',
    type:    n.type || 'info',
  })

  const normalizedNotifs = notifications.map(normalize)

  const handleMarkAllRead = async () => {
    await markAllNotifsRead?.()
  }

  const handleMarkRead = async (id) => {
    await markNotifRead?.(id)
  }

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    await deleteNotif?.(id)
  }

  const handleClearAll = async () => {
    if (normalizedNotifs.length === 0) return
    if (!window.confirm('Remove all notifications? This cannot be undone.')) return
    setClearing(true)
    try { await clearAllNotifs?.() }
    finally { setClearing(false) }
  }

  const unreadCount = normalizedNotifs.filter(n => !n.is_read).length

  const filtered = normalizedNotifs.filter(n => {
    if (filter === 'all')    return true
    if (filter === 'unread') return !n.is_read
    return n.type === filter
  })

  // ── Pagination (10 rows per page) ──────────────────────────
  const total       = filtered.length
  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage    = Math.min(page, totalPages)
  const paged       = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const statCards = [
    { label: 'Total',   val: normalizedNotifs.length,                                         color: 'blue'   },
    { label: 'Unread',  val: unreadCount,                                                      color: 'red'    },
    { label: 'Orders',  val: normalizedNotifs.filter(n => n.type === 'order').length,          color: 'green'  },
    { label: 'Payment', val: normalizedNotifs.filter(n => n.type === 'payment').length,        color: 'orange' },
  ]

  return (
    <div>
      <div className="breadcrumb">
        <span>Reports &amp; Tools</span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-active">Notifications</span>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 20 }}>
        {statCards.map(s => (
          <div key={s.label} className="stat-card" style={{ padding: '14px 16px' }}>
            <div className={`stat-icon ${s.color}`}><Bell /></div>
            <div className="stat-info">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ fontSize: 20 }}>{s.val}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Notification list */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Notifications ({filtered.length})</span>
          <div className="header-actions">
            {isSuperAdmin && (
              <button className="btn btn-primary btn-sm" onClick={() => { setShowCompose(true); setComposeMsg(null) }}>
                <Send style={{ width: 13 }} />Send Notification
              </button>
            )}
            {unreadCount > 0 && (
              <button className="btn btn-secondary btn-sm" onClick={handleMarkAllRead}>
                <CheckCircle style={{ width: 13 }} />Mark All Read
              </button>
            )}
            {normalizedNotifs.length > 0 && (
              <button
                className="btn btn-sm"
                onClick={handleClearAll}
                disabled={clearing}
                style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}
              >
                <Trash2 style={{ width: 13 }} />{clearing ? 'Clearing…' : 'Clear All'}
              </button>
            )}
          </div>
        </div>

        <div className="tabs" style={{ padding: '0 16px' }}>
          {TYPE_FILTERS.map(f => (
            <button
              key={f.key}
              className={`tab-btn${filter === f.key ? ' active' : ''}`}
              onClick={() => { setFilter(f.key); setPage(1) }}
              style={{ fontSize: 12 }}
            >
              {f.label}
              {f.key === 'unread' && unreadCount > 0 && (
                <span className="nav-badge" style={{ marginLeft: 4 }}>{unreadCount}</span>
              )}
            </button>
          ))}
        </div>

        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
              No notifications in this category
            </div>
          )}
          {paged.map(n => {
            const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.info
            const timeStr = n.created_at
              ? (typeof n.created_at === 'string' && n.created_at.includes('T')
                  ? new Date(n.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                  : n.created_at)
              : ''
            return (
              <div
                key={n._id}
                onClick={() => !n.is_read && handleMarkRead(n._id)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                  background: n.is_read ? 'var(--bg)' : cfg.bg,
                  border: `1px solid ${n.is_read ? 'var(--border)' : '#c7d2fe'}`,
                  transition: 'all .15s',
                }}
              >
                <div style={{ marginTop: 2, flexShrink: 0 }}>
                  <NotifIcon type={n.type} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: n.is_read ? 400 : 700, fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>
                    {n.title || n.message}
                  </div>
                  {n.title && n.message && n.title !== n.message && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{n.message}</div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{timeStr}</span>
                    <span className={`badge ${cfg.badgeCls}`} style={{ fontSize: 9 }}>{n.type}</span>
                  </div>
                </div>
                {!n.is_read && (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', marginTop: 4, flexShrink: 0 }} />
                )}
                <button
                  onClick={(e) => handleDelete(e, n._id)}
                  title="Remove notification"
                  aria-label="Remove notification"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 26, height: 26, flexShrink: 0,
                    background: 'transparent', border: '1px solid transparent',
                    cursor: 'pointer', color: 'var(--text-muted)', borderRadius: 6,
                    transition: 'all .15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.borderColor = '#fecaca' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'transparent' }}
                >
                  <X style={{ width: 14, height: 14 }} />
                </button>
              </div>
            )
          })}
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

      {/* ── Compose / Broadcast modal (Super Admin) ────────────── */}
      {showCompose && (
        <div className="modal-overlay" onClick={() => !sending && setShowCompose(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" onClick={e => e.stopPropagation()}
            style={{ width: 'min(520px, 94vw)', maxHeight: '90vh', overflowY: 'auto', margin: 0 }}>
            <div className="card-header">
              <span className="card-title">Send Notification</span>
              <button onClick={() => !sending && setShowCompose(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X style={{ width: 16 }} />
              </button>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Mode toggle */}
              <div className="tabs" style={{ borderBottom: '1px solid var(--border)' }}>
                <button className={`tab-btn${composeMode === 'single' ? ' active' : ''}`} onClick={() => setComposeMode('single')}>
                  <Send style={{ width: 12, marginRight: 4 }} />One Company
                </button>
                <button className={`tab-btn${composeMode === 'broadcast' ? ' active' : ''}`} onClick={() => setComposeMode('broadcast')}>
                  <Megaphone style={{ width: 12, marginRight: 4 }} />Broadcast
                </button>
              </div>

              {composeMode === 'single' ? (
                <div>
                  <label className="form-label">Company *</label>
                  <select className="form-input" value={compose.company_id}
                    onChange={e => setCompose(c => ({ ...c, company_id: e.target.value }))}>
                    <option value="">— Select a company —</option>
                    {companies.map(c => (
                      <option key={c._id || c.id} value={c._id || c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="form-label">Send to companies with status</label>
                  <select className="form-input" value={compose.status}
                    onChange={e => setCompose(c => ({ ...c, status: e.target.value }))}>
                    <option value="Approved">Approved only</option>
                    <option value="All">All companies</option>
                    <option value="Pending">Pending</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Title *</label>
                  <input className="form-input" value={compose.title} maxLength={120}
                    onChange={e => setCompose(c => ({ ...c, title: e.target.value }))} placeholder="e.g. Scheduled maintenance" />
                </div>
                <div style={{ width: 130 }}>
                  <label className="form-label">Type</label>
                  <select className="form-input" value={compose.type}
                    onChange={e => setCompose(c => ({ ...c, type: e.target.value }))}>
                    <option value="info">Info</option>
                    <option value="payment">Payment</option>
                    <option value="order">Order</option>
                    <option value="enquiry">Enquiry</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Message *</label>
                <textarea className="form-input" rows={4} value={compose.message} maxLength={600}
                  onChange={e => setCompose(c => ({ ...c, message: e.target.value }))}
                  placeholder="Write the message the wholesalers will receive…" />
              </div>

              {composeMsg && (
                <div style={{
                  fontSize: 12.5, padding: '8px 12px', borderRadius: 8,
                  background: composeMsg.ok ? '#f0fdf4' : '#fef2f2',
                  color: composeMsg.ok ? '#15803d' : '#b91c1c',
                  border: `1px solid ${composeMsg.ok ? '#bbf7d0' : '#fecaca'}`,
                }}>{composeMsg.text}</div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" disabled={sending} onClick={() => setShowCompose(false)}>Close</button>
                <button className="btn btn-primary btn-sm" disabled={sending} onClick={submitCompose}>
                  {sending ? 'Sending…' : composeMode === 'broadcast' ? 'Send Broadcast' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
