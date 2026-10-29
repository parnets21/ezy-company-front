import { useState, useEffect, useCallback } from 'react'
import {
  Trash2, RotateCcw, Search, Package, X, RefreshCw,
} from 'lucide-react'
import { productApi } from '../api/productApi'

const IMG_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'https://ezyenquiry-backend.onrender.com'

function imgUrl(p) {
  if (!p) return null
  if (p.startsWith('http')) return p
  return `${IMG_BASE}${p}`
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtPrice(v) {
  const n = parseFloat(v) || 0
  if (!n) return null
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── Confirm Modal ─────────────────────────────────────────────
function ConfirmModal({ title, message, confirmLabel, confirmColor, onConfirm, onClose, loading }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 14, padding: 24,
        width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 22, lineHeight: 1.6 }}>{message}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={loading}
            style={{ padding: '8px 18px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            style={{ padding: '8px 18px', border: 'none', borderRadius: 8, background: confirmColor || '#10b981', color: '#fff', fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function ProductRecycleBin() {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [busy,    setBusy]    = useState(null)
  const [toast,   setToast]   = useState({ msg: '', type: 'success' })

  // confirm modals
  const [restoreTarget,  setRestoreTarget]  = useState(null)
  const [deleteTarget,   setDeleteTarget]   = useState(null)

  const fire = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg: '', type: 'success' }), 3200)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await productApi.getRecycleBin({ search })
      const data = res?.data
      setItems(Array.isArray(data) ? data : Array.isArray(res) ? res : [])
    } catch { setItems([]) }
    finally { setLoading(false) }
  }, [search])

  useEffect(() => { load() }, [load])

  const handleRestore = async () => {
    if (!restoreTarget) return
    const { id } = restoreTarget
    setBusy(id)
    setRestoreTarget(null)
    try {
      await productApi.restore(id)
      setItems(p => p.filter(x => (x._id || x.id) !== id))
      fire('Product restored successfully')
    } catch (e) { fire('Restore failed: ' + (e?.message || 'Error'), 'error') }
    finally { setBusy(null) }
  }

  const handlePermanentDelete = async () => {
    if (!deleteTarget) return
    const { id } = deleteTarget
    setBusy(id)
    setDeleteTarget(null)
    try {
      await productApi.delete(id)
      setItems(p => p.filter(x => (x._id || x.id) !== id))
      fire('Product permanently deleted', 'error')
    } catch (e) { fire('Delete failed: ' + (e?.message || 'Error'), 'error') }
    finally { setBusy(null) }
  }

  const filtered = items.filter(p => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      (p.name || '').toLowerCase().includes(q) ||
      (p.code || '').toLowerCase().includes(q) ||
      (p.brand_name || '').toLowerCase().includes(q) ||
      (p.category_name || '').toLowerCase().includes(q)
    )
  })

  return (
    <>
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <span>Product Setup</span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-active">Recycle Bin</span>
      </div>

      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Trash2 size={20} style={{ color: 'var(--danger)' }} />
            Product Recycle Bin
          </div>
          <div className="page-desc">
            Deleted products are stored here. Restore them to bring back to the active list, or permanently delete.
          </div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={load} style={{ gap: 6 }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 16 }}>
        {[
          { label: 'Total Deleted', val: items.length, color: 'red' },
          { label: 'Showing',       val: filtered.length, color: 'blue' },
          { label: 'Can Restore',   val: filtered.length, color: 'green' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className={`stat-icon ${s.color}`}><Package size={18} /></div>
            <div className="stat-info">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.val}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ padding: '10px 14px' }}>
          <div className="search-bar" style={{ maxWidth: 340 }}>
            <Search size={14} />
            <input
              placeholder="Search by name, code, brand, category…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            Deleted Products
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 6 }}>
              ({filtered.length}{filtered.length !== items.length ? ` of ${items.length}` : ''})
            </span>
          </span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th style={{ width: 52 }}>Image</th>
                <th>Code</th>
                <th>Product Name</th>
                <th>Brand</th>
                <th>Category</th>
                <th>Size</th>
                <th>Finish</th>
                <th>MRP</th>
                <th>Retail Rate</th>
                <th>Deleted On</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={12} style={{ textAlign: 'center', padding: 40 }}>
                    <div className="spinner" />
                  </td>
                </tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={12}>
                    <div className="empty-state">
                      <div className="empty-state-icon">🗑️</div>
                      <h3>{search ? 'No matching deleted products' : 'Recycle Bin is empty'}</h3>
                      <p>
                        {search
                          ? 'Try a different search term.'
                          : 'Products you delete will appear here and can be restored anytime.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}

              {!loading && filtered.map((p, i) => {
                const id    = p._id || p.id
                const isBusy = busy === id
                const thumb = (p.image_urls || []).filter(Boolean)[0]
                return (
                  <tr key={id} style={{ opacity: isBusy ? 0.5 : 1 }}>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>

                    {/* Thumbnail */}
                    <td>
                      {thumb
                        ? <img src={imgUrl(thumb)} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border)' }} />
                        : <div style={{ width: 40, height: 40, borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Package size={14} style={{ color: 'var(--text-muted)' }} />
                          </div>
                      }
                    </td>

                    {/* Code */}
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: 'var(--primary)', background: 'rgba(253,92,2,.08)', padding: '2px 7px', borderRadius: 5 }}>
                        {p.code || '—'}
                      </span>
                    </td>

                    {/* Name */}
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                      {p.sub_category_name && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.sub_category_name}</div>
                      )}
                    </td>

                    <td style={{ fontSize: 12 }}>{p.brand_name    || '—'}</td>
                    <td style={{ fontSize: 12 }}>{p.category_name || '—'}</td>
                    <td style={{ fontSize: 12 }}>{p.size   ? p.size.toUpperCase() + ' MM' : '—'}</td>
                    <td style={{ fontSize: 12 }}>{p.finish || '—'}</td>
                    <td style={{ fontSize: 12, fontWeight: 600 }}>{fmtPrice(p.mrp) || '—'}</td>
                    <td style={{ fontSize: 12, fontWeight: 600, color: 'var(--success)' }}>
                      {fmtPrice(p.retail_price || p.retail_rate) || '—'}
                    </td>

                    {/* Deleted On */}
                    <td style={{ fontSize: 11, color: 'var(--danger)' }}>
                      {fmtDate(p.deleted_at)}
                    </td>

                    {/* Actions */}
                    <td>
                      <div className="table-actions">
                        <button
                          className="btn btn-ghost btn-xs"
                          title="Restore Product"
                          disabled={isBusy}
                          onClick={() => setRestoreTarget({ id, name: p.name })}
                          style={{ color: 'var(--success)' }}
                        >
                          <RotateCcw size={13} />
                        </button>
                        <button
                          className="btn btn-ghost btn-xs"
                          title="Permanently Delete"
                          disabled={isBusy}
                          onClick={() => setDeleteTarget({ id, name: p.name })}
                          style={{ color: 'var(--danger)' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info note */}
      <div style={{ padding: '12px 16px', background: 'rgba(253,92,2,.05)', border: '1px solid rgba(253,92,2,.15)', borderRadius: 10, marginTop: 14, fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 8, alignItems: 'center' }}>
        <Trash2 size={14} style={{ color: 'var(--danger)', flexShrink: 0 }} />
        <span>
          <strong style={{ color: 'var(--text)' }}>Restore</strong> brings the product back to the active products list with all its original data intact.&nbsp;
          <strong style={{ color: 'var(--danger)' }}>Permanent Delete</strong> removes it forever and cannot be undone.
        </span>
      </div>

      {/* Restore Confirm */}
      {restoreTarget && (
        <ConfirmModal
          title="Restore Product?"
          message={`"${restoreTarget.name}" will be moved back to the active products list with all its original data.`}
          confirmLabel="Yes, Restore"
          confirmColor="#10b981"
          loading={busy === restoreTarget.id}
          onConfirm={handleRestore}
          onClose={() => setRestoreTarget(null)}
        />
      )}

      {/* Permanent Delete Confirm */}
      {deleteTarget && (
        <ConfirmModal
          title="Permanently Delete?"
          message={`"${deleteTarget.name}" will be permanently removed. This action CANNOT be undone.`}
          confirmLabel="Delete Forever"
          confirmColor="#DC2626"
          loading={busy === deleteTarget.id}
          onConfirm={handlePermanentDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {/* Toast */}
      {toast.msg && (
        <div
          className={`alert alert-${toast.type === 'error' ? 'danger' : 'success'}`}
          style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,.15)', minWidth: 280 }}
        >
          {toast.type === 'error' ? '✕ ' : '✓ '}{toast.msg}
        </div>
      )}
    </>
  )
}
