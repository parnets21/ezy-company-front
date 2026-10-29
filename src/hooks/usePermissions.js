import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { canPerform as checkPermission, onPermissionsChange } from '../config/permissions'

/** Reactive action-level permission helper for page controls and handlers. */
export default function usePermissions() {
  const { user } = useAuth()
  const [, refresh] = useState(0)

  useEffect(() => onPermissionsChange(() => refresh(value => value + 1)), [])

  const canPerform = useCallback(
    (moduleKey, actionKey = 'view') => checkPermission(user?.role, moduleKey, actionKey),
    [user?.role]
  )

  return { canPerform, role: user?.role || '' }
}
