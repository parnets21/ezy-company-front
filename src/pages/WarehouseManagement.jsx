import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Plus, MapPin, Warehouse, Edit2, Trash2, Eye, X, Search,
  CheckCircle, RefreshCw, Package, AlertCircle, ArrowRightLeft,
  ChevronDown, BarChart3, TrendingDown, TrendingUp, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { inventoryApi } from '../api/inventoryApi'

const PAGE_SIZE = 10

// ── Constants ─────────────────────────────────────────────────
const WAREHOUSE_TYPES = ['Main Warehouse', 'Branch Warehouse', 'Transit Hub', 'Cold Storage', 'Depot', 'Other']

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
  'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
  'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram',
  'Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu',
  'Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Delhi','Jammu & Kashmir','Ladakh','Puducherry','Chandigarh',
]

const EMPTY_FORM = {
  name:'', warehouse_type:'', address:'', city:'', state:'',
  pincode:'', contact_person:'', mobile:'', email:'', manager:'',
  is_active: true, branch_id:'', capacity:'', unit:'Sq Ft',
}

function validate(form) {
  const e = {}
  if (!form.name.trim())  e.name  = 'Warehouse name is required'
  if (!form.city.trim())  e.city  = 'City is required'
  if (!form.state)        e.state = 'State is required'
  if (form.mobile && !/^\d{10}$/.test(form.mobile.trim())) e.mobile = 'Enter valid 10-digit mobile'
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Enter valid email'
  return e
}

function Field({ label, required, error, children }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}{required && ' *'}</label>
      {children}
      {error && <div className="form-error">{error}</div>}
    </div>
  )
}

function SkeletonRow({ cols }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i}><div style={{ height: 14, borderRadius: 6, background: 'var(--border)', opacity: 0.5, animation: 'pulse 1.4s ease-in-out infinite' }} /></td>
      ))}
    </tr>
  )
}

// ── Warehouse Form Modal ──────────────────────────────────────
function WarehouseModal({ editData, onClose, onSave, saving, branches = [] }) {
  const isEdit = !!editData?._id
  const [form, setForm] = useState(() => isEdit ? {
    name:           editData.name           || '',
    warehouse_type: editData.warehouse_type || '',
    address:        editData.address        || '',
    city:           editData.city           || '',
    state:          editData.state          || '',
    pincode:        editData.pincode        || '',
    contact_person: editData.contact_person || '',
    mobile:         editData.mobile         || '',
    email:          editData.email          || '',
    manager:        editData.manager        || '',
    is_active:      editData.is_active !== false,
    branch_id:      editData.branch_id      || '',
    capacity:       editData.capacity       || '',
    unit:           editData.unit           || 'Sq Ft',
  } : { ...EMPTY_FORM })
  const [errors, setErrors] = useState({})
  const set = (f) => (e) => setForm(p => ({ ...p, [f]: e.target.value }))

  const handleSubmit = () => {
    const errs = validate(form)
    if (Object.keys(errs).length) { setErrors(errs); return }
    onSave(form)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{isEdit ? `Edit — ${editData.name}` : 'Add New Warehouse'}</span>
          <button className="btn-ghost" onClick={onClose}><X style={{ width: 16 }} /></button>
        </div>
        <div className="modal-body">
          {/* Branch */}
          <Field label="Branch">
            <select className="form-control" value={form.branch_id} onChange={e => setForm(p => ({ ...p, branch_id: e.target.value }))}>
              <option value="">— No Branch —</option>
              {branches.filter(b => b.status !== 'Inactive').map(b => (
                <option key={b._id || b.id} value={b._id || b.id}>{b.name}{b.code ? ` (${b.code})` : ''}</option>
              ))}
            </select>
          </Field>

          <div className="form-row">
            <Field label="Warehouse Name" required error={errors.name}>
              <input className={`form-control${errors.name ? ' error' : ''}`}
                placeholder="e.g. Main Warehouse – Surat" value={form.name} onChange={set('name')} />
            </Field>
            <Field label="Type">
              <select className="form-control" value={form.warehouse_type} onChange={set('warehouse_type')}>
                <option value="">Select type</option>
                {WAREHOUSE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Address">
            <textarea className="form-control" rows={2} placeholder="Street / Plot / Area"
              value={form.address} onChange={set('address')} />
          </Field>

          <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <Field label="City" required error={errors.city}>
              <input className={`form-control${errors.city ? ' error' : ''}`}
                placeholder="City" value={form.city} onChange={set('city')} />
            </Field>
            <Field label="State" required error={errors.state}>
              <select className={`form-control${errors.state ? ' error' : ''}`}
                value={form.state} onChange={set('state')}>
                <option value="">Select state</option>
                {INDIAN_STATES.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Pincode">
              <input className="form-control" placeholder="6-digit PIN" maxLength={6}
                value={form.pincode} onChange={set('pincode')} />
            </Field>
          </div>

          <div className="form-row">
            <Field label="Contact Person">
              <input className="form-control" placeholder="Person to contact"
                value={form.contact_person} onChange={set('contact_person')} />
            </Field>
            <Field label="Mobile" error={errors.mobile}>
              <input className={`form-control${errors.mobile ? ' error' : ''}`}
                placeholder="10-digit mobile" maxLength={10}
                value={form.mobile} onChange={set('mobile')} />
            </Field>
          </div>

          <div className="form-row">
            <Field label="Email" error={errors.email}>
              <input className={`form-control${errors.email ? ' error' : ''}`}
                type="email" placeholder="warehouse@company.com"
                value={form.email} onChange={set('email')} />
            </Field>
            <Field label="Manager">
              <input className="form-control" placeholder="Manager name"
                value={form.manager} onChange={set('manager')} />
            </Field>
          </div>

          <div className="form-row">
            <Field label="Capacity">
              <input className="form-control" type="number" placeholder="e.g. 50000"
                value={form.capacity} onChange={set('capacity')} />
            </Field>
            <Field label="Capacity Unit">
              <select className="form-control" value={form.unit} onChange={set('unit')}>
                {['Sq Ft', 'Sq Mtr', 'Box', 'Pallet', 'Ton', 'Units'].map(u => <option key={u}>{u}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Active Status">
            <select className="form-control" value={form.is_active ? 'Active' : 'Inactive'}
              onChange={e => setForm(p => ({ ...p, is_active: e.target.value === 'Active' }))}>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </Field>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Update Warehouse' : 'Add Warehouse'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Warehouse Detail + Inventory Modal ────────────────────────
function WarehouseDetailModal({ warehouse, onClose, onEdit }) {
  const [stock,    setStock]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState('info')
  const [search,   setSearch]   = useState('')

  useEffect(() => {
    if (!warehouse?._id) return
    setLoading(true)
    inventoryApi.getWarehouseStock(warehouse._id)
      .then(res => setStock((res?.data || res)?.stock || []))
      .catch(() => setStock([]))
      .finally(() => setLoading(false))
  }, [warehouse?._id])

  const filteredStock = stock.filter(s =>
    (s.product_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.product_code || '').toLowerCase().includes(search.toLowerCase())
  )

  const totalStock = stock.reduce((a, s) => a + (s.current_stock || 0), 0)
  const lowStock   = stock.filter(s => (s.current_stock || 0) <= (s.low_stock_alert || 0)).length
  const outOfStock = stock.filter(s => (s.current_stock || 0) === 0).length

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 760 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="modal-title">{warehouse.name}</span>
              <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
                color: 'var(--primary)', background: 'var(--primary-light)', padding: '2px 8px', borderRadius: 4 }}>
                {warehouse.warehouse_code}
              </span>
              <span className={`badge ${warehouse.is_active !== false ? 'badge-green' : 'badge-gray'}`}>
                {warehouse.is_active !== false ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              {[warehouse.city, warehouse.state].filter(Boolean).join(', ')}
              {warehouse.warehouse_type && ` · ${warehouse.warehouse_type}`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => { onClose(); onEdit(warehouse) }}>
              <Edit2 style={{ width: 12 }} /> Edit
            </button>
            <button className="btn-ghost" onClick={onClose}><X style={{ width: 16 }} /></button>
          </div>
        </div>

        {/* Mini stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
          {[
            { label: 'Total SKUs', val: stock.length, color: 'var(--primary)', Icon: Package },
            { label: 'Total Stock', val: totalStock.toLocaleString(), color: 'var(--success)', Icon: BarChart3 },
            { label: 'Low / Out of Stock', val: `${lowStock} / ${outOfStock}`, color: outOfStock > 0 ? 'var(--danger)' : 'var(--warning)', Icon: TrendingDown },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10,
              background: 'var(--bg)', borderRadius: 8, padding: '10px 14px' }}>
              <s.Icon style={{ width: 18, color: s.color, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.label}</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: s.color }}>{s.val}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="tabs" style={{ padding: '0 16px', borderBottom: '1px solid var(--border)' }}>
          {[['info','Warehouse Info'],['inventory','Inventory / Stock']].map(([k, l]) => (
            <button key={k} className={`tab-btn${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        <div style={{ maxHeight: 420, overflowY: 'auto', padding: '16px 20px' }}>
          {tab === 'info' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                ['Warehouse Code', warehouse.warehouse_code],
                ['Type',           warehouse.warehouse_type],
                ['Address',        warehouse.address],
                ['City',           warehouse.city],
                ['State',          warehouse.state],
                ['Pincode',        warehouse.pincode],
                ['Contact Person', warehouse.contact_person],
                ['Mobile',         warehouse.mobile],
                ['Email',          warehouse.email],
                ['Manager',        warehouse.manager],
                ['Capacity',       warehouse.capacity ? `${warehouse.capacity} ${warehouse.unit || ''}` : null],
              ].filter(([, v]) => v).map(([label, val]) => (
                <div key={label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{val}</div>
                </div>
              ))}
            </div>
          )}

          {tab === 'inventory' && (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, color: 'var(--text-muted)' }} />
                  <input className="form-control" style={{ paddingLeft: 32 }}
                    placeholder="Search product name or code…"
                    value={search} onChange={e => setSearch(e.target.value)} />
                </div>
              </div>
              {loading ? (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={5} />)}</tbody>
                </table>
              ) : filteredStock.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                  {stock.length === 0 ? 'No inventory in this warehouse yet.' : 'No products match your search.'}
                </div>
              ) : (
                <div className="table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr><th>Code</th><th>Product</th><th>Stock In</th><th>Stock Out</th><th>Current Stock</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {filteredStock.map((s, i) => {
                        const st = s.current_stock === 0 ? 'Out' : s.current_stock <= (s.low_stock_alert || 0) ? 'Low' : 'OK'
                        return (
                          <tr key={i}>
                            <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--primary)', fontWeight: 700 }}>
                              {s.product_code || '—'}
                            </td>
                            <td style={{ fontWeight: 600, fontSize: 13 }}>{s.product_name || '—'}</td>
                            <td style={{ color: 'var(--success)', fontWeight: 600 }}>+{s.stock_in || 0}</td>
                            <td style={{ color: 'var(--danger)', fontWeight: 600 }}>-{s.stock_out || 0}</td>
                            <td style={{
                              fontWeight: 800, fontSize: 15,
                              color: st === 'Out' ? 'var(--danger)' : st === 'Low' ? 'var(--warning)' : 'var(--success)',
                            }}>
                              {s.current_stock || 0} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>{s.unit || ''}</span>
                            </td>
                            <td>
                              <span className={`badge ${st === 'OK' ? 'badge-green' : st === 'Low' ? 'badge-yellow' : 'badge-red'}`} style={{ fontSize: 10 }}>
                                {st === 'OK' ? 'In Stock' : st === 'Low' ? 'Low Stock' : 'Out of Stock'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function WarehouseManagement({ branches = [] }) {
  const [warehouses, setWarehouses] = useState([])
  const [loading,    setLoading]    = useState(false)
  const [showModal,  setShowModal]  = useState(false)
  const [editData,   setEditData]   = useState(null)
  const [viewData,   setViewData]   = useState(null)
  const [saving,     setSaving]     = useState(false)
  const [search,     setSearch]     = useState('')
  const [filterActive, setFilterActive] = useState('All')
  const [page,       setPage]       = useState(1)
  const [toast,      setToast]      = useState('')
  const [errorMsg,   setErrorMsg]   = useState('')

  const showToast = (msg, err = false) => {
    if (err) { setErrorMsg(msg); setTimeout(() => setErrorMsg(''), 5000) }
    else     { setToast(msg);   setTimeout(() => setToast(''), 3500) }
  }

  // ── Fetch warehouses from API ──────────────────────────────
  const fetchWarehouses = useCallback(async () => {
    setLoading(true)
    try {
      const res = await inventoryApi.listWarehouses()
      setWarehouses(Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [])
    } catch {
      showToast('Failed to load warehouses', true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchWarehouses() }, [fetchWarehouses])

  // ── CRUD ───────────────────────────────────────────────────
  const handleSave = useCallback(async (form) => {
    setSaving(true)
    try {
      if (editData?._id) {
        await inventoryApi.updateWarehouse(editData._id, form)
        showToast(`Warehouse "${form.name}" updated`)
      } else {
        await inventoryApi.createWarehouse(form)
        showToast(`Warehouse "${form.name}" created`)
      }
      setShowModal(false); setEditData(null)
      fetchWarehouses()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to save warehouse', true)
    } finally {
      setSaving(false)
    }
  }, [editData, fetchWarehouses])

  const handleDelete = useCallback(async (wh) => {
    if (!window.confirm(`Delete "${wh.name}"? This cannot be undone.`)) return
    try {
      await inventoryApi.deleteWarehouse(wh._id || wh.id)
      showToast(`Warehouse "${wh.name}" deleted`)
      fetchWarehouses()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Cannot delete warehouse (may have inventory)', true)
    }
  }, [fetchWarehouses])

  // ── Stats ──────────────────────────────────────────────────
  const totalActive   = warehouses.filter(w => w.is_active !== false).length
  const totalInactive = warehouses.filter(w => w.is_active === false).length

  // ── Filter ─────────────────────────────────────────────────
  const filtered = warehouses.filter(w => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      (w.name || '').toLowerCase().includes(q) ||
      (w.warehouse_code || '').toLowerCase().includes(q) ||
      (w.city || '').toLowerCase().includes(q) ||
      (w.manager || '').toLowerCase().includes(q)
    const matchActive = filterActive === 'All' ||
      (filterActive === 'Active' && w.is_active !== false) ||
      (filterActive === 'Inactive' && w.is_active === false)
    return matchSearch && matchActive
  })

  // ── Pagination (10 rows per page) ──────────────────────────
  const total       = filtered.length
  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage    = Math.min(page, totalPages)
  const paged       = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return (
    <>
      <style>{`@keyframes pulse { 0%,100%{opacity:.6} 50%{opacity:.2} }`}</style>

      <div className="breadcrumb">
        <span>Purchase &amp; Inventory</span><span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-active">Warehouse Management</span>
      </div>

      {toast    && <div className="alert alert-info"   style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}><CheckCircle style={{ color: 'var(--success)', width: 16 }} /><span style={{ fontWeight: 600 }}>{toast}</span></div>}
      {errorMsg && <div className="alert alert-danger" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}><AlertCircle style={{ color: 'var(--danger)', width: 16 }} /><span style={{ fontWeight: 600 }}>{errorMsg}</span></div>}

      {/* ── KPI cards ── */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        {[
          { label: 'Total Warehouses', val: warehouses.length, color: 'blue',   Icon: Warehouse },
          { label: 'Active',           val: totalActive,        color: 'green',  Icon: CheckCircle },
          { label: 'Inactive',         val: totalInactive,      color: 'gray',   Icon: AlertCircle },
          { label: 'Branches Linked',  val: new Set(warehouses.map(w => w.branch_id).filter(Boolean)).size, color: 'purple', Icon: MapPin },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ padding: '14px 16px' }}>
            <div className={`stat-icon ${s.color}`}><s.Icon size={18} /></div>
            <div className="stat-info">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ fontSize: 20 }}>{s.val}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
              <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, color: 'var(--text-muted)' }} />
              <input className="form-control" style={{ paddingLeft: 32 }}
                placeholder="Search by name, code, city, manager…"
                value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
            </div>
            {['All', 'Active', 'Inactive'].map(f => (
              <button key={f} className={`btn ${filterActive === f ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 14px', fontSize: 13 }}
                onClick={() => { setFilterActive(f); setPage(1) }}>{f}</button>
            ))}
            <button className="btn btn-secondary btn-sm" onClick={fetchWarehouses} disabled={loading} style={{ marginLeft: 4 }}>
              <RefreshCw style={{ width: 13 }} />
            </button>
            <button className="btn btn-primary" onClick={() => { setEditData(null); setShowModal(true) }} style={{ marginLeft: 'auto' }}>
              <Plus style={{ width: 15 }} /> Add Warehouse
            </button>
          </div>
        </div>
      </div>

      {/* ── Warehouse Table ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Warehouses ({filtered.length}{filtered.length !== warehouses.length ? ` of ${warehouses.length}` : ''})</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th><th>Code</th><th>Warehouse Name</th><th>Type</th>
                <th>City / State</th><th>Contact Person</th><th>Mobile</th>
                <th>Manager</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={10} />)
                : filtered.length === 0
                  ? (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                        <Warehouse style={{ width: 36, margin: '0 auto 10px', display: 'block', color: 'var(--border)' }} />
                        {search || filterActive !== 'All' ? 'No warehouses match your filter' : 'No warehouses yet — click "Add Warehouse" to create one'}
                      </td>
                    </tr>
                  )
                  : paged.map((wh, idx) => {
                      const id = wh._id || wh.id
                      return (
                        <tr key={id}>
                          <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{(safePage - 1) * PAGE_SIZE + idx + 1}</td>
                          <td>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: 'var(--primary)' }}>
                              {wh.warehouse_code || '—'}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{wh.name}</div>
                            {wh.address && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{wh.address}</div>}
                          </td>
                          <td>
                            {wh.warehouse_type
                              ? <span className="badge badge-blue" style={{ fontSize: 11 }}>{wh.warehouse_type}</span>
                              : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>
                          <td style={{ fontSize: 12 }}>
                            {[wh.city, wh.state].filter(Boolean).join(', ') || '—'}
                            {wh.pincode && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{wh.pincode}</div>}
                          </td>
                          <td style={{ fontSize: 13 }}>{wh.contact_person || '—'}</td>
                          <td style={{ fontSize: 13 }}>{wh.mobile || '—'}</td>
                          <td style={{ fontSize: 13 }}>{wh.manager || '—'}</td>
                          <td>
                            <span className={`badge ${wh.is_active !== false ? 'badge-green' : 'badge-gray'}`}>
                              {wh.is_active !== false ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>
                            <div className="table-actions">
                              {/* View + Inventory */}
                              <button title="View Details & Inventory" onClick={() => setViewData(wh)}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  width: 28, height: 28, borderRadius: 6, border: '1px solid #BFDBFE',
                                  background: '#EFF6FF', color: '#2563EB', cursor: 'pointer' }}>
                                <Eye size={13} />
                              </button>
                              {/* Edit */}
                              <button title="Edit" onClick={() => { setEditData(wh); setShowModal(true) }}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  width: 28, height: 28, borderRadius: 6, border: '1px solid #FED7AA',
                                  background: '#FFF7ED', color: '#EA580C', cursor: 'pointer' }}>
                                <Edit2 size={13} />
                              </button>
                              {/* Toggle active */}
                              <button title={wh.is_active !== false ? 'Deactivate' : 'Activate'}
                                onClick={async () => {
                                  try {
                                    await inventoryApi.updateWarehouse(id, { is_active: wh.is_active === false })
                                    showToast(`"${wh.name}" ${wh.is_active !== false ? 'deactivated' : 'activated'}`)
                                    fetchWarehouses()
                                  } catch {
                                    showToast('Failed to update status', true)
                                  }
                                }}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  width: 28, height: 28, borderRadius: 6, cursor: 'pointer',
                                  border: `1px solid ${wh.is_active !== false ? '#A7F3D0' : '#FDE68A'}`,
                                  background: wh.is_active !== false ? '#ECFDF5' : '#FFFBEB',
                                  color: wh.is_active !== false ? '#059669' : '#D97706' }}>
                                {wh.is_active !== false ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
                              </button>
                              {/* Delete */}
                              <button title="Delete" onClick={() => handleDelete(wh)}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  width: 28, height: 28, borderRadius: 6, border: '1px solid #FECACA',
                                  background: '#FEF2F2', color: '#DC2626', cursor: 'pointer' }}>
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
              }
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

      {/* Modals */}
      {showModal && (
        <WarehouseModal
          editData={editData}
          onClose={() => { setShowModal(false); setEditData(null) }}
          onSave={handleSave}
          saving={saving}
          branches={branches}
        />
      )}
      {viewData && (
        <WarehouseDetailModal
          warehouse={viewData}
          onClose={() => setViewData(null)}
          onEdit={(wh) => { setEditData(wh); setShowModal(true) }}
        />
      )}
    </>
  )
}
