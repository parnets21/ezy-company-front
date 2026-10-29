/**
 * RequireAccess — route-level RBAC guard
 * --------------------------------------
 * Wrap any protected route element with this. If the logged-in user's role
 * cannot access the given module key, they see an "Access Denied" panel
 * instead of the page (and cannot reach it by typing the URL directly).
 *
 * Usage:
 *   <Route path="finance/sales-management"
 *     element={<RequireAccess module={MODULES.SALES}><SalesManagement /></RequireAccess>} />
 */
import { useEffect, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { canAccess, onPermissionsChange } from '../config/permissions'

export default function RequireAccess({ module, children }) {
  const { user } = useAuth()
  const role = user?.role || ''

  // Re-evaluate when live permissions load/change.
  const [, tick] = useState(0)
  useEffect(() => onPermissionsChange(() => tick(t => t + 1)), [])

  if (canAccess(role, module)) return children

  return <AccessDenied role={role} />
}

function AccessDenied({ role }) {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '64px 24px', minHeight: '60vh', gap: 14,
      }}
    >
      <div
        style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'rgba(242,101,34,0.12)', color: '#F26522',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <ShieldAlert size={34} />
      </div>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#1E2D4A' }}>
        Access Denied
      </h2>
      <p style={{ margin: 0, fontSize: 14, color: '#64748B', maxWidth: 420, lineHeight: 1.5 }}>
        Your role{role ? ` (${role})` : ''} does not have permission to view this
        module. Please contact your administrator if you believe this is a mistake.
      </p>
    </div>
  )
}
