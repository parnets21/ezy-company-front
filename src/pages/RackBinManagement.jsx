import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Search, X, Edit2, Trash2, RefreshCw, Map } from 'lucide-react'
import { rackBinApi } from '../api/purchaseInventoryApi'
import usePermissions from '../hooks/usePermissions'
import { MODULES, ACTIONS } from '../config/permissions'

const EMPTY_FORM = { warehouse_id: '', rack_name: '', bin_name: '', code: '', capacity: '', remarks: '', is_active: true }

export default function RackBinManagement({ warehouses = [] }) {
  const { canPerform } = usePermissions()
  const mayCreate = canPerform(MODULES.RACK_BIN, ACTIONS.CREATE)
  const mayEdit   = canPerform(MODULES.RACK_BIN, ACTIONS.EDIT)
  const mayDelete = canPerform(MODULES.RACK_BIN, ACTIONS.DELETE)

  const [racks,       setRacks]       = useState([])
  const [loading,     setLoading]     = useState(false)
  const [search,      setSearch]      = useState('')
  const [whFilter,    setWhFilter]    = useState('')
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
      const params = { limit: 300 }
      if (whFilter) params.warehouse_id = whFilter
      const res = await rackBinApi.list(params)
      const d = res?.data || res
      setRacks(Array.isArray(d) ? d : (Array.isArray(d?.rack_bins) ? d.rack_bins : []))
    } catch { fire('Failed to load', 'error') }
    finally { setLoading(false) }
  }, [whFilter])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return racks
    return racks.filter(r => [r.rack_name, r.bin_name, r.code, r.warehouse_name].some(v => (v || '').toLowerCase().includes(q)))
  }, [racks, search])

  const openEdit = r => { setEditItem(r); setForm({ warehouse_id: r.warehouse_id?._id || r.warehouse_id || '', rack_name: r.rack_name || '', bin_name: r.bin_name || '', code: r.code || '', capacity: r.capacity || '', remarks: r.remarks || '', is_active: r.is_active !== false }); setShowModal(true) }

  const handleSave = async () => {
    if (!form.warehouse_id) return fire('Select a warehouse', 'error')
    if (!form.rack_name)    return fire('Rack name required', 'error')
    setSaving(true)
    try {
      if (editItem) { await rackBinApi.update(editItem._id, form); fire('Updated') }
      else          { await rackBinApi.create(form); fire('Created') }
      setShowModal(false); load()
    } catch (e) { fire(e?.response?.data?.message || 'Save failed', 'error') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    try { await rackBinApi.delete(deleteTarget._id); fire('Deleted'); setDeleteTarget(null); load() }
    catch { fire('Delete failed', 'error') }
  }

  // Group by warehouse
  const grouped = useMemo(() => {
    const map = {}
    filtered.forEach(r => {
      const wh = r.warehouse_name || r.warehouse_id?.name || 'Unknown'
      if (!map[wh]) map[wh] = []
      map[wh].push(r)
    })
    return map
  }, [filtered])

  return (
    <div>
      {toast.msg && (
        <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 9999, background: toast.type === 'error' ? '#FEF2F2' : '#ECFDF5', border: `1px solid ${toast.type === 'error' ? '#FECACA' : '#A7F3D0'}`, color: toast.type === 'error' ? '#DC2626' : '#059669', padding: '10px 18px', borderRadius: 10, fontWeight: 600, fontSize: 13 }}>{toast.msg}</div>
      )}

      <div className="breadcrumb"><span>Inventory</span><span className="breadcrumb-sep">›</span><span className="breadcrumb-active">Rack / Bin</span></div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Map size={22} color="#F26522" /> Rack / Bin Locations</div>
          <div className="page-desc">Define storage locations within warehouses — Warehouse → Rack → Bin</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={14} /> Refresh</button>
          {mayCreate && <button className="btn btn-primary" onClick={() => { setEditItem(null); setForm(EMPTY_FORM); setShowModal(true) }}><Plus size={15} /> Add Location</button>}
        </div>
      </div>

      <div className="card" style={{ padding: '12px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input className="form-control" style={{ paddingLeft: 32 }} placeholder="Search rack, bin, code…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-control" style={{ width: 200 }} value={whFilter} onChange={e => setWhFilter(e.target.value)}>
            <option value="">All Warehouses</option>
            {warehouses.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>
          <Map size={32} style={{ opacity: 0.3, marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />No rack/bin locations found
        </div>
      ) : Object.entries(grouped).map(([wh, locs]) => (
        <div key={wh} className="card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
          <div style={{ background: '#1E2D4A', color: '#fff', padding: '10px 16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Map size={15} /> {wh} <span style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '1px 8px', fontSize: 12, marginLeft: 4 }}>{locs.length}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 0 }}>
            {locs.map(loc => (
              <div key={loc._id} style={{ padding: '12px 16px', borderRight: '1px solid #F1F5F9', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#1E2D4A' }}>{loc.rack_name}{loc.bin_name ? ` / ${loc.bin_name}` : ''}</div>
                  {loc.code && <div style={{ fontSize: 11, color: '#F26522', fontWeight: 700, marginTop: 2 }}>{loc.code}</div>}
                  {loc.capacity && <div style={{ fontSize: 11, color: '#64748B' }}>Cap: {loc.capacity}</div>}
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 8, background: loc.is_active !== false ? '#ECFDF5' : '#F1F5F9', color: loc.is_active !== false ? '#059669' : '#9CA3AF' }}>
                    {loc.is_active !== false ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {mayEdit   && <button className="btn btn-ghost btn-xs" onClick={() => openEdit(loc)} style={{ color: '#059669' }}><Edit2 size={12} /></button>}
                  {mayDelete && <button className="btn btn-ghost btn-xs" onClick={() => setDeleteTarget(loc)} style={{ color: '#DC2626' }}><Trash2 size={12} /></button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editItem ? 'Edit Location' : 'Add Rack/Bin Location'}</span>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Warehouse *</label>
                  <select className="form-control" value={form.warehouse_id} onChange={e => setForm(f => ({ ...f, warehouse_id: e.target.value }))}>
                    <option value="">-- Select Warehouse --</option>
                    {warehouses.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Rack Name *</label>
                  <input className="form-control" value={form.rack_name} onChange={e => setForm(f => ({ ...f, rack_name: e.target.value }))} placeholder="e.g. Rack A" />
                </div>
                <div>
                  <label className="form-label">Bin Name</label>
                  <input className="form-control" value={form.bin_name} onChange={e => setForm(f => ({ ...f, bin_name: e.target.value }))} placeholder="e.g. Bin A-12" />
                </div>
                <div>
                  <label className="form-label">Location Code</label>
                  <input className="form-control" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. WH1-A-12" />
                </div>
                <div>
                  <label className="form-label">Capacity</label>
                  <input className="form-control" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} placeholder="e.g. 500 boxes" />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Remarks</label>
                  <input className="form-control" value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Status</label>
                  <select className="form-control" value={form.is_active ? 'Active' : 'Inactive'} onChange={e => setForm(f => ({ ...f, is_active: e.target.value === 'Active' }))}>
                    <option>Active</option><option>Inactive</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : editItem ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Delete Location</span><button className="modal-close" onClick={() => setDeleteTarget(null)}><X size={16} /></button></div>
            <div className="modal-body"><p>Delete <b>{deleteTarget.rack_name}{deleteTarget.bin_name ? '/' + deleteTarget.bin_name : ''}</b>?</p></div>
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
