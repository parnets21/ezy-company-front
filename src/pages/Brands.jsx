import { useState } from 'react'
import { Plus, Search, Edit2, Trash2, Bookmark, ToggleLeft, ToggleRight, CheckCircle, XCircle, Tag, Eye } from 'lucide-react'

function fmtDate(d) {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Brands({ brands = [], addBrand, updateBrand, deleteBrand, loadingData }) {
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('All') // 'All' | 'Active' | 'Inactive'
  const [showModal,    setShowModal]    = useState(false)
  const [editItem,  setEditItem]  = useState(null)
  const [viewItem,  setViewItem]  = useState(null)
  const [form,      setForm]      = useState({ name: '', code: '', description: '' })
  const [errors,    setErrors]    = useState({})
  const [saving,    setSaving]    = useState(false)
  const [toast,     setToast]     = useState('')

  const fire = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const filtered = brands.filter(b => {
    const q = search.toLowerCase()
    const matchSearch = (b.name || '').toLowerCase().includes(q) || (b.code || '').toLowerCase().includes(q)
    const matchStatus = statusFilter === 'All'
      || (statusFilter === 'Active'   && b.is_active !== false)
      || (statusFilter === 'Inactive' && b.is_active === false)
    return matchSearch && matchStatus
  })

  const openAdd  = () => {
    setForm({ name: '', code: '', description: '' })
    setErrors({})
    setEditItem(null)
    setShowModal(true)
  }
  const openEdit = (b) => {
    setForm({ name: b.name, code: b.code || '', description: b.description || '' })
    setErrors({})
    setEditItem(b)
    setShowModal(true)
  }
  const closeModal = () => { setShowModal(false); setErrors({}) }

  const handleSave = async () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Brand name is required'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    const result = editItem
      ? await updateBrand?.(editItem._id || editItem.id, form)
      : await addBrand?.(form)
    setSaving(false)

    if (result?.success === false) { fire(`Error: ${result.message}`); return }
    closeModal()
    fire(editItem ? 'Brand updated' : 'Brand created')
  }

  const handleToggle = async (b) => {
    const result = await updateBrand?.(b._id || b.id, { is_active: !b.is_active })
    if (result?.success === false) fire(`Error: ${result.message}`)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this brand?')) return
    const result = await deleteBrand?.(id)
    if (result?.success === false) fire(`Error: ${result.message}`)
    else fire('Brand deleted')
  }

  return (
    <>
      {/* breadcrumb */}
      <div className="breadcrumb">
        <span>Product Setup</span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-active">Brands</span>
      </div>

      {/* page header */}
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-title">Brand Management</div>
          <div className="page-desc">Manage manufacturers and brands for your product catalogue</div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={14} /> Add Brand
          </button>
        </div>
      </div>

      {/* stats — colored clickable filter cards */}
      {(() => {
        const STAT_STYLES = {
          All:      { bg: '#EFF6FF', iconBg: '#DBEAFE', iconColor: '#2563EB', textColor: '#1D4ED8', borderColor: '#BFDBFE', Icon: Bookmark     },
          Active:   { bg: '#ECFDF5', iconBg: '#D1FAE5', iconColor: '#059669', textColor: '#047857', borderColor: '#A7F3D0', Icon: CheckCircle  },
          Inactive: { bg: '#FEF2F2', iconBg: '#FEE2E2', iconColor: '#DC2626', textColor: '#B91C1C', borderColor: '#FECACA', Icon: XCircle      },
          Products: { bg: '#F5F3FF', iconBg: '#EDE9FE', iconColor: '#7C3AED', textColor: '#6D28D9', borderColor: '#DDD6FE', Icon: Tag          },
        }
        const stats = [
          { key: 'All',      label: 'Total Brands',   val: brands.length,                                     filter: 'All'      },
          { key: 'Active',   label: 'Active',          val: brands.filter(b => b.is_active !== false).length,  filter: 'Active'   },
          { key: 'Inactive', label: 'Inactive',        val: brands.filter(b => b.is_active === false).length,  filter: 'Inactive' },
          { key: 'Products', label: 'Total Products',  val: 0,                                                 filter: null       },
        ]
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
            {stats.map(s => {
              const st     = STAT_STYLES[s.key]
              const Icon   = st.Icon
              const active = statusFilter === s.filter && s.filter !== null
              return (
                <div
                  key={s.key}
                  onClick={() => { if (s.filter !== null) setStatusFilter(active ? 'All' : s.filter) }}
                  style={{
                    background:   active ? st.iconBg : st.bg,
                    border:       `1.5px solid ${active ? st.iconColor : st.borderColor}`,
                    borderRadius: 10,
                    padding:      '13px 15px',
                    cursor:       s.filter !== null ? 'pointer' : 'default',
                    display:      'flex',
                    alignItems:   'center',
                    gap:          11,
                    boxShadow:    active ? `0 0 0 3px ${st.borderColor}` : 'var(--shadow)',
                    transition:   'all 0.15s',
                  }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 9, flexShrink: 0, background: st.iconBg, border: `1px solid ${st.borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={17} style={{ color: st.iconColor }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: st.textColor, marginBottom: 2 }}>{s.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: st.textColor, lineHeight: 1 }}>{s.val}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* table */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="card-title">
              {statusFilter === 'All' ? 'All Brands' : `${statusFilter} Brands`} ({filtered.length})
            </span>
            {statusFilter !== 'All' && (
              <button
                onClick={() => setStatusFilter('All')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#FFF3EC', color: '#FD5C02', border: '1px solid #FED7B8', cursor: 'pointer' }}
              >
                ✕ Clear filter
              </button>
            )}
          </div>
          <div className="header-actions">
            <div className="search-bar">
              <Search size={14} />
              <input
                placeholder="Search by name or code…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 44 }}>#</th>
                <th>Brand Name</th>
                <th>Brand Code</th>
                <th>Status</th>
                <th>Created Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingData && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32 }}>Loading…</td></tr>
              )}
              {!loadingData && filtered.map((b, i) => {
                const id = b._id || b.id
                return (
                  <tr key={id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>

                    {/* Brand Name */}
                    <td style={{ fontWeight: 700, fontSize: 13 }}>{b.name}</td>

                    {/* Brand Code */}
                    <td>
                      {b.code
                        ? <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: 'var(--primary)', background: 'rgba(99,102,241,.1)', padding: '3px 9px', borderRadius: 6 }}>{b.code}</span>
                        : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                      }
                    </td>

                    {/* Status */}
                    <td>
                      <span className={`badge ${b.is_active !== false ? 'badge-green' : 'badge-gray'}`}>
                        {b.is_active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Created Date */}
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {fmtDate(b.created_at || b.createdAt)}
                    </td>

                    {/* Actions */}
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-ghost btn-xs" title="View" onClick={() => setViewItem(b)}>
                          <Eye size={13} />
                        </button>
                        <button className="btn btn-ghost btn-xs" title="Edit" onClick={() => openEdit(b)}>
                          <Edit2 size={13} />
                        </button>
                        <button className="btn btn-ghost btn-xs" title={b.is_active !== false ? 'Deactivate' : 'Activate'} onClick={() => handleToggle(b)}>
                          {b.is_active !== false
                            ? <ToggleRight size={15} style={{ color: 'var(--success)' }} />
                            : <ToggleLeft  size={15} />}
                        </button>
                        <button className="btn btn-ghost btn-xs" style={{ color: 'var(--danger)' }} title="Delete" onClick={() => handleDelete(id)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!loadingData && filtered.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">
                      <div className="empty-state-icon">🏷️</div>
                      <h3>No brands found</h3>
                      <p>Click "Add Brand" to create your first brand.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── ADD / EDIT MODAL ── */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editItem ? 'Edit Brand' : 'Add New Brand'}</span>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>

            <div className="modal-body">
              {/* Brand Name */}
              <div className="form-group">
                <label className="form-label">Brand Name *</label>
                <input
                  className={`form-control${errors.name ? ' input-error' : ''}`}
                  placeholder="e.g. Kajaria, Somany"
                  value={form.name}
                  autoFocus
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
                {errors.name && (
                  <span style={{ color: 'var(--danger)', fontSize: 11, marginTop: 4, display: 'block' }}>
                    {errors.name}
                  </span>
                )}
              </div>

              {/* Brand Code */}
              <div className="form-group">
                <label className="form-label">Brand Code</label>
                <input
                  className="form-control"
                  placeholder="e.g. KAJ-001, SOM-001"
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  A short unique code for this brand (optional)
                </span>
              </div>

              {/* Description */}
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Optional description"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
                {saving ? 'Saving…' : (editItem ? 'Update Brand' : 'Save Brand')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── VIEW MODAL ── */}
      {viewItem && (
        <div className="modal-overlay" onClick={() => setViewItem(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Brand Details</span>
              <button className="modal-close" onClick={() => setViewItem(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Brand icon + name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', background: 'var(--bg)', borderRadius: 10 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: '#FFF3EC', border: '1px solid #FED7B8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Bookmark size={22} color="#FD5C02" />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{viewItem.name}</div>
                  {viewItem.code && (
                    <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: 'var(--primary)', background: 'rgba(99,102,241,.1)', padding: '2px 8px', borderRadius: 6 }}>{viewItem.code}</span>
                  )}
                </div>
              </div>

              {/* Details grid */}
              {[
                { label: 'Brand Name', value: viewItem.name },
                { label: 'Brand Code', value: viewItem.code || '—', mono: true },
                { label: 'Status',     value: null, badge: viewItem.is_active !== false },
                { label: 'Created',    value: fmtDate(viewItem.created_at || viewItem.createdAt) },
                { label: 'Description', value: viewItem.description || '—' },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ minWidth: 110, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{r.label}</div>
                  {r.badge !== undefined && r.value === null
                    ? <span className={`badge ${r.badge ? 'badge-green' : 'badge-gray'}`}>{r.badge ? 'Active' : 'Inactive'}</span>
                    : <div style={{ fontSize: 13, fontFamily: r.mono ? 'monospace' : undefined, fontWeight: r.mono ? 600 : 400, color: 'var(--text)' }}>{r.value}</div>
                  }
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setViewItem(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => { setViewItem(null); openEdit(viewItem) }}>
                <Edit2 size={13} /> Edit Brand
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="alert alert-info" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,.15)' }}>
          ✓ {toast}
        </div>
      )}
    </>
  )
}
