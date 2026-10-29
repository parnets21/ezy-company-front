import { useState, useEffect, useCallback } from 'react'
import { Crown, Check, X, CreditCard, TrendingUp, Users, Zap, RefreshCw, AlertCircle, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { subscriptionApi } from '../api/systemApi'
import api from '../api/index'

const PAGE_SIZE = 10

// §25: Required plans
const PLANS = [
  {
    key: 'Free', name: 'Free Plan', price: 0, period: 'Forever',
    color: '#64748B', bgColor: '#F8FAFC', badge: 'badge-gray',
    tagline: 'Limited Enquiries',
    description: 'For individuals getting started',
    enquiryLimit: 10, userLimit: 1,
    features: [
      { text: 'Up to 10 Enquiries / month',   included: true  },
      { text: '1 User account',               included: true  },
      { text: 'Product Search (limited)',      included: true  },
      { text: 'Basic Dashboard',              included: true  },
      { text: 'Order Management',             included: false },
      { text: 'Inventory Management',         included: false },
      { text: 'Sales & Purchase Reports',     included: false },
      { text: 'CRM & Lead Management',        included: false },
      { text: 'Accounts & P&L Module',        included: false },
      { text: 'Priority Listing',             included: false },
    ],
  },
  {
    key: 'Silver', name: 'Silver Plan', price: 1499, period: '/month',
    color: '#06B6D4', bgColor: '#ECFEFF', badge: 'badge-cyan',
    tagline: 'More Enquiries',
    description: 'For small tile retailers',
    enquiryLimit: 100, userLimit: 5,
    features: [
      { text: 'Up to 100 Enquiries / month',  included: true  },
      { text: 'Up to 5 Users',               included: true  },
      { text: 'Full Product Search',         included: true  },
      { text: 'Advanced Dashboard',          included: true  },
      { text: 'Order Management',            included: true  },
      { text: 'Inventory Management',        included: true  },
      { text: 'Sales & Purchase Reports',    included: true  },
      { text: 'CRM & Lead Management',       included: false },
      { text: 'Accounts & P&L Module',       included: false },
      { text: 'Priority Listing',            included: false },
    ],
  },
  {
    key: 'Gold', name: 'Gold Plan', price: 2999, period: '/month',
    color: '#F59E0B', bgColor: '#FFFBEB', badge: 'badge-yellow',
    tagline: 'Unlimited Enquiries',
    description: 'For growing wholesalers', popular: true,
    enquiryLimit: 999999, userLimit: 15,
    features: [
      { text: 'Unlimited Enquiries',          included: true  },
      { text: 'Up to 15 Users',              included: true  },
      { text: 'Full Product Search',         included: true  },
      { text: 'Advanced Dashboard + Analytics', included: true },
      { text: 'Order Management',            included: true  },
      { text: 'Inventory Management',        included: true  },
      { text: 'Sales & Purchase Reports',    included: true  },
      { text: 'CRM & Lead Management',       included: true  },
      { text: 'Accounts & P&L Module',       included: true  },
      { text: 'Priority Listing',            included: false },
    ],
  },
  {
    key: 'Platinum', name: 'Platinum Plan', price: 5999, period: '/month',
    color: '#8B5CF6', bgColor: '#F5F3FF', badge: 'badge-purple',
    tagline: 'Priority Listing',
    description: 'For enterprise distributors',
    enquiryLimit: 999999, userLimit: 999999,
    features: [
      { text: 'Unlimited Enquiries',          included: true  },
      { text: 'Unlimited Users',              included: true  },
      { text: 'Full Product Search',          included: true  },
      { text: 'Advanced Dashboard + Analytics', included: true },
      { text: 'Order Management',             included: true  },
      { text: 'Inventory Management',         included: true  },
      { text: 'Sales & Purchase Reports',     included: true  },
      { text: 'CRM & Lead Management',        included: true  },
      { text: 'Accounts & P&L Module',        included: true  },
      { text: '⭐ Top Priority Listing',       included: true  },
    ],
  },
]

export default function SubscriptionSystem() {
  const [tab,           setTab]           = useState('plans')
  const [page,          setPage]          = useState(1)
  const [history,       setHistory]       = useState([])
  const [loadingHistory,setLoadingHistory] = useState(false)
  const [showUpgrade,   setShowUpgrade]   = useState(null)
  const [upgrading,     setUpgrading]     = useState(false)
  const [successMsg,    setSuccessMsg]    = useState('')
  const [errorMsg,      setErrorMsg]      = useState('')

  // ── Live current subscription ─────────────────────────────
  const [currentInfo,   setCurrentInfo]   = useState(null)
  const [loadingCurrent,setLoadingCurrent]= useState(true)

  // ── Live enquiry count this month ─────────────────────────
  const [monthEnquiries, setMonthEnquiries] = useState(0)
  const [loadingEnq,     setLoadingEnq]     = useState(false)

  const toast = (msg, type = 'success') => {
    if (type === 'success') { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000) }
    else                    { setErrorMsg(msg);   setTimeout(() => setErrorMsg(''),   5000) }
  }

  // ── Fetch current subscription ────────────────────────────
  const fetchCurrent = useCallback(async () => {
    setLoadingCurrent(true)
    try {
      const res = await subscriptionApi.getCurrent()
      setCurrentInfo(res?.data || res)
    } catch {
      setCurrentInfo({ plan: 'Free', subscription: null, company_name: '' })
    } finally {
      setLoadingCurrent(false)
    }
  }, [])

  // ── Fetch enquiry usage this month ────────────────────────
  const fetchEnqCount = useCallback(async () => {
    setLoadingEnq(true)
    try {
      const now = new Date()
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      const to   = now.toISOString().split('T')[0]
      const res  = await api.get('/enquiries', { params: { from_date: from, to_date: to, limit: 1 } })
      const data = res?.data?.data || res?.data
      setMonthEnquiries(data?.pagination?.total || 0)
    } catch {
      setMonthEnquiries(0)
    } finally {
      setLoadingEnq(false)
    }
  }, [])

  // ── Fetch billing history ─────────────────────────────────
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const res = await subscriptionApi.list()
      const d = res?.data || res
      setHistory(Array.isArray(d) ? d : [])
    } catch {
      setHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  useEffect(() => {
    fetchCurrent()
    fetchEnqCount()
  }, [fetchCurrent, fetchEnqCount])

  useEffect(() => {
    if (tab === 'history') fetchHistory()
  }, [tab, fetchHistory])

  // ── Derived values ────────────────────────────────────────
  const currentPlanKey = currentInfo?.plan || 'Free'
  const currentPlan    = PLANS.find(p => p.key === currentPlanKey) || PLANS[0]
  const activeSub      = currentInfo?.subscription
  const enquiryLimit   = currentPlan.enquiryLimit
  const usagePct       = enquiryLimit >= 999999 ? 0 : Math.min(100, (monthEnquiries / enquiryLimit) * 100)

  const expiryStr = activeSub?.expires_at
    ? new Date(activeSub.expires_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : null

  // ── Upgrade ───────────────────────────────────────────────
  const handleUpgrade = async () => {
    if (!showUpgrade) return
    setUpgrading(true)
    try {
      const plan   = PLANS.find(p => p.key === showUpgrade)
      const today  = new Date().toISOString().split('T')[0]
      const expiry = new Date(); expiry.setMonth(expiry.getMonth() + 1)
      await subscriptionApi.create({
        plan:        showUpgrade,
        starts_at:   today,
        expires_at:  expiry.toISOString().split('T')[0],
        amount_paid: plan?.price || 0,
      })
      setShowUpgrade(null)
      toast(`✓ Upgraded to ${showUpgrade} plan! Re-login to see updated access.`)
      fetchCurrent()
      fetchHistory()
    } catch (err) {
      toast(err.response?.data?.message || 'Upgrade failed. Please try again.', 'error')
    } finally {
      setUpgrading(false)
    }
  }

  if (loadingCurrent) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <RefreshCw style={{ width: 24, animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
      </div>
    )
  }

  return (
    <>
      <div className="breadcrumb">
        <span>System</span><span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-active">Subscription</span>
      </div>

      {successMsg && (
        <div className="alert alert-info" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle style={{ color: 'var(--success)', width: 16, flexShrink: 0 }} />
          <span style={{ fontWeight: 600 }}>{successMsg}</span>
          <button style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}
            onClick={() => setSuccessMsg('')}>✕</button>
        </div>
      )}
      {errorMsg && (
        <div className="alert alert-danger" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle style={{ color: 'var(--danger)', width: 16, flexShrink: 0 }} />
          <span style={{ fontWeight: 600 }}>{errorMsg}</span>
          <button style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}
            onClick={() => setErrorMsg('')}>✕</button>
        </div>
      )}

      {/* ── Current plan banner ── */}
      <div style={{
        background: `linear-gradient(135deg, ${currentPlan.color} 0%, ${currentPlan.color}CC 100%)`,
        borderRadius: 12, padding: '20px 24px', marginBottom: 20, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: 'rgba(255,255,255,.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Crown style={{ width: 26 }} />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{currentPlan.name}</div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>
              {currentInfo?.company_name || 'Your Company'}
              {expiryStr && ` · Expires ${expiryStr}`}
            </div>
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
              {currentPlan.tagline}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {enquiryLimit < 999999 && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Enquiries this month</div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>
                {loadingEnq ? '…' : monthEnquiries} / {enquiryLimit}
              </div>
              <div style={{ width: 120, height: 6, borderRadius: 3, background: 'rgba(255,255,255,.3)', marginTop: 4 }}>
                <div style={{ width: `${usagePct}%`, height: '100%', borderRadius: 3,
                  background: usagePct > 80 ? '#FCA5A5' : '#fff', transition: 'width .3s' }} />
              </div>
            </div>
          )}
          {enquiryLimit >= 999999 && (
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              {loadingEnq ? '…' : monthEnquiries} enquiries this month (Unlimited)
            </div>
          )}
          {currentPlanKey !== 'Platinum' && (
            <button className="btn"
              style={{ background: '#fff', color: currentPlan.color, fontWeight: 700 }}
              onClick={() => setShowUpgrade('Platinum')}>
              <Zap style={{ width: 14, color: currentPlan.color }} /> Upgrade
            </button>
          )}
          <button className="btn btn-ghost" style={{ color: '#fff', border: '1px solid rgba(255,255,255,.4)' }}
            onClick={() => { fetchCurrent(); fetchEnqCount() }}>
            <RefreshCw style={{ width: 13 }} />
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 20 }}>
        {[
          { label: 'Current Plan',      val: currentPlan.name,                                                                      color: 'orange', icon: <Crown /> },
          { label: 'Enquiries (Month)', val: enquiryLimit >= 999999 ? `${monthEnquiries} (∞)` : `${monthEnquiries}/${enquiryLimit}`, color: 'green',  icon: <TrendingUp /> },
          { label: 'Plan Price',        val: currentPlan.price === 0 ? 'Free' : `₹${currentPlan.price.toLocaleString()}/mo`,        color: 'blue',   icon: <CreditCard /> },
          { label: 'User Limit',        val: currentPlan.userLimit >= 999999 ? 'Unlimited' : `Up to ${currentPlan.userLimit}`,      color: 'purple', icon: <Users /> },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ padding: '14px 16px' }}>
            <div className={`stat-icon ${s.color}`}>{s.icon}</div>
            <div className="stat-info">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ fontSize: 16 }}>{s.val}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="tabs">
        {[['plans','Plans & Pricing'],['history','Billing History']].map(([key, label]) => (
          <button key={key} className={`tab-btn${tab === key ? ' active' : ''}`}
            onClick={() => { setTab(key); setPage(1) }}>{label}</button>
        ))}
      </div>

      {/* ══════════════ PLANS TAB ══════════════ */}
      {tab === 'plans' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {PLANS.map(plan => {
            const isCurrent = plan.key === currentPlanKey
            return (
              <div key={plan.key} className="card" style={{ position: 'relative',
                border: isCurrent ? `2px solid ${plan.color}` : undefined,
                boxShadow: isCurrent ? `0 0 0 4px ${plan.color}18` : undefined,
              }}>
                {/* Popular badge */}
                {plan.popular && !isCurrent && (
                  <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
                    background: plan.color, color: '#fff', fontSize: 11, fontWeight: 700,
                    padding: '3px 14px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                    ⭐ Most Popular
                  </div>
                )}
                {/* Current tag */}
                {isCurrent && (
                  <div style={{ position: 'absolute', top: -13, right: 16,
                    background: 'var(--success)', color: '#fff', fontSize: 11, fontWeight: 700,
                    padding: '3px 12px', borderRadius: 20 }}>
                    ✓ Active Plan
                  </div>
                )}

                <div className="card-body" style={{ padding: 20 }}>
                  {/* Header */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Crown style={{ width: 20, color: plan.color }} />
                      <span style={{ fontWeight: 800, fontSize: 16, color: plan.color }}>{plan.name}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{plan.description}</div>
                    {/* Tagline pill */}
                    <span style={{ display: 'inline-block', background: plan.color + '18',
                      color: plan.color, fontSize: 11, fontWeight: 700,
                      padding: '2px 10px', borderRadius: 20, border: `1px solid ${plan.color}44` }}>
                      {plan.tagline}
                    </span>
                  </div>

                  {/* Price */}
                  <div style={{ marginBottom: 16, padding: '12px', borderRadius: 8, background: plan.bgColor }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ fontSize: 28, fontWeight: 800, color: plan.color }}>
                        {plan.price === 0 ? 'Free' : `₹${plan.price.toLocaleString()}`}
                      </span>
                      {plan.price > 0 && (
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{plan.period}</span>
                      )}
                    </div>
                    {plan.price > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        Billed monthly · GST extra
                      </div>
                    )}
                  </div>

                  {/* Feature list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                    {plan.features.map((f, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12 }}>
                        {f.included
                          ? <Check style={{ width: 14, color: 'var(--success)', flexShrink: 0, marginTop: 1 }} />
                          : <X style={{ width: 14, color: 'var(--text-light)', flexShrink: 0, marginTop: 1 }} />
                        }
                        <span style={{ color: f.included ? 'var(--text)' : 'var(--text-light)' }}>{f.text}</span>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  {isCurrent ? (
                    <button className="btn" style={{ width: '100%', justifyContent: 'center',
                      background: plan.bgColor, color: plan.color,
                      border: `1px solid ${plan.color}`, cursor: 'default' }} disabled>
                      ✓ Current Plan
                    </button>
                  ) : (
                    <button className="btn btn-primary"
                      style={{ width: '100%', justifyContent: 'center', background: plan.color }}
                      onClick={() => setShowUpgrade(plan.key)}>
                      {plan.price === 0 ? 'Downgrade' : 'Upgrade Now'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ══════════════ BILLING HISTORY TAB ══════════════ */}
      {tab === 'history' && (() => {
        // ── Pagination (10 rows per page) ──────────────────────
        const total      = history.length
        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
        const safePage   = Math.min(page, totalPages)
        const paged      = history.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
        return (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Billing History</span>
            <button className="btn btn-secondary btn-xs" onClick={fetchHistory} disabled={loadingHistory}>
              <RefreshCw style={{ width: 13, animation: loadingHistory ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Plan</th><th>Amount</th><th>GST (18%)</th><th>Total</th><th>Start Date</th><th>Expiry</th><th>Status</th></tr>
              </thead>
              <tbody>
                {loadingHistory
                  ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                        Loading…
                      </td>
                    </tr>
                  )
                  : history.length === 0
                    ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                          No billing history yet.
                        </td>
                      </tr>
                    )
                    : paged.map((h, i) => {
                        const planMeta = PLANS.find(p => p.key === h.plan)
                        const amt      = parseFloat(h.amount_paid) || 0
                        const gst      = Math.round(amt * 0.18)
                        const total    = amt + gst
                        const isActive = h.status === 'Active'
                        return (
                          <tr key={i}>
                            <td>
                              <span className={`badge ${planMeta?.badge || 'badge-gray'}`}>{h.plan}</span>
                            </td>
                            <td style={{ fontWeight: 600 }}>
                              {amt > 0 ? `₹${amt.toLocaleString()}` : 'Free'}
                            </td>
                            <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                              {amt > 0 ? `₹${gst.toLocaleString()}` : '—'}
                            </td>
                            <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                              {amt > 0 ? `₹${total.toLocaleString()}` : '—'}
                            </td>
                            <td style={{ fontSize: 12 }}>
                              {h.starts_at ? new Date(h.starts_at).toLocaleDateString('en-IN') : '—'}
                            </td>
                            <td style={{ fontSize: 12 }}>
                              {h.expires_at ? new Date(h.expires_at).toLocaleDateString('en-IN') : '—'}
                            </td>
                            <td>
                              <span className={`badge ${isActive ? 'badge-green' : 'badge-gray'}`}>
                                {h.status}
                              </span>
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
        )
      })()}

      {/* ══════════════ UPGRADE MODAL ══════════════ */}
      {showUpgrade && (
        <div className="modal-overlay" onClick={() => setShowUpgrade(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">
                {PLANS.find(p => p.key === showUpgrade)?.price === 0
                  ? `Downgrade to ${showUpgrade} Plan`
                  : `Upgrade to ${showUpgrade} Plan`}
              </span>
              <button className="btn-ghost" onClick={() => setShowUpgrade(null)}>✕</button>
            </div>
            <div className="modal-body">
              {(() => {
                const plan = PLANS.find(p => p.key === showUpgrade)
                const gst  = Math.round((plan?.price || 0) * 0.18)
                const total = (plan?.price || 0) + gst
                return (
                  <>
                    <div className="alert alert-info" style={{ marginBottom: 16 }}>
                      <Crown />
                      <span>
                        {plan?.price === 0
                          ? `Downgrading to the Free plan. Your features will be limited.`
                          : <>Upgrading to <strong>{plan?.name}</strong> at <strong>₹{plan?.price?.toLocaleString()}/month</strong>.</>
                        }
                      </span>
                    </div>

                    {/* Tagline highlight */}
                    <div style={{ textAlign: 'center', marginBottom: 16 }}>
                      <span style={{ background: (plan?.color || '#64748B') + '18',
                        color: plan?.color || '#64748B', fontSize: 13, fontWeight: 700,
                        padding: '4px 16px', borderRadius: 20,
                        border: `1px solid ${(plan?.color || '#64748B')}44` }}>
                        {plan?.tagline}
                      </span>
                    </div>

                    {plan?.price > 0 && (
                      <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 14px', fontSize: 13 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ color: 'var(--text-muted)' }}>Plan Amount</span>
                          <span style={{ fontWeight: 600 }}>₹{plan?.price?.toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ color: 'var(--text-muted)' }}>GST (18%)</span>
                          <span style={{ fontWeight: 600 }}>₹{gst.toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between',
                          fontWeight: 800, borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
                          <span>Total</span>
                          <span style={{ color: 'var(--primary)', fontSize: 16 }}>₹{total.toLocaleString()}</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                          Valid for 1 month from today · Auto-renews unless cancelled
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowUpgrade(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={upgrading} onClick={handleUpgrade}>
                {upgrading
                  ? <><RefreshCw style={{ width: 13, animation: 'spin 1s linear infinite' }} /> Processing…</>
                  : <><CreditCard style={{ width: 14 }} /> Confirm</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
