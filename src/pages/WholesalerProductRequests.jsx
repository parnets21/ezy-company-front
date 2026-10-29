import { useState, useEffect, useCallback } from 'react'
import { FileText, RefreshCw, Search, AlertCircle, X, Send } from 'lucide-react'
import { wholesalerApi } from '../api/wholesalerApi'

const money = (n) => (n == null || n === '' ? '—' : '₹' + Number(n).toLocaleString('en-IN'))

const statusColor = (s) => {
  switch (s) {
    case 'Requested': return 'badge-yellow'
    case 'Quoted':    return 'badge-blue'
    case 'Accepted':  return 'badge-cyan'
    case 'Ordered':   return 'badge-green'
    case 'Rejected':  return 'badge-red'
    default:          return 'badge-gray'
  }
}

export default function WholesalerProductRequests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [search, setSearch]     = useState('')

  const [quoteFor, setQuoteFor] = useState(null)
  const [quoteForm, setQuoteForm] = useState({ quoted_price: '', quoted_gst: '18', admin_note: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await wholesalerApi.listRequests().catch(() => ({ data: { requests: [] } }))
      setRequests(res?.data?.requests || res?.requests || [])
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load product requests.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openQuote = (req) => {
    setQuoteFor(req)
    setQuoteForm({
      quoted_price: req.quoted_price ? String(req.quoted_price) : '',
      quoted_gst: req.quoted_gst != null ? String(req.quoted_gst) : '18',
      admin_note: req.admin_note || '',
    })
  }

  const submitQuote = async () => {
    if (!quoteFor) return
    const price = parseFloat(quoteForm.quoted_price)
    if (!(price > 0)) { setError('Enter a valid quoted price.'); return }
    setSaving(true); setError(null)
    try {
      await wholesalerApi.sendQuote(quoteFor._id, {
        quoted_price: price,
        quoted_gst: parseFloat(quoteForm.quoted_gst) || 0,
        admin_note: quoteForm.admin_note.trim(),
      })
      setQuoteFor(null)
      await load()
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to send quote.')
    } finally {
      setSaving(false)
    }
  }

  const previewTotal = (() => {
    const price = parseFloat(quoteForm.quoted_price) || 0
    const gst = parseFloat(quoteForm.quoted_gst) || 0
    const qty = Number(quoteFor?.requested_qty || 0)
    const base = price * (qty || 1)
    return base + (base * gst / 100)
  })()

  const q = search.trim().toLowerCase()
  const filtered = requests.filter(r =>
    !q ||
    (r.product_name || '').toLowerCase().includes(q) ||
    (r.request_no || '').toLowerCase().includes(q) ||
    (r.company_name || '').toLowerCase().includes(q)
  )
  const pending = requests.filter(r => r.status === 'Requested').length

  return (
    <>
      <div className="breadcrumb">
        <span>Wholesaler</span><span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-active">Product Requests</span>
      </div>

      <div className="page-header" style={{ marginBottom: 18 }}>
        <div className="page-header-left">
          <div className="page-title">Product Requests</div>
          <div className="page-desc">New product / quotation requests raised from the Wholesaler App</div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-warning" style={{ marginBottom: 14 }}>
          <AlertCircle /><span>{error}</span>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <FileText size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Product Requests ({filtered.length}{pending ? ` · ${pending} new` : ''})
          </span>
          <div className="header-actions">
            <div className="search-bar">
              <Search size={14} />
              <input placeholder="Search product, request no, company…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Request No</th><th>Company</th><th>Product</th><th>Specs</th>
                <th>Qty</th><th>Note</th><th>Quoted Rate</th><th>Total</th><th>Status</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={10} style={{ textAlign: 'center', padding: 30 }}>Loading…</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No product requests found.</td></tr>
              )}
              {!loading && filtered.map(r => (
                <tr key={r._id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>{r.request_no}</td>
                  <td>{r.company_name || '—'}</td>
                  <td style={{ fontWeight: 600 }}>{r.product_name}</td>
                  <td style={{ fontSize: 12 }}>{[r.size, r.finish, r.color].filter(Boolean).join(' · ') || '—'}</td>
                  <td>{r.requested_qty || '—'} {r.unit}</td>
                  <td style={{ fontSize: 12, maxWidth: 160 }}>{r.wholesaler_note || '—'}</td>
                  <td>{r.quoted_price ? `${money(r.quoted_price)}/${r.unit}` : '—'}</td>
                  <td style={{ fontWeight: 700 }}>{money(r.quoted_total)}</td>
                  <td><span className={`badge ${statusColor(r.status)}`}>{r.status}</span></td>
                  <td>
                    {(r.status === 'Requested' || r.status === 'Quoted') ? (
                      <button className="btn btn-sm btn-primary" onClick={() => openQuote(r)}>
                        {r.status === 'Quoted' ? 'Update Quote' : 'Send Quote'}
                      </button>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Send Quote modal */}
      {quoteFor && (
        <div className="modal-overlay" onClick={() => !saving && setQuoteFor(null)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Send Quotation</span>
              <button className="modal-close" onClick={() => !saving && setQuoteFor(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div style={{ background: 'var(--bg-subtle, #f8fafc)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{quoteFor.product_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {quoteFor.request_no} · {quoteFor.company_name || 'Company'} · Qty {quoteFor.requested_qty || '—'} {quoteFor.unit}
                </div>
                {quoteFor.wholesaler_note ? (
                  <div style={{ fontSize: 12, marginTop: 6, fontStyle: 'italic' }}>Note: {quoteFor.wholesaler_note}</div>
                ) : null}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Quoted Rate (per {quoteFor.unit}) *</label>
                  <input type="number" min="0" value={quoteForm.quoted_price}
                    onChange={e => setQuoteForm(f => ({ ...f, quoted_price: e.target.value }))} placeholder="0" />
                </div>
                <div className="form-group">
                  <label>GST %</label>
                  <input type="number" min="0" value={quoteForm.quoted_gst}
                    onChange={e => setQuoteForm(f => ({ ...f, quoted_gst: e.target.value }))} placeholder="18" />
                </div>
              </div>

              <div className="form-group">
                <label>Note to Wholesaler</label>
                <textarea rows={2} value={quoteForm.admin_note}
                  onChange={e => setQuoteForm(f => ({ ...f, admin_note: e.target.value }))} placeholder="Optional message…" />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontWeight: 700 }}>
                <span>Estimated Total {quoteFor.requested_qty ? `(× ${quoteFor.requested_qty})` : ''}</span>
                <span style={{ color: 'var(--primary)' }}>{money(previewTotal)}</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setQuoteFor(null)} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={submitQuote} disabled={saving}>
                <Send size={14} /> {saving ? 'Sending…' : 'Send Quote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
