/**
 * financeApi.js — Purchases · Suppliers · Sales · Expenses · Payments · P&L · Ledgers · Invoices · Quotations · Accounts
 *
 * Correct backend route mappings:
 *   Purchases:    /api/purchases
 *   Sales:        /api/sales
 *   Expenses:     /api/expenses
 *   Payments:     /api/payments/receivables | /payables | /transactions
 *   Profit & Loss:/api/profit-loss          (NOT /payments/profit-loss)
 *   Accounts:     /api/accounts/ledger/customer | /ledger/supplier | /cash-book | /bank-book
 *   Quotations:   /api/quotations
 *   Invoices:     /api/invoices
 */
import api from './index'

// ── Purchases ─────────────────────────────────────────────────
export const purchaseApi = {
  // params: { search, supplier_id, status, page, limit }
  list: (params = {}) =>
    api.get('/purchases', { params }).then(r => r.data),

  get: (id) =>
    api.get(`/purchases/${id}`).then(r => r.data),

  // Auto-increments stock + creates a Payable on backend
  create: (data) =>
    api.post('/purchases', data).then(r => r.data),

  update: (id, data) =>
    api.put(`/purchases/${id}`, data).then(r => r.data),

  // PATCH /purchases/:id/status — persistent status transition with business logic
  updateStatus: (id, status) =>
    api.patch(`/purchases/${id}/status`, { status }).then(r => r.data),

  delete: (id) =>
    api.delete(`/purchases/${id}`).then(r => r.data),

  // PATCH /purchases/:id/payment — record a payment (amount_paid, due_date, payment_notes)
  updatePayment: (id, data) =>
    api.patch(`/purchases/${id}/payment`, data).then(r => r.data),


  // ── Suppliers ───────────────────────────────────────────
  listSuppliers: () =>
    api.get('/suppliers').then(r => r.data),

  createSupplier: (data) =>
    api.post('/suppliers', data).then(r => r.data),

  updateSupplier: (id, data) =>
    api.put(`/suppliers/${id}`, data).then(r => r.data),

  deleteSupplier: (id) =>
    api.delete(`/suppliers/${id}`).then(r => r.data),
}

// ── Sales ─────────────────────────────────────────────────────
export const salesApi = {
  // params: { search, payment_status, page, limit }
  list: (params = {}) =>
    api.get('/sales', { params }).then(r => r.data),

  // Manual sale entry (auto-entries happen via dispatch→deliver flow)
  create: (data) =>
    api.post('/sales', data).then(r => r.data),
}

// ── Expenses ──────────────────────────────────────────────────
export const expenseApi = {
  // params: { category, from_date, to_date, page, limit }
  list: (params = {}) =>
    api.get('/expenses', { params }).then(r => r.data),

  create: (data) =>
    api.post('/expenses', data).then(r => r.data),

  update: (id, data) =>
    api.put(`/expenses/${id}`, data).then(r => r.data),

  delete: (id) =>
    api.delete(`/expenses/${id}`).then(r => r.data),
}

// ── Payments ──────────────────────────────────────────────────
export const paymentApi = {
  // ── Receivables (customer outstanding) ──────────────────
  listReceivables: (params = {}) =>
    api.get('/payments/receivables', { params }).then(r => r.data),

  // Body: { amount, mode, reference, notes }
  collectReceivable: (id, data) =>
    api.patch(`/payments/receivables/${id}/collect`, data).then(r => r.data),

  // ── Payables (supplier outstanding) ─────────────────────
  listPayables: (params = {}) =>
    api.get('/payments/payables', { params }).then(r => r.data),

  // Body: { amount, mode, reference, notes }
  payPayable: (id, data) =>
    api.patch(`/payments/payables/${id}/pay`, data).then(r => r.data),

  // ── Transaction history ──────────────────────────────────
  listTransactions: (params = {}) =>
    api.get('/payments/transactions', { params }).then(r => r.data),

  // ── Profit & Loss — correct route: /api/profit-loss ──────
  // params: { from_date, to_date }
  getProfitLoss: (params = {}) =>
    api.get('/profit-loss', { params }).then(r => r.data),

  // ── Ledgers — correct routes: /api/accounts/ledger/* ─────
  getCustomerLedger: (customer_id) =>
    api.get('/accounts/ledger/customer', { params: { customer_id } }).then(r => r.data),

  getSupplierLedger: (supplier_id) =>
    api.get('/accounts/ledger/supplier', { params: { supplier_id } }).then(r => r.data),
}

// ── Accounts (Ledger, Cash Book, Bank Book) ───────────────────
export const accountsApi = {
  // Consolidated company ledger — params: { from_date, to_date }
  getCompanyLedger: (params = {}) =>
    api.get('/accounts/ledger/company', { params }).then(r => r.data),

  // Customer ledger with running balance
  getCustomerLedger: (customer_id) =>
    api.get('/accounts/ledger/customer', { params: { customer_id } }).then(r => r.data),

  // Supplier ledger with running balance
  getSupplierLedger: (supplier_id) =>
    api.get('/accounts/ledger/supplier', { params: { supplier_id } }).then(r => r.data),

  // Daily cash flow — Cash mode receipts, payments, expenses
  // params: { from_date, to_date }
  getCashBook: (params = {}) =>
    api.get('/accounts/cash-book', { params }).then(r => r.data),

  // Bank transactions — UPI, Bank Transfer, Cheque
  // params: { from_date, to_date }
  getBankBook: (params = {}) =>
    api.get('/accounts/bank-book', { params }).then(r => r.data),
}

// ── Profit & Loss ─────────────────────────────────────────────
export const profitLossApi = {
  // params: { from_date, to_date }
  get: (params = {}) =>
    api.get('/profit-loss', { params }).then(r => r.data),
}

// ── Quotations ────────────────────────────────────────────────
export const quotationApi = {
  // params: { search, status, page, limit }
  list: (params = {}) =>
    api.get('/quotations', { params }).then(r => r.data),

  get: (id) =>
    api.get(`/quotations/${id}`).then(r => r.data),

  create: (data) =>
    api.post('/quotations', data).then(r => r.data),

  update: (id, data) =>
    api.put(`/quotations/${id}`, data).then(r => r.data),

  updateStatus: (id, status) =>
    api.patch(`/quotations/${id}/status`, { status }).then(r => r.data),

  // Convert accepted quotation → invoice
  convertToInvoice: (id) =>
    api.post(`/quotations/${id}/convert`).then(r => r.data),

  delete: (id) =>
    api.delete(`/quotations/${id}`).then(r => r.data),
}

// ── Invoices ──────────────────────────────────────────────────
export const invoiceApi = {
  // params: { search, status, payment_status, from_date, to_date, page, limit }
  list: (params = {}) =>
    api.get('/invoices', { params }).then(r => r.data),

  get: (id) =>
    api.get(`/invoices/${id}`).then(r => r.data),

  // Quick financial summary for dashboard widgets
  getSummary: () =>
    api.get('/invoices/summary').then(r => r.data),

  // data: { customer_id, customer_name, items[], grand_total, ... }
  create: (data) =>
    api.post('/invoices', data).then(r => r.data),

  update: (id, data) =>
    api.put(`/invoices/${id}`, data).then(r => r.data),

  // status: 'draft' | 'sent' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled'
  updateStatus: (id, status) =>
    api.patch(`/invoices/${id}/status`, { status }).then(r => r.data),

  // Record a payment against invoice: { amount, payment_date, payment_mode, reference_no, note }
  recordPayment: (id, data) =>
    api.post(`/invoices/${id}/payment`, data).then(r => r.data),

  // ── Staff Collection Verification ──────────────────────────
  // List all invoices that have staff-recorded payments (all statuses)
  listPendingVerification: (params = {}) =>
    api.get('/invoices/pending-verification', { params }).then(r => r.data),

  // Admin sends OTP to the staff member's mobile
  sendVerificationOtp: (invoiceId, paymentId) =>
    api.post(`/invoices/${invoiceId}/payment/${paymentId}/send-otp`).then(r => r.data),

  // Admin submits the OTP entered by staff to verify the collection
  verifyPayment: (invoiceId, paymentId, otp) =>
    api.post(`/invoices/${invoiceId}/payment/${paymentId}/verify`, { otp }).then(r => r.data),

  delete: (id) =>
    api.delete(`/invoices/${id}`).then(r => r.data),
}
