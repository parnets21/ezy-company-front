import { useState, useEffect, useMemo } from 'react'
import { Search, Trash2, Shield, Check, X, Save, Users, UserCheck, UserX, Crown, Lock, ChevronDown } from 'lucide-react'
import { rolePermissionApi } from '../api/rolePermissionApi'
import { userApi } from '../api/userApi'
import { PERMISSION_CATALOG } from '../config/permissions'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const PAGE_SIZE = 10

const ROLES = ['Super Admin', 'Company Owner', 'Manager', 'Accountant', 'Sales Executive', 'Warehouse Staff', 'Retailer', 'Wholesaler']

const roleColors = {
  'Super Admin':    'badge-purple',
  'Company Owner':  'badge-blue',
  'Manager':        'badge-cyan',
  'Accountant':     'badge-green',
  'Sales Executive':'badge-orange',
  'Warehouse Staff':'badge-yellow',
  'Retailer':       'badge-red',
  'Wholesaler':     'badge-gray',
}

// Solid accent color per role (used for the dot in the role selector).
const ROLE_DOT = {
  'Super Admin':     '#7C3AED',
  'Company Owner':   '#2563EB',
  'Manager':         '#0891B2',
  'Accountant':      '#059669',
  'Sales Executive': '#F26522',
  'Warehouse Staff': '#CA8A04',
  'Retailer':        '#DC2626',
  'Wholesaler':      '#64748B',
}

function normalizeRolePermissions(role, rawPermissions, modules) {
  const normalized = {}
  const raw = rawPermissions || {}

  modules.forEach(module => {
    const storedModule = raw[module.key]
    normalized[module.key] = {}
    ;(module.actions || []).forEach(action => {
      normalized[module.key][action.key] = role === 'Super Admin'
        ? true
        : typeof storedModule === 'boolean'
          ? storedModule
          : storedModule?.[action.key] === true
    })
  })

  return normalized
}

function normalizePermissionPayload(payload = {}) {
  const apiModules = Array.isArray(payload.modules) ? payload.modules : []
  const modules = apiModules.some(module => Array.isArray(module.actions) && module.actions.length)
    ? apiModules
    : PERMISSION_CATALOG
  const apiRoles = new Map((payload.roles || []).map(item => [item.role, item]))
  const byRole = {}
  const locked = {}

  ROLES.forEach(role => {
    const apiRole = apiRoles.get(role)
    byRole[role] = normalizeRolePermissions(role, apiRole?.permissions, modules)
    locked[role] = role === 'Super Admin' || apiRole?.locked === true
  })

  return { modules, byRole, locked }
}

export default function UserManagement({ users = [], deleteUser, loadingData }) {
  const { user: currentUser } = useAuth()
  const [mainTab, setMainTab] = useState('users')
  const [search, setSearch]       = useState('')
  const [roleFilter, setRoleFilter] = useState('All')
  const [page, setPage]           = useState(1)
  const [successMsg, setSuccessMsg] = useState('')
  const [selectedRole, setSelectedRole] = useState(0)
  const [expandedModule, setExpandedModule] = useState(null)

  // ── Roles & Permissions (live, DB-backed) ──────────────────
  const [permModules, setPermModules] = useState([])   // [{ key, label, category, actions }]
  const [permByRole, setPermByRole]   = useState({})    // { role: { module: { action: bool } } }
  const [lockedRoles, setLockedRoles] = useState({})
  const [draft, setDraft]             = useState(null)
  const [permLoading, setPermLoading] = useState(false)
  const [permSaving, setPermSaving]   = useState(false)
  const [permSaved, setPermSaved]     = useState(false)

  // Admin access assignment for already registered people.
  const [showAccessModal, setShowAccessModal] = useState(false)
  const [accessCandidates, setAccessCandidates] = useState([])
  const [accessPages, setAccessPages] = useState([])
  const [accessLoading, setAccessLoading] = useState(false)
  const [accessSaving, setAccessSaving] = useState(false)
  const [accessSearch, setAccessSearch] = useState('')
  const [selectedAccessIds, setSelectedAccessIds] = useState([])
  const [activeAccessId, setActiveAccessId] = useState(null)
  const [accessDrafts, setAccessDrafts] = useState({})

  const toast = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3500) }

  const selectedRoleName = ROLES[selectedRole]

  // Load the permission matrix when the Roles tab is opened.
  useEffect(() => {
    if (mainTab !== 'roles' || permModules.length) return
    let cancelled = false
    setPermLoading(true)
    rolePermissionApi.list()
      .then(res => {
        const payload = res?.data || res
        if (cancelled) return
        const normalized = normalizePermissionPayload(payload)
        setPermModules(normalized.modules)
        setPermByRole(normalized.byRole)
        setLockedRoles(normalized.locked)
      })
      .catch(() => { if (!cancelled) toast('Error: could not load permissions') })
      .finally(() => { if (!cancelled) setPermLoading(false) })
    return () => { cancelled = true }
  }, [mainTab]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!showAccessModal) return
    let cancelled = false
    userApi.accessCandidates()
      .then(res => {
        const payload = res?.data || res
        if (cancelled) return
        setAccessCandidates(payload?.users || [])
        setAccessPages(payload?.pages || [])
        setSelectedAccessIds([])
        setActiveAccessId(null)
        setAccessDrafts({})
      })
      .catch(err => { if (!cancelled) toast(`Error: ${err.response?.data?.message || 'could not load registered persons'}`) })
      .finally(() => { if (!cancelled) setAccessLoading(false) })
    return () => { cancelled = true }
  }, [showAccessModal])

  // Grouped catalog reused by the Roles & Permissions editor.

  // Sync the editable draft whenever the selected role or loaded data changes.
  useEffect(() => {
    if (!permByRole[selectedRoleName]) { setDraft(null); return }
    setDraft(structuredClone(permByRole[selectedRoleName]))
    setPermSaved(false)
  }, [selectedRoleName, permByRole])

  // Modules grouped by category for a clean, scannable layout.
  const groupedModules = useMemo(() => {
    const groups = {}
    permModules.forEach(m => { (groups[m.category] ||= []).push(m) })
    return Object.entries(groups)  // [ [category, modules[]], ... ]
  }, [permModules])

  const groupedAccessPages = useMemo(() => {
    const groups = {}
    accessPages.forEach(pageItem => { (groups[pageItem.category || 'Pages'] ||= []).push(pageItem) })
    return Object.entries(groups)
  }, [accessPages])

  const isLocked = !!lockedRoles[selectedRoleName]
  const dirty = draft && permByRole[selectedRoleName] &&
    JSON.stringify(draft) !== JSON.stringify(permByRole[selectedRoleName])

  const enabledCount = draft
    ? Object.values(draft).reduce((total, actions) => total + Object.values(actions || {}).filter(Boolean).length, 0)
    : 0
  const totalActionCount = permModules.reduce((total, module) => total + (module.actions?.length || 0), 0)
  const selectedRoleUserCount = users.filter(user => user.role === selectedRoleName).length
  const enabledPercent = totalActionCount ? Math.round((enabledCount / totalActionCount) * 100) : 0

  const filtered = users.filter(u =>
    (roleFilter === 'All' || u.role === roleFilter) &&
    ((u.name || '').toLowerCase().includes(search.toLowerCase()) ||
     (u.email || '').toLowerCase().includes(search.toLowerCase()))
  )

  // ── Pagination (10 rows per page) ──────────────────────────
  const total       = filtered.length
  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage    = Math.min(page, totalPages)
  const paged       = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const handleDelete = async (id) => {
    const result = await deleteUser?.(id)
    if (result?.success === false) toast(`Error: ${result.message}`)
    else toast('User removed')
  }

  const togglePermission = (moduleKey, actionKey) => {
    if (isLocked) return
    setDraft(prev => ({
      ...prev,
      [moduleKey]: {
        ...(prev?.[moduleKey] || {}),
        [actionKey]: !prev?.[moduleKey]?.[actionKey],
      },
    }))
    setPermSaved(false)
  }

  const setModuleActions = (module, value) => {
    if (isLocked) return
    setDraft(prev => {
      const next = structuredClone(prev || {})
      next[module.key] ||= {}
      module.actions.forEach(item => { next[module.key][item.key] = value })
      return next
    })
    setPermSaved(false)
  }

  const handlePermReset = () => {
    if (permByRole[selectedRoleName]) setDraft(structuredClone(permByRole[selectedRoleName]))
    setPermSaved(false)
  }

  const handlePermSave = async () => {
    if (isLocked || !draft) return
    setPermSaving(true)
    try {
      const res = await rolePermissionApi.update(selectedRoleName, draft)
      const payload = res?.data || res
      const saved = normalizeRolePermissions(
        selectedRoleName,
        payload?.permissions || draft,
        permModules,
      )
      setPermByRole(prev => ({ ...prev, [selectedRoleName]: saved }))
      setDraft(structuredClone(saved))
      setPermSaved(true)
      toast(`Permissions saved for ${selectedRoleName}`)
      setTimeout(() => setPermSaved(false), 2500)
    } catch (err) {
      toast(`Error: ${err.response?.data?.message || 'could not save permissions'}`)
    } finally {
      setPermSaving(false)
    }
  }

  const accessPersonId = person => String(person?._id || person?.id || '')
  const filteredAccessCandidates = accessCandidates.filter(person => {
    const query = accessSearch.trim().toLowerCase()
    return !query || [person.name, person.email, person.mobile, person.company_name, person.role]
      .some(value => String(value || '').toLowerCase().includes(query))
  })
  const activeAccessPerson = accessCandidates.find(person => accessPersonId(person) === activeAccessId)

  const toggleAccessPerson = person => {
    const id = accessPersonId(person)
    if (!id) return
    if (selectedAccessIds.includes(id)) {
      const remaining = selectedAccessIds.filter(selectedId => selectedId !== id)
      setSelectedAccessIds(remaining)
      if (activeAccessId === id) setActiveAccessId(remaining[0] || null)
      return
    }
    setSelectedAccessIds(prev => [...prev, id])
    setActiveAccessId(id)
    setAccessDrafts(prev => prev[id] ? prev : {
      ...prev,
      [id]: structuredClone(person.access_permissions || {}),
    })
  }

  const toggleAccessPage = pageKey => {
    if (!activeAccessId) return
    setAccessDrafts(prev => {
      const next = structuredClone(prev)
      const personPermissions = next[activeAccessId] || {}
      const modulePermissions = personPermissions[pageKey] || {}
      next[activeAccessId] = {
        ...personPermissions,
        [pageKey]: { ...modulePermissions, view: modulePermissions.view !== true },
      }
      return next
    })
  }

  const handleAccessSave = async () => {
    if (!selectedAccessIds.length) { toast('Select at least one registered person'); return }
    setAccessSaving(true)
    try {
      await Promise.all(selectedAccessIds.map(id => userApi.updateAccess(id, accessDrafts[id] || {})))
      setAccessCandidates(prev => prev.map(person => {
        const id = accessPersonId(person)
        return selectedAccessIds.includes(id) ? { ...person, access_permissions: accessDrafts[id] } : person
      }))
      setShowAccessModal(false)
      toast(`Page access saved for ${selectedAccessIds.length} person${selectedAccessIds.length === 1 ? '' : 's'}`)
    } catch (err) {
      toast(`Error: ${err.response?.data?.message || 'could not save page access'}`)
    } finally {
      setAccessSaving(false)
    }
  }

  return (
    <>
      <div className="breadcrumb">
        <span>Company</span><span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-active">User & Role Management</span>
      </div>

      {/* Page header */}
      <div className="page-header" style={{ marginBottom: 18 }}>
        <div className="page-header-left">
          <div className="page-title">User & Role Management</div>
          <div className="page-desc">Manage system users, roles and module-level permissions</div>
        </div>
      </div>

      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserCheck style={{ width: 16, flexShrink: 0 }} />
          <span style={{ fontWeight: 600 }}>{successMsg}</span>
        </div>
      )}

      {/* ── Main Tab switcher ── */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        <button className={`tab-btn${mainTab === 'users' ? ' active' : ''}`} onClick={() => setMainTab('users')}>
          👥 User Access
        </button>
        <button className={`tab-btn${mainTab === 'roles' ? ' active' : ''}`} onClick={() => setMainTab('roles')}>
          🛡️ Roles & Permissions
        </button>
      </div>

      {/* ══════════════════════════════════════════
          TAB: USER MANAGEMENT
      ══════════════════════════════════════════ */}
      {mainTab === 'users' && (
        <>
          {['Super Admin', 'Company Owner'].includes(currentUser?.role) && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
              <button className="btn btn-primary" onClick={() => { setAccessSearch(''); setAccessLoading(true); setShowAccessModal(true) }}>
                <Shield />Give Access
              </button>
            </div>
          )}

          {/* Summary row — Total + Active + Inactive */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
            {[
              { key: 'All',      label: 'Total Users',    value: users.length,                                         bg: '#EFF6FF', iconBg: '#DBEAFE', iconColor: '#2563EB', textColor: '#1D4ED8', borderColor: '#BFDBFE', Icon: Users       },
              { key: 'Active',   label: 'Active',          value: users.filter(u => u.is_active !== false).length,      bg: '#ECFDF5', iconBg: '#D1FAE5', iconColor: '#059669', textColor: '#047857', borderColor: '#A7F3D0', Icon: UserCheck   },
              { key: 'Inactive', label: 'Inactive',        value: users.filter(u => u.is_active === false).length,      bg: '#FEF2F2', iconBg: '#FEE2E2', iconColor: '#DC2626', textColor: '#B91C1C', borderColor: '#FECACA', Icon: UserX       },
              { key: 'Admin',    label: 'Admins',          value: users.filter(u => u.role === 'Super Admin' || u.role === 'Company Owner').length, bg: '#F5F3FF', iconBg: '#EDE9FE', iconColor: '#7C3AED', textColor: '#6D28D9', borderColor: '#DDD6FE', Icon: Crown },
            ].map(s => {
              const active = roleFilter === s.key
              return (
                <div
                  key={s.key}
                  onClick={() => setRoleFilter(active ? 'All' : s.key)}
                  style={{
                    background:   active ? s.iconBg  : s.bg,
                    border:       `1.5px solid ${active ? s.iconColor : s.borderColor}`,
                    borderRadius: 10,
                    padding:      '12px 14px',
                    cursor:       'pointer',
                    display:      'flex',
                    alignItems:   'center',
                    gap:          10,
                    boxShadow:    active ? `0 0 0 3px ${s.borderColor}` : 'var(--shadow)',
                    transition:   'all 0.15s',
                  }}
                >
                  <div style={{ width: 38, height: 38, borderRadius: 9, flexShrink: 0, background: s.iconBg, border: `1px solid ${s.borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <s.Icon style={{ width: 16, height: 16, color: s.iconColor }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: s.textColor, marginBottom: 1 }}>{s.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: s.textColor, lineHeight: 1 }}>{s.value}</div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="card-title">
                  {roleFilter === 'All' ? `All Users` : roleFilter}
                  {' '}({filtered.length})
                </span>
                {roleFilter !== 'All' && (
                  <button
                    onClick={() => setRoleFilter('All')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#FFF3EC', color: '#FD5C02', border: '1px solid #FED7B8', cursor: 'pointer' }}
                  >
                    <X style={{ width: 10 }} /> Clear filter
                  </button>
                )}
              </div>
              <div className="header-actions">
                <div className="search-bar">
                  <Search /><input placeholder="Search users…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
                </div>
                <select className="form-control" style={{ width: 160 }} value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1) }}>
                  <option value="All">All Roles</option>
                  {ROLES.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>User</th><th>Mobile</th><th>Role</th><th>Joined</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {loadingData && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>Loading…</td></tr>}
                  {!loadingData && paged.map(u => {
                    const id = u._id || u.id
                    const joinedStr = u.created_at
                      ? new Date(u.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                      : (u.joined || '—')
                    return (
                      <tr key={id}>
                        <td>
                          <div className="user-info">
                            <div className="avatar avatar-purple">{(u.name || '?').charAt(0)}</div>
                            <div><div className="user-name">{u.name}</div><div className="user-role">{u.email}</div></div>
                          </div>
                        </td>
                        <td style={{ fontSize: 12 }}>{u.mobile || '—'}</td>
                        <td><span className={`badge ${roleColors[u.role] || 'badge-gray'}`}>{u.role}</span></td>
                        <td style={{ fontSize: 12 }}>{joinedStr}</td>
                        <td><span className={`badge ${u.is_active !== false ? 'badge-green' : 'badge-red'}`}>{u.is_active !== false ? 'Active' : 'Inactive'}</span></td>
                        <td>
                          <div className="table-actions">
                            <button className="btn btn-secondary btn-xs" title="Edit role defaults"
                              onClick={() => { setSelectedRole(ROLES.indexOf(u.role) >= 0 ? ROLES.indexOf(u.role) : 0); setMainTab('roles') }}>
                              <Shield style={{ width: 12 }} />Role defaults
                            </button>
                            <button className="btn btn-ghost btn-xs" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(id)}>
                              <Trash2 style={{ width: 13 }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {!loadingData && filtered.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No users found</td></tr>
                  )}
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

          {showAccessModal && (
            <div className="modal-overlay" onClick={() => setShowAccessModal(false)}>
              <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 1120, width: '96%' }}>
                <div className="modal-header">
                  <div>
                    <div className="modal-title">Give Web Access</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 3 }}>Select registered persons, then choose the sidebar pages each person can open.</div>
                  </div>
                  <button className="btn-ghost" onClick={() => setShowAccessModal(false)}>✕</button>
                </div>
                <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 0.8fr) minmax(0, 1.5fr)', gap: 18, minHeight: 480 }}>
                  <section style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 750, fontSize: 13, marginBottom: 8 }}>Registered persons ({accessCandidates.length})</div>
                      <div className="search-bar" style={{ width: '100%' }}>
                        <Search /><input placeholder="Search name, mobile, company…" value={accessSearch} onChange={e => setAccessSearch(e.target.value)} />
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 7 }}>{selectedAccessIds.length} selected</div>
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                      {accessLoading && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading registered persons…</div>}
                      {!accessLoading && filteredAccessCandidates.map(person => {
                        const id = accessPersonId(person)
                        const selected = selectedAccessIds.includes(id)
                        return (
                          <label key={id} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '10px 12px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: selected ? '#FFF7F1' : '#fff' }}>
                            <input type="checkbox" checked={selected} onChange={() => toggleAccessPerson(person)} style={{ marginTop: 3, accentColor: 'var(--primary)' }} />
                            <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <strong style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.name || 'Unnamed person'}</strong>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{person.mobile || person.email || 'No contact details'}</span>
                              <span style={{ fontSize: 10.5, color: 'var(--text-light)' }}>{[person.company_name, person.role].filter(Boolean).join(' · ')}</span>
                            </span>
                          </label>
                        )
                      })}
                      {!accessLoading && filteredAccessCandidates.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>No registered persons found.</div>}
                    </div>
                  </section>

                  <section style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <div style={{ padding: 12, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 750, fontSize: 13 }}>Sidebar page access</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>Permissions are set separately for each selected person.</div>
                      </div>
                      {activeAccessPerson && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <button type="button" className="btn btn-secondary btn-xs" onClick={() => setAccessDrafts(prev => {
                            const next = structuredClone(prev)
                            next[activeAccessId] ||= {}
                            accessPages.forEach(pageItem => { next[activeAccessId][pageItem.key] = { ...(next[activeAccessId][pageItem.key] || {}), view: true } })
                            return next
                          })}>Select all</button>
                          <button type="button" className="btn btn-secondary btn-xs" onClick={() => setAccessDrafts(prev => {
                            const next = structuredClone(prev)
                            next[activeAccessId] ||= {}
                            accessPages.forEach(pageItem => { next[activeAccessId][pageItem.key] = { ...(next[activeAccessId][pageItem.key] || {}), view: false } })
                            return next
                          })}>Clear all</button>
                        </div>
                      )}
                    </div>
                    {selectedAccessIds.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, padding: '9px 12px', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
                        {selectedAccessIds.map(id => {
                          const person = accessCandidates.find(item => accessPersonId(item) === id)
                          const active = id === activeAccessId
                          return <button key={id} type="button" className={`btn btn-xs ${active ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveAccessId(id)} style={{ whiteSpace: 'nowrap' }}>{person?.name || 'Person'}</button>
                        })}
                      </div>
                    )}
                    <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
                      {accessLoading && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading sidebar pages…</div>}
                      {!accessLoading && !activeAccessPerson && <div style={{ padding: 34, textAlign: 'center', color: 'var(--text-muted)' }}>Select one or more persons to assign their page access.</div>}
                      {!accessLoading && activeAccessPerson && (
                        <>
                          <div style={{ marginBottom: 13, padding: '9px 11px', borderRadius: 8, background: '#F8FAFC', fontSize: 12 }}>
                            Access for <strong>{activeAccessPerson.name}</strong> <span style={{ color: 'var(--text-muted)' }}>({activeAccessPerson.company_name || activeAccessPerson.role})</span>
                          </div>
                          {groupedAccessPages.map(([category, pages]) => (
                            <div key={category} style={{ marginBottom: 15 }}>
                              <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.45px', color: 'var(--text-muted)', marginBottom: 7 }}>{category}</div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 7 }}>
                                {pages.map(pageItem => {
                                  const enabled = accessDrafts[activeAccessId]?.[pageItem.key]?.view === true
                                  return (
                                    <label key={pageItem.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 9px', border: `1px solid ${enabled ? '#FDBA8C' : 'var(--border)'}`, borderRadius: 7, background: enabled ? '#FFF8F3' : '#fff', fontSize: 11.5, cursor: 'pointer' }}>
                                      <input type="checkbox" checked={enabled} onChange={() => toggleAccessPage(pageItem.key)} style={{ accentColor: 'var(--primary)' }} />
                                      <span>{pageItem.label}</span>
                                    </label>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </section>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setShowAccessModal(false)}>Cancel</button>
                  <button className="btn btn-primary" disabled={accessSaving || accessLoading || selectedAccessIds.length === 0} onClick={handleAccessSave}>{accessSaving ? 'Saving…' : `Save Access${selectedAccessIds.length ? ` (${selectedAccessIds.length})` : ''}`}</button>
                </div>
              </div>
            </div>
          )}

          
        </>
      )}

      {/* ══════════════════════════════════════════
          TAB: ROLES & PERMISSIONS
      ══════════════════════════════════════════ */}
      {mainTab === 'roles' && (
        <>
          <div className="permissions-note">
            <div className="permissions-note-icon"><Shield size={17} /></div>
            <div>
              <strong>Role-based access control</strong>
              <span>Changes apply automatically to every user assigned to the selected role.</span>
            </div>
            <span className="permissions-note-lock"><Lock size={12} /> Super Admin is protected</span>
          </div>

          <div className="permissions-layout">
            <aside className="card permissions-role-panel">
              <div className="permissions-role-heading">
                <div>
                  <div className="card-title">System Roles</div>
                  <div className="permissions-subtitle">Choose a role to configure</div>
                </div>
                <span className="permissions-count-badge">{ROLES.length}</span>
              </div>

              <div className="permissions-role-list">
                {ROLES.map((role, index) => {
                  const selected = selectedRole === index
                  const count = users.filter(user => user.role === role).length
                  const accent = ROLE_DOT[role] || '#94A3B8'
                  return (
                    <button
                      key={role}
                      type="button"
                      className={`permissions-role-option${selected ? ' active' : ''}`}
                      style={{ '--role-accent': accent }}
                      onClick={() => { setSelectedRole(index); setExpandedModule(null) }}
                    >
                      <span className="permissions-role-icon" style={{ background: `${accent}14`, color: accent }}>
                        {role === 'Super Admin' ? <Crown size={15} /> : <Shield size={15} />}
                      </span>
                      <span className="permissions-role-copy">
                        <strong>{role}</strong>
                        <small>{count} user{count === 1 ? '' : 's'}</small>
                      </span>
                      {role === 'Super Admin'
                        ? <Lock size={13} className="permissions-role-lock" />
                        : <span className="permissions-role-arrow">›</span>}
                    </button>
                  )
                })}
              </div>

              <div className="permissions-role-footer">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setRoleFilter(selectedRoleName); setMainTab('users') }}
                >
                  <Users size={13} /> View users in this role
                </button>
              </div>
            </aside>

            <section className="card permissions-editor">
              <div className="permissions-editor-header">
                <div className="permissions-role-summary">
                  <span
                    className="permissions-summary-icon"
                    style={{ background: `${ROLE_DOT[selectedRoleName] || '#94A3B8'}14`, color: ROLE_DOT[selectedRoleName] || '#64748B' }}
                  >
                    {isLocked ? <Crown size={19} /> : <Shield size={19} />}
                  </span>
                  <div>
                    <div className="permissions-editor-title">Permissions for <strong>{selectedRoleName}</strong></div>
                    <div className="permissions-editor-meta">
                      <span><Users size={12} /> {selectedRoleUserCount} user{selectedRoleUserCount === 1 ? '' : 's'}</span>
                      <span className={isLocked ? 'permissions-status locked' : 'permissions-status editable'}>
                        {isLocked ? <><Lock size={11} /> Protected role</> : 'Editable role'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="permissions-progress-block">
                  <div className="permissions-progress-copy">
                    <span>{enabledCount} of {totalActionCount} actions enabled</span>
                    <strong>{enabledPercent}%</strong>
                  </div>
                  <div className="progress-bar"><div className="progress-fill" style={{ width: `${enabledPercent}%` }} /></div>
                </div>

                <div className="permissions-save-actions">
                  {permSaved && <span className="badge badge-green"><Check size={11} /> Saved</span>}
                  {dirty && !permSaved && <span className="permissions-dirty-dot">Unsaved</span>}
                  {!isLocked && (
                    <>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={handlePermReset} disabled={!dirty || permSaving}>Reset</button>
                      <button type="button" className="btn btn-primary btn-sm" onClick={handlePermSave} disabled={!dirty || permSaving}>
                        <Save size={13} /> {permSaving ? 'Saving…' : 'Save Changes'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {isLocked && !permLoading && (
                <div className="permissions-locked-banner">
                  <Lock size={15} />
                  <span><strong>Full access is always enabled.</strong> This protected role cannot be restricted.</span>
                </div>
              )}

              <div className="permissions-editor-body">
                {permLoading && (
                  <div className="loading-state"><div className="spinner" /><span>Loading role permissions…</span></div>
                )}

                {!permLoading && draft && groupedModules.map(([category, modules]) => (
                  <section className="permissions-category" key={category}>
                    <div className="permissions-category-heading">
                      <div>
                        <span>{category}</span>
                        <small>{modules.length} module{modules.length === 1 ? '' : 's'}</small>
                      </div>
                      <div className="permissions-category-line" />
                    </div>

                    <div className="permissions-module-list">
                      {modules.map(module => {
                        const moduleActions = module.actions || []
                        const moduleEnabledCount = moduleActions.filter(action => draft[module.key]?.[action.key] === true).length
                        const allEnabled = moduleActions.length > 0 && moduleEnabledCount === moduleActions.length
                        const partlyEnabled = moduleEnabledCount > 0 && !allEnabled
                        const isExpanded = expandedModule === module.key

                        return (
                          <article className={`permissions-module-row${isExpanded ? ' expanded' : ''}`} key={module.key}>
                            <div className="permissions-module-main">
                              <label
                                className="permissions-module-check"
                                title={isLocked ? 'Always enabled for this protected role' : `${allEnabled ? 'Clear' : 'Grant'} all ${module.label} actions`}
                              >
                                <input
                                  type="checkbox"
                                  className={`permissions-checkbox${partlyEnabled ? ' partial' : ''}`}
                                  checked={allEnabled}
                                  disabled={isLocked || moduleActions.length === 0}
                                  onChange={() => setModuleActions(module, !allEnabled)}
                                  aria-label={`${allEnabled ? 'Clear' : 'Grant'} all actions for ${module.label}`}
                                />
                              </label>

                              <button
                                type="button"
                                className="permissions-module-expand"
                                onClick={() => setExpandedModule(current => current === module.key ? null : module.key)}
                                aria-expanded={isExpanded}
                                aria-controls={`permission-actions-${module.key}`}
                              >
                                <span className="permissions-module-copy">
                                  <strong>{module.label}</strong>
                                  <small>{moduleActions.length} permission{moduleActions.length === 1 ? '' : 's'} available</small>
                                </span>
                                <span className={`permissions-module-total${allEnabled ? ' complete' : partlyEnabled ? ' partial' : ''}`}>
                                  {moduleEnabledCount}/{moduleActions.length}
                                </span>
                                <ChevronDown size={16} className="permissions-module-chevron" />
                              </button>
                            </div>

                            {isExpanded && (
                              <div className="permissions-action-panel" id={`permission-actions-${module.key}`}>
                                <div className="permissions-action-panel-heading">
                                  <span>Select the actions allowed for this role</span>
                                  {!isLocked && moduleActions.length > 0 && (
                                    <button
                                      type="button"
                                      className={`permissions-bulk-button${allEnabled ? ' clear' : ''}`}
                                      onClick={() => setModuleActions(module, !allEnabled)}
                                    >
                                      {allEnabled ? 'Clear all' : 'Select all'}
                                    </button>
                                  )}
                                </div>

                                {moduleActions.length === 0 ? (
                                  <div className="permissions-no-actions">No configurable actions</div>
                                ) : (
                                  <div className="permissions-action-checkboxes">
                                    {moduleActions.map(action => {
                                      const enabled = draft[module.key]?.[action.key] === true
                                      return (
                                        <label className={`permissions-action-checkbox${enabled ? ' selected' : ''}`} key={`${module.key}-${action.key}`}>
                                          <input
                                            type="checkbox"
                                            className="permissions-checkbox"
                                            checked={enabled}
                                            disabled={isLocked}
                                            onChange={() => togglePermission(module.key, action.key)}
                                          />
                                          <span className="permissions-action-copy">
                                            <strong>{action.label}</strong>
                                            <small>{enabled ? 'Access granted' : 'No access'}</small>
                                          </span>
                                        </label>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                          </article>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </>
  )
}
