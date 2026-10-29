import { useState } from 'react'
import { Plus, Bell, CalendarClock, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 10

const statusColor = { Pending: 'badge-blue', Done: 'badge-green', Missed: 'badge-red' }

// Generate time slots every 30 min from 06:00 to 22:00
const TIME_SLOTS = (() => {
  const slots = []
  for (let h = 6; h <= 22; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hh = h % 12 === 0 ? 12 : h % 12
      const mm = m === 0 ? '00' : '30'
      const ampm = h < 12 ? 'AM' : 'PM'
      const val = `${String(h).padStart(2, '0')}:${mm}`
      slots.push({ value: val, label: `${hh}:${mm} ${ampm}` })
    }
  }
  return slots
})()

const EMPTY_FORM = { followup_date: '', followup_time: '10:00', notes: '', lead_id: '', customer_id: '' }

export default function FollowUpManagement({ followups = [], leads = [], customers = [], addFollowup, updateFollowup, deleteFollowup, loadingData }) {
  const [showModal, setShowModal] = useState(false)
  const [page, setPage] = useState(1)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [successMsg, setSuccessMsg] = useState('')
  const [saving, setSaving] = useState(false)

  const toast = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3500) }

  // This page has no search/filter — the main list is the followups array itself.
  const filtered = followups

  // ── Pagination (10 rows per page) ──────────────────────────
  const total       = filtered.length
  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage    = Math.min(page, totalPages)
  const paged       = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const validate = () => {
    const e = {}
    if (!form.followup_date) e.followup_date = 'Date required'
    if (!form.notes.trim()) e.notes = 'Notes required'
    if (!form.lead_id && !form.customer_id) e.lead_id = 'Select a lead or customer'
    return e
  }

  const handleSave = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    // Combine date + time into a full ISO datetime
    const dateTimeStr = form.followup_time
      ? `${form.followup_date}T${form.followup_time}:00`
      : `${form.followup_date}T00:00:00`
    const result = await addFollowup?.({
      followup_date: dateTimeStr,
      notes: form.notes,
      lead_id: form.lead_id || undefined,
      customer_id: form.customer_id || undefined,
    })
    setSaving(false)
    if (result?.success === false) { toast(`Error: ${result.message}`); return }
    setForm(EMPTY_FORM); setErrors({})
    setShowModal(false)
    toast('Follow-up scheduled')
  }

  const markDone = async (id) => {
    const result = await updateFollowup?.(id, { status: 'Done', done_at: new Date().toISOString() })
    if (result?.success !== false) toast('Follow-up marked as done')
  }

  const handleDelete = async (id) => {
    await deleteFollowup?.(id)
    toast('Follow-up deleted')
  }

  return (
    <>
      <div className="breadcrumb"><span>CRM & Leads</span><span className="breadcrumb-sep">›</span><span className="breadcrumb-active">Follow-up Management</span></div>

      {successMsg && (
        <div className="alert alert-info" style={{ marginBottom: 14 }}>✓ {successMsg}</div>
      )}

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        {[
          { label: 'Total Follow-ups', val: followups.length, color: 'blue' },
          { label: 'Pending',   val: followups.filter(f => (f.status || 'Pending') === 'Pending').length, color: 'orange' },
          { label: 'Done',      val: followups.filter(f => f.status === 'Done').length, color: 'green' },
          { label: 'Missed',    val: followups.filter(f => f.status === 'Missed').length, color: 'red' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ padding: '14px 16px' }}>
            <div className={`stat-icon ${s.color}`}><CalendarClock /></div>
            <div className="stat-info"><div className="stat-label">{s.label}</div><div className="stat-value" style={{ fontSize: 20 }}>{s.val}</div></div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Follow-up Schedule ({followups.length})</span>
          <button className="btn btn-primary" onClick={() => { setForm(EMPTY_FORM); setErrors({}); setShowModal(true) }}><Plus />Schedule Follow-up</button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loadingData && <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Loading…</div>}
          {!loadingData && paged.map(f => {
            const id = f._id || f.id
            const partyName = f.lead_id?.name || f.customer_id?.name || '—'
            const partyType = f.lead_id ? 'Lead' : f.customer_id ? 'Customer' : '—'
            const dateStr = f.followup_date
              ? new Date(f.followup_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
              : '—'
            const day = f.followup_date ? new Date(f.followup_date).getDate() : '--'
            const mon = f.followup_date ? new Date(f.followup_date).toLocaleString('en-IN', { month: 'short' }) : '—'
            const yr  = f.followup_date ? new Date(f.followup_date).getFullYear() : ''
            return (
              <div key={id} style={{ display: 'flex', gap: 16, padding: '16px', background: 'var(--bg)', borderRadius: 10, border: `1px solid var(--border)` }}>
                <div style={{ textAlign: 'center', minWidth: 60 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{mon}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)', lineHeight: 1 }}>{day}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{yr}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{partyName}</span>
                    <span className={`badge ${partyType === 'Lead' ? 'badge-blue' : 'badge-green'}`} style={{ fontSize: 10 }}>{partyType}</span>
                    <span className={`badge ${statusColor[f.status] || 'badge-gray'}`} style={{ fontSize: 10 }}>{f.status || 'Pending'}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                    {dateStr}
                    {f.followup_date && (() => {
                      const d = new Date(f.followup_date)
                      const hh = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12
                      const mm = String(d.getMinutes()).padStart(2, '0')
                      const ap = d.getHours() < 12 ? 'AM' : 'PM'
                      return (d.getHours() !== 0 || d.getMinutes() !== 0)
                        ? <span style={{ marginLeft: 8, fontWeight: 600, color: 'var(--primary)' }}>⏰ {hh}:{mm} {ap}</span>
                        : null
                    })()}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text)' }}>{f.notes}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexShrink: 0 }}>
                  {(f.status === 'Pending' || !f.status) && (
                    <button className="btn btn-success btn-xs" onClick={() => markDone(id)}>
                      <CheckCircle style={{ width: 12 }} />Done
                    </button>
                  )}
                  <button className="btn btn-ghost btn-xs" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(id)}>✕</button>
                </div>
              </div>
            )
          })}
          {!loadingData && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No follow-ups scheduled</div>
          )}
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
          <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Schedule Follow-up</span><button className="btn-ghost" onClick={() => setShowModal(false)}>✕</button></div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Lead</label>
                  <select className="form-control" value={form.lead_id} onChange={e => setForm(p => ({ ...p, lead_id: e.target.value, customer_id: '' }))}>
                    <option value="">— Select Lead —</option>
                    {leads.map(l => <option key={l._id || l.id} value={l._id || l.id}>{l.name}</option>)}
                  </select>
                  {errors.lead_id && <div className="form-error">{errors.lead_id}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Or Customer</label>
                  <select className="form-control" value={form.customer_id} onChange={e => setForm(p => ({ ...p, customer_id: e.target.value, lead_id: '' }))}>
                    <option value="">— Select Customer —</option>
                    {customers.map(c => <option key={c._id || c.id} value={c._id || c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Date *</label>
                  <input className={`form-control${errors.followup_date ? ' error' : ''}`} type="date" value={form.followup_date} onChange={e => setForm(p => ({ ...p, followup_date: e.target.value }))} />
                  {errors.followup_date && <div className="form-error">{errors.followup_date}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">From Time</label>
                  <select className="form-control" value={form.followup_time} onChange={e => setForm(p => ({ ...p, followup_time: e.target.value }))}>
                    {TIME_SLOTS.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes *</label>
                <textarea className={`form-control${errors.notes ? ' error' : ''}`} rows={3} placeholder="What to discuss…" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
                {errors.notes && <div className="form-error">{errors.notes}</div>}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={saving} onClick={handleSave}>{saving ? 'Saving…' : 'Schedule'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
