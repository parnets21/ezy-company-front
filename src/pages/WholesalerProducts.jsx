import { useState, useEffect, useCallback } from 'react'
import { Package, RefreshCw, Search, AlertCircle, Eye, Trash2, X } from 'lucide-react'
import { wholesalerApi } from '../api/wholesalerApi'

const money = (n) => (n == null || n === '' ? '—' : '₹' + Number(n).toLocaleString('en-IN'))

export default function WholesalerProducts() {
  const [products, setProducts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [search, setSearch]     = useState('')

  const [viewItem, setViewItem]   = useState(null)
  const [deleteFor, setDeleteFor] = useState(null)
  const [deleting, setDeleting]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await wholesalerApi.listProducts().catch(() => ({ data: { products: [] } }))
      setProducts(res?.data?.products || res?.products || [])
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load wholesaler products.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const confirmDelete = async () => {
    if (!deleteFor) return
    setDeleting(true); setError(null)
    try {
      await wholesalerApi.deleteProduct(deleteFor.id)
      setDeleteFor(null)
      await load()
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to delete product.')
    } finally {
      setDeleting(false)
    }
  }

  const q = search.trim().toLowerCase()
  const filtered = products.filter(p =>
    !q || (p.name || '').toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q)
  )

  return (
    <>
      <div className="breadcrumb">
        <span>Wholesaler</span><span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-active">Wholesaler Products</span>
      </div>

      <div className="page-header" style={{ marginBottom: 18 }}>
        <div className="page-header-left">
          <div className="page-title">Wholesaler Products</div>
          <div className="page-desc">Products added by wholesalers from the app</div>
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
          <span className="card-title"><Package size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />Products ({filtered.length})</span>
          <div className="header-actions">
            <div className="search-bar">
              <Search size={14} />
              <input placeholder="Search name or code…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th><th>Name</th><th>Size</th><th>Finish</th>
                <th>Purchase</th><th>Selling</th><th>Wholesale</th><th>MRP</th>
                <th>GST</th><th>Per Box</th><th>Unit</th><th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={12} style={{ textAlign: 'center', padding: 30 }}>Loading…</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={12} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No wholesaler products found.</td></tr>
              )}
              {!loading && filtered.map(p => (
                <tr key={p._id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>{p.code}</td>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td>{p.size || '—'}</td>
                  <td>{p.finish || '—'}</td>
                  <td>{money(p.purchase_price)}</td>
                  <td>{money(p.selling_price)}</td>
                  <td>{money(p.wholesale_rate)}</td>
                  <td>{money(p.mrp)}</td>
                  <td>{p.gst_percent ?? 18}%</td>
                  <td style={{ fontSize: 12 }}>{p.pcs_per_box ? `${p.pcs_per_box} pcs · ${p.sqft_per_box || '—'} sqft` : '—'}</td>
                  <td>{p.unit || 'Sq Ft'}</td>
                  <td>
                    <div className="table-actions" style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button className="btn btn-ghost btn-xs" title="View" onClick={() => setViewItem(p)} style={{ color: '#3B82F6' }}>
                        <Eye size={14} />
                      </button>
                      <button className="btn btn-ghost btn-xs" title="Delete" onClick={() => setDeleteFor({ id: p._id, name: p.name })} style={{ color: '#EF4444' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* View modal */}
      {viewItem && (
        <div className="modal-overlay" onClick={() => setViewItem(null)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Product Details</span>
              <button className="modal-close" onClick={() => setViewItem(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 2 }}>{viewItem.name}</div>
              <div style={{ fontFamily: 'monospace', color: 'var(--text-muted)', marginBottom: 14 }}>{viewItem.code}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', marginBottom: 16 }}>
                <Detail label="Size" value={viewItem.size} />
                <Detail label="Finish" value={viewItem.finish} />
                <Detail label="Material" value={viewItem.material} />
                <Detail label="Color" value={viewItem.color} />
                <Detail label="Unit" value={viewItem.unit || 'Sq Ft'} />
                <Detail label="GST" value={`${viewItem.gst_percent ?? 18}%`} />
                <Detail label="Pcs / Box" value={viewItem.pcs_per_box} />
                <Detail label="SqFt / Box" value={viewItem.sqft_per_box} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: 'var(--text-muted)' }}>PRICE BREAKUP</div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <PriceRow label="Purchase Price" value={money(viewItem.purchase_price)} />
                <PriceRow label="Selling Price" value={money(viewItem.selling_price)} />
                <PriceRow label="Wholesale Rate" value={money(viewItem.wholesale_rate)} />
                <PriceRow label="MRP" value={money(viewItem.mrp)} last />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setViewItem(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteFor && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteFor(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Delete Product</span>
              <button className="modal-close" onClick={() => !deleting && setDeleteFor(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0 }}>Delete <strong>{deleteFor.name}</strong>? This removes it from the wholesaler catalog. This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteFor(null)} disabled={deleting}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDelete} disabled={deleting}>
                <Trash2 size={14} /> {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Detail({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{value == null || value === '' ? '—' : value}</div>
    </div>
  )
}

function PriceRow({ label, value, last }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', padding: '9px 12px',
      borderBottom: last ? 'none' : '1px solid var(--border)',
      background: last ? 'var(--bg-subtle, #f8fafc)' : 'transparent',
      fontWeight: last ? 800 : 500,
    }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: last ? 'var(--primary)' : 'inherit' }}>{value}</span>
    </div>
  )
}
