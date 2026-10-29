/**
 * employeeMasterApi.js — Departments & Designations
 *
 * Departments:  GET|POST /employee-master/departments
 *               PUT|DELETE /employee-master/departments/:id
 * Designations: GET|POST /employee-master/designations
 *               PUT|DELETE /employee-master/designations/:id
 */
import api from './index'

export const employeeMasterApi = {
  // ── Departments ─────────────────────────────────────────────
  listDepartments: () =>
    api.get('/employee-master/departments').then(r => r.data),

  createDepartment: (data) =>
    api.post('/employee-master/departments', data).then(r => r.data),

  updateDepartment: (id, data) =>
    api.put(`/employee-master/departments/${id}`, data).then(r => r.data),

  deleteDepartment: (id) =>
    api.delete(`/employee-master/departments/${id}`).then(r => r.data),

  // ── Designations ─────────────────────────────────────────────
  // params: { department_id? }
  listDesignations: (params = {}) =>
    api.get('/employee-master/designations', { params }).then(r => r.data),

  createDesignation: (data) =>
    api.post('/employee-master/designations', data).then(r => r.data),

  updateDesignation: (id, data) =>
    api.put(`/employee-master/designations/${id}`, data).then(r => r.data),

  deleteDesignation: (id) =>
    api.delete(`/employee-master/designations/${id}`).then(r => r.data),
}
