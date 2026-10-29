import { useState, useEffect, useCallback } from 'react'
import {
  ShieldCheck, Clock, Send, CheckCircle, XCircle,
  Phone, User, CreditCard, FileText, RefreshCw, AlertCircle,
} from 'lucide-react'
import { invoiceApi } from '../api/financeApi'

// ─── helpers ─────────────────────────────────────────────────
const fmt = n => '₹' + (parseFloat(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })
const fmtDate = d => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

const STATUS_META = {
  Pending:   { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', label: 'Pending Verification', Icon: Clock },
  'OTP Sent':{ color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', label: 'OTP Sent — Awaiting Staff', Icon: Send },
  Verified:  { color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', label: 'Verified', Icon: CheckCircle },
  Rejected:  { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', label: 'Rejected', Icon: XCircle },
}

// ─── OTP input widget ─────────────────────────────────────────
function OtpInput({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', margin: '12px 0' }}>
      {[0,1,2,3,4,5].map(i => (
        <input
          key={i}
          maxLength={1}
          value={value[i] || ''}
          onChange={e => {
            const ch = e.target.value.replace(/\D/, '')
            if (!ch) return
            const arr = value.split('')
            arr[i] = ch
            onChange(arr.join('').slice(0, 6))
            // auto-focus next
            const next = e.target.parentNode.children[i + 1]
            if (next) next.focus()
          }}
          onKeyDown={e => {
            if (e.key === 'Backspace' && !value[i]) {
              const prev = e.target.parentNode.children[i - 1]
              if (prev) prev.focus()
            }
          }}
          inputMode="numeric"
          style={{
            width: 42, height: 48, textAlign: 'center', fontSize: 20, fontWeight: 800,
            border: `2px solid ${value[i] ? 'var(--primary)' : 'var(--border)'}`,
            borderRadius: 8, outline: 'none', background: value[i] ? '#FFF3EC' : 'var(--bg)',
            color: 'var(--text)', transition: 'border-color 0.15s',
          }}
        />
      ))}
    </div>
  )
}

// ─── Collection row card ──────────────────────────────────────
function CollectionCard({ entry, onSendOtp, onVerify, busy }) {
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState('')
  const [showOtpBox, setShowOtpBox] = useState(entry.verification_status === 'OTP Sent')

  const sm = STATUS_META[entry.verification_status] || STATUS_META.Pending
  const { Icon: StatusIcon } = sm
  const isVerified = entry.verification_status === 'Verified'
  const isOtpSent  = entry.verification_status === 'OTP Sent'

  const handleSendOtp = async () => {
    await onSendOtp(entry.invoice_id, entry.payment_id)
    setShowOtpBox(true)
    setOtp('')
    setOtpError('')
  }

  const handleVerify = async () => {
    if (otp.length !== 6) { setOtpError('Enter all 6 digits'); return }
    const err = await onVerify(entry.invoice_id, entry.payment_id, otp)
    if (err) { setOtpError(err); setOtp('') }
  }

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1.5px solid ${isVerified ? '#A7F3D0' : 'var(--border)'}`,
      borderRadius: 12,
      marginBottom: 12,
      overflow: 'hidden',
      boxShadow: 'var(--shadow)',
    }}>
      {/* ── Header strip ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 16px',
        background: isVerified ? '#ECFDF5' : 'var(--bg)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
          background: sm.bg, border: `1.5px solid ${sm.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <StatusIcon size={16} color={sm.color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 13, color: 'var(--primary)' }}>
              {entry.invoice_no}
            </span>
            <span style={{
              padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700,
              background: sm.bg, color: sm.color, border: `1px solid ${sm.border}`,
            }}>
              {sm.label}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {fmtDate(entry.payment_date)}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: isVerified ? '#059669' : 'var(--primary)' }}>
            {fmt(entry.amount)}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>{entry.payment_mode}</div>
        </div>
      </div>

      {/* ── Details grid ── */}
      <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <InfoCell icon={<User size={12}/>} label="Customer" value={entry.customer_name} />
        <InfoCell icon={<Phone size={12}/>} label="Customer Mobile" value={entry.customer_phone || '—'} />
        <InfoCell icon={<FileText size={12}/>} label="Order Ref" value={entry.order_no || '—'} />
        <InfoCell icon={<User size={12}/>} label="Collected By" value={entry.received_by_name || '—'} accent />
        <InfoCell icon={<CreditCard size={12}/>} label="Reference" value={entry.reference_no || '—'} />
        <InfoCell icon={<FileText size={12}/>} label="Invoice Balance" value={fmt(entry.invoice_balance)} />
      </div>

      {/* ── Verification section ── */}
      {!isVerified && (
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border)',
          background: showOtpBox ? '#EFF6FF' : 'var(--bg)',
        }}>
          {!showOtpBox ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1, margin: 0 }}>
                Click <strong>Send OTP</strong> to send a 6-digit code to{' '}
                <strong>{entry.received_by_name || 'the staff member'}</strong>'s registered mobile.
                Ask them to read the code to you.
              </p>
              <button
                className="btn btn-primary btn-sm"
                disabled={busy}
                onClick={handleSendOtp}
                style={{ flexShrink: 0 }}>
                <Send size={13} style={{ marginRight: 5 }} />
                {busy ? 'Sending…' : 'Send OTP'}
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#2563EB', margin: '0 0 4px' }}>
                OTP sent to <strong>{entry.received_by_name}</strong>'s mobile
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 8px' }}>
                Ask the staff member to read you the 6-digit OTP from their phone
              </p>
              <OtpInput value={otp} onChange={v => { setOtp(v); setOtpError('') }} />
              {otpError && (
                <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8 }}>
                  <AlertCircle size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  {otpError}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button className="btn btn-secondary btn-sm" disabled={busy} onClick={handleSendOtp}>
                  Resend OTP
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  style={{ background: 'var(--success)' }}
                  disabled={busy || otp.length !== 6}
                  onClick={handleVerify}>
                  <ShieldCheck size={13} style={{ marginRight: 5 }} />
                  {busy ? 'Verifying…' : 'Verify & Confirm'}
                </button>
              </div>
              {isOtpSent && entry.otp_sent_at && (
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                  OTP sent at {fmtDate(entry.otp_sent_at)}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Verified footer ── */}
      {isVerified && (
        <div style={{
          padding: '8px 16px', background: '#ECFDF5',
          borderTop: '1px solid #A7F3D0',
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 12, color: '#059669', fontWeight: 600,
        }}>
          <CheckCircle size={14} />
          Verified by {entry.verified_by_name || 'Accounts'} · {fmtDate(entry.verified_at)}
        </div>
      )}
    </div>
  )
}

function InfoCell({ icon, label, value, accent }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
        {icon}{label}
      </div>
      <div style={{ fontSize: 12, fontWeight: accent ? 700 : 600, color: accent ? 'var(--primary)' : 'var(--text)', wordBreak: 'break-word' }}>
        {value || '—'}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────
export default function StaffCollections() {
  const [entries,   setEntries]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [busyId,    setBusyId]    = useState(null)   // "invoiceId-paymentId"
  const [toast,     setToast]     = useState('')
  const [filter,    setFilter]    = useState('pending') // 'pending' | 'all'

  const showToast = (msg, isErr = false) => {
    setToast(isErr ? `❌ ${msg}` : `✓ ${msg}`)
    setTimeout(() => setToast(''), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await invoiceApi.listPendingVerification()
      if (res.success) setEntries(res.data?.collections || [])
      else setError(res.message || 'Failed to load collections')
    } catch (e) {
      setError('Network error — could not load collections')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSendOtp = async (invoiceId, paymentId) => {
    const key = `${invoiceId}-${paymentId}`
    setBusyId(key)
    try {
      const res = await invoiceApi.sendVerificationOtp(invoiceId, paymentId)
      if (res.success) {
        showToast(`OTP sent to ${res.data?.staff || 'staff member'}`)
        // Update the entry status locally
        setEntries(prev => prev.map(e =>
          e.invoice_id === invoiceId && e.payment_id === paymentId
            ? { ...e, verification_status: 'OTP Sent', otp_sent_at: new Date().toISOString() }
            : e
        ))
      } else {
        showToast(res.message || 'Failed to send OTP', true)
      }
    } catch {
      showToast('Network error — could not send OTP', true)
    } finally {
      setBusyId(null)
    }
  }

  const handleVerify = async (invoiceId, paymentId, otp) => {
    const key = `${invoiceId}-${paymentId}`
    setBusyId(key)
    try {
      const res = await invoiceApi.verifyPayment(invoiceId, paymentId, otp)
      if (res.success) {
        showToast(`Payment of ${fmt(res.data?.payment_amount)} verified ✓`)
        setEntries(prev => prev.map(e =>
          e.invoice_id === invoiceId && e.payment_id === paymentId
            ? {
                ...e,
                verification_status: 'Verified',
                verified_by_name:    res.data?.verified_by || '',
                verified_at:         res.data?.verified_at || new Date().toISOString(),
              }
            : e
        ))
        return null   // no error
      } else {
        return res.message || 'Verification failed'
      }
    } catch {
      return 'Network error — could not verify'
    } finally {
      setBusyId(null)
    }
  }

  const visible = filter === 'pending'
    ? entries.filter(e => e.verification_status !== 'Verified')
    : entries

  const pendingCount  = entries.filter(e => e.verification_status === 'Pending').length
  const otpSentCount  = entries.filter(e => e.verification_status === 'OTP Sent').length
  const verifiedCount = entries.filter(e => e.verification_status === 'Verified').length
  const totalPending  = entries
    .filter(e => e.verification_status !== 'Verified')
    .reduce((s, e) => s + (e.amount || 0), 0)

  return (
    <div>
      <div className="breadcrumb">
        <span>Finance</span><span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-active">Staff Collections</span>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', top: 16, right: 16, zIndex: 9999,
          background: toast.startsWith('❌') ? 'var(--danger)' : 'var(--success)',
          color: '#fff', padding: '10px 18px', borderRadius: 10,
          fontWeight: 700, fontSize: 13, boxShadow: '0 4px 20px rgba(0,0,0,.2)',
        }}>
          {toast}
        </div>
      )}

      {/* ── Summary strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 18 }}>
        {[
          { label: 'Pending',   value: pendingCount,  color: '#D97706', bg: '#FFFBEB' },
          { label: 'OTP Sent',  value: otpSentCount,  color: '#2563EB', bg: '#EFF6FF' },
          { label: 'Verified',  value: verifiedCount, color: '#059669', bg: '#ECFDF5' },
          { label: 'Unverified Amount', value: fmt(totalPending), color: '#DC2626', bg: '#FEF2F2' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} style={{ background: bg, borderRadius: 10, padding: '12px 16px', border: `1px solid ${color}33` }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, flex: 1 }}>
          Staff Collection Verification
        </h2>
        <div style={{ display: 'flex', gap: 6 }}>
          {['pending', 'all'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
              style={{ textTransform: 'capitalize' }}>
              {f === 'pending' ? `Pending (${pendingCount + otpSentCount})` : 'All'}
            </button>
          ))}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
          <RefreshCw size={13} style={{ marginRight: 4, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="alert alert-danger" style={{ marginBottom: 14 }}>
          <AlertCircle size={16} style={{ marginRight: 8 }} />{error}
        </div>
      )}

      {/* ── List ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
          Loading collections…
        </div>
      ) : visible.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 0',
          background: 'var(--surface)', borderRadius: 12,
          border: '1px dashed var(--border)',
        }}>
          <CheckCircle size={36} color="var(--success)" style={{ marginBottom: 10 }} />
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            {filter === 'pending' ? 'All collections verified!' : 'No collections recorded yet'}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            {filter === 'pending' ? 'Switch to "All" to see verified records.' : 'Staff-recorded payments will appear here.'}
          </div>
        </div>
      ) : (
        visible.map(entry => (
          <CollectionCard
            key={`${entry.invoice_id}-${entry.payment_id}`}
            entry={entry}
            busy={busyId === `${entry.invoice_id}-${entry.payment_id}`}
            onSendOtp={handleSendOtp}
            onVerify={handleVerify}
          />
        ))
      )}
    </div>
  )
}
