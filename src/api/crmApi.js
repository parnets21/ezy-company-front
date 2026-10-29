/**
 * crmApi.js — Customers · Leads · Follow-ups
 *
 * Customer endpoints:
 *   GET|POST /customers  •  GET|PUT|DELETE /customers/:id
 *
 * Lead endpoints:
 *   GET|POST /leads  •  PUT|DELETE /leads/:id  •  PATCH /leads/:id/convert
 *
 * Follow-up endpoints:
 *   GET|POST /followups  •  PUT|DELETE /followups/:id
 */
import api from './index'

// ── Customers ─────────────────────────────────────────────────
export const customerApi = {
  // params: { search, page, limit }
  list: (params = {}) =>
    api.get('/customers', { params }).then(r => r.data),

  // Returns customer + order/enquiry history + outstanding amount
  get: (id) =>
    api.get(`/customers/${id}`).then(r => r.data),

  create: (data) =>
    api.post('/customers', data).then(r => r.data),

  update: (id, data) =>
    api.put(`/customers/${id}`, data).then(r => r.data),

  delete: (id) =>
    api.delete(`/customers/${id}`).then(r => r.data),
}

// ── Leads ─────────────────────────────────────────────────────
export const leadApi = {
  // params: { status, source, page, limit }
  list: (params = {}) =>
    api.get('/leads', { params }).then(r => r.data),

  create: (data) =>
    api.post('/leads', data).then(r => r.data),

  update: (id, data) =>
    api.put(`/leads/${id}`, data).then(r => r.data),

  // Converts lead → customer record automatically
  convert: (id) =>
    api.patch(`/leads/${id}/convert`).then(r => r.data),

  delete: (id) =>
    api.delete(`/leads/${id}`).then(r => r.data),
}

// ── Follow-ups ────────────────────────────────────────────────
export const followupApi = {
  // params: { status, lead_id, customer_id, page, limit }
  list: (params = {}) =>
    api.get('/followups', { params }).then(r => r.data),

  create: (data) =>
    api.post('/followups', data).then(r => r.data),

  update: (id, data) =>
    api.put(`/followups/${id}`, data).then(r => r.data),

  delete: (id) =>
    api.delete(`/followups/${id}`).then(r => r.data),
}
