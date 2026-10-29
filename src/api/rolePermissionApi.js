/**
 * rolePermissionApi.js
 * Endpoints:
 *   GET  /role-permissions        → module catalog + effective perms for all roles (admin)
 *   GET  /role-permissions/me     → effective perms for the current user's role
 *   PUT  /role-permissions/:role  → save overrides for a role (admin)
 */
import api from './index'

export const rolePermissionApi = {
  list: () =>
    api.get('/role-permissions').then(r => r.data),

  me: () =>
    api.get('/role-permissions/me').then(r => r.data),

  update: (role, permissions) =>
    api.put(`/role-permissions/${encodeURIComponent(role)}`, { permissions }).then(r => r.data),
}
