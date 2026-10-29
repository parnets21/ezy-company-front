
import api from './index'

// ── Purchase Requisition ──────────────────────────────────────
export const purchaseRequisitionApi = {
  list: (params = {}) => api.get('/purchase-requisitions', { params }).then(r => r.data),
  get:  (id)          => api.get(`/purchase-requisitions/${id}`).then(r => r.data),
  create: (data)      => api.post('/purchase-requisitions', data).then(r => r.data),
  update: (id, data)  => api.put(`/purchase-requisitions/${id}`, data).then(r => r.data),
  updateStatus: (id, status, remarks = '') =>
    api.patch(`/purchase-requisitions/${id}/status`, { status, remarks }).then(r => r.data),
  delete: (id)        => api.delete(`/purchase-requisitions/${id}`).then(r => r.data),
  convertToPO: (id)   => api.post(`/purchase-requisitions/${id}/convert-to-po`).then(r => r.data),
}

// ── Purchase Orders ───────────────────────────────────────────
export const purchaseOrderApi = {
  list: (params = {}) => api.get('/purchase-orders', { params }).then(r => r.data),
  get:  (id)          => api.get(`/purchase-orders/${id}`).then(r => r.data),
  create: (data)      => api.post('/purchase-orders', data).then(r => r.data),
  update: (id, data)  => api.put(`/purchase-orders/${id}`, data).then(r => r.data),
  updateStatus: (id, status, remarks = '') =>
    api.patch(`/purchase-orders/${id}/status`, { status, remarks }).then(r => r.data),
  delete: (id)        => api.delete(`/purchase-orders/${id}`).then(r => r.data),
  // Mark a PO as sent to supplier
  send: (id)          => api.patch(`/purchase-orders/${id}/send`).then(r => r.data),
}

// ── GRN / Goods Receipt Note ──────────────────────────────────
export const grnApi = {
  list: (params = {}) => api.get('/grns', { params }).then(r => r.data),
  get:  (id)          => api.get(`/grns/${id}`).then(r => r.data),
  create: (data)      => api.post('/grns', data).then(r => r.data),
  update: (id, data)  => api.put(`/grns/${id}`, data).then(r => r.data),
  // Approve GRN → triggers stock increase in inventory
  approve: (id, remarks = '') =>
    api.patch(`/grns/${id}/approve`, { remarks }).then(r => r.data),
  cancel: (id, reason = '') =>
    api.patch(`/grns/${id}/cancel`, { reason }).then(r => r.data),
  delete: (id)        => api.delete(`/grns/${id}`).then(r => r.data),
}

// ── Quality Inspection ────────────────────────────────────────
export const qualityInspectionApi = {
  list: (params = {}) => api.get('/quality-inspections', { params }).then(r => r.data),
  get:  (id)          => api.get(`/quality-inspections/${id}`).then(r => r.data),
  create: (data)      => api.post('/quality-inspections', data).then(r => r.data),
  update: (id, data)  => api.put(`/quality-inspections/${id}`, data).then(r => r.data),
  // Approve QC → updates stock quality breakdown
  approve: (id, data) => api.patch(`/quality-inspections/${id}/approve`, data).then(r => r.data),
  reject:  (id, reason) =>
    api.patch(`/quality-inspections/${id}/reject`, { reason }).then(r => r.data),
  delete: (id)        => api.delete(`/quality-inspections/${id}`).then(r => r.data),
}

// ── Purchase Invoices (stored as purchase bill records) ─────────
export const purchaseInvoiceApi = {
  list: (params = {}) => api.get('/purchase-invoices', { params }).then(r => r.data),
  recordPayment: (billCode, data) =>
    api.patch(`/purchase-invoices/${encodeURIComponent(billCode)}/payment`, data).then(r => r.data),
}

// ── Purchase Return ───────────────────────────────────────────
export const purchaseReturnApi = {
  list: (params = {}) => api.get('/purchase-returns', { params }).then(r => r.data),
  get:  (id)          => api.get(`/purchase-returns/${id}`).then(r => r.data),
  create: (data)      => api.post('/purchase-returns', data).then(r => r.data),
  update: (id, data)  => api.put(`/purchase-returns/${id}`, data).then(r => r.data),
  updateStatus: (id, status, remarks = '') =>
    api.patch(`/purchase-returns/${id}/status`, { status, remarks }).then(r => r.data),
  delete: (id)        => api.delete(`/purchase-returns/${id}`).then(r => r.data),
}

// ── Stock Ledger ──────────────────────────────────────────────
export const stockLedgerApi = {
  // params: { product_id, warehouse_id, from_date, to_date, transaction_type, page, limit }
  list: (params = {}) => api.get('/inventory/ledger', { params }).then(r => r.data),
  // Summary for a specific product
  productSummary: (productId, params = {}) =>
    api.get(`/inventory/ledger/product/${productId}`, { params }).then(r => r.data),
  export: (params = {}) =>
    api.get('/inventory/ledger/export', { params, responseType: 'blob' }).then(r => r.data),
}

// ── Opening Stock ─────────────────────────────────────────────
export const openingStockApi = {
  list: (params = {}) => api.get('/inventory/opening-stock', { params }).then(r => r.data),
  get:  (id)          => api.get(`/inventory/opening-stock/${id}`).then(r => r.data),
  create: (data)      => api.post('/inventory/opening-stock', data).then(r => r.data),
  update: (id, data)  => api.put(`/inventory/opening-stock/${id}`, data).then(r => r.data),
  delete: (id)        => api.delete(`/inventory/opening-stock/${id}`).then(r => r.data),
}

// ── Unit Conversion ───────────────────────────────────────────
export const unitConversionApi = {
  list: (params = {}) => api.get('/inventory/units', { params }).then(r => r.data),
  get:  (id)          => api.get(`/inventory/units/${id}`).then(r => r.data),
  create: (data)      => api.post('/inventory/units', data).then(r => r.data),
  update: (id, data)  => api.put(`/inventory/units/${id}`, data).then(r => r.data),
  delete: (id)        => api.delete(`/inventory/units/${id}`).then(r => r.data),
  // Get all conversions for a specific product
  forProduct: (productId) =>
    api.get(`/inventory/units/product/${productId}`).then(r => r.data),
}

// ── Rack / Bin ────────────────────────────────────────────────
export const rackBinApi = {
  list: (params = {}) => api.get('/inventory/rack-bins', { params }).then(r => r.data),
  get:  (id)          => api.get(`/inventory/rack-bins/${id}`).then(r => r.data),
  create: (data)      => api.post('/inventory/rack-bins', data).then(r => r.data),
  update: (id, data)  => api.put(`/inventory/rack-bins/${id}`, data).then(r => r.data),
  delete: (id)        => api.delete(`/inventory/rack-bins/${id}`).then(r => r.data),
  // Get all racks for a warehouse
  forWarehouse: (warehouseId) =>
    api.get(`/inventory/rack-bins/warehouse/${warehouseId}`).then(r => r.data),
}

// ── Batch / Lot ───────────────────────────────────────────────
export const batchLotApi = {
  list: (params = {}) => api.get('/inventory/batches', { params }).then(r => r.data),
  get:  (id)          => api.get(`/inventory/batches/${id}`).then(r => r.data),
  create: (data)      => api.post('/inventory/batches', data).then(r => r.data),
  update: (id, data)  => api.put(`/inventory/batches/${id}`, data).then(r => r.data),
  delete: (id)        => api.delete(`/inventory/batches/${id}`).then(r => r.data),
  // Stock by batch
  stockForBatch: (batchId) =>
    api.get(`/inventory/batches/${batchId}/stock`).then(r => r.data),
}

// ── Shade / Caliber ───────────────────────────────────────────
export const shadeCaliberApi = {
  // Shades
  listShades:   (params = {}) => api.get('/inventory/shades', { params }).then(r => r.data),
  createShade:  (data)        => api.post('/inventory/shades', data).then(r => r.data),
  updateShade:  (id, data)    => api.put(`/inventory/shades/${id}`, data).then(r => r.data),
  deleteShade:  (id)          => api.delete(`/inventory/shades/${id}`).then(r => r.data),
  // Calibers
  listCalibers: (params = {}) => api.get('/inventory/calibers', { params }).then(r => r.data),
  createCaliber:(data)        => api.post('/inventory/calibers', data).then(r => r.data),
  updateCaliber:(id, data)    => api.put(`/inventory/calibers/${id}`, data).then(r => r.data),
  deleteCaliber:(id)          => api.delete(`/inventory/calibers/${id}`).then(r => r.data),
}

// ── Damage / Breakage ─────────────────────────────────────────
export const damageApi = {
  list: (params = {}) => api.get('/inventory/damages', { params }).then(r => r.data),
  get:  (id)          => api.get(`/inventory/damages/${id}`).then(r => r.data),
  create: (data)      => api.post('/inventory/damages', data).then(r => r.data),
  update: (id, data)  => api.put(`/inventory/damages/${id}`, data).then(r => r.data),
  // Approve → moves stock from saleable to damaged
  approve: (id, remarks = '') =>
    api.patch(`/inventory/damages/${id}/approve`, { remarks }).then(r => r.data),
  delete: (id)        => api.delete(`/inventory/damages/${id}`).then(r => r.data),
}

// ── Stock Adjustment ──────────────────────────────────────────
export const stockAdjustmentApi = {
  list: (params = {}) => api.get('/inventory/adjustments', { params }).then(r => r.data),
  get:  (id)          => api.get(`/inventory/adjustments/${id}`).then(r => r.data),
  create: (data)      => api.post('/inventory/adjustments', data).then(r => r.data),
  // Approve → applies the adjustment to inventory
  approve: (id, remarks = '') =>
    api.patch(`/inventory/adjustments/${id}/approve`, { remarks }).then(r => r.data),
  reject: (id, reason = '') =>
    api.patch(`/inventory/adjustments/${id}/reject`, { reason }).then(r => r.data),
  delete: (id)        => api.delete(`/inventory/adjustments/${id}`).then(r => r.data),
}

// ── Purchase Reports ──────────────────────────────────────────
export const purchaseReportApi = {
  // params: { from_date, to_date, supplier_id, product_id, warehouse_id, status }
  purchaseRegister: (params = {}) =>
    api.get('/purchase-reports/register', { params }).then(r => r.data),
  supplierWise: (params = {}) =>
    api.get('/purchase-reports/supplier-wise', { params }).then(r => r.data),
  productWise: (params = {}) =>
    api.get('/purchase-reports/product-wise', { params }).then(r => r.data),
  pendingPOs: (params = {}) =>
    api.get('/purchase-reports/pending-pos', { params }).then(r => r.data),
  grnReport: (params = {}) =>
    api.get('/purchase-reports/grn', { params }).then(r => r.data),
  returnReport: (params = {}) =>
    api.get('/purchase-reports/returns', { params }).then(r => r.data),
  supplierOutstanding: (params = {}) =>
    api.get('/purchase-reports/outstanding', { params }).then(r => r.data),
}

// ── Inventory Reports ─────────────────────────────────────────
export const inventoryReportApi = {
  // params: { warehouse_id, product_id, from_date, to_date, brand_id, category_id }
  currentStock: (params = {}) =>
    api.get('/inventory/reports/current-stock', { params }).then(r => r.data),
  stockValuation: (params = {}) =>
    api.get('/inventory/reports/valuation', { params }).then(r => r.data),
  lowStock: (params = {}) =>
    api.get('/inventory/reports/low-stock', { params }).then(r => r.data),
  movementReport: (params = {}) =>
    api.get('/inventory/reports/movements', { params }).then(r => r.data),
  damageReport: (params = {}) =>
    api.get('/inventory/reports/damage', { params }).then(r => r.data),
  batchReport: (params = {}) =>
    api.get('/inventory/reports/batch', { params }).then(r => r.data),
  transferReport: (params = {}) =>
    api.get('/inventory/reports/transfers', { params }).then(r => r.data),
}
