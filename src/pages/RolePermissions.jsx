import { useState } from 'react'
import { Shield, Save, Check, X } from 'lucide-react'

const ROLES = [
  'Super Admin',
  'Company Owner',
  'Manager',
  'Accountant',
  'Sales Executive',
  'Warehouse Staff',
  'Retailer',
  'Wholesaler',
]

// Module → permissions matrix
// Each permission: [view, add, edit, delete]
const MODULES = [
  { module: 'Dashboard', perms: ['View'] },
  { module: 'Company Registration', perms: ['View', 'Edit'] },
  { module: 'User Management', perms: ['View', 'Add', 'Edit', 'Delete'] },
  { module: 'Product Management', perms: ['View', 'Add', 'Edit', 'Delete'] },
  { module: 'Inventory Management', perms: ['View', 'Stock In', 'Stock Out', 'Transfer'] },
  { module: 'Product Search', perms: ['View', 'Enquire'] },
  { module: 'Enquiry Management', perms: ['View', 'Create', 'Reply', 'Close'] },
  { module: 'Order Management', perms: ['View', 'Create', 'Edit', 'Cancel'] },
  { module: 'Dispatch Management', perms: ['View', 'Create', 'Update'] },
  { module: 'Customer Management', perms: ['View', 'Add', 'Edit'] },
  { module: 'Lead Management', perms: ['View', 'Add', 'Edit', 'Delete'] },
  { module: 'Follow-up Management', perms: ['View', 'Add', 'Mark Done'] },
  { module: 'Sales Management', perms: ['View', 'Add', 'Export'] },
  { module: 'Purchase Management', perms: ['View', 'Add', 'Export'] },
  { module: 'Expense Management', perms: ['View', 'Add', 'Delete'] },
  { module: 'Profit & Loss', perms: ['View', 'Export'] },
  { module: 'Payment Management', perms: ['View', 'Record', 'Export'] },
  { module: 'Accounts Module', perms: ['View', 'Export'] },
  { module: 'Employee Management', perms: ['View', 'Add', 'Edit', 'Salary'] },
  { module: 'Role & Permissions', perms: ['View', 'Edit'] },
  { module: 'Notification System', perms: ['View', 'Configure'] },
  { module: 'Report Center', perms: ['View', 'Export'] },
  { module: 'Warehouse Management', perms: ['View', 'Add', 'Edit'] },
  { module: 'Document Management', perms: ['View', 'Upload', 'Delete'] },
  { module: 'Subscription System', perms: ['View', 'Upgrade'] },
]

// Default permission matrix: roleIndex → moduleIndex → permIndex → bool
const defaultMatrix = () => {
  const m = {}
  ROLES.forEach((role, ri) => {
    m[ri] = {}
    MODULES.forEach((mod, mi) => {
      m[ri][mi] = {}
      mod.perms.forEach((perm, pi) => {
        // Super Admin → all true; Company Owner → almost all; others → restricted
        if (ri === 0) m[ri][mi][pi] = true
        else if (ri === 1) m[ri][mi][pi] = pi < 2 || (pi === 2 && mi < 18)
        else if (ri === 2) m[ri][mi][pi] = pi === 0 || (pi === 1 && mi >= 5 && mi <= 14)
        else if (ri === 3) m[ri][mi][pi] = mi >= 12 && mi <= 18 && pi === 0
        else if (ri === 4) m[ri][mi][pi] = (mi >= 6 && mi <= 14 && pi <= 1) || mi === 9
        else if (ri === 5) m[ri][mi][pi] = mi === 4 && pi <= 2
        else if (ri === 6) m[ri][mi][pi] = mi === 5 && pi <= 1   // Retailer: search + enquire
        else if (ri === 7) m[ri][mi][pi] = mi === 5 && pi === 0   // Wholesaler: search view
      })
    })
  })
  return m
}

export default function RolePermissions() {
  const [selectedRole, setSelectedRole] = useState(0)
  const [matrix, setMatrix] = useState(defaultMatrix())
  const [saved, setSaved] = useState(false)

  const toggle = (mi, pi) => {
    setMatrix(prev => {
      const next = JSON.parse(JSON.stringify(prev))
      next[selectedRole][mi][pi] = !next[selectedRole][mi][pi]
      return next
    })
    setSaved(false)
  }

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const roleColors = ['badge-purple', 'badge-blue', 'badge-cyan', 'badge-green', 'badge-orange', 'badge-yellow', 'badge-gray', 'badge-gray']

  return (
    <>
      <div className="breadcrumb">
        <span>HR & Admin</span><span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-active">Roles & Permissions</span>
      </div>

      <div className="alert alert-info" style={{ marginBottom: 20 }}>
        <Shield />
        <span>Permission changes take effect on the user's next login. Super Admin always retains full access.</span>
      </div>

      <div className="page-grid-2" style={{ gridTemplateColumns: '220px 1fr', gap: 16, alignItems: 'start' }}>
        {/* Role list */}
        <div className="card">
          <div className="card-header"><span className="card-title">Select Role</span></div>
          <div style={{ padding: '8px 0' }}>
            {ROLES.map((r, i) => (
              <button
                key={r}
                onClick={() => setSelectedRole(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '10px 16px', border: 'none',
                  background: selectedRole === i ? 'var(--primary-light)' : 'transparent',
                  color: selectedRole === i ? 'var(--primary)' : 'var(--text)',
                  cursor: 'pointer', fontSize: 13, fontWeight: selectedRole === i ? 700 : 500,
                  borderLeft: selectedRole === i ? '3px solid var(--primary)' : '3px solid transparent',
                  transition: 'all .15s',
                }}
              >
                <Shield style={{ width: 15 }} />
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Permissions table */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="card-title">Permissions for</span>
              <span className={`badge ${roleColors[selectedRole]}`}>{ROLES[selectedRole]}</span>
            </div>
            <div className="header-actions">
              {saved && <span className="badge badge-green"><Check style={{ width: 11 }} /> Saved</span>}
              <button className="btn btn-primary btn-sm" onClick={handleSave}><Save style={{ width: 13 }} />Save Changes</button>
            </div>
          </div>
          <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: 180 }}>Module</th>
                  <th style={{ width: 80, textAlign: 'center' }}>Action</th>
                  <th style={{ width: 80, textAlign: 'center' }}>Access</th>
                </tr>
              </thead>
              <tbody>
                {MODULES.map((mod, mi) => (
                  mod.perms.map((perm, pi) => (
                    <tr key={`${mi}-${pi}`}>
                      {pi === 0 && (
                        <td rowSpan={mod.perms.length} style={{ fontWeight: 600, fontSize: 13, verticalAlign: 'top', paddingTop: 13, borderRight: '1px solid var(--border)' }}>
                          {mod.module}
                        </td>
                      )}
                      <td style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>{perm}</td>
                      <td style={{ textAlign: 'center' }}>
                        {selectedRole === 0 ? (
                          <Check style={{ width: 16, color: 'var(--success)' }} />
                        ) : (
                          <button
                            onClick={() => toggle(mi, pi)}
                            style={{
                              width: 28, height: 28, borderRadius: 6,
                              border: 'none', cursor: 'pointer',
                              background: matrix[selectedRole][mi][pi] ? '#ECFDF5' : '#FEF2F2',
                              color: matrix[selectedRole][mi][pi] ? 'var(--success)' : 'var(--danger)',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all .15s',
                            }}
                          >
                            {matrix[selectedRole][mi][pi]
                              ? <Check style={{ width: 14 }} />
                              : <X style={{ width: 14 }} />
                            }
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
