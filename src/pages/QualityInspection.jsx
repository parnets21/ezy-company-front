import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Plus, Search, X, Eye, CheckCircle, XCircle,
  RefreshCw, AlertCircle, ShieldCheck, ClipboardCheck,
} from 'lucide-react'
import { qualityInspectionApi, grnApi } from '../api/purchaseInventoryApi'
import usePermissions from '../hooks/usePermissions'
import { MODULES, ACTIONS } from '../config/permissions'

const STATUS_MAP = {
  Pending:  { bg: '#FEF3C7', color: '#D97706', border: '#FDE68A' },
  Approved: { bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' },
  Rejected: { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
}

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtN    = n => Number(n || 0).toLocaleString('en-IN')

function StatusPill({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP['Pending']
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{status || 'Pending'}</span>
}

const EMPTY_FORM = {
  grn_id: '',
  inspection_date: new Date().toISOString().slice(0, 10),
  inspected_by: '',
  remarks: '',
  items: [],
}

export default function QualityInspection({ products = [], warehouses = [] }) {
  const { canPerform } = usePermissions()
  const mayCreate  = canPerform(MODULES.QUALITY_INSPECTION, ACTIONS.CREATE)
  const mayApprove = canPerform(MODULES.QUALITY_INSPECTION, ACTIONS.APPROVE)

  const [inspections,  setInspections]  = useState([])
  const [grns,         setGrns]         = useState([])
  const [loading,      setLoading]      = useState(false)
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showModal,    setShowModal]    = useState(false)
  const [viewItem,     setViewItem]     = useState(null)
  const [form,         setForm]         = useState(EMPTY_FORM)
  const [saving,       setSaving]       = useState(false)
  const [toast,        setToast]        = useState({ msg: '', type: 'success' })
  const [approveTarget,setApproveTarget]= useState(null)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [remarksText,  setRemarksText]  = useState('')

  const fire = (msg, type = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: 'success' }), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [qcRes, grnRes] = await Promise.allSettled([
        qualityInspectionApi.list({ limit: 200 }),
        grnApi.list({ limit: 200, status: 'Approved' }),
      ])
      if (qcRes.status === 'fulfilled') {
        const d = qcRes.value?.data || qcRes.value
        setInspections(Array.isArray(d) ? d : (Array.isArray(d?.inspections) ? d.inspections : []))
      }
      if (grnRes.status === 'fulfilled') {
        const d = grnRes.value?.data || grnRes.value
        setGrns(Array.isArray(d) ? d : (Array.isArray(d?.grns) ? d.grns : []))
      }
    } catch { fire('Failed to load', 'error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return inspections.filter(i => {
      const matchS = statusFilter === 'all' || i.status === statusFilter
      const matchQ = !q || [i.qc_number, i.grn_number, i.supplier_name]
        .some(v => (v || '').toLowerCase().includes(q))
      return matchS && matchQ
    })
  }, [inspections, search, statusFilter])

  // When GRN selected, pre-fill items from GRN received items
  const onGRNSelect = (grnId) => {
    const grn = grns.find(g => g._id === grnId)
    if (!grn) { setForm(f => ({ ...f, grn_id: grnId, items: [] })); return }
    setForm(f => ({
      ...f,
      grn_id: grnId,
      items: (grn.items || []).map(i => ({
        product_id:      i.product_id?._id || i.product_id || '',
        product_name:    i.product_name || '',
        received_qty:    parseFloat(i.received_qty) || 0,
        first_quality:   '',
        second_quality:  '',
        damaged:         '',
        rejected:        '',
        unit:            i.unit || 'Box',
        remarks:         '',
      })),
    }))
  }

  const setLine = (idx, field, val) =>
    setForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, [field]: val } : it) }))

  const handleSave = async () => {
    if (!form.grn_id) return fire('Select a GRN', 'error')
    if (!form.items.length) return fire('No items', 'error')
    setSaving(true)
    try {
      await qualityInspectionApi.create(form)
      fire('Quality inspection created'); setShowModal(false); load()
    } catch (e) { fire(e?.response?.data?.message || 'Save failed', 'error') }
    finally { setSaving(false) }
  }

  const handleApprove = async () => {
    try {
      await qualityInspectionApi.approve(approveTarget._id, { remarks: remarksText })
      fire('QC approved — stock quality updated')
      setApproveTarget(null); setRemarksText(''); load()
    } catch { fire('Approve failed', 'error') }
  }

  const handleReject = async () => {
    if (!remarksText.trim()) return fire('Rejection reason required', 'error')
    try {
      await qualityInspectionApi.reject(rejectTarget._id, remarksText)
      fire('QC rejected'); setRejectTarget(null); setRemarksText(''); load()
    } catch { fire('Reject failed', 'error') }
  }

  const kpi = useMemo(() => ({
    total:    inspections.length,
    pending:  inspections.filter(i => i.status === 'Pending').length,
    approved: inspections.filter(i => i.status === 'Approved').length,
    rejected: inspections.filter(i => i.status === 'Rejected').length,
  }), [inspections])

  return (
    <div>
      {toast.msg && (
        <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 9999, background: toast.type === 'error' ? '#FEF2F2' : '#ECFDF5', border: `1px solid ${toast.type === 'error' ? '#FECACA' : '#A7F3D0'}`, color: toast.type === 'error' ? '#DC2626' : '#059669', padding: '10px 18px', borderRadius: 10, fontWeight: 600, fontSize: 13, boxShadow: '0 4px 16px rgba(0,0,0,0.10)' }}>{toast.msg}</div>
      )}

      <div className="breadcrumb"><span>Purchase</span><span className="breadcrumb-sep">›</span><span className="breadcrumb-active">Quality Inspection</span></div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ShieldCheck size={22} color="#F26522" /> Quality Inspection</div>
          <div className="page-desc">Post-GRN quality check — classify stock into First Quality, Second Quality, and Damaged</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={14} /> Refresh</button>
          {mayCreate && <button className="btn btn-primary" onClick={() => { setForm(EMPTY_FORM); setShowModal(true) }}><Plus size={15} /> New Inspection</button>}
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total', value: kpi.total, color: '#1E2D4A' },
          { label: 'Pending', value: kpi.pending, color: '#D97706' },
          { label: 'Approved', value: kpi.approved, color: '#059669' },
          { label: 'Rejected', value: kpi.rejected, color: '#DC2626' },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: k.color, marginTop: 4 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* QC Flow Info */}
      <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
        <AlertCircle size={16} color="#2563EB" />
        <span style={{ color: '#1E40AF' }}>After GRN approval: <b>First Quality</b> → Saleable stock · <b>Second Quality</b> → Separate stock · <b>Damaged</b> → Excluded from saleable stock</span>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input className="form-control" style={{ paddingLeft: 32 }} placeholder="Search QC no, GRN no, supplier…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-control" style={{ width: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            {Object.keys(STATUS_MAP).map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#1E2D4A', color: '#fff' }}>
              {['QC No', 'Date', 'GRN No', 'Supplier', 'Items', 'First Quality', 'Second Quality', 'Damaged', 'Status', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: ['First Quality','Second Quality','Damaged','Actions'].includes(h) ? 'right' : 'left', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>
                <ShieldCheck size={32} style={{ opacity: 0.3, marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />No inspections found
              </td></tr>
            ) : filtered.map(r => {
              const fq = (r.items || []).reduce((a, i) => a + (parseFloat(i.first_quality) || 0), 0)
              const sq = (r.items || []).reduce((a, i) => a + (parseFloat(i.second_quality) || 0), 0)
              const dm = (r.items || []).reduce((a, i) => a + (parseFloat(i.damaged) || 0), 0)
              return (
                <tr key={r._id} style={{ borderBottom: '1px solid #F1F5F9' }} onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: '#F26522' }}>{r.qc_number || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{fmtDate(r.inspection_date)}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{r.grn_number || r.grn_id?.grn_number || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{r.supplier_name || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{(r.items || []).length}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#059669', fontWeight: 700 }}>{fmtN(fq)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#D97706' }}>{fmtN(sq)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#DC2626' }}>{fmtN(dm)}</td>
                  <td style={{ padding: '10px 12px' }}><StatusPill status={r.status} /></td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-xs" title="View" onClick={() => setViewItem(r)} style={{ color: '#2563EB' }}><Eye size={13} /></button>
                      {mayApprove && r.status === 'Pending' && (
                        <>
                          <button className="btn btn-ghost btn-xs" title="Approve" onClick={() => { setApproveTarget(r); setRemarksText('') }} style={{ color: '#059669' }}><CheckCircle size={13} /></button>
                          <button className="btn btn-ghost btn-xs" title="Reject"  onClick={() => { setRejectTarget(r); setRemarksText('') }} style={{ color: '#DC2626' }}><XCircle size={13} /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 960, width: '100%', maxHeight: '93vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10 }}>
              <span className="modal-title"><ShieldCheck size={16} style={{ marginRight: 8 }} />New Quality Inspection</span>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 14 }}>
                <div>
                  <label className="form-label">GRN (Approved) *</label>
                  <select className="form-control" value={form.grn_id} onChange={e => onGRNSelect(e.target.value)}>
                    <option value="">-- Select GRN --</option>
                    {grns.map(g => <option key={g._id} value={g._id}>{g.grn_number} — {g.supplier_name || '—'}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Inspection Date *</label>
                  <input type="date" className="form-control" value={form.inspection_date} onChange={e => setForm(f => ({ ...f, inspection_date: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Inspected By</label>
                  <input className="form-control" value={form.inspected_by} onChange={e => setForm(f => ({ ...f, inspected_by: e.target.value }))} placeholder="Name of inspector" />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Remarks</label>
                  <input className="form-control" value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} />
                </div>
              </div>

              {form.items.length > 0 && (
                <>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#1E2D4A', marginBottom: 8 }}>Inspection Results</div>
                  <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '8px 14px', marginBottom: 10, fontSize: 12, color: '#9A3412' }}>
                    Enter quantities for each quality grade. Total (First + Second + Damaged + Rejected) should equal Received qty.
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#F8FAFC' }}>
                          <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, width: '25%' }}>Product</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>Received</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>1st Quality</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#D97706' }}>2nd Quality</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#DC2626' }}>Damaged</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#7C3AED' }}>Rejected</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>Unit</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.items.map((line, idx) => {
                          const total = (parseFloat(line.first_quality) || 0) + (parseFloat(line.second_quality) || 0) + (parseFloat(line.damaged) || 0) + (parseFloat(line.rejected) || 0)
                          const ok = total === parseFloat(line.received_qty)
                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9', background: total > 0 && !ok ? '#FEF9C3' : '' }}>
                              <td style={{ padding: '7px 8px', fontWeight: 600 }}>{line.product_name || '—'}</td>
                              <td style={{ padding: '7px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#64748B' }}>{fmtN(line.received_qty)}</td>
                              <td style={{ padding: '7px 8px' }}><input type="number" min="0" className="form-control" value={line.first_quality} onChange={e => setLine(idx, 'first_quality', e.target.value)} style={{ textAlign: 'right', width: 80, borderColor: '#059669' }} /></td>
                              <td style={{ padding: '7px 8px' }}><input type="number" min="0" className="form-control" value={line.second_quality} onChange={e => setLine(idx, 'second_quality', e.target.value)} style={{ textAlign: 'right', width: 80, borderColor: '#D97706' }} /></td>
                              <td style={{ padding: '7px 8px' }}><input type="number" min="0" className="form-control" value={line.damaged} onChange={e => setLine(idx, 'damaged', e.target.value)} style={{ textAlign: 'right', width: 80, borderColor: '#DC2626' }} /></td>
                              <td style={{ padding: '7px 8px' }}><input type="number" min="0" className="form-control" value={line.rejected} onChange={e => setLine(idx, 'rejected', e.target.value)} style={{ textAlign: 'right', width: 80 }} /></td>
                              <td style={{ padding: '7px 8px', color: '#64748B' }}>{line.unit}</td>
                              <td style={{ padding: '7px 8px' }}><input className="form-control" value={line.remarks} onChange={e => setLine(idx, 'remarks', e.target.value)} /></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {!form.grn_id && <div style={{ textAlign: 'center', padding: 20, color: '#94A3B8', fontSize: 13 }}>Select an approved GRN to begin inspection</div>}
            </div>
            <div className="modal-footer" style={{ position: 'sticky', bottom: 0, background: 'var(--surface)', zIndex: 10 }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Create Inspection'}</button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewItem && (
        <div className="modal-overlay" onClick={() => setViewItem(null)}>
          <div className="modal" style={{ maxWidth: 800, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">QC — {viewItem.qc_number}</span><button className="modal-close" onClick={() => setViewItem(null)}><X size={16} /></button></div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                {[['QC No', viewItem.qc_number], ['Date', fmtDate(viewItem.inspection_date)], ['Status', null],
                  ['GRN No', viewItem.grn_number || '—'], ['Supplier', viewItem.supplier_name || '—'], ['Inspected By', viewItem.inspected_by || '—'],
                ].map(([l, v], i) => (
                  <div key={i} style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700 }}>{l}</div>
                    <div style={{ fontWeight: 700, color: '#1E2D4A', marginTop: 2 }}>{v === null ? <StatusPill status={viewItem.status} /> : v}</div>
                  </div>
                ))}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: '#F1F5F9' }}>
                  {['#','Product','Received','1st Quality','2nd Quality','Damaged','Rejected','Unit'].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: ['Received','1st Quality','2nd Quality','Damaged','Rejected'].includes(h) ? 'right' : 'left', fontWeight: 700 }}>{h}</th>)}
                </tr></thead>
                <tbody>{(viewItem.items || []).map((it, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '8px 10px' }}>{i + 1}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{it.product_name || '—'}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtN(it.received_qty)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#059669', fontWeight: 700 }}>{fmtN(it.first_quality)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#D97706' }}>{fmtN(it.second_quality)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#DC2626' }}>{fmtN(it.damaged)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#7C3AED' }}>{fmtN(it.rejected)}</td>
                    <td style={{ padding: '8px 10px' }}>{it.unit}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setViewItem(null)}>Close</button></div>
          </div>
        </div>
      )}

      {/* Approve */}
      {approveTarget && (
        <div className="modal-overlay" onClick={() => setApproveTarget(null)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Approve Inspection</span><button className="modal-close" onClick={() => setApproveTarget(null)}><X size={16} /></button></div>
            <div className="modal-body">
              <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#065F46' }}>
                Approving will update stock quality breakdown in inventory.
              </div>
              <label className="form-label">Remarks</label>
              <textarea className="form-control" rows={2} value={remarksText} onChange={e => setRemarksText(e.target.value)} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setApproveTarget(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleApprove}><CheckCircle size={14} /> Approve</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject */}
      {rejectTarget && (
        <div className="modal-overlay" onClick={() => setRejectTarget(null)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Reject Inspection</span><button className="modal-close" onClick={() => setRejectTarget(null)}><X size={16} /></button></div>
            <div className="modal-body">
              <label className="form-label">Reason *</label>
              <textarea className="form-control" rows={2} value={remarksText} onChange={e => setRemarksText(e.target.value)} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setRejectTarget(null)}>Cancel</button>
              <button className="btn" style={{ background: '#DC2626', color: '#fff' }} onClick={handleReject}><XCircle size={14} /> Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
