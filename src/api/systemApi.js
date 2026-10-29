/**
 * systemApi.js — Notifications · Documents · Subscriptions · Reports
 *
 * Notifications:  GET /notifications  •  PATCH /:id/read  •  PATCH /mark-all-read  •  DELETE /:id
 * Documents:      GET /documents      •  POST /documents (multipart)  •  DELETE /:id
 * Subscriptions:  GET|POST /subscriptions  •  PATCH /:id/cancel
 * Reports:        GET /reports/dashboard  |  /sales  |  /purchases  |  /expenses
 */
import api from './index'

// ── Notifications ─────────────────────────────────────────────
export const notificationApi = {
  // params: { is_read, page, limit }
  list: (params = {}) =>
    api.get('/notifications', { params }).then(r => r.data),

  markRead: (id) =>
    api.patch(`/notifications/${id}/read`).then(r => r.data),

  markAllRead: () =>
    api.patch('/notifications/mark-all-read').then(r => r.data),

  delete: (id) =>
    api.delete(`/notifications/${id}`).then(r => r.data),

  deleteAll: () =>
    api.delete('/notifications').then(r => r.data),

  // Super Admin — send to a single company. Body: { company_id, title, message, type? }
  send: (data) =>
    api.post('/notifications', data).then(r => r.data),

  // Super Admin — broadcast to all companies. Body: { title, message, type?, status? }
  broadcast: (data) =>
    api.post('/notifications/broadcast', data).then(r => r.data),
}

// ── Audit Logs ────────────────────────────────────────────────
export const auditLogApi = {
  // params: { module, action, user_id, from_date, to_date, page, limit }
  list: (params = {}) =>
    api.get('/audit-logs', { params }).then(r => r.data),
}

// ── Documents ─────────────────────────────────────────────────
export const documentApi = {
  // params: { entity_type, entity_id, doc_type, page, limit }
  list: (params = {}) =>
    api.get('/documents', { params }).then(r => r.data),

  // formData must contain files[] + entity_type + doc_type
  upload: (formData) =>
    api.post('/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data),

  delete: (id) =>
    api.delete(`/documents/${id}`).then(r => r.data),
}

// ── Subscriptions ─────────────────────────────────────────────
export const subscriptionApi = {
  // Get current active subscription + plan info
  getCurrent: () =>
    api.get('/subscriptions/current').then(r => r.data),

  list: () =>
    api.get('/subscriptions').then(r => r.data),

  // Body: { plan, starts_at, expires_at, amount_paid?, payment_ref? }
  create: (data) =>
    api.post('/subscriptions', data).then(r => r.data),

  cancel: (id) =>
    api.patch(`/subscriptions/${id}/cancel`).then(r => r.data),
}

// ── Reports / Analytics ───────────────────────────────────────
export const reportApi = {
  getDashboardStats: () =>
    api.get('/reports/dashboard').then(r => r.data),

  getSalesReport: (params = {}) =>
    api.get('/reports/sales', { params }).then(r => r.data),

  getPurchaseReport: (params = {}) =>
    api.get('/reports/purchases', { params }).then(r => r.data),

  getExpenseReport: (params = {}) =>
    api.get('/reports/expenses', { params }).then(r => r.data),

  getCustomerReport: (params = {}) =>
    api.get('/reports/customers', { params }).then(r => r.data),

  getSupplierReport: (params = {}) =>
    api.get('/reports/suppliers', { params }).then(r => r.data),

  getInventoryReport: (params = {}) =>
    api.get('/reports/inventory', { params }).then(r => r.data),

  getEmployeeReport: (params = {}) =>
    api.get('/reports/employees', { params }).then(r => r.data),
}
