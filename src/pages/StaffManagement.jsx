/**
 * StaffManagement.jsx
 * Add and manage staff who log in via mobile OTP on the Staff App.
 * Design matches BranchManagement.jsx style.
 */
import { useState, useEffect, useCallback } from 'react'
import {
  Users, UserPlus, Phone, Mail, Lock, Shield, Search, Trash2,
  RefreshCw, CheckCircle, XCircle, Eye, EyeOff, X, Check,
  Send, ShieldCheck, Clock, AlertCircle, User, Layers,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { userApi } from '../api/userApi'
import { invoiceApi } from '../api/financeApi'
import { hrApi } from '../api/hrApi'
import { staffManagementApi } from '../api/staffManagementApi'
import { productApi } from '../api/productApi'

// Staff App modules the admin can grant (mirror of backend STAFF_APP_MODULES)
const STAFF_APP_MODULES = [
  { key: 'dashboard',     label: 'Dashboard' },
  { key: 'orders',        label: 'Orders' },
  { key: 'dispatches',    label: 'Dispatches' },
  { key: 'invoices',      label: 'Invoices' },
  { key: 'customers',     label: 'Customers' },
  { key: 'leads',         label: 'Leads' },
  { key: 'followups',     label: 'Follow-ups' },
  { key: 'quotations',    label: 'Quotations' },
  { key: 'products',      label: 'Products' },
  { key: 'finance',       label: 'Finance' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'attendance',    label: 'Attendance' },
  { key: 'salary',        label: 'Salary' },
]

const PAGE_SIZE = 10

// ─── constants ───────────────────────────────────────────────
const STAFF_ROLES = ['Manager', 'Accountant', 'Sales Executive', 'Warehouse Staff']

const ROLE_META = {
  Manager:           { bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE', iconBg: '#DBEAFE' },
  Accountant:        { bg: '#ECFDF5', color: '#059669', border: '#A7F3D0', iconBg: '#D1FAE5' },
  'Sales Executive': { bg: '#FFF7ED', color: '#EA580C', border: '#FED7AA', iconBg: '#FFEDD5' },
  'Warehouse Staff': { bg: '#FEFCE8', color: '#CA8A04', border: '#FEF08A', iconBg: '#FEF9C3' },
}

const COLL_STATUS = {
  Pending:   { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', label: 'Pending', Icon: Clock },
  'OTP Sent':{ color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', label: 'OTP Sent', Icon: Send },
  Verified:  { color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', label: 'Verified', Icon: CheckCircle },
  Rejected:  { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', label: 'Rejected', Icon: XCircle },
}

const EMPTY = { name: '', mobile: '', email: '', password: '', role: 'Sales Executive' }

// ─── helpers ─────────────────────────────────────────────────
const fmt   = n => '₹' + (parseFloat(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })
const fmtDt = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtTs = d => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

// ─── shared sub-components ────────────────────────────────────
function SectionLabel({ icon, text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12, marginTop: 8 }}>
      <div style={{ width: 22, height: 22, borderRadius: 6, background: '#FFF3EC', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FD5C02' }}>
        {icon}
      </div>
      <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: '#94A3B8' }}>{text}</span>
      <div style={{ flex: 1, height: 1, background: '#E8EDF3' }} />
    </div>
  )
}

function FieldInput({ label, name, value, onChange, placeholder, type = 'text', icon, hint, error, suffix }) {
  const hasErr = !!error
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{label}</label>
      <div
        style={{ display: 'flex', alignItems: 'center', border: `1.5px solid ${hasErr ? '#EF4444' : '#E2E8F0'}`, borderRadius: 9, background: '#FAFBFC', overflow: 'hidden', transition: 'all 0.15s' }}
        onFocusCapture={e => { e.currentTarget.style.borderColor = '#FD5C02'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(253,92,2,0.10)'; e.currentTarget.style.background = '#fff' }}
        onBlurCapture={e => { e.currentTarget.style.borderColor = hasErr ? '#EF4444' : '#E2E8F0'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = '#FAFBFC' }}
      >
        {icon && <span style={{ display: 'flex', paddingLeft: 11, color: '#94A3B8', flexShrink: 0 }}>{icon}</span>}
        <input
          type={type} value={value} placeholder={placeholder}
          maxLength={name === 'mobile' ? 10 : undefined}
          inputMode={name === 'mobile' ? 'numeric' : undefined}
          onChange={e => onChange(name, name === 'mobile' ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value)}
          style={{ flex: 1, padding: '10px 12px', paddingLeft: icon ? 8 : 12, border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: '#01152D' }}
        />
        {suffix}
      </div>
      {hasErr
        ? <div style={{ fontSize: 11, color: '#EF4444', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}><XCircle size={11} />{error}</div>
        : hint ? <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{hint}</div> : null}
    </div>
  )
}

// ─── OTP widget ───────────────────────────────────────────────
function OtpInput({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', margin: '12px 0' }}>
      {[0,1,2,3,4,5].map(i => (
        <input key={i} maxLength={1} value={value[i] || ''} inputMode="numeric"
          onChange={e => {
            const ch = e.target.value.replace(/\D/, '')
            if (!ch) return
            const arr = value.split(''); arr[i] = ch
            onChange(arr.join('').slice(0, 6))
            const next = e.target.parentNode.children[i + 1]
            if (next) next.focus()
          }}
          onKeyDown={e => {
            if (e.key === 'Backspace' && !value[i]) {
              const prev = e.target.parentNode.children[i - 1]
              if (prev) prev.focus()
            }
          }}
          style={{
            width: 44, height: 50, textAlign: 'center', fontSize: 20, fontWeight: 800,
            border: `2px solid ${value[i] ? '#FD5C02' : '#E2E8F0'}`,
            borderRadius: 9, outline: 'none',
            background: value[i] ? '#FFF3EC' : '#FAFBFC',
            color: '#01152D', transition: 'border-color .15s',
          }}
        />
      ))}
    </div>
  )
}

// ─── Collection card ─────────────────────────────────────────
function CollectionCard({ entry, onSendOtp, onVerify, busyId }) {
  const [otp, setOtp]           = useState('')
  const [otpErr, setOtpErr]     = useState('')
  const [showOtp, setShowOtp]   = useState(entry.verification_status === 'OTP Sent')
  const isBusy     = busyId === `${entry.invoice_id}-${entry.payment_id}`
  const isVerified = entry.verification_status === 'Verified'
  const sm         = COLL_STATUS[entry.verification_status] || COLL_STATUS.Pending
  const { Icon: SI } = sm

  const handleSend = async () => {
    await onSendOtp(entry.invoice_id, entry.payment_id)
    setShowOtp(true); setOtp(''); setOtpErr('')
  }
  const handleVerify = async () => {
    if (otp.length !== 6) { setOtpErr('Enter all 6 digits'); return }
    const err = await onVerify(entry.invoice_id, entry.payment_id, otp)
    if (err) { setOtpErr(err); setOtp('') }
  }

  return (
    <div style={{ background: '#fff', border: `1.5px solid ${isVerified ? '#A7F3D0' : '#E8EDF3'}`, borderRadius: 12, marginBottom: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: isVerified ? '#ECFDF5' : '#FAFBFC', borderBottom: '1px solid #E8EDF3' }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: sm.bg, border: `1.5px solid ${sm.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <SI size={15} color={sm.color} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 13, color: '#FD5C02' }}>{entry.invoice_no}</span>
            <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: sm.bg, color: sm.color, border: `1px solid ${sm.border}` }}>{sm.label}</span>
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{fmtTs(entry.payment_date)}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: isVerified ? '#059669' : '#FD5C02' }}>{fmt(entry.amount)}</div>
          <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700 }}>{entry.payment_mode}</div>
        </div>
      </div>
      <div style={{ padding: '10px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        {[['Customer', entry.customer_name, false], ['Collected By', entry.received_by_name, true], ['Balance', fmt(entry.invoice_balance), false]].map(([l, v, accent]) => (
          <div key={l}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#94A3B8', marginBottom: 2 }}>{l}</div>
            <div style={{ fontSize: 12, fontWeight: accent ? 700 : 600, color: accent ? '#FD5C02' : '#01152D' }}>{v || '—'}</div>
          </div>
        ))}
      </div>
      {!isVerified && (
        <div style={{ padding: '10px 16px', borderTop: '1px solid #E8EDF3', background: showOtp ? '#EFF6FF' : '#FAFBFC' }}>
          {!showOtp ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <p style={{ flex: 1, fontSize: 12, color: '#64748B', margin: 0 }}>Send OTP to <strong>{entry.received_by_name || 'staff'}</strong>'s mobile to verify this collection.</p>
              <button className="btn btn-primary btn-sm" disabled={isBusy} onClick={handleSend} style={{ flexShrink: 0 }}>
                <Send size={12} style={{ marginRight: 5 }} />{isBusy ? 'Sending…' : 'Send OTP'}
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#2563EB', margin: '0 0 2px' }}>OTP sent to <strong>{entry.received_by_name}</strong>'s mobile</p>
              <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 4px' }}>Ask them to read you the 6-digit OTP</p>
              <OtpInput value={otp} onChange={v => { setOtp(v); setOtpErr('') }} />
              {otpErr && <div style={{ color: '#DC2626', fontSize: 12, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}><XCircle size={12} />{otpErr}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button className="btn btn-secondary btn-sm" disabled={isBusy} onClick={handleSend}>Resend</button>
                <button className="btn btn-primary btn-sm" disabled={isBusy || otp.length !== 6} onClick={handleVerify} style={{ background: '#059669' }}>
                  <ShieldCheck size={12} style={{ marginRight: 5 }} />{isBusy ? 'Verifying…' : 'Verify'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {isVerified && (
        <div style={{ padding: '7px 16px', background: '#ECFDF5', borderTop: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#059669', fontWeight: 700 }}>
          <CheckCircle size={13} />Verified by {entry.verified_by_name || 'Accounts'} · {fmtTs(entry.verified_at)}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ─── Business Staff view — grouped by business type → company ────
function BusinessStaffView({ staff, loading, search, onRefresh }) {
  const q = (search || '').trim().toLowerCase()
  const filtered = !q ? staff : staff.filter(e =>
    [e.name, e.mobile, e.email, e.role_access, e.designation, e.company_name, e.biz_type]
      .map(v => (v || '').toString().toLowerCase()).join(' ').includes(q)
  )

  // Group: biz_type → company_name → [staff]
  const byType = {}
  filtered.forEach(e => {
    const type = e.biz_type || 'Other'
    const comp = e.company_name || '—'
    byType[type] = byType[type] || {}
    byType[type][comp] = byType[type][comp] || []
    byType[type][comp].push(e)
  })

  const typeMeta = {
    Wholesaler: { color: '#2563EB', bg: '#EFF6FF' },
    Retailer:   { color: '#059669', bg: '#ECFDF5' },
    Other:      { color: '#64748B', bg: '#F4F6F9' },
  }

  if (loading) {
    return <div className="card" style={{ padding: 48, textAlign: 'center', color: '#94A3B8' }}>Loading business staff…</div>
  }
  if (filtered.length === 0) {
    return (
      <div className="card" style={{ padding: 48, textAlign: 'center' }}>
        <Users size={36} color="#E2E8F0" style={{ display: 'block', margin: '0 auto 10px' }} />
        <div style={{ fontWeight: 700, fontSize: 14, color: '#64748B', marginBottom: 4 }}>No business staff found</div>
        <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 16 }}>Staff added from the Wholesaler/Retailer apps appear here.</div>
        <button onClick={onRefresh} style={{ padding: '8px 16px', background: '#fff', color: '#64748B', border: '1.5px solid #E2E8F0', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Refresh</button>
      </div>
    )
  }

  const fmtMoney = n => '₹' + (parseFloat(n) || 0).toLocaleString('en-IN')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {Object.entries(byType).map(([type, companies]) => {
        const tm = typeMeta[type] || typeMeta.Other
        return (
          <div key={type}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ padding: '4px 12px', borderRadius: 20, background: tm.bg, color: tm.color, fontSize: 12, fontWeight: 800 }}>
                {type} Staff
              </span>
              <span style={{ fontSize: 12, color: '#94A3B8' }}>
                {Object.values(companies).reduce((a, arr) => a + arr.length, 0)} member(s)
              </span>
            </div>

            {Object.entries(companies).map(([company, members]) => (
              <div key={company} className="card" style={{ marginBottom: 12 }}>
                <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: tm.color }} />
                  <span className="card-title">{company}</span>
                  {members[0]?.company_code && (
                    <span style={{ fontSize: 11, fontWeight: 800, fontFamily: 'monospace', color: tm.color, background: tm.bg, padding: '2px 8px', borderRadius: 6 }}>{members[0].company_code}</span>
                  )}
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94A3B8' }}>{members.length} staff</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>#</th><th>Name</th><th>Mobile</th><th>Email</th><th>Role Access</th><th>Salary</th><th>Incentive</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {members.map((e, i) => (
                        <tr key={e._id}>
                          <td>{i + 1}</td>
                          <td style={{ fontWeight: 700, color: '#01152D' }}>{e.name}</td>
                          <td style={{ fontFamily: 'monospace' }}>{e.mobile || '—'}</td>
                          <td>{e.email || '—'}</td>
                          <td>{e.role_access || e.designation || '—'}</td>
                          <td>{Number(e.salary) > 0 ? fmtMoney(e.salary) : '—'}</td>
                          <td>{Array.isArray(e.incentive_slabs) && e.incentive_slabs.length ? `${e.incentive_slabs.length} slab(s)` : '—'}</td>
                          <td>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: e.is_active ? '#ECFDF5' : '#FEF2F2', color: e.is_active ? '#059669' : '#DC2626' }}>
                              {e.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// FULL STAFF MODAL — same rich form the Wholesaler/Retailer apps use:
// identity, module access, salary breakdown, incentive slabs, sales
// target, discount access + per-item discount caps, and assigned items.
// ═══════════════════════════════════════════════════════════════
const EMPTY_FULL = {
  name: '', mobile: '', email: '', designation: '', department: '', branch: '',
  staff_app_access: [],
  fixed_salary: '', sales_target: '',
  incentive_type: 'none', incentive_value: '', sales_percentage: '',
  incentive_slabs: [],
  discount_access: false, max_discount_percent: '',
  discount_authorizations: [],
  assigned_products: [],   // product ids
  salary_notes: '',
}

function FullStaffModal({ editStaff, onClose, onSaved, showToast }) {
  const [form, setForm]       = useState(EMPTY_FULL)
  const [errors, setErrors]   = useState({})
  const [saving, setSaving]   = useState(false)
  const [products, setProducts] = useState([])
  const [prodQuery, setProdQuery] = useState('')
  const [discQuery, setDiscQuery] = useState('')

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })) }

  // Load products once (for assigned items + per-item discounts).
  useEffect(() => {
    productApi.list({ limit: 1000 })
      .then(res => {
        const list = res?.data?.products || res?.products || res?.data || []
        setProducts(Array.isArray(list) ? list : [])
      })
      .catch(() => setProducts([]))
  }, [])

  // Prefill when editing.
  useEffect(() => {
    if (!editStaff) { setForm(EMPTY_FULL); return }
    const bd = editStaff.salary_breakdown || {}
    setForm({
      name: editStaff.name || '', mobile: editStaff.mobile || '', email: editStaff.email || '',
      designation: editStaff.designation || '', department: editStaff.department || '', branch: editStaff.branch || '',
      staff_app_access: Array.isArray(editStaff.staff_app_access) ? editStaff.staff_app_access : [],
      fixed_salary: bd.fixed_salary ?? editStaff.salary ?? '',
      sales_target: editStaff.sales_target ?? '',
      incentive_type: bd.incentive_type ?? 'none',
      incentive_value: bd.incentive_value ?? '',
      sales_percentage: bd.sales_percentage ?? '',
      incentive_slabs: Array.isArray(editStaff.incentive_slabs) ? editStaff.incentive_slabs : [],
      discount_access: bd.discount_access ?? false,
      max_discount_percent: bd.max_discount_percent ?? '',
      discount_authorizations: Array.isArray(editStaff.discount_authorizations) ? editStaff.discount_authorizations : [],
      assigned_products: Array.isArray(editStaff.assigned_products)
        ? editStaff.assigned_products.map(p => String(p?._id || p)) : [],
      salary_notes: bd.notes || '',
    })
  }, [editStaff])

  const pid = p => String(p._id || p.id)
  const assignedSet = new Set(form.assigned_products.map(String))

  const toggleModule = key => set('staff_app_access',
    form.staff_app_access.includes(key)
      ? form.staff_app_access.filter(m => m !== key)
      : [...form.staff_app_access, key])

  const toggleAssigned = id => set('assigned_products',
    assignedSet.has(String(id))
      ? form.assigned_products.filter(x => String(x) !== String(id))
      : [...form.assigned_products, String(id)])

  // ── Incentive slabs ──
  const addSlab = () => set('incentive_slabs', [...form.incentive_slabs, { sales_amount: '', incentive_pct: '' }])
  const setSlab = (i, k, v) => set('incentive_slabs', form.incentive_slabs.map((s, idx) => idx === i ? { ...s, [k]: v } : s))
  const delSlab = i => set('incentive_slabs', form.incentive_slabs.filter((_, idx) => idx !== i))

  // ── Per-item discount authorisations ──
  const addDiscount = (p) => {
    if (form.discount_authorizations.some(d => String(d.product_id) === pid(p))) return
    set('discount_authorizations', [...form.discount_authorizations, {
      product_id: pid(p), product_name: p.name, product_code: p.code || '', max_discount_pct: '',
    }])
    setDiscQuery('')
  }
  const setDiscount = (i, v) => set('discount_authorizations',
    form.discount_authorizations.map((d, idx) => idx === i ? { ...d, max_discount_pct: v } : d))
  const delDiscount = i => set('discount_authorizations', form.discount_authorizations.filter((_, idx) => idx !== i))

  const assignedProducts = products.filter(p => assignedSet.has(pid(p)))
  const filteredProducts = (prodQuery.trim()
    ? products.filter(p => [p.name, p.code].some(v => (v || '').toLowerCase().includes(prodQuery.toLowerCase())))
    : products).slice(0, 50)
  const filteredDiscProducts = (discQuery.trim()
    ? products.filter(p => [p.name, p.code].some(v => (v || '').toLowerCase().includes(discQuery.toLowerCase())))
    : []).slice(0, 20)

  const validate = () => {
    const e = {}
    if (!form.name.trim())             e.name   = 'Full name is required.'
    if (!/^\d{10}$/.test(form.mobile)) e.mobile = 'Enter a valid 10-digit mobile number.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      mobile: form.mobile,
      email: form.email.trim().toLowerCase(),
      designation: form.designation.trim(),
      department: form.department.trim(),
      branch: form.branch.trim(),
      staff_app_access: form.staff_app_access,
      fixed_salary: Number(form.fixed_salary) || 0,
      sales_target: Number(form.sales_target) || 0,
      incentive_type: form.incentive_type,
      incentive_value: Number(form.incentive_value) || 0,
      sales_percentage: Number(form.sales_percentage) || 0,
      discount_access: !!form.discount_access,
      max_discount_percent: Number(form.max_discount_percent) || 0,
      salary_notes: form.salary_notes.trim(),
      incentive_slabs: form.incentive_slabs
        .map(s => ({ sales_amount: Number(s.sales_amount) || 0, incentive_pct: Number(s.incentive_pct) || 0 }))
        .filter(s => s.sales_amount > 0 || s.incentive_pct > 0),
      discount_authorizations: form.discount_authorizations
        .map(d => ({ product_id: d.product_id, product_name: d.product_name, product_code: d.product_code, max_discount_pct: Number(d.max_discount_pct) || 0 })),
      assigned_products: form.assigned_products,
    }
    try {
      if (editStaff) await staffManagementApi.update(editStaff._id, payload)
      else           await staffManagementApi.create(payload)
      showToast(`${form.name} ${editStaff ? 'updated' : 'added'}. They log in to the Staff App using ${form.mobile}.`)
      onSaved()
      onClose()
    } catch (err) {
      setErrors(e => ({ ...e, _global: err?.response?.data?.message || 'Failed to save staff member.' }))
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20, backdropFilter: 'blur(2px)' }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 640, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>

        {/* Header */}
        <div style={{ padding: '20px 26px', borderBottom: '1px solid #E8EDF3', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, background: '#fff', zIndex: 2 }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: 'linear-gradient(135deg,#FFF3EC,#FFE3D0)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <UserPlus size={20} color="#FD5C02" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#01152D' }}>{editStaff ? 'Edit Staff Member' : 'Add New Staff Member'}</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Full profile — access, salary, incentive, discounts &amp; assigned items</div>
          </div>
          <button onClick={onClose} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', cursor: 'pointer', color: '#94A3B8', borderRadius: 8, padding: 6, display: 'flex' }}><X size={18} /></button>
        </div>

        <div style={{ padding: '20px 26px' }}>
          {errors._global && (
            <div style={{ marginBottom: 16, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 8 }}>
              <XCircle size={15} style={{ flexShrink: 0 }} />{errors._global}
            </div>
          )}

          {/* ── Personal ── */}
          <SectionLabel icon={<User size={13} />} text="Personal & Login Details" />
          <FieldInput label="Full Name *" name="name" value={form.name} onChange={set} placeholder="e.g. Rahul Sharma" icon={<User size={15} />} error={errors.name} />
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
              Mobile Number *
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0' }}>Login via OTP</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', border: `1.5px solid ${errors.mobile ? '#EF4444' : '#E2E8F0'}`, borderRadius: 9, background: '#FAFBFC', overflow: 'hidden' }}>
              <span style={{ paddingLeft: 12, fontSize: 13, fontWeight: 700, color: '#64748B' }}>+91</span>
              <input value={form.mobile} maxLength={10} inputMode="numeric"
                onChange={e => set('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit mobile number"
                style={{ flex: 1, padding: '10px 12px', border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: '#01152D' }} />
              {form.mobile.length === 10 && <CheckCircle size={16} color="#059669" style={{ marginRight: 12 }} />}
            </div>
            {errors.mobile && <div style={{ fontSize: 11, color: '#EF4444', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}><XCircle size={11} />{errors.mobile}</div>}
          </div>
          <FieldInput label="Email" name="email" value={form.email} onChange={set} placeholder="rahul@company.com" type="email" icon={<Mail size={15} />} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FieldInput label="Designation / Role" name="designation" value={form.designation} onChange={set} placeholder="e.g. Sales Executive" />
            <FieldInput label="Department" name="department" value={form.department} onChange={set} placeholder="e.g. Sales" />
          </div>

          {/* ── Module access ── */}
          <SectionLabel icon={<Shield size={13} />} text="Staff App Access" />
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 10 }}>Tick the modules this staff member can see in the app. Leave all unticked for no module access.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginBottom: 8 }}>
            {STAFF_APP_MODULES.map(m => {
              const on = form.staff_app_access.includes(m.key)
              return (
                <button key={m.key} type="button" onClick={() => toggleModule(m.key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', borderRadius: 9, border: `1.5px solid ${on ? '#FD5C02' : '#E2E8F0'}`, background: on ? '#FFF3EC' : '#FAFBFC', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: on ? '#FD5C02' : '#64748B', textAlign: 'left' }}>
                  <span style={{ width: 16, height: 16, borderRadius: 5, border: `1.5px solid ${on ? '#FD5C02' : '#CBD5E1'}`, background: on ? '#FD5C02' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {on && <Check size={11} color="#fff" />}
                  </span>
                  {m.label}
                </button>
              )
            })}
          </div>

          {/* ── Salary ── */}
          <SectionLabel icon={<Wallet size={13} />} text="Salary & Incentive" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FieldInput label="Fixed Monthly Salary (₹)" name="fixed_salary" value={form.fixed_salary} onChange={set} placeholder="0" type="number" icon={<Wallet size={15} />} />
            <FieldInput label="Monthly Sales Target (₹)" name="sales_target" value={form.sales_target} onChange={set} placeholder="0" type="number" icon={<Target size={15} />} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Incentive Type</label>
              <select value={form.incentive_type} onChange={e => set('incentive_type', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2E8F0', borderRadius: 9, background: '#FAFBFC', fontSize: 13, color: '#01152D', outline: 'none' }}>
                <option value="none">None</option>
                <option value="fixed">Fixed amount</option>
                <option value="percentage">Percentage of sales</option>
              </select>
            </div>
            <FieldInput label={form.incentive_type === 'percentage' ? 'Incentive %' : 'Incentive Value (₹)'} name="incentive_value" value={form.incentive_value} onChange={set} placeholder="0" type="number" icon={<Percent size={15} />} />
          </div>
          <FieldInput label="Sales Commission % (optional)" name="sales_percentage" value={form.sales_percentage} onChange={set} placeholder="e.g. 2" type="number" hint="Flat % of each sale, if used instead of slabs." icon={<Percent size={15} />} />

          {/* Incentive slabs */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Incentive Slabs</span>
              <button type="button" onClick={addSlab} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 8, border: '1.5px solid #FED7B8', background: '#FFF3EC', color: '#FD5C02', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                <Plus size={13} /> Add Slab
              </button>
            </div>
            {form.incentive_slabs.length === 0 && <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>No slabs. Add one like "Sales ≥ ₹1,00,000 → 2% incentive".</div>}
            {form.incentive_slabs.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <input type="number" value={s.sales_amount} placeholder="Sales ≥ ₹"
                  onChange={e => setSlab(i, 'sales_amount', e.target.value)}
                  style={{ flex: 1, padding: '9px 11px', border: '1.5px solid #E2E8F0', borderRadius: 8, background: '#FAFBFC', fontSize: 13, outline: 'none' }} />
                <input type="number" value={s.incentive_pct} placeholder="Incentive %"
                  onChange={e => setSlab(i, 'incentive_pct', e.target.value)}
                  style={{ width: 120, padding: '9px 11px', border: '1.5px solid #E2E8F0', borderRadius: 8, background: '#FAFBFC', fontSize: 13, outline: 'none' }} />
                <button type="button" onClick={() => delSlab(i)} style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: 8, cursor: 'pointer', color: '#EF4444', display: 'flex' }}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>

          {/* ── Discount access ── */}
          <SectionLabel icon={<Tag size={13} />} text="Discount Authorisation" />
          <button type="button" onClick={() => set('discount_access', !form.discount_access)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 14px', borderRadius: 9, border: `1.5px solid ${form.discount_access ? '#FD5C02' : '#E2E8F0'}`, background: form.discount_access ? '#FFF3EC' : '#FAFBFC', cursor: 'pointer', marginBottom: 12 }}>
            <span style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${form.discount_access ? '#FD5C02' : '#CBD5E1'}`, background: form.discount_access ? '#FD5C02' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {form.discount_access && <Check size={12} color="#fff" />}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: form.discount_access ? '#FD5C02' : '#64748B' }}>Allow this staff to give discounts</span>
          </button>
          {form.discount_access && (
            <>
              <FieldInput label="Default Max Discount %" name="max_discount_percent" value={form.max_discount_percent} onChange={set} placeholder="e.g. 10" type="number" hint="Applies to items without a specific limit below." icon={<Percent size={15} />} />

              {/* Per-item discount caps */}
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Item-wise Discount Limits</span>
                <div style={{ position: 'relative', marginTop: 8 }}>
                  <input value={discQuery} onChange={e => setDiscQuery(e.target.value)} placeholder="Search a product to add a discount limit…"
                    style={{ width: '100%', padding: '9px 11px', border: '1.5px solid #E2E8F0', borderRadius: 8, background: '#FAFBFC', fontSize: 13, outline: 'none' }} />
                  {filteredDiscProducts.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 5, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, marginTop: 3, maxHeight: 180, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,.12)' }}>
                      {filteredDiscProducts.map(p => (
                        <div key={pid(p)} onClick={() => addDiscount(p)} style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid #F1F5F9' }}>
                          {p.name} {p.code ? <span style={{ color: '#94A3B8', fontSize: 11 }}>· {p.code}</span> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {form.discount_authorizations.map((d, i) => (
                  <div key={d.product_id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                    <div style={{ flex: 1, fontSize: 12, color: '#01152D', fontWeight: 600 }}>{d.product_name}{d.product_code ? <span style={{ color: '#94A3B8', fontWeight: 400 }}> · {d.product_code}</span> : null}</div>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #E2E8F0', borderRadius: 8, background: '#FAFBFC', overflow: 'hidden', width: 110 }}>
                      <input type="number" value={d.max_discount_pct} placeholder="Max %" onChange={e => setDiscount(i, e.target.value)}
                        style={{ flex: 1, padding: '8px 10px', border: 'none', background: 'transparent', outline: 'none', fontSize: 13 }} />
                      <span style={{ paddingRight: 10, color: '#94A3B8', fontSize: 13 }}>%</span>
                    </div>
                    <button type="button" onClick={() => delDiscount(i)} style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: 8, cursor: 'pointer', color: '#EF4444', display: 'flex' }}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Assigned items ── */}
          <SectionLabel icon={<Package size={13} />} text="Assigned Items (what they can sell)" />
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 10 }}>
            The staff member will see <strong>only</strong> these items in the app. If none are assigned, they see no items.
          </div>
          <input value={prodQuery} onChange={e => setProdQuery(e.target.value)} placeholder="Search items to assign…"
            style={{ width: '100%', padding: '9px 11px', border: '1.5px solid #E2E8F0', borderRadius: 8, background: '#FAFBFC', fontSize: 13, outline: 'none', marginBottom: 8 }} />
          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700, marginBottom: 6 }}>{assignedProducts.length} item(s) assigned</div>
          <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #E8EDF3', borderRadius: 9 }}>
            {filteredProducts.length === 0 && <div style={{ padding: 16, fontSize: 12, color: '#94A3B8', textAlign: 'center' }}>No products found.</div>}
            {filteredProducts.map(p => {
              const on = assignedSet.has(pid(p))
              return (
                <div key={pid(p)} onClick={() => toggleAssigned(pid(p))}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: '1px solid #F1F5F9', cursor: 'pointer', background: on ? '#FFF3EC' : '#fff' }}>
                  <span style={{ width: 16, height: 16, borderRadius: 5, border: `1.5px solid ${on ? '#FD5C02' : '#CBD5E1'}`, background: on ? '#FD5C02' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {on && <Check size={11} color="#fff" />}
                  </span>
                  <span style={{ flex: 1, fontSize: 13, color: '#01152D', fontWeight: on ? 700 : 500 }}>{p.name}</span>
                  {p.code && <span style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{p.code}</span>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 26px 22px', borderTop: '1px solid #E8EDF3', display: 'flex', justifyContent: 'flex-end', gap: 10, position: 'sticky', bottom: 0, background: '#fff' }}>
          <button onClick={onClose} disabled={saving}
            style={{ padding: '10px 20px', borderRadius: 9, border: '1.5px solid #E2E8F0', background: '#F8FAFC', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '10px 24px', borderRadius: 9, border: 'none', background: saving ? '#FEB895' : 'linear-gradient(135deg,#FD5C02,#FE7722)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
            <Check size={14} />{saving ? 'Saving…' : editStaff ? 'Save Changes' : 'Add Staff Member'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
export default function StaffManagement() {
  const [tab, setTab]         = useState('list')
  const [staff, setStaff]     = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [roleFilter, setRoleFilter] = useState('All')
  const [page, setPage]       = useState(1)
  const [toast, setToast]     = useState({ msg: '', ok: true })

  // modal state
  const [showAddModal, setShowAddModal]   = useState(false)
  const [form, setForm]                   = useState(EMPTY)
  const [errors, setErrors]               = useState({})
  const [saving, setSaving]               = useState(false)
  const [showPwd, setShowPwd]             = useState(false)

  // Full staff modal (rich form — access, salary, incentive, discounts, items)
  const [fullModal, setFullModal]         = useState(null) // null | 'new' | staffObject

  const [deleteTarget, setDeleteTarget]   = useState(null)
  const [deleting, setDeleting]           = useState(false)
  const [resetTarget, setResetTarget]     = useState(null)
  const [newPwd, setNewPwd]               = useState('')
  const [showNewPwd, setShowNewPwd]       = useState(false)
  const [resetting, setResetting]         = useState(false)

  // collections
  const [collections, setCollections]     = useState([])
  const [collLoading, setCollLoading]     = useState(false)
  const [collError, setCollError]         = useState('')
  const [collFilter, setCollFilter]       = useState('pending')
  const [busyId, setBusyId]               = useState(null)

  // business staff (Employee records from Wholesaler/Retailer apps, all companies)
  const [bizStaff, setBizStaff]           = useState([])
  const [bizLoading, setBizLoading]       = useState(false)

  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast({ msg: '', ok: true }), 3500) }

  const setField = (name, val) => { setForm(f => ({ ...f, [name]: val })); setErrors(e => ({ ...e, [name]: '' })) }

  // ── Load staff (Staff App employees — full profile records) ──
  const loadStaff = useCallback(async () => {
    setLoading(true)
    try {
      const res = await staffManagementApi.list({ limit: 200 })
      const all = res?.data?.staff || res?.staff || []
      setStaff(Array.isArray(all) ? all : [])
    } catch { showToast('Failed to load staff.', false) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadStaff() }, [loadStaff])

  // ── Load business staff (all companies, from Wholesaler/Retailer apps) ──
  const loadBizStaff = useCallback(async () => {
    setBizLoading(true)
    try {
      const res = await hrApi.listAllEmployees()
      setBizStaff(res?.employees || res?.data?.employees || [])
    } catch {
      setBizStaff([])
    } finally {
      setBizLoading(false)
    }
  }, [])

  useEffect(() => { if (tab === 'business') loadBizStaff() }, [tab, loadBizStaff])

  // ── Load collections ───────────────────────────────────────
  const loadCollections = useCallback(async () => {
    setCollLoading(true); setCollError('')
    try {
      const res = await invoiceApi.listPendingVerification()
      setCollections(res?.data?.collections || res?.collections || [])
    } catch { setCollError('Could not load collections.') }
    finally { setCollLoading(false) }
  }, [])

  useEffect(() => { if (tab === 'collections') loadCollections() }, [tab, loadCollections])

  // ── Add staff ──────────────────────────────────────────────
  const validateForm = () => {
    const e = {}
    if (!form.name.trim())             e.name     = 'Full name is required.'
    if (!/^\d{10}$/.test(form.mobile)) e.mobile   = 'Enter a valid 10-digit mobile number.'
    if (!form.email.trim())            e.email    = 'Email address is required.'
    if (form.password.length < 8)      e.password = 'Password must be at least 8 characters.'
    if (!STAFF_ROLES.includes(form.role)) e.role  = 'Select a valid role.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleAdd = async () => {
    if (!validateForm()) return
    setSaving(true)
    try {
      await userApi.create({ ...form, email: form.email.toLowerCase().trim() })
      showToast(`${form.name} added. They can log in to the Staff App using ${form.mobile}.`)
      setForm(EMPTY); setErrors({}); setShowAddModal(false)
      loadStaff()
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to add staff member.'
      setErrors(e => ({ ...e, _global: msg }))
    } finally { setSaving(false) }
  }

  // ── Delete ────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await staffManagementApi.delete(deleteTarget._id)
      showToast(`${deleteTarget.name} removed.`)
      setDeleteTarget(null); loadStaff()
    } catch (err) { showToast(err?.response?.data?.message || 'Delete failed.', false) }
    finally { setDeleting(false) }
  }

  // ── Reset password ────────────────────────────────────────
  const handleReset = async () => {
    if (!resetTarget || newPwd.length < 8) return
    setResetting(true)
    try {
      await userApi.resetPassword(resetTarget._id, newPwd)
      showToast(`Password reset for ${resetTarget.name}.`)
      setResetTarget(null); setNewPwd('')
    } catch (err) { showToast(err?.response?.data?.message || 'Reset failed.', false) }
    finally { setResetting(false) }
  }

  // ── Toggle active ─────────────────────────────────────────
  const handleToggle = async (member) => {
    try {
      await staffManagementApi.toggleActive(member._id)
      showToast(`${member.name} ${!member.is_active ? 'activated' : 'deactivated'}.`)
      loadStaff()
    } catch { showToast('Update failed.', false) }
  }

  // ── Collections ───────────────────────────────────────────
  const handleSendOtp = async (invoiceId, paymentId) => {
    setBusyId(`${invoiceId}-${paymentId}`)
    try {
      const res = await invoiceApi.sendVerificationOtp(invoiceId, paymentId)
      if (res?.success) {
        showToast(`OTP sent to ${res.data?.staff || 'staff member'}`)
        setCollections(prev => prev.map(e =>
          e.invoice_id === invoiceId && e.payment_id === paymentId
            ? { ...e, verification_status: 'OTP Sent', otp_sent_at: new Date().toISOString() } : e
        ))
      } else showToast(res?.message || 'Failed to send OTP.', false)
    } catch { showToast('Network error.', false) }
    finally { setBusyId(null) }
  }

  const handleVerify = async (invoiceId, paymentId, otp) => {
    setBusyId(`${invoiceId}-${paymentId}`)
    try {
      const res = await invoiceApi.verifyPayment(invoiceId, paymentId, otp)
      if (res?.success) {
        showToast(`Payment of ${fmt(res.data?.payment_amount)} verified ✓`)
        setCollections(prev => prev.map(e =>
          e.invoice_id === invoiceId && e.payment_id === paymentId
            ? { ...e, verification_status: 'Verified', verified_by_name: res.data?.verified_by || '', verified_at: res.data?.verified_at || new Date().toISOString() } : e
        ))
        return null
      }
      return res?.message || 'Verification failed.'
    } catch { return 'Network error.' }
    finally { setBusyId(null) }
  }

  // ── Filtered lists ────────────────────────────────────────
  const q = search.trim().toLowerCase()
  const filtered = staff.filter(s => {
    const roleLabel = s.role_access || s.designation || ''
    const matchesRole = roleFilter === 'All' || roleLabel === roleFilter
    const matchesQ = !q || [s.name, s.mobile, s.email, roleLabel].some(v => (v || '').toLowerCase().includes(q))
    return matchesRole && matchesQ
  })

  // ── Pagination (10 rows per page) ──────────────────────────
  const total       = filtered.length
  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage    = Math.min(page, totalPages)
  const paged       = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const pendingColl  = collections.filter(c => c.verification_status === 'Pending').length
  const otpColl      = collections.filter(c => c.verification_status === 'OTP Sent').length
  const verifiedColl = collections.filter(c => c.verification_status === 'Verified').length
  const unverifiedAmt = collections.filter(c => c.verification_status !== 'Verified').reduce((s, c) => s + (c.amount || 0), 0)
  const visibleColl  = collFilter === 'pending'
    ? collections.filter(c => c.verification_status !== 'Verified')
    : collections

  // ── Stat cards ────────────────────────────────────────────
  const STAT_STYLES = {
    Total:    { bg: '#EFF6FF', iconBg: '#DBEAFE', iconColor: '#2563EB', textColor: '#1D4ED8', borderColor: '#BFDBFE' },
    Active:   { bg: '#ECFDF5', iconBg: '#D1FAE5', iconColor: '#059669', textColor: '#047857', borderColor: '#A7F3D0' },
    Inactive: { bg: '#FEF2F2', iconBg: '#FEE2E2', iconColor: '#DC2626', textColor: '#B91C1C', borderColor: '#FECACA' },
    Pending:  { bg: '#FFFBEB', iconBg: '#FEF3C7', iconColor: '#D97706', textColor: '#92400E', borderColor: '#FDE68A' },
  }
  const stats = [
    { key: 'Total',    label: 'Total Staff',    value: staff.length,                           icon: Users },
    { key: 'Active',   label: 'Active',         value: staff.filter(s => s.is_active).length,  icon: CheckCircle },
    { key: 'Inactive', label: 'Inactive',       value: staff.filter(s => !s.is_active).length, icon: XCircle },
    { key: 'Pending',  label: 'Pending Verify', value: pendingColl + otpColl,                  icon: ShieldCheck, noFilter: true },
  ]

  const TABS = [
    { key: 'list',        label: `Staff List (${staff.length})` },
    { key: 'business',    label: `Business Staff (${bizStaff.length})` },
    { key: 'collections', label: `Collections (${pendingColl + otpColl} pending)` },
  ]

  return (
    <div>
      {/* ── Toast ── */}
      {toast.msg && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, background: toast.ok ? '#059669' : '#DC2626', color: '#fff', padding: '11px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, boxShadow: '0 4px 20px rgba(0,0,0,.2)', maxWidth: 420 }}>
          {toast.msg}
        </div>
      )}

      {/* ── Breadcrumb ── */}
      {/* <div className="breadcrumb">
        <span>Staff Management</span><span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-active">Staff Members</span>
      </div> */}

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <div className="page-title">Staff Management</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={loadStaff} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', background: '#fff', color: '#64748B', border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} />Refresh
          </button>
          <button onClick={() => setFullModal('new')} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: 'linear-gradient(135deg,#FD5C02,#FE7722)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(253,92,2,0.3)', whiteSpace: 'nowrap' }}>
            <UserPlus size={15} /> Add Staff
          </button>
        </div>
      </div>

      {/* ── How it works banner ── */}
      {/* <div style={{ background: 'linear-gradient(135deg,#FFF7ED,#FFF3EC)', border: '1px solid #FED7B8', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#FD5C02,#FE7722)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Phone size={17} color="#fff" />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#01152D', marginBottom: 5 }}>How Staff Login Works</div>
          <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.7, display: 'flex', flexWrap: 'wrap', gap: '2px 20px' }}>
            <span>① Add staff with name, mobile, role &amp; password.</span>
            <span>② Staff opens the <strong>EzyEnquiry Staff App</strong>.</span>
            <span>③ They enter their <strong>mobile number</strong> → receive OTP → logged in.</span>
            <span>④ App shows only what their role permits.</span>
          </div>
        </div>
      </div> */}

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {stats.map(s => {
          const st   = STAT_STYLES[s.key]
          const Icon = s.icon
          return (
            <div key={s.key} style={{ background: st.bg, border: `1.5px solid ${st.borderColor}`, borderRadius: 10, padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 11, boxShadow: 'var(--shadow)' }}>
              <div style={{ width: 40, height: 40, borderRadius: 9, flexShrink: 0, background: st.iconBg, border: `1px solid ${st.borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

      {/* ── Search + Role filter ── */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, boxShadow: 'var(--shadow)', flexWrap: 'wrap' }}>
        <Search size={14} color="#94A3B8" style={{ flexShrink: 0 }} />
        <input
          value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Search by name, mobile, email or role…"
          style={{ flex: 1, minWidth: 160, border: 'none', outline: 'none', fontSize: 13, color: '#01152D', background: 'transparent' }}
        />
        {search && <button onClick={() => { setSearch(''); setPage(1) }} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', display: 'flex' }}><X size={13} /></button>}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
          {['All', ...STAFF_ROLES].map(r => {
            const active = roleFilter === r
            const rm = ROLE_META[r]
            return (
              <button key={r} onClick={() => { setRoleFilter(r); setPage(1) }}
                style={{ padding: '4px 11px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${active ? (rm?.color || '#2563EB') : (rm?.border || '#E2E8F0')}`, background: active ? (rm?.color || '#2563EB') : (rm?.bg || '#F4F6F9'), color: active ? '#fff' : (rm?.color || '#64748B'), transition: 'all .13s' }}>
                {r}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        {TABS.map(t => (
          <button key={t.key} className={`tab-btn${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          STAFF LIST TAB
      ══════════════════════════════════════════════════════ */}
      {tab === 'list' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Staff Members ({filtered.length})</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Name</th><th>Mobile (App Login)</th>
                  <th>Email</th><th>Role</th><th>Status</th><th>Last Login</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Loading staff…</td></tr>}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48 }}>
                    <UserPlus size={36} color="#E2E8F0" style={{ marginBottom: 10, display: 'block', margin: '0 auto 10px' }} />
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#64748B', marginBottom: 4 }}>
                      {staff.length === 0 ? 'No staff added yet' : 'No results match your search'}
                    </div>
                    <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 16 }}>
                      {staff.length === 0 ? 'Click "Add Staff" to get started' : 'Try a different filter'}
                    </div>
                    {staff.length === 0 && (
                      <button onClick={() => setFullModal('new')}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: 'linear-gradient(135deg,#FD5C02,#FE7722)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                        <UserPlus size={14} /> Add First Staff Member
                      </button>
                    )}
                  </td></tr>
                )}
                {!loading && paged.map((s, i) => {
                  const rm = ROLE_META[s.role] || {}
                  const roleLabel = s.role_access || s.designation || s.role || '—'
                  return (
                    <tr key={s._id}>
                      <td style={{ color: '#94A3B8', fontSize: 12 }}>{(safePage - 1) * PAGE_SIZE + i + 1}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg,#FFF3EC,#FFE3D0)', border: '1px solid #FED7B8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14, fontWeight: 800, color: '#FD5C02' }}>
                            {(s.name || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: '#01152D' }}>{s.name}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Phone size={12} color="#FD5C02" />
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13 }}>{s.mobile || '—'}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: '#64748B' }}>{s.email || '—'}</td>
                      <td>
                        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: rm.bg, color: rm.color, border: `1px solid ${rm.border}` }}>
                          {roleLabel}
                        </span>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: s.is_active ? '#ECFDF5' : '#FEF2F2', color: s.is_active ? '#059669' : '#DC2626', border: `1px solid ${s.is_active ? '#A7F3D0' : '#FECACA'}` }}>
                          {s.is_active ? <CheckCircle size={9} /> : <XCircle size={9} />}{s.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: '#94A3B8', whiteSpace: 'nowrap' }}>{fmtDt(s.last_login)}</td>
                      <td>
                        <div className="table-actions" style={{ justifyContent: 'center' }}>
                          <button className="btn btn-ghost btn-xs" title="Edit" onClick={() => setFullModal(s)}
                            style={{ color: '#FD5C02' }}>
                            <User size={13} />
                          </button>
                          <button className="btn btn-ghost btn-xs" title={s.is_active ? 'Deactivate' : 'Activate'} onClick={() => handleToggle(s)}
                            style={{ color: s.is_active ? '#DC2626' : '#059669' }}>
                            {s.is_active ? <XCircle size={13} /> : <CheckCircle size={13} />}
                          </button>
                          <button className="btn btn-ghost btn-xs" title="Delete" onClick={() => setDeleteTarget(s)}
                            style={{ color: '#EF4444' }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
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

      {/* ══════════════════════════════════════════════════════
          BUSINESS STAFF TAB — staff added from Wholesaler/Retailer apps,
          grouped by business type → company.
      ══════════════════════════════════════════════════════ */}
      {tab === 'business' && (
        <BusinessStaffView staff={bizStaff} loading={bizLoading} search={search} onRefresh={loadBizStaff} />
      )}

      {/* ══════════════════════════════════════════════════════
          COLLECTIONS TAB
      ══════════════════════════════════════════════════════ */}
      {tab === 'collections' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 18 }}>
            {[
              { label: 'Pending',      val: pendingColl,          color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
              { label: 'OTP Sent',     val: otpColl,              color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
              { label: 'Verified',     val: verifiedColl,         color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
              { label: 'Unverified ₹',val: fmt(unverifiedAmt),   color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
            ].map(({ label, val, color, bg, border }) => (
              <div key={label} style={{ background: bg, borderRadius: 10, padding: '12px 16px', border: `1.5px solid ${border}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color }}>{val}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, flex: 1, color: '#01152D' }}>Collection Verification</h3>
            <div style={{ display: 'flex', gap: 6 }}>
              {['pending', 'all'].map(f => (
                <button key={f} onClick={() => setCollFilter(f)}
                  style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${collFilter === f ? '#FD5C02' : '#E2E8F0'}`, background: collFilter === f ? '#FD5C02' : '#fff', color: collFilter === f ? '#fff' : '#64748B' }}>
                  {f === 'pending' ? `Pending (${pendingColl + otpColl})` : 'All'}
                </button>
              ))}
            </div>
            <button onClick={loadCollections} disabled={collLoading}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#fff', color: '#64748B', border: '1.5px solid #E2E8F0', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <RefreshCw size={13} style={{ animation: collLoading ? 'spin 1s linear infinite' : 'none' }} />Refresh
            </button>
          </div>

          {collError && (
            <div style={{ marginBottom: 14, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={15} />{collError}
            </div>
          )}

          {collLoading ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#94A3B8' }}>Loading collections…</div>
          ) : visibleColl.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '56px 20px', background: '#fff', borderRadius: 12, border: '1px dashed #E2E8F0' }}>
              <CheckCircle size={40} color="#A7F3D0" style={{ marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
              <div style={{ fontWeight: 700, fontSize: 15, color: '#374151' }}>{collFilter === 'pending' ? 'All collections verified!' : 'No collections yet.'}</div>
            </div>
          ) : (
            visibleColl.map(entry => (
              <CollectionCard
                key={`${entry.invoice_id}-${entry.payment_id}`}
                entry={entry} busyId={busyId}
                onSendOtp={handleSendOtp} onVerify={handleVerify}
              />
            ))
          )}
        </>
      )}

      {/* ════ ADD STAFF MODAL ═════════════════════════════════ */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20, backdropFilter: 'blur(2px)' }}>
          <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>

            {/* Modal header */}
            <div style={{ padding: '20px 26px', borderBottom: '1px solid #E8EDF3', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 11, background: 'linear-gradient(135deg,#FFF3EC,#FFE3D0)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <UserPlus size={20} color="#FD5C02" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#01152D' }}>Add New Staff Member</div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Staff will log in to the Staff App using their mobile number</div>
              </div>
              <button onClick={() => setShowAddModal(false)} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', cursor: 'pointer', color: '#94A3B8', borderRadius: 8, padding: 6, display: 'flex' }}>
                <X size={18} />
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: '20px 26px' }}>
              {errors._global && (
                <div style={{ marginBottom: 16, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <XCircle size={15} style={{ flexShrink: 0 }} />{errors._global}
                </div>
              )}

              <SectionLabel icon={<User size={13} />} text="Personal Details" />
              <FieldInput label="Full Name *" name="name" value={form.name} onChange={setField}
                placeholder="e.g. Rahul Sharma" icon={<User size={15} />}
                error={errors.name} />

              <SectionLabel icon={<Phone size={13} />} text="Login Details" />

              {/* Mobile — highlighted with a green badge */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                  Mobile Number *
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0' }}>
                    Used to login via OTP
                  </span>
                </label>
                <div
                  style={{ display: 'flex', alignItems: 'center', border: `1.5px solid ${errors.mobile ? '#EF4444' : '#E2E8F0'}`, borderRadius: 9, background: '#FAFBFC', overflow: 'hidden' }}
                  onFocusCapture={e => { e.currentTarget.style.borderColor = '#FD5C02'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(253,92,2,0.10)'; e.currentTarget.style.background = '#fff' }}
                  onBlurCapture={e => { e.currentTarget.style.borderColor = errors.mobile ? '#EF4444' : '#E2E8F0'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = '#FAFBFC' }}
                >
                  <span style={{ paddingLeft: 12, fontSize: 13, fontWeight: 700, color: '#64748B', flexShrink: 0 }}>+91</span>
                  <input
                    value={form.mobile} maxLength={10} inputMode="numeric"
                    onChange={e => setField('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit mobile number"
                    style={{ flex: 1, padding: '10px 12px', border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: '#01152D' }}
                  />
                  {form.mobile.length === 10 && <CheckCircle size={16} color="#059669" style={{ marginRight: 12, flexShrink: 0 }} />}
                </div>
                {errors.mobile
                  ? <div style={{ fontSize: 11, color: '#EF4444', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}><XCircle size={11} />{errors.mobile}</div>
                  : <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>Staff enters this number in the app to receive a login OTP</div>}
              </div>

              <FieldInput label="Email Address *" name="email" value={form.email} onChange={setField}
                placeholder="e.g. rahul@company.com" type="email" icon={<Mail size={15} />}
                error={errors.email} />

              {/* Password */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Password * <span style={{ fontSize: 11, fontWeight: 400, color: '#94A3B8' }}>(fallback — staff primarily use OTP)</span></label>
                <div
                  style={{ display: 'flex', alignItems: 'center', border: `1.5px solid ${errors.password ? '#EF4444' : '#E2E8F0'}`, borderRadius: 9, background: '#FAFBFC', overflow: 'hidden' }}
                  onFocusCapture={e => { e.currentTarget.style.borderColor = '#FD5C02'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(253,92,2,0.10)'; e.currentTarget.style.background = '#fff' }}
                  onBlurCapture={e => { e.currentTarget.style.borderColor = errors.password ? '#EF4444' : '#E2E8F0'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = '#FAFBFC' }}
                >
                  <span style={{ display: 'flex', paddingLeft: 11, color: '#94A3B8', flexShrink: 0 }}><Lock size={15} /></span>
                  <input
                    type={showPwd ? 'text' : 'password'} value={form.password}
                    onChange={e => setField('password', e.target.value)}
                    placeholder="Min 8 characters"
                    style={{ flex: 1, padding: '10px 8px', border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: '#01152D' }}
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)}
                    style={{ padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex' }}>
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.password && <div style={{ fontSize: 11, color: '#EF4444', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}><XCircle size={11} />{errors.password}</div>}
              </div>

              <SectionLabel icon={<Shield size={13} />} text="Role & Permissions" />

              {/* Role cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
                {STAFF_ROLES.map(r => {
                  const rm = ROLE_META[r]
                  const active = form.role === r
                  return (
                    <button key={r} type="button" onClick={() => setField('role', r)}
                      style={{ padding: '11px 14px', borderRadius: 10, border: `2px solid ${active ? rm.color : rm.border}`, background: active ? rm.iconBg : rm.bg, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'all .15s', boxShadow: active ? `0 0 0 3px ${rm.border}` : 'none' }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: active ? rm.color : rm.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background .15s' }}>
                        <Layers size={14} color={active ? '#fff' : rm.color} />
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: rm.color }}>{r}</div>
                        <div style={{ fontSize: 10, color: '#94A3B8', lineHeight: 1.3 }}>
                          {r === 'Manager' && 'Full operations access'}
                          {r === 'Accountant' && 'Finance & payments'}
                          {r === 'Sales Executive' && 'CRM & orders'}
                          {r === 'Warehouse Staff' && 'Inventory & dispatch'}
                        </div>
                      </div>
                      {active && <CheckCircle size={14} color={rm.color} style={{ marginLeft: 'auto', flexShrink: 0 }} />}
                    </button>
                  )
                })}
              </div>
              {errors.role && <div style={{ fontSize: 11, color: '#EF4444', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}><XCircle size={11} />{errors.role}</div>}
            </div>

            {/* Modal footer */}
            <div style={{ padding: '14px 26px 22px', borderTop: '1px solid #E8EDF3', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowAddModal(false)} disabled={saving}
                style={{ padding: '10px 20px', borderRadius: 9, border: '1.5px solid #E2E8F0', background: '#F8FAFC', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                Cancel
              </button>
              <button onClick={handleAdd} disabled={saving}
                style={{ padding: '10px 24px', borderRadius: 9, border: 'none', background: saving ? '#FEB895' : 'linear-gradient(135deg,#FD5C02,#FE7722)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 7, boxShadow: saving ? 'none' : '0 4px 14px rgba(253,92,2,0.3)', transition: 'all .15s' }}>
                <Check size={14} />{saving ? 'Adding…' : 'Add Staff Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ FULL STAFF MODAL (add / edit) ═══════════════════ */}
      {fullModal && (
        <FullStaffModal
          editStaff={fullModal === 'new' ? null : fullModal}
          onClose={() => setFullModal(null)}
          onSaved={loadStaff}
          showToast={showToast}
        />
      )}

      {/* ════ DELETE MODAL ════════════════════════════════════ */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20, backdropFilter: 'blur(2px)' }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 400, padding: '28px 28px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Trash2 size={22} color="#EF4444" />
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#01152D', textAlign: 'center', marginBottom: 8 }}>Remove Staff Member?</div>
            <div style={{ fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 24 }}>
              <strong>{deleteTarget.name}</strong> ({deleteTarget.mobile}) will no longer be able to log in to the Staff App.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setDeleteTarget(null)} disabled={deleting}
                style={{ padding: '10px 22px', borderRadius: 9, border: '1.5px solid #E2E8F0', background: '#F8FAFC', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                style={{ padding: '10px 22px', borderRadius: 9, border: 'none', background: '#DC2626', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {deleting ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ RESET PASSWORD MODAL ════════════════════════════ */}
      {resetTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20, backdropFilter: 'blur(2px)' }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E8EDF3', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Shield size={18} color="#2563EB" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#01152D' }}>Reset Password</div>
                <div style={{ fontSize: 12, color: '#94A3B8' }}>{resetTarget.name}</div>
              </div>
              <button onClick={() => setResetTarget(null)} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', cursor: 'pointer', color: '#94A3B8', borderRadius: 8, padding: 6, display: 'flex' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <div style={{ marginBottom: 4, padding: '10px 14px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, fontSize: 12, color: '#2563EB' }}>
                Staff can still log in via mobile OTP regardless of password.
              </div>
              <div style={{ marginTop: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>New Password *</label>
                <div
                  style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #E2E8F0', borderRadius: 9, background: '#FAFBFC', overflow: 'hidden' }}
                  onFocusCapture={e => { e.currentTarget.style.borderColor = '#FD5C02'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(253,92,2,0.10)'; e.currentTarget.style.background = '#fff' }}
                  onBlurCapture={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = '#FAFBFC' }}
                >
                  <span style={{ display: 'flex', paddingLeft: 11, color: '#94A3B8', flexShrink: 0 }}><Lock size={15} /></span>
                  <input
                    type={showNewPwd ? 'text' : 'password'} value={newPwd}
                    onChange={e => setNewPwd(e.target.value)}
                    placeholder="Min 8 characters"
                    style={{ flex: 1, padding: '10px 8px', border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: '#01152D' }}
                  />
                  <button type="button" onClick={() => setShowNewPwd(v => !v)}
                    style={{ padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex' }}>
                    {showNewPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </div>
            <div style={{ padding: '12px 24px 20px', borderTop: '1px solid #E8EDF3', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setResetTarget(null)} disabled={resetting}
                style={{ padding: '9px 18px', borderRadius: 9, border: '1.5px solid #E2E8F0', background: '#F8FAFC', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleReset} disabled={resetting || newPwd.length < 8}
                style={{ padding: '9px 20px', borderRadius: 9, border: 'none', background: newPwd.length < 8 ? '#93C5FD' : '#2563EB', color: '#fff', fontSize: 13, fontWeight: 700, cursor: newPwd.length < 8 ? 'not-allowed' : 'pointer' }}>
                {resetting ? 'Resetting…' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
