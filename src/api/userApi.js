/**
 * userApi.js
 * Endpoints: GET|POST /users  •  GET|PUT|DELETE /users/:id
 *            PATCH /users/:id/reset-password
 */
import api from './index'

export const userApi = {
  accessCandidates: () => api.get('/users/access-candidates').then(r => r.data),
  updateAccess: (id, permissions) => api.patch(`/users/${id}/access`, { permissions }).then(r => r.data),
  // ── List users (filter by role, is_active, page, limit) ──
  list: (params = {}) =>
    api.get('/users', { params }).then(r => r.data),

  // ── Get single user ───────────────────────────────────────
  get: (id) =>
    api.get(`/users/${id}`).then(r => r.data),

  // ── Create user ───────────────────────────────────────────
  create: (data) =>
    api.post('/users', data).then(r => r.data),

  // ── Update user (name, mobile, role, is_active) ──────────
  update: (id, data) =>
    api.put(`/users/${id}`, data).then(r => r.data),

  // ── Delete user ───────────────────────────────────────────
  delete: (id) =>
    api.delete(`/users/${id}`).then(r => r.data),

  // ── Admin reset password ──────────────────────────────────
  resetPassword: (id, new_password) =>
    api.patch(`/users/${id}/reset-password`, { new_password }).then(r => r.data),
}
