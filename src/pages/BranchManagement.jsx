import { useState } from 'react'
import {
  GitBranch, Plus, Edit2, Trash2, MapPin, Phone, Mail, User,
  X, Check, Building2, Search, LayoutGrid, List, Eye,
  CheckCircle, XCircle, ChevronLeft, ChevronRight
} from 'lucide-react'

const PAGE_SIZE = 10

const EMPTY = { name: '', city: '', state: '', address: '', manager: '', phone: '', email: '', type: '', status: 'Active' }

// Per-stat card styling
const STAT_STYLES = {
  All:        { bg: '#EFF6FF', iconBg: '#DBEAFE', iconColor: '#2563EB', textColor: '#1D4ED8', borderColor: '#BFDBFE' },
  Active:     { bg: '#ECFDF5', iconBg: '#D1FAE5', iconColor: '#059669', textColor: '#047857', borderColor: '#A7F3D0' },
  Inactive:   { bg: '#FEF2F2', iconBg: '#FEE2E2', iconColor: '#DC2626', textColor: '#B91C1C', borderColor: '#FECACA' },
}

export default function BranchManagement({ branches = [], addBranch, updateBranch, deleteBranch }) {
  const [search,   setSearch]   = useState('')
  const [page,     setPage]     = useState(1)
  const [filter,   setFilter]   = useState('All')   // 'All' | 'Active' | 'Inactive'
  const [viewMode, setViewMode] = useState('table')  // 'cards' | 'table'
  const [modal,    setModal]    = useState(null)
  const [form,     setForm]     = useState(EMPTY)
  const [editId,   setEditId]   = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [viewItem, setViewItem] = useState(null)   // branch shown in the read-only detail modal
  const [errors,   setErrors]   = useState({})
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)

  const filtered = branches.filter(b => {
    const matchStatus = filter === 'All' || b.status === filter
    const matchSearch =
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.city.toLowerCase().includes(search.toLowerCase()) ||
      b.manager.toLowerCase().includes(search.toLowerCase()) ||
      (b.code || '').toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  // ── Pagination (10 rows per page) ──────────────────────────
  const total       = filtered.length
  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage    = Math.min(page, totalPages)
  const paged       = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const openAdd    = () => { setForm(EMPTY); setErrors({}); setModal('add') }
  const openEdit   = (b) => { setForm({ name: b.name, city: b.city, state: b.state, address: b.address, manager: b.manager, phone: b.phone, email: b.email, type: b.type, status: b.status }); setEditId(b._id || b.id); setErrors({}); setModal('edit') }
  const openDelete = (b) => { setDeleteId(b._id || b.id); setModal('delete') }
  const closeModal = () => { setModal(null); setEditId(null); setDeleteId(null); setErrors({}) }

  const validate = () => {
    const e = {}
    if (!form.name.trim())    e.name    = 'Branch name is required'
    if (!form.city.trim())    e.city    = 'City is required'
    if (!form.state.trim())   e.state   = 'State is required'
    if (!form.address.trim()) e.address = 'Address is required'
    if (!form.manager.trim()) e.manager = 'Manager name is required'
    if (!form.phone.trim())        e.phone = 'Phone is required'
    else if (!/^\d{10}$/.test(form.phone)) e.phone = 'Enter a valid 10-digit mobile number'
    if (!form.email.trim())   e.email   = 'Email is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    if (modal === 'add') {
      const result = await addBranch?.(form)
      if (result?.success === false) {
        setErrors(e => ({ ...e, _global: result.message || 'Failed to create branch' }))
        setSaving(false)
        return
      }
    } else {
      const result = await updateBranch?.(editId, form)
      if (result?.success === false) {
        setErrors(e => ({ ...e, _global: result.message || 'Failed to update branch' }))
        setSaving(false)
        return
      }
    }
    setSaving(false)
    closeModal()
  }

  const handleDelete = async () => {
    setDeleting(true)
    const result = await deleteBranch?.(deleteId)
    if (result?.success === false) {
      setDeleting(false)
      alert(result.message || 'Failed to delete branch')
      return
    }
    setDeleting(false)
    closeModal()
  }

  const stats = [
    { key: 'All',        label: 'Total Branches', value: branches.length,                                      icon: GitBranch  },
    { key: 'Active',     label: 'Active',          value: branches.filter(b => b.status === 'Active').length,   icon: CheckCircle },
    { key: 'Inactive',   label: 'Inactive',        value: branches.filter(b => b.status === 'Inactive').length, icon: XCircle    },
  ]

  const F = (k, label, placeholder, type = 'text', opts = {}) => {
    const { icon = null, hint = null, prefix = null } = opts
    const hasErr = !!errors[k]
    return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{label}</label>
      <div style={{
        display: 'flex', alignItems: 'center',
        border: `1.5px solid ${hasErr ? '#EF4444' : '#E2E8F0'}`,
        borderRadius: 9, background: '#FAFBFC', overflow: 'hidden',
        transition: 'all 0.15s',
      }}
        onFocusCapture={e => { e.currentTarget.style.borderColor = '#FD5C02'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(253,92,2,0.1)'; e.currentTarget.style.background = '#fff' }}
        onBlurCapture={e => { e.currentTarget.style.borderColor = hasErr ? '#EF4444' : '#E2E8F0'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = '#FAFBFC' }}
      >
        {icon && <span style={{ display: 'flex', paddingLeft: 11, color: '#94A3B8', flexShrink: 0 }}>{icon}</span>}
        {prefix && <span style={{ paddingLeft: 10, fontSize: 13, fontWeight: 600, color: '#64748B', flexShrink: 0 }}>{prefix}</span>}
        <input
          type={type}
          value={form[k]}
          maxLength={k === 'phone' ? 10 : undefined}
          inputMode={k === 'phone' ? 'numeric' : undefined}
          onChange={e => {
            // Phone: keep digits only and cap at 10.
            const val = k === 'phone' ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value
            setForm(p => ({ ...p, [k]: val })); setErrors(p => ({ ...p, [k]: '' }))
          }}
          placeholder={placeholder}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '10px 12px',
            border: 'none', borderRadius: 9, fontSize: 13, color: '#01152D',
            background: 'transparent', outline: 'none',
            paddingLeft: (icon || prefix) ? 8 : 12,
          }}nd s
        />
      </div>
      {hasErr
        ? <div style={{ fontSize: 11, color: '#EF4444', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}><XCircle size={11} />{errors[k]}</div>
        : hint ? <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{hint}</div> : null}
    </div>
    )
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <span>Company Management</span><span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-active">Branch Management</span>
      </div>

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <div className="page-title">Branch Management</div>
          <div className="page-desc">Manage company branches across all locations</div>
        </div>
        <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: 'linear-gradient(135deg,#FD5C02,#FE7722)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(253,92,2,0.3)', whiteSpace: 'nowrap' }}>
          <Plus size={15} /> Add Branch
        </button>
      </div>

      {/* Stat cards — clickable to filter */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {stats.map(s => {
          const st     = STAT_STYLES[s.key]
          const Icon   = s.icon
          const active = filter === s.key && !s.noFilter
          return (
            <div
              key={s.key}
              onClick={() => { if (!s.noFilter) { setFilter(active ? 'All' : s.key); setPage(1) } }}
              style={{
                background:   active ? st.iconBg : st.bg,
                border:       `1.5px solid ${active ? st.iconColor : st.borderColor}`,
                borderRadius: 10,
                padding:      '13px 15px',
                cursor:       s.noFilter ? 'default' : 'pointer',
                display:      'flex',
                alignItems:   'center',
                gap:          11,
                boxShadow:    active ? `0 0 0 3px ${st.borderColor}` : 'var(--shadow)',
                transition:   'all 0.15s',
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 9, flexShrink: 0,
                background: st.iconBg,
                border:     `1px solid ${st.borderColor}`,
                display:    'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon style={{ width: 17, height: 17, color: st.iconColor }} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: st.textColor, marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: st.textColor, lineHeight: 1 }}>{s.value}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Search + view toggle */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, boxShadow: 'var(--shadow)' }}>
        <Search size={14} color="#94A3B8" style={{ flexShrink: 0 }} />
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Search by branch name, city, code or manager…"
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, color: '#01152D', background: 'transparent' }}
        />
        {search && <button onClick={() => { setSearch(''); setPage(1) }} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', display: 'flex' }}><X size={13} /></button>}

        {/* Status filter pills */}
        <div style={{ display: 'flex', gap: 6, marginLeft: 8, flexShrink: 0 }}>
          {[
            { key: 'All',      color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
            { key: 'Active',   color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
            { key: 'Inactive', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
          ].map(s => {
            const active = filter === s.key
            return (
              <button
                key={s.key}
                onClick={() => { setFilter(s.key); setPage(1) }}
                style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                  border: `1.5px solid ${active ? s.color : s.border}`,
                  background: active ? s.color : s.bg,
                  color: active ? '#fff' : s.color,
                  cursor: 'pointer', transition: 'all 0.13s',
                }}
              >{s.key}</button>
            )
          })}
        </div>

        {/* View toggle */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 8, background: '#F4F6F9', borderRadius: 8, padding: 3, flexShrink: 0 }}>
          <button
            title="Card View"
            onClick={() => setViewMode('cards')}
            style={{ padding: '5px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', background: viewMode === 'cards' ? '#fff' : 'transparent', color: viewMode === 'cards' ? '#FD5C02' : '#94A3B8', boxShadow: viewMode === 'cards' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', display: 'flex', alignItems: 'center' }}
          ><LayoutGrid size={14} /></button>
          <button
            title="Table View"
            onClick={() => setViewMode('table')}
            style={{ padding: '5px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', background: viewMode === 'table' ? '#fff' : 'transparent', color: viewMode === 'table' ? '#FD5C02' : '#94A3B8', boxShadow: viewMode === 'table' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', display: 'flex', alignItems: 'center' }}
          ><List size={14} /></button>
        </div>
      </div>

      {/* ── TABLE VIEW ── */}
      {viewMode === 'table' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Branches ({filtered.length})</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Branch Name</th>
                  <th>City / State</th>
                  <th>Manager</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>No branches found</td></tr>
                ) : paged.map(b => (
                  <tr key={b._id || b.id}>
                    <td style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}>{b.code}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: '#FFF3EC', border: '1px solid #FED7B8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Building2 size={15} color="#FD5C02" />
                        </div>
                        <div>
                          <div className="user-name">{b.name}</div>
                          <div className="user-role">{b.address.substring(0, 40)}{b.address.length > 40 ? '…' : ''}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={11} color="#FD5C02" />
                        {b.city}, {b.state}
                      </div>
                    </td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <User size={11} color="var(--text-muted)" />
                        {b.manager}
                      </div>
                    </td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Phone size={11} color="var(--primary)" />
                        {b.phone}
                      </div>
                    </td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Mail size={11} color="var(--primary)" />
                        {b.email}
                      </div>
                    </td>
                    <td>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
                        background: b.type === 'Head Office' ? '#EFF6FF' : '#F4F6F9',
                        color:      b.type === 'Head Office' ? '#2563EB'  : '#64748B',
                        border:     `1px solid ${b.type === 'Head Office' ? '#BFDBFE' : '#E2E8F0'}`,
                        whiteSpace: 'nowrap',
                      }}>{b.type || '—'}</span>
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
                        background: b.status === 'Active' ? '#ECFDF5' : '#FEF2F2',
                        color:      b.status === 'Active' ? '#059669'  : '#DC2626',
                        border:     `1px solid ${b.status === 'Active' ? '#A7F3D0' : '#FECACA'}`,
                      }}>
                        {b.status === 'Active'
                          ? <CheckCircle size={9} />
                          : <XCircle size={9} />
                        }
                        {b.status}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-ghost btn-xs" title="View" onClick={() => setViewItem(b)} style={{ color: '#2563EB' }}>
                          <Eye size={13} />
                        </button>
                        <button className="btn btn-ghost btn-xs" title="Edit" onClick={() => openEdit(b)} style={{ color: '#3B82F6' }}>
                          <Edit2 size={13} />
                        </button>
                        <button className="btn btn-ghost btn-xs" title="Delete" onClick={() => openDelete(b)} style={{ color: '#EF4444' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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
      )}

      {/* ── CARDS VIEW ── */}
      {viewMode === 'cards' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 360px))', gap: 16 }}>
          {filtered.length === 0 ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 20px', color: '#94A3B8' }}>
              <GitBranch size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: '#64748B', marginBottom: 4 }}>No branches found</div>
              <div style={{ fontSize: 13, color: '#94A3B8' }}>Try adjusting your search or filter</div>
            </div>
          ) : filtered.map(b => (
            <div
              key={b._id || b.id}
              style={{ background: '#fff', borderRadius: 14, border: '1px solid #E8EDF3', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden', transition: 'box-shadow 0.15s, transform 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 22px rgba(1,21,45,0.10)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)'; e.currentTarget.style.transform = 'none' }}
            >
              {/* Status accent bar */}
              <div style={{ height: 4, background: b.status === 'Active' ? 'linear-gradient(90deg,#FD5C02,#FE8A3A)' : '#CBD5E1' }} />
              <div style={{ padding: '16px 18px' }}>
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 11, background: 'linear-gradient(135deg,#FFF3EC,#FFE3D0)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Building2 size={19} color="#FD5C02" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#01152D', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: '#FD5C02', background: '#FFF3EC', padding: '1px 7px', borderRadius: 5 }}>{b.code}</span>
                        {b.type && <span style={{ fontSize: 11, color: '#94A3B8' }}>{b.type}</span>}
                      </div>
                    </div>
                  </div>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: 10.5, fontWeight: 700, padding: '4px 10px', borderRadius: 20, flexShrink: 0,
                    background: b.status === 'Active' ? '#ECFDF5' : '#FEF2F2',
                    color:      b.status === 'Active' ? '#059669'  : '#DC2626',
                    border:     `1px solid ${b.status === 'Active' ? '#A7F3D0' : '#FECACA'}`,
                  }}>
                    {b.status === 'Active' ? <CheckCircle size={10} /> : <XCircle size={10} />}
                    {b.status}
                  </span>
                </div>

                {/* Info block */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, background: '#FAFBFC', border: '1px solid #F1F5F9', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
                  <InfoRow icon={<MapPin size={13} color="#FD5C02" />} text={`${b.city}, ${b.state}`} />
                  <InfoRow icon={<User size={13} color="#64748B" />}   text={<><span style={{ color: '#94A3B8' }}>Manager: </span>{b.manager}</>} />
                  <InfoRow icon={<Phone size={13} color="#059669" />}  text={b.phone} />
                  <InfoRow icon={<Mail size={13} color="#2563EB" />}   text={b.email} />
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid #F1F5F9' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <ActionBtn icon={<Eye size={13} />}    color="#2563EB" bg="#EFF6FF" onClick={() => setViewItem(b)} title="View" />
                    <ActionBtn icon={<Edit2 size={13} />}  color="#3B82F6" bg="#EFF6FF" onClick={() => openEdit(b)}   title="Edit" />
                    <ActionBtn icon={<Trash2 size={13} />} color="#EF4444" bg="#FEF2F2" onClick={() => openDelete(b)} title="Delete" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── View (read-only) Modal ── */}
      {viewItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20, backdropFilter: 'blur(2px)' }} onClick={() => setViewItem(null)}>
          <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: '20px 26px', borderBottom: '1px solid #E8EDF3', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: 'linear-gradient(135deg,#FFF3EC,#FFE3D0)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Building2 size={20} color="#FD5C02" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#01152D' }}>{viewItem.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', color: '#FD5C02', background: '#FFF3EC', padding: '2px 8px', borderRadius: 5 }}>{viewItem.code}</span>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
                    background: viewItem.status === 'Active' ? '#ECFDF5' : '#FEF2F2',
                    color:      viewItem.status === 'Active' ? '#059669'  : '#DC2626',
                    border:     `1px solid ${viewItem.status === 'Active' ? '#A7F3D0' : '#FECACA'}`,
                  }}>
                    {viewItem.status === 'Active' ? <CheckCircle size={10} /> : <XCircle size={10} />}{viewItem.status}
                  </span>
                </div>
                {viewItem.type && <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{viewItem.type}</div>}
              </div>
              <button onClick={() => setViewItem(null)} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', cursor: 'pointer', color: '#94A3B8', borderRadius: 8, padding: 6, display: 'flex' }}><X size={18} /></button>
            </div>

            {/* Body — label/value grid */}
            <div style={{ padding: '20px 26px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {[
                  ['Branch Code',  viewItem.code],
                  ['Branch Name',  viewItem.name],
                  ['Branch Type',  viewItem.type || '—'],
                  ['Status',       viewItem.status],
                  ['City',         viewItem.city || '—'],
                  ['State',        viewItem.state || '—'],
                  ['Manager',      viewItem.manager || '—'],
                  ['Phone',        viewItem.phone || '—'],
                  ['Email',        viewItem.email || '—'],
                ].map(([label, val]) => (
                  <div key={label} style={{ background: '#FAFBFC', border: '1px solid #F1F5F9', borderRadius: 9, padding: '10px 13px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94A3B8', marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#01152D', wordBreak: 'break-word' }}>{val}</div>
                  </div>
                ))}
              </div>
              {/* Full address — spans both columns */}
              <div style={{ background: '#FAFBFC', border: '1px solid #F1F5F9', borderRadius: 9, padding: '10px 13px', marginTop: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94A3B8', marginBottom: 3 }}>Full Address</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#01152D', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{viewItem.address || '—'}</div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 26px 22px', borderTop: '1px solid #E8EDF3', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setViewItem(null)} style={{ padding: '10px 20px', borderRadius: 9, border: '1.5px solid #E2E8F0', background: '#F8FAFC', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Close</button>
              <button onClick={() => { const b = viewItem; setViewItem(null); openEdit(b) }} style={{ padding: '10px 22px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#FD5C02,#FE7722)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, boxShadow: '0 4px 14px rgba(253,92,2,0.3)' }}>
                <Edit2 size={14} /> Edit Branch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {(modal === 'add' || modal === 'edit') && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20, backdropFilter: 'blur(2px)' }}>
          <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            {/* Header with icon */}
            <div style={{ padding: '20px 26px', borderBottom: '1px solid #E8EDF3', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#FFF3EC,#FFE3D0)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <GitBranch size={20} color="#FD5C02" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#01152D' }}>{modal === 'add' ? 'Add New Branch' : 'Edit Branch'}</div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>{modal === 'add' ? 'Create a new branch location for your company' : 'Update this branch\u2019s details'}</div>
              </div>
              <button onClick={closeModal} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', cursor: 'pointer', color: '#94A3B8', borderRadius: 8, padding: 6, display: 'flex' }}><X size={18} /></button>
            </div>

            <div style={{ padding: '20px 26px' }}>
              {errors._global && (
                <div style={{ marginBottom: 16, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <XCircle size={15} style={{ flexShrink: 0 }} />{errors._global}
                </div>
              )}

              {/* Section: Branch Info */}
              <SectionLabel icon={<Building2 size={13} />} text="Branch Information" />
              {F('name', 'Branch Name *', 'e.g. Mysore Branch', 'text', { icon: <GitBranch size={15} /> })}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {F('type', 'Branch Type', 'Head Office, Showroom…', 'text', { hint: 'Optional' })}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2E8F0', borderRadius: 9, fontSize: 13, color: '#01152D', background: '#FAFBFC', outline: 'none', cursor: 'pointer' }}
                  >
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </div>
              </div>

              {/* Section: Location */}
              <SectionLabel icon={<MapPin size={13} />} text="Location" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {F('city',  'City *',  'e.g. Mysore', 'text', { icon: <MapPin size={15} /> })}
                {F('state', 'State *', 'e.g. Karnataka')}
              </div>
              {F('address', 'Full Address *', 'Street, Area, City \u2013 PIN')}

              {/* Section: Contact */}
              <SectionLabel icon={<User size={13} />} text="Contact" />
              {F('manager', 'Branch Manager *', 'Manager name', 'text', { icon: <User size={15} /> })}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {F('phone', 'Mobile Number *', '9876543210', 'tel', { prefix: '+91', hint: '10-digit number' })}
                {F('email', 'Email *', 'branch@company.com', 'email', { icon: <Mail size={15} /> })}
              </div>
            </div>
            <div style={{ padding: '14px 26px 22px', borderTop: '1px solid #E8EDF3', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={closeModal} disabled={saving} style={{ padding: '10px 20px', borderRadius: 9, border: '1.5px solid #E2E8F0', background: '#F8FAFC', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '10px 22px', borderRadius: 9, border: 'none', background: saving ? '#FEB895' : 'linear-gradient(135deg,#FD5C02,#FE7722)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 7, boxShadow: saving ? 'none' : '0 4px 14px rgba(253,92,2,0.3)', transition: 'all 0.15s' }}>
                <Check size={14} /> {saving ? 'Saving…' : (modal === 'add' ? 'Add Branch' : 'Save Changes')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {modal === 'delete' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20, backdropFilter: 'blur(2px)' }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 400, padding: '28px 28px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Trash2 size={22} color="#EF4444" />
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#01152D', textAlign: 'center', marginBottom: 8 }}>Delete Branch?</div>
            <div style={{ fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 24 }}>
              This action cannot be undone. All branch data will be permanently removed.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={closeModal} disabled={deleting} style={{ flex: 1, padding: '10px 0', borderRadius: 9, border: '1.5px solid #E2E8F0', background: '#F8FAFC', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.6 : 1 }}>Cancel</button>
              <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, padding: '10px 0', borderRadius: 9, border: 'none', background: deleting ? '#F87171' : '#EF4444', color: '#fff', fontSize: 13, fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}>
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoRow({ icon, text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
      <span style={{ color: '#94A3B8', flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <span style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.4 }}>{text}</span>
    </div>
  )
}

function SectionLabel({ icon, text }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      fontSize: 11, fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase',
      color: '#FD5C02', margin: '4px 0 12px', paddingBottom: 7, borderBottom: '1px solid #F1F5F9',
    }}>
      <span style={{ display: 'flex' }}>{icon}</span>{text}
    </div>
  )
}

function ActionBtn({ icon, color, bg, onClick, title }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{ width: 30, height: 30, borderRadius: 7, background: bg, border: 'none', color, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.92)'}
      onMouseLeave={e => e.currentTarget.style.filter = 'none'}
    >{icon}</button>
  )
}
