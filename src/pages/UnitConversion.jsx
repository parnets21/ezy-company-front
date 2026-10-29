import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Search, X, Edit2, Trash2, RefreshCw, Scale, AlertCircle } from 'lucide-react'
import { unitConversionApi } from '../api/purchaseInventoryApi'
import usePermissions from '../hooks/usePermissions'
import { MODULES, ACTIONS } from '../config/permissions'

const BASE_UNITS = ['Box', 'Piece', 'Sq.Ft', 'Sq.M', 'Pallet', 'Kg', 'Ton', 'Meter', 'Nos']

const EMPTY_FORM = {
  product_id: '',
  product_name: '',
  base_unit: 'Box',
  conversions: [{ from_unit: 'Box', to_unit: 'Piece', factor: '' }],
  remarks: '',
}

export default function UnitConversion({ products = [] }) {
  const { canPerform } = usePermissions()
  const mayCreate = canPerform(MODULES.UNIT_CONVERSION, ACTIONS.CREATE)
  const mayEdit   = canPerform(MODULES.UNIT_CONVERSION, ACTIONS.EDIT)
  const mayDelete = canPerform(MODULES.UNIT_CONVERSION, ACTIONS.DELETE)

  const [units,       setUnits]       = useState([])
  const [loading,     setLoading]     = useState(false)
  const [search,      setSearch]      = useState('')
  const [showModal,   setShowModal]   = useState(false)
  const [editItem,    setEditItem]    = useState(null)
  const [form,        setForm]        = useState(EMPTY_FORM)
  const [saving,      setSaving]      = useState(false)
  const [toast,       setToast]       = useState({ msg: '', type: 'success' })
  const [deleteTarget,setDeleteTarget]= useState(null)

  const fire = (msg, type = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: 'success' }), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await unitConversionApi.list({ limit: 200 })
      const d = res?.data || res
      setUnits(Array.isArray(d) ? d : (Array.isArray(d?.units) ? d.units : []))
    } catch { fire('Failed to load', 'error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return units
    return units.filter(u => (u.product_name || '').toLowerCase().includes(q))
  }, [units, search])

  const openAdd = () => { setEditItem(null); setForm(EMPTY_FORM); setShowModal(true) }
  const openEdit = u => {
    setEditItem(u)
    setForm({ product_id: u.product_id?._id || u.product_id || '', product_name: u.product_name || '', base_unit: u.base_unit || 'Box', conversions: u.conversions || [], remarks: u.remarks || '' })
    setShowModal(true)
  }

  const setConv = (idx, field, val) =>
    setForm(f => ({ ...f, conversions: f.conversions.map((c, i) => i === idx ? { ...c, [field]: val } : c) }))

  const handleSave = async () => {
    if (!form.product_id) return fire('Select a product', 'error')
    setSaving(true)
    try {
      if (editItem) { await unitConversionApi.update(editItem._id, form); fire('Updated') }
      else          { await unitConversionApi.create(form); fire('Created') }
      setShowModal(false); load()
    } catch (e) { fire(e?.response?.data?.message || 'Save failed', 'error') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    try { await unitConversionApi.delete(deleteTarget._id); fire('Deleted'); setDeleteTarget(null); load() }
    catch { fire('Delete failed', 'error') }
  }

  return (
    <div>
      {toast.msg && (
        <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 9999, background: toast.type === 'error' ? '#FEF2F2' : '#ECFDF5', border: `1px solid ${toast.type === 'error' ? '#FECACA' : '#A7F3D0'}`, color: toast.type === 'error' ? '#DC2626' : '#059669', padding: '10px 18px', borderRadius: 10, fontWeight: 600, fontSize: 13 }}>{toast.msg}</div>
      )}

      <div className="breadcrumb"><span>Inventory</span><span className="breadcrumb-sep">›</span><span className="breadcrumb-active">Units & Conversion</span></div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Scale size={22} color="#F26522" /> Units & Conversion</div>
          <div className="page-desc">Configure unit conversions per product — e.g. 1 Box = 4 Pieces = 16 Sq.Ft</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={14} /> Refresh</button>
          {mayCreate && <button className="btn btn-primary" onClick={openAdd}><Plus size={15} /> Add Conversion</button>}
        </div>
      </div>

      <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, display: 'flex', gap: 10 }}>
        <AlertCircle size={16} color="#2563EB" style={{ flexShrink: 0 }} />
        <span style={{ color: '#1E40AF' }}>Unit conversions are used throughout Purchase Orders and Inventory to automatically calculate multi-unit stock quantities.</span>
      </div>

      <div className="card" style={{ padding: '12px 18px', marginBottom: 16 }}>
        <div style={{ position: 'relative', maxWidth: 360 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input className="form-control" style={{ paddingLeft: 32 }} placeholder="Search product…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#1E2D4A', color: '#fff' }}>
              {['Product','Base Unit','Conversions','Actions'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Actions' ? 'right' : 'left', fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Loading…</td></tr>
            : filtered.length === 0 ? <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>No unit conversions configured</td></tr>
            : filtered.map(u => (
              <tr key={u._id} style={{ borderBottom: '1px solid #F1F5F9' }} onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                <td style={{ padding: '10px 14px', fontWeight: 600 }}>{u.product_name || '—'}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ background: '#EFF6FF', color: '#2563EB', padding: '2px 10px', borderRadius: 10, fontWeight: 700, fontSize: 12 }}>{u.base_unit}</span>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(u.conversions || []).map((c, i) => (
                      <span key={i} style={{ background: '#F1F5F9', color: '#1E2D4A', padding: '2px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
                        1 {c.from_unit} = {c.factor} {c.to_unit}
                      </span>
                    ))}
                  </div>
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    {mayEdit   && <button className="btn btn-ghost btn-xs" onClick={() => openEdit(u)} style={{ color: '#059669' }}><Edit2 size={13} /></button>}
                    {mayDelete && <button className="btn btn-ghost btn-xs" onClick={() => setDeleteTarget(u)} style={{ color: '#DC2626' }}><Trash2 size={13} /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editItem ? 'Edit Unit Conversion' : 'Add Unit Conversion'}</span>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label className="form-label">Product *</label>
                  <select className="form-control" value={form.product_id} onChange={e => {
                    const p = products.find(x => (x._id || x.id) === e.target.value)
                    setForm(f => ({ ...f, product_id: e.target.value, product_name: p?.name || '' }))
                  }} disabled={!!editItem}>
                    <option value="">-- Select Product --</option>
                    {products.map(p => <option key={p._id || p.id} value={p._id || p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Base Unit</label>
                  <select className="form-control" value={form.base_unit} onChange={e => setForm(f => ({ ...f, base_unit: e.target.value }))}>
                    {BASE_UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Conversions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {form.conversions.map((c, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto auto', gap: 8, alignItems: 'center' }}>
                    <select className="form-control" value={c.from_unit} onChange={e => setConv(idx, 'from_unit', e.target.value)}>
                      {BASE_UNITS.map(u => <option key={u}>{u}</option>)}
                    </select>
                    <span style={{ fontWeight: 700, textAlign: 'center' }}>=</span>
                    <input type="number" min="0" className="form-control" value={c.factor} onChange={e => setConv(idx, 'factor', e.target.value)} placeholder="Factor" />
                    <select className="form-control" value={c.to_unit} onChange={e => setConv(idx, 'to_unit', e.target.value)}>
                      {BASE_UNITS.map(u => <option key={u}>{u}</option>)}
                    </select>
                    <button type="button" onClick={() => setForm(f => ({ ...f, conversions: f.conversions.filter((_, i) => i !== idx) }))} style={{ border: 'none', background: 'none', color: '#DC2626', cursor: 'pointer' }}><X size={14} /></button>
                  </div>
                ))}
              </div>
              <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 10 }} onClick={() => setForm(f => ({ ...f, conversions: [...f.conversions, { from_unit: 'Box', to_unit: 'Piece', factor: '' }] }))}><Plus size={13} /> Add Row</button>
              <div style={{ marginTop: 14 }}>
                <label className="form-label">Remarks</label>
                <input className="form-control" value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : editItem ? 'Update' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Delete</span><button className="modal-close" onClick={() => setDeleteTarget(null)}><X size={16} /></button></div>
            <div className="modal-body"><p>Delete unit conversion for <b>{deleteTarget.product_name}</b>?</p></div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn" style={{ background: '#DC2626', color: '#fff' }} onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
