import { useState } from 'react'
import { Plus, Search, Phone, Mail, Edit2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 10

const SOURCES = ['Website', 'WhatsApp', 'Facebook', 'Instagram', 'Google Ads', 'Referral']
// ── Requirement §10: Exact lead statuses ──
const STATUSES = ['New', 'Follow-up', 'Interested', 'Not Interested', 'Converted']
const statusColor = {
  New:            'badge-blue',
  'Follow-up':    'badge-cyan',
  Interested:     'badge-yellow',
  'Not Interested': 'badge-red',
  Converted:      'badge-green',
}
const sourceIcon = { Website: '🌐', WhatsApp: '💬', Facebook: '📘', Instagram: '📸', 'Google Ads': '🔍', Referral: '🤝' }

const EMPTY_FORM = { name: '', mobile: '', email: '', city: '', source: 'WhatsApp', notes: '', followup: '' }

export default function LeadManagement({ leads = [], addLead, updateLead, deleteLead, convertLead, loadingData }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('All')
  const [sourceFilter, setSourceFilter] = useState('All')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [successMsg, setSuccessMsg] = useState('')
  const [saving, setSaving] = useState(false)

  const toast = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3500) }

  const filtered = leads.filter(l =>
    (statusFilter === 'All' || (l.status || 'New') === statusFilter) &&
    (sourceFilter === 'All' || (l.source || '') === sourceFilter) &&
    ((l.name || '').toLowerCase().includes(search.toLowerCase()) || (l.mobile || '').includes(search))
  )

  // ── Pagination (10 rows per page) ──────────────────────────
  const total       = filtered.length
  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage    = Math.min(page, totalPages)
  const paged       = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Name required'
    if (!form.mobile.trim() || !/^\d{10}$/.test(form.mobile)) e.mobile = 'Valid 10-digit mobile required'
    return e
  }

  const handleSave = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    const result = await addLead?.({ name: form.name, mobile: form.mobile, email: form.email, source: form.source, notes: form.notes })
    setSaving(false)
    if (result?.success === false) { toast(`Error: ${result.message}`); return }
    setForm(EMPTY_FORM); setErrors({})
    setShowModal(false)
    toast(`Lead added for ${form.name}`)
  }

  const handleStatusChange = async (id, newStatus) => {
    if (newStatus === 'Converted') {
      const result = await convertLead?.(id)
      if (result?.success === false) toast(`Error: ${result.message}`)
      else toast('Lead converted to customer')
    } else {
      const result = await updateLead?.(id, { status: newStatus })
      if (result?.success === false) toast(`Error: ${result.message}`)
    }
  }

  const handleDelete = async (id) => {
    const result = await deleteLead?.(id)
    if (result?.success === false) toast(`Error: ${result.message}`)
    else toast('Lead deleted')
  }

  return (
    <>
      <div className="breadcrumb"><span>CRM & Leads</span><span className="breadcrumb-sep">›</span><span className="breadcrumb-active">Lead Management</span></div>

      {successMsg && (
        <div className="alert alert-info" style={{ marginBottom: 14 }}>✓ {successMsg}</div>
      )}

      {/* Pipeline */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
        {STATUSES.map(s => {
          const borderColor = s === 'Converted' ? 'var(--success)' : s === 'Not Interested' ? 'var(--danger)' : s === 'Interested' ? 'var(--warning)' : s === 'Follow-up' ? 'var(--info)' : 'var(--primary)'
          return (
            <div key={s} className="card" style={{ padding: '14px', textAlign: 'center', cursor: 'pointer', borderTop: `3px solid ${borderColor}` }}
              onClick={() => { setStatusFilter(statusFilter === s ? 'All' : s); setPage(1) }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{leads.filter(l => (l.status || 'New') === s).length}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s}</div>
            </div>
          )
        })}
      </div>

      {/* Source filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="chip" style={{ background: sourceFilter === 'All' ? 'var(--primary)' : undefined, color: sourceFilter === 'All' ? '#fff' : undefined, cursor: 'pointer' }} onClick={() => { setSourceFilter('All'); setPage(1) }}>All Sources</button>
        {SOURCES.map(s => (
          <button key={s} className="chip" style={{ background: sourceFilter === s ? 'var(--primary-light)' : undefined, color: sourceFilter === s ? 'var(--primary)' : undefined, borderColor: sourceFilter === s ? 'var(--primary)' : undefined, cursor: 'pointer' }} onClick={() => { setSourceFilter(s); setPage(1) }}>
            {sourceIcon[s]} {s} ({leads.filter(l => (l.source || '') === s).length})
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Leads ({filtered.length})</span>
          <div className="header-actions">
            <div className="search-bar"><Search /><input placeholder="Search leads…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} /></div>
            <button className="btn btn-primary" onClick={() => { setForm(EMPTY_FORM); setErrors({}); setShowModal(true) }}><Plus />Add Lead</button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Lead</th><th>Mobile/Email</th><th>Source</th><th>Notes</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
            <tbody>
              {loadingData && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24 }}>Loading…</td></tr>}
              {!loadingData && paged.map(l => {
                const id = l._id || l.id
                return (
                  <tr key={id}>
                    <td><div className="user-name">{l.name}</div><div className="user-role" style={{ fontSize: 10 }}>{id}</div></td>
                    <td style={{ fontSize: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Phone style={{ width: 11 }} />{l.mobile}</div>
                      {l.email && <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}><Mail style={{ width: 11 }} />{l.email}</div>}
                    </td>
                    <td><span className="chip" style={{ fontSize: 11 }}>{sourceIcon[l.source] || '📋'} {l.source || '—'}</span></td>
                    <td style={{ fontSize: 12, maxWidth: 180 }}>{l.notes || '—'}</td>
                    <td>
                      <select className="form-control" style={{ fontSize: 11, padding: '3px 6px', width: 120 }}
                        value={l.status || 'New'}
                        onChange={e => handleStatusChange(id, e.target.value)}>
                        {STATUSES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {l.created_at ? new Date(l.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-ghost btn-xs" title="Delete" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(id)}><Trash2 style={{ width: 13 }} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!loadingData && filtered.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No leads found</td></tr>
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

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Add New Lead</span><button className="btn-ghost" onClick={() => setShowModal(false)}>✕</button></div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input className={`form-control${errors.name ? ' error' : ''}`} placeholder="Lead name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                  {errors.name && <div className="form-error">{errors.name}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Mobile *</label>
                  <input className={`form-control${errors.mobile ? ' error' : ''}`} placeholder="10-digit mobile" inputMode="numeric" maxLength={10} value={form.mobile} onChange={e => setForm(p => ({ ...p, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))} />
                  {errors.mobile && <div className="form-error">{errors.mobile}</div>}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-control" placeholder="Email address" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Lead Source</label>
                  <select className="form-control" value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))}>
                    {SOURCES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes / Requirement</label>
                <textarea className="form-control" rows={2} placeholder="e.g. 1000 Sq Ft vitrified floor tiles" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={saving} onClick={handleSave}>{saving ? 'Saving…' : 'Save Lead'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
