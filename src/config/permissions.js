/**
 * Frontend action-level RBAC.
 * Live permissions are loaded from GET /role-permissions/me in this shape:
 *   { products: { view: true, create: false, edit: false, delete: false } }
 *
 * `canAccess` remains the route/sidebar view check.
 * `canPerform` is used for buttons and handlers.
 */

// Module keys — kept in lock-step with the backend MODULE_CATALOG and the
// admin sidebar (NAV_CONFIG). Every key here maps to a page in the menu.
// Some legacy aliases (ROLE_PERMISSIONS, DASHBOARD_ANALYTICS) resolve to an
// existing module key so older imports keep working.
export const MODULES = {
  // General
  DASHBOARD: 'dashboard', PROFILE: 'profile', NOTIFICATIONS: 'notifications',
  // Company
  COMPANY_REGISTRATION: 'company', BRANCH_MANAGEMENT: 'branch', USER_MANAGEMENT: 'users', ROLE_PERMISSIONS: 'users',
  // App management
  STAFF_MGMT: 'staff_mgmt', WHOLESALER_MGMT: 'wholesaler_mgmt', RETAILER_MGMT: 'retailer_mgmt',
  // Products
  PRODUCTS: 'products',
  // Purchases
  SUPPLIERS: 'suppliers', PURCHASES: 'purchases', PURCHASE_REPORTS: 'purchase_reports',
  // Inventory
  INVENTORY: 'inventory', STOCK_TRANSFER: 'stock_transfer', WAREHOUSES: 'warehouses',
  DAMAGE_BREAKAGE: 'damage_breakage', INVENTORY_REPORTS: 'inventory_reports',
  // Sales & Orders
  ENQUIRIES: 'enquiries', ORDERS: 'orders', DISPATCHES: 'dispatches',
  // Finance
  QUOTATIONS: 'quotations', INVOICES: 'invoices', SALES: 'sales', EXPENSES: 'expenses',
  PAYMENTS: 'payments', ACCOUNTS: 'accounts', PROFIT_LOSS: 'profit_loss',
  // Customers (CRM)
  CUSTOMERS: 'customers', LEADS: 'leads', FOLLOWUPS: 'followups',
  // Employees (HR)
  EMPLOYEE_MASTER: 'employee_master', EMPLOYEE_MANAGEMENT: 'employees',
  // Reports
  DASHBOARD_ANALYTICS: 'reports', REPORT_CENTER: 'reports',
  // Settings (System)
  DOCUMENTS: 'documents', SUBSCRIPTION: 'subscriptions', AUDIT: 'audit',
  // Tools
  STONE_CALC: 'stone_calc',

  // ── Legacy aliases ───────────────────────────────────────
  // These pages/routes still exist in the app but are hidden from the sidebar
  // and no longer have their own Roles & Permissions toggle. They are gated by
  // the parent module that IS in the catalog, so access stays consistent and
  // existing <RequireAccess>/canPerform calls keep resolving to a real key.
  CATEGORIES: 'products', BRANDS: 'products',
  PURCHASE_DASHBOARD: 'purchases', PURCHASE_REQUISITION: 'purchases', PURCHASE_ORDERS: 'purchases',
  GRN: 'purchases', QUALITY_INSPECTION: 'purchases', PURCHASE_INVOICE: 'purchases', PURCHASE_RETURN: 'purchases',
  INVENTORY_DASHBOARD: 'inventory', UNIT_CONVERSION: 'inventory', RACK_BIN: 'inventory',
  OPENING_STOCK: 'inventory', STOCK_LEDGER: 'inventory', STOCK_ADJUSTMENT: 'inventory',
  BATCH_LOT: 'inventory', SHADE_CALIBER: 'inventory',
  PRODUCT_SEARCH: 'products', ATTENDANCE: 'employees', SALARY: 'employees',
}

export const ACTIONS = {
  VIEW: 'view', CREATE: 'create', EDIT: 'edit', DELETE: 'delete', EXPORT: 'export',
  APPROVE: 'approve', REJECT: 'reject', CANCEL: 'cancel', COMPLETE: 'complete',
  STOCK_IN: 'stock_in', STOCK_OUT: 'stock_out', TRANSFER: 'transfer',
  REPLY: 'reply', OFFER: 'offer', CONVERT: 'convert', DELIVER: 'deliver', DISPATCH: 'dispatch',
  UPLOAD: 'upload', DOWNLOAD: 'download', PAYMENT: 'payment', PAY: 'pay', COLLECT: 'collect',
  MANAGE_PERMISSIONS: 'manage_permissions',
}

const M = MODULES
const COMMON = [M.DASHBOARD, M.PROFILE, M.NOTIFICATIONS]

// Default page visibility per role, in terms of the catalog module keys that
// map to real sidebar pages. Mirrors the backend ROLE_MODULES defaults.
export const ROLE_VIEW_MODULES = {
  'Super Admin': '*',
  'Company Owner': '*',
  'Manager': [...COMMON, M.PRODUCTS, M.SUPPLIERS, M.PURCHASES, M.PURCHASE_REPORTS, M.INVENTORY, M.STOCK_TRANSFER, M.WAREHOUSES, M.DAMAGE_BREAKAGE, M.INVENTORY_REPORTS, M.ENQUIRIES, M.ORDERS, M.DISPATCHES, M.CUSTOMERS, M.LEADS, M.FOLLOWUPS, M.EMPLOYEE_MASTER, M.EMPLOYEE_MANAGEMENT, M.REPORT_CENTER, M.STAFF_MGMT, M.STONE_CALC],
  'Accountant': [...COMMON, M.PRODUCTS, M.SUPPLIERS, M.PURCHASES, M.PURCHASE_REPORTS, M.INVENTORY, M.INVENTORY_REPORTS, M.CUSTOMERS, M.QUOTATIONS, M.INVOICES, M.SALES, M.EXPENSES, M.PAYMENTS, M.ACCOUNTS, M.PROFIT_LOSS, M.REPORT_CENTER, M.DOCUMENTS, M.STONE_CALC],
  'Sales Executive': [...COMMON, M.PRODUCTS, M.ENQUIRIES, M.ORDERS, M.CUSTOMERS, M.LEADS, M.FOLLOWUPS, M.QUOTATIONS, M.INVENTORY, M.STONE_CALC],
  'Warehouse Staff': [...COMMON, M.WAREHOUSES, M.INVENTORY, M.STOCK_TRANSFER, M.DAMAGE_BREAKAGE, M.INVENTORY_REPORTS, M.ORDERS, M.DISPATCHES, M.STONE_CALC],
  'Retailer': [...COMMON, M.ENQUIRIES, M.ORDERS, M.STONE_CALC],
  'Wholesaler': [...COMMON, M.PRODUCTS, M.INVENTORY, M.ENQUIRIES, M.ORDERS, M.STONE_CALC],
}

let _override = null
const _listeners = new Set()

export function setLivePermissions(map) {
  _override = map && typeof map === 'object' ? structuredClone(map) : null
  _listeners.forEach(listener => { try { listener() } catch { /* no-op */ } })
}

export function clearLivePermissions() {
  setLivePermissions(null)
}

export function onPermissionsChange(listener) {
  _listeners.add(listener)
  return () => _listeners.delete(listener)
}

export function canPerform(role, moduleKey, actionKey = 'view') {
  if (!role) return false
  if (role === 'Super Admin') return true
  if (!moduleKey) return true

  if (_override) {
    const modulePermission = _override[moduleKey]
    // Compatibility with legacy { module: boolean } responses.
    if (typeof modulePermission === 'boolean') return modulePermission
    if (modulePermission && typeof modulePermission === 'object') return modulePermission[actionKey] === true
    return false
  }

  // Before live permissions load, expose only SOP-default page visibility.
  if (actionKey !== 'view') return false
  const allowed = ROLE_VIEW_MODULES[role]
  return allowed === '*' || Array.isArray(allowed) && allowed.includes(moduleKey)
}

export function canAccess(role, moduleKey) {
  return canPerform(role, moduleKey, 'view')
}

export function allowedModules(role) {
  const allowed = ROLE_VIEW_MODULES[role]
  if (allowed === '*') return [...new Set(Object.values(MODULES))]
  return Array.isArray(allowed) ? allowed : []
}


// Full SOP catalog used by the permission editor and as a compatibility fallback
// when an older running backend still returns modules without action definitions.
const a = (key, label) => ({ key, label })
const crudActions = () => [a('view', 'View'), a('create', 'Add'), a('edit', 'Edit'), a('delete', 'Delete')]

// Mirrors the backend MODULE_CATALOG (src/config/permissions.js). The live
// catalog is served by GET /role-permissions; this is only the offline
// fallback for the permission editor, so the two must stay identical.
export const PERMISSION_CATALOG = [
  // General
  { key: 'dashboard', label: 'Dashboard', category: 'General', actions: [a('view', 'View')] },
  { key: 'profile', label: 'My Account', category: 'General', actions: [a('view', 'View'), a('edit', 'Edit Profile'), a('change_password', 'Change Password')] },
  { key: 'notifications', label: 'Notifications', category: 'General', actions: [a('view', 'View'), a('mark_read', 'Mark Read'), a('delete', 'Delete')] },
  // Company
  { key: 'company', label: 'Company Details', category: 'Company Management', actions: [a('view', 'View'), a('create', 'Add'), a('edit', 'Edit'), a('delete', 'Delete'), a('approve', 'Approve'), a('reject', 'Reject'), a('view_document', 'View Documents')] },
  { key: 'branch', label: 'Branch Management', category: 'Company Management', actions: crudActions() },
  { key: 'users', label: 'User & Role Management', category: 'Company Management', actions: [a('view', 'View'), a('create', 'Add User'), a('edit', 'Edit User'), a('delete', 'Delete User'), a('reset_password', 'Reset Password'), a('assign_role', 'Assign Role'), a('manage_permissions', 'Manage Permissions')] },
  // App Management
  { key: 'staff_mgmt',      label: 'Staff Management',      category: 'App Management', actions: [a('view', 'View'), a('create', 'Add Staff'),     a('edit', 'Edit'), a('delete', 'Delete'), a('reset_password', 'Reset Password')] },
  { key: 'wholesaler_mgmt', label: 'Wholesaler Management', category: 'App Management', actions: [a('view', 'View'), a('create', 'Add Wholesaler'), a('edit', 'Edit'), a('delete', 'Delete'), a('approve', 'Approve'), a('reject', 'Reject')] },
  { key: 'retailer_mgmt',   label: 'Retailer Management',   category: 'App Management', actions: [a('view', 'View'), a('create', 'Add Retailer'),  a('edit', 'Edit'), a('delete', 'Delete'), a('approve', 'Approve'), a('reject', 'Reject')] },
  // Products
  { key: 'products', label: 'Product Management', category: 'Product Management', actions: [a('view', 'View'), a('create', 'Add'), a('edit', 'Edit'), a('delete', 'Delete'), a('view_deleted', 'View Recycle Bin'), a('restore', 'Restore'), a('export', 'Download / Export')] },
  // Purchases
  { key: 'suppliers', label: 'Supplier Management', category: 'Purchase', actions: crudActions() },
  { key: 'purchases', label: 'Purchase Entry', category: 'Purchase', actions: [a('view', 'View'), a('create', 'Add'), a('edit', 'Edit'), a('delete', 'Delete'), a('approve', 'Approve'), a('stock_in', 'Receive Stock'), a('complete', 'Complete'), a('cancel', 'Cancel'), a('export', 'Export')] },
  { key: 'purchase_reports', label: 'Purchase Reports', category: 'Purchase', actions: [a('view', 'View Reports'), a('export', 'Export')] },
  // Inventory
  { key: 'inventory', label: 'Stock (In / Out)', category: 'Inventory', actions: [a('view', 'View'), a('stock_in', 'Stock In'), a('stock_out', 'Stock Out')] },
  { key: 'stock_transfer', label: 'Stock Transfer', category: 'Inventory', actions: [a('view', 'View'), a('transfer', 'Create Transfer'), a('approve', 'Approve'), a('complete', 'Complete'), a('cancel', 'Cancel'), a('delete', 'Delete')] },
  { key: 'warehouses', label: 'Warehouse Management', category: 'Inventory', actions: [a('view', 'View'), a('create', 'Add'), a('edit', 'Edit'), a('delete', 'Delete'), a('view_stock', 'View Stock')] },
  { key: 'damage_breakage', label: 'Damaged Stock', category: 'Inventory', actions: [a('view', 'View'), a('create', 'Record Damage'), a('approve', 'Approve'), a('export', 'Export')] },
  { key: 'inventory_reports', label: 'Inventory Reports', category: 'Inventory', actions: [a('view', 'View Reports'), a('export', 'Export')] },
  // Sales & Orders
  { key: 'enquiries', label: 'Enquiry Management', category: 'Sales & Orders', actions: [a('view', 'View'), a('create', 'Create'), a('edit', 'Edit'), a('delete', 'Delete'), a('reply', 'Reply'), a('offer', 'Send Offer'), a('close', 'Close / Cancel'), a('convert', 'Convert to Order')] },
  { key: 'orders', label: 'Order Management', category: 'Sales & Orders', actions: [a('view', 'View'), a('create', 'Create'), a('edit', 'Edit'), a('delete', 'Delete'), a('approve', 'Approve'), a('pick', 'Pick'), a('sort', 'Sort'), a('pack', 'Pack'), a('invoice', 'Generate Invoice'), a('dispatch', 'Dispatch'), a('deliver', 'Deliver'), a('cancel', 'Cancel')] },
  { key: 'dispatches', label: 'Dispatch Management', category: 'Sales & Orders', actions: [a('view', 'View'), a('dispatch', 'Create / In Transit'), a('edit', 'Edit'), a('deliver', 'Mark Delivered')] },
  // Finance
  { key: 'quotations', label: 'Quotation Management', category: 'Finance', actions: [a('view', 'View'), a('create', 'Add'), a('edit', 'Edit'), a('delete', 'Delete'), a('send', 'Send'), a('approve', 'Accept'), a('convert', 'Convert'), a('cancel', 'Cancel'), a('export', 'Print / Export')] },
  { key: 'invoices', label: 'Invoice Management', category: 'Finance', actions: [a('view', 'View'), a('create', 'Add'), a('edit', 'Edit'), a('delete', 'Delete'), a('send', 'Send'), a('payment', 'Record Payment'), a('cancel', 'Cancel'), a('export', 'Print / Export')] },
  { key: 'sales', label: 'Sales Management', category: 'Finance', actions: [a('view', 'View'), a('create', 'Sales Entry'), a('export', 'Export')] },
  { key: 'expenses', label: 'Expense Management', category: 'Finance', actions: [a('view', 'View'), a('create', 'Add'), a('edit', 'Edit'), a('delete', 'Delete'), a('export', 'Export')] },
  { key: 'payments', label: 'Payment Management', category: 'Finance', actions: [a('view', 'View'), a('collect', 'Collect Receivable'), a('pay', 'Pay Supplier'), a('export', 'Export')] },
  { key: 'accounts', label: 'Accounts Module', category: 'Finance', actions: [a('view', 'View Ledgers'), a('export', 'Export')] },
  { key: 'profit_loss', label: 'Profit & Loss', category: 'Finance', actions: [a('view', 'View'), a('export', 'Export')] },
  // Customers (CRM)
  { key: 'customers', label: 'Customer Management', category: 'Customers', actions: crudActions() },
  { key: 'leads', label: 'Lead Management', category: 'Customers', actions: [a('view', 'View'), a('create', 'Add'), a('edit', 'Edit'), a('delete', 'Delete'), a('convert', 'Convert to Customer')] },
  { key: 'followups', label: 'Follow-up Management', category: 'Customers', actions: [a('view', 'View'), a('create', 'Add'), a('edit', 'Edit'), a('delete', 'Delete'), a('complete', 'Mark Done')] },
  // Employees (HR)
  { key: 'employee_master', label: 'Employee List', category: 'Employees', actions: crudActions() },
  { key: 'employees', label: 'Attendance & Payroll', category: 'Employees', actions: crudActions() },
  // Reports
  { key: 'reports', label: 'Reports & Analytics', category: 'Reports', actions: [a('view', 'View'), a('export', 'PDF / Excel Export')] },
  // Settings (System)
  { key: 'documents', label: 'Document Management', category: 'System', actions: [a('view', 'View'), a('upload', 'Upload'), a('download', 'Download'), a('delete', 'Delete')] },
  { key: 'subscriptions', label: 'Subscription System', category: 'System', actions: [a('view', 'View'), a('change_plan', 'Upgrade / Change Plan'), a('cancel', 'Cancel')] },
  { key: 'audit', label: 'Activity History', category: 'System', actions: [a('view', 'View'), a('export', 'Export')] },
  // Tools
  { key: 'stone_calc', label: 'Stone Calculator', category: 'Tools', actions: [a('view', 'View'), a('create', 'Save Calculation'), a('delete', 'Delete Record')] },
]
