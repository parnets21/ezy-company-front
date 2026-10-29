import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Search, X, Edit2, Trash2, RefreshCw, Droplets } from 'lucide-react'
import { shadeCaliberApi } from '../api/purchaseInventoryApi'
import usePermissions from '../hooks/usePermissions'
import { MODULES, ACTIONS } from '../config/permissions'

const EMPTY_SHADE = { product_id: '', product_name: '', shade_code: '', shade_name: '', description: '', is_active: true }
const EMPTY_CALIBER = { product_id: '', product_name: '', caliber_code: '', caliber_name: '', dimensions: '', tolerance: '', is_active: true }

export default function ShadeCaliberManagement({ products = [], warehouses = [], inventory = [] }) {
  const { canPerform } = usePermissions()
  const mayCreate = canPerform(MODULES.SHADE_CALIBER, ACTIONS.CREATE)
  const mayEdit   = canPerform(MODULES.SHADE_CALIBER, ACTIONS.EDIT)
  const mayDelete = canPerform(MODULES.SHADE_CALIBER, ACTIONS.DELETE)

  const [activeTab, setActiveTab]     = useState('shades')
  const [shades,    setShades]        = useState([])
  const [calibers,  setCalibers]      = useState([])
  const [loading,   setLoading]       = useState(false)
  const [search,    setSearch]        = useState('')
  const [showModal, setShowModal]     = useState(false)
  const [editItem,  setEditItem]      = useState(null)
  const [form,      setForm]          = useState(EMPTY_SHADE)
  const [saving,    setSaving]        = useState(false)
  const [toast,     setToast]         = useState({ msg: '', type: 'success' })
  const [deleteTarget, setDeleteTarget] = useState(null)

  const fire = (msg, type = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: 'success' }), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [shRes, calRes] = await Promise.allSettled([
        shadeCaliberApi.listShades({ limit: 300 }),
        shadeCaliberApi.listCalibers({ limit: 300 }),
      ])
      if (shRes.status === 'fulfilled') { const d = shRes.value?.data || shRes.value; setShades(Array.isArray(d) ? d : (Array.isArray(d?.shades) ? d.shades : [])) }
      if (calRes.status === 'fulfilled') { const d = calRes.value?.data || calRes.value; setCalibers(Array.isArray(d) ? d : (Array.isArray(d?.calibers) ? d.calibers : [])) }
    } catch { fire('Failed to load', 'error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const items = activeTab === 'shades' ? shades : calibers
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(i => [i.shade_code, i.shade_name, i.caliber_code, i.caliber_name, i.product_name].some(v => (v || '').toLowerCase().includes(q)))
  }, [items, search])

  const openAdd = () => {
    setEditItem(null); setForm(activeTab === 'shades' ? EMPTY_SHADE : EMPTY_CALIBER); setShowModal(true)
  }
  const openEdit = item => {
    setEditItem(item)
    if (activeTab === 'shades') setForm({ product_id: item.product_id?._id || item.product_id || '', product_name: item.product_name || '', shade_code: item.shade_code || '', shade_name: item.shade_name || '', description: item.description || '', is_active: item.is_active !== false })
    else setForm({ product_id: item.product_id?._id || item.product_id || '', product_name: item.product_name || '', caliber_code: item.caliber_code || '', caliber_name: item.caliber_name || '', dimensions: item.dimensions || '', tolerance: item.tolerance || '', is_active: item.is_active !== false })
    setShowModal(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (activeTab === 'shades') {
        if (editItem) { await shadeCaliberApi.updateShade(editItem._id, form); fire('Shade updated') }
        else          { await shadeCaliberApi.createShade(form); fire('Shade created') }
      } else {
        if (editItem) { await shadeCaliberApi.updateCaliber(editItem._id, form); fire('Caliber updated') }
        else          { await shadeCaliberApi.createCaliber(form); fire('Caliber created') }
      }
      setShowModal(false); load()
    } catch (e) { fire(e?.response?.data?.message || 'Save failed', 'error') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    try {
      if (activeTab === 'shades') await shadeCaliberApi.deleteShade(deleteTarget._id)
      else                         await shadeCaliberApi.deleteCaliber(deleteTarget._id)
      fire('Deleted'); setDeleteTarget(null); load()
    } catch { fire('Delete failed', 'error') }
  }

  return (
    <div>
      {toast.msg && (
        <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 9999, background: toast.type === 'error' ? '#FEF2F2' : '#ECFDF5', border: `1px solid ${toast.type === 'error' ? '#FECACA' : '#A7F3D0'}`, color: toast.type === 'error' ? '#DC2626' : '#059669', padding: '10px 18px', borderRadius: 10, fontWeight: 600, fontSize: 13 }}>{toast.msg}</div>
      )}

      <div className="breadcrumb"><span>Inventory</span><span className="breadcrumb-sep">›</span><span className="breadcrumb-active">Shade / Caliber</span></div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Droplets size={22} color="#F26522" /> Shade / Caliber</div>
          <div className="page-desc">Manage shade codes and caliber specifications for tile products</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={14} /> Refresh</button>
          {mayCreate && <button className="btn btn-primary" onClick={openAdd}><Plus size={15} /> Add {activeTab === 'shades' ? 'Shade' : 'Caliber'}</button>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '2px solid #E2E8F0' }}>
        {[['shades', 'Shades'], ['calibers', 'Calibers']].map(([key, label]) => (
          <button key={key} onClick={() => { setActiveTab(key); setSearch('') }} style={{ padding: '10px 24px', fontWeight: 700, fontSize: 14, border: 'none', background: 'none', cursor: 'pointer', color: activeTab === key ? '#F26522' : '#64748B', borderBottom: activeTab === key ? '2px solid #F26522' : '2px solid transparent', marginBottom: -2 }}>
            {label} ({key === 'shades' ? shades.length : calibers.length})
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: '12px 18px', marginBottom: 16 }}>
        <div style={{ position: 'relative', maxWidth: 360 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input className="form-control" style={{ paddingLeft: 32 }} placeholder={`Search ${activeTab === 'shades' ? 'shade code, name' : 'caliber code, name'}…`} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#1E2D4A', color: '#fff' }}>
              {(activeTab === 'shades'
                ? ['Shade Code','Shade Name','Product','Description','Status','Actions']
                : ['Caliber Code','Caliber Name','Product','Dimensions','Tolerance','Status','Actions']
              ).map(h => <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Actions' ? 'right' : 'left', fontWeight: 700 }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Loading…</td></tr>
            : filtered.length === 0 ? <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>No {activeTab === 'shades' ? 'shades' : 'calibers'} found</td></tr>
            : filtered.map(item => (
              <tr key={item._id} style={{ borderBottom: '1px solid #F1F5F9' }} onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: '#F26522' }}>{activeTab === 'shades' ? item.shade_code : item.caliber_code}</td>
                <td style={{ padding: '10px 14px', fontWeight: 600 }}>{activeTab === 'shades' ? item.shade_name : item.caliber_name}</td>
                <td style={{ padding: '10px 14px' }}>{item.product_name || '—'}</td>
                <td style={{ padding: '10px 14px' }}>{activeTab === 'shades' ? (item.description || '—') : (item.dimensions || '—')}</td>
                {activeTab === 'calibers' && <td style={{ padding: '10px 14px' }}>{item.tolerance || '—'}</td>}
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: item.is_active !== false ? '#ECFDF5' : '#F1F5F9', color: item.is_active !== false ? '#059669' : '#9CA3AF' }}>
                    {item.is_active !== false ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    {mayEdit   && <button className="btn btn-ghost btn-xs" onClick={() => openEdit(item)} style={{ color: '#059669' }}><Edit2 size={13} /></button>}
                    {mayDelete && <button className="btn btn-ghost btn-xs" onClick={() => setDeleteTarget(item)} style={{ color: '#DC2626' }}><Trash2 size={13} /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">{editItem ? 'Edit' : 'Add'} {activeTab === 'shades' ? 'Shade' : 'Caliber'}</span><button className="modal-close" onClick={() => setShowModal(false)}><X size={16} /></button></div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Product</label>
                  <select className="form-control" value={form.product_id} onChange={e => { const p = products.find(x => (x._id || x.id) === e.target.value); setForm(f => ({ ...f, product_id: e.target.value, product_name: p?.name || '' })) }}>
                    <option value="">-- All Products / Select --</option>
                    {products.map(p => <option key={p._id || p.id} value={p._id || p.id}>{p.name}</option>)}
                  </select>
                </div>
                {activeTab === 'shades' ? (
                  <>
                    <div><label className="form-label">Shade Code *</label><input className="form-control" value={form.shade_code} onChange={e => setForm(f => ({ ...f, shade_code: e.target.value }))} placeholder="e.g. S12" /></div>
                    <div><label className="form-label">Shade Name</label><input className="form-control" value={form.shade_name} onChange={e => setForm(f => ({ ...f, shade_name: e.target.value }))} placeholder="e.g. Light Brown" /></div>
                    <div style={{ gridColumn: '1/-1' }}><label className="form-label">Description</label><input className="form-control" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                  </>
                ) : (
                  <>
                    <div><label className="form-label">Caliber Code *</label><input className="form-control" value={form.caliber_code} onChange={e => setForm(f => ({ ...f, caliber_code: e.target.value }))} placeholder="e.g. CAL-A" /></div>
                    <div><label className="form-label">Caliber Name</label><input className="form-control" value={form.caliber_name} onChange={e => setForm(f => ({ ...f, caliber_name: e.target.value }))} placeholder="e.g. Standard" /></div>
                    <div><label className="form-label">Dimensions</label><input className="form-control" value={form.dimensions} onChange={e => setForm(f => ({ ...f, dimensions: e.target.value }))} placeholder="e.g. 600x600 ±1mm" /></div>
                    <div><label className="form-label">Tolerance</label><input className="form-control" value={form.tolerance} onChange={e => setForm(f => ({ ...f, tolerance: e.target.value }))} placeholder="e.g. ±1mm" /></div>
                  </>
                )}
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
            <div className="modal-header"><span className="modal-title">Delete</span><button className="modal-close" onClick={() => setDeleteTarget(null)}><X size={16} /></button></div>
            <div className="modal-body"><p>Delete <b>{deleteTarget.shade_code || deleteTarget.caliber_code}</b>?</p></div>
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
