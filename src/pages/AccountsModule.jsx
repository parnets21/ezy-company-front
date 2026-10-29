import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, RefreshCw,
  BookOpen, User, Truck, Wallet, Landmark,
} from 'lucide-react'
import { accountsApi, paymentApi } from '../api/financeApi'

/* ─────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────── */
const fmtMoney = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`
const fmtDate  = (iso) => iso ? new Date(iso).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—'
const monthStart = () => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0] }
const yearStart  = () => { const d = new Date(new Date().getFullYear(), 0, 1); return d.toISOString().split('T')[0] }
const today      = () => new Date().toISOString().split('T')[0]

const TYPE_BADGE = {
  Sales:    'badge-green',   // money IN — you earned it
  Receipt:  'badge-green',   // money IN — received from customer
  Invoice:  'badge-blue',    // invoice raised (customer owes you)
  Payment:  'badge-red',     // money OUT — paid by supplier / expense
  Purchase: 'badge-red',     // money OUT — you bought it
  Bill:     'badge-orange',  // bill from supplier (you owe them)
  Expense:  'badge-orange',  // money OUT — overhead
  Credit:   'badge-green',
  Debit:    'badge-red',
  Sale:     'badge-blue',
}

export default function AccountsModule({
  sales = [], purchases = [], customers = [], suppliers = [],
}) {
  const [tab, setTab] = useState('company')

  // ── Summary (top cards) ────────────────────────────────────
  const [summary, setSummary] = useState({ rcv: 0, pay: 0, received: 0, paid: 0 })
  useEffect(() => {
    (async () => {
      try {
        const [rcvAll, payAll, txns] = await Promise.all([
          paymentApi.listReceivables({ status: 'All', limit: 1000 }),
          paymentApi.listPayables({ status: 'All', limit: 1000 }),
          paymentApi.listTransactions({ type: 'All', limit: 1000 }),
        ])
        const allRcv = rcvAll?.data?.receivables || []
        const allPay = payAll?.data?.payables    || []
        const txnList = txns?.data?.transactions  || []
        setSummary({
          rcv:      allRcv.reduce((s, r) => s + (parseFloat(r.outstanding) || 0), 0),
          pay:      allPay.reduce((s, p) => s + (parseFloat(p.outstanding) || 0), 0),
          received: txnList.filter(h => h.type === 'Received').reduce((s, h) => s + (parseFloat(h.amount) || 0), 0),
          paid:     txnList.filter(h => h.type === 'Paid').reduce((s, h) => s + (parseFloat(h.amount) || 0), 0),
        })
      } catch { /* silent */ }
    })()
  }, [])

  const totalSales    = sales.reduce((a, s) => a + (s.total_amount || 0), 0)
  const totalPurchase = purchases.reduce((a, p) => a + (p.total_amount || 0), 0)

  // ── Company Ledger ─────────────────────────────────────────
  const [compFrom, setCompFrom] = useState(yearStart)
  const [compTo, setCompTo]     = useState(today)
  const [company, setCompany]   = useState(null)
  const [compLoading, setCompLoading] = useState(false)
  const fetchCompany = useCallback(async () => {
    setCompLoading(true)
    try {
      const res = await accountsApi.getCompanyLedger({ from_date: compFrom, to_date: compTo })
      setCompany(res?.data || res)
    } catch { setCompany(null) } finally { setCompLoading(false) }
  }, [compFrom, compTo])

  // ── Customer Ledger ────────────────────────────────────────
  const [custId, setCustId]         = useState('')
  const [custLedger, setCustLedger] = useState(null)
  const [custLoading, setCustLoading] = useState(false)
  const fetchCustLedger = useCallback(async (id) => {
    if (!id) { setCustLedger(null); return }
    setCustLoading(true)
    try {
      const res = await accountsApi.getCustomerLedger(id)
      setCustLedger(res?.data || res)
    } catch { setCustLedger(null) } finally { setCustLoading(false) }
  }, [])

  // ── Supplier Ledger ────────────────────────────────────────
  const [suppId, setSuppId]         = useState('')
  const [suppLedger, setSuppLedger] = useState(null)
  const [suppLoading, setSuppLoading] = useState(false)
  const fetchSuppLedger = useCallback(async (id) => {
    if (!id) { setSuppLedger(null); return }
    setSuppLoading(true)
    try {
      const res = await accountsApi.getSupplierLedger(id)
      setSuppLedger(res?.data || res)
    } catch { setSuppLedger(null) } finally { setSuppLoading(false) }
  }, [])

  // ── Cash Book (daily cash flow) ────────────────────────────
  const [cashFrom, setCashFrom] = useState(monthStart)
  const [cashTo, setCashTo]     = useState(today)
  const [cashBook, setCashBook] = useState(null)
  const [cashLoading, setCashLoading] = useState(false)
  const fetchCashBook = useCallback(async () => {
    setCashLoading(true)
    try {
      const res = await accountsApi.getCashBook({ from_date: cashFrom, to_date: cashTo })
      setCashBook(res?.data || res)
    } catch { setCashBook(null) } finally { setCashLoading(false) }
  }, [cashFrom, cashTo])

  // ── Bank Book (bank transactions) ──────────────────────────
  const [bankFrom, setBankFrom] = useState(monthStart)
  const [bankTo, setBankTo]     = useState(today)
  const [bankBook, setBankBook] = useState(null)
  const [bankLoading, setBankLoading] = useState(false)
  const fetchBankBook = useCallback(async () => {
    setBankLoading(true)
    try {
      const res = await accountsApi.getBankBook({ from_date: bankFrom, to_date: bankTo })
      setBankBook(res?.data || res)
    } catch { setBankBook(null) } finally { setBankLoading(false) }
  }, [bankFrom, bankTo])

  // Auto-load the active tab's data.
  useEffect(() => {
    if (tab === 'company') fetchCompany()
    if (tab === 'cash')    fetchCashBook()
    if (tab === 'bank')    fetchBankBook()
  }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  const sortedCustomers = useMemo(
    () => [...customers].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [customers],
  )
  const sortedSuppliers = useMemo(
    () => [...suppliers].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [suppliers],
  )

  // ── Reusable date-range filter row ─────────────────────────
  const DateRange = ({ from, setFrom, to, setTo, loading, onApply }) => (
    <div style={{ display:'flex', gap:12, alignItems:'flex-end', marginBottom:16, flexWrap:'wrap' }}>
      <div>
        <label style={lbl}>From</label>
        <input type="date" className="form-control" style={{ width:160 }} value={from} onChange={e => setFrom(e.target.value)} />
      </div>
      <div>
        <label style={lbl}>To</label>
        <input type="date" className="form-control" style={{ width:160 }} value={to} onChange={e => setTo(e.target.value)} />
      </div>
      <button className="btn btn-primary" onClick={onApply} disabled={loading} style={{ display:'flex', alignItems:'center', gap:6 }}>
        <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
        {loading ? 'Loading…' : 'Apply'}
      </button>
    </div>
  )

  // ── Totals strip (In / Out / Balance) ──────────────────────
  const TotalsStrip = ({ inLabel, inVal, outLabel, outVal, balance, drCr = true }) => (
    <div style={{ display:'flex', gap:24, flexWrap:'wrap', marginBottom:12, padding:'12px 16px', background:'var(--bg)', borderRadius:10, border:'1px solid var(--border)' }}>
      <div>
        <div style={mini}>{inLabel}</div>
        <div style={{ fontWeight:800, fontSize:16, color:'var(--success)' }}>{fmtMoney(inVal)}</div>
      </div>
      <div>
        <div style={mini}>{outLabel}</div>
        <div style={{ fontWeight:800, fontSize:16, color:'var(--danger)' }}>{fmtMoney(outVal)}</div>
      </div>
      <div>
        <div style={mini}>Closing Balance</div>
        <div style={{ fontWeight:900, fontSize:18, color: (balance || 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
          {fmtMoney(Math.abs(balance || 0))}{drCr ? ` ${(balance || 0) >= 0 ? 'Dr' : 'Cr'}` : ''}
        </div>
      </div>
    </div>
  )

  return (
    <>
      <div className="breadcrumb">
        <span>Finance</span><span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-active">Accounts Module</span>
      </div>

      {/* Summary cards */}
      <div className="stats-grid" style={{ gridTemplateColumns:'repeat(4,1fr)', marginBottom:20 }}>
        {[
          { label:'Total Sales',           val: fmtMoney(totalSales),     color:'blue',   icon:<TrendingUp /> },
          { label:'Total Purchase',        val: fmtMoney(totalPurchase),  color:'red',    icon:<TrendingDown /> },
          { label:'Outstanding Receivable',val: fmtMoney(summary.rcv),    color:'orange', icon:<ArrowUpRight /> },
          { label:'Outstanding Payable',   val: fmtMoney(summary.pay),    color:'purple', icon:<ArrowDownRight /> },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ padding:'14px 16px' }}>
            <div className={`stat-icon ${s.color}`}>{s.icon}</div>
            <div className="stat-info">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ fontSize:18 }}>{s.val}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs — standard accounting structure */}
      <div className="tabs">
        {[
          ['company',  'Company Ledger', <BookOpen size={14} key="i" />],
          ['customer', 'Customer Ledger', <User size={14} key="i" />],
          ['supplier', 'Supplier Ledger', <Truck size={14} key="i" />],
          ['cash',     'Cash Book',       <Wallet size={14} key="i" />],
          ['bank',     'Bank Book',       <Landmark size={14} key="i" />],
        ].map(([k, l, icon]) => (
          <button key={k} className={`tab-btn${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}
            style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
            {icon}{l}
          </button>
        ))}
      </div>

      {/* ══════════ COMPANY LEDGER ══════════ */}
      {tab === 'company' && (
        <div className="card">
          <div className="card-header" style={{ justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span className="card-title">Company Ledger — all transactions</span>
              <span style={{ fontSize:10, fontWeight:800, background:'#ecfdf5', color:'#059669', border:'1px solid #a7f3d0', borderRadius:20, padding:'2px 8px' }}>● Live</span>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={fetchCompany} disabled={compLoading}
              style={{ display:'flex', alignItems:'center', gap:6 }}>
              <RefreshCw size={13} style={{ animation: compLoading ? 'spin 1s linear infinite' : 'none' }}/>
              Refresh
            </button>
          </div>
          <div className="card-body">
            <DateRange from={compFrom} setFrom={setCompFrom} to={compTo} setTo={setCompTo} loading={compLoading} onApply={fetchCompany} />
            {company && (
              <TotalsStrip
                inLabel="Total Debit (In)"  inVal={company.totalDebit}
                outLabel="Total Credit (Out)" outVal={company.totalCredit}
                balance={company.closingBalance}
              />
            )}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={th}>Date</th>
                    <th style={th}>Type</th>
                    <th style={th}>Reference</th>
                    <th style={th}>Party</th>
                    <th style={th}>Narration</th>
                    <th style={{ ...th, textAlign:'right' }}>Debit / In (Dr.)</th>
                    <th style={{ ...th, textAlign:'right' }}>Credit / Out (Cr.)</th>
                    <th style={{ ...th, textAlign:'right' }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {compLoading && <tr><td colSpan={8} style={emptyCell}>Loading…</td></tr>}
                  {!compLoading && (!company || (company.ledger || []).length === 0) && (
                    <tr><td colSpan={8} style={emptyCell}>No transactions in this period.</td></tr>
                  )}
                  {!compLoading && (company?.ledger || []).map((e, i) => (
                    <tr key={i}>
                      <td style={cellSm}>{fmtDate(e.date)}</td>
                      <td><span className={`badge ${TYPE_BADGE[e.type] || 'badge-gray'}`} style={{ fontSize:10 }}>{e.type}</span></td>
                      <td style={{ ...cellSm, fontFamily:'monospace', color:'var(--primary)' }}>{e.ref || '—'}</td>
                      <td style={{ fontWeight:600, fontSize:13 }}>{e.party}</td>
                      <td style={{ ...cellSm, color:'var(--text-muted)', maxWidth:220 }}>{e.narration}</td>
                      <td style={{ textAlign:'right', color:'var(--success)', fontWeight: e.debit > 0 ? 700 : 400 }}>{e.debit > 0 ? fmtMoney(e.debit) : '—'}</td>
                      <td style={{ textAlign:'right', color:'var(--danger)', fontWeight: e.credit > 0 ? 700 : 400 }}>{e.credit > 0 ? fmtMoney(e.credit) : '—'}</td>
                      <td style={{ textAlign:'right', fontWeight:800, color: e.balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {fmtMoney(Math.abs(e.balance))} <span style={{ fontSize:10, color:'var(--text-muted)' }}>{e.balance >= 0 ? 'Dr' : 'Cr'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {!compLoading && company && (company.ledger || []).length > 0 && (
                  <tfoot>
                    <tr style={{ borderTop:'2px solid var(--border)', background:'var(--bg)' }}>
                      <td colSpan={5} style={{ ...cellSm, fontWeight:800, textAlign:'right', paddingRight:12 }}>Total</td>
                      <td style={{ textAlign:'right', fontWeight:800, color:'var(--danger)' }}>{fmtMoney(company.totalDebit)}</td>
                      <td style={{ textAlign:'right', fontWeight:800, color:'var(--success)' }}>{fmtMoney(company.totalCredit)}</td>
                      <td style={{ textAlign:'right', fontWeight:900, color: (company.closingBalance || 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {fmtMoney(Math.abs(company.closingBalance || 0))} <span style={{ fontSize:10, color:'var(--text-muted)' }}>{(company.closingBalance || 0) >= 0 ? 'Dr' : 'Cr'}</span>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ CUSTOMER LEDGER ══════════ */}
      {tab === 'customer' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Customer Ledger</span></div>
          <div className="card-body">
            <div style={{ display:'flex', gap:10, alignItems:'flex-end', marginBottom:16, flexWrap:'wrap' }}>
              <div>
                <label style={lbl}>Select Customer</label>
                <select className="form-control" style={{ minWidth:280 }} value={custId}
                  onChange={e => { setCustId(e.target.value); fetchCustLedger(e.target.value) }}>
                  <option value="">— Choose a customer —</option>
                  {sortedCustomers.map(c => (
                    <option key={c._id || c.id} value={c._id || c.id}>
                      {c.name}{c.mobile ? ` · ${c.mobile}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {custLoading && <span style={{ color:'var(--text-muted)', fontSize:13 }}><RefreshCw size={12} style={{ verticalAlign:'-2px', animation:'spin 1s linear infinite' }}/> Loading…</span>}
            </div>

            {!custId && <div style={emptyCell}>Select a customer to view their ledger.</div>}
            {custLedger && (
              <>
                <div style={{ fontWeight:700, marginBottom:10 }}>
                  {custLedger.customer?.name} — Outstanding:&nbsp;
                  <span style={{ color: (custLedger.closingBalance || 0) > 0 ? 'var(--danger)' : 'var(--success)' }}>
                    {fmtMoney(Math.abs(custLedger.closingBalance || 0))} {(custLedger.closingBalance || 0) > 0 ? 'Dr' : 'Cr'}
                  </span>
                </div>
                <LedgerTable rows={custLedger.ledger} refFields={['rcv_code', 'sale_code']} />
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════ SUPPLIER LEDGER ══════════ */}
      {tab === 'supplier' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Supplier Ledger</span></div>
          <div className="card-body">
            <div style={{ display:'flex', gap:10, alignItems:'flex-end', marginBottom:16, flexWrap:'wrap' }}>
              <div>
                <label style={lbl}>Select Supplier</label>
                <select className="form-control" style={{ minWidth:280 }} value={suppId}
                  onChange={e => { setSuppId(e.target.value); fetchSuppLedger(e.target.value) }}>
                  <option value="">— Choose a supplier —</option>
                  {sortedSuppliers.map(s => (
                    <option key={s._id || s.id} value={s._id || s.id}>
                      {s.name}{s.mobile ? ` · ${s.mobile}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {suppLoading && <span style={{ color:'var(--text-muted)', fontSize:13 }}><RefreshCw size={12} style={{ verticalAlign:'-2px', animation:'spin 1s linear infinite' }}/> Loading…</span>}
            </div>

            {!suppId && <div style={emptyCell}>Select a supplier to view their ledger.</div>}
            {suppLedger && (
              <>
                <div style={{ fontWeight:700, marginBottom:10 }}>
                  {suppLedger.supplier?.name} — Payable:&nbsp;
                  <span style={{ color: (suppLedger.closingBalance || 0) > 0 ? 'var(--danger)' : 'var(--success)' }}>
                    {fmtMoney(Math.abs(suppLedger.closingBalance || 0))} {(suppLedger.closingBalance || 0) > 0 ? 'Cr' : 'Dr'}
                  </span>
                </div>
                <LedgerTable rows={suppLedger.ledger} refFields={['pay_code', 'purchase_code']} />
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════ CASH BOOK ══════════ */}
      {tab === 'cash' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Cash Book — Daily Cash Flow</span></div>
          <div className="card-body">
            <DateRange from={cashFrom} setFrom={setCashFrom} to={cashTo} setTo={setCashTo} loading={cashLoading} onApply={fetchCashBook} />
            {cashBook && (
              <TotalsStrip inLabel="Cash In" inVal={cashBook.totalIn}
                outLabel="Cash Out" outVal={cashBook.totalOut} balance={cashBook.closingBalance} drCr={false} />
            )}
            <BookTable data={cashBook} loading={cashLoading} showMode={false} />
          </div>
        </div>
      )}

      {/* ══════════ BANK BOOK ══════════ */}
      {tab === 'bank' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Bank Book — Bank Transactions</span></div>
          <div className="card-body">
            <DateRange from={bankFrom} setFrom={setBankFrom} to={bankTo} setTo={setBankTo} loading={bankLoading} onApply={fetchBankBook} />
            {bankBook && (
              <TotalsStrip inLabel="Bank In" inVal={bankBook.totalIn}
                outLabel="Bank Out" outVal={bankBook.totalOut} balance={bankBook.closingBalance} drCr={false} />
            )}
            <BookTable data={bankBook} loading={bankLoading} showMode />
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  )
}

/* ── Customer / Supplier ledger table ── */
function LedgerTable({ rows = [], refFields = [], balanceLabel = true }) {
  const totalDebit  = rows.reduce((s, r) => s + (Number(r.debit)  || 0), 0)
  const totalCredit = rows.reduce((s, r) => s + (Number(r.credit) || 0), 0)
  const refOf = (r) => r.ref || refFields.map(f => r[f]).find(Boolean) || r.txn_code || '—'
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th style={th}>Date</th>
            <th style={th}>Type</th>
            <th style={th}>Reference</th>
            <th style={{ ...th, textAlign:'right' }}>Debit (Dr.)</th>
            <th style={{ ...th, textAlign:'right' }}>Credit (Cr.)</th>
            <th style={{ ...th, textAlign:'right' }}>Balance</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={6} style={emptyCell}>No entries yet.</td></tr>}
          {rows.map((r, i) => (
            <tr key={i}>
              <td style={cellSm}>{fmtDate(r.date)}</td>
              <td><span className={`badge ${TYPE_BADGE[r.type] || 'badge-gray'}`} style={{ fontSize:10 }}>{r.type}</span></td>
              <td style={{ ...cellSm, fontFamily:'monospace', color:'var(--primary)' }}>{refOf(r)}</td>
              <td style={{ textAlign:'right', color:'var(--danger)', fontWeight: r.debit > 0 ? 700 : 400 }}>{r.debit > 0 ? fmtMoney(r.debit) : '—'}</td>
              <td style={{ textAlign:'right', color:'var(--success)', fontWeight: r.credit > 0 ? 700 : 400 }}>{r.credit > 0 ? fmtMoney(r.credit) : '—'}</td>
              <td style={{ textAlign:'right', fontWeight:800 }}>
                {fmtMoney(Math.abs(r.balance || 0))}{balanceLabel ? <span style={{ fontSize:10, color:'var(--text-muted)', marginLeft:3 }}>{(r.balance || 0) >= 0 ? 'Dr' : 'Cr'}</span> : ''}
              </td>
            </tr>
          ))}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr style={{ borderTop:'2px solid var(--border)', background:'var(--bg)' }}>
              <td colSpan={3} style={{ ...cellSm, fontWeight:800, textAlign:'right', paddingRight:12 }}>Total</td>
              <td style={{ textAlign:'right', fontWeight:800, color:'var(--danger)' }}>{fmtMoney(totalDebit)}</td>
              <td style={{ textAlign:'right', fontWeight:800, color:'var(--success)' }}>{fmtMoney(totalCredit)}</td>
              <td style={{ textAlign:'right', fontWeight:900 }}>{fmtMoney(Math.abs(totalDebit - totalCredit))} <span style={{ fontSize:10, color:'var(--text-muted)' }}>{(totalDebit - totalCredit) >= 0 ? 'Dr' : 'Cr'}</span></td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

/* ── Cash / Bank book table ── */
function BookTable({ data, loading, showMode }) {
  if (loading) return <div style={emptyCell}>Loading…</div>
  const entries = data?.entries || []
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th><th>Type</th>
            {showMode && <th>Mode</th>}
            <th>Description</th>
            {showMode && <th>Ref</th>}
            <th>In (Dr.)</th><th>Out (Cr.)</th><th>Balance</th>
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 && (
            <tr><td colSpan={showMode ? 8 : 6} style={emptyCell}>No entries for this period.</td></tr>
          )}
          {entries.map((e, i) => (
            <tr key={i}>
              <td style={cellSm}>{fmtDate(e.date)}</td>
              <td><span className={`badge ${TYPE_BADGE[e.type] || 'badge-gray'}`} style={{ fontSize:10 }}>{e.type}</span></td>
              {showMode && <td style={cellSm}>{e.mode || '—'}</td>}
              <td style={{ ...cellSm, maxWidth:260 }}>{e.description}</td>
              {showMode && <td style={{ ...cellSm, fontFamily:'monospace' }}>{e.ref || '—'}</td>}
              <td style={{ color:'var(--success)', fontWeight: e.debit > 0 ? 600 : 400 }}>{e.debit > 0 ? fmtMoney(e.debit) : '—'}</td>
              <td style={{ color:'var(--danger)', fontWeight: e.credit > 0 ? 600 : 400 }}>{e.credit > 0 ? fmtMoney(e.credit) : '—'}</td>
              <td style={{ fontWeight:700, color: (e.balance || 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {fmtMoney(Math.abs(e.balance || 0))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const lbl     = { display:'block', fontSize:12, fontWeight:600, color:'var(--text-muted)', marginBottom:4 }
const mini    = { fontSize:11, color:'var(--text-muted)', marginBottom:2 }
const cellSm  = { fontSize:12 }
const emptyCell = { textAlign:'center', padding:28, color:'var(--text-muted)' }
const th = { padding:'9px 12px', textAlign:'left', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.4px', color:'var(--text-muted)', whiteSpace:'nowrap', borderBottom:'1px solid var(--border)' }
