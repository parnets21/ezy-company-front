import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { ErpProvider, useErp } from './context/ErpContext'
import { AuthProvider } from './context/AuthContext'
import Layout from './components/Layout'
import RequireAccess from './components/RequireAccess'
import { MODULES } from './config/permissions'
import Login from './pages/Login'
import CompanyLogin from './pages/CompanyLogin'
import Dashboard from './pages/Dashboard'
import UserManagement from './pages/UserManagement'
import CompanyRegistration from './pages/CompanyRegistration'
import BranchManagement from './pages/BranchManagement'
import Categories from './pages/Categories'
import Brands from './pages/Brands'
import ProductManagement from './pages/ProductManagement'
import WholesalerProducts from './pages/WholesalerProducts'
import WholesalerPurchaseOrders from './pages/WholesalerPurchaseOrders'
import WholesalerProductRequests from './pages/WholesalerProductRequests'
import WholesalerActivity from './pages/WholesalerActivity'
import WholesalerManagement from './pages/WholesalerManagement'
import RetailerManagement from './pages/RetailerManagement'
import StaffManagement from './pages/StaffManagement'
import InventoryManagement from './pages/InventoryManagement'
import StockTransfer from './pages/StockTransfer'

import EnquiryManagement from './pages/EnquiryManagement'
import OrderManagement from './pages/OrderManagement'
import DispatchManagement from './pages/DispatchManagement'
import CustomerManagement from './pages/CustomerManagement'
import LeadManagement from './pages/LeadManagement'
import FollowUpManagement from './pages/FollowUpManagement'
import SalesManagement from './pages/SalesManagement'
import PurchaseManagement from './pages/PurchaseManagement'
import SupplierManagement from './pages/SupplierManagement'
import ExpenseManagement from './pages/ExpenseManagement'
import ProfitLoss from './pages/ProfitLoss'
import PaymentManagement from './pages/PaymentManagement'
import AccountsModule from './pages/AccountsModule'
import EmployeeManagement from './pages/EmployeeManagement'
import EmployeeMasterManagement from './pages/EmployeeMasterManagement'
import RolePermissions from './pages/RolePermissions'
import NotificationSystem from './pages/NotificationSystem'
import AuditLog from './pages/AuditLog'
import ReportCenter from './pages/ReportCenter'
import DashboardAnalytics from './pages/DashboardAnalytics'
import WarehouseManagement from './pages/WarehouseManagement'
import DocumentManagement from './pages/DocumentManagement'
import Profile from './pages/Profile'
import SubscriptionSystem from './pages/SubscriptionSystem'
import QuotationManager from './pages/QuotationManager'
import InvoiceManagement from './pages/InvoiceManagement'
import StoneCalculation from './pages/StoneCalculation'

import PurchaseDashboard from './pages/PurchaseDashboard'
import PurchaseRequisition from './pages/PurchaseRequisition'
import PurchaseOrders from './pages/PurchaseOrders'
import GRNManagement from './pages/GRNManagement'
import QualityInspection from './pages/QualityInspection'
import PurchaseInvoicePage from './pages/PurchaseInvoicePage'
import PurchaseReturn from './pages/PurchaseReturn'
import PurchaseReports from './pages/PurchaseReports'
import InventoryDashboard from './pages/InventoryDashboard'
import UnitConversion from './pages/UnitConversion'
import RackBinManagement from './pages/RackBinManagement'
import OpeningStock from './pages/OpeningStock'
import StockLedger from './pages/StockLedger'
import StockAdjustmentPage from './pages/StockAdjustmentPage'
import DamageBreakage from './pages/DamageBreakage'
import BatchLotManagement from './pages/BatchLotManagement'
import ShadeCaliberManagement from './pages/ShadeCaliberManagement'
import InventoryReports from './pages/InventoryReports'

import './index.css'

function AppRoutes() {
  const { isLoggedIn, logout } = useAuth()
  const erpCtx = useErp()

  const {
    notifications, enquiries, orders, dispatches, payments,
    products, categories, subCategories, brands, customers, leads, followups,
    employees, users, companies, warehouses, transfers,
    inventory, purchases, sales, expenses, documents, dashboardStats,
    loadingData,
  } = erpCtx

  if (!isLoggedIn) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/company-login" element={<CompanyLogin />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/dashboard" replace />} />
      <Route path="/company-login" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/"
        element={
          <Layout
            onLogout={logout}
            notifications={notifications}
            enquiries={enquiries}
            orders={orders}
            dispatches={dispatches}
            payments={payments}
          />
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />

        {/* ── Dashboard ─────────────────────────────────── */}
        <Route path="dashboard" element={<RequireAccess module={MODULES.DASHBOARD}><Dashboard {...erpCtx} /></RequireAccess>} />

        {/* ── Company Management ───────────────────────── */}
        <Route path="company-management/company-registration"
          element={<RequireAccess module={MODULES.COMPANY_REGISTRATION}><CompanyRegistration companies={companies} {...erpCtx} /></RequireAccess>} />
        <Route path="company-management/branch-management"
          element={<RequireAccess module={MODULES.BRANCH_MANAGEMENT}><BranchManagement
            branches={erpCtx.branches || []}
            addBranch={erpCtx.addBranch}
            updateBranch={erpCtx.updateBranch}
            deleteBranch={erpCtx.deleteBranch}
          /></RequireAccess>} />
        <Route path="company-management/user-management"
          element={<RequireAccess module={MODULES.USER_MANAGEMENT}><UserManagement users={users} {...erpCtx} /></RequireAccess>} />
        <Route path="company-management/roles-permissions"
          element={<RequireAccess module={MODULES.ROLE_PERMISSIONS}><RolePermissions /></RequireAccess>} />

        {/* ── Product Management ───────────────────────── */}
        <Route path="product-management/categories"
          element={<RequireAccess module={MODULES.CATEGORIES}><Categories categories={categories} subCategories={subCategories} products={products} {...erpCtx} /></RequireAccess>} />
        <Route path="product-management/brands"
          element={<RequireAccess module={MODULES.BRANDS}><Brands brands={brands} {...erpCtx} /></RequireAccess>} />
        <Route path="product-management/products"
          element={<RequireAccess module={MODULES.PRODUCTS}><ProductManagement mode="admin" products={products} categories={categories} subCategories={subCategories} brands={brands} {...erpCtx} /></RequireAccess>} />
        <Route path="product-management/external-products"
          element={<RequireAccess module={MODULES.PRODUCTS}><ProductManagement mode="external" products={products} categories={categories} subCategories={subCategories} brands={brands} {...erpCtx} /></RequireAccess>} />

        {/* ── Wholesaler — dedicated per-section pages ─── */}
        <Route path="wholesaler-management"
          element={<Navigate to="/wholesaler-management/products" replace />} />
        <Route path="wholesaler-management/products"
          element={<RequireAccess module={MODULES.WHOLESALER_MGMT}><WholesalerManagement view="products" /></RequireAccess>} />
        <Route path="wholesaler-management/purchase-orders"
          element={<RequireAccess module={MODULES.WHOLESALER_MGMT}><WholesalerManagement view="purchases" /></RequireAccess>} />
        <Route path="wholesaler-management/product-requests"
          element={<RequireAccess module={MODULES.WHOLESALER_MGMT}><WholesalerManagement view="requests" /></RequireAccess>} />
        <Route path="wholesaler-management/orders"
          element={<RequireAccess module={MODULES.WHOLESALER_MGMT}><WholesalerManagement view="orders" /></RequireAccess>} />
        <Route path="wholesaler-management/enquiries"
          element={<RequireAccess module={MODULES.WHOLESALER_MGMT}><WholesalerManagement view="enquiries" /></RequireAccess>} />
        <Route path="wholesaler-management/users"
          element={<RequireAccess module={MODULES.WHOLESALER_MGMT}><WholesalerManagement view="users" /></RequireAccess>} />
        <Route path="wholesaler-management/subscriptions"
          element={<RequireAccess module={MODULES.WHOLESALER_MGMT}><WholesalerManagement view="subs" /></RequireAccess>} />
        {/* Back-compat: old sub-pages → redirect to unified hub */}
        <Route path="wholesaler/products"         element={<Navigate to="/wholesaler-management" replace />} />
        <Route path="wholesaler/purchase-orders"  element={<Navigate to="/wholesaler-management" replace />} />
        <Route path="wholesaler/product-requests" element={<Navigate to="/wholesaler-management" replace />} />
        <Route path="wholesaler/activity"         element={<Navigate to="/wholesaler-management" replace />} />
        <Route path="wholesaler-items"            element={<Navigate to="/wholesaler-management" replace />} />

        {/* ── Retailer — dedicated per-section pages ───── */}
        <Route path="retailer-management"
          element={<Navigate to="/retailer-management/companies" replace />} />
        <Route path="retailer-management/companies"
          element={<RequireAccess module={MODULES.RETAILER_MGMT}><RetailerManagement view="companies" /></RequireAccess>} />
        <Route path="retailer-management/orders"
          element={<RequireAccess module={MODULES.RETAILER_MGMT}><RetailerManagement view="orders" /></RequireAccess>} />
        <Route path="retailer-management/enquiries"
          element={<RequireAccess module={MODULES.RETAILER_MGMT}><RetailerManagement view="enquiries" /></RequireAccess>} />
        <Route path="retailer-management/sales"
          element={<RequireAccess module={MODULES.RETAILER_MGMT}><RetailerManagement view="sales" /></RequireAccess>} />
        <Route path="retailer-management/purchases"
          element={<RequireAccess module={MODULES.RETAILER_MGMT}><RetailerManagement view="purchases" /></RequireAccess>} />
        <Route path="retailer-management/expenses"
          element={<RequireAccess module={MODULES.RETAILER_MGMT}><RetailerManagement view="expenses" /></RequireAccess>} />
        <Route path="retailer-management/payments"
          element={<RequireAccess module={MODULES.RETAILER_MGMT}><RetailerManagement view="transactions" /></RequireAccess>} />
        <Route path="retailer-management/invoices"
          element={<RequireAccess module={MODULES.RETAILER_MGMT}><RetailerManagement view="invoices" /></RequireAccess>} />
        <Route path="retailer-management/quotations"
          element={<RequireAccess module={MODULES.RETAILER_MGMT}><RetailerManagement view="quotations" /></RequireAccess>} />
        <Route path="retailer-management/customers"
          element={<RequireAccess module={MODULES.RETAILER_MGMT}><RetailerManagement view="customers" /></RequireAccess>} />
        <Route path="retailer-management/leads"
          element={<RequireAccess module={MODULES.RETAILER_MGMT}><RetailerManagement view="leads" /></RequireAccess>} />
        <Route path="retailer-management/followups"
          element={<RequireAccess module={MODULES.RETAILER_MGMT}><RetailerManagement view="followups" /></RequireAccess>} />
        <Route path="retailer-management/inventory"
          element={<RequireAccess module={MODULES.RETAILER_MGMT}><RetailerManagement view="inventory" /></RequireAccess>} />
        <Route path="retailer-management/dispatches"
          element={<RequireAccess module={MODULES.RETAILER_MGMT}><RetailerManagement view="dispatches" /></RequireAccess>} />
        <Route path="retailer-management/users"
          element={<RequireAccess module={MODULES.RETAILER_MGMT}><RetailerManagement view="users" /></RequireAccess>} />
        <Route path="retailer-management/subscriptions"
          element={<RequireAccess module={MODULES.RETAILER_MGMT}><RetailerManagement view="subs" /></RequireAccess>} />

        {/* ── Staff Management ─────────────────────────── */}
        <Route path="staff/staff-management"
          element={<RequireAccess module={MODULES.STAFF_MGMT}><StaffManagement /></RequireAccess>} />

        {/* ── Purchase ─────────────────────────────────── */}
        <Route path="purchase-inventory/purchase-dashboard"
          element={<RequireAccess module={MODULES.PURCHASE_DASHBOARD}><PurchaseDashboard purchases={purchases} suppliers={erpCtx.suppliers} products={products} /></RequireAccess>} />
        <Route path="purchase-inventory/supplier-management"
          element={<RequireAccess module={MODULES.SUPPLIERS}><SupplierManagement suppliers={erpCtx.suppliers} addSupplier={erpCtx.addSupplier} updateSupplier={erpCtx.updateSupplier} deleteSupplier={erpCtx.deleteSupplier} /></RequireAccess>} />
        <Route path="purchase-inventory/purchase-requisition"
          element={<RequireAccess module={MODULES.PURCHASE_REQUISITION}><PurchaseRequisition products={products} suppliers={erpCtx.suppliers} warehouses={warehouses} branches={erpCtx.branches || []} /></RequireAccess>} />
        <Route path="purchase-inventory/purchase-orders"
          element={<RequireAccess module={MODULES.PURCHASE_ORDERS}><PurchaseOrders purchases={purchases} products={products} suppliers={erpCtx.suppliers} warehouses={warehouses} branches={erpCtx.branches || []} {...erpCtx} /></RequireAccess>} />
        <Route path="purchase-inventory/purchase-management"
          element={<RequireAccess module={MODULES.PURCHASES}><PurchaseManagement branches={erpCtx.branches || []} purchases={purchases} products={products} suppliers={erpCtx.suppliers} {...erpCtx} /></RequireAccess>} />
        <Route path="purchase-inventory/grn"
          element={<RequireAccess module={MODULES.GRN}><GRNManagement purchases={purchases} products={products} suppliers={erpCtx.suppliers} warehouses={warehouses} branches={erpCtx.branches || []} inventory={inventory} /></RequireAccess>} />
        <Route path="purchase-inventory/quality-inspection"
          element={<RequireAccess module={MODULES.QUALITY_INSPECTION}><QualityInspection products={products} warehouses={warehouses} inventory={inventory} /></RequireAccess>} />
        <Route path="purchase-inventory/purchase-invoice"
          element={<RequireAccess module={MODULES.PURCHASE_INVOICE}><PurchaseInvoicePage purchases={purchases} products={products} suppliers={erpCtx.suppliers} updatePurchaseBillPayment={erpCtx.updatePurchaseBillPayment} /></RequireAccess>} />
        <Route path="purchase-inventory/purchase-return"
          element={<RequireAccess module={MODULES.PURCHASE_RETURN}><PurchaseReturn purchases={purchases} products={products} suppliers={erpCtx.suppliers} warehouses={warehouses} inventory={inventory} /></RequireAccess>} />
        <Route path="purchase-inventory/purchase-reports"
          element={<RequireAccess module={MODULES.PURCHASE_REPORTS}><PurchaseReports purchases={purchases} products={products} suppliers={erpCtx.suppliers} warehouses={warehouses} /></RequireAccess>} />

        {/* ── Inventory ────────────────────────────────── */}
        <Route path="purchase-inventory/inventory-dashboard"
          element={<RequireAccess module={MODULES.INVENTORY_DASHBOARD}><InventoryDashboard inventory={inventory} products={products} warehouses={warehouses} /></RequireAccess>} />
        <Route path="purchase-inventory/unit-conversion"
          element={<RequireAccess module={MODULES.UNIT_CONVERSION}><UnitConversion products={products} /></RequireAccess>} />
        <Route path="purchase-inventory/warehouse-management"
          element={<RequireAccess module={MODULES.WAREHOUSES}><WarehouseManagement branches={erpCtx.branches || []} /></RequireAccess>} />
        <Route path="purchase-inventory/rack-bin"
          element={<RequireAccess module={MODULES.RACK_BIN}><RackBinManagement warehouses={warehouses} /></RequireAccess>} />
        <Route path="purchase-inventory/opening-stock"
          element={<RequireAccess module={MODULES.OPENING_STOCK}><OpeningStock products={products} warehouses={warehouses} /></RequireAccess>} />
        <Route path="purchase-inventory/inventory-management"
          element={<RequireAccess module={MODULES.INVENTORY}><InventoryManagement branches={erpCtx.branches || []} inventory={inventory} products={products} warehouses={warehouses} {...erpCtx} /></RequireAccess>} />
        <Route path="purchase-inventory/stock-ledger"
          element={<RequireAccess module={MODULES.STOCK_LEDGER}><StockLedger products={products} warehouses={warehouses} inventory={inventory} /></RequireAccess>} />
        <Route path="purchase-inventory/stock-transfer"
          element={<RequireAccess module={MODULES.STOCK_TRANSFER}><StockTransfer branches={erpCtx.branches || []} transfers={transfers} warehouses={warehouses} products={products} {...erpCtx} /></RequireAccess>} />
        <Route path="purchase-inventory/stock-adjustment"
          element={<RequireAccess module={MODULES.STOCK_ADJUSTMENT}><StockAdjustmentPage products={products} warehouses={warehouses} inventory={inventory} /></RequireAccess>} />
        <Route path="purchase-inventory/damage-breakage"
          element={<RequireAccess module={MODULES.DAMAGE_BREAKAGE}><DamageBreakage products={products} warehouses={warehouses} inventory={inventory} /></RequireAccess>} />
        <Route path="purchase-inventory/batch-lot"
          element={<RequireAccess module={MODULES.BATCH_LOT}><BatchLotManagement products={products} warehouses={warehouses} inventory={inventory} /></RequireAccess>} />
        <Route path="purchase-inventory/shade-caliber"
          element={<RequireAccess module={MODULES.SHADE_CALIBER}><ShadeCaliberManagement products={products} warehouses={warehouses} inventory={inventory} /></RequireAccess>} />
        <Route path="purchase-inventory/inventory-reports"
          element={<RequireAccess module={MODULES.INVENTORY_REPORTS}><InventoryReports inventory={inventory} products={products} warehouses={warehouses} /></RequireAccess>} />

        {/* ── Marketplace ──────────────────────────────── */}
        <Route path="marketplace/enquiry-management"
          element={<RequireAccess module={MODULES.ENQUIRIES}><EnquiryManagement enquiries={enquiries} inventory={inventory} orders={orders} products={products} branches={erpCtx.branches || []} {...erpCtx} /></RequireAccess>} />
        <Route path="marketplace/order-management"
          element={<RequireAccess module={MODULES.ORDERS}><OrderManagement branches={erpCtx.branches || []} orders={orders} enquiries={enquiries} products={products} dispatches={dispatches} employees={erpCtx.employees || []} {...erpCtx} /></RequireAccess>} />
        <Route path="marketplace/dispatch-management"
          element={<RequireAccess module={MODULES.DISPATCHES}><DispatchManagement branches={erpCtx.branches || []} dispatches={dispatches} orders={orders} {...erpCtx} /></RequireAccess>} />

        {/* ── CRM ──────────────────────────────────────── */}
        <Route path="crm/customer-management"
          element={<RequireAccess module={MODULES.CUSTOMERS}><CustomerManagement customers={customers} {...erpCtx} /></RequireAccess>} />
        <Route path="crm/lead-management"
          element={<RequireAccess module={MODULES.LEADS}><LeadManagement leads={leads} customers={customers} {...erpCtx} /></RequireAccess>} />
        <Route path="crm/followup-management"
          element={<RequireAccess module={MODULES.FOLLOWUPS}><FollowUpManagement followups={followups} leads={leads} customers={customers} {...erpCtx} /></RequireAccess>} />

        {/* ── Finance ──────────────────────────────────── */}
        <Route path="finance/quotation-manager"
          element={<RequireAccess module={MODULES.QUOTATIONS}><QuotationManager products={products} enquiries={enquiries} customers={customers} /></RequireAccess>} />
        <Route path="finance/invoice-management"
          element={<RequireAccess module={MODULES.INVOICES}><InvoiceManagement products={products} customers={customers} /></RequireAccess>} />
        <Route path="finance/sales-management"
          element={<RequireAccess module={MODULES.SALES}><SalesManagement branches={erpCtx.branches || []} sales={sales} orders={orders} customers={customers} products={products} addSale={erpCtx.addSale} {...erpCtx} /></RequireAccess>} />
        <Route path="finance/expense-management"
          element={<RequireAccess module={MODULES.EXPENSES}><ExpenseManagement /></RequireAccess>} />
        <Route path="finance/payment-management"
          element={<RequireAccess module={MODULES.PAYMENTS}><PaymentManagement /></RequireAccess>} />
        <Route path="finance/accounts-management"
          element={<RequireAccess module={MODULES.ACCOUNTS}><AccountsModule sales={sales} purchases={purchases} customers={customers} suppliers={erpCtx.suppliers || []} /></RequireAccess>} />
        <Route path="finance/profit-loss"
          element={<RequireAccess module={MODULES.PROFIT_LOSS}><ProfitLoss /></RequireAccess>} />

        {/* ── HR ───────────────────────────────────────── */}
        <Route path="hr/employee-master"
          element={<RequireAccess module={MODULES.EMPLOYEE_MASTER}><EmployeeMasterManagement /></RequireAccess>} />
        <Route path="hr/employee-management"
          element={<RequireAccess module={MODULES.EMPLOYEE_MANAGEMENT}><EmployeeManagement branches={erpCtx.branches || []} employees={employees} {...erpCtx} /></RequireAccess>} />

        {/* ── Reports ──────────────────────────────────── */}
        <Route path="reports/dashboard-analytics"
          element={<RequireAccess module={MODULES.DASHBOARD_ANALYTICS}><DashboardAnalytics /></RequireAccess>} />
        <Route path="reports/report-center"
          element={<RequireAccess module={MODULES.REPORT_CENTER}><ReportCenter /></RequireAccess>} />

        {/* ── System ───────────────────────────────────── */}
        <Route path="system/notification-management"
          element={<RequireAccess module={MODULES.NOTIFICATIONS}><NotificationSystem notifications={notifications} {...erpCtx} /></RequireAccess>} />
        <Route path="system/document-management"
          element={<RequireAccess module={MODULES.DOCUMENTS}><DocumentManagement /></RequireAccess>} />
        <Route path="system/subscription"   element={<RequireAccess module={MODULES.SUBSCRIPTION}><SubscriptionSystem /></RequireAccess>} />
        <Route path="system/audit-log"      element={<RequireAccess module={MODULES.AUDIT}><AuditLog /></RequireAccess>} />
        <Route path="system/profile"        element={<RequireAccess module={MODULES.PROFILE}><Profile /></RequireAccess>} />
        <Route path="subscription"          element={<RequireAccess module={MODULES.SUBSCRIPTION}><SubscriptionSystem /></RequireAccess>} />

        {/* ── Tools ────────────────────────────────────── */}
        <Route path="tools/stone-calculation"
          element={<RequireAccess module={MODULES.STONE_CALC}><StoneCalculation /></RequireAccess>} />
        {/* Back-compat: old gradient path → stone calculation */}
        <Route path="tools/gradient-calculation" element={<Navigate to="/tools/stone-calculation" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <ErpProvider>
          <AppRoutes />
        </ErpProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
