/**
 * enquiryApi.js
 * Endpoints:
 *   GET    /enquiries/stats     → status-wise counts
 *   GET    /enquiries           → list (filter: status, search, page, limit)
 *   GET    /enquiries/:id       → single enquiry
 *   POST   /enquiries           → create enquiry
 *   PATCH  /enquiries/:id       → update (status, reply, negotiation note…)
 *   DELETE /enquiries/:id       → delete
 *   GET    /enquiries/:id/messages  → operator view of the buyer ↔ seller thread
 *   POST   /enquiries/:id/messages  → operator posts a note into the thread
 */
import api from './index'

export const enquiryApi = {
  // Status-count stats for dashboard badges
  stats: () =>
    api.get('/enquiries/stats').then(r => r.data),

  // List — params: { status, search, page, limit }
  list: (params = {}) =>
    api.get('/enquiries', { params }).then(r => r.data),

  get: (id) =>
    api.get(`/enquiries/${id}`).then(r => r.data),

  // Who answered a broadcast (and who has not) — the whole roster in one call.
  replies: (id) =>
    api.get(`/enquiries/${id}/replies`).then(r => r.data),

  // Full reply history — every reply ever sent, newest first
  listReplyHistory: (id) =>
    api.get(`/enquiries/${id}/reply-history`).then(r => r.data),

  createReplyHistory: (id, data) =>
    api.post(`/enquiries/${id}/reply-history`, data).then(r => r.data),

  create: (data) =>
    api.post('/enquiries', data).then(r => r.data),

  // Partial update — status change, wholesaler reply, negotiation note etc.
  update: (id, data) =>
    api.patch(`/enquiries/${id}`, data).then(r => r.data),

  delete: (id) =>
    api.delete(`/enquiries/${id}`).then(r => r.data),

  // Operator-side conversation thread (one message per call).
  listMessages: (id) =>
    api.get(`/enquiries/${id}/messages`).then(r => r.data),

  sendMessage: (id, message, clientMessageId = '') =>
    api.post(`/enquiries/${id}/messages`, {
      message,
      client_message_id: clientMessageId,
    }).then(r => r.data),
}
