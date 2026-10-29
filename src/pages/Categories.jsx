import { useState } from 'react'
import { Plus, Search, Edit2, Trash2, Tag, ToggleLeft, ToggleRight, CheckCircle, XCircle, FolderOpen, ChevronDown, X } from 'lucide-react'

export default function Categories({
  categories = [],
  subCategories = [],
  products = [],
  addCategory,
  updateCategory,
  deleteCategory,
  addSubCategory,
  updateSubCategory,
  deleteSubCategory,
  loadingData,
}) {
  const [tab, setTab] = useState('cat')

  // ── search ────────────────────────────────────────────────
  const [catSearch, setCatSearch] = useState('')
  const [subSearch, setSubSearch] = useState('')
  const [subCatFilter, setSubCatFilter] = useState('All')
  // Searchable category picker (Sub-Categories tab)
  const [catPickerOpen, setCatPickerOpen] = useState(false)
  const [catPickerSearch, setCatPickerSearch] = useState('')
  const [catStatusFilter, setCatStatusFilter] = useState('All') // 'All' | 'Active' | 'Inactive'
  const [subStatusFilter, setSubStatusFilter] = useState('All') // 'All' | 'Active' | 'Inactive'

  // ── category modal ────────────────────────────────────────
  const [showCat, setShowCat] = useState(false)
  const [editCat, setEditCat] = useState(null)
  const [catForm, setCatForm] = useState({ name: '', code: '', description: '', is_active: true })
  const [catErr,  setCatErr]  = useState({})
  const [catBusy, setCatBusy] = useState(false)

  // ── sub-category modal ────────────────────────────────────
  const [showSub, setShowSub] = useState(false)
  const [editSub, setEditSub] = useState(null)
  const [subForm, setSubForm] = useState({ category_id: '', name: '', code: '', description: '', is_active: true })
  const [subErr,  setSubErr]  = useState({})
  const [subBusy, setSubBusy] = useState(false)

  // ── toast ─────────────────────────────────────────────────
  const [toast, setToast] = useState('')
  const fire = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  // ── counts ────────────────────────────────────────────────
  const activeCategories = categories.filter(c => c.is_active !== false)

  const subCount = {}
  subCategories.forEach(s => {
    const pid = s.parent_id?.toString()
    if (pid) subCount[pid] = (subCount[pid] || 0) + 1
  })

  // Product count now comes from the backend API — no need to compute client-side

  // ── filtered rows ─────────────────────────────────────────
  const filteredCats = categories.filter(c => {
    const q      = catSearch.toLowerCase()
    const hitSearch = (c.name || '').toLowerCase().includes(q) || (c.code || '').toLowerCase().includes(q)
    const hitStatus = catStatusFilter === 'All'
      || (catStatusFilter === 'Active'   && c.is_active !== false)
      || (catStatusFilter === 'Inactive' && c.is_active === false)
    return hitSearch && hitStatus
  })

  const filteredSubs = subCategories.filter(s => {
    const q      = subSearch.toLowerCase()
    const hit    = (s.name || '').toLowerCase().includes(q) || (s.code || '').toLowerCase().includes(q)
    const cat    = subCatFilter === 'All' || s.parent_id?.toString() === subCatFilter
    const status = subStatusFilter === 'All'
      || (subStatusFilter === 'Active'   && s.is_active !== false)
      || (subStatusFilter === 'Inactive' && s.is_active === false)
    return hit && cat && status
  })

  // ── category CRUD ─────────────────────────────────────────
  const openAddCat  = () => { setCatForm({ name: '', code: '', description: '', is_active: true }); setCatErr({}); setEditCat(null); setShowCat(true) }
  const openEditCat = (c) => { setCatForm({ name: c.name, code: c.code || '', description: c.description || '', is_active: c.is_active !== false }); setCatErr({}); setEditCat(c); setShowCat(true) }
  const closeCat    = () => { setShowCat(false); setCatErr({}) }

  const saveCat = async () => {
    const e = {}
    if (!catForm.name.trim()) e.name = 'Category name is required'
    if (Object.keys(e).length) { setCatErr(e); return }
    setCatBusy(true)
    const r = editCat
      ? await updateCategory?.(editCat._id || editCat.id, catForm)
      : await addCategory?.(catForm)
    setCatBusy(false)
    if (r?.success === false) { fire(`Error: ${r.message}`); return }
    closeCat()
    fire(editCat ? 'Category updated' : 'Category created')
  }

  const toggleCat = (c) => updateCategory?.(c._id || c.id, { ...c, is_active: !c.is_active })

  const deleteCat = async (id) => {
    if (!window.confirm('Delete this category?\nThis will fail if sub-categories exist.')) return
    const r = await deleteCategory?.(id)
    r?.success === false ? fire(`Error: ${r.message}`) : fire('Category deleted')
  }

  // ── sub-category CRUD ─────────────────────────────────────
  const openAddSub  = () => { setSubForm({ category_id: activeCategories[0]?._id || activeCategories[0]?.id || '', name: '', code: '', description: '', is_active: true }); setSubErr({}); setEditSub(null); setShowSub(true) }
  const openEditSub = (s) => { setSubForm({ category_id: s.parent_id?.toString() || '', name: s.name, code: s.code || '', description: s.description || '', is_active: s.is_active !== false }); setSubErr({}); setEditSub(s); setShowSub(true) }
  const closeSub    = () => { setShowSub(false); setSubErr({}) }

  const saveSub = async () => {
    const e = {}
    if (!subForm.category_id) e.category_id = 'Select a category'
    if (!subForm.name.trim()) e.name         = 'Sub-category name is required'
    if (!subForm.code.trim()) e.code         = 'Sub-category code is required'
    if (Object.keys(e).length) { setSubErr(e); return }
    setSubBusy(true)
    const r = editSub
      ? await updateSubCategory?.(editSub._id || editSub.id, subForm)
      : await addSubCategory?.(subForm)
    setSubBusy(false)
    if (r?.success === false) { fire(`Error: ${r.message}`); return }
    closeSub()
    fire(editSub ? 'Sub-category updated' : 'Sub-category created')
  }

  const toggleSub = (s) => updateSubCategory?.(s._id || s.id, { ...s, category_id: s.parent_id?.toString(), is_active: !s.is_active })

  const deleteSub = async (id) => {
    if (!window.confirm('Delete this sub-category?')) return
    const r = await deleteSubCategory?.(id)
    r?.success === false ? fire(`Error: ${r.message}`) : fire('Sub-category deleted')
  }

  return (
    <>
      {/* ── breadcrumb ── */}
      <div className="breadcrumb">
        <span>Product Setup</span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-active">Categories</span>
      </div>

      {/* ── page header ── */}
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-title">Product Categories</div>
          <div className="page-desc">Manage categories and sub-categories for your product catalogue</div>
        </div>
        <div className="page-header-actions">
          {tab === 'cat'
            ? <button className="btn btn-primary" onClick={openAddCat}><Plus size={14} /> Add Category</button>
            : <button className="btn btn-primary" onClick={openAddSub}><Plus size={14} /> Add Sub-Category</button>
          }
        </div>
      </div>

      {/* ── stat cards — clickable filters ── */}
      {(() => {
        const STAT_STYLES = {
          'total-cat':    { bg: '#EFF6FF', iconBg: '#DBEAFE', iconColor: '#2563EB', textColor: '#1D4ED8', borderColor: '#BFDBFE', Icon: FolderOpen  },
          'active-cat':   { bg: '#ECFDF5', iconBg: '#D1FAE5', iconColor: '#059669', textColor: '#047857', borderColor: '#A7F3D0', Icon: CheckCircle  },
          'inactive-cat': { bg: '#FEF2F2', iconBg: '#FEE2E2', iconColor: '#DC2626', textColor: '#B91C1C', borderColor: '#FECACA', Icon: XCircle      },
          'active-sub':   { bg: '#FFF7ED', iconBg: '#FFEDD5', iconColor: '#EA580C', textColor: '#C2410C', borderColor: '#FED7AA', Icon: Tag          },
          'inactive-sub': { bg: '#FEF2F2', iconBg: '#FEE2E2', iconColor: '#DC2626', textColor: '#B91C1C', borderColor: '#FECACA', Icon: XCircle      },
        }
        const stats = [
          { key: 'total-cat',    label: 'Total Categories',    val: categories.length,                                        tab: 'cat', statusKey: 'All'      },
          { key: 'active-cat',   label: 'Active Categories',   val: categories.filter(c => c.is_active !== false).length,     tab: 'cat', statusKey: 'Active'   },
          { key: 'inactive-cat', label: 'Inactive Categories', val: categories.filter(c => c.is_active === false).length,     tab: 'cat', statusKey: 'Inactive' },
          { key: 'active-sub',   label: 'Active Sub-Cats',   val: subCategories.filter(s => s.is_active !== false).length,  tab: 'sub', statusKey: 'Active'   },
          { key: 'inactive-sub', label: 'Inactive Sub-Cats',  val: subCategories.filter(s => s.is_active === false).length,  tab: 'sub', statusKey: 'Inactive' },
        ]
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
            {stats.map(s => {
              const st = STAT_STYLES[s.key]
              const Icon = st.Icon
              const isActive = tab === s.tab && (
                s.tab === 'cat' ? catStatusFilter === s.statusKey : subStatusFilter === s.statusKey
              )
              return (
                <div
                  key={s.key}
                  onClick={() => {
                    setTab(s.tab)
                    if (s.tab === 'cat') setCatStatusFilter(s.statusKey)
                    else                 setSubStatusFilter(s.statusKey)
                  }}
                  style={{
                    background:   isActive ? st.iconBg : st.bg,
                    border:       `1.5px solid ${isActive ? st.iconColor : st.borderColor}`,
                    borderRadius: 10,
                    padding:      '13px 15px',
                    cursor:       'pointer',
                    display:      'flex',
                    alignItems:   'center',
                    gap:          11,
                    boxShadow:    isActive ? `0 0 0 3px ${st.borderColor}` : 'var(--shadow)',
                    transition:   'all 0.15s',
                  }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 9, flexShrink: 0, background: st.iconBg, border: `1px solid ${st.borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={17} style={{ color: st.iconColor }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: st.textColor, marginBottom: 2 }}>{s.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: st.textColor, lineHeight: 1 }}>{s.val}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* ── tabs ── */}
      <div style={{ display:'flex', borderBottom:'2px solid var(--border)', marginBottom:20 }}>
        {[
          { key:'cat', label:`Categories (${categories.length})`         },
          { key:'sub', label:`Sub-Categories (${subCategories.length})`  },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding:'10px 22px', border:'none', cursor:'pointer', fontSize:13,
            fontWeight: tab===t.key ? 700 : 400,
            color:      tab===t.key ? 'var(--primary)' : 'var(--text-muted)',
            background: 'transparent',
            borderBottom: tab===t.key ? '2px solid var(--primary)' : '2px solid transparent',
            marginBottom: -2, transition:'all .15s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════
          CATEGORIES TAB
      ════════════════════════════════════════════ */}
      {tab === 'cat' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">All Categories ({filteredCats.length})</span>
            <div className="header-actions">
              <div className="search-bar">
                <Search size={14} />
                <input placeholder="Search by name or code…" value={catSearch} onChange={e => setCatSearch(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{width:44}}>#</th>
                  <th>Category Code</th>
                  <th>Category Name</th>
                  <th style={{textAlign:'center'}}>Products</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th className="col-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingData && (
                  <tr><td colSpan={7}>
                    <div className="table-empty">Loading…</div>
                  </td></tr>
                )}
                {!loadingData && filteredCats.map((cat, i) => {
                  const id = cat._id || cat.id
                  return (
                    <tr key={id}>
                      <td style={{color:'var(--text-muted)',fontSize:12}}>{i+1}</td>

                      {/* Category Code */}
                      <td>
                        {cat.code
                          ? <span style={{
                              display:'inline-block', fontFamily:'monospace', fontSize:12, fontWeight:800,
                              color:'var(--primary)', letterSpacing:'0.3px', whiteSpace:'nowrap',
                            }}>{cat.code}</span>
                          : <span style={{color:'var(--text-light)',fontSize:12}}>—</span>
                        }
                      </td>

                      {/* Category Name */}
                      <td>
                        <div style={{display:'flex',alignItems:'center',gap:9}}>
                          <div style={{width:32,height:32,borderRadius:8,background:'#EFF6FF',border:'1px solid #BFDBFE',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                            <FolderOpen size={14} color="#2563EB" />
                          </div>
                          <span style={{fontWeight:700,fontSize:13}}>{cat.name}</span>
                        </div>
                      </td>

                      {/* Products count */}
                      <td style={{textAlign:'center'}}>
                        <span style={{
                          display:'inline-block', padding:'2px 10px', borderRadius:12, minWidth:24, textAlign:'center',
                          background:'#F5F3FF', color:'#7C3AED', fontSize:12, fontWeight:700,
                          border:'1px solid #DDD6FE',
                        }}>
                          {cat.product_count ?? 0}
                        </span>
                      </td>

                      {/* Description */}
                      <td style={{color:'var(--text-muted)',fontSize:12,maxWidth:220,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{cat.description || '—'}</td>

                      {/* Status */}
                      <td>
                        <span style={{
                          display:'inline-flex', alignItems:'center', gap:4,
                          fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20,
                          background: cat.is_active !== false ? '#ECFDF5' : '#FEF2F2',
                          color:      cat.is_active !== false ? '#059669' : '#DC2626',
                          border:     `1px solid ${cat.is_active !== false ? '#A7F3D0' : '#FECACA'}`,
                        }}>
                          {cat.is_active !== false ? <CheckCircle size={10}/> : <XCircle size={10}/>}
                          {cat.is_active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="col-right">
                        <div className="table-actions" style={{justifyContent:'flex-end'}}>
                          <button className="btn btn-ghost btn-xs" title="Edit" onClick={() => openEditCat(cat)} style={{color:'#3B82F6'}}><Edit2 size={13}/></button>
                          <button className="btn btn-ghost btn-xs" title={cat.is_active!==false?'Deactivate':'Activate'} onClick={() => toggleCat(cat)} style={{color: cat.is_active!==false ? '#059669' : '#94A3B8'}}>
                            {cat.is_active!==false ? <ToggleRight size={15}/> : <ToggleLeft size={15}/>}
                          </button>
                          <button className="btn btn-ghost btn-xs" title="Delete" onClick={() => deleteCat(id)} style={{color:'#EF4444'}}><Trash2 size={13}/></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {!loadingData && filteredCats.length === 0 && (
                  <tr><td colSpan={7}>
                    <div className="table-empty">
                      <div className="table-empty-icon"><FolderOpen style={{width:20}}/></div>
                      <div style={{fontWeight:600,color:'var(--text)'}}>No categories found</div>
                      <div style={{marginTop:3}}>
                        {catSearch ? 'Try adjusting your search.' : 'Click "Add Category" to create your first category.'}
                      </div>
                    </div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          SUB-CATEGORIES TAB
      ════════════════════════════════════════════ */}
      {tab === 'sub' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              {subCatFilter === 'All'
                ? `All Sub-Categories (${filteredSubs.length})`
                : `${categories.find(c => (c._id||c.id) === subCatFilter)?.name || 'Category'} — Sub-Categories (${filteredSubs.length})`}
            </span>
            <div className="header-actions">
              {/* Searchable category selector */}
              {(() => {
                const q = catPickerSearch.trim().toLowerCase()
                const matches = categories.filter(c => !q || (c.name||'').toLowerCase().includes(q) || (c.code||'').toLowerCase().includes(q))
                const selName = subCatFilter === 'All' ? '' : (categories.find(c => (c._id||c.id) === subCatFilter)?.name || '')
                return (
                  <div style={{ position: 'relative', width: 260 }}>
                    <div className="search-bar" style={{ width: '100%', cursor: 'pointer' }} onClick={() => setCatPickerOpen(o => !o)}>
                      <Search size={14} />
                      <input
                        placeholder={selName || 'Select or search category…'}
                        value={catPickerSearch}
                        onChange={e => { setCatPickerSearch(e.target.value); setCatPickerOpen(true) }}
                        onFocus={() => setCatPickerOpen(true)}
                        style={{ cursor: 'text' }}
                      />
                      {subCatFilter !== 'All'
                        ? <X size={14} style={{ color: 'var(--text-light)', cursor: 'pointer' }}
                            onClick={(e) => { e.stopPropagation(); setSubCatFilter('All'); setCatPickerSearch('') }} />
                        : <ChevronDown size={14} style={{ color: 'var(--text-light)' }} />}
                    </div>
                    {catPickerOpen && (
                      <>
                        <div style={{ position: 'fixed', inset: 0, zIndex: 20 }} onClick={() => setCatPickerOpen(false)} />
                        <div style={{
                          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 21,
                          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
                          boxShadow: 'var(--shadow-lg)', maxHeight: 260, overflowY: 'auto',
                        }}>
                          {/* All categories option */}
                          <button type="button"
                            onClick={() => { setSubCatFilter('All'); setCatPickerSearch(''); setCatPickerOpen(false) }}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 14px', border: 'none', borderBottom: '1px solid var(--border)', background: subCatFilter === 'All' ? 'var(--bg)' : 'none', textAlign: 'left', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                            <FolderOpen size={14} color="var(--text-muted)" /> All Categories
                          </button>
                          {matches.length === 0 ? (
                            <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-muted)' }}>No categories match.</div>
                          ) : matches.map(c => {
                            const cid = c._id || c.id
                            const count = subCategories.filter(s => s.parent_id?.toString() === cid).length
                            const active = subCatFilter === cid
                            return (
                              <button key={cid} type="button"
                                onClick={() => { setSubCatFilter(cid); setCatPickerSearch(''); setCatPickerOpen(false) }}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 14px', border: 'none', borderBottom: '1px solid var(--border)', background: active ? 'var(--bg)' : 'none', textAlign: 'left', cursor: 'pointer' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                                onMouseLeave={e => e.currentTarget.style.background = active ? 'var(--bg)' : 'none'}>
                                <Tag size={13} color="var(--primary)" />
                                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                                <span className="badge badge-gray" style={{ fontSize: 10 }}>{count}</span>
                              </button>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{width:44}}>#</th>
                  <th>Sub-Category Code</th>
                  <th>Sub-Category Name</th>
                  <th>Category Name</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th className="col-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingData && (
                  <tr><td colSpan={7}>
                    <div className="table-empty">Loading…</div>
                  </td></tr>
                )}
                {!loadingData && filteredSubs.map((s, i) => {
                  const id = s._id || s.id
                  return (
                    <tr key={id}>
                      <td style={{color:'var(--text-muted)',fontSize:12}}>{i+1}</td>

                      {/* Sub-Category Code */}
                      <td>
                        {s.code
                          ? <span style={{
                              display:'inline-block', fontFamily:'monospace', fontSize:12, fontWeight:800,
                              color:'var(--primary)', letterSpacing:'0.3px', whiteSpace:'nowrap',
                            }}>{s.code}</span>
                          : <span style={{color:'var(--text-light)',fontSize:12}}>—</span>
                        }
                      </td>

                      {/* Sub-Category Name */}
                      <td>
                        <div style={{display:'flex',alignItems:'center',gap:9}}>
                          <div style={{width:32,height:32,borderRadius:8,background:'#FFF7ED',border:'1px solid #FED7AA',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                            <Tag size={14} color="#EA580C" />
                          </div>
                          <span style={{fontWeight:700,fontSize:13}}>{s.name}</span>
                        </div>
                      </td>

                      {/* Category Name */}
                      <td>
                        <span className="badge badge-blue">{s.category_name || '—'}</span>
                      </td>

                      {/* Description */}
                      <td style={{color:'var(--text-muted)',fontSize:12,maxWidth:220,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.description || '—'}</td>

                      {/* Status */}
                      <td>
                        <span style={{
                          display:'inline-flex', alignItems:'center', gap:4,
                          fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20,
                          background: s.is_active !== false ? '#ECFDF5' : '#FEF2F2',
                          color:      s.is_active !== false ? '#059669' : '#DC2626',
                          border:     `1px solid ${s.is_active !== false ? '#A7F3D0' : '#FECACA'}`,
                        }}>
                          {s.is_active !== false ? <CheckCircle size={10}/> : <XCircle size={10}/>}
                          {s.is_active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="col-right">
                        <div className="table-actions" style={{justifyContent:'flex-end'}}>
                          <button className="btn btn-ghost btn-xs" title="Edit" onClick={() => openEditSub(s)} style={{color:'#3B82F6'}}><Edit2 size={13}/></button>
                          <button className="btn btn-ghost btn-xs" title={s.is_active!==false?'Deactivate':'Activate'} onClick={() => toggleSub(s)} style={{color: s.is_active!==false ? '#059669' : '#94A3B8'}}>
                            {s.is_active!==false ? <ToggleRight size={15}/> : <ToggleLeft size={15}/>}
                          </button>
                          <button className="btn btn-ghost btn-xs" title="Delete" onClick={() => deleteSub(id)} style={{color:'#EF4444'}}><Trash2 size={13}/></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {!loadingData && filteredSubs.length === 0 && (
                  <tr><td colSpan={7}>
                    <div className="table-empty">
                      <div className="table-empty-icon"><Tag style={{width:20}}/></div>
                      <div style={{fontWeight:600,color:'var(--text)'}}>No sub-categories found</div>
                      <div style={{marginTop:3}}>
                        {subSearch ? 'Try adjusting your search.' : 'Click "Add Sub-Category" to create your first sub-category.'}
                      </div>
                    </div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          CATEGORY MODAL
      ════════════════════════════════════════════ */}
      {showCat && (
        <div className="modal-overlay" onClick={closeCat}>
          <div className="modal" style={{maxWidth:500}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editCat ? 'Edit Category' : 'Add New Category'}</span>
              <button className="modal-close" onClick={closeCat}>✕</button>
            </div>
            <div className="modal-body">

              {/* Category Code */}
              <div className="form-group">
                <label className="form-label">Category Code</label>
                <input
                  className="form-control"
                  placeholder="e.g. TIL-001, SAN-001"
                  value={catForm.code}
                  autoFocus
                  onChange={e => setCatForm(f => ({...f, code:e.target.value}))}
                />
                <span style={{fontSize:11,color:'var(--text-muted)',marginTop:4,display:'block'}}>A short unique code for this category (optional)</span>
              </div>

              {/* Category Name */}
              <div className="form-group">
                <label className="form-label">Category Name *</label>
                <input
                  className={`form-control${catErr.name?' input-error':''}`}
                  placeholder="e.g. Tiles, Sanitaryware"
                  value={catForm.name}
                  onChange={e => setCatForm(f => ({...f, name:e.target.value}))}
                />
                {catErr.name && <span style={{color:'var(--danger)',fontSize:11,marginTop:4,display:'block'}}>{catErr.name}</span>}
              </div>

              {/* Description */}
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Brief description (optional)"
                  value={catForm.description}
                  onChange={e => setCatForm(f => ({...f, description:e.target.value}))}
                />
              </div>

              {/* Status */}
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-control" value={catForm.is_active?'active':'inactive'} onChange={e => setCatForm(f => ({...f, is_active:e.target.value==='active'}))}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeCat}>Cancel</button>
              <button className="btn btn-primary" disabled={catBusy} onClick={saveCat}>
                {catBusy ? 'Saving…' : (editCat ? 'Update Category' : 'Save Category')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          SUB-CATEGORY MODAL
      ════════════════════════════════════════════ */}
      {showSub && (
        <div className="modal-overlay" onClick={closeSub}>
          <div className="modal" style={{maxWidth:520}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editSub ? 'Edit Sub-Category' : 'Add New Sub-Category'}</span>
              <button className="modal-close" onClick={closeSub}>✕</button>
            </div>
            <div className="modal-body">

              {/* Category Name (parent) */}
              <div className="form-group">
                <label className="form-label">Category Name *</label>
                <select
                  className={`form-control${subErr.category_id?' input-error':''}`}
                  value={subForm.category_id}
                  onChange={e => setSubForm(f => ({...f, category_id:e.target.value}))}
                >
                  <option value="">— Select Parent Category —</option>
                  {activeCategories.map(c => (
                    <option key={c._id||c.id} value={c._id||c.id}>
                      {c.name}{c.code ? ` (${c.code})` : ''}
                    </option>
                  ))}
                </select>
                {subErr.category_id && <span style={{color:'var(--danger)',fontSize:11,marginTop:4,display:'block'}}>{subErr.category_id}</span>}
              </div>

              {/* Sub-Category Name + Code side by side */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Sub-Category Name *</label>
                  <input
                    className={`form-control${subErr.name?' input-error':''}`}
                    placeholder="e.g. Floor Tiles"
                    value={subForm.name}
                    autoFocus={!editSub}
                    onChange={e => setSubForm(f => ({...f, name:e.target.value}))}
                  />
                  {subErr.name && <span style={{color:'var(--danger)',fontSize:11,marginTop:4,display:'block'}}>{subErr.name}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label">Sub-Category Code *</label>
                  <input
                    className={`form-control${subErr.code?' input-error':''}`}
                    placeholder="e.g. FLT"
                    value={subForm.code}
                    onChange={e => setSubForm(f => ({...f, code:e.target.value}))}
                  />
                  {subErr.code && <span style={{color:'var(--danger)',fontSize:11,marginTop:4,display:'block'}}>{subErr.code}</span>}
                </div>
              </div>

              {/* Description */}
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Brief description (optional)"
                  value={subForm.description}
                  onChange={e => setSubForm(f => ({...f, description:e.target.value}))}
                />
              </div>

              {/* Status */}
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-control" value={subForm.is_active?'active':'inactive'} onChange={e => setSubForm(f => ({...f, is_active:e.target.value==='active'}))}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeSub}>Cancel</button>
              <button className="btn btn-primary" disabled={subBusy} onClick={saveSub}>
                {subBusy ? 'Saving…' : (editSub ? 'Update Sub-Category' : 'Save Sub-Category')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* toast */}
      {toast && (
        <div className="alert alert-info" style={{position:'fixed',bottom:24,right:24,zIndex:9999,boxShadow:'0 4px 16px rgba(0,0,0,.15)'}}>
          ✓ {toast}
        </div>
      )}
    </>
  )
}
