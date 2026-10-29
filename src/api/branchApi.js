/**
 * branchApi.js
 * Branch Management — stored under companies as sub-resources
 *
 * Endpoints:
 *   GET    /companies/:companyId/branches        → list branches
 *   POST   /companies/:companyId/branches        → create branch
 *   GET    /companies/:companyId/branches/:id    → get single branch
 *   PUT    /companies/:companyId/branches/:id    → update branch
 *   DELETE /companies/:companyId/branches/:id    → delete branch
 */
import api from './index'

export const branchApi = {
  /**
   * List all branches for a company.
   * @param {string} companyId
   * @param {object} params - { search, status }
   */
  list: (companyId, params = {}) =>
    api.get(`/companies/${companyId}/branches`, { params }).then(r => r.data),

  /**
   * Get a single branch.
   */
  get: (companyId, branchId) =>
    api.get(`/companies/${companyId}/branches/${branchId}`).then(r => r.data),

  /**
   * Create a new branch.
   * Body: { name, city, state, address, manager, phone, email, type, status }
   */
  create: (companyId, data) =>
    api.post(`/companies/${companyId}/branches`, data).then(r => r.data),

  /**
   * Update an existing branch.
   */
  update: (companyId, branchId, data) =>
    api.put(`/companies/${companyId}/branches/${branchId}`, data).then(r => r.data),

  /**
   * Delete a branch.
   */
  delete: (companyId, branchId) =>
    api.delete(`/companies/${companyId}/branches/${branchId}`).then(r => r.data),
}
