import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, Layers, Tag, ChevronLeft, ChevronRight } from 'lucide-react'
import { employeeMasterApi } from '../api/employeeMasterApi'

const PAGE_SIZE = 10

// ── Helpers ───────────────────────────────────────────────────
const fmtDate = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Unwrap the standard API response shape: { success, data, message }
const unwrap = (res) => {
  if (res && res.data !== undefined) return res.data
  return res
}

const EMPTY_DEPT  = { name: '', description: '', is_active: true }
const EMPTY_DESIG = { department_id: '', name: '', description: '', is_active: true }

// ─────────────────────────────────────────────────────────────
export default function EmployeeMasterManagement() {
  const [tab, setTab] = useState('department')
  const [page, setPage] = useState(1)

  // ── Pagination (10 rows per page) ──────────────────────────
  // Shared across tabs; resets whenever the active tab changes.
  useEffect(() => { setPage(1) }, [tab])
  const pageSlice = (arr) => arr.slice((Math.min(page, Math.max(1, Math.ceil(arr.length / PAGE_SIZE))) - 1) * PAGE_SIZE, Math.min(page, Math.max(1, Math.ceil(arr.length / PAGE_SIZE))) * PAGE_SIZE)
  const Pager = ({ total }) => {
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
    const safePage   = Math.min(page, totalPages)
    if (totalPages <= 1) return null
    return (
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
    )
  }

  // ── Toast ─────────────────────────────────────────────────
  const [msg,     setMsg]     = useState('')
  const [msgType, setMsgType] = useState('success')
  const toast = (text, type = 'success') => {
    setMsg(text); setMsgType(type)
    setTimeout(() => setMsg(''), 3500)
  }

  // ── Department state ──────────────────────────────────────
  const [departments,  setDepartments]  = useState([])
  const [deptLoading,  setDeptLoading]  = useState(false)
  const [showDeptForm, setShowDeptForm] = useState(false)
  const [deptForm,     setDeptForm]     = useState(EMPTY_DEPT)
  const [deptErrors,   setDeptErrors]   = useState({})
  const [deptSaving,   setDeptSaving]   = useState(false)
  const [editDept,     setEditDept]     = useState(null)

  // ── Designation state ─────────────────────────────────────
  const [designations,  setDesignations]  = useState([])
  const [desigLoading,  setDesigLoading]  = useState(false)
  const [showDesigForm, setShowDesigForm] = useState(false)
  const [desigForm,     setDesigForm]     = useState(EMPTY_DESIG)
  const [desigErrors,   setDesigErrors]   = useState({})
  const [desigSaving,   setDesigSaving]   = useState(false)
  const [editDesig,     setEditDesig]     = useState(null)

  // ─────────────────────────────────────────────────────────
  // LOAD DATA
  // ─────────────────────────────────────────────────────────
  const loadDepartments = useCallback(async () => {
    setDeptLoading(true)
    try {
      const res  = await employeeMasterApi.listDepartments()
      const data = unwrap(res)
      setDepartments(Array.isArray(data?.departments) ? data.departments : [])
    } catch {
      toast('Failed to load departments', 'error')
    }
    setDeptLoading(false)
  }, [])

  const loadDesignations = useCallback(async () => {
    setDesigLoading(true)
    try {
      const res  = await employeeMasterApi.listDesignations()
      const data = unwrap(res)
      setDesignations(Array.isArray(data?.designations) ? data.designations : [])
    } catch {
      toast('Failed to load designations', 'error')
    }
    setDesigLoading(false)
  }, [])

  useEffect(() => {
    loadDepartments()
    loadDesignations()
  }, [loadDepartments, loadDesignations])

  // ─────────────────────────────────────────────────────────
  // DEPARTMENT CRUD
  // ─────────────────────────────────────────────────────────
  const validateDept = () => {
    const e = {}
    if (!deptForm.name.trim()) e.name = 'Department name is required'
    return e
  }

  const startEditDept = (dept) => {
    setEditDept(dept)
    setDeptForm({
      name:        dept.name        || '',
      description: dept.description || '',
      is_active:   dept.is_active !== false,
    })
    setDeptErrors({})
    setShowDeptForm(true)
  }

  const cancelDept = () => {
    setEditDept(null)
    setDeptForm(EMPTY_DEPT)
    setDeptErrors({})
    setShowDeptForm(false)
  }

  const saveDept = async () => {
    const e = validateDept()
    if (Object.keys(e).length) { setDeptErrors(e); return }
    setDeptSaving(true)
    try {
      if (editDept) {
        const res     = await employeeMasterApi.updateDepartment(editDept._id || editDept.id, deptForm)
        const updated = unwrap(res)
        setDepartments(prev =>
          prev.map(d =>
            (String(d._id || d.id) === String(updated._id || updated.id)) ? updated : d
          )
        )
        toast(`Department "${updated.name}" updated`)
      } else {
        const res  = await employeeMasterApi.createDepartment(deptForm)
        const newD = unwrap(res)
        setDepartments(prev => [...prev, newD])
        toast(`Department "${newD.name}" created`)
      }
      cancelDept()
    } catch (err) {
      toast(err?.response?.data?.message || 'Failed to save department', 'error')
    }
    setDeptSaving(false)
  }

  const deleteDept = async (dept) => {
    if (!window.confirm(`Delete department "${dept.name}"? This will fail if designations exist under it.`)) return
    const deptId = String(dept._id || dept.id)
    try {
      await employeeMasterApi.deleteDepartment(deptId)
      setDepartments(prev => prev.filter(d => String(d._id || d.id) !== deptId))
      setDesignations(prev => prev.filter(d => {
        const did = String(d.department_id?._id || d.department_id)
        return did !== deptId
      }))
      toast(`Department "${dept.name}" deleted`)
    } catch (err) {
      toast(err?.response?.data?.message || 'Cannot delete department', 'error')
    }
  }

  // ─────────────────────────────────────────────────────────
  // DESIGNATION CRUD
  // ─────────────────────────────────────────────────────────
  const validateDesig = () => {
    const e = {}
    if (!desigForm.department_id) e.department_id = 'Department is required'
    if (!desigForm.name.trim())   e.name = 'Designation name is required'
    return e
  }

  const startEditDesig = (desig) => {
    setEditDesig(desig)
    setDesigForm({
      department_id: String(desig.department_id?._id || desig.department_id || ''),
      name:          desig.name        || '',
      description:   desig.description || '',
      is_active:     desig.is_active !== false,
    })
    setDesigErrors({})
    setShowDesigForm(true)
  }

  const cancelDesig = () => {
    setEditDesig(null)
    setDesigForm(EMPTY_DESIG)
    setDesigErrors({})
    setShowDesigForm(false)
  }

  const saveDesig = async () => {
    const e = validateDesig()
    if (Object.keys(e).length) { setDesigErrors(e); return }
    setDesigSaving(true)
    try {
      if (editDesig) {
        const res     = await employeeMasterApi.updateDesignation(editDesig._id || editDesig.id, desigForm)
        const updated = unwrap(res)
        setDesignations(prev =>
          prev.map(d =>
            (String(d._id || d.id) === String(updated._id || updated.id)) ? updated : d
          )
        )
        toast(`Designation "${updated.name}" updated`)
      } else {
        const res  = await employeeMasterApi.createDesignation(desigForm)
        const newD = unwrap(res)
        setDesignations(prev => [...prev, newD])
        toast(`Designation "${newD.name}" created`)
      }
      cancelDesig()
    } catch (err) {
      toast(err?.response?.data?.message || 'Failed to save designation', 'error')
    }
    setDesigSaving(false)
  }

  const deleteDesig = async (desig) => {
    if (!window.confirm(`Delete designation "${desig.name}"?`)) return
    const desigId = String(desig._id || desig.id)
    try {
      await employeeMasterApi.deleteDesignation(desigId)
      setDesignations(prev => prev.filter(d => String(d._id || d.id) !== desigId))
      toast(`Designation "${desig.name}" deleted`)
    } catch (err) {
      toast(err?.response?.data?.message || 'Failed to delete designation', 'error')
    }
  }

  const handleTabSwitch = (t) => {
    setTab(t)
    cancelDept()
    cancelDesig()
  }

  const openAddDept = () => {
    setEditDept(null)
    setDeptForm(EMPTY_DEPT)
    setDeptErrors({})
    setShowDeptForm(true)
  }

  const openAddDesig = () => {
    setEditDesig(null)
    setDesigForm(EMPTY_DESIG)
    setDesigErrors({})
    setShowDesigForm(true)
  }

  const activeDepts = departments.filter(d => d.is_active !== false)

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <>
      <div className="breadcrumb">
        <span>HR &amp; Admin</span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-active">Employee Master Management</span>
      </div>

      {/* Toast */}
      {msg && (
        <div
          className={`alert ${msgType === 'error' ? 'alert-danger' : 'alert-info'}`}
          style={{ marginBottom: 14 }}
        >
          {msgType === 'error' ? '✗ ' : '✓ '}{msg}
        </div>
      )}

      {/* Summary cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 20 }}>
        {[
          { label: 'Total Departments',   val: departments.length,                                     color: 'blue'   },
          { label: 'Active Departments',  val: departments.filter(d => d.is_active !== false).length,  color: 'green'  },
          { label: 'Total Designations',  val: designations.length,                                    color: 'purple' },
          { label: 'Active Designations', val: designations.filter(d => d.is_active !== false).length, color: 'orange' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ padding: '14px 16px' }}>
            <div className={`stat-icon ${s.color}`}>
              {s.label.includes('Dept') ? <Layers /> : <Tag />}
            </div>
            <div className="stat-info">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ fontSize: 22 }}>{s.val}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab-btn${tab === 'department' ? ' active' : ''}`}
          onClick={() => handleTabSwitch('department')}
        >
          <Layers style={{ width: 14, marginRight: 5 }} />Department
        </button>
        <button
          className={`tab-btn${tab === 'designation' ? ' active' : ''}`}
          onClick={() => handleTabSwitch('designation')}
        >
          <Tag style={{ width: 14, marginRight: 5 }} />Designation
        </button>
      </div>

      {/* ══════════ DEPARTMENT TAB ══════════ */}
      {tab === 'department' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Departments ({departments.length})</span>
            <button className="btn btn-primary" onClick={openAddDept}>
              <Plus style={{ width: 14 }} />Add Department
            </button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Dept ID</th>
                  <th>Department Name</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Created Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {deptLoading && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                      Loading…
                    </td>
                  </tr>
                )}
                {!deptLoading && pageSlice(departments).map(dept => (
                  <tr key={dept._id || dept.id}>
                    <td style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 12 }}>
                      {dept.dept_code || '—'}
                    </td>
                    <td style={{ fontWeight: 600 }}>{dept.name}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {dept.description || '—'}
                    </td>
                    <td>
                      <span className={`badge ${dept.is_active !== false ? 'badge-green' : 'badge-red'}`}>
                        {dept.is_active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>{fmtDate(dept.created_at)}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="btn btn-secondary btn-xs"
                          onClick={() => startEditDept(dept)}
                        >
                          <Edit2 style={{ width: 12 }} />Edit
                        </button>
                        <button
                          className="btn btn-ghost btn-xs"
                          style={{ color: 'var(--danger)' }}
                          onClick={() => deleteDept(dept)}
                        >
                          <Trash2 style={{ width: 12 }} />Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!deptLoading && departments.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                      No departments yet. Click <strong>Add Department</strong> to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pager total={departments.length} />
        </div>
      )}

      {/* ══════════ DESIGNATION TAB ══════════ */}
      {tab === 'designation' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Designations ({designations.length})</span>
            <button className="btn btn-primary" onClick={openAddDesig}>
              <Plus style={{ width: 14 }} />Add Designation
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Desig ID</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Created Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {desigLoading && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                      Loading…
                    </td>
                  </tr>
                )}
                {!desigLoading && pageSlice(designations).map(desig => (
                  <tr key={desig._id || desig.id}>
                    <td style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 12 }}>
                      {desig.desig_code || '—'}
                    </td>
                    <td>
                      <span className="badge badge-blue" style={{ fontSize: 11 }}>
                        {desig.department_id?.name || '—'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{desig.name}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {desig.description || '—'}
                    </td>
                    <td>
                      <span className={`badge ${desig.is_active !== false ? 'badge-green' : 'badge-red'}`}>
                        {desig.is_active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>{fmtDate(desig.created_at)}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="btn btn-secondary btn-xs"
                          onClick={() => startEditDesig(desig)}
                        >
                          <Edit2 style={{ width: 12 }} />Edit
                        </button>
                        <button
                          className="btn btn-ghost btn-xs"
                          style={{ color: 'var(--danger)' }}
                          onClick={() => deleteDesig(desig)}
                        >
                          <Trash2 style={{ width: 12 }} />Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!desigLoading && designations.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                      No designations yet. Click <strong>Add Designation</strong> to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pager total={designations.length} />
        </div>
      )}

      {/* ══════════ DEPARTMENT MODAL ══════════ */}
      {showDeptForm && (
        <div className="modal-overlay" onClick={cancelDept}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">
                {editDept ? `Edit Department — ${editDept.name}` : 'Add Department'}
              </span>
              <button className="btn-ghost" onClick={cancelDept}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Department Name *</label>
                  <input
                    className={`form-control${deptErrors.name ? ' error' : ''}`}
                    placeholder="e.g. Sales"
                    value={deptForm.name}
                    onChange={e => setDeptForm(p => ({ ...p, name: e.target.value }))}
                    autoFocus
                  />
                  {deptErrors.name && <div className="form-error">{deptErrors.name}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-control"
                    value={deptForm.is_active ? 'active' : 'inactive'}
                    onChange={e => setDeptForm(p => ({ ...p, is_active: e.target.value === 'active' }))}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input
                  className="form-control"
                  placeholder="Optional description"
                  value={deptForm.description}
                  onChange={e => setDeptForm(p => ({ ...p, description: e.target.value }))}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={cancelDept}>Cancel</button>
              <button className="btn btn-primary" disabled={deptSaving} onClick={saveDept}>
                {deptSaving ? 'Saving…' : editDept ? 'Update Department' : 'Create Department'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ DESIGNATION MODAL ══════════ */}
      {showDesigForm && (
        <div className="modal-overlay" onClick={cancelDesig}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">
                {editDesig ? `Edit Designation — ${editDesig.name}` : 'Add Designation'}
              </span>
              <button className="btn-ghost" onClick={cancelDesig}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Department *</label>
                  <select
                    className={`form-control${desigErrors.department_id ? ' error' : ''}`}
                    value={desigForm.department_id}
                    onChange={e => setDesigForm(p => ({ ...p, department_id: e.target.value }))}
                  >
                    <option value="">Select Department</option>
                    {activeDepts.map(d => (
                      <option key={d._id || d.id} value={d._id || d.id}>{d.name}</option>
                    ))}
                  </select>
                  {desigErrors.department_id && (
                    <div className="form-error">{desigErrors.department_id}</div>
                  )}
                  {activeDepts.length === 0 && (
                    <div className="form-hint" style={{ color: 'var(--warning)' }}>
                      No active departments. Create departments first.
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Designation Name *</label>
                  <input
                    className={`form-control${desigErrors.name ? ' error' : ''}`}
                    placeholder="e.g. Sales Executive"
                    value={desigForm.name}
                    onChange={e => setDesigForm(p => ({ ...p, name: e.target.value }))}
                    autoFocus
                  />
                  {desigErrors.name && <div className="form-error">{desigErrors.name}</div>}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <input
                    className="form-control"
                    placeholder="Optional description"
                    value={desigForm.description}
                    onChange={e => setDesigForm(p => ({ ...p, description: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-control"
                    value={desigForm.is_active ? 'active' : 'inactive'}
                    onChange={e => setDesigForm(p => ({ ...p, is_active: e.target.value === 'active' }))}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={cancelDesig}>Cancel</button>
              <button className="btn btn-primary" disabled={desigSaving} onClick={saveDesig}>
                {desigSaving ? 'Saving…' : editDesig ? 'Update Designation' : 'Create Designation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
