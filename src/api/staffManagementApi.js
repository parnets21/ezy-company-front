/**
 * staffManagementApi.js — Admin-side Staff App staff management.
 *
 * Backed by /api/staff-management (Employee records that log in to the Staff App
 * via mobile OTP). Supports the full staff profile: module access, salary
 * breakdown, incentive slabs, sales target, discount access + per-item discount
 * authorisations, and the assigned-items allow-list.
 */
import api from './index'

export const staffManagementApi = {
  // params: { search, is_active, page, limit }
  list: (params = {}) =>
    api.get('/staff-management', { params }).then(r => r.data),

  get: (id) =>
    api.get(`/staff-management/${id}`).then(r => r.data),

  // Available Staff App module keys (for the access checkbox list)
  modules: () =>
    api.get('/staff-management/modules').then(r => r.data),

  // body: {
  //   name, mobile, email, designation, department, branch, join_date, emp_code,
  //   staff_app_access: string[],
  //   fixed_salary, incentive_type, incentive_value, sales_percentage,
  //   discount_access, max_discount_percent, salary_notes,
  //   incentive_slabs: [{ sales_amount, incentive_pct }],
  //   discount_authorizations: [{ product_id, product_name, product_code, max_discount_pct }],
  //   assigned_products: string[],   // product ids
  //   sales_target,
  // }
  create: (body) =>
    api.post('/staff-management', body).then(r => r.data),

  update: (id, body) =>
    api.put(`/staff-management/${id}`, body).then(r => r.data),

  toggleActive: (id) =>
    api.patch(`/staff-management/${id}/toggle-active`).then(r => r.data),

  delete: (id) =>
    api.delete(`/staff-management/${id}`).then(r => r.data),
}

export default staffManagementApi
