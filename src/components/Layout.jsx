import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Building2, GitBranch, Warehouse, Users, Shield,
  Tag, Package, PackageCheck,
  ShoppingBag, PackagePlus, BarChart3, ArrowLeftRight,
  MessageSquare, ShoppingCart, Truck,
  UserCheck, Target, CalendarClock,
  TrendingUp, Receipt, CreditCard, BookOpen, LineChart, FileEdit,
  UserCog, UserPlus, Store,
  FileBarChart, PieChart,
  Bell, FolderOpen, Settings, UserCircle, LogOut,
  ChevronDown, Menu, X, Layers, ScrollText, Calculator,
  ClipboardList, CheckCheck, Boxes, Send, Factory,
  Scale, Droplets, AlertTriangle, Sliders, CheckSquare, Archive,
  Map,
} from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'
import logoImg from '/logo.png'
import { useAuth } from '../context/AuthContext'
import { MODULES, canAccess, onPermissionsChange } from '../config/permissions'

const BRAND = { orange: '#F26522', blue: '#1E2D4A', navy: '#1E2D4A' }

const NAV_CONFIG = [
  { type: 'item', to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', moduleKey: MODULES.DASHBOARD },

  // ── Company ───────────────────────────────────────────────
  {
    type: 'section', key: 'company', label: 'Company', icon: Building2,
    items: [
      { to: '/company-management/company-registration', icon: Building2, label: 'Company Details',  moduleKey: MODULES.COMPANY_REGISTRATION },
      { to: '/company-management/branch-management',    icon: GitBranch, label: 'Branches',     moduleKey: MODULES.BRANCH_MANAGEMENT },
      { to: '/company-management/user-management',      icon: Users,     label: 'Users & Access', moduleKey: MODULES.USER_MANAGEMENT },
    ],
  },

  // ── Staff Management (mobile OTP login for Staff App) ────
  {
    type: 'section', key: 'staff', label: 'Staff', icon: UserPlus,
    items: [
      { to: '/staff/staff-management', icon: UserPlus, label: 'Staff Members', moduleKey: MODULES.STAFF_MGMT },
    ],
  },

  // ── Products ──────────────────────────────────────────────
  {
    type: 'section', key: 'product-setup', label: 'Products', icon: Package,
    items: [
      // Categories & Brands are now managed inline from the Add Product form,
      // so their separate pages are hidden from the menu.
      { to: '/product-management/products',   icon: Package, label: 'Product List', moduleKey: MODULES.PRODUCTS },
      { to: '/product-management/external-products', icon: Store, label: 'Partner Products', moduleKey: MODULES.PRODUCTS },
    ],
  },

  // ── Purchase (SOW §13: Purchase Entry + Reports) ──────────
  {
    type: 'section', key: 'purchase', label: 'Purchases', icon: ShoppingBag,
    items: [
      { to: '/purchase-inventory/supplier-management',   icon: Building2,    label: 'Suppliers',       moduleKey: MODULES.SUPPLIERS },
      { to: '/purchase-inventory/purchase-management',   icon: PackagePlus,  label: 'Purchase Entry',  moduleKey: MODULES.PURCHASES },
      { to: '/purchase-inventory/purchase-reports',      icon: FileBarChart, label: 'Purchase Reports',moduleKey: MODULES.PURCHASE_REPORTS },
    ],
  },

  // ── Inventory (SOW §4 Stock In/Out/Transfer + Alerts, §23 Multi-Warehouse) ──
  {
    type: 'section', key: 'inventory', label: 'Inventory', icon: Boxes,
    items: [
      { to: '/purchase-inventory/inventory-management',  icon: BarChart3,      label: 'Stock (In / Out)',   moduleKey: MODULES.INVENTORY },
      { to: '/purchase-inventory/stock-transfer',        icon: ArrowLeftRight, label: 'Stock Transfer',     moduleKey: MODULES.STOCK_TRANSFER },
      { to: '/purchase-inventory/warehouse-management',  icon: Warehouse,      label: 'Warehouses',         moduleKey: MODULES.WAREHOUSES },
      { to: '/purchase-inventory/damage-breakage',       icon: AlertTriangle,  label: 'Damaged Stock',      moduleKey: MODULES.DAMAGE_BREAKAGE },
      { to: '/purchase-inventory/inventory-reports',     icon: PieChart,       label: 'Inventory Reports',  moduleKey: MODULES.INVENTORY_REPORTS },
    ],
  },

  // ── Marketplace ───────────────────────────────────────────
  {
    type: 'section', key: 'b2b', label: 'Sales & Orders', icon: ShoppingCart,
    items: [
      { to: '/marketplace/enquiry-management',  icon: MessageSquare, label: 'Enquiry Management', moduleKey: MODULES.ENQUIRIES,  badgeKey: 'enquiries' },
      { to: '/marketplace/order-management',    icon: ShoppingCart,  label: 'Order Management',     moduleKey: MODULES.ORDERS,    badgeKey: 'orders' },
      { to: '/marketplace/dispatch-management', icon: Truck,         label: 'Dispatch Management',  moduleKey: MODULES.DISPATCHES, badgeKey: 'dispatch' },
    ],
  },

  // ── Finance ───────────────────────────────────────────────
  {
    type: 'section', key: 'finance', label: 'Finance', icon: TrendingUp,
    items: [
      { to: '/finance/quotation-manager',   icon: FileEdit,  label: 'Quotes',        moduleKey: MODULES.QUOTATIONS },
      { to: '/finance/invoice-management',  icon: Receipt,   label: 'Invoices',       moduleKey: MODULES.INVOICES },
      { to: '/finance/sales-management',    icon: TrendingUp,label: 'Sales',         moduleKey: MODULES.SALES },
      { to: '/finance/expense-management',  icon: Receipt,   label: 'Expenses',       moduleKey: MODULES.EXPENSES },
      { to: '/finance/payment-management',  icon: CreditCard,label: 'Payments',       moduleKey: MODULES.PAYMENTS, badgeKey: 'payments' },
      { to: '/finance/accounts-management', icon: BookOpen,  label: 'Accounts',      moduleKey: MODULES.ACCOUNTS },
      { to: '/finance/profit-loss',         icon: LineChart, label: 'Profit & Loss',            moduleKey: MODULES.PROFIT_LOSS },
    ],
  },

  // ── CRM ───────────────────────────────────────────────────
  {
    type: 'section', key: 'crm', label: 'Customers', icon: UserCheck,
    items: [
      { to: '/crm/customer-management', icon: UserCheck,     label: 'Customer List',  moduleKey: MODULES.CUSTOMERS },
      { to: '/crm/lead-management',     icon: Target,        label: 'Potential Customers',      moduleKey: MODULES.LEADS },
      { to: '/crm/followup-management', icon: CalendarClock, label: 'Follow-ups', moduleKey: MODULES.FOLLOWUPS },
    ],
  },

  // ── HR ────────────────────────────────────────────────────
  {
    type: 'section', key: 'hr', label: 'Employees', icon: UserCog,
    items: [
      { to: '/hr/employee-master',     icon: Layers,  label: 'Employee List',    moduleKey: MODULES.EMPLOYEE_MASTER },
      { to: '/hr/employee-management', icon: UserCog, label: 'Attendance & Payroll', moduleKey: MODULES.EMPLOYEE_MANAGEMENT },
    ],
  },

  // ── Reports ───────────────────────────────────────────────
  {
    type: 'section', key: 'reports', label: 'Reports', icon: FileBarChart,
    items: [
      { to: '/reports/dashboard-analytics', icon: PieChart,     label: 'Analytics', moduleKey: MODULES.DASHBOARD_ANALYTICS },
      { to: '/reports/report-center',       icon: FileBarChart, label: 'All Reports',       moduleKey: MODULES.REPORT_CENTER },
    ],
  },

  // ── Tools ─────────────────────────────────────────────────
  {
    type: 'section', key: 'tools', label: 'Tools', icon: Calculator,
    items: [
      { to: '/tools/stone-calculation', icon: Calculator, label: 'Stone Calculator', moduleKey: MODULES.STONE_CALC },
    ],
  },

  // ── System ────────────────────────────────────────────────
  {
    type: 'section', key: 'system', label: 'Settings', icon: Settings,
    items: [
      { to: '/system/notification-management', icon: Bell,       label: 'Notifications',       moduleKey: MODULES.NOTIFICATIONS, badgeKey: 'notifs' },
      { to: '/system/document-management',     icon: FolderOpen, label: 'Documents', moduleKey: MODULES.DOCUMENTS },
      { to: '/system/subscription',            icon: CreditCard, label: 'Subscription',        moduleKey: MODULES.SUBSCRIPTION },
      { to: '/system/audit-log',               icon: ScrollText, label: 'Activity History',           moduleKey: MODULES.AUDIT },
      { to: '/system/profile',                 icon: UserCircle, label: 'My Account',          moduleKey: MODULES.PROFILE },
    ],
  },
]

/**
 * Filter NAV_CONFIG down to what the given role can access.
 * Sections whose children are all hidden are dropped entirely.
 */
function navForRole(role) {
  const out = []
  for (const node of NAV_CONFIG) {
    if (node.type === 'item') {
      if (canAccess(role, node.moduleKey)) out.push(node)
    } else if (node.type === 'section') {
      const items = node.items.filter(i => canAccess(role, i.moduleKey))
      if (items.length) out.push({ ...node, items })
    }
  }
  return out
}

/** Initials from a display name, e.g. "Ramesh Kumar" -> "RK" */
function initialsOf(name) {
  if (!name) return 'U'
  const parts = String(name).trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'U'
}

const LIGHT = {
  sidebarBg: '#FFFFFF', sidebarBorder: 'rgba(30,45,74,0.10)',
  sidebarText: '#1E2D4A', sidebarHover: '#FFF3EB',
  sidebarActiveBg: 'rgba(242,101,34,0.12)', sidebarActiveText: '#F26522',
  sidebarAccent: '#F26522', sidebarSectionText: '#1E2D4A',
  mainBg: '#F4F6F9', topbarBg: '#FFFFFF', topbarBorder: '#E2E8F0',
  topbarText: '#1E2D4A', topbarMuted: '#64748B',
  topbarCtrlBg: '#F4F6F9', topbarCtrlBorder: '#E2E8F0',
  // sidebar extras
  logoText: '#1E2D4A', logoBoxBg: 'rgba(30,45,74,0.05)',
  sidebarHoverBg: 'rgba(242,101,34,0.07)',
  folderHeaderText: '#1E2D4A', folderHeaderTextActive: '#F26522',
  folderHeaderHoverBg: 'rgba(242,101,34,0.07)',
  folderHeaderActiveBg: 'rgba(242,101,34,0.10)',
  folderBodyBg: 'transparent',
  childText: '#1E2D4A', childActiveText: '#F26522',
  childActiveBg: 'rgba(242,101,34,0.12)', childHoverBg: 'rgba(242,101,34,0.06)',
  footerBg: 'rgba(30,45,74,0.03)',
}
const DARK = {
  sidebarBg: '#0F1626', sidebarBorder: 'rgba(255,255,255,0.06)',
  sidebarText: '#C3D0E0', sidebarHover: '#E4ECF7',
  sidebarActiveBg: 'rgba(242,101,34,0.20)', sidebarActiveText: '#FF8A4C',
  sidebarAccent: '#F26522', sidebarSectionText: '#C3D0E0',
  mainBg: '#111827', topbarBg: '#1F2937', topbarBorder: '#374151',
  topbarText: '#F9FAFB', topbarMuted: '#9CA3AF',
  topbarCtrlBg: '#374151', topbarCtrlBorder: '#4B5563',
  // sidebar extras
  logoText: '#FFFFFF', logoBoxBg: 'rgba(255,255,255,0.08)',
  sidebarHoverBg: 'rgba(242,101,34,0.12)',
  folderHeaderText: '#C3D0E0', folderHeaderTextActive: '#FF8A4C',
  folderHeaderHoverBg: 'rgba(242,101,34,0.12)',
  folderHeaderActiveBg: 'rgba(242,101,34,0.18)',
  folderBodyBg: 'transparent',
  childText: '#C3D0E0', childActiveText: '#FF8A4C',
  childActiveBg: 'rgba(242,101,34,0.18)', childHoverBg: 'rgba(242,101,34,0.10)',
  footerBg: 'rgba(0,0,0,0.25)',
}

/* ═══════════════════════════════════════════════════════
   LAYOUT — default export
═══════════════════════════════════════════════════════ */
export default function Layout({
  onLogout,
  notifications = [],
  enquiries = [],
  orders = [],
  dispatches = [],
  payments = {},
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()

  // Rebuild the filtered menu only when the role or live permissions change.
  // Keeping navItems stable prevents the active-route effect from undoing
  // accordion clicks after every open/close render.
  const [permTick, forcePermTick] = useState(0)
  useEffect(() => onPermissionsChange(() => forcePermTick(t => t + 1)), [])

  const role = user?.role || ''
  const navItems = useMemo(() => navForRole(role), [role, permTick])

  const [dark] = useState(() => localStorage.getItem('erp-theme') === 'dark')
  const [mobileOpen, setMobileOpen] = useState(false)
  // Accordion: only one section open at a time. Holds the open section key (or null).
  const [openKey, setOpenKey] = useState(null)

  const T = dark ? DARK : LIGHT

  /* close mobile panel on navigation */
  useEffect(() => setMobileOpen(false), [location.pathname])

  /* persist & apply theme */
  useEffect(() => {
    localStorage.setItem('erp-theme', dark ? 'dark' : 'light')
  }, [dark])

  /* auto-open (accordion) the section that contains the active route */
  useEffect(() => {
    const active = navItems.find(n =>
      n.type === 'section' &&
      n.items.some(i => location.pathname === i.to || location.pathname.startsWith(i.to + '/'))
    )
    if (active) setOpenKey(active.key)
  }, [location.pathname, navItems])

  /* badge counts from live ERP state */
  const unreadNotifs   = notifications.filter(n => !n.read).length
  const newEnquiries   = enquiries.filter(e => e.status === 'New').length
  const pendingOrders  = orders.filter(o => ['New', 'Accepted', 'Packing'].includes(o.status)).length
  const pendingDisp    = orders.filter(o => o.status === 'Dispatched').length
  const pendingPay     = Array.isArray(payments?.receivables)
    ? payments.receivables.filter(r => r.status === 'Pending').length : 0

  const BADGES = {
    notifs: unreadNotifs || null,
    enquiries: newEnquiries || null,
    orders: pendingOrders || null,
    dispatch: pendingDisp || null,
    payments: pendingPay || null,
    purchaseOrders: null,
  }

  const hasActive = (items) =>
    items.some(i => location.pathname === i.to || location.pathname.startsWith(i.to + '/'))

  /* accordion toggle: open the clicked section, close the rest (click again to close) */
  const toggleSection = (key) => setOpenKey(prev => (prev === key ? null : key))

  /* shared sidebar JSX */
  const sidebar = (
    <SidebarContent
      T={T}
      location={location}
      navigate={navigate}
      openKey={openKey}
      toggleSection={toggleSection}
      hasActive={hasActive}
      BADGES={BADGES}
      onLogout={onLogout}
      onClose={() => setMobileOpen(false)}
      navItems={navItems}
      user={user}
    />
  )

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: T.mainBg }}>

      {/* ── Mobile backdrop ── */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 48,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* ── Desktop sidebar ── */}
      <aside
        className="erp-sidebar-desktop"
        style={{
          width: 264, background: T.sidebarBg, flexShrink: 0,
          display: 'flex', flexDirection: 'column', zIndex: 50,
          borderRight: `1px solid ${T.sidebarBorder}`,
          boxShadow: dark ? '4px 0 28px rgba(0,0,0,0.3)' : '2px 0 16px rgba(1,21,45,0.06)',
        }}
      >
        {sidebar}
      </aside>

      {/* ── Mobile sidebar (slide-in) ── */}
      <aside
        className="erp-sidebar-mobile"
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, width: 264,
          background: T.sidebarBg, zIndex: 49,
          display: 'flex', flexDirection: 'column',
          boxShadow: '6px 0 32px rgba(0,0,0,0.45)',
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {sidebar}
      </aside>

      {/* ── Main area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Topbar */}
        <header style={{
          height: 56, background: T.topbarBg,
          borderBottom: `1px solid ${T.topbarBorder}`,
          display: 'flex', alignItems: 'center',
          padding: '0 20px', gap: 12, flexShrink: 0,
          boxShadow: '0 1px 4px rgba(0,0,0,0.07)', zIndex: 10,
        }}>

          {/* Hamburger — visible on mobile */}
          <button
            onClick={() => setMobileOpen(true)}
            className="erp-hamburger"
            style={{
              display: 'none', padding: 7,
              background: 'transparent', border: 'none',
              color: T.topbarMuted, borderRadius: 8, cursor: 'pointer',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Menu size={20} />
          </button>

          {/* Breadcrumb */}
          <Breadcrumb pathname={location.pathname} T={T} />

          {/* Right controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>

            {/* Notification bell */}
            <TopBtn title="Notifications" onClick={() => navigate('/system/notification-management')} T={T}>
              <Bell size={17} />
              {unreadNotifs > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -4,
                  background: BRAND.orange, color: '#fff',
                  fontSize: 9, fontWeight: 800, padding: '1px 4px',
                  borderRadius: 8, minWidth: 16, textAlign: 'center',
                  border: `2px solid ${T.topbarBg}`,
                }}>
                  {unreadNotifs > 99 ? '99+' : unreadNotifs}
                </span>
              )}
            </TopBtn>

            {/* User pill */}
            <div
              onClick={() => navigate('/system/profile')}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 12px 5px 6px', cursor: 'pointer',
                background: T.topbarCtrlBg, border: `1px solid ${T.topbarCtrlBorder}`,
                borderRadius: 8, transition: 'all 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = T.topbarCtrlBorder}
              onMouseLeave={e => e.currentTarget.style.background = T.topbarCtrlBg}
            >
              <div style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                background: `linear-gradient(135deg, ${BRAND.orange}, #FF8A4C)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 800, color: '#fff',
              }}>{initialsOf(user?.name)}</div>
              <div style={{ lineHeight: 1.3 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.topbarText }}>{user?.name || 'User'}</div>
                <div style={{ fontSize: 10, color: T.topbarMuted }}>{user?.role || ''}</div>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 32px', minWidth: 0, boxSizing: 'border-box' }}>
          <Outlet />
        </main>
      </div>

      {/* Responsive CSS injected once */}
      <style>{`
        @media (max-width: 1024px) {
          .erp-sidebar-desktop { display: none !important; }
          .erp-hamburger { display: flex !important; }
        }
        @media (min-width: 1025px) {
          .erp-sidebar-mobile { display: none !important; }
          .erp-mobile-close   { display: none !important; }
        }
      `}</style>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   SIDEBAR CONTENT
═══════════════════════════════════════════════════════ */
function SidebarContent({ T, location, navigate, openKey, toggleSection, hasActive, BADGES, onLogout, onClose, navItems = [], user }) {
  return (
    <>
      {/* Logo strip */}
      <div style={{
        height: 70, display: 'flex', alignItems: 'center',
        padding: '0 14px 0 16px', gap: 12,
        borderBottom: `1px solid ${T.sidebarBorder}`, flexShrink: 0,
      }}>
        <div style={{
          width: 46, height: 46, borderRadius: 12, flexShrink: 0,
          background: T.logoBoxBg, overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <img src={logoImg} alt="EzyEnquiry" style={{ width: 40, height: 40, objectFit: 'contain' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1.2 }}>
            <span style={{ color: BRAND.orange }}>Ezy</span>
            <span style={{ color: T.logoText }}>Enquiry</span>
          </div>
          <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '1.5px', color: T.topbarMuted, textTransform: 'uppercase' }}>
            Find Stock Instantly
          </div>
        </div>
        {/* Mobile close button */}
        <button
          onClick={onClose}
          className="erp-mobile-close"
          style={{
            padding: 6, background: 'transparent', border: 'none',
            color: T.sidebarText, borderRadius: 6, cursor: 'pointer',
            display: 'flex', alignItems: 'center',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = T.sidebarHoverBg; e.currentTarget.style.color = T.sidebarAccent }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.sidebarText }}
        >
          <X size={15} />
        </button>
      </div>

      {/* Orange accent bar */}
      <div style={{
        height: 2, flexShrink: 0,
        background: `linear-gradient(90deg, ${BRAND.orange} 0%, ${BRAND.orange}55 55%, transparent 100%)`,
      }} />

      {/* Scrollable nav */}
      <nav style={{
        flex: 1, overflowY: 'auto', padding: '6px 0 8px',
        scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent',
      }}>
        {navItems.map(item => {
          if (item.type === 'item') {
            const isActive = location.pathname === item.to
            return (
              <NavLink
                key={item.to}
                to={item.to}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 16px', margin: '1px 0',
                  color: isActive ? T.sidebarActiveText : T.sidebarText,
                  fontSize: 14.5, fontWeight: isActive ? 800 : 700,
                  textDecoration: 'none', transition: 'all 0.14s',
                  background: isActive ? T.sidebarActiveBg : 'transparent',
                  borderLeft: `3px solid ${isActive ? T.sidebarAccent : 'transparent'}`,
                }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = T.sidebarHoverBg; e.currentTarget.style.color = T.sidebarAccent } }}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.sidebarText } }}
              >
                <item.icon size={16} style={{ opacity: isActive ? 1 : 0.7, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {isActive && <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.sidebarAccent, flexShrink: 0 }} />}
              </NavLink>
            )
          }

          /* ── Collapsible section (accordion) ── */
          const sectionActive = hasActive(item.items)
          const isOpen = openKey === item.key
          const headerText = (isOpen || sectionActive) ? T.folderHeaderTextActive : T.folderHeaderText

          return (
            <div key={item.key} style={{ margin: '1px 8px' }}>
              {/* Folder header */}
              <button
                onClick={() => toggleSection(item.key)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '9px 10px',
                  background: isOpen ? T.folderHeaderActiveBg : 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer', transition: 'all 0.16s',
                }}
                onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = T.folderHeaderHoverBg }}
                onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <item.icon size={16} style={{ color: headerText, flexShrink: 0, opacity: (isOpen || sectionActive) ? 1 : 0.7 }} />
                  <span style={{
                    fontSize: 13, fontWeight: (isOpen || sectionActive) ? 700 : 600,
                    color: headerText,
                    textAlign: 'left', lineHeight: 1.3,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {item.label}
                  </span>
                </span>
                <ChevronDown
                  size={15}
                  style={{
                    color: headerText,
                    flexShrink: 0, opacity: 0.7,
                    transition: 'transform 0.22s',
                    transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                  }}
                />
              </button>

              {/* Children list — folder contents */}
              {isOpen && (
                <div style={{
                  background: T.folderBodyBg,
                  overflow: 'hidden',
                  margin: '2px 0 4px',
                  paddingLeft: 12,
                  borderLeft: `1.5px solid ${T.sidebarActiveBg}`,
                  marginLeft: 8,
                }}>
                  {item.items.map((child) => {
                    const childActive = location.pathname === child.to || location.pathname.startsWith(child.to + '/')
                    const badge = child.badgeKey ? BADGES[child.badgeKey] : null
                    return (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '7px 10px', margin: '1px 0', borderRadius: 6,
                          color: childActive ? T.childActiveText : T.childText,
                          fontSize: 13, fontWeight: childActive ? 700 : 500,
                          textDecoration: 'none', transition: 'all 0.13s',
                          background: childActive ? T.childActiveBg : 'transparent',
                        }}
                        onMouseEnter={e => {
                          if (!childActive) {
                            e.currentTarget.style.background = T.childHoverBg
                            e.currentTarget.style.color = T.childActiveText
                          }
                        }}
                        onMouseLeave={e => {
                          if (!childActive) {
                            e.currentTarget.style.background = 'transparent'
                            e.currentTarget.style.color = T.childText
                          }
                        }}
                      >
                        <child.icon size={15} style={{ opacity: childActive ? 1 : 0.75, flexShrink: 0 }} />
                        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {child.label}
                        </span>
                        {badge ? (
                          <span style={{
                            background: BRAND.orange, color: '#fff',
                            fontSize: 9, fontWeight: 800, padding: '1px 5px',
                            borderRadius: 10, minWidth: 18, textAlign: 'center',
                            flexShrink: 0, lineHeight: '14px',
                          }}>
                            {badge > 99 ? '99+' : badge}
                          </span>
                        ) : null}
                      </NavLink>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* Divider */}
        <div style={{ height: 1, background: T.sidebarBorder, margin: '8px 16px 4px' }} />

        {/* Logout */}
        <button
          onClick={onLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '9px 16px', width: '100%',
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#F87171', fontSize: 13, fontWeight: 500,
            transition: 'all 0.14s', textAlign: 'left',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#FCA5A5' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#F87171' }}
        >
          <LogOut size={15} style={{ flexShrink: 0 }} />
          <span>Logout</span>
        </button>
      </nav>

      {/* User strip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '11px 14px', flexShrink: 0,
        borderTop: `1px solid ${T.sidebarBorder}`,
        background: T.footerBg,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
          background: `linear-gradient(135deg, ${BRAND.orange}, #FF8A4C)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 800, color: '#fff',
        }}>{initialsOf(user?.name)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.sidebarSectionText, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user?.name || 'User'}
          </div>
          <div style={{ fontSize: 10, color: T.sidebarText, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user?.email || user?.role || ''}
          </div>
        </div>
      </div>
    </>
  )
}

/* ═══════════════════════════════════════════════════════
   TOPBAR BUTTON helper
═══════════════════════════════════════════════════════ */
function TopBtn({ title, onClick, T, children }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        position: 'relative', width: 36, height: 36, borderRadius: 8,
        background: T.topbarCtrlBg, border: `1px solid ${T.topbarCtrlBorder}`,
        color: T.topbarMuted, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = T.topbarCtrlBorder; e.currentTarget.style.color = T.topbarText }}
      onMouseLeave={e => { e.currentTarget.style.background = T.topbarCtrlBg; e.currentTarget.style.color = T.topbarMuted }}
    >
      {children}
    </button>
  )
}

/* ═══════════════════════════════════════════════════════
   BREADCRUMB
═══════════════════════════════════════════════════════ */
function Breadcrumb({ pathname, T }) {
  const crumbs = [{ label: 'EzyEnquiry' }]
  for (const item of NAV_CONFIG) {
    if (item.type === 'item' && (pathname === item.to || pathname.startsWith(item.to + '/'))) {
      crumbs.push({ label: item.label })
      break
    }
    if (item.type === 'section') {
      const child = item.items.find(c => pathname === c.to || pathname.startsWith(c.to + '/'))
      if (child) {
        crumbs.push({ label: item.label })
        crumbs.push({ label: child.label })
        break
      }
    }
  }
  return (
    <nav style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, minWidth: 0 }}>
      {crumbs.map((c, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
          {i > 0 && (
            <span style={{ color: T.topbarMuted, fontSize: 10, opacity: 0.5, flexShrink: 0 }}>›</span>
          )}
          <span style={{
            color: i === crumbs.length - 1 ? T.topbarText : T.topbarMuted,
            fontWeight: i === crumbs.length - 1 ? 700 : 500,
            fontSize: i === crumbs.length - 1 ? 13.5 : 12,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {c.label}
          </span>
        </span>
      ))}
    </nav>
  )
}
