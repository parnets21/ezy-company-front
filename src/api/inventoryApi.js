/**
 * inventoryApi.js
 * Inventory · Warehouse Management · Stock Transfers
 *
 * ── Inventory ────────────────────────────────────────────────
 *   GET    /inventory                          → list (filter: warehouse_id, low_stock, page, limit)
 *   PATCH  /inventory/adjust                   → manual stock adjustment
 *
 * ── Warehouses ───────────────────────────────────────────────
 *   GET    /inventory/warehouses               → list all warehouses
 *   GET    /inventory/warehouses/:id           → single warehouse details
 *   GET    /inventory/warehouses/:id/stock     → warehouse with full stock list
 *   POST   /inventory/warehouses               → create warehouse
 *   PUT    /inventory/warehouses/:id           → update warehouse
 *   DELETE /inventory/warehouses/:id           → delete warehouse
 *
 * ── Stock Transfers ──────────────────────────────────────────
 *   GET    /inventory/transfers                → list (filter: status, page, limit)
 *   GET    /inventory/transfers/:id            → single transfer
 *   POST   /inventory/transfers                → create transfer
 *   PATCH  /inventory/transfers/:id/status     → approve / in-transit / complete / cancel
 *   DELETE /inventory/transfers/:id            → delete transfer
 */
import api from './index'

export const inventoryApi = {
  // ── Inventory ─────────────────────────────────────────────

  /**
   * List all inventory records.
   * @param {object} params - { warehouse_id, low_stock, page, limit }
   * Returns: { inventory: [], pagination: {} }
   */
  list: (params = {}) =>
    api.get('/inventory', { params }).then(r => r.data),

  /**
   * List stock movement audit trail from DB.
   * @param {object} params - { product_id, warehouse_id, movement_type, reference_type, page, limit }
   * Returns: array of StockMovement records
   */
  listMovements: (params = {}) =>
    api.get('/inventory/movements', { params }).then(r => r.data),

  /**
   * Get inventory KPI summary (totals + low/out count).
   * Returns: { total_physical, total_available, total_reserved, ... low_stock, out_of_stock }
   */
  getSummary: () =>
    api.get('/inventory/summary').then(r => r.data),

  /**
   * Manual stock adjustment (positive = add, negative = deduct).
   * @param {object} data - { product_id, warehouse_id, adjustment, notes }
   */
  adjust: (data) =>
    api.patch('/inventory/adjust', data).then(r => r.data),

  // Single inventory record with recent movements.
  get: (id) =>
    api.get(`/inventory/${id}`).then(r => r.data),

  // Update alert thresholds: { low_stock_alert?, reorder_level? }
  updateSettings: (id, data) =>
    api.patch(`/inventory/${id}/settings`, data).then(r => r.data),

  // ── Warehouses ────────────────────────────────────────────

  /**
   * List all warehouses for the company.
   * Returns: array of warehouse objects
   */
  listWarehouses: (params = {}) =>
    api.get('/inventory/warehouses', { params }).then(r => r.data),

  /**
   * Get a single warehouse by ID.
   * @param {string} id - warehouse _id
   */
  getWarehouse: (id) =>
    api.get(`/inventory/warehouses/${id}`).then(r => r.data),

  /**
   * Get warehouse details WITH full stock list.
   * @param {string} id - warehouse _id
   * Returns: { ...warehouse, stock: [{ product_name, product_code, current_stock, ... }] }
   */
  getWarehouseStock: (id) =>
    api.get(`/inventory/warehouses/${id}/stock`).then(r => r.data),

  /**
   * Create a new warehouse.
   * @param {object} data - { name, city, state, address, manager, mobile, capacity, unit }
   */
  createWarehouse: (data) =>
    api.post('/inventory/warehouses', data).then(r => r.data),

  /**
   * Update warehouse details.
   * @param {string} id
   * @param {object} data - { name, city, state, address, manager, mobile, capacity, unit, is_active }
   */
  updateWarehouse: (id, data) =>
    api.put(`/inventory/warehouses/${id}`, data).then(r => r.data),

  /**
   * Delete a warehouse (only if no inventory exists for it).
   * @param {string} id
   */
  deleteWarehouse: (id) =>
    api.delete(`/inventory/warehouses/${id}`).then(r => r.data),

  // ── Stock Transfers ───────────────────────────────────────

  /**
   * List all stock transfers.
   * @param {object} params - { status, page, limit }
   * Returns: { transfers: [], pagination: {} }
   */
  listTransfers: (params = {}) =>
    api.get('/inventory/transfers', { params }).then(r => r.data),

  /**
   * Get a single transfer by ID.
   * @param {string} id
   */
  getTransfer: (id) =>
    api.get(`/inventory/transfers/${id}`).then(r => r.data),

  /**
   * Create a new stock transfer.
   * Auto-deducts from source warehouse and adds to destination.
   * @param {object} data - { from_warehouse, to_warehouse, product_id, quantity, notes, reason }
   * Status is auto-set to 'Pending'
   */
  createTransfer: (data) =>
    api.post('/inventory/transfers', data).then(r => r.data),

  /**
   * Update transfer status — Approve → In Transit → Complete → Cancel
   * @param {string} id
   * @param {string} status - 'Pending' | 'In Transit' | 'Completed' | 'Cancelled'
   */
  updateTransferStatus: (id, status) =>
    api.patch(`/inventory/transfers/${id}/status`, { status }).then(r => r.data),

  /**
   * Delete a transfer (only Pending/In Transit; Completed cannot be deleted).
   * Automatically reverses stock movement if deleted.
   * @param {string} id
   */
  deleteTransfer: (id) =>
    api.delete(`/inventory/transfers/${id}`).then(r => r.data),
}
