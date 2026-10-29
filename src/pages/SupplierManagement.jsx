import { useState, useMemo, useCallback } from 'react'
import {
  Plus, Search, Edit2, Trash2, X, CheckCircle, Building2,
  Phone, Mail, MapPin, CreditCard, ChevronDown, Eye,
  FileText, IndianRupee, Filter, RefreshCw, ChevronLeft, ChevronRight,
} from 'lucide-react'

const PAGE_SIZE = 10

// ── Indian states ─────────────────────────────────────────────
const STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
  'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
  'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram',
  'Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana',
  'Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Delhi','Jammu and Kashmir','Ladakh',
]

const EMPTY_FORM = {
  name: '', mobile: '', email: '', gst_number: '',
  address: '', city: '', state: '', credit_days: 30,
}

// ── Helpers ───────────────────────────────────────────────────
const fmt = (v) => (v && String(v).trim()) ? String(v).trim() : '—'
const fmtMoney = (v) => {
  const n = parseFloat(v) || 0
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`
}

export default function SupplierManagement({
  suppliers = [],
  addSupplier,
  updateSupplier,
  deleteSupplier,
}) {
  const [search, setSearch]       = useState('')
  const [page, setPage]           = useState(1)
  const [statusFilter, setStatusFilter] = useState('') // '' | 'active' | 'inactive' | 'outstanding'
  const [stateFilter, setStateFilter]   = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem]   = useState(null)
  const [delItem, setDelItem]     = useState(null)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [errors, setErrors]       = useState({})
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState(false)
  const [toast, setToast]         = useState('')
  const [viewItem, setViewItem]   = useState(null)
  const [delStep, setDelStep]     = useState(1) // 1 = first warning, 2 = final confirm

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 4000) }

  // ── Modal open/close ──────────────────────────────────────
  const openAdd = () => {
    setEditItem(null)
    setForm(EMPTY_FORM)
    setErrors({})
    setShowModal(true)
  }

  const openEdit = (s) => {
    setEditItem(s)
    setForm({
      name:        s.name        || '',
      mobile:      s.mobile      || '',
      email:       s.email       || '',
      gst_number:  s.gst_number  || '',
      address:     s.address     || '',
      city:        s.city        || '',
      state:       s.state       || '',
      credit_days: s.credit_days ?? 30,
    })
    setErrors({})
    setShowModal(true)
  }

  const closeModal = () => { setShowModal(false); setSaving(false) }

  // ── Form helpers ──────────────────────────────────────────
  const set = useCallback((f, v) => setForm(p => ({ ...p, [f]: v })), [])

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Supplier name is required'
    if (form.mobile && !/^\d{10}$/.test(form.mobile.trim())) e.mobile = 'Enter valid 10-digit mobile'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Enter valid email'
    if (form.gst_number && form.gst_number.trim().length > 0 && form.gst_number.trim().length !== 15)
      e.gst_number = 'GST number must be 15 characters'
    return e
  }

  const handleSave = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    try {
      const payload = {
        ...form,
        name:        form.name.trim(),
        credit_days: parseInt(form.credit_days) || 30,
      }
      if (editItem) {
        const id = editItem._id || editItem.id
        const res = await updateSupplier?.(id, payload)
        if (res?.success === false) { setErrors({ _global: res.message || 'Update failed' }); return }
        showToast(`✓ Supplier "${form.name}" updated successfully`)
      } else {
        const res = await addSupplier?.(payload)
        if (res?.success === false) { setErrors({ _global: res.message || 'Create failed' }); return }
        showToast(`✓ Supplier "${form.name}" added successfully`)
      }
      closeModal()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!delItem) return
    setDeleting(true)
    try {
      const id = delItem._id || delItem.id
      const res = await deleteSupplier?.(id)
      if (res?.success === false) { showToast(`✗ ${res.message || 'Delete failed'}`); return }
      showToast(`✓ Supplier "${delItem.name}" deleted`)
      setDelItem(null)
      setDelStep(1)
    } finally {
      setDeleting(false)
    }
  }

  // ── Filtered list ─────────────────────────────────────────
  const filtered = useMemo(() =>
    suppliers.filter(s => {
      const matchSearch =
        (s.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.mobile || '').includes(search) ||
        (s.city || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.gst_number || '').toLowerCase().includes(search.toLowerCase())

      const matchStatus =
        !statusFilter ? true
        : statusFilter === 'active'      ? s.is_active !== false
        : statusFilter === 'inactive'    ? s.is_active === false
        : statusFilter === 'outstanding' ? (parseFloat(s.outstanding) || 0) > 0
        : true

      const matchState = !stateFilter || (s.state || '') === stateFilter

      return matchSearch && matchStatus && matchState
    })
  , [suppliers, search, statusFilter, stateFilter])

  // ── Pagination (10 rows per page) ──────────────────────────
  const total       = filtered.length
  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage    = Math.min(page, totalPages)
  const paged       = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const resetFilters = () => { setSearch(''); setStatusFilter(''); setStateFilter(''); setPage(1) }
  const hasFilters   = search || statusFilter || stateFilter

  // ── Stats ─────────────────────────────────────────────────
  const totalOutstanding = suppliers.reduce((a, s) => a + (parseFloat(s.outstanding) || 0), 0)
  const activeCount      = suppliers.filter(s => s.is_active !== false).length
  const inactiveCount    = suppliers.filter(s => s.is_active === false).length
  const outstandingCount = suppliers.filter(s => (parseFloat(s.outstanding) || 0) > 0).length

  // unique states for filter dropdown
  const uniqueStates = [...new Set(suppliers.map(s => s.state).filter(Boolean))].sort()

  return (
    <>
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <span>Purchase &amp; Inventory</span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-active">Supplier Management</span>
      </div>

      {/* Page header */}
      <div className="page-header" style={{ marginBottom: 18 }}>
        <div className="page-header-left">
          <div className="page-title">Supplier Management</div>
          <div className="page-desc">Manage suppliers, manufacturers and purchase contacts</div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus style={{ width: 15 }} /> Add Supplier
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="alert alert-success" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <CheckCircle style={{ color: 'var(--success)', width: 18, flexShrink: 0 }} />
          <span style={{ fontWeight: 600 }}>{toast}</span>
        </div>
      )}

      {/* Stats — colored clickable filter cards */}
      {(() => {
        const STAT_STYLES = {
          '':            { bg: '#EFF6FF', iconBg: '#DBEAFE', iconColor: '#2563EB', textColor: '#1D4ED8', borderColor: '#BFDBFE' },
          'active':      { bg: '#ECFDF5', iconBg: '#D1FAE5', iconColor: '#059669', textColor: '#047857', borderColor: '#A7F3D0' },
          'inactive':    { bg: '#FEF2F2', iconBg: '#FEE2E2', iconColor: '#DC2626', textColor: '#B91C1C', borderColor: '#FECACA' },
          'outstanding': { bg: '#FFF7ED', iconBg: '#FFEDD5', iconColor: '#EA580C', textColor: '#C2410C', borderColor: '#FED7AA' },
        }
        const stats = [
          { label: 'Total Suppliers',   val: suppliers.length,           key: '',            Icon: Building2     },
          { label: 'Active',            val: activeCount,                key: 'active',      Icon: CheckCircle   },
          { label: 'Inactive',          val: inactiveCount,              key: 'inactive',    Icon: Building2     },
          { label: 'Has Outstanding',   val: outstandingCount,           key: 'outstanding', Icon: IndianRupee   },
        ]
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
            {stats.map(s => {
              const st       = STAT_STYLES[s.key]
              const isActive = statusFilter === s.key && s.key !== ''
              const Icon     = s.Icon
              return (
                <div
                  key={s.label}
                  onClick={() => {
                    setPage(1)
                    if (s.key === '') { setStatusFilter(''); return }
                    setStatusFilter(prev => prev === s.key ? '' : s.key)
                  }}
                  style={{
                    background:   isActive ? st.iconBg : st.bg,
                    border:       `1.5px solid ${isActive ? st.iconColor : st.borderColor}`,
                    borderRadius: 10,
                    padding:      '13px 15px',
                    cursor:       'pointer',
                    display:      'flex',
                    alignItems:   'center',
                    gap:          11,
                    boxShadow:    isActive ? `0 0 0 3px ${st.borderColor}` : 'var(--shadow)',
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

      {/* Table card */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Suppliers ({filtered.length}{hasFilters ? ` of ${suppliers.length}` : ''})</span>
          <div className="header-actions">
            <div className="search-bar">
              <Search />
              <input
                placeholder="Search name, mobile, city, GST…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
              />
            </div>

            {/* Status filter */}
            <div style={{ position: 'relative' }}>
              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
                style={{
                  padding: '7px 32px 7px 11px', border: '1px solid var(--border)',
                  borderRadius: 7, background: statusFilter ? '#FFF3EC' : 'var(--surface)',
                  fontSize: 13, cursor: 'pointer', appearance: 'none',
                  color: statusFilter ? '#FD5C02' : 'var(--text)', outline: 'none',
                  fontWeight: statusFilter ? 600 : 400,
                }}
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="outstanding">Has Outstanding</option>
              </select>
              <ChevronDown size={13} style={{ position:'absolute', right:9, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'var(--text-muted)' }}/>
            </div>

            {/* State filter */}
            {uniqueStates.length > 0 && (
              <div style={{ position: 'relative' }}>
                <select
                  value={stateFilter}
                  onChange={e => { setStateFilter(e.target.value); setPage(1) }}
                  style={{
                    padding: '7px 32px 7px 11px', border: '1px solid var(--border)',
                    borderRadius: 7, background: stateFilter ? '#FFF3EC' : 'var(--surface)',
                    fontSize: 13, cursor: 'pointer', appearance: 'none',
                    color: stateFilter ? '#FD5C02' : 'var(--text)', outline: 'none',
                    fontWeight: stateFilter ? 600 : 400,
                  }}
                >
                  <option value="">All States</option>
                  {uniqueStates.map(st => <option key={st} value={st}>{st}</option>)}
                </select>
                <ChevronDown size={13} style={{ position:'absolute', right:9, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'var(--text-muted)' }}/>
              </div>
            )}

            {/* Reset filters */}
            {hasFilters && (
              <button className="btn btn-secondary" onClick={resetFilters} title="Clear filters">
                <RefreshCw size={13} /> Reset
              </button>
            )}
{/* 
            <button className="btn btn-primary" onClick={openAdd}>
              <Plus style={{ width: 15 }} /> Add Supplier
            </button> */}
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Supplier Name</th>
                <th>Mobile</th>
                <th>Email</th>
                <th>City / State</th>
                <th>GST Number</th>
                <th>Credit Days</th>
                <th>Outstanding</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((s, idx) => {
                const id = s._id || s.id
                return (
                  <tr key={id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{(safePage - 1) * PAGE_SIZE + idx + 1}</td>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{s.name}</div>
                      {s.address && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.address}</div>
                      )}
                    </td>
                    <td style={{ fontSize: 13 }}>{fmt(s.mobile)}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmt(s.email)}</td>
                    <td style={{ fontSize: 12 }}>
                      {s.city && s.state ? `${s.city}, ${s.state}` : (s.city || s.state || '—')}
                    </td>
                    <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{fmt(s.gst_number)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        background: 'var(--bg)', border: '1px solid var(--border)',
                        borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 600,
                      }}>
                        {s.credit_days ?? 30} days
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: (s.outstanding || 0) > 0 ? 'var(--danger)' : 'var(--success)' }}>
                      {fmtMoney(s.outstanding || 0)}
                    </td>
                    <td>
                      <span className={`badge ${s.is_active !== false ? 'badge-green' : 'badge-red'}`}>
                        {s.is_active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn-ghost"
                          title="View"
                          style={{ color: 'var(--primary)', padding: 5 }}
                          onClick={() => setViewItem(s)}
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          className="btn-ghost"
                          title="Edit"
                          style={{ color: 'var(--warning)', padding: 5 }}
                          onClick={() => openEdit(s)}
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          className="btn-ghost"
                          title="Delete"
                          style={{ color: 'var(--danger)', padding: 5 }}
                          onClick={() => { setDelItem(s); setDelStep(1) }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    {hasFilters
                      ? <span>No suppliers match your filters. <button onClick={resetFilters} style={{ color:'var(--primary)', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>Clear filters</button></span>
                      : 'No suppliers added yet. Click "Add Supplier" to get started.'
                    }
                  </td>
                </tr>
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

      {/* ══════════ ADD / EDIT MODAL ══════════ */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal"
            style={{ maxWidth: 600, width: '96vw' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Building2 style={{ color: 'var(--primary)', width: 20 }} />
                <span className="modal-title">{editItem ? 'Edit Supplier' : 'Add New Supplier'}</span>
              </div>
              <button className="btn-ghost" onClick={closeModal}><X size={18} /></button>
            </div>

            <div className="modal-body" style={{ padding: '18px 22px' }}>
              {errors._global && (
                <div className="alert alert-danger" style={{ marginBottom: 12 }}>{errors._global}</div>
              )}

              {/* Name */}
              <div className="form-group">
                <label className="form-label">
                  Supplier / Manufacturer Name <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  className={`form-control${errors.name ? ' error' : ''}`}
                  placeholder="e.g. Kajaria Ceramics Ltd"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                />
                {errors.name && <div className="form-error">{errors.name}</div>}
              </div>

              {/* Mobile + Email */}
              <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Mobile Number</label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      className={`form-control${errors.mobile ? ' error' : ''}`}
                      style={{ paddingLeft: 30 }}
                      placeholder="10-digit mobile"
                      maxLength={10}
                      value={form.mobile}
                      onChange={e => set('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
                    />
                  </div>
                  {errors.mobile && <div className="form-error">{errors.mobile}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      className={`form-control${errors.email ? ' error' : ''}`}
                      style={{ paddingLeft: 30 }}
                      type="email"
                      placeholder="supplier@email.com"
                      value={form.email}
                      onChange={e => set('email', e.target.value)}
                    />
                  </div>
                  {errors.email && <div className="form-error">{errors.email}</div>}
                </div>
              </div>

              {/* GST + Credit Days */}
              <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">GST Number</label>
                  <div style={{ position: 'relative' }}>
                    <FileText size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      className={`form-control${errors.gst_number ? ' error' : ''}`}
                      style={{ paddingLeft: 30, textTransform: 'uppercase', fontFamily: 'monospace' }}
                      placeholder="15-char GST (optional)"
                      maxLength={15}
                      value={form.gst_number}
                      onChange={e => set('gst_number', e.target.value.toUpperCase())}
                    />
                  </div>
                  {errors.gst_number && <div className="form-error">{errors.gst_number}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Credit Days</label>
                  <div style={{ position: 'relative' }}>
                    <CreditCard size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      className="form-control"
                      style={{ paddingLeft: 30 }}
                      type="number"
                      min={0}
                      max={365}
                      placeholder="30"
                      value={form.credit_days}
                      onChange={e => set('credit_days', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="form-group">
                <label className="form-label">Address</label>
                <div style={{ position: 'relative' }}>
                  <MapPin size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
                  <textarea
                    className="form-control"
                    style={{ paddingLeft: 30, resize: 'vertical', minHeight: 60 }}
                    placeholder="Street address, area…"
                    value={form.address}
                    onChange={e => set('address', e.target.value)}
                  />
                </div>
              </div>

              {/* City + State */}
              <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">City</label>
                  <input
                    className="form-control"
                    placeholder="e.g. Mumbai"
                    value={form.city}
                    onChange={e => set('city', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">State</label>
                  <div style={{ position: 'relative' }}>
                    <select
                      className="form-control"
                      style={{ paddingRight: 32, appearance: 'none' }}
                      value={form.state}
                      onChange={e => set('state', e.target.value)}
                    >
                      <option value="">Select State</option>
                      {STATES.map(st => <option key={st} value={st}>{st}</option>)}
                    </select>
                    <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ VIEW MODAL ══════════ */}
      {viewItem && (
        <div className="modal-overlay" onClick={() => setViewItem(null)}>
          <div
            className="modal"
            style={{ maxWidth: 480, width: '96vw' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Building2 style={{ color: 'var(--primary)', width: 20 }} />
                <span className="modal-title">Supplier Details</span>
              </div>
              <button className="btn-ghost" onClick={() => setViewItem(null)}><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ padding: '18px 22px' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, padding: '14px 16px', background: 'var(--bg)', borderRadius: 10 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                  background: 'linear-gradient(135deg, #FD5C02, #FE8A3A)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, fontWeight: 800, color: '#fff',
                }}>
                  {(viewItem.name || 'S')[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{viewItem.name}</div>
                  <span className={`badge ${viewItem.is_active !== false ? 'badge-green' : 'badge-red'}`} style={{ marginTop: 4 }}>
                    {viewItem.is_active !== false ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              {[
                { icon: Phone,     label: 'Mobile',      val: fmt(viewItem.mobile) },
                { icon: Mail,      label: 'Email',       val: fmt(viewItem.email) },
                { icon: FileText,  label: 'GST Number',  val: fmt(viewItem.gst_number) },
                { icon: MapPin,    label: 'Address',     val: [viewItem.address, viewItem.city, viewItem.state].filter(Boolean).join(', ') || '—' },
                { icon: CreditCard,label: 'Credit Days', val: `${viewItem.credit_days ?? 30} days` },
                { icon: IndianRupee, label: 'Outstanding', val: fmtMoney(viewItem.outstanding || 0) },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <row.icon size={15} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 1 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>{row.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: row.label === 'Outstanding' && (viewItem.outstanding || 0) > 0 ? 'var(--danger)' : 'var(--text)' }}>
                      {row.val}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setViewItem(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => { setViewItem(null); openEdit(viewItem) }}>
                <Edit2 size={14} /> Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ DELETE — STEP 1: Warning ══════════ */}
      {delItem && delStep === 1 && (
        <div className="modal-overlay" onClick={() => setDelItem(null)}>
          <div
            className="modal"
            style={{ maxWidth: 440, width: '96vw' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: '#FEF3C7', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 18,
                }}>⚠️</div>
                <span className="modal-title" style={{ color: '#B45309' }}>Delete Supplier?</span>
              </div>
              <button className="btn-ghost" onClick={() => setDelItem(null)}><X size={18} /></button>
            </div>

            <div className="modal-body" style={{ padding: '18px 22px' }}>
              {/* Supplier info chip */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'var(--bg)', borderRadius: 10, padding: '12px 14px', marginBottom: 16,
                border: '1px solid var(--border)',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: 'linear-gradient(135deg, #FD5C02, #FE8A3A)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 800, color: '#fff',
                }}>
                  {(delItem.name || 'S')[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{delItem.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {[delItem.mobile, delItem.city, delItem.state].filter(Boolean).join(' · ') || 'No contact info'}
                  </div>
                </div>
              </div>

              <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6, marginBottom: 12 }}>
                You are about to delete this supplier. This will remove all associated records and
                <strong> cannot be undone</strong>.
              </p>

              {(delItem.outstanding || 0) > 0 && (
                <div style={{
                  background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
                  padding: '10px 14px', marginBottom: 12, display: 'flex', gap: 10, alignItems: 'flex-start',
                }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>💰</span>
                  <div style={{ fontSize: 13, color: '#991B1B' }}>
                    <strong>Outstanding balance:</strong> {fmtMoney(delItem.outstanding)}
                    <br />
                    <span style={{ fontSize: 12 }}>Deleting this supplier may affect your financial records.</span>
                  </div>
                </div>
              )}

              <div style={{
                background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8,
                padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <span style={{ fontSize: 15, flexShrink: 0 }}>ℹ️</span>
                <div style={{ fontSize: 12, color: '#92400E' }}>
                  All purchase records linked to this supplier will lose their supplier reference.
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDelItem(null)}>
                Cancel
              </button>
              <button
                className="btn"
                style={{ background: '#B45309', color: '#fff', border: 'none' }}
                onClick={() => setDelStep(2)}
              >
                Yes, Proceed →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ DELETE — STEP 2: Final Confirm ══════════ */}
      {delItem && delStep === 2 && (
        <div className="modal-overlay" onClick={() => { setDelItem(null); setDelStep(1) }}>
          <div
            className="modal"
            style={{ maxWidth: 420, width: '96vw' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: '#FEE2E2', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 18,
                }}>🗑️</div>
                <span className="modal-title" style={{ color: 'var(--danger)' }}>Final Confirmation</span>
              </div>
              <button className="btn-ghost" onClick={() => { setDelItem(null); setDelStep(1) }}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '18px 22px' }}>
              <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7 }}>
                This is your <strong>last chance</strong>. Permanently delete{' '}
                <strong style={{ color: 'var(--danger)' }}>{delItem.name}</strong>?
              </p>

              <div style={{
                background: '#FEF2F2', border: '2px solid var(--danger)', borderRadius: 8,
                padding: '12px 14px', marginTop: 14, textAlign: 'center',
              }}>
                <div style={{ fontSize: 28 }}>⚠️</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--danger)', marginTop: 4 }}>
                  This action is irreversible
                </div>
                <div style={{ fontSize: 12, color: '#991B1B', marginTop: 4 }}>
                  Supplier and all linked references will be permanently removed.
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => { setDelItem(null); setDelStep(1) }}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setDelStep(1)}
                disabled={deleting}
                style={{ color: '#B45309' }}
              >
                ← Go Back
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : '🗑️ Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
