import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity, AlertCircle, Building2, Calendar, CheckCircle, ChevronRight,
  Clock, CreditCard, Edit2, FileCheck2, Globe2, Key, Loader2, Lock,
  Mail, MapPin, Phone, RefreshCw, Save, Shield, Smartphone, User,
  UserCheck, X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { authApi } from '../api/authApi'
import { profileApi } from '../api/profileApi'
import { canPerform, MODULES } from '../config/permissions'

const TABS = [
  { key: 'overview', label: 'Overview', icon: User },
  { key: 'company', label: 'Company & Verification', icon: Building2 },
  { key: 'security', label: 'Security', icon: Lock },
  { key: 'activity', label: 'Activity', icon: Activity },
]

const STATUS_COLORS = {
  Approved: ['#ECFDF5', '#047857'],
  Active: ['#ECFDF5', '#047857'],
  Verified: ['#ECFDF5', '#047857'],
  Pending: ['#FFFBEB', '#B45309'],
  Rejected: ['#FEF2F2', '#B91C1C'],
  Inactive: ['#FEF2F2', '#B91C1C'],
  'Not Verified': ['#FFF7ED', '#C2410C'],
  'Not Configured': ['#FFF7ED', '#C2410C'],
  'Not Uploaded': ['#F8FAFC', '#64748B'],
}

const ACTIVITY_META = {
  profile: { icon: User, color: '#FD5C02', bg: '#FFF3EC' },
  companies: { icon: Building2, color: '#2563EB', bg: '#EFF6FF' },
  orders: { icon: FileCheck2, color: '#7C3AED', bg: '#F5F3FF' },
  subscriptions: { icon: CreditCard, color: '#047857', bg: '#ECFDF5' },
}

const panelStyle = {
  background: '#fff', borderRadius: 12, border: '1px solid var(--border)',
  boxShadow: '0 1px 4px rgba(1,21,45,0.05)', overflow: 'hidden',
}

const gridStyle = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
  gap: 16, marginTop: 20, alignItems: 'start',
}

function formatDate(value, includeTime = false) {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date)
}

function errorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback
}

function initials(name) {
  return String(name || 'User').split(/\s+/).filter(Boolean).slice(0, 2)
    .map(part => part[0]?.toUpperCase()).join('') || 'U'
}

function StatusBadge({ status }) {
  const [background, color] = STATUS_COLORS[status] || ['#F1F5F9', '#475569']
  return (
    <span style={{ padding: '4px 10px', borderRadius: 20, background, color, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {status}
    </span>
  )
}

function Panel({ icon: Icon, title, action, children }) {
  return (
    <section style={panelStyle}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Icon size={16} color="#FD5C02" />
          <span style={{ fontSize: 14, fontWeight: 700 }}>{title}</span>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function InfoRow({ icon: Icon, label, value, badge }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: '#FFF3EC', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={14} color="#FD5C02" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2, overflowWrap: 'anywhere' }}>{value || 'Not provided'}</div>
      </div>
      {badge}
    </div>
  )
}

function Modal({ title, subtitle, icon: Icon, onClose, children, footer }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 620 }} onClick={event => event.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: '#FFF3EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={16} color="#FD5C02" />
            </div>
            <div><div className="modal-title">{title}</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{subtitle}</div></div>
          </div>
          <button type="button" className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

function FormError({ message }) {
  if (!message) return null
  return <div className="alert alert-danger" style={{ marginBottom: 14 }}><AlertCircle size={14} /> {message}</div>
}

function EditProfileModal({ user, onSave, onClose }) {
  const [form, setForm] = useState({ name: user.name || '', email: user.email || '', mobile: user.mobile || '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const submit = async event => {
    event.preventDefault()
    if (!form.name.trim() || !form.email.trim()) return setError('Full name and email are required.')
    setSaving(true); setError('')
    try { await onSave(form); onClose() } catch (requestError) { setError(errorMessage(requestError, 'Unable to update profile.')) } finally { setSaving(false) }
  }
  return (
    <Modal title="Edit Account" subtitle="Update your personal and login contact details" icon={Edit2} onClose={onClose}
      footer={<><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button form="profile-edit-form" className="btn btn-primary" disabled={saving}>{saving ? <Loader2 className="spin" size={14} /> : <Save size={14} />} Save Changes</button></>}>
      <form id="profile-edit-form" onSubmit={submit}>
        <FormError message={error} />
        <div className="form-group"><label className="form-label">Full Name *</label><input className="form-control" value={form.name} onChange={event => set('name', event.target.value)} /></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Email Address *</label><input type="email" className="form-control" value={form.email} onChange={event => set('email', event.target.value)} /></div>
          <div className="form-group"><label className="form-label">Mobile Number</label><input className="form-control" value={form.mobile} onChange={event => set('mobile', event.target.value)} placeholder="+919876543210" /></div>
        </div>
        <div className="alert alert-warning"><AlertCircle size={14} /><span>Changing email or mobile resets that contact’s verification status. Verify it again from Security.</span></div>
      </form>
    </Modal>
  )
}

function EditCompanyModal({ company, onSave, onClose }) {
  const fields = ['name', 'owner_name', 'biz_type', 'mobile', 'email', 'gst_number', 'pan_number', 'address', 'city', 'state', 'pin_code']
  const [form, setForm] = useState(Object.fromEntries(fields.map(field => [field, company[field] || ''])))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const submit = async event => {
    event.preventDefault(); setSaving(true); setError('')
    try { await onSave(form); onClose() } catch (requestError) { setError(errorMessage(requestError, 'Unable to update company details.')) } finally { setSaving(false) }
  }
  return (
    <Modal title="Edit Company Details" subtitle="These details apply only to your own company" icon={Building2} onClose={onClose}
      footer={<><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button form="company-edit-form" className="btn btn-primary" disabled={saving}>{saving ? <Loader2 className="spin" size={14} /> : <Save size={14} />} Save Company</button></>}>
      <form id="company-edit-form" onSubmit={submit}>
        <FormError message={error} />
        <div className="form-row"><div className="form-group"><label className="form-label">Company Name *</label><input className="form-control" value={form.name} onChange={event => set('name', event.target.value)} required /></div><div className="form-group"><label className="form-label">Owner Name *</label><input className="form-control" value={form.owner_name} onChange={event => set('owner_name', event.target.value)} required /></div></div>
        <div className="form-row"><div className="form-group"><label className="form-label">Business Type</label><input className="form-control" value={form.biz_type} onChange={event => set('biz_type', event.target.value)} /></div><div className="form-group"><label className="form-label">Company Email *</label><input type="email" className="form-control" value={form.email} onChange={event => set('email', event.target.value)} required /></div></div>
        <div className="form-row"><div className="form-group"><label className="form-label">Mobile *</label><input className="form-control" value={form.mobile} onChange={event => set('mobile', event.target.value)} required /></div><div className="form-group"><label className="form-label">GST Number</label><input className="form-control" value={form.gst_number} onChange={event => set('gst_number', event.target.value)} /></div></div>
        <div className="form-row"><div className="form-group"><label className="form-label">PAN Number *</label><input className="form-control" value={form.pan_number} onChange={event => set('pan_number', event.target.value)} required /></div><div className="form-group"><label className="form-label">Pincode</label><input className="form-control" value={form.pin_code} onChange={event => set('pin_code', event.target.value)} /></div></div>
        <div className="form-group"><label className="form-label">Address</label><textarea rows={2} className="form-control" value={form.address} onChange={event => set('address', event.target.value)} /></div>
        <div className="form-row"><div className="form-group"><label className="form-label">City</label><input className="form-control" value={form.city} onChange={event => set('city', event.target.value)} /></div><div className="form-group"><label className="form-label">State</label><input className="form-control" value={form.state} onChange={event => set('state', event.target.value)} /></div></div>
      </form>
    </Modal>
  )
}

function ChangePasswordModal({ onSave, onClose }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const requirements = [
    ['8 or more characters', form.newPassword.length >= 8],
    ['Uppercase and lowercase letters', /[A-Z]/.test(form.newPassword) && /[a-z]/.test(form.newPassword)],
    ['At least one number', /\d/.test(form.newPassword)],
    ['At least one special character', /[^A-Za-z0-9]/.test(form.newPassword)],
  ]
  const submit = async event => {
    event.preventDefault()
    if (!requirements.every(([, met]) => met)) return setError('New password does not meet all security requirements.')
    if (form.newPassword !== form.confirmPassword) return setError('New password and confirmation do not match.')
    setSaving(true); setError('')
    try { await onSave(form.currentPassword, form.newPassword); onClose() } catch (requestError) { setError(errorMessage(requestError, 'Unable to change password.')) } finally { setSaving(false) }
  }
  return (
    <Modal title="Change Password" subtitle="Confirm your current password before setting a new one" icon={Key} onClose={onClose}
      footer={<><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button form="password-form" className="btn btn-primary" disabled={saving}>{saving ? <Loader2 className="spin" size={14} /> : <Key size={14} />} Update Password</button></>}>
      <form id="password-form" onSubmit={submit}>
        <FormError message={error} />
        <div className="form-group"><label className="form-label">Current Password</label><input type="password" autoComplete="current-password" className="form-control" value={form.currentPassword} onChange={event => setForm(current => ({ ...current, currentPassword: event.target.value }))} required /></div>
        <div className="form-row"><div className="form-group"><label className="form-label">New Password</label><input type="password" autoComplete="new-password" className="form-control" value={form.newPassword} onChange={event => setForm(current => ({ ...current, newPassword: event.target.value }))} required /></div><div className="form-group"><label className="form-label">Confirm Password</label><input type="password" autoComplete="new-password" className="form-control" value={form.confirmPassword} onChange={event => setForm(current => ({ ...current, confirmPassword: event.target.value }))} required /></div></div>
        <div style={{ padding: 12, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)' }}>{requirements.map(([label, met]) => <div key={label} style={{ display: 'flex', gap: 7, alignItems: 'center', color: met ? '#047857' : 'var(--text-muted)', fontSize: 12, marginBottom: 5 }}><CheckCircle size={13} /> {label}</div>)}</div>
      </form>
    </Modal>
  )
}

function VerifyContactModal({ type, target, onVerified, onClose }) {
  const [otp, setOtp] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [devOtp, setDevOtp] = useState('')
  const label = type === 'email' ? 'Email Address' : 'Mobile Number'
  const send = async () => {
    setBusy(true); setError('')
    try {
      const response = await authApi.sendOtp(target, type, `verify_${type}`)
      const payload = response?.data || response
      setDevOtp(payload?.otp || ''); setSent(true)
    } catch (requestError) { setError(errorMessage(requestError, 'Unable to send OTP.')) } finally { setBusy(false) }
  }
  const verify = async event => {
    event.preventDefault(); setBusy(true); setError('')
    try { await authApi.verifyOtp(target, otp, `verify_${type}`); await onVerified(); onClose() } catch (requestError) { setError(errorMessage(requestError, 'OTP verification failed.')) } finally { setBusy(false) }
  }
  return (
    <Modal title={`Verify ${label}`} subtitle={target} icon={type === 'email' ? Mail : Smartphone} onClose={onClose}
      footer={<><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>{!sent ? <button type="button" className="btn btn-primary" onClick={send} disabled={busy}>{busy ? <Loader2 className="spin" size={14} /> : <Mail size={14} />} Send OTP</button> : <button form="otp-form" className="btn btn-primary" disabled={busy || otp.length < 4}>{busy ? <Loader2 className="spin" size={14} /> : <CheckCircle size={14} />} Verify OTP</button>}</>}>
      <FormError message={error} />
      {!sent ? <div className="alert alert-warning"><AlertCircle size={14} /><span>An OTP will be sent to the contact shown above. Continue only if you can access it.</span></div> : <form id="otp-form" onSubmit={verify}><div className="alert alert-success"><CheckCircle size={14} /><span>OTP sent successfully.{devOtp ? ` Development OTP: ${devOtp}` : ''}</span></div><div className="form-group"><label className="form-label">Enter OTP</label><input className="form-control" inputMode="numeric" maxLength={6} value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, ''))} autoFocus /></div></form>}
    </Modal>
  )
}

function EmptyCompany({ role, onOpenCompanies }) {
  return (
    <Panel icon={Globe2} title="Platform Scope">
      <div style={{ padding: 28, textAlign: 'center' }}>
        <div style={{ width: 58, height: 58, margin: '0 auto 14px', borderRadius: 16, background: '#FFF3EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Globe2 size={26} color="#FD5C02" /></div>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>{role === 'Super Admin' ? 'Global Platform Administrator' : 'No company linked'}</div>
        <p style={{ margin: '0 auto 18px', color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6, maxWidth: 480 }}>{role === 'Super Admin' ? 'This platform-owner account operates across all companies. Company KYC and subscriptions belong to each tenant and are managed separately.' : 'Ask an administrator to link this account to the correct company.'}</p>
        {role === 'Super Admin' && <button className="btn btn-secondary" onClick={onOpenCompanies}>Open Company Management <ChevronRight size={14} /></button>}
      </div>
    </Panel>
  )
}

export default function Profile() {
  const navigate = useNavigate()
  const { user: authUser, updateCurrentUser } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modal, setModal] = useState(null)

  const loadAccount = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response = await profileApi.get()
      setAccount(response?.data || response)
    } catch (requestError) { setError(errorMessage(requestError, 'Unable to load account information.')) } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    let active = true
    profileApi.get()
      .then(response => {
        if (active) setAccount(response?.data || response)
      })
      .catch(requestError => {
        if (active) setError(errorMessage(requestError, 'Unable to load account information.'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const user = account?.user || authUser || {}
  const company = account?.company
  const access = account?.access
  const verification = account?.verification
  const canEditProfile = canPerform(authUser?.role, MODULES.PROFILE, 'edit')
  const canChangePassword = canPerform(authUser?.role, MODULES.PROFILE, 'change_password')
  const canEditCompany = Boolean(company && ['Company Owner', 'Super Admin'].includes(user.role))

  const accessCategories = useMemo(() => {
    const groups = {}
    for (const module of access?.modules || []) (groups[module.category] ||= []).push(module)
    return groups
  }, [access])

  const showNotice = message => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3500)
  }

  const saveProfile = async form => {
    const response = await profileApi.update(form)
    const updatedUser = response?.data || response
    setAccount(current => ({ ...current, user: updatedUser, verification: { ...current.verification, email: { verified: Boolean(updatedUser.email_verified_at), verified_at: updatedUser.email_verified_at }, mobile: { verified: Boolean(updatedUser.mobile_verified_at), verified_at: updatedUser.mobile_verified_at } } }))
    updateCurrentUser(updatedUser)
    showNotice('Account details updated successfully.')
  }

  const saveCompany = async form => {
    const response = await profileApi.updateCompany(form)
    const updatedCompany = response?.data || response
    setAccount(current => ({ ...current, company: updatedCompany }))
    showNotice('Company details updated successfully.')
  }

  const savePassword = async (currentPassword, newPassword) => {
    const response = await profileApi.changePassword(currentPassword, newPassword)
    const result = response?.data || response
    setAccount(current => ({ ...current, user: { ...current.user, password_changed_at: result?.password_changed_at } }))
    showNotice('Password changed successfully.')
  }

  if (loading && !account) return <div style={{ minHeight: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-muted)' }}><Loader2 className="spin" size={20} /> Loading your account…</div>

  if (error && !account) return (
    <div style={{ ...panelStyle, padding: 30, textAlign: 'center' }}><AlertCircle size={34} color="#EF4444" /><h3>Account could not be loaded</h3><p style={{ color: 'var(--text-muted)' }}>{error}</p><button className="btn btn-primary" onClick={loadAccount}><RefreshCw size={14} /> Try Again</button></div>
  )

  return (
    <div>
      {modal === 'profile' && <EditProfileModal user={user} onSave={saveProfile} onClose={() => setModal(null)} />}
      {modal === 'company' && <EditCompanyModal company={company} onSave={saveCompany} onClose={() => setModal(null)} />}
      {modal === 'password' && <ChangePasswordModal onSave={savePassword} onClose={() => setModal(null)} />}
      {modal === 'verify-email' && <VerifyContactModal type="email" target={user.email} onVerified={loadAccount} onClose={() => setModal(null)} />}
      {modal === 'verify-mobile' && <VerifyContactModal type="mobile" target={user.mobile} onVerified={loadAccount} onClose={() => setModal(null)} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div><div style={{ fontSize: 20, fontWeight: 800 }}>My Account</div><div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Identity, company verification, access, security and activity</div></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{notice && <span className="badge badge-green"><CheckCircle size={13} /> {notice}</span>}<button className="btn btn-secondary" onClick={loadAccount} disabled={loading}><RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh</button>{canEditProfile && <button className="btn btn-primary" onClick={() => setModal('profile')}><Edit2 size={14} /> Edit Account</button>}</div>
      </div>

      <section style={{ ...panelStyle, marginBottom: 6 }}>
        <div style={{ background: 'linear-gradient(120deg,#01152D 0%,#1A2D4A 45%,#FD5C02 120%)', padding: '28px 30px', color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ width: 82, height: 82, borderRadius: '50%', background: 'linear-gradient(135deg,#FD5C02,#FE8A3A)', border: '4px solid rgba(255,255,255,.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 25, fontWeight: 800 }}>{initials(user.name)}</div>
            <div style={{ flex: 1, minWidth: 220 }}><div style={{ fontSize: 24, fontWeight: 800 }}>{user.name}</div><div style={{ color: 'rgba(255,255,255,.72)', marginTop: 3 }}>{user.role} · {access?.scope}</div><div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12, fontSize: 13, color: 'rgba(255,255,255,.82)' }}><span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Mail size={13} /> {user.email}</span>{user.mobile && <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Phone size={13} /> {user.mobile}</span>}</div></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}><StatusBadge status={user.is_active ? 'Active' : 'Inactive'} /><span style={{ padding: '4px 10px', borderRadius: 20, background: 'rgba(253,92,2,.24)', color: '#FDBA8C', fontSize: 11, fontWeight: 700 }}>{user.role}</span></div>
          </div>
        </div>
        <div style={{ padding: '0 16px', display: 'flex', overflowX: 'auto' }}>{TABS.map(({ key, label, icon: Icon }) => <button key={key} onClick={() => setActiveTab(key)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '14px 16px', border: 'none', borderBottom: activeTab === key ? '2px solid #FD5C02' : '2px solid transparent', background: 'none', color: activeTab === key ? '#FD5C02' : 'var(--text-muted)', fontWeight: activeTab === key ? 700 : 500, cursor: 'pointer', whiteSpace: 'nowrap' }}><Icon size={15} /> {label}</button>)}</div>
      </section>

      {error && <div className="alert alert-danger" style={{ marginTop: 16 }}><AlertCircle size={14} /> {error}</div>}

      {activeTab === 'overview' && <div style={gridStyle}>
        <Panel icon={User} title="Personal Information" action={canEditProfile ? <button className="btn btn-secondary btn-sm" onClick={() => setModal('profile')}><Edit2 size={11} /> Edit</button> : null}>
          <InfoRow icon={User} label="Full Name" value={user.name} />
          <InfoRow icon={Mail} label="Email Address" value={user.email} badge={<StatusBadge status={verification?.email?.verified ? 'Verified' : 'Not Verified'} />} />
          <InfoRow icon={Phone} label="Mobile Number" value={user.mobile} badge={user.mobile ? <StatusBadge status={verification?.mobile?.verified ? 'Verified' : 'Not Verified'} /> : null} />
          <InfoRow icon={Calendar} label="Member Since" value={formatDate(user.created_at)} />
          <InfoRow icon={Clock} label="Last Login" value={formatDate(user.last_login, true)} />
        </Panel>
        <Panel icon={Shield} title="Role & Effective Access">
          <div style={{ padding: 20, borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {[['Role', user.role], ['Modules', `${access?.module_count || 0} / ${access?.total_modules || 0}`], ['Actions', access?.action_count || 0]].map(([label, value]) => <div key={label} style={{ textAlign: 'center', padding: '12px 8px', background: 'var(--bg)', borderRadius: 9 }}><div style={{ fontSize: 18, fontWeight: 800 }}>{value}</div><div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{label}</div></div>)}
          </div>
          <div style={{ padding: 20 }}>{Object.entries(accessCategories).map(([category, modules]) => <div key={category} style={{ marginBottom: 14 }}><div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 7 }}>{category.toUpperCase()}</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{modules.map(module => <span key={module.key} title={module.actions.map(action => action.label).join(', ')} style={{ fontSize: 11, padding: '5px 8px', borderRadius: 6, background: '#FFF3EC', color: '#C2410C', fontWeight: 600 }}>{module.label} · {module.actions.length}</span>)}</div></div>)}</div>
        </Panel>
      </div>}

      {activeTab === 'company' && <div style={gridStyle}>
        {!company ? <div style={{ gridColumn: '1 / -1' }}><EmptyCompany role={user.role} onOpenCompanies={() => navigate('/company-management/company-registration')} /></div> : <>
          <Panel icon={Building2} title="Company Details" action={canEditCompany ? <button className="btn btn-secondary btn-sm" onClick={() => setModal('company')}><Edit2 size={11} /> Edit</button> : null}>
            <InfoRow icon={Building2} label="Company" value={company.name} badge={<StatusBadge status={company.status} />} />
            <InfoRow icon={UserCheck} label="Owner" value={company.owner_name} />
            <InfoRow icon={Mail} label="Company Email" value={company.email} />
            <InfoRow icon={Phone} label="Company Mobile" value={company.mobile} />
            <InfoRow icon={FileCheck2} label="GST / PAN" value={`${company.gst_number || 'GST not provided'} · ${company.pan_number || 'PAN not provided'}`} />
            <InfoRow icon={MapPin} label="Registered Address" value={[company.address, company.city, company.state, company.pin_code].filter(Boolean).join(', ')} />
          </Panel>
          <Panel icon={FileCheck2} title="KYC & Admin Verification" action={<button className="btn btn-secondary btn-sm" onClick={() => navigate('/company-management/company-registration')}>Manage <ChevronRight size={11} /></button>}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Admin Approval</div><div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{company.status === 'Approved' ? `Approved ${formatDate(company.approved_at)}` : company.reject_reason || 'Awaiting platform review'}</div></div><StatusBadge status={company.status} /></div>
            {(company.documents || []).map(document => <div key={document.type} style={{ padding: '13px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ width: 32, height: 32, borderRadius: 8, background: document.uploaded ? '#ECFDF5' : '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FileCheck2 size={14} color={document.uploaded ? '#047857' : '#94A3B8'} /></div><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700 }}>{document.label}</div>{document.reject_reason && <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 2 }}>{document.reject_reason}</div>}</div><StatusBadge status={document.status} /></div>)}
          </Panel>
          <Panel icon={CreditCard} title="Subscription">
            <InfoRow icon={CreditCard} label="Current Plan" value={company.subscription_plan || 'Free'} badge={<StatusBadge status={account.subscription?.status || 'Active'} />} />
            <InfoRow icon={Calendar} label="Plan Period" value={account.subscription ? `${formatDate(account.subscription.starts_at)} – ${formatDate(account.subscription.expires_at)}` : 'Free plan · no billing period'} />
            <div style={{ padding: 16 }}><button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => navigate('/system/subscription')}>Open Subscription Management <ChevronRight size={14} /></button></div>
          </Panel>
        </>}
      </div>}

      {activeTab === 'security' && <div style={gridStyle}>
        <Panel icon={Lock} title="Password & Authentication">
          <div style={{ padding: 20 }}><div style={{ display: 'flex', gap: 13, alignItems: 'center', padding: 14, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)', marginBottom: 16 }}><div style={{ width: 42, height: 42, borderRadius: 10, background: user.has_password ? '#ECFDF5' : '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Shield size={18} color={user.has_password ? '#047857' : '#C2410C'} /></div><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700 }}>{user.has_password ? 'Password login enabled' : 'Password login not configured'}</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Last changed: {formatDate(user.password_changed_at)}</div></div><StatusBadge status={user.has_password ? 'Active' : 'Not Configured'} /></div><p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>Use at least 8 characters with uppercase, lowercase, a number and a special character.</p>{canChangePassword && user.has_password && <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setModal('password')}><Key size={14} /> Change Password</button>}</div>
        </Panel>
        <Panel icon={Smartphone} title="Contact Verification">
          {[{ key: 'email', label: 'Email Address', value: user.email, icon: Mail }, { key: 'mobile', label: 'Mobile Number', value: user.mobile, icon: Phone }].map(item => { const verified = verification?.[item.key]?.verified; const Icon = item.icon; return <div key={item.key} style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ width: 38, height: 38, borderRadius: 9, background: verified ? '#ECFDF5' : '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={16} color={verified ? '#047857' : '#C2410C'} /></div><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.label}</div><div style={{ fontSize: 13, fontWeight: 700, overflowWrap: 'anywhere' }}>{item.value || 'Not provided'}</div>{verified && <div style={{ fontSize: 11, color: '#047857', marginTop: 2 }}>Verified {formatDate(verification[item.key].verified_at)}</div>}</div>{item.value && (verified ? <StatusBadge status="Verified" /> : <button className="btn btn-secondary btn-sm" onClick={() => setModal(`verify-${item.key}`)}>Verify</button>)}</div> })}
          <div className="alert alert-warning" style={{ margin: 16 }}><AlertCircle size={14} /><span>Two-factor authentication and device session revocation are not enabled yet. No unsupported security status is shown here.</span></div>
        </Panel>
      </div>}

      {activeTab === 'activity' && <div style={{ marginTop: 20 }}><Panel icon={Activity} title="My Recent Activity" action={<span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Latest 20 changes</span>}>
        {account.activities?.length ? account.activities.map((log, index) => { const meta = ACTIVITY_META[log.module] || { icon: Activity, color: '#475569', bg: '#F1F5F9' }; const Icon = meta.icon; return <div key={log._id || `${log.created_at}-${index}`} style={{ display: 'flex', gap: 14, padding: '14px 20px', borderBottom: '1px solid var(--border)' }}><div style={{ width: 38, height: 38, borderRadius: 9, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={16} color={meta.color} /></div><div style={{ flex: 1, minWidth: 0 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}><div style={{ fontSize: 13, fontWeight: 700 }}>{log.action} · {(log.module || 'system').replaceAll('_', ' ')}</div><span style={{ fontSize: 11, color: 'var(--text-muted)' }}><Clock size={11} style={{ verticalAlign: -2 }} /> {formatDate(log.created_at, true)}</span></div><div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, overflowWrap: 'anywhere' }}>{log.path}{log.entity_id ? ` · ${log.entity_id}` : ''}</div></div></div> }) : <div style={{ padding: 38, textAlign: 'center', color: 'var(--text-muted)' }}><Activity size={30} style={{ marginBottom: 10 }} /><div style={{ fontWeight: 700, color: 'var(--text)' }}>No recorded changes yet</div><div style={{ fontSize: 12, marginTop: 5 }}>Successful create, update and delete actions will appear here.</div></div>}
      </Panel></div>}
    </div>
  )
}
