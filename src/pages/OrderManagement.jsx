import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import {
  Search, Eye, Truck, Package, CheckCircle, ClipboardList,
  Layers, Send, ShieldCheck, XCircle, FileText, Box, AlertCircle,
  History, ArrowRight, ChevronLeft, ChevronRight, Plus, Trash2, Edit2, X,
} from 'lucide-react'
import api from '../api/index'

const PAGE_SIZE = 10

// Roles that must NOT appear in the staff-assignment dropdown. Everything else
// (any custom/company staff role) is assignable, so the list is never empty
// just because a role name doesn't match a hard-coded list.
const NON_STAFF_ROLES = ['Super Admin', 'Retailer', 'Wholesaler', 'Customer']

// ── Image URL helper ──────────────────────────────────────────
const IMG_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'https://ezyenquiry-backend.onrender.com'
function imgUrl(p) {
  if (!p) return null
  if (p.startsWith('http')) return p
  return `${IMG_BASE}${p}`
}

// ── Resolve a product's creator type — mirrors Product Management's
// "ADDED BY" badge (creatorTypeOf) so order dropdown shows the same
// admin-added products as the Products page. ─────────────────────
function creatorTypeOf(p = {}) {
  if (p.created_by_type) return p.created_by_type
  const role = String(p.created_by?.role || '').toLowerCase()
  if (role.includes('retail')) return 'Retailer'
  if (role.includes('whole'))  return 'Wholesaler'
  if (role.includes('admin'))  return 'Admin'
  const biz = String(p.company_id?.biz_type || '').toLowerCase()
  if (biz.includes('retail')) return 'Retailer'
  if (biz.includes('whole'))  return 'Wholesaler'
  if (String(p.code || '').toUpperCase().startsWith('RPD-')) return 'Retailer'
  if (String(p.source || '').toLowerCase() === 'admin') return 'Admin'
  return 'Unknown'
}
const isAdminProduct = (p) => creatorTypeOf(p) === 'Admin'

// ── Searchable product dropdown (same UX as Quotation Manager) ─
function ProductSearch({ value, onChange, products, error }) {
  const [open, setOpen] = useState(false)
  const [q,    setQ]    = useState('')
  const ref             = useRef()

  const filtered = (products || []).filter(p =>
    (p.name || '').toLowerCase().includes(q.toLowerCase()) ||
    (p.code || '').toLowerCase().includes(q.toLowerCase()) ||
    (p.category_name || '').toLowerCase().includes(q.toLowerCase()) ||
    (p.brand_name || '').toLowerCase().includes(q.toLowerCase())
  ).slice(0, 50)

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const pick = (p) => { onChange(p); setOpen(false); setQ('') }

  const thumb = (p) => {
    const raw = Array.isArray(p.image_urls) ? p.image_urls.filter(Boolean)[0] : (p.product_image || '')
    return imgUrl(raw)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        className={`form-control${error ? ' error' : ''}`}
        placeholder="Search product by name, code, brand…"
        value={open ? q : (value || '')}
        onFocus={() => { setOpen(true); setQ('') }}
        onChange={e => setQ(e.target.value)}
      />
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1001, marginTop: 2,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.14)',
          maxHeight: 320, overflowY: 'auto',
        }}>
          {filtered.length === 0
            ? <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                No products found
              </div>
            : filtered.map(p => {
                const imgSrc = thumb(p)
                return (
                  <div key={p._id || p.id}
                    onMouseDown={() => pick(p)}
                    style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', gap: 10 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {imgSrc
                      ? <img src={imgSrc} alt={p.name}
                          style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6,
                            border: '1px solid var(--border)', flexShrink: 0, background: '#f8fafc' }}
                          onError={e => { e.currentTarget.style.display = 'none' }} />
                      : <div style={{ width: 44, height: 44, borderRadius: 6, flexShrink: 0,
                          border: '1px solid var(--border)', background: 'var(--bg)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 18, color: 'var(--text-muted)' }}>📦</div>
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.name}
                        </span>
                        <span style={{ fontSize: 10, fontFamily: 'monospace', background: '#FFF3EC',
                          color: '#FD5C02', padding: '1px 6px', borderRadius: 4, fontWeight: 700,
                          flexShrink: 0 }}>
                          {p.code}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2,
                        display: 'flex', flexWrap: 'wrap', gap: '0 8px' }}>
                        {p.category_name && <span>📁 {p.category_name}</span>}
                        {p.brand_name    && <span>🏷 {p.brand_name}</span>}
                        {p.size          && <span>📐 {p.size}</span>}
                        {p.finish        && <span>✨ {p.finish}</span>}
                      </div>
                      {(p.mrp || p.dealer_price || p.retail_price || p.selling_price) && (
                        <div style={{ fontSize: 11, color: '#059669', fontWeight: 700, marginTop: 2 }}>
                          MRP ₹{parseFloat(p.mrp || p.dealer_price || p.retail_price || p.selling_price).toLocaleString('en-IN')}
                          {p.unit && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> / {p.unit}</span>}
                          {p.gst_percent ? <span style={{ color: '#7C3AED', marginLeft: 6 }}>GST {p.gst_percent}%</span> : null}
                        </div>
                      )}
                      {p.available_stock != null && (
                        <div style={{ fontSize: 10.5, fontWeight: 700, marginTop: 2,
                          color: Number(p.available_stock) <= 0 ? '#DC2626' : '#0369A1' }}>
                          {Number(p.available_stock) <= 0
                            ? 'Out of stock'
                            : `${Number(p.available_stock).toLocaleString('en-IN')} ${p.unit || ''} in stock`}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
          }
        </div>
      )}
    </div>
  )
}

// ── Unified 6-stage order lifecycle ─────────────────────────────────────────
// New → Accepted → Packing → Dispatched → Out for Delivery → Delivered
const DISPLAY_STATUSES = ['New', 'Accepted', 'Packing', 'Dispatched', 'Out for Delivery', 'Delivered', 'Cancelled']

// Map display status → backend status group for filtering
const DISPLAY_TO_BACKEND = {
  'New':              ['New'],
  'Accepted':         ['Accepted'],
  'Packing':          ['Packing', 'Pending Approval', 'Approved',
                       'Picking Started', 'Picking Completed',
                       'Sorting Started', 'Sorting Completed',
                       'Packing Started', 'Packing Completed', 'Invoice Generated'],
  'Dispatched':       ['Dispatched', 'Ready', 'Ready for Dispatch', 'Partially Dispatched'],
  'Out for Delivery': ['Out for Delivery', 'In Transit'],
  'Delivered':        ['Delivered'],
  'Cancelled':        ['Cancelled'],
}

// Map any backend status → display status
function toDisplay(status) {
  for (const [disp, backends] of Object.entries(DISPLAY_TO_BACKEND)) {
    if (backends.includes(status)) return disp
  }
  return status
}

// Backend transition map (6-stage lifecycle)
const NEXT_STATUS = {
  'New':             ['Accepted',   'Cancelled'],
  'Accepted':        ['Packing',    'Cancelled'],
  'Packing':         ['Dispatched', 'Cancelled'],
  'Dispatched':      ['Out for Delivery'],
  'Out for Delivery':['Delivered'],
  'Delivered':       [],
  'Cancelled':       [],
}

// Human-readable action labels for each status transition button
const STATUS_ACTION_LABEL = {
  'Accepted':        'Accept Order',
  'Packing':         'Start Packing',
  'Dispatched':      'Mark Dispatched',
  'Out for Delivery':'Mark Out for Delivery',
  'Delivered':       'Mark Delivered',
  'Cancelled':       'Cancel Order',
}

const STATUS_COLOR = {
  'New':              'badge-blue',
  'Accepted':         'badge-cyan',
  'Packing':          'badge-yellow',
  'Dispatched':       'badge-orange',
  'Out for Delivery': 'badge-purple',
  'Delivered':        'badge-green',
  'Cancelled':        'badge-red',
}

const STAT_CARDS = [
  { s:'New',              ic:'#2563EB', bc:'#BFDBFE', bg:'#EFF6FF', iconBg:'#DBEAFE', Icon:ClipboardList },
  { s:'Accepted',         ic:'#059669', bc:'#A7F3D0', bg:'#F0FDF4', iconBg:'#D1FAE5', Icon:CheckCircle   },
  { s:'Packing',          ic:'#7C3AED', bc:'#DDD6FE', bg:'#F5F3FF', iconBg:'#EDE9FE', Icon:Box           },
  { s:'Dispatched',       ic:'#D97706', bc:'#FDE68A', bg:'#FFFBEB', iconBg:'#FEF3C7', Icon:Truck         },
  { s:'Out for Delivery', ic:'#7C3AED', bc:'#DDD6FE', bg:'#F5F3FF', iconBg:'#EDE9FE', Icon:Send          },
  { s:'Delivered',        ic:'#059669', bc:'#A7F3D0', bg:'#ECFDF5', iconBg:'#D1FAE5', Icon:ShieldCheck   },
  { s:'Cancelled',        ic:'#DC2626', bc:'#FECACA', bg:'#FEF2F2', iconBg:'#FEE2E2', Icon:XCircle       },
]

const ordId       = o => o._id           || o.id      || ''
const ordCode     = o => o.order_code    || o.id      || ''
const ordCustomer = o => o.customer_name || ''
const ordProduct  = o => o.product_name  || ''
const ordTotal    = o => o.total_amount  || o.total   || 0
const ordAmount   = o => o.amount        || 0
const ordGst      = o => o.gst_amount    || o.gst     || 0
const ordDate     = o => {
  const d = o.order_date || o.created_at
  return d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : ''
}
const fmtDate    = d => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—'

// Partial-fulfillment quantity accessors
const ordQtyNum      = o => Number(o.qty)||0
const ordDispatched  = o => Number(o.dispatched_qty)||0
const ordRemaining   = o => Math.max(0, Math.round((ordQtyNum(o)-ordDispatched(o))*100)/100)

// An order counts as assigned once it has a staff user (id or name) attached.
const isAssigned = o => {
  const id = typeof o?.assigned_to === 'object' && o?.assigned_to
    ? (o.assigned_to._id || o.assigned_to)
    : o?.assigned_to
  return !!(id || (o?.assigned_to_name || '').trim())
}

const EMPTY_FORM = {
  customer_name:'', customer_mobile:'', customer_email:'', delivery_address:'',
  product_id:'', product_name:'', product_code:'', product_size:'',
  product_finish:'', product_color:'', product_category:'', product_brand:'',
  // Extra product spec fields shown in the quotation-style card
  product_sub_category:'', product_tile_type:'', product_grade:'',
  product_unit:'Pcs', product_mrp:'', product_purchase_rate:'',
  product_pcs_per_box:'', product_sqft_per_box:'', product_image:'',
  qty:'1', rate:'', disc:'0', gst_percent:'18', branch_id:'',
  notes:'', terms:'Prices are subject to change. GST extra as applicable.',
}

export default function OrderManagement({
  branches=[], orders=[], inventory=[], products=[], customers=[], dispatches=[], enquiries=[], employees=[], users=[],
  updateOrderStatus, createDispatch, markDelivered, markInTransit, addOrder, deleteOrder, packOrder, assignOrder,
}) {
  const branchNames = branches.map(b=>b.name||b).filter(Boolean)

  // ── Assignable staff list ──────────────────────────────────
  // Orders can be assigned to a login-capable staff member. We merge TWO
  // sources so it works regardless of how the staff was created:
  //   1. HR Employees that have a linked user_id (created via HR module)
  //   2. Users with a staff role (created via Staff Management page)
  // Each entry is normalised to { _id, name, designation, user_id } where
  // user_id is the User._id used as the assignment target.
  const assignableStaff = useMemo(() => {
    const out = []
    const seen = new Set()

    // 1. Users with a login account (any staff role, active, not a buyer/owner)
    ;(users || []).forEach(u => {
      if (u.is_active === false) return
      if (NON_STAFF_ROLES.includes(u.role)) return
      const uid = String(u._id || '')
      if (!uid || seen.has(uid)) return
      seen.add(uid)
      out.push({ _id: uid, name: u.name, designation: u.role || '', user_id: uid })
    })

    // 2. HR employees (staff). Prefer the linked user account as the assignment
    //    target; if the employee has no login, send the employee id instead —
    //    the backend resolves either an Employee id or a User id.
    ;(employees || []).forEach(emp => {
      if (emp.is_active === false) return
      const linkedUser = emp.user_id
        ? (typeof emp.user_id === 'object' ? String(emp.user_id._id || emp.user_id) : String(emp.user_id))
        : ''
      // The value sent to the assign API: linked User id if present, else Employee id.
      const target = linkedUser || String(emp._id || '')
      if (!target || seen.has(target)) return
      seen.add(target)
      out.push({ _id: emp._id || target, name: emp.name, designation: emp.designation || '', user_id: target })
    })

    return out.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [employees, users])

  const [search,       setSearch]      = useState('')
  const [page,         setPage]        = useState(1)
  const [statusFilter, setStatusFilter]= useState('All')
  const [branchFilter, setBranchFilter]= useState('All')
  const [selected,     setSelected]    = useState(null)
  const [showHistory,  setShowHistory] = useState(false)
  const [showCreate,   setShowCreate]  = useState(false)
  const [editOrder,    setEditOrder]   = useState(null)
  const [dispatchForm, setDispatchForm]= useState(null)
  const [successMsg,   setSuccessMsg]  = useState('')
  const [errorMsg,     setErrorMsg]    = useState('')
  const [busyId,       setBusyId]      = useState(null)
  const [deleteConfirm,setDeleteConfirm]=useState(null)

  const [form,       setForm]      = useState(EMPTY_FORM)
  const [formErrors, setFormErrors]= useState({})
  const [saving,     setSaving]    = useState(false)

  // ── Admin-added products for the Create Order dropdown ───────
  // Fetched fresh (with live stock) the same way the Quotation modal does,
  // and filtered to admin-added products only. Falls back to the products
  // prop (also admin-filtered) if the fetch returns nothing.
  const [modalProducts, setModalProducts] = useState([])
  useEffect(() => {
    if (!showCreate) return
    let cancelled = false

    const parse = (res) => {
      const p = res?.data ?? res
      const i = p?.data ?? p
      return Array.isArray(i) ? i : (Array.isArray(i?.products) ? i.products : [])
    }
    const enrichWithStock = async (list) => {
      try {
        const res = await api.get('/inventory', { params: { limit: 1000, _t: Date.now() } })
        const p = res?.data ?? res
        const invs = Array.isArray(p?.data?.inventory) ? p.data.inventory
          : Array.isArray(p?.inventory) ? p.inventory
          : Array.isArray(p?.data) ? p.data : []
        const stockMap = new Map()
        for (const inv of invs) {
          const pid = String(inv.product_id?._id || inv.product_id || '')
          if (!pid) continue
          const avail = (Number(inv.available_stock) || 0) > 0 ? Number(inv.available_stock) : (Number(inv.current_stock) || 0)
          stockMap.set(pid, (stockMap.get(pid) || 0) + avail)
        }
        return list.map(pr => {
          const pid = String(pr._id || pr.id || '')
          return stockMap.has(pid) ? { ...pr, available_stock: stockMap.get(pid) } : { ...pr, available_stock: pr.available_stock ?? null }
        })
      } catch {
        return list
      }
    }
    const apply = async (list) => {
      const enriched = await enrichWithStock(list)
      if (!cancelled) setModalProducts(enriched)
    }

    // Prefer admin-added products, but never leave the dropdown empty: if the
    // admin-only filter removes everything (e.g. backend not yet restarted, or
    // this company has no admin-added products), fall back to the full list.
    const preferAdmin = (list) => {
      const all = list || []
      const admins = all.filter(isAdminProduct)
      return admins.length > 0 ? admins : all
    }

    const run = async () => {
      // 1) for-select with admin_only — server-side admin filter + light payload
      try {
        const res  = await api.get('/products/for-select', { params: { limit: 1000, admin_only: true } })
        const list = preferAdmin(parse(res))
        if (!cancelled && list.length > 0) { await apply(list); return }
      } catch { /* fall through */ }
      // 2) Regular /products fallback
      try {
        const res  = await api.get('/products', { params: { limit: 1000 } })
        const list = preferAdmin(parse(res))
        if (!cancelled && list.length > 0) { await apply(list); return }
      } catch { /* ignore */ }
      // 3) Fall back to the products prop
      if (!cancelled) await apply(preferAdmin(products))
    }
    run()
    return () => { cancelled = true }
  }, [showCreate, products])

  const [dForm, setDForm] = useState({
    packQty:'',vehicle:'',driver:'',driverMobile:'',transport:'',
    lr:'',dispatchDate:'',expectedDelivery:'',expectedDays:'',branch:'',
  })

  const toast = (msg,err=false) => {
    if(err){setErrorMsg(msg);setTimeout(()=>setErrorMsg(''),5000)}
    else{setSuccessMsg(msg);setTimeout(()=>setSuccessMsg(''),4000)}
  }

  // Computed totals for form (qty × rate, less discount %, plus GST)
  const coAmount  = (Number(form.qty)*Number(form.rate))||0
  const coDiscAmt = coAmount*(Number(form.disc)||0)/100
  const coTaxable = coAmount-coDiscAmt
  const coGst     = Math.round(coTaxable*(Number(form.gst_percent)||0)/100)
  const coTotal   = coTaxable+coGst
  // Effective per-unit rate after discount — sent to the single-product order
  // API so its qty×rate matches the taxable amount shown here.
  const coEffRate = Number(form.qty)>0 ? coTaxable/Number(form.qty) : (Number(form.rate)||0)

  // Product select handler — auto-fills all product details.
  // Accepts the full product object chosen from the searchable dropdown.
  const handleProductSelect = (prod) => {
    if(prod){
      const rate = prod.mrp || prod.dealer_price || prod.retail_price
        || prod.selling_price || prod.sellingPrice || prod.selling_rate || ''
      setForm(f=>({
        ...f,
        product_id:           prod._id || prod.id || '',
        product_name:         prod.name||'',
        product_code:         prod.code||'',
        product_size:         prod.size||'',
        product_finish:       prod.finish||'',
        product_color:        prod.color||'',
        product_category:     prod.category_name||prod.category||'',
        product_brand:        prod.brand_name||prod.brand||'',
        product_sub_category: prod.sub_category_name||'',
        product_tile_type:    prod.tile_type||'',
        product_grade:        prod.grade||'',
        product_unit:         'Pcs',
        product_mrp:          prod.mrp||'',
        product_purchase_rate:prod.purchase_price||prod.purchase_rate||'',
        product_pcs_per_box:  prod.pcs_per_box||'',
        product_sqft_per_box: prod.sqft_per_box||'',
        product_image:        (Array.isArray(prod.image_urls)?prod.image_urls.filter(Boolean)[0]:'')||prod.product_image||'',
        rate:                 String(rate||''),
        gst_percent:          String(prod.gst_percent||'18'),
      }))
    } else {
      setForm(f=>({...f,product_id:'',product_name:'',product_code:'',
        product_size:'',product_finish:'',product_color:'',product_category:'',product_brand:'',
        product_sub_category:'',product_tile_type:'',product_grade:'',
        product_mrp:'',product_purchase_rate:'',product_pcs_per_box:'',product_sqft_per_box:''}))
    }
  }

  // Customer select handler
  const handleCustomerSelect = (name) => {
    const cust = customers.find(c=>c.name===name)
    setForm(f=>({
      ...f,
      customer_name:    name,
      customer_mobile:  cust?.mobile||f.customer_mobile,
      customer_email:   cust?.email||f.customer_email,
      delivery_address: cust?.address||f.delivery_address,
    }))
  }

  const validateForm = () => {
    const e = {}
    if(!form.customer_name.trim())  e.customer_name   = 'Customer name required'
    if(!form.customer_mobile.trim()) e.customer_mobile = 'Mobile required'
    if(!form.product_id && !form.product_name.trim()) e.product_name = 'Product required'
    if(!form.qty||Number(form.qty)<=0) e.qty = 'Valid quantity required'
    if(!form.rate||Number(form.rate)<=0) e.rate = 'Valid rate required'
    return e
  }

  const handleSave = async () => {
    const e = validateForm()
    if(Object.keys(e).length){setFormErrors(e);return}
    setSaving(true)
    const payload = {
      customer_name:    form.customer_name.trim(),
      customer_mobile:  form.customer_mobile.trim(),
      customer_email:   form.customer_email.trim(),
      delivery_address: form.delivery_address.trim(),
      product_id:       form.product_id||undefined,
      product_name:     form.product_name.trim(),
      product_code:     form.product_code,
      unit:             form.product_unit||'Pcs',
      qty:              Number(form.qty),
      // Rate after discount so the order's qty×rate equals the taxable amount.
      rate:             Number(coEffRate.toFixed(2)),
      gst_percent:      Number(form.gst_percent)||18,
      branch_id:        form.branch_id||undefined,
      branch_name:      branches.find(b=>(b._id||b.id)===form.branch_id)?.name||'',
      notes:            form.notes,
      terms:            form.terms,
    }
    const res = await addOrder?.(payload)
    setSaving(false)
    if(res?.success===false){toast(res.message||'Failed to create order',true);return}
    toast(`✓ Order ${res?.data?.order_code||''} created!`)
    setForm(EMPTY_FORM); setFormErrors({}); setShowCreate(false)
  }

  // Status update
  const doStatusUpdate = useCallback(async(orderId,newStatus,rem='')=>{
    setBusyId(orderId)
    const res = await updateOrderStatus?.(orderId,{status:newStatus,remarks:rem})
    setBusyId(null)
    if(res?.success===false){toast(res.message||`Cannot move to ${newStatus}`,true);return false}
    toast(`✓ Status → ${newStatus}`)
    if(selected&&ordId(selected)===orderId) setSelected(p=>({...p,...res?.data,status:newStatus}))
    return true
  },[updateOrderStatus,selected])

  // Delete order
  const handleDelete = async(id)=>{
    setBusyId(id)
    const res = await deleteOrder?.(id)
    setBusyId(null)
    if(res?.success===false){toast(res.message||'Delete failed',true)}
    else{toast('✓ Order deleted');setDeleteConfirm(null);if(selected&&ordId(selected)===id)setSelected(null)}
  }

  // Assign order to staff — uses ErpContext.assignOrder which also
  // updates the orders list in-place so the row refreshes immediately.
  const handleAssignStaff = async (orderId, staffId) => {
    if (!staffId) return
    // staffId is a plain User._id from the dropdown; resolve the name from the merged list.
    const staffName = assignableStaff.find(s => String(s.user_id) === String(staffId))?.name || ''
    setBusyId(orderId)
    const res = await assignOrder(orderId, staffId, staffName)
    setBusyId(null)
    if (res?.success === false) {
      toast(res.message || 'Assignment failed', true)
    } else {
      toast(`✓ Order assigned to ${staffName || 'staff'}`)
      // Also patch the currently-selected detail panel if it's this order
      if (selected && String(ordId(selected)) === String(orderId)) {
        setSelected(p => ({ ...p, assigned_to: staffId, assigned_to_name: staffName, assigned_date: new Date().toISOString(), assignment_type: 'MANUAL' }))
      }
    }
  }

  const resetDForm = ()=>setDForm({packQty:'',vehicle:'',driver:'',driverMobile:'',transport:'',lr:'',dispatchDate:'',expectedDelivery:'',expectedDays:'',branch:''})

  // Pack a (partial) quantity → backend creates invoice + dispatch for it.
  const handleDispatch = async ()=>{
    if(!dispatchForm)return
    const remaining = ordRemaining(dispatchForm)
    const packQty = Number(dForm.packQty)
    if(!packQty||packQty<=0){toast('Enter the quantity you are packing',true);return}
    if(packQty>remaining){toast(`You can pack at most ${remaining} ${dispatchForm.unit||''} (remaining)`,true);return}
    if(!dForm.vehicle||!dForm.driver||!dForm.driverMobile||!dForm.transport||!dForm.dispatchDate){
      toast('Fill Vehicle, Driver, Driver Mobile, Transport and Dispatch Date',true);return
    }
    // Require at least one of: explicit expected delivery date OR delivery days
    if(!dForm.expectedDelivery && !dForm.expectedDays){
      toast('Enter an Expected Delivery Date or Delivery Days',true);return
    }
    const orderId = dispatchForm._id||dispatchForm.id
    let exp = dForm.expectedDelivery
    if(dForm.expectedDays&&dForm.dispatchDate&&!exp){
      const d=new Date(dForm.dispatchDate); d.setDate(d.getDate()+parseInt(dForm.expectedDays))
      exp=d.toISOString().split('T')[0]
    }
    setBusyId(orderId)
    const res = await packOrder?.(orderId,{
      pack_qty:packQty,
      branch_name:dForm.branch||dispatchForm.branch_name||'',
      vehicle_number:dForm.vehicle, driver_name:dForm.driver,
      driver_mobile:dForm.driverMobile, transport_name:dForm.transport,
      lr_number:dForm.lr, dispatch_date:dForm.dispatchDate,
      expected_delivery_days:dForm.expectedDays?parseInt(dForm.expectedDays):null,
      expected_delivery:exp||null,
    })
    setBusyId(null)
    if(res?.success===false){toast(res.message||'Packing failed',true);return}
    const inv = res?.data?.invoice?.invoice_no || ''
    const stillLeft = Math.max(0, remaining-packQty)
    toast(stillLeft>0
      ? `✓ Packed ${packQty} ${dispatchForm.unit||''}. Invoice ${inv}. ${stillLeft} remaining — pack again anytime.`
      : `✓ Order fully packed & dispatched! Invoice ${inv}.`)
    setDispatchForm(null)
    resetDForm()
  }

  const getStock = pid=>{
    if(!pid)return 0
    const inv=inventory.find(i=>(i.product_id?._id||i.product_id)===pid)
    return inv?(inv.current_stock??0):0
  }

  // Filter — map display status to backend statuses
  const filtered = orders.filter(o=>{
    const disp = toDisplay(o.status)
    const matchStatus = statusFilter==='All' || disp===statusFilter || o.status===statusFilter
    const matchBranch = branchFilter==='All' || (o.branch_name||'')=== branchFilter
    const q = search.toLowerCase()
    const matchSearch = !search||
      ordCustomer(o).toLowerCase().includes(q)||
      ordCode(o).toLowerCase().includes(q)||
      ordProduct(o).toLowerCase().includes(q)||
      (o.branch_name||'').toLowerCase().includes(q)
    return matchStatus&&matchBranch&&matchSearch
  })

  // ── Pagination (10 rows per page) ──────────────────────────
  const total       = filtered.length
  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage    = Math.min(page, totalPages)
  const paged       = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // Simplified per-row actions:
  //   New            → Accept + Cancel
  //   New            → Accept + Cancel
  //   Accepted/Packing → Packing button (opens dispatch form)
  //   Dispatched     → Out for Delivery button
  //   Out for Delivery → Mark Delivered
  const openPacking = (o)=>{ setDispatchForm(o); resetDForm(); setDForm(f=>({...f,branch:o.branch_name||'',packQty:String(ordRemaining(o))})) }
  const ActionBtns = ({o})=>{
    const oid=ordId(o); const busy=busyId===oid
    return (
      <div className="table-actions">
        <button className="btn btn-ghost btn-xs" title="View Details" onClick={()=>{setSelected(o);setShowHistory(false)}}>
          <Eye style={{width:13}}/>
        </button>
        {/* Edit/Delete only for manually created orders (no enquiry/buyer link) */}
        {!o.enquiry_id && !o.buyer_company_id && (
          <button className="btn btn-ghost btn-xs" title="Edit"
            onClick={()=>{
              setEditOrder(o)
              setForm({
                ...EMPTY_FORM,
                customer_name:o.customer_name||'',customer_mobile:o.customer_mobile||'',
                customer_email:o.customer_email||'',delivery_address:o.delivery_address||'',
                product_id:o.product_id||'',product_name:o.product_name||'',product_code:o.product_code||'',
                product_size:o.size||'',product_finish:o.finish||'',product_color:o.color||'',
                product_category:o.category_name||'',product_brand:o.brand_name||'',
                product_sub_category:o.sub_category_name||'',product_tile_type:o.tile_type||'',
                product_grade:o.grade||'',product_unit:o.unit||'Pcs',
                qty:String(o.qty||'1'),rate:String(o.rate||''),disc:'0',gst_percent:String(o.gst_percent||'18'),
                branch_id:o.branch_id||'',notes:o.notes||'',terms:o.terms||EMPTY_FORM.terms,
              })
              setFormErrors({})
              setShowCreate(true)
            }}>
            <Edit2 style={{width:13}}/>
          </button>
        )}
        {!o.enquiry_id && !o.buyer_company_id && (
          <button className="btn btn-ghost btn-xs" title="Delete" style={{color:'var(--danger)'}}
            onClick={()=>setDeleteConfirm({id:oid,code:ordCode(o)})}>
            <Trash2 style={{width:13}}/>
          </button>
        )}

        {/* New → Accept + Cancel */}
        {o.status==='New'&&(
          <>
            <button className="btn btn-primary btn-xs" disabled={busy} onClick={()=>doStatusUpdate(oid,'Accepted','Accepted')}>
              <CheckCircle style={{width:12}}/>{busy?'…':'Accept'}
            </button>
            <button className="btn btn-danger btn-xs" disabled={busy} onClick={()=>doStatusUpdate(oid,'Cancelled','')}>
              <XCircle style={{width:11}}/>Cancel
            </button>
          </>
        )}

        {/* Pack (remaining) — show whenever quantity still left to dispatch, even if status is Delivered (partial delivery).
            Staff must be assigned before packing can start. */}
        {o.status!=='New'&&o.status!=='Cancelled'&&ordRemaining(o)>0&&(
          <button className="btn btn-primary btn-xs" disabled={busy}
            title={isAssigned(o)?'':'Assign a staff member before packing'}
            onClick={()=>{
              if(!isAssigned(o)){ toast('Please assign a staff member before packing this order.',true); return }
              openPacking(o)
            }}>
            <Package style={{width:12}}/>{ordDispatched(o)>0?`Pack (${ordRemaining(o)} left)`:'Packing'}
          </button>
        )}

        {/* Dispatched → Out for Delivery */}
        {o.status==='Dispatched'&&(
          <button className="btn btn-primary btn-xs" disabled={busy} onClick={()=>{
            if(o.dispatch_id)markInTransit?.(o.dispatch_id?._id||o.dispatch_id)
            else doStatusUpdate(oid,'Out for Delivery','Out for delivery')
          }}><Send style={{width:12}}/>{busy?'…':'Out for Delivery'}</button>
        )}

        {/* Out for Delivery → Delivered */}
        {o.status==='Out for Delivery'&&(
          <button className="btn btn-primary btn-xs" style={{background:'var(--success)'}} disabled={busy}
            onClick={()=>{
              if(o.dispatch_id)markDelivered?.(o.dispatch_id?._id||o.dispatch_id)
              else doStatusUpdate(oid,'Delivered','Delivered')
            }}><ShieldCheck style={{width:12}}/>{busy?'…':'Delivered'}</button>
        )}

        {/* Fully done only when nothing remains */}
        {o.status==='Delivered'&&ordRemaining(o)<=0&&<span className="badge badge-green" style={{fontSize:10}}>✓ Done</span>}
        {o.status==='Cancelled'&&<span className="badge badge-red" style={{fontSize:10}}>Cancelled</span>}
      </div>
    )
  }

  const StatusHistory = ({history=[]})=>{
    if(!history.length)return <div style={{color:'var(--text-muted)',fontSize:12,padding:'8px 0'}}>No history yet.</div>
    return (
      <div style={{display:'flex',flexDirection:'column',gap:0}}>
        {[...history].reverse().map((h,i)=>(
          <div key={i} style={{display:'flex',gap:10,paddingBottom:12,position:'relative'}}>
            {i<history.length-1&&<div style={{position:'absolute',left:7,top:18,bottom:0,width:2,background:'var(--border)'}}/>}
            <div style={{width:16,height:16,borderRadius:'50%',flexShrink:0,marginTop:2,
              background:h.status==='Delivered'?'var(--success)':h.status==='Cancelled'?'var(--danger)':'var(--primary)'}}/>
            <div>
              <div style={{fontWeight:700,fontSize:12}}>{h.status}</div>
              <div style={{fontSize:11,color:'var(--text-muted)',marginTop:1}}>
                {h.updated_by_name&&<span>{h.updated_by_name} · </span>}
                {h.timestamp&&<span>{new Date(h.timestamp).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</span>}
              </div>
              {h.remarks&&<div style={{fontSize:11,color:'var(--text-muted)',fontStyle:'italic',marginTop:1}}>{h.remarks}</div>}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="breadcrumb"><span>Marketplace</span><span className="breadcrumb-sep">›</span><span className="breadcrumb-active">Order Management</span></div>

      {successMsg&&<div className="alert alert-success" style={{marginBottom:14,display:'flex',alignItems:'center',gap:10}}><CheckCircle style={{color:'var(--success)',width:18,flexShrink:0}}/><span style={{fontWeight:600}}>{successMsg}</span></div>}
      {errorMsg&&<div className="alert alert-danger" style={{marginBottom:14,display:'flex',alignItems:'center',gap:10}}><AlertCircle style={{color:'var(--danger)',width:18,flexShrink:0}}/><span style={{fontWeight:600}}>{errorMsg}</span></div>}

      {/* ── Status stat cards — DISPLAY statuses only ── */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(100px,1fr))',gap:10,marginBottom:18}}>
        {STAT_CARDS.map(({s,bg,iconBg,ic,tc,bc,Icon})=>{
          const count = orders.filter(o=>toDisplay(o.status)===s).length
          const active = statusFilter===s
          return (
            <div key={s} onClick={()=>{setStatusFilter(active?'All':s);setPage(1)}}
              style={{background:active?iconBg:bg,border:`1.5px solid ${active?ic:bc}`,borderRadius:10,
                padding:'10px 12px',cursor:'pointer',display:'flex',alignItems:'center',gap:8,
                boxShadow:active?`0 0 0 3px ${bc}`:'var(--shadow)',transition:'all 0.15s'}}>
              <div style={{width:32,height:32,borderRadius:8,flexShrink:0,background:iconBg,border:`1px solid ${bc}`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <Icon style={{width:14,height:14,color:ic}}/>
              </div>
              <div>
                <div style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.3px',color:tc,marginBottom:1,lineHeight:1.2}}>{s}</div>
                <div style={{fontSize:18,fontWeight:800,color:tc,lineHeight:1}}>{count}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Orders Table ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Orders ({filtered.length})</span>
          <div className="header-actions">
            <div className="search-bar">
              <Search/>
              <input placeholder="Search order, customer, product…" value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}/>
            </div>
            {branchNames.length>0&&(
              <select className="form-control" style={{width:150}} value={branchFilter} onChange={e=>{setBranchFilter(e.target.value);setPage(1)}}>
                <option value="All">All Branches</option>
                {branchNames.map(b=><option key={b}>{b}</option>)}
              </select>
            )}
            <select className="form-control" style={{width:150}} value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setPage(1)}}>
              <option value="All">All Status</option>
              {DISPLAY_STATUSES.map(s=><option key={s}>{s}</option>)}
            </select>
            <button className="btn btn-primary" onClick={()=>{setEditOrder(null);setForm(EMPTY_FORM);setFormErrors({});setShowCreate(true)}}>
              <Plus style={{width:14}}/>Create Order
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order No.</th><th>Customer</th><th>Product</th>
                <th>Ordered</th><th>Dispatched</th><th>Remaining</th><th>Total ₹</th><th>Assigned To</th><th>Invoice No.</th><th>Vehicle / Driver</th><th>Date</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(o=>{
                // Get dispatch info for this order from dispatches list
                const dispatch = dispatches?.find(d=>{
                  const dOrdId = d.order_id?._id || d.order_id || ''
                  return String(dOrdId) === String(ordId(o))
                })
                return (
                <tr key={ordId(o)}>
                  <td style={{color:'var(--primary)',fontWeight:700,whiteSpace:'nowrap'}}>{ordCode(o)}</td>
                  <td>
                    <div className="user-name">{ordCustomer(o)}</div>
                    <div className="user-role">{o.customer_mobile||''}</div>
                  </td>
                  <td style={{fontSize:12,maxWidth:160}}>
                    {ordProduct(o)}
                    {o.product_code&&<><br/><span style={{fontSize:10,color:'var(--text-muted)'}}>{o.product_code}</span></>}
                  </td>
                  <td style={{fontWeight:600,whiteSpace:'nowrap'}}>{ordQtyNum(o)} {o.unit||'Pcs'}</td>
                  <td style={{fontWeight:600,whiteSpace:'nowrap',color:ordDispatched(o)>0?'var(--primary)':'var(--text-muted)'}}>{ordDispatched(o)} {ordDispatched(o)>0?(o.unit||'Pcs'):''}</td>
                  <td style={{fontWeight:700,whiteSpace:'nowrap',color:ordRemaining(o)>0?'var(--warning,#D97706)':'var(--success)'}}>{ordRemaining(o)===0?'✓ 0':ordRemaining(o)} {ordRemaining(o)>0?(o.unit||'Pcs'):''}</td>
                  <td style={{fontWeight:700,color:'var(--success)',whiteSpace:'nowrap'}}>₹{ordTotal(o).toLocaleString()}</td>
                  <td style={{fontSize:12}}>
                    {/* Staff Assignment — badge if assigned + dropdown */}
                    {o.assigned_to_name && (
                      <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:5,padding:'3px 7px',background:'#ecfdf5',border:'1px solid #a7f3d0',borderRadius:20,width:'fit-content',maxWidth:160}}>
                        <div style={{width:18,height:18,borderRadius:'50%',background:'#059669',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:9,flexShrink:0}}>
                          {(o.assigned_to_name||'?').charAt(0).toUpperCase()}
                        </div>
                        <span style={{fontWeight:700,fontSize:10,color:'#065f46',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:110}}>
                          {o.assigned_to_name}
                        </span>
                      </div>
                    )}
                    <select
                      className="form-control"
                      style={{fontSize:11,padding:'3px 6px',minWidth:140,cursor:busyId===ordId(o)?'wait':'pointer'}}
                      value={String(typeof o.assigned_to === 'object' && o.assigned_to ? (o.assigned_to._id || o.assigned_to) : (o.assigned_to || ''))}
                      onChange={(e) => handleAssignStaff(ordId(o), e.target.value)}
                      disabled={busyId===ordId(o)}
                    >
                      <option value="">{o.assigned_to_name ? '— Reassign —' : '— Assign Staff —'}</option>
                      {assignableStaff.map(s => (
                        <option key={s.user_id} value={s.user_id}>
                          {s.name} {s.designation ? `(${s.designation})` : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{fontSize:11}}>
                    {o.invoice_number
                      ? <span style={{fontFamily:'monospace',fontWeight:700,color:'var(--primary)',fontSize:12}}>{o.invoice_number}</span>
                      : <span style={{color:'var(--text-muted)'}}>—</span>}
                  </td>
                  <td style={{fontSize:11}}>
                    {dispatch ? (
                      <>
                        <div style={{fontFamily:'monospace',fontWeight:700,color:'var(--primary)',fontSize:12}}>
                          🚛 {dispatch.vehicle_number||'—'}
                        </div>
                        <div style={{color:'var(--text-muted)',fontSize:11}}>
                          {dispatch.driver_name||'—'}
                          {dispatch.driver_mobile&&<> · {dispatch.driver_mobile}</>}
                        </div>
                        {dispatch.lr_number&&<div style={{fontFamily:'monospace',fontSize:10,color:'var(--text-muted)'}}>LR: {dispatch.lr_number}</div>}
                      </>
                    ) : (
                      <span style={{color:'var(--text-muted)',fontSize:11}}>—</span>
                    )}
                  </td>
                  <td style={{fontSize:11,whiteSpace:'nowrap'}}>{ordDate(o)}</td>
                  <td>
                    {/* Status badge — show "Partial" when some qty dispatched but more remains */}
                    <span className={`badge ${STATUS_COLOR[toDisplay(o.status)]||'badge-gray'}`} style={{fontSize:11,whiteSpace:'nowrap'}}>
                      {toDisplay(o.status)}
                    </span>
                    {ordDispatched(o) > 0 && ordRemaining(o) > 0 && (
                      <div style={{marginTop:4}}>
                        <span style={{fontSize:10,fontWeight:800,background:'#fff7ed',color:'#c2410c',border:'1px solid #fed7aa',borderRadius:20,padding:'2px 7px',whiteSpace:'nowrap'}}>
                          ⚠ {ordRemaining(o)} {o.unit||''} remaining
                        </span>
                      </div>
                    )}
                  </td>
                  <td><ActionBtns o={o}/></td>
                </tr>
                )
              })}
              {filtered.length===0&&<tr><td colSpan={14} style={{textAlign:'center',padding:32,color:'var(--text-muted)'}}>No orders found</td></tr>}
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

      {/* ══ CREATE / EDIT ORDER MODAL ══ */}
      {showCreate&&(
        <div className="modal-overlay" onClick={()=>setShowCreate(false)}>
          <div className="modal" style={{maxWidth:860}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editOrder?`Edit Order — ${ordCode(editOrder)}`:'Create New Order'}</span>
              <button className="btn-ghost" onClick={()=>setShowCreate(false)}><X style={{width:16}}/></button>
            </div>
            <div className="modal-body">
              {/* Customer */}
              <div style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:10}}>Customer Details</div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Customer Name *</label>
                  {customers.length>0?(
                    <select className={`form-control${formErrors.customer_name?' error':''}`} value={form.customer_name} onChange={e=>handleCustomerSelect(e.target.value)}>
                      <option value="">— Select Customer —</option>
                      {customers.map(c=><option key={c._id||c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  ):(
                    <input className={`form-control${formErrors.customer_name?' error':''}`} placeholder="Customer name" value={form.customer_name} onChange={e=>setForm(f=>({...f,customer_name:e.target.value}))}/>
                  )}
                  {formErrors.customer_name&&<div className="form-error">{formErrors.customer_name}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Mobile *</label>
                  <input className={`form-control${formErrors.customer_mobile?' error':''}`} placeholder="Mobile" value={form.customer_mobile} onChange={e=>setForm(f=>({...f,customer_mobile:e.target.value}))}/>
                  {formErrors.customer_mobile&&<div className="form-error">{formErrors.customer_mobile}</div>}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className={`form-control${formErrors.customer_email?' error':''}`} type="email" placeholder="customer@email.com" value={form.customer_email} onChange={e=>setForm(f=>({...f,customer_email:e.target.value}))}/>
                  {formErrors.customer_email&&<div className="form-error">{formErrors.customer_email}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Delivery Address</label>
                  <input className="form-control" placeholder="City, State" value={form.delivery_address} onChange={e=>setForm(f=>({...f,delivery_address:e.target.value}))}/>
                </div>
              </div>

              <div className="divider"/>
              <div style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:10}}>Product / Item <span style={{color:'var(--danger)'}}>*</span></div>

              {/* ── Quotation-style product card ── */}
              {(() => {
                const picked = !!form.product_id
                const lbl  = { fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em', color:'var(--text-muted)', marginBottom:3, display:'block' }
                const chip = (val) => ({
                  fontSize:12, padding:'5px 8px', border:'1px solid var(--border)', borderRadius:6,
                  minHeight:30, display:'flex', alignItems:'center',
                  background: val ? '#F8FAFC' : 'var(--bg)',
                  color: val ? 'var(--text)' : 'var(--text-muted)',
                  fontWeight: val ? 600 : 400, fontStyle: val ? 'normal' : 'italic',
                })
                const priceChip = (val) => ({ ...chip(val), color: val && parseFloat(val) > 0 ? '#059669' : 'var(--text-muted)', fontWeight:700, fontSize:11 })
                const inp = { fontSize:12, padding:'5px 8px', border:'1px solid var(--border)', borderRadius:6, background:'var(--surface)', color:'var(--text)', outline:'none', width:'100%' }

                return (
                  <div style={{
                    border:`2px solid ${picked ? '#FD5C02' : 'var(--border)'}`,
                    borderRadius:12, background:'var(--surface)',
                    boxShadow: picked ? '0 2px 10px rgba(253,92,2,.09)' : 'var(--shadow)',
                    overflow:'hidden', marginBottom:12,
                  }}>
                    {/* Card top bar: # + Product search + Row total */}
                    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px',
                      borderBottom:'1px solid var(--border)', background: picked ? '#FFF9F5' : 'var(--bg)' }}>
                      <span style={{ width:26, height:26, borderRadius:'50%', flexShrink:0,
                        background: picked ? '#FD5C02' : 'var(--border)', color: picked ? '#fff' : 'var(--text-muted)',
                        display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800 }}>1</span>

                      {picked && (
                        imgUrl(form.product_image) ? (
                          <img src={imgUrl(form.product_image)} alt={form.product_name}
                            style={{ width:44, height:44, borderRadius:8, objectFit:'cover', border:'1px solid var(--border)', flexShrink:0, background:'#fff' }}
                            onError={(e)=>{e.currentTarget.style.display='none'}} />
                        ) : (
                          <span style={{ width:44, height:44, borderRadius:8, flexShrink:0, border:'1px solid var(--border)',
                            background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)' }}>
                            <Package size={18} />
                          </span>
                        )
                      )}

                      <div style={{ flex:1, minWidth:0 }}>
                        {modalProducts.length>0 ? (
                          <ProductSearch value={form.product_name} products={modalProducts}
                            error={!!formErrors.product_name} onChange={handleProductSelect} />
                        ) : (
                          <input className={`form-control${formErrors.product_name?' error':''}`} style={{fontSize:12,padding:'5px 8px'}}
                            placeholder="Product name" value={form.product_name}
                            onChange={e=>setForm(f=>({...f,product_name:e.target.value}))}/>
                        )}
                        {form.product_code && (
                          <span style={{ fontSize:10, fontFamily:'monospace', fontWeight:800, color:'#FD5C02', marginTop:2, display:'inline-block' }}>
                            {form.product_code}
                          </span>
                        )}
                      </div>

                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em', color:'var(--text-muted)' }}>Row Total</div>
                        <div style={{ fontSize:18, fontWeight:900, color: coTotal>0 ? '#FD5C02' : 'var(--text-muted)' }}>
                          ₹{coTotal.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}
                        </div>
                      </div>
                    </div>

                    <div style={{ padding:'14px 16px' }}>
                      {formErrors.product_name && <div className="form-error" style={{marginBottom:8}}>{formErrors.product_name}</div>}

                      {/* ROW 1: spec chips */}
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:8, marginBottom:10 }}>
                        {[
                          ['Code',         form.product_code],
                          ['Brand',        form.product_brand],
                          ['Category',     form.product_category],
                          ['Sub-Category', form.product_sub_category],
                          ['Size',         form.product_size],
                          ['Finish',       form.product_finish],
                          ['Tile Type',    form.product_tile_type],
                        ].map(([label,val]) => (
                          <div key={label}><span style={lbl}>{label}</span><div style={chip(val)}>{val || '—'}</div></div>
                        ))}
                      </div>

                      {/* ROW 2: more spec chips */}
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8, marginBottom:12 }}>
                        {[
                          ['Grade',         form.product_grade],
                          ['Unit / GST',    form.product_unit ? `${form.product_unit} / ${form.gst_percent}%` : ''],
                          ['MRP',           form.product_mrp ? `₹${parseFloat(form.product_mrp).toFixed(2)}` : ''],
                          ['Purchase Rate', form.product_purchase_rate ? `₹${parseFloat(form.product_purchase_rate).toFixed(2)}` : ''],
                          ['Pcs/Box · Sqft/Box', [form.product_pcs_per_box, form.product_sqft_per_box].filter(Boolean).join(' · ') || ''],
                        ].map(([label,val]) => (
                          <div key={label}><span style={lbl}>{label}</span><div style={priceChip(val)}>{val || '—'}</div></div>
                        ))}
                      </div>

                      {/* ROW 3: editable Qty / Unit / Rate / Disc% */}
                      <div style={{ display:'grid', gridTemplateColumns:'90px 70px 110px 80px', gap:8, marginBottom:10 }}>
                        <div>
                          <span style={lbl}>Qty</span>
                          <input style={{ ...inp, textAlign:'center', ...(formErrors.qty?{borderColor:'var(--danger)'}:{}) }} type="number" min="1"
                            value={form.qty} onChange={e=>setForm(f=>({...f,qty:e.target.value}))} />
                        </div>
                        <div>
                          <span style={lbl}>Unit</span>
                          <div style={{ ...chip('Pcs'), justifyContent:'center', fontWeight:700 }}>{form.product_unit||'Pcs'}</div>
                        </div>
                        <div>
                          <span style={lbl}>Rate (₹)</span>
                          <input style={{ ...inp, textAlign:'center', ...(formErrors.rate?{borderColor:'var(--danger)'}:{}) }} type="number" min="0" step="0.01"
                            value={form.rate} onChange={e=>setForm(f=>({...f,rate:e.target.value}))} />
                        </div>
                        <div>
                          <span style={lbl}>Disc%</span>
                          <input style={{ ...inp, textAlign:'center' }} type="number" min="0" max="100" step="0.01"
                            value={form.disc} onChange={e=>setForm(f=>({...f,disc:e.target.value}))} />
                        </div>
                      </div>

                      {/* ROW 4: computed summary strip */}
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8,
                        background:'var(--bg)', borderRadius:8, padding:'10px 12px', border:'1px solid var(--border)' }}>
                        {[
                          ['Qty',      `${form.qty || 0} ${form.product_unit||'Pcs'}`, '#2563EB'],
                          ['Amount',   `₹${coAmount.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`, 'var(--text)'],
                          ['Discount', `₹${coDiscAmt.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`, '#D97706'],
                          ['GST Amt',  `₹${coGst.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`, '#7C3AED'],
                          ['Total',    `₹${coTotal.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`, '#FD5C02'],
                        ].map(([label,val,color]) => (
                          <div key={label} style={{ textAlign:'center' }}>
                            <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em', color:'var(--text-muted)', marginBottom:3 }}>{label}</div>
                            <div style={{ fontSize:14, fontWeight:800, color }}>{val}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })()}

              {branches.length>0&&(
                <div className="form-group">
                  <label className="form-label">Branch</label>
                  <select className="form-control" value={form.branch_id} onChange={e=>setForm(f=>({...f,branch_id:e.target.value}))}>
                    <option value="">— Select Branch —</option>
                    {branches.map(b=><option key={b._id||b.id} value={b._id||b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}
              {/* Remarks + Terms */}
              <div style={{ background:'#FAFAFA', border:'1.5px solid #E2E8F0', borderRadius:12, padding:'16px 18px', marginTop:4 }}>
                <div style={{ fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:'.07em',
                  color:'#64748B', marginBottom:14, paddingBottom:6, borderBottom:'2px solid #F1F5F9' }}>
                  Remarks &amp; Terms
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                  <div>
                    <label className="form-label">Remarks</label>
                    <textarea className="form-control" rows={3} placeholder="Internal remarks…"
                      value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/>
                  </div>
                  <div>
                    <label className="form-label">Terms &amp; Conditions</label>
                    <textarea className="form-control" rows={3}
                      value={form.terms} onChange={e=>setForm(f=>({...f,terms:e.target.value}))}/>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={()=>setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
                <Plus style={{width:14}}/>{saving?'Saving…':(editOrder?'Update Order':'Create Order')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ VIEW / DETAIL MODAL ══ */}
      {selected&&(
        <div className="modal-overlay" onClick={()=>setSelected(null)}>
          <div className="modal" style={{maxWidth:640}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                <span className="modal-title">{ordCode(selected)}</span>
                {/* Inline status update in modal header */}
                {['Delivered','Cancelled'].includes(selected.status) ? (
                  <span className={`badge ${STATUS_COLOR[toDisplay(selected.status)]||'badge-gray'}`}>
                    {toDisplay(selected.status)}
                  </span>
                ) : (
                  <select
                    className="form-control"
                    style={{fontSize:12,padding:'3px 8px',width:'auto',fontWeight:700,cursor:'pointer',color:'var(--primary)',border:'2px solid var(--primary)'}}
                    value={selected.status}
                    disabled={!!busyId}
                    onChange={async(e)=>{
                      const newSt=e.target.value
                      if(newSt===selected.status)return
                      // Require a staff member before moving an order into Packing.
                      if(newSt==='Packing' && !isAssigned(selected)){
                        toast('Please assign a staff member before packing this order.',true)
                        e.target.value=selected.status
                        return
                      }
                      await doStatusUpdate(ordId(selected),newSt,'')
                    }}
                  >
                    <option value={selected.status}>{STATUS_ACTION_LABEL[selected.status] || toDisplay(selected.status)}</option>
                    {(NEXT_STATUS[selected.status]||[]).map(ns=>(
                      <option key={ns} value={ns}>{STATUS_ACTION_LABEL[ns] || toDisplay(ns)}</option>
                    ))}
                  </select>
                )}
                <span style={{fontSize:10,color:'var(--text-muted)'}}>{selected.status!==toDisplay(selected.status)?`[${toDisplay(selected.status)}]`:''}</span>
                {selected.invoice_number&&<span style={{fontFamily:'monospace',fontWeight:700,fontSize:12,color:'var(--primary)',background:'var(--bg)',padding:'2px 8px',borderRadius:6}}>{selected.invoice_number}</span>}
              </div>
              <div style={{display:'flex',gap:8}}>
                <button className={`btn btn-xs ${showHistory?'btn-primary':'btn-ghost'}`} onClick={()=>setShowHistory(h=>!h)}>
                  <History style={{width:13}}/>History
                </button>
                <button className="btn-ghost" onClick={()=>setSelected(null)}>✕</button>
              </div>
            </div>
            <div className="modal-body">
              {/* Pipeline bar */}
              <div style={{overflowX:'auto',marginBottom:14,paddingBottom:4}}>
                <div style={{display:'flex',alignItems:'center',gap:2,minWidth:'max-content'}}>
                  {DISPLAY_STATUSES.map((s,i,arr)=>{
                    const cur=DISPLAY_STATUSES.indexOf(toDisplay(selected.status))
                    const isDone=i<cur; const isNow=s===toDisplay(selected.status)
                    return <span key={s} style={{display:'flex',alignItems:'center',gap:2}}>
                      <span style={{padding:'3px 8px',borderRadius:20,fontSize:10,fontWeight:600,whiteSpace:'nowrap',
                        background:isNow?'var(--primary)':isDone?'#d1fae5':'var(--bg)',
                        color:isNow?'#fff':isDone?'var(--success)':'var(--text-muted)',
                        border:isNow?'1.5px solid var(--primary)':'1.5px solid transparent'}}>{s}</span>
                      {i<arr.length-1&&<ChevronRight style={{width:10,color:'var(--border)',flexShrink:0}}/>}
                    </span>
                  })}
                </div>
              </div>

              {showHistory?<StatusHistory history={selected.status_history||[]}/>:(
                <>
                  {/* Assignment */}
                  <div style={{background:'var(--bg)',borderRadius:8,padding:'12px 14px',marginBottom:12,border:'1.5px solid var(--border)'}}>
                    <div style={{fontWeight:700,fontSize:11,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:8,display:'flex',alignItems:'center',gap:6}}>
                      <span style={{width:8,height:8,borderRadius:'50%',background:selected.assigned_to?'var(--success)':'#d1d5db',display:'inline-block',flexShrink:0}}/>
                      Staff Assignment
                    </div>

                    {selected.assigned_to_name ? (
                      <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                        {/* Avatar */}
                        <div style={{width:38,height:38,borderRadius:'50%',background:'var(--primary)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:15,flexShrink:0}}>
                          {(selected.assigned_to_name||'?').charAt(0).toUpperCase()}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontWeight:800,fontSize:13,color:'var(--text)'}}>{selected.assigned_to_name}</div>
                          {selected.assigned_date&&(
                            <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>
                              Assigned {fmtDate(selected.assigned_date)}
                              {selected.assignment_type&&<span style={{marginLeft:6,padding:'1px 6px',borderRadius:10,background:'#dbeafe',color:'#1d4ed8',fontSize:10,fontWeight:700}}>{selected.assignment_type}</span>}
                            </div>
                          )}
                        </div>
                        {/* Re-assign dropdown */}
                        <select
                          className="form-control"
                          style={{fontSize:11,padding:'4px 8px',width:'auto',minWidth:140,cursor:'pointer'}}
                          value={String(typeof selected.assigned_to === 'object' && selected.assigned_to ? (selected.assigned_to._id||selected.assigned_to) : (selected.assigned_to||''))}
                          onChange={(e) => handleAssignStaff(ordId(selected), e.target.value)}
                          disabled={!!busyId}
                        >
                          <option value="">— Reassign —</option>
                          {assignableStaff.map(s => {
                            const uid = s.user_id
                            return <option key={uid} value={uid}>{s.name}{s.designation?` (${s.designation})`:''}</option>
                          })}
                        </select>
                      </div>
                    ) : (
                      <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                        <div style={{fontSize:12,color:'var(--text-muted)',flex:1}}>No staff assigned yet. Select someone from the list to assign this order.</div>
                        <select
                          className="form-control"
                          style={{fontSize:11,padding:'4px 8px',width:'auto',minWidth:160,cursor:'pointer',borderColor:'var(--primary)'}}
                          value=""
                          onChange={(e) => handleAssignStaff(ordId(selected), e.target.value)}
                          disabled={!!busyId}
                        >
                          <option value="">— Assign Staff —</option>
                          {assignableStaff.map(s => {
                            const uid = s.user_id
                            return <option key={uid} value={uid}>{s.name}{s.designation?` (${s.designation})`:''}</option>
                          })}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Customer */}
                  <div style={{background:'var(--bg)',borderRadius:8,padding:'12px 14px',marginBottom:12}}>
                    <div style={{fontWeight:700,fontSize:11,color:'var(--text-muted)',textTransform:'uppercase',marginBottom:8}}>Customer</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:10}}>
                      <div><div style={{fontSize:10,color:'var(--text-muted)'}}>Name</div><div style={{fontWeight:700}}>{selected.customer_name||'—'}</div></div>
                      <div><div style={{fontSize:10,color:'var(--text-muted)'}}>Mobile</div><div style={{fontWeight:600}}>{selected.customer_mobile||'—'}</div></div>
                      <div style={{gridColumn:'span 2'}}>
                        <div style={{fontSize:10,color:'var(--text-muted)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.04em',marginBottom:2}}>📍 Delivery Address</div>
                        <div style={{fontSize:12,fontWeight:600,color:'var(--text)',lineHeight:1.5}}>{selected.delivery_address||selected.location||'—'}</div>
                      </div>
                    </div>
                    {(selected.created_by_name||selected.created_by_company||selected.created_by_mobile||selected.created_by_email)&&(
                      <div style={{marginTop:10,paddingTop:10,borderTop:'1px dashed var(--border)'}}>
                        <div style={{fontWeight:700,fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:6}}>Created By{selected.created_by_type?` (${selected.created_by_type})`:''}</div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                          <div><div style={{fontSize:10,color:'var(--text-muted)'}}>Name</div><div style={{fontWeight:700}}>{selected.created_by_person||selected.created_by_name||'—'}</div></div>
                          <div><div style={{fontSize:10,color:'var(--text-muted)'}}>Company</div><div style={{fontWeight:600}}>{selected.created_by_company||'—'}</div></div>
                          <div><div style={{fontSize:10,color:'var(--text-muted)'}}>Phone</div><div style={{fontWeight:600}}>{selected.created_by_mobile||'—'}</div></div>
                          {selected.created_by_email&&<div style={{gridColumn:'1 / -1'}}><div style={{fontSize:10,color:'var(--text-muted)'}}>Email</div><div style={{fontWeight:600}}>{selected.created_by_email}</div></div>}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Product full details */}
                  <div style={{background:'var(--bg)',borderRadius:8,padding:'12px 14px',marginBottom:12}}>
                    <div style={{fontWeight:700,fontSize:11,color:'var(--text-muted)',textTransform:'uppercase',marginBottom:8}}>Product Details</div>
                    <div style={{fontWeight:800,fontSize:14,marginBottom:6}}>{selected.product_name||'—'}</div>
                    {selected.product_code&&<div style={{fontSize:11,color:'var(--text-muted)',fontFamily:'monospace',marginBottom:8}}>{selected.product_code}</div>}
                    <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:10}}>
                      {[
                        selected.category_name &&{l:'Category',v:selected.category_name},
                        selected.brand_name    &&{l:'Brand',v:selected.brand_name},
                        selected.size          &&{l:'Size',v:selected.size},
                        selected.finish        &&{l:'Finish',v:selected.finish},
                        selected.color         &&{l:'Color',v:selected.color},
                        selected.material      &&{l:'Material',v:selected.material},
                        selected.thickness     &&{l:'Thickness',v:selected.thickness},
                        selected.tile_type     &&{l:'Type',v:selected.tile_type},
                        selected.grade         &&{l:'Grade',v:selected.grade},
                        selected.gst_percent   &&{l:'GST',v:`${selected.gst_percent}%`},
                      ].filter(Boolean).map(({l,v})=>(
                        <div key={l} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:6,padding:'2px 8px',fontSize:11,display:'flex',gap:4}}>
                          <span style={{color:'var(--text-muted)'}}>{l}:</span><span style={{fontWeight:600}}>{v}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                      <div><div style={{fontSize:10,color:'var(--text-muted)'}}>Quantity</div><div style={{fontWeight:700}}>{selected.qty} {selected.unit||'Pcs'}</div></div>
                      <div><div style={{fontSize:10,color:'var(--text-muted)'}}>Rate</div><div style={{fontWeight:700}}>₹{(selected.rate||0).toLocaleString()}</div></div>
                      <div><div style={{fontSize:10,color:'var(--text-muted)'}}>GST Amount</div><div style={{fontWeight:600,color:'var(--text-muted)'}}>₹{ordGst(selected).toLocaleString()}</div></div>
                    </div>
                  </div>

                  {/* Financials */}
                  <div style={{background:'linear-gradient(135deg,var(--bg),var(--surface))',borderRadius:8,padding:'12px 14px',marginBottom:12,display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                    <div><div style={{fontSize:10,color:'var(--text-muted)'}}>Amount</div><div style={{fontWeight:700}}>₹{ordAmount(selected).toLocaleString()}</div></div>
                    <div><div style={{fontSize:10,color:'var(--text-muted)'}}>Grand Total</div><div style={{fontWeight:800,fontSize:16,color:'var(--success)'}}>₹{ordTotal(selected).toLocaleString()}</div></div>
                    <div><div style={{fontSize:10,color:'var(--text-muted)'}}>Purchase Cost</div><div style={{fontWeight:600,color:'var(--danger)'}}>₹{(selected.purchase_cost||0).toLocaleString()}</div></div>
                    <div><div style={{fontSize:10,color:'var(--text-muted)'}}>Gross Profit</div><div style={{fontWeight:700,color:'var(--primary)'}}>₹{(ordAmount(selected)-(selected.purchase_cost||0)).toLocaleString()}</div></div>
                  </div>

                  {/* Invoice + Dispatch info */}
                  {selected.invoice_number&&(
                    <div style={{marginBottom:10,padding:'8px 12px',background:'#eff6ff',borderRadius:8,border:'1px solid #bfdbfe',display:'flex',justifyContent:'space-between'}}>
                      <div><div style={{fontSize:10,fontWeight:700,color:'#1d4ed8',textTransform:'uppercase'}}>Invoice</div><div style={{fontFamily:'monospace',fontWeight:700,fontSize:14}}>{selected.invoice_number}</div></div>
                      {selected.invoice_date&&<div style={{fontSize:12,color:'var(--text-muted)'}}>{fmtDate(selected.invoice_date)}</div>}
                    </div>
                  )}
                  {/* Fulfillment summary: ordered / dispatched / remaining */}
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
                    {[
                      {l:'Ordered',   v:ordQtyNum(selected),    c:'var(--text)'},
                      {l:'Dispatched',v:ordDispatched(selected),c:'var(--primary)'},
                      {l:'Remaining', v:ordRemaining(selected), c:ordRemaining(selected)>0?'#D97706':'var(--success)'},
                    ].map(({l,v,c})=>(
                      <div key={l} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:8,padding:'8px 10px',textAlign:'center'}}>
                        <div style={{fontSize:9,fontWeight:700,textTransform:'uppercase',color:'var(--text-muted)'}}>{l}</div>
                        <div style={{fontSize:15,fontWeight:800,color:c}}>{v} <span style={{fontSize:10,color:'var(--text-muted)'}}>{selected.unit||'Pcs'}</span></div>
                      </div>
                    ))}
                  </div>

                  {/* Packing / dispatch batches */}
                  {Array.isArray(selected.packages)&&selected.packages.length>0&&(
                    <div style={{marginBottom:12}}>
                      <div style={{fontWeight:700,fontSize:11,color:'var(--text-muted)',textTransform:'uppercase',marginBottom:6}}>Packing Batches ({selected.packages.length})</div>
                      <div style={{display:'flex',flexDirection:'column',gap:6}}>
                        {selected.packages.map((p,i)=>(
                          <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,padding:'8px 12px',background:'#f5f3ff',borderRadius:8,border:'1px solid #ddd6fe',fontSize:12,flexWrap:'wrap'}}>
                            <div style={{display:'flex',alignItems:'center',gap:8}}>
                              <span style={{fontWeight:800,color:'#6d28d9'}}>#{p.pack_no||i+1}</span>
                              <span style={{fontWeight:700}}>{p.qty} {selected.unit||'Pcs'}</span>
                            </div>
                            <div style={{display:'flex',gap:14,flexWrap:'wrap',color:'var(--text-muted)'}}>
                              {p.invoice_number&&<span>Inv: <strong style={{fontFamily:'monospace',color:'var(--text)'}}>{p.invoice_number}</strong></span>}
                              {p.dispatch_code&&<span>Dispatch: <strong style={{fontFamily:'monospace',color:'var(--text)'}}>{p.dispatch_code}</strong></span>}
                              {p.lr_number&&<span>LR: <strong style={{color:'var(--text)'}}>{p.lr_number}</strong></span>}
                              {p.vehicle_number&&<span>🚛 {p.vehicle_number}</span>}
                              <span>₹{(p.total||0).toLocaleString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Stock */}
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:12}}>
                    <span style={{color:'var(--text-muted)'}}>Current Stock</span>
                    <span style={{fontWeight:700,color:'var(--primary)'}}>{getStock(selected.product_id)} {selected.unit||'Pcs'}</span>
                  </div>

                  {/* Next status actions */}
                  {(NEXT_STATUS[selected.status]||[]).length>0&&(
                    <div>
                      <div style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.4px'}}>Move to Next Status</div>
                      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                        {(NEXT_STATUS[selected.status]||[]).map(ns=>(
                          <button key={ns} className={`btn btn-sm ${ns==='Cancelled'?'btn-danger':'btn-primary'}`}
                            style={ns==='Delivered'?{background:'var(--success)'}:{}}
                            disabled={!!busyId}
                            onClick={()=>doStatusUpdate(ordId(selected),ns,'')}>
                            <ArrowRight style={{width:12}}/>{STATUS_ACTION_LABEL[ns]||toDisplay(ns)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={()=>setSelected(null)}>Close</button></div>
          </div>
        </div>
      )}

      {/* ══ DELETE CONFIRM MODAL ══ */}
      {deleteConfirm&&(
        <div className="modal-overlay" onClick={()=>setDeleteConfirm(null)}>
          <div className="modal" style={{maxWidth:380}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Delete Order</span>
              <button className="btn-ghost" onClick={()=>setDeleteConfirm(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="alert alert-danger" style={{marginBottom:0}}>
                <Trash2 style={{width:16,flexShrink:0}}/>
                <span>Delete order <strong>{deleteConfirm.code}</strong>? This cannot be undone.</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={()=>setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={!!busyId} onClick={()=>handleDelete(deleteConfirm.id)}>
                {busyId?'Deleting…':'Delete Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ DISPATCH FORM MODAL ══ */}
      {dispatchForm&&(
        <div className="modal-overlay" onClick={()=>setDispatchForm(null)}>
          <div className="modal" style={{maxWidth:580}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Pack Order — {ordCode(dispatchForm)}</span>
              <button className="btn-ghost" onClick={()=>setDispatchForm(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{background:'var(--bg)',borderRadius:8,padding:'10px 14px',marginBottom:12,fontSize:13}}>
                <strong>{ordCustomer(dispatchForm)}</strong> — {ordProduct(dispatchForm)}
                {dispatchForm.product_code&&<span style={{color:'var(--text-muted)',marginLeft:6,fontSize:11}}>({dispatchForm.product_code})</span>}
              </div>

              {/* Quantity summary strip */}
              {(() => {
                const packingNow = Number(dForm.packQty) || 0;
                const remaining  = ordRemaining(dispatchForm);
                const isOver     = packingNow > remaining;
                return (
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:14}}>
                    {[
                      {l:'Ordered',    v:ordQtyNum(dispatchForm),    c:'var(--text)'},
                      {l:'Dispatched', v:ordDispatched(dispatchForm), c:'var(--primary)'},
                      {l:'Remaining',  v:remaining,                   c:'#D97706'},
                      {l:'Packing now',v:packingNow,                  c: isOver ? 'var(--danger)' : 'var(--success)'},
                    ].map(({l,v,c})=>(
                      <div key={l} style={{
                        background: l==='Packing now' && isOver ? 'var(--danger-soft,#FDECEC)' : 'var(--surface)',
                        border: `1px solid ${l==='Packing now' && isOver ? 'var(--danger)' : 'var(--border)'}`,
                        borderRadius:8, padding:'8px 10px', textAlign:'center',
                      }}>
                        <div style={{fontSize:9,fontWeight:700,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:3}}>{l}</div>
                        <div style={{fontSize:16,fontWeight:800,color:c}}>{v}</div>
                        <div style={{fontSize:9,color:'var(--text-muted)'}}>{dispatchForm.unit||'Pcs'}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Pack quantity input */}
              <div className="form-group">
                <label className="form-label">Quantity to Pack Now * <span style={{color:'var(--text-muted)',fontWeight:400}}>(max {ordRemaining(dispatchForm)} {dispatchForm.unit||'Pcs'})</span></label>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <input className="form-control" type="number" min="1" max={ordRemaining(dispatchForm)}
                    placeholder={`e.g. ${ordRemaining(dispatchForm)}`} value={dForm.packQty}
                    onChange={e=>{
                      const raw = e.target.value;
                      // Allow clearing the field, but clamp to max remaining on valid input
                      if(raw === '' || raw === '-'){setDForm(f=>({...f,packQty:raw}));return;}
                      const num = Number(raw);
                      const max = ordRemaining(dispatchForm);
                      const clamped = isNaN(num) ? raw : String(Math.min(Math.max(num, 0), max));
                      setDForm(f=>({...f,packQty:clamped}));
                    }}
                    style={{maxWidth:180}}/>
                  <button type="button" className="btn btn-secondary btn-sm"
                    onClick={()=>setDForm(f=>({...f,packQty:String(ordRemaining(dispatchForm))}))}>
                    Pack all remaining
                  </button>
                </div>
                {(() => {
                  const pq=Number(dForm.packQty)||0
                  const remaining=ordRemaining(dispatchForm)
                  if(pq > remaining) return (
                    <div style={{marginTop:6,fontSize:12,color:'var(--danger)',fontWeight:600}}>
                      ⚠ Cannot pack more than remaining quantity ({remaining} {dispatchForm.unit||'Pcs'})
                    </div>
                  )
                  const amt=pq*(Number(dispatchForm.rate)||0)
                  const gst=Math.round(amt*(Number(dispatchForm.gst_percent)||0)/100)
                  return pq>0?(
                    <div style={{marginTop:8,fontSize:12,color:'var(--text-muted)'}}>
                      Invoice for this pack: <strong style={{color:'var(--text)'}}>₹{(amt+gst).toLocaleString()}</strong>
                      <span style={{marginLeft:8}}>(₹{amt.toLocaleString()} + GST ₹{gst.toLocaleString()})</span>
                    </div>
                  ):null
                })()}
              </div>

              <div className="divider" style={{margin:'14px 0'}}/>
              <div style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:10}}>Dispatch Details</div>

              {branchNames.length>0&&(
                <div className="form-group">
                  <label className="form-label">Branch</label>
                  <select className="form-control" value={dForm.branch} onChange={e=>setDForm(f=>({...f,branch:e.target.value}))}>
                    <option value="">Select Branch</option>
                    {branchNames.map(b=><option key={b}>{b}</option>)}
                  </select>
                </div>
              )}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Vehicle Number *</label>
                  <input className="form-control" placeholder="e.g. KA01AB1234" value={dForm.vehicle} onChange={e=>setDForm(f=>({...f,vehicle:e.target.value}))}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Transport Company *</label>
                  <input className="form-control" placeholder="e.g. VRL Logistics" value={dForm.transport} onChange={e=>setDForm(f=>({...f,transport:e.target.value}))}/>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Driver Name *</label>
                  <input className="form-control" placeholder="Driver name" value={dForm.driver} onChange={e=>setDForm(f=>({...f,driver:e.target.value}))}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Driver Mobile *</label>
                  <input className="form-control" placeholder="Mobile" value={dForm.driverMobile} onChange={e=>setDForm(f=>({...f,driverMobile:e.target.value}))}/>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">LR Number</label>
                  <input className="form-control" placeholder="Lorry Receipt No." value={dForm.lr} onChange={e=>setDForm(f=>({...f,lr:e.target.value}))}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Dispatch Date *</label>
                  <input className="form-control" type="date" value={dForm.dispatchDate} onChange={e=>setDForm(f=>({...f,dispatchDate:e.target.value}))}/>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Delivery in Days *</label>
                  <select className="form-control" value={dForm.expectedDays}
                    style={!dForm.expectedDelivery && !dForm.expectedDays ? {borderColor:'var(--danger)'} : {}}
                    onChange={e=>{
                      const days=e.target.value
                      let auto=''
                      if(days&&dForm.dispatchDate){const d=new Date(dForm.dispatchDate);d.setDate(d.getDate()+parseInt(days));auto=d.toISOString().split('T')[0]}
                      setDForm(f=>({...f,expectedDays:days,expectedDelivery:auto}))
                    }}>
                    <option value="">Select days</option>
                    {[1,2,3,4,5,6,7,10,14,15,20,21,25,30].map(d=><option key={d} value={d}>{d} {d===1?'day':'days'}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Expected Delivery Date *</label>
                  <input className="form-control" type="date" value={dForm.expectedDelivery}
                    style={!dForm.expectedDelivery && !dForm.expectedDays ? {borderColor:'var(--danger)'} : {}}
                    onChange={e=>setDForm(f=>({...f,expectedDelivery:e.target.value,expectedDays:''}))}/>
                  {!dForm.expectedDelivery && !dForm.expectedDays ? (
                    <small style={{color:'var(--danger)',fontSize:11}}>Required — enter a date or select delivery days</small>
                  ) : null}
                </div>
              </div>
              <div className="alert alert-info" style={{fontSize:12}}>ℹ️ This creates an invoice for the packed quantity and dispatches it. Any remaining quantity stays open so you can pack it later.</div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={()=>setDispatchForm(null)}>Cancel</button>
              <button className="btn btn-primary"
                disabled={
                  busyId===(dispatchForm._id||dispatchForm.id) ||
                  Number(dForm.packQty) > ordRemaining(dispatchForm) ||
                  !Number(dForm.packQty) ||
                  (!dForm.expectedDelivery && !dForm.expectedDays)
                }
                onClick={handleDispatch}>
                <FileText style={{width:14}}/>{busyId===(dispatchForm._id||dispatchForm.id)?'Processing…':'Create Invoice & Dispatch'}
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  )
}
