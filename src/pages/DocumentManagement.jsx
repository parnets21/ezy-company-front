import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Upload, Search, Trash2, Eye, FolderOpen, FileText, File,
  RefreshCw, AlertCircle, CheckCircle, ShieldCheck, ShoppingCart,
  Receipt, BookOpen, Tag, Building2, MoreHorizontal, FileImage, Sheet
} from 'lucide-react'
import { documentApi } from '../api/systemApi'

// §24 required categories
const DOC_CATEGORIES = [
  'GST Certificates',
  'Purchase Bills',
  'Sales Bills',
  'Product Catalogues',
  'Price Lists',
  'Company Documents',
  'Other',
]

const CAT_META = {
  'GST Certificates':  { badge: 'badge-purple', color: '#7C3AED', Icon: ShieldCheck  },
  'Purchase Bills':    { badge: 'badge-orange', color: '#F97316', Icon: ShoppingCart  },
  'Sales Bills':       { badge: 'badge-blue',   color: '#2563EB', Icon: Receipt       },
  'Product Catalogues':{ badge: 'badge-cyan',   color: '#06B6D4', Icon: BookOpen      },
  'Price Lists':       { badge: 'badge-green',  color: '#10B981', Icon: Tag           },
  'Company Documents': { badge: 'badge-yellow', color: '#F59E0B', Icon: Building2     },
  'Other':             { badge: 'badge-gray',   color: '#64748B', Icon: MoreHorizontal},
}

const fileIcon = (mime) => {
  if (!mime) return <File style={{ width: 22, color: '#6366F1' }} />
  if (mime.includes('pdf'))    return <FileText  style={{ width: 22, color: '#EF4444' }} />
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv'))
    return <FileText style={{ width: 22, color: '#10B981' }} />
  if (mime.includes('image'))  return <FileImage style={{ width: 22, color: '#F59E0B' }} />
  return <File style={{ width: 22, color: '#6366F1' }} />
}

const formatSize = (bytes) => {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

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

export default function DocumentManagement() {
  const [search,       setSearch]       = useState('')
  const [catFilter,    setCatFilter]    = useState('All')
  const [viewMode,     setViewMode]     = useState('table')
  const [showUpload,   setShowUpload]   = useState(false)
  const [uploadForm,   setUploadForm]   = useState({ category: 'GST Certificates' })
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading,    setUploading]    = useState(false)
  const [successMsg,   setSuccessMsg]   = useState('')
  const [errorMsg,     setErrorMsg]     = useState('')
  const fileRef = useRef(null)

  // ── Data state ──────────────────────────────────────────────
  const [documents,  setDocuments]  = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading,    setLoading]    = useState(false)
  const [page,       setPage]       = useState(1)
  const [catCounts,  setCatCounts]  = useState({})
  const PAGE_LIMIT = 20

  const toast = (msg, type = 'success') => {
    if (type === 'success') { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3500) }
    else                    { setErrorMsg(msg);   setTimeout(() => setErrorMsg(''),   5000) }
  }

  // ── Fetch documents from API ────────────────────────────────
  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: PAGE_LIMIT }
      if (catFilter !== 'All') params.doc_type = catFilter
      const res = await documentApi.list(params)
      const data = res?.data || res
      setDocuments(data?.documents || [])
      setTotalCount(data?.pagination?.total || 0)
    } catch {
      toast('Failed to load documents', 'error')
    } finally {
      setLoading(false)
    }
  }, [catFilter, page])

  // Fetch per-category counts for the filter bar
  const fetchCatCounts = useCallback(async () => {
    try {
      const results = await Promise.all(
        DOC_CATEGORIES.map(cat =>
          documentApi.list({ doc_type: cat, limit: 1 })
            .then(res => ({ cat, count: (res?.data || res)?.pagination?.total || 0 }))
            .catch(() => ({ cat, count: 0 }))
        )
      )
      const map = {}
      results.forEach(r => { map[r.cat] = r.count })
      setCatCounts(map)
    } catch { /* silent */ }
  }, [])

  useEffect(() => { fetchDocuments() }, [fetchDocuments])
  useEffect(() => { fetchCatCounts() }, [fetchCatCounts])

  // ── Client-side search filter (on loaded page) ─────────────
  const filtered = documents.filter(d => {
    if (!search) return true
    const name = (d.file_name || '').toLowerCase()
    const tags = Array.isArray(d.tags) ? d.tags.join(' ').toLowerCase() : ''
    return name.includes(search.toLowerCase()) || tags.includes(search.toLowerCase())
  })

  // ── Upload ─────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!selectedFile) { toast('Please select a file first', 'error'); return }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('entity_type', uploadForm.category)
      formData.append('doc_type', uploadForm.category)
      await documentApi.upload(formData)
      setSelectedFile(null)
      if (fileRef.current) fileRef.current.value = ''
      setUploadForm({ category: 'GST Certificates' })
      setShowUpload(false)
      toast('Document uploaded successfully')
      fetchDocuments()
      fetchCatCounts()
    } catch (err) {
      toast(`Upload failed: ${err.response?.data?.message || err.message}`, 'error')
    } finally {
      setUploading(false)
    }
  }

  // ── Delete ─────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this document?')) return
    try {
      await documentApi.delete(id)
      toast('Document deleted')
      fetchDocuments()
      fetchCatCounts()
    } catch (err) {
      toast(`Delete failed: ${err.response?.data?.message || err.message}`, 'error')
    }
  }

  const totalAll = Object.values(catCounts).reduce((s, v) => s + v, 0)
  const pages = Math.ceil(totalCount / PAGE_LIMIT)

  return (
    <>
      <style>{`@keyframes pulse { 0%,100%{opacity:.6} 50%{opacity:.2} }`}</style>

      <div className="breadcrumb">
        <span>System</span><span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-active">Document Management</span>
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

      {/* ── Stats ── */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: 20 }}>
        {[
          { label: 'Total Documents', val: totalAll,                                                               color: 'blue'   },
          { label: 'GST Certificates',val: catCounts['GST Certificates']  || 0,                                   color: 'purple' },
          { label: 'Purchase Bills',  val: catCounts['Purchase Bills']    || 0,                                   color: 'orange' },
          { label: 'Sales Bills',     val: catCounts['Sales Bills']       || 0,                                   color: 'green'  },
          { label: 'Catalogues',      val: catCounts['Product Catalogues']|| 0,                                   color: 'cyan'   },
          { label: 'Price Lists',     val: catCounts['Price Lists']       || 0,                                   color: 'yellow' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ padding: '14px 16px' }}>
            <div className={`stat-icon ${s.color}`}><FolderOpen /></div>
            <div className="stat-info">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ fontSize: 20 }}>{s.val}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Category filter pills ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          className="chip"
          style={{ background: catFilter === 'All' ? 'var(--primary)' : undefined,
            color: catFilter === 'All' ? '#fff' : undefined, cursor: 'pointer', fontWeight: 600 }}
          onClick={() => { setCatFilter('All'); setPage(1) }}>
          All ({totalAll})
        </button>
        {DOC_CATEGORIES.map(cat => {
          const count = catCounts[cat] || 0
          const meta = CAT_META[cat]
          const active = catFilter === cat
          return (
            <button key={cat} className="chip"
              style={{
                cursor: 'pointer',
                background: active ? meta.color + '22' : undefined,
                color: active ? meta.color : undefined,
                borderColor: active ? meta.color : undefined,
                fontWeight: active ? 700 : 400,
                display: 'flex', alignItems: 'center', gap: 5,
              }}
              onClick={() => { setCatFilter(cat); setPage(1) }}>
              <meta.Icon style={{ width: 12, flexShrink: 0 }} />
              {cat} ({count})
            </button>
          )
        })}
      </div>

      {/* ── Main table card ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            Documents ({catFilter === 'All' ? totalAll : catCounts[catFilter] || 0})
          </span>
          <div className="header-actions" style={{ gap: 8 }}>
            <div className="search-bar">
              <Search />
              <input placeholder="Search by name…" value={search}
                onChange={e => setSearch(e.target.value)} />
            </div>
            {/* View toggle */}
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg)', borderRadius: 8, padding: 3 }}>
              {['table', 'grid'].map(v => (
                <button key={v} onClick={() => setViewMode(v)}
                  style={{ padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: viewMode === v ? '#fff' : 'transparent',
                    fontWeight: viewMode === v ? 600 : 400, fontSize: 12,
                    color: viewMode === v ? 'var(--text)' : 'var(--text-muted)',
                    boxShadow: viewMode === v ? 'var(--shadow)' : 'none' }}>
                  {v === 'table' ? 'Table' : 'Grid'}
                </button>
              ))}
            </div>
            <button className="btn btn-secondary btn-xs" onClick={() => { fetchDocuments(); fetchCatCounts() }}
              disabled={loading} title="Refresh">
              <RefreshCw style={{ width: 13 }} />
            </button>
            <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
              <Upload style={{ width: 14 }} /> Upload Document
            </button>
          </div>
        </div>

        {viewMode === 'table' ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Category</th><th>Size</th>
                  <th>Uploaded By</th><th>Date</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
                  : filtered.length === 0
                    ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                          No documents found.
                        </td>
                      </tr>
                    )
                    : filtered.map(d => {
                        const id = d._id || d.id
                        const cat = d.doc_type || d.entity_type || 'Other'
                        const meta = CAT_META[cat] || CAT_META['Other']
                        const dateStr = d.created_at
                          ? new Date(d.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '—'
                        return (
                          <tr key={id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {fileIcon(d.mime_type)}
                                <span style={{ fontWeight: 500, fontSize: 12 }}>{d.file_name}</span>
                              </div>
                            </td>
                            <td>
                              <span className={`badge ${meta.badge}`}>{cat}</span>
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatSize(d.file_size)}</td>
                            <td style={{ fontSize: 12 }}>{d.uploaded_by?.name || '—'}</td>
                            <td style={{ fontSize: 12 }}>{dateStr}</td>
                            <td>
                              <div className="table-actions">
                                {d.file_url && (
                                  <a href={`${import.meta.env.VITE_API_BASE_URL?.replace('/api','')||'https://ezyenquiry-backend.onrender.com'}${d.file_url}`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="btn btn-ghost btn-xs" title="View">
                                    <Eye style={{ width: 13 }} />
                                  </a>
                                )}
                                <button className="btn btn-ghost btn-xs" title="Delete"
                                  style={{ color: 'var(--danger)' }} onClick={() => handleDelete(id)}>
                                  <Trash2 style={{ width: 13 }} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                }
              </tbody>
            </table>
          </div>
        ) : (
          /* Grid view */
          <div style={{ padding: '16px 20px', display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ height: 160, borderRadius: 10, background: 'var(--border)',
                  opacity: 0.5, animation: 'pulse 1.4s ease-in-out infinite' }} />
              ))
              : filtered.map(d => {
                  const id = d._id || d.id
                  const cat = d.doc_type || d.entity_type || 'Other'
                  const meta = CAT_META[cat] || CAT_META['Other']
                  return (
                    <div key={id} style={{ border: '1px solid var(--border)', borderRadius: 10,
                      overflow: 'hidden', background: 'var(--bg)' }}>
                      <div style={{ height: 80, background: meta.color + '18',
                        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <meta.Icon style={{ width: 36, height: 36, color: meta.color }} />
                      </div>
                      <div style={{ padding: '10px 12px' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}
                          title={d.file_name}>{d.file_name}</div>
                        <span className={`badge ${meta.badge}`} style={{ fontSize: 10 }}>{cat}</span>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                          {formatSize(d.file_size)}
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                          {d.file_url && (
                            <a href={`${import.meta.env.VITE_API_BASE_URL?.replace('/api','')||'https://ezyenquiry-backend.onrender.com'}${d.file_url}`}
                              target="_blank" rel="noopener noreferrer"
                              className="btn btn-secondary btn-xs" style={{ flex: 1, justifyContent: 'center' }}>
                              <Eye style={{ width: 11 }} /> View
                            </a>
                          )}
                          <button className="btn btn-ghost btn-xs"
                            style={{ color: 'var(--danger)' }} onClick={() => handleDelete(id)}>
                            <Trash2 style={{ width: 11 }} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })
            }
            {!loading && filtered.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                No documents found.
              </div>
            )}
          </div>
        )}

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

      {/* ── Upload Modal ── */}
      {showUpload && (
        <div className="modal-overlay" onClick={() => setShowUpload(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Upload Document</span>
              <button className="btn-ghost" onClick={() => setShowUpload(false)}>✕</button>
            </div>
            <div className="modal-body">
              {/* Drop zone */}
              <div style={{ border: '2px dashed var(--primary)', borderRadius: 10, padding: 24,
                textAlign: 'center', background: 'var(--primary-light)', marginBottom: 16 }}>
                <Upload style={{ width: 32, color: 'var(--primary)', margin: '0 auto 10px', display: 'block' }} />
                <div style={{ fontWeight: 600, marginBottom: 6 }}>
                  {selectedFile ? `✓ ${selectedFile.name}` : 'Click to select file'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                  PDF, JPG, PNG, XLSX — max 10 MB
                </div>
                <label style={{ cursor: 'pointer' }}>
                  <span className="btn btn-secondary btn-sm">Browse File</span>
                  <input ref={fileRef} type="file"
                    accept=".pdf,.jpg,.png,.jpeg,.xlsx,.xls,.doc,.docx"
                    style={{ display: 'none' }}
                    onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
                </label>
              </div>

              <div className="form-group">
                <label className="form-label">Category *</label>
                <select className="form-control" value={uploadForm.category}
                  onChange={e => setUploadForm(p => ({ ...p, category: e.target.value }))}>
                  {DOC_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowUpload(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={uploading || !selectedFile} onClick={handleUpload}>
                <Upload style={{ width: 14 }} />
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
