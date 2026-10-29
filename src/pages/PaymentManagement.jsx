import React, { useState, useEffect, useCallback } from 'react'
import {
  Search, CreditCard, TrendingUp, TrendingDown, CheckCircle,
  RefreshCw, AlertCircle, ShieldCheck, Send, Clock, User, Phone,
} from 'lucide-react'
import { paymentApi, invoiceApi } from '../api/financeApi'

const PAYMENT_MODES = ['Cash', 'UPI', 'Bank Transfer', 'NEFT/RTGS', 'Cheque']

const fmt = n =>
  '₹' + (parseFloat(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

const fmtDate = d =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const ordinal = n => {
  const num = parseInt(n) || 0
  const s = ['th', 'st', 'nd', 'rd']
  const v = num % 100
  return num + (s[(v - 20) % 10] || s[v] || s[0])
}

const fmtDateTime = d =>
  d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

function overdueDays(dueDate) {
  if (!dueDate) return 0
  const diff = Math.floor((Date.now() - new Date(dueDate)) / 86400000)
  return diff > 0 ? diff : 0
}

function SkeletonRow({ cols }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i}>
          <div style={{ height: 14, borderRadius: 6, background: 'var(--border)', opacity: 0.6, animation: 'pulse 1.4s ease-in-out infinite' }} />
        </td>
      ))}
    </tr>
  )
}

export default function PaymentManagement() {
  // ── UI state ───────────────────────────────────────────────
  const [tab,        setTab]        = useState('receivable')
  const [showModal,  setShowModal]  = useState(null)
  const [search,     setSearch]     = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg,   setErrorMsg]   = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [pForm,      setPForm]      = useState({ amount: '', mode: 'Cash', ref: '', notes: '' })

  // ── Staff Collections state ────────────────────────────────
  const [invoiceCollections, setInvoiceCollections] = useState([])
  const [loadingInvColl,     setLoadingInvColl]     = useState(false)
  const [collFilter,         setCollFilter]         = useState('all')
  const [collStats,          setCollStats]          = useState({ pending: 0, verified: 0, total_amount: 0 })
  const [pendingVerifyCount, setPendingVerifyCount] = useState(0)
  const [verifyBusy,         setVerifyBusy]         = useState(null)
  const [otpInputs,          setOtpInputs]          = useState({})
  const [otpErrors,          setOtpErrors]          = useState({})

  // ── Receivables state ──────────────────────────────────────
  const [receivables,  setReceivables]  = useState([])
  const [rcvStatus,    setRcvStatus]    = useState('All')
  const [rcvPage,      setRcvPage]      = useState(1)
  const [rcvTotal,     setRcvTotal]     = useState(0)
  const [rcvLoading,   setRcvLoading]   = useState(false)

  // ── Payables state ─────────────────────────────────────────
  const [payables,     setPayables]     = useState([])
  const [payStatus,    setPayStatus]    = useState('All')
  const [payPage,      setPayPage]      = useState(1)
  const [payTotal,     setPayTotal]     = useState(0)
  const [payLoading,   setPayLoading]   = useState(false)

  // ── Transactions state ─────────────────────────────────────
  const [transactions, setTransactions] = useState([])
  const [txnType,      setTxnType]      = useState('All')
  const [txnPage,      setTxnPage]      = useState(1)
  const [txnTotal,     setTxnTotal]     = useState(0)
  const [txnLoading,   setTxnLoading]   = useState(false)

  const PAGE_LIMIT = 20

  const toast = (msg, type = 'success') => {
    if (type === 'success') { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000) }
    else                    { setErrorMsg(msg);   setTimeout(() => setErrorMsg(''), 5000) }
  }

  // ── Fetch functions ────────────────────────────────────────
  const fetchReceivables = useCallback(async () => {
    setRcvLoading(true)
    try {
      const res = await paymentApi.listReceivables({ status: rcvStatus, page: rcvPage, limit: PAGE_LIMIT })
      setReceivables(res.data?.receivables || [])
      setRcvTotal(res.data?.pagination?.total || 0)
    } catch { toast('Failed to load receivables', 'error') }
    finally { setRcvLoading(false) }
  }, [rcvStatus, rcvPage])

  const fetchPayables = useCallback(async () => {
    setPayLoading(true)
    try {
      const res = await paymentApi.listPayables({ status: payStatus, page: payPage, limit: PAGE_LIMIT })
      setPayables(res.data?.payables || [])
      setPayTotal(res.data?.pagination?.total || 0)
    } catch { toast('Failed to load payables', 'error') }
    finally { setPayLoading(false) }
  }, [payStatus, payPage])

  const fetchTransactions = useCallback(async () => {
    setTxnLoading(true)
    try {
      const res = await paymentApi.listTransactions({ type: txnType, page: txnPage, limit: PAGE_LIMIT })
      setTransactions(res.data?.transactions || [])
      setTxnTotal(res.data?.pagination?.total || 0)
    } catch { toast('Failed to load transactions', 'error') }
    finally { setTxnLoading(false) }
  }, [txnType, txnPage])

  const fetchInvoiceCollections = useCallback(async (statusFilter) => {
    const sf = statusFilter !== undefined ? statusFilter : collFilter
    setLoadingInvColl(true)
    try {
      const res = await invoiceApi.listPendingVerification({ status: sf === 'all' ? 'all' : 'pending' })
      if (res.success) {
        setInvoiceCollections(res.data?.collections || [])
        setPendingVerifyCount(res.data?.pending || 0)
        setCollStats({
          pending:      res.data?.pending      || 0,
          verified:     res.data?.verified     || 0,
          total_amount: res.data?.total_amount || 0,
        })
      }
    } catch { /* non-fatal */ }
    finally { setLoadingInvColl(false) }
  }, [collFilter])

  useEffect(() => { fetchReceivables() },       [fetchReceivables])
  useEffect(() => { fetchPayables() },           [fetchPayables])
  useEffect(() => { fetchTransactions() },       [fetchTransactions])
  useEffect(() => { fetchInvoiceCollections() }, [fetchInvoiceCollections])

  // ── Summary stats ──────────────────────────────────────────
  const totalReceivable = receivables.reduce((s, r) => s + (parseFloat(r.outstanding) || 0), 0)
  const totalPayable    = payables.reduce((s, p) => s + (parseFloat(p.outstanding) || 0), 0)
  const overdueRcv      = receivables.filter(r => overdueDays(r.due_date) > 0).length
  const overduePayable  = payables.filter(p => overdueDays(p.due_date) > 0).length
  const rcvdLoaded      = transactions.filter(h => h.type === 'Received').reduce((a, h) => a + (parseFloat(h.amount) || 0), 0)
  const paidLoaded      = transactions.filter(h => h.type === 'Paid').reduce((a, h) => a + (parseFloat(h.amount) || 0), 0)

  // ── Payment handlers ───────────────────────────────────────
  const handleCollect = async () => {
    if (!pForm.amount || Number(pForm.amount) <= 0) { toast('Enter a valid amount', 'error'); return }
    setSubmitting(true)
    try {
      await paymentApi.collectReceivable(showModal.record._id, { amount: Number(pForm.amount), mode: pForm.mode, reference: pForm.ref, notes: pForm.notes })
      toast(`✓ ${fmt(pForm.amount)} recorded from ${showModal.record.customer_name}`)
      setShowModal(null); setPForm({ amount: '', mode: 'Cash', ref: '', notes: '' })
      fetchReceivables(); fetchTransactions()
    } catch (err) { toast(err?.response?.data?.message || 'Failed to record payment', 'error') }
    finally { setSubmitting(false) }
  }

  const handlePay = async () => {
    if (!pForm.amount || Number(pForm.amount) <= 0) { toast('Enter a valid amount', 'error'); return }
    setSubmitting(true)
    try {
      await paymentApi.payPayable(showModal.record._id, { amount: Number(pForm.amount), mode: pForm.mode, reference: pForm.ref, notes: pForm.notes })
      toast(`✓ ${fmt(pForm.amount)} paid to ${showModal.record.supplier_name}`)
      setShowModal(null); setPForm({ amount: '', mode: 'Bank Transfer', ref: '', notes: '' })
      fetchPayables(); fetchTransactions()
    } catch (err) { toast(err?.response?.data?.message || 'Failed to record payment', 'error') }
    finally { setSubmitting(false) }
  }

  // ── Collection verification handlers ──────────────────────
  const handleSendOtp = async (invoiceId, paymentId) => {
    setVerifyBusy(paymentId)
    try {
      const res = await invoiceApi.sendVerificationOtp(invoiceId, paymentId)
      if (res.success) {
        toast(`OTP sent to ${res.data?.staff || 'staff'}'s phone. Ask them to read it out.`)
        // Auto-open the OTP entry panel after sending
        setOtpInputs(p => ({ ...p, [`show_${paymentId}`]: true }))
        setInvoiceCollections(prev => prev.map(e =>
          e.payment_id === paymentId
            ? { ...e, verification_status: 'OTP Sent', otp_sent_at: new Date().toISOString() }
            : e
        ))
      } else {
        toast(res.message || 'Failed to send OTP', 'error')
      }
    } catch { toast('Network error', 'error') }
    finally { setVerifyBusy(null) }
  }

  const handleVerifyPayment = async (invoiceId, paymentId) => {
    const otp = otpInputs[paymentId] || ''
    if (otp.length !== 6) { setOtpErrors(e => ({ ...e, [paymentId]: 'Enter all 6 digits' })); return }
    setVerifyBusy(paymentId)
    try {
      const res = await invoiceApi.verifyPayment(invoiceId, paymentId, otp)
      if (res.success) {
        toast(`✓ Payment of ${fmt(res.data?.payment_amount)} verified`)
        setOtpInputs(p => ({ ...p, [paymentId]: '', [`show_${paymentId}`]: false }))
        setOtpErrors(p => ({ ...p, [paymentId]: '' }))
        setPendingVerifyCount(c => Math.max(0, c - 1))
        setCollStats(s => ({ ...s, pending: Math.max(0, s.pending - 1), verified: s.verified + 1 }))
        setInvoiceCollections(prev => prev.map(e =>
          e.payment_id === paymentId
            ? { ...e, verification_status: 'Verified', verified_by_name: res.data?.verified_by || '', verified_at: res.data?.verified_at }
            : e
        ))
      } else {
        setOtpErrors(e => ({ ...e, [paymentId]: res.message || 'Invalid OTP' }))
      }
    } catch { setOtpErrors(e => ({ ...e, [paymentId]: 'Network error' })) }
    finally { setVerifyBusy(null) }
  }

  // ── Filtered receivables ───────────────────────────────────
  const filteredReceivables = receivables.filter(r =>
    (r.customer_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.rcv_code || '').toLowerCase().includes(search.toLowerCase())
  )

  // ── Filtered staff collections by customer search ──────────
  const filteredCollections = invoiceCollections.filter(e => {
    const q = search.toLowerCase()
    return !q ||
      (e.customer_name || '').toLowerCase().includes(q) ||
      (e.customer_phone || '').toLowerCase().includes(q) ||
      (e.invoice_no || '').toLowerCase().includes(q) ||
      (e.received_by_name || '').toLowerCase().includes(q)
  })

  // ── Pagination helper ──────────────────────────────────────
  function PaginationBar({ total, page, setPage, limit, loading: isLoading }) {
    const pages = Math.ceil(total / limit)
    if (pages <= 1) return null
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border)', justifyContent: 'flex-end', fontSize: 13 }}>
        <span style={{ color: 'var(--text-muted)', marginRight: 8 }}>
          {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total}
        </span>
        <button className="btn btn-secondary btn-xs" disabled={page <= 1 || isLoading} onClick={() => setPage(p => p - 1)}>Prev</button>
        <span style={{ fontWeight: 600 }}>{page} / {pages}</span>
        <button className="btn btn-secondary btn-xs" disabled={page >= pages || isLoading} onClick={() => setPage(p => p + 1)}>Next</button>
      </div>
    )
  }

  // ── OTP digit boxes ────────────────────────────────────────
  function OtpBoxes({ paymentId, invoiceId }) {
    const val  = otpInputs[paymentId] || ''
    const err  = otpErrors[paymentId] || ''
    const busy = verifyBusy === paymentId
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {[0,1,2,3,4,5].map(i => (
            <input key={i} maxLength={1} value={val[i] || ''} inputMode="numeric"
              onChange={e => {
                const ch = e.target.value.replace(/\D/, '')
                if (!ch) return
                const arr = val.split(''); arr[i] = ch
                setOtpInputs(p => ({ ...p, [paymentId]: arr.join('').slice(0, 6) }))
                setOtpErrors(p => ({ ...p, [paymentId]: '' }))
                const next = e.target.parentNode.children[i + 1]
                if (next) next.focus()
              }}
              onKeyDown={e => {
                if (e.key === 'Backspace' && !val[i]) {
                  const prev = e.target.parentNode.children[i - 1]
                  if (prev) prev.focus()
                }
              }}
              style={{ width: 36, height: 42, textAlign: 'center', fontSize: 18, fontWeight: 800,
                border: `1.5px solid ${val[i] ? '#2563EB' : '#BFDBFE'}`,
                borderRadius: 8, background: val[i] ? '#DBEAFE' : '#fff', outline: 'none', color: 'var(--text)' }} />
          ))}
        </div>
        {err && <div style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 600 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-secondary btn-xs" disabled={busy}
            onClick={() => handleSendOtp(invoiceId, paymentId)}>Resend</button>
          <button className="btn btn-primary btn-xs" style={{ background: 'var(--success)' }}
            disabled={busy || val.length !== 6}
            onClick={() => handleVerifyPayment(invoiceId, paymentId)}>
            <ShieldCheck size={11} style={{ marginRight: 4 }} />
            {busy ? 'Verifying...' : 'Verify'}
          </button>
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <>
      <style>{`@keyframes pulse { 0%,100%{opacity:.6} 50%{opacity:.2} } @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>

      <div className="breadcrumb">
        <span>Finance</span><span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-active">Payment Management</span>
      </div>

      {successMsg && (
        <div className="alert alert-info" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <CheckCircle style={{ color: 'var(--success)', width: 18, flexShrink: 0 }} />
          <span style={{ fontWeight: 600 }}>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="alert alert-danger" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertCircle style={{ color: 'var(--danger)', width: 18, flexShrink: 0 }} />
          <span style={{ fontWeight: 600 }}>{errorMsg}</span>
        </div>
      )}

      {/* Summary cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 20 }}>
        {[
          { label: 'Total Receivable',  val: fmt(totalReceivable), sub: `${overdueRcv} overdue`,    color: 'blue',   icon: <TrendingUp /> },
          { label: 'Total Payable',     val: fmt(totalPayable),    sub: `${overduePayable} overdue`, color: 'red',    icon: <TrendingDown /> },
          { label: 'Received (Loaded)', val: fmt(rcvdLoaded),      sub: `${transactions.filter(h => h.type === 'Received').length} txns`, color: 'green', icon: <CheckCircle /> },
          { label: 'Paid (Loaded)',     val: fmt(paidLoaded),      sub: `${transactions.filter(h => h.type === 'Paid').length} txns`,     color: 'purple', icon: <CreditCard /> },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ padding: '14px 16px' }}>
            <div className={`stat-icon ${s.color}`}>{s.icon}</div>
            <div className="stat-info">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ fontSize: 18 }}>{s.val}</div>
              <div className="stat-change">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab-btn${tab === 'receivable' ? ' active' : ''}`} onClick={() => setTab('receivable')}>
          Receivable (Customers)
          {pendingVerifyCount > 0 && (
            <span style={{ marginLeft: 6, background: '#DC2626', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 800 }}>
              {pendingVerifyCount} to verify
            </span>
          )}
        </button>
        <button className={`tab-btn${tab === 'payable' ? ' active' : ''}`} onClick={() => setTab('payable')}>Payable (Suppliers)</button>
        <button className={`tab-btn${tab === 'history' ? ' active' : ''}`} onClick={() => setTab('history')}>Transaction History</button>
      </div>

      {/* ============ RECEIVABLE TAB ============ */}
      {tab === 'receivable' && (
        <>
          {/* Customer Outstanding — customer payments collected by staff, pending admin verification */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, flexWrap: 'wrap' }}>
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CreditCard size={16} color="var(--primary)" />
                  Customer Outstanding
                  {collStats.pending > 0 && (
                    <span style={{ background: '#DC2626', color: '#fff', borderRadius: 10, padding: '1px 8px', fontSize: 10, fontWeight: 800 }}>
                      {collStats.pending} to verify
                    </span>
                  )}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ fontSize: 11, background: '#FEF3C7', color: '#92400E', padding: '3px 10px', borderRadius: 20, fontWeight: 700 }}>{collStats.pending} Pending</span>
                  <span style={{ fontSize: 11, background: '#D1FAE5', color: '#065F46', padding: '3px 10px', borderRadius: 20, fontWeight: 700 }}>{collStats.verified} Verified</span>
                  <span style={{ fontSize: 11, background: '#DBEAFE', color: '#1D4ED8', padding: '3px 10px', borderRadius: 20, fontWeight: 700 }}>Total Collected: {fmt(collStats.total_amount)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="search-bar">
                  <Search />
                  <input placeholder="Search customer..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                {[['all','All'],['pending','Pending']].map(([k, l]) => (
                  <button key={k} className={`btn btn-xs ${collFilter === k ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => { setCollFilter(k); fetchInvoiceCollections(k) }}>{l}</button>
                ))}
                <button className="btn btn-secondary btn-xs" onClick={() => fetchInvoiceCollections(collFilter)} disabled={loadingInvColl}>
                  <RefreshCw size={12} style={loadingInvColl ? { animation: 'spin 1s linear infinite' } : {}} />
                </button>
              </div>
            </div>

            {loadingInvColl ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading customer payments...</div>
            ) : filteredCollections.length === 0 ? (
              <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <CreditCard size={32} color="var(--primary)" style={{ marginBottom: 8, opacity: 0.4 }} />
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                  {search ? 'No matching customer payments' : collFilter === 'pending' ? 'No pending payments to verify' : 'No customer payments recorded yet'}
                </div>
                <div style={{ fontSize: 12 }}>
                  When staff collect payments from customers, each payment shows here with the customer, amount, and the staff who collected it — ready for you to verify.
                </div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
                      {[
                        { label: 'Customer',      align: 'left'   },
                        { label: 'Invoice',       align: 'left'   },
                        { label: 'This Payment',  align: 'right'  },
                        { label: 'Mode & Date',   align: 'left'   },
                        { label: 'Collected By',  align: 'left'   },
                        { label: 'Invoice Total', align: 'right'  },
                        { label: 'Paid So Far',   align: 'right'  },
                        { label: 'Balance Due',   align: 'right'  },
                        { label: 'Status',        align: 'center' },
                        { label: 'Action',        align: 'center' },
                      ].map(h => (
                        <th key={h.label} style={{ padding: '11px 14px', textAlign: h.align, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCollections.map((entry, idx) => {
                      const isVerified = entry.verification_status === 'Verified'
                      const isOtpSent  = entry.verification_status === 'OTP Sent'
                      const isBusy     = verifyBusy === entry.payment_id
                      const showOtp    = otpInputs[`show_${entry.payment_id}`]
                      return (
                        <React.Fragment key={`${entry.invoice_id}-${entry.payment_id}`}>
                          {(() => {
                            const total   = entry.invoice_grand_total || 0
                            const paidNow = entry.running_paid != null ? entry.running_paid : entry.invoice_paid
                            const dueNow  = entry.balance_after != null ? entry.balance_after : entry.invoice_balance
                            const multi   = entry.payment_count > 1
                            return (
                          <tr style={{ borderBottom: '1px solid var(--border)', background: isVerified ? '#F6FEF9' : idx % 2 === 0 ? 'var(--surface)' : 'var(--bg)' }}>
                            {/* Customer */}
                            <td style={{ padding: '14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                                  {(entry.customer_name || '?').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{entry.customer_name || '—'}</div>
                                  {entry.customer_phone && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{entry.customer_phone}</div>}
                                </div>
                              </div>
                            </td>
                            {/* Invoice / Order */}
                            <td style={{ padding: '14px' }}>
                              <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 12, color: 'var(--primary)' }}>{entry.invoice_no}</div>
                              {entry.order_no && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{entry.order_no}</div>}
                            </td>
                            {/* This payment */}
                            <td style={{ padding: '14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>{fmt(entry.amount)}</div>
                              {multi && (
                                <div style={{ display: 'inline-block', marginTop: 4, fontSize: 10, fontWeight: 700,
                                  background: '#EEF2FF', color: '#4338CA', padding: '2px 8px', borderRadius: 20 }}>
                                  Payment {entry.payment_seq} of {entry.payment_count}
                                </div>
                              )}
                            </td>
                            {/* Mode & date */}
                            <td style={{ padding: '14px' }}>
                              <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text)' }}>{entry.payment_mode}</div>
                              {entry.reference_no && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Ref: {entry.reference_no}</div>}
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{fmtDate(entry.payment_date)}</div>
                            </td>
                            {/* Collected by */}
                            <td style={{ padding: '14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11, flexShrink: 0 }}>
                                  {(entry.received_by_name || '?').charAt(0).toUpperCase()}
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{entry.received_by_name || '—'}</span>
                              </div>
                              {isVerified && entry.verified_by_name && (
                                <div style={{ fontSize: 10, color: '#059669', marginTop: 4 }}>
                                  Verified by {entry.verified_by_name}<br />{fmtDate(entry.verified_at)}
                                </div>
                              )}
                            </td>
                            {/* Invoice total */}
                            <td style={{ padding: '14px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
                              {fmt(total)}
                            </td>
                            {/* Paid so far (running) */}
                            <td style={{ padding: '14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--success)' }}>{fmt(paidNow)}</div>
                              {multi && (
                                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>after payment {entry.payment_seq}</div>
                              )}
                            </td>
                            {/* Balance due (running) + progress bar */}
                            <td style={{ padding: '14px', textAlign: 'right', whiteSpace: 'nowrap', minWidth: 150 }}>
                              <div style={{ fontWeight: 800, fontSize: 13, color: (dueNow || 0) > 0 ? 'var(--danger)' : 'var(--success)' }}>
                                {fmt(dueNow)}
                              </div>
                              {(() => {
                                const pct = total > 0 ? Math.min(100, Math.round((paidNow / total) * 100)) : 0
                                const done = (dueNow || 0) === 0
                                return (
                                  <div style={{ marginTop: 6 }}>
                                    <div style={{ height: 6, borderRadius: 6, background: '#E5E7EB', overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${pct}%`, borderRadius: 6,
                                        background: done ? 'var(--success)' : pct >= 50 ? '#F59E0B' : 'var(--danger)',
                                        transition: 'width .3s' }} />
                                    </div>
                                    <div style={{ fontSize: 9, fontWeight: 700, marginTop: 3, color: done ? 'var(--success)' : 'var(--text-muted)' }}>
                                      {done ? '✓ Fully paid' : `${pct}% paid · ${fmt(dueNow)} left`}
                                    </div>
                                  </div>
                                )
                              })()}
                            </td>
                            {/* Status */}
                            <td style={{ padding: '14px', textAlign: 'center' }}>
                              <span style={{ padding: '4px 11px', borderRadius: 20, fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap',
                                background: isVerified ? '#D1FAE5' : isOtpSent ? '#DBEAFE' : '#FEF3C7',
                                color: isVerified ? '#065F46' : isOtpSent ? '#1D4ED8' : '#92400E' }}>
                                {isVerified ? '✓ Verified' : isOtpSent ? 'OTP Sent' : 'Pending'}
                              </span>
                            </td>
                            {/* Action */}
                            <td style={{ padding: '14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              {isVerified ? (
                                <span style={{ color: '#059669', fontSize: 12, fontWeight: 700 }}>Done</span>
                              ) : !isOtpSent ? (
                                <button className="btn btn-primary btn-xs" disabled={isBusy}
                                  onClick={() => handleSendOtp(entry.invoice_id, entry.payment_id)}>
                                  <Send size={11} style={{ marginRight: 4 }} />
                                  {isBusy ? '...' : 'Send OTP'}
                                </button>
                              ) : (
                                <button className="btn btn-secondary btn-xs"
                                  onClick={() => setOtpInputs(p => ({ ...p, [`show_${entry.payment_id}`]: !p[`show_${entry.payment_id}`] }))}>
                                  {showOtp ? 'Hide OTP' : 'Enter OTP'}
                                </button>
                              )}
                            </td>
                          </tr>
                            )
                          })()}
                          {isOtpSent && showOtp && (
                            <tr style={{ background: '#EFF6FF', borderBottom: '1px solid #BFDBFE' }}>
                              <td colSpan={10} style={{ padding: '14px 18px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: '#2563EB' }}>
                                    Ask <strong>{entry.received_by_name}</strong> to read the OTP from their phone:
                                  </div>
                                  <OtpBoxes paymentId={entry.payment_id} invoiceId={entry.invoice_id} />
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </>
      )}

      {/* ============ PAYABLE TAB ============ */}
      {tab === 'payable' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Supplier Outstanding ({payTotal})</span>
            <div className="header-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select className="form-control" style={{ width: 130, fontSize: 13 }}
                value={payStatus} onChange={e => { setPayStatus(e.target.value); setPayPage(1) }}>
                {['All', 'Pending', 'Partial', 'Paid', 'Overdue'].map(s => <option key={s}>{s}</option>)}
              </select>
              <button className="btn btn-secondary btn-xs" onClick={fetchPayables} disabled={payLoading}>
                <RefreshCw style={{ width: 13, ...(payLoading ? { animation: 'spin 1s linear infinite' } : {}) }} />
              </button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th><th>Supplier</th><th>Invoice Amt</th><th>Paid</th>
                  <th>Outstanding</th><th>Due Date</th><th>Overdue</th><th>Status</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {payLoading
                  ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={9} />)
                  : payables.length === 0
                  ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No outstanding payables found.</td></tr>
                  : payables.map(p => {
                      const od = overdueDays(p.due_date)
                      return (
                        <tr key={p._id}>
                          <td style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 12 }}>{p.pay_code || p._id?.slice(-6).toUpperCase()}</td>
                          <td style={{ fontWeight: 600 }}>{p.supplier_name || '—'}</td>
                          <td>{fmt(p.invoice_amount)}</td>
                          <td style={{ color: 'var(--success)', fontWeight: 600 }}>{fmt(p.paid)}</td>
                          <td style={{ fontWeight: 700, color: parseFloat(p.outstanding) > 0 ? 'var(--danger)' : 'var(--success)' }}>{fmt(p.outstanding)}</td>
                          <td style={{ fontSize: 12 }}>{fmtDate(p.due_date)}</td>
                          <td>{od > 0 ? <span className="badge badge-red">{od}d late</span> : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}</td>
                          <td><span className={`badge ${p.status === 'Paid' ? 'badge-green' : p.status === 'Partial' ? 'badge-yellow' : 'badge-red'}`}>{p.status}</span></td>
                          <td>
                            {parseFloat(p.outstanding) > 0
                              ? <button className="btn btn-primary btn-xs" onClick={() => { setShowModal({ type: 'pay', record: p }); setPForm({ amount: '', mode: 'Bank Transfer', ref: '', notes: '' }) }}><CreditCard style={{ width: 12 }} /> Pay</button>
                              : <span className="badge badge-green" style={{ fontSize: 10 }}>Paid</span>}
                          </td>
                        </tr>
                      )
                    })
                }
              </tbody>
            </table>
          </div>
          <PaginationBar total={payTotal} page={payPage} setPage={setPayPage} limit={PAGE_LIMIT} loading={payLoading} />
        </div>
      )}

      {/* ============ HISTORY TAB ============ */}
      {tab === 'history' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Transaction History ({txnTotal})</span>
            <div className="header-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select className="form-control" style={{ width: 130, fontSize: 13 }}
                value={txnType} onChange={e => { setTxnType(e.target.value); setTxnPage(1) }}>
                {['All', 'Received', 'Paid'].map(s => <option key={s}>{s}</option>)}
              </select>
              <button className="btn btn-secondary btn-xs" onClick={fetchTransactions} disabled={txnLoading}>
                <RefreshCw style={{ width: 13, ...(txnLoading ? { animation: 'spin 1s linear infinite' } : {}) }} />
              </button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>TXN Code</th><th>Date</th><th>Type</th><th>Party</th>
                  <th>Amount</th><th>Mode</th><th>Reference</th><th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {txnLoading
                  ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={8} />)
                  : transactions.length === 0
                  ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No transactions found.</td></tr>
                  : transactions.map(h => (
                    <tr key={h._id}>
                      <td style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 12 }}>{h.txn_code || h._id?.slice(-6).toUpperCase()}</td>
                      <td style={{ fontSize: 12 }}>{fmtDate(h.txn_date)}</td>
                      <td><span className={`badge ${h.type === 'Received' ? 'badge-green' : 'badge-red'}`}>{h.type}</span></td>
                      <td style={{ fontWeight: 600 }}>{h.party_name || '—'}</td>
                      <td style={{ fontWeight: 700, color: h.type === 'Received' ? 'var(--success)' : 'var(--danger)' }}>
                        {h.type === 'Received' ? '+' : '-'} {fmt(h.amount)}
                      </td>
                      <td><span className="chip">{h.mode || '—'}</span></td>
                      <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{h.reference || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{h.notes || '—'}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
          <PaginationBar total={txnTotal} page={txnPage} setPage={setTxnPage} limit={PAGE_LIMIT} loading={txnLoading} />
        </div>
      )}

      {/* ============ PAYMENT MODAL ============ */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">
                {showModal.type === 'receive' ? 'Collect Payment' : 'Pay Supplier'}
              </span>
              <button className="btn-ghost" onClick={() => setShowModal(null)}>x</button>
            </div>
            <div className="modal-body">
              <div className="alert alert-info" style={{ marginBottom: 16 }}>
                <CreditCard />
                <div>
                  <strong>{showModal.type === 'receive' ? showModal.record.customer_name : showModal.record.supplier_name}</strong>
                  <div style={{ fontSize: 12 }}>
                    Invoice: {fmt(showModal.record.invoice_amount)} | {showModal.type === 'receive' ? `Received: ${fmt(showModal.record.received)}` : `Paid: ${fmt(showModal.record.paid)}`} |{' '}
                    <strong style={{ color: 'var(--danger)' }}>Outstanding: {fmt(showModal.record.outstanding)}</strong>
                  </div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Amount (Rs) *</label>
                  <input className="form-control" type="number" placeholder="0.00" min="1"
                    value={pForm.amount} onChange={e => setPForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Mode *</label>
                  <select className="form-control" value={pForm.mode} onChange={e => setPForm(f => ({ ...f, mode: e.target.value }))}>
                    {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Transaction Reference</label>
                  <input className="form-control" placeholder="UTR / Cheque / Cash ref"
                    value={pForm.ref} onChange={e => setPForm(f => ({ ...f, ref: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input className="form-control" placeholder="Optional"
                    value={pForm.notes} onChange={e => setPForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              {pForm.amount && (
                <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
                  Balance after: <strong style={{ color: Math.max(0, parseFloat(showModal.record.outstanding || 0) - Number(pForm.amount)) === 0 ? 'var(--success)' : 'var(--warning)' }}>
                    {fmt(Math.max(0, parseFloat(showModal.record.outstanding || 0) - Number(pForm.amount)))}
                  </strong>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(null)} disabled={submitting}>Cancel</button>
              <button className="btn btn-primary" disabled={submitting} onClick={showModal.type === 'receive' ? handleCollect : handlePay}>
                <CheckCircle style={{ width: 14 }} />
                {submitting ? 'Saving...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
