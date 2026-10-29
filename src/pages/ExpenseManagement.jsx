import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Receipt, TrendingDown, Calendar, BarChart2, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react'
import { PieChart as RePieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { expenseApi } from '../api/financeApi'

// ── Requirement §14: Exact expense categories ──
const CATEGORIES = [
  'Rent', 'Salary', 'Electricity', 'Internet', 'Fuel',
  'Marketing', 'Google Ads', 'Office Expense', 'Maintenance', 'Miscellaneous',
]
const COLORS = {
  Rent:             '#4F46E5',
  Salary:           '#7C3AED',
  Electricity:      '#F59E0B',
  Internet:         '#06B6D4',
  Fuel:             '#10B981',
  Marketing:        '#EF4444',
  'Google Ads':     '#F97316',
  'Office Expense': '#8B5CF6',
  Maintenance:      '#EC4899',
  Miscellaneous:    '#64748B',
}
const PAYMENT_MODES = ['Cash', 'UPI', 'Bank Transfer', 'Cheque']

const EMPTY_FORM = { category: 'Rent', expense_date: '', description: '', amount: '', payment_mode: 'Cash' }

const todayStr   = () => new Date().toISOString().split('T')[0]
const monthStart = () => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0] }
const yearStart  = () => { const d = new Date(); d.setMonth(0); d.setDate(1); return d.toISOString().split('T')[0] }

function SkeletonRow({ cols }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i}>
          <div style={{ height: 14, borderRadius: 6, background: 'var(--border)',
            opacity: 0.6, animation: 'pulse 1.4s ease-in-out infinite' }} />
        </td>
      ))}
    </tr>
  )
}

export default function ExpenseManagement() {
  const [reportTab, setReportTab] = useState('daily')
  const [showModal, setShowModal] = useState(false)
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [errors,    setErrors]    = useState({})
  const [successMsg,setSuccessMsg]= useState('')
  const [errorMsg,  setErrorMsg]  = useState('')
  const [saving,    setSaving]    = useState(false)
  const [catFilter, setCatFilter] = useState('All')

  // ── Date range ─────────────────────────────────────────────
  const [fromDate, setFromDate] = useState(monthStart())
  const [toDate,   setToDate]   = useState(todayStr())

  // ── API data state ─────────────────────────────────────────
  const [expenses,    setExpenses]    = useState([])
  const [totalAmount, setTotalAmount] = useState(0)
  const [loading,     setLoading]     = useState(false)
  const [page,        setPage]        = useState(1)
  const [totalCount,  setTotalCount]  = useState(0)
  const PAGE_LIMIT = 20

  // ── KPI stats (all-time, separate fetch) ──
  const [kpi, setKpi] = useState({ today: 0, month: 0, year: 0, total: 0 })

  const toast = (msg, type = 'success') => {
    if (type === 'success') { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3500) }
    else                    { setErrorMsg(msg);   setTimeout(() => setErrorMsg(''),   5000) }
  }

  // ── Fetch expenses from API ────────────────────────────────
  const fetchExpenses = useCallback(async () => {
    setLoading(true)
    try {
      const res = await expenseApi.list({
        from_date: fromDate,
        to_date:   toDate,
        category:  catFilter !== 'All' ? catFilter : undefined,
        page,
        limit: PAGE_LIMIT,
      })
      const data = res?.data || res
      setExpenses(data?.expenses || [])
      setTotalAmount(data?.totalAmount || 0)
      setTotalCount(data?.pagination?.total || 0)
    } catch {
      toast('Failed to load expenses', 'error')
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate, catFilter, page])

  // ── Fetch KPI (today / month / year totals) ─────────────
  const fetchKpi = useCallback(async () => {
    try {
      const [resToday, resMonth, resYear, resAll] = await Promise.all([
        expenseApi.list({ from_date: todayStr(), to_date: todayStr(), limit: 1 }),
        expenseApi.list({ from_date: monthStart(), to_date: todayStr(), limit: 1 }),
        expenseApi.list({ from_date: yearStart(), to_date: todayStr(), limit: 1 }),
        expenseApi.list({ limit: 1 }),
      ])
      setKpi({
        today: (resToday?.data || resToday)?.totalAmount || 0,
        month: (resMonth?.data || resMonth)?.totalAmount || 0,
        year:  (resYear?.data  || resYear)?.totalAmount  || 0,
        total: (resAll?.data   || resAll)?.pagination?.total || 0,
      })
    } catch { /* silent */ }
  }, [])

  useEffect(() => { fetchExpenses() }, [fetchExpenses])
  useEffect(() => { fetchKpi() }, [fetchKpi])

  // Switch report tab → update date range
  const switchTab = (tab) => {
    setReportTab(tab)
    setPage(1)
    if (tab === 'daily')   { setFromDate(todayStr());   setToDate(todayStr()) }
    if (tab === 'monthly') { setFromDate(monthStart()); setToDate(todayStr()) }
    if (tab === 'yearly')  { setFromDate(yearStart());  setToDate(todayStr()) }
  }

  // ── Chart data ─────────────────────────────────────────────
  const catTotals = useMemo(() => {
    const map = {}
    expenses.forEach(e => { map[e.category] = (map[e.category] || 0) + (e.amount || 0) })
    return CATEGORIES
      .map(c => ({ name: c, value: map[c] || 0, color: COLORS[c] }))
      .filter(c => c.value > 0)
  }, [expenses])

  // Monthly bar data (last 6 months) built from current loaded expenses
  const monthlyBarData = useMemo(() => {
    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const now = new Date()
    const slots = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      slots.push({
        key:    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        month:  `${MONTH_NAMES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
        amount: 0,
      })
    }
    expenses.forEach(e => {
      if (!e.expense_date) return
      const d = new Date(e.expense_date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const slot = slots.find(s => s.key === key)
      if (slot) slot.amount += (e.amount || 0)
    })
    return slots
  }, [expenses])

  // ── Form validation ────────────────────────────────────────
  const validate = () => {
    const e = {}
    if (!form.expense_date)                                        e.expense_date = 'Date required'
    if (!form.description.trim())                                  e.description  = 'Description required'
    if (!form.amount || isNaN(form.amount) || parseFloat(form.amount) <= 0) e.amount = 'Valid amount required'
    return e
  }

  // ── Add expense ────────────────────────────────────────────
  const handleSave = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    try {
      await expenseApi.create({
        category:     form.category,
        amount:       parseFloat(form.amount),
        description:  form.description,
        expense_date: form.expense_date,
        payment_mode: form.payment_mode,
      })
      setForm(EMPTY_FORM); setErrors({})
      setShowModal(false)
      toast(`Expense added – ₹${parseFloat(form.amount).toLocaleString()}`)
      fetchExpenses()
      fetchKpi()
    } catch (err) {
      toast(err?.response?.data?.message || 'Failed to save expense', 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── Delete expense ────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense?')) return
    try {
      await expenseApi.delete(id)
      toast('Expense deleted')
      fetchExpenses()
      fetchKpi()
    } catch (err) {
      toast(err?.response?.data?.message || 'Failed to delete', 'error')
    }
  }

  // ── Pagination ────────────────────────────────────────────
  const pages = Math.ceil(totalCount / PAGE_LIMIT)

  return (
    <>
      <style>{`@keyframes pulse { 0%,100%{opacity:.6} 50%{opacity:.2} }`}</style>

      <div className="breadcrumb">
        <span>Finance</span><span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-active">Expense Management</span>
      </div>

      {successMsg && (
        <div className="alert alert-info" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle style={{ color: 'var(--success)', width: 16, flexShrink: 0 }} />
          <span style={{ fontWeight: 600 }}>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="alert alert-danger" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle style={{ color: 'var(--danger)', width: 16, flexShrink: 0 }} />
          <span style={{ fontWeight: 600 }}>{errorMsg}</span>
        </div>
      )}

      {/* ── KPI Summary ── */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: 20 }}>
        {[
          { label: 'Today',         val: kpi.today, isCount: false, color: 'blue'   },
          { label: 'This Month',    val: kpi.month, isCount: false, color: 'orange' },
          { label: 'This Year',     val: kpi.year,  isCount: false, color: 'red'    },
          { label: 'Total Entries', val: kpi.total, isCount: true,  color: 'purple' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ padding: '14px 16px' }}>
            <div className={`stat-icon ${s.color}`}><TrendingDown /></div>
            <div className="stat-info">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ fontSize: 18 }}>
                {s.isCount ? s.val : `₹${(s.val || 0).toLocaleString()}`}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Report Tabs ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">Expense Reports</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { key: 'daily',   label: 'Daily',   icon: <Calendar style={{ width: 13 }} /> },
              { key: 'monthly', label: 'Monthly', icon: <BarChart2 style={{ width: 13 }} /> },
              { key: 'yearly',  label: 'Yearly',  icon: <TrendingDown style={{ width: 13 }} /> },
            ].map(t => (
              <button key={t.key}
                className={`btn btn-xs ${reportTab === t.key ? 'btn-primary' : 'btn-secondary'}`}
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}
                onClick={() => switchTab(t.key)}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="card-body">
          {/* Date range + total */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>From</label>
              <input type="date" className="form-control" style={{ width: 150 }} value={fromDate}
                onChange={e => { setFromDate(e.target.value); setPage(1) }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>To</label>
              <input type="date" className="form-control" style={{ width: 150 }} value={toDate}
                onChange={e => { setToDate(e.target.value); setPage(1) }} />
            </div>
            <button className="btn btn-secondary btn-xs" onClick={() => { setPage(1); fetchExpenses() }}
              disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <RefreshCw style={{ width: 12, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              Apply
            </button>
            <div style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--danger)', fontSize: 15 }}>
              Total: ₹{totalAmount.toLocaleString()}
            </div>
          </div>

          {reportTab === 'yearly' ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyBarData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => `₹${v.toLocaleString()}`} />
                <Bar dataKey="amount" fill="#EF4444" radius={[4,4,0,0]} name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="page-grid-2" style={{ gap: 16 }}>
              <div>
                {catTotals.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <RePieChart>
                      <Pie data={catTotals} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85}>
                        {catTotals.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip formatter={v => `₹${v.toLocaleString()}`} />
                      <Legend />
                    </RePieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
                    {loading ? 'Loading…' : 'No expenses in selected range'}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {catTotals.map(c => (
                  <div key={c.name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, display: 'inline-block' }} />
                        {c.name}
                      </span>
                      <span style={{ fontWeight: 700 }}>₹{c.value.toLocaleString()}</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${totalAmount > 0 ? (c.value / totalAmount) * 100 : 0}%`, background: c.color }} />
                    </div>
                  </div>
                ))}
                {catTotals.length > 0 && (
                  <>
                    <div className="divider" />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                      <span>Total</span>
                      <span style={{ color: 'var(--danger)' }}>₹{totalAmount.toLocaleString()}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Expense Entries Table ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Expense Entries ({totalCount})</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="form-control" style={{ width: 160, fontSize: 12 }}
              value={catFilter} onChange={e => { setCatFilter(e.target.value); setPage(1) }}>
              <option value="All">All Categories</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <button className="btn btn-secondary btn-xs" onClick={() => { setPage(1); fetchExpenses() }} disabled={loading}>
              <RefreshCw style={{ width: 12 }} />
            </button>
            <button className="btn btn-primary" onClick={() => { setForm(EMPTY_FORM); setErrors({}); setShowModal(true) }}>
              <Plus />Add Expense
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Date</th><th>Category</th><th>Description</th>
                <th>Amount</th><th>Payment Mode</th><th>Added By</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={8} />)
                : expenses.length === 0
                  ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                        No expense entries for selected range / category.
                      </td>
                    </tr>
                  )
                  : expenses.map(e => {
                      const id = e._id || e.id
                      const dateStr = e.expense_date
                        ? new Date(e.expense_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'
                      return (
                        <tr key={id}>
                          <td style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 12 }}>
                            {id?.toString().slice(-6).toUpperCase()}
                          </td>
                          <td style={{ fontSize: 12 }}>{dateStr}</td>
                          <td>
                            <span className="badge" style={{
                              background: (COLORS[e.category] || '#64748B') + '22',
                              color:      COLORS[e.category] || '#64748B',
                              border:     `1px solid ${(COLORS[e.category] || '#64748B')}44`,
                            }}>
                              {e.category}
                            </span>
                          </td>
                          <td>{e.description}</td>
                          <td style={{ fontWeight: 700, color: 'var(--danger)' }}>
                            ₹{(e.amount || 0).toLocaleString()}
                          </td>
                          <td><span className="chip">{e.payment_mode || '—'}</span></td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {e.added_by?.name || '—'}
                          </td>
                          <td>
                            <button className="btn btn-ghost btn-xs" style={{ color: 'var(--danger)' }}
                              onClick={() => handleDelete(id)}>
                              Del
                            </button>
                          </td>
                        </tr>
                      )
                    })
              }
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
            borderTop: '1px solid var(--border)', justifyContent: 'flex-end', fontSize: 13 }}>
            <span style={{ color: 'var(--text-muted)', marginRight: 8 }}>
              Showing {((page - 1) * PAGE_LIMIT) + 1}–{Math.min(page * PAGE_LIMIT, totalCount)} of {totalCount}
            </span>
            <button className="btn btn-secondary btn-xs" disabled={page <= 1 || loading}
              onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span style={{ fontWeight: 600 }}>{page} / {pages}</span>
            <button className="btn btn-secondary btn-xs" disabled={page >= pages || loading}
              onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>

      {/* ── Add Expense Modal ── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Add Expense</span>
              <button className="btn-ghost" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <select className="form-control" value={form.category}
                    onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Date *</label>
                  <input className={`form-control${errors.expense_date ? ' error' : ''}`}
                    type="date" value={form.expense_date}
                    onChange={e => setForm(p => ({ ...p, expense_date: e.target.value }))} />
                  {errors.expense_date && <div className="form-error">{errors.expense_date}</div>}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Description *</label>
                <input className={`form-control${errors.description ? ' error' : ''}`}
                  placeholder="Expense details" value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                {errors.description && <div className="form-error">{errors.description}</div>}
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Amount (₹) *</label>
                  <input className={`form-control${errors.amount ? ' error' : ''}`}
                    type="number" placeholder="0.00" value={form.amount}
                    onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
                  {errors.amount && <div className="form-error">{errors.amount}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Mode</label>
                  <select className="form-control" value={form.payment_mode}
                    onChange={e => setForm(p => ({ ...p, payment_mode: e.target.value }))}>
                    {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
                <Receipt style={{ width: 14 }} />{saving ? 'Saving…' : 'Save Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
