import { useEffect, useMemo, useState } from 'react'
import { FileText, Search, Calendar, IndianRupee, X, CheckCircle } from 'lucide-react'
import { purchaseInvoiceApi } from '../api/purchaseInventoryApi'

const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const dateLabel = value => value
  ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—'

export default function PurchaseInvoicePage({ suppliers = [] }) {
  const [purchaseRows, setPurchaseRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [paymentTarget, setPaymentTarget] = useState(null)
  const [paidAmount, setPaidAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true
    purchaseInvoiceApi.list({ limit: 500 })
      .then(res => {
        if (active) setPurchaseRows(res?.data?.purchases || res?.purchases || [])
      })
      .catch(err => {
        if (active) setLoadError(err.response?.data?.message || 'Could not load purchase invoices.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const invoices = useMemo(() => {
    const grouped = new Map()
    purchaseRows.forEach(p => {
      const key = p.bill_code || p.purchase_code || p._id || p.id
      if (!key) return
      const group = grouped.get(String(key)) || {
        key: String(key),
        billCode: p.bill_code || p.purchase_code,
        invoiceNo: p.invoice_number || p.invoice_no || p.bill_code || p.purchase_code,
        supplier: p.supplier_name || suppliers.find(s => (s._id || s.id) === p.supplier_id)?.name || '—',
        date: p.purchase_date || p.created_at,
        dueDate: p.due_date || '',
        amount: 0,
        paid: 0,
        products: [],
        lines: 0,
      }
      group.amount += Number(p.total_amount || p.total || 0)
      group.paid += Number(p.amount_paid || 0)
      group.lines += 1
      if (p.product_name && !group.products.includes(p.product_name)) group.products.push(p.product_name)
      if (!group.date || (p.purchase_date && new Date(p.purchase_date) < new Date(group.date))) group.date = p.purchase_date
      if (p.due_date) group.dueDate = p.due_date
      grouped.set(String(key), group)
    })

    return [...grouped.values()].map(invoice => {
      const balance = Math.max(0, invoice.amount - invoice.paid)
      let paymentStatus = balance === 0 ? 'Paid' : invoice.paid > 0 ? 'Partially Paid' : 'Due'
      if (balance > 0 && invoice.dueDate && new Date(invoice.dueDate) < new Date()) paymentStatus = 'Overdue'
      return { ...invoice, balance, paymentStatus }
    }).filter(invoice => {
      const query = search.trim().toLowerCase()
      const matchesSearch = !query || [invoice.invoiceNo, invoice.billCode, invoice.supplier, ...invoice.products]
        .some(value => String(value || '').toLowerCase().includes(query))
      return matchesSearch && (!paymentFilter || invoice.paymentStatus === paymentFilter)
    }).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
  }, [purchaseRows, suppliers, search, paymentFilter])

  const totalAmount = invoices.reduce((sum, invoice) => sum + invoice.amount, 0)
  const totalDue = invoices.reduce((sum, invoice) => sum + invoice.balance, 0)

  const openPayment = invoice => {
    setPaymentTarget(invoice)
    setPaidAmount(String(invoice.paid))
    setDueDate(invoice.dueDate ? String(invoice.dueDate).slice(0, 10) : '')
    setPaymentNotes('')
    setError('')
  }

  const savePayment = async () => {
    if (!paymentTarget?.billCode) return
    const value = Number(paidAmount)
    if (!Number.isFinite(value) || value < 0 || value > paymentTarget.amount) {
      setError(`Enter an amount from ₹0 to ${money(paymentTarget.amount)}.`)
      return
    }
    setSaving(true)
    setError('')
    try {
      const result = await purchaseInvoiceApi.recordPayment(paymentTarget.billCode, {
        amount_paid: value,
        due_date: dueDate || null,
        payment_notes: paymentNotes,
      })
      const updatedRows = result?.data?.purchases || result?.purchases || []
      const updatedById = new Map(updatedRows.map(p => [String(p._id || p.id), p]))
      setPurchaseRows(prev => prev.map(p => updatedById.get(String(p._id || p.id)) || p))
      setSuccess(`Payment updated for ${paymentTarget.invoiceNo}.`)
      setPaymentTarget(null)
      setTimeout(() => setSuccess(''), 4000)
    } catch (err) {
      setError(err.response?.data?.message || 'Payment could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="breadcrumb">
        <span>Purchases</span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-active">Purchase Invoices</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <FileText size={22} style={{ color: 'var(--primary)' }} />
        <div>
          <h1 style={{ margin: 0, fontSize: 20 }}>Purchase Invoices</h1>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 3 }}>Supplier invoices recorded with purchase bills</div>
        </div>
      </div>

      {success && <div className="alert alert-success" style={{ marginBottom: 12 }}>{success}</div>}
      {loadError && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{loadError}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12 }}><FileText size={15} /> Invoices</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 7 }}>{invoices.length}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12 }}><IndianRupee size={15} /> Invoice Total</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 7 }}>{money(totalAmount)}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12 }}><Calendar size={15} /> Amount Due</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 7, color: totalDue ? 'var(--danger)' : 'var(--success)' }}>{money(totalDue)}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12, padding: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 220, border: '1px solid var(--border)', borderRadius: 7, padding: '0 10px', height: 38 }}>
          <Search size={15} style={{ color: 'var(--text-muted)' }} />
          <input aria-label="Search purchase invoices" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoice, supplier, or product" style={{ border: 0, outline: 0, background: 'transparent', width: '100%', color: 'var(--text)' }} />
        </div>
        <select className="form-control" aria-label="Filter invoice payment status" value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} style={{ width: 180, height: 38 }}>
          <option value="">All payment statuses</option>
          <option value="Due">Due</option>
          <option value="Partially Paid">Partially Paid</option>
          <option value="Paid">Paid</option>
          <option value="Overdue">Overdue</option>
        </select>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: 1100, width: '100%' }}>
            <thead>
              <tr>
                {['Invoice No.', 'Purchase Bill', 'Date', 'Supplier', 'Products', 'Total', 'Paid', 'Balance', 'Payment Status', ''].map(label => <th key={label}>{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}>Loading purchase invoices…</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}>No purchase bills found. Record a purchase bill to see it here.</td></tr>
              ) : invoices.map(invoice => (
                <tr key={invoice.key}>
                  <td style={{ fontWeight: 700 }}>{invoice.invoiceNo || '—'}</td>
                  <td>{invoice.billCode || '—'}</td>
                  <td>{dateLabel(invoice.date)}</td>
                  <td>{invoice.supplier}</td>
                  <td>{invoice.products.join(', ') || `${invoice.lines} item(s)`}</td>
                  <td>{money(invoice.amount)}</td>
                  <td>{money(invoice.paid)}</td>
                  <td style={{ fontWeight: 700, color: invoice.balance ? 'var(--danger)' : 'var(--success)' }}>{money(invoice.balance)}</td>
                  <td>{invoice.paymentStatus}</td>
                  <td>
                    <button className="btn btn-sm btn-secondary" onClick={() => openPayment(invoice)} disabled={!invoice.billCode}>Record Payment</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {paymentTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 9999 }} onClick={() => !saving && setPaymentTarget(null)}>
          <div className="card" style={{ width: '100%', maxWidth: 480, padding: 22 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>Record Bill Payment</h2>
                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>{paymentTarget.invoiceNo} · Balance {money(paymentTarget.balance)}</div>
              </div>
              <button className="btn btn-sm btn-secondary" onClick={() => setPaymentTarget(null)} disabled={saving} aria-label="Close payment dialog"><X size={16} /></button>
            </div>
            {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}
            <label className="form-label">Total paid to date</label>
            <input type="number" min="0" max={paymentTarget.amount} step="0.01" className="form-control" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} />
            <label className="form-label" style={{ marginTop: 12 }}>Due date</label>
            <input type="date" className="form-control" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            <label className="form-label" style={{ marginTop: 12 }}>Payment notes</label>
            <textarea className="form-control" rows={3} value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} placeholder="Optional payment reference or notes" />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button className="btn btn-secondary" onClick={() => setPaymentTarget(null)} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={savePayment} disabled={saving}>
                <CheckCircle size={14} /> {saving ? 'Saving…' : 'Save Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
