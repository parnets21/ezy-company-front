/**
 * wholesalerApi.js — Admin visibility into wholesaler activity.
 *
 * • Products added by wholesalers  → GET /products?all_companies=true (Super Admin)
 * • Purchases/orders placed by wholesalers → GET /wholesaler/all-purchases (Super Admin)
 */
import api from './index'

export const wholesalerApi = {
  // Products created by wholesalers FROM THE APP only (source=wholesaler),
  // across all companies. Excludes admin-created products.
  listProducts: (params = {}) =>
    api.get('/products', { params: { ...params, all_companies: true, source: 'wholesaler', limit: params.limit || 200 } })
      .then(r => r.data),

  // Purchases (orders) placed by wholesalers (across all companies)
  listPurchases: (params = {}) =>
    api.get('/wholesaler/all-purchases', { params: { limit: 200, ...params } })
      .then(r => r.data),
}

// ── Product Requests / Quotations (wholesaler asked, admin quotes) ──
// listRequests → all wholesaler quotation requests across companies (Super Admin)
// sendQuote(id, { quoted_price, quoted_gst, admin_note }) → admin sends a quote
Object.assign(wholesalerApi, {
  listRequests: (params = {}) =>
    api.get('/wholesaler/all-quotations', { params: { limit: 200, ...params } })
      .then(r => r.data),

  sendQuote: (id, data) =>
    api.patch(`/wholesaler/all-quotations/${id}/quote`, data)
      .then(r => r.data),

  // View / delete a wholesaler-added product (Super Admin, any company)
  getProduct: (id) =>
    api.get(`/wholesaler/all-products/${id}`).then(r => r.data),

  deleteProduct: (id) =>
    api.delete(`/wholesaler/all-products/${id}`).then(r => r.data),

  // ── Cross-company visibility (Super Admin) ──
  listOrders:       (params = {}) => api.get('/wholesaler/all-orders',       { params: { limit: 200, ...params } }).then(r => r.data),
  listEnquiries:    (params = {}) => api.get('/wholesaler/all-enquiries',    { params: { limit: 200, ...params } }).then(r => r.data),
  listUsers:        (params = {}) => api.get('/wholesaler/all-users',        { params: { limit: 200, ...params } }).then(r => r.data),
  listTransactions: (params = {}) => api.get('/wholesaler/all-transactions', { params: { limit: 200, ...params } }).then(r => r.data),

  // Subscriptions (Super Admin): per-company plans, revenue, set plan.
  // Scoped to wholesaler companies so the Wholesaler hub shows only their plans.
  listSubscriptions: (params = {}) => api.get('/subscriptions/admin/all', { params: { biz_type: 'Wholesaler', ...params } }).then(r => r.data),
  revenue:           ()          => api.get('/subscriptions/admin/revenue').then(r => r.data),
  setCompanyPlan:    (companyId, data) => api.patch(`/subscriptions/company/${companyId}`, data).then(r => r.data),

  // Purchase-order approve/reject (Super Admin). Approve → Order Management + Invoice.
  getPurchase: (id) =>
    api.get(`/wholesaler/all-purchases/${id}`).then(r => r.data),

  approvePurchase: (id) =>
    api.patch(`/wholesaler/all-purchases/${id}/approve`).then(r => r.data),

  rejectPurchase: (id, reason) =>
    api.patch(`/wholesaler/all-purchases/${id}/reject`, { reason }).then(r => r.data),

  deletePurchase: (id) =>
    api.delete(`/wholesaler/all-purchases/${id}`).then(r => r.data),
})
