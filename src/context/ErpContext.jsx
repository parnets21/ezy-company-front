/**
 * ErpContext — Complete live data from real API
 * All modules get real backend data through this context.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'

// ── API imports ───────────────────────────────────────────────
import { enquiryApi }      from '../api/enquiryApi'
import { orderApi }        from '../api/orderApi'
import { dispatchApi }     from '../api/dispatchApi'
import { inventoryApi }    from '../api/inventoryApi'
import { purchaseApi, salesApi, paymentApi, expenseApi } from '../api/financeApi'
import { notificationApi, documentApi, reportApi } from '../api/systemApi'
import { productApi, categoryApi, brandApi, subCategoryApi } from '../api/productApi'
import { customerApi, leadApi, followupApi } from '../api/crmApi'
import { hrApi }           from '../api/hrApi'
import { userApi }         from '../api/userApi'
import { branchApi }       from '../api/branchApi'
import { companyApi }      from '../api/companyApi'

const ErpContext = createContext(null)

export function ErpProvider({ children }) {
  const { isLoggedIn, user: authUser } = useAuth()

  // ── Core state ────────────────────────────────────────────
  const [enquiries,      setEnquiries]      = useState([])
  const [orders,         setOrders]         = useState([])
  const [dispatches,     setDispatches]     = useState([])
  const [inventory,      setInventory]      = useState([])
  const [purchases,      setPurchases]      = useState([])
  const [sales,          setSales]          = useState([])
  const [expenses,       setExpenses]       = useState([])
  const [payments,       setPayments]       = useState({ receivables: [], payables: [], history: [] })
  const [notifications,  setNotifications]  = useState([])
  const [products,       setProducts]       = useState([])
  const [categories,     setCategories]     = useState([])
  const [subCategories,  setSubCategories]  = useState([])
  const [brands,         setBrands]         = useState([])
  const [customers,      setCustomers]      = useState([])
  const [leads,          setLeads]          = useState([])
  const [followups,      setFollowups]      = useState([])
  const [employees,      setEmployees]      = useState([])
  const [users,          setUsers]          = useState([])
  const [companies,      setCompanies]      = useState([])
  const [warehouses,     setWarehouses]     = useState([])
  const [transfers,      setTransfers]      = useState([])
  const [documents,      setDocuments]      = useState([])
  const [dashboardStats, setDashboardStats] = useState(null)
  const [loadingData,    setLoadingData]    = useState(false)
  const [branches,       setBranches]       = useState([])
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [suppliers,      setSuppliers]      = useState([])

  // ── Stone Calculation Selection (system-wide) ──────────────
  // Shape: { [sheetId]: { selectedRowIndices: [], rate, gstPct, calculatedPrices } }
  const [selectedStoneCalculations, setSelectedStoneCalculations] = useState({})

  const setStoneSelectionsForSheet = useCallback((sheetId, selection) => {
    setSelectedStoneCalculations(prev => ({
      ...prev,
      [sheetId]: { ...(prev[sheetId] || {}), ...selection, updatedAt: new Date().toISOString() },
    }))
  }, [])

  const clearStoneSelections = useCallback((sheetId) => {
    setSelectedStoneCalculations(prev => {
      const next = { ...prev }
      delete next[sheetId]
      return next
    })
  }, [])

  const getStoneSelections = useCallback((sheetId) => {
    return selectedStoneCalculations[sheetId] || null
  }, [selectedStoneCalculations])

  // ── Helper: extract array from API response ───────────────
  const arr = (res, key) => {
    const d = res?.data || res
    // Handle double-wrapped: { success, data: { [key]: [...] } }
    if (Array.isArray(d?.data?.[key])) return d.data[key]
    if (Array.isArray(d?.data))        return d.data
    if (Array.isArray(d?.[key]))       return d[key]
    if (Array.isArray(d))              return d
    return []
  }

  // ── Fetch all data ────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!isLoggedIn) return
    setLoadingData(true)
    try {
      const isSuperAdmin = authUser?.role === 'Super Admin'
      const canManageUsers = isSuperAdmin || authUser?.role === 'Admin' || authUser?.role === 'Manager'

      const results = await Promise.allSettled([
        enquiryApi.list({ limit: 100 }),               // 0
        orderApi.list({ limit: 100 }),                 // 1
        dispatchApi.list({ limit: 100 }),              // 2
        inventoryApi.list({ limit: 200 }),             // 3
        purchaseApi.list({ limit: 100 }),              // 4
        salesApi.list({ limit: 100 }),                 // 5
        paymentApi.listReceivables({ limit: 100 }),    // 6
        paymentApi.listPayables({ limit: 100 }),       // 7
        paymentApi.listTransactions({ limit: 100 }),   // 8
        notificationApi.list({ limit: 50 }),           // 9
        productApi.list({ limit: 1000 }),               // 10
        categoryApi.list(),                            // 11
        brandApi.list(),                               // 12
        subCategoryApi.list(),                         // 13
        customerApi.list({ limit: 100 }),              // 14
        leadApi.list({ limit: 100 }),                  // 15
        followupApi.list({ limit: 100 }),              // 16
        hrApi.listEmployees({ limit: 100 }),           // 17
        expenseApi.list({ limit: 100 }),               // 18
        inventoryApi.listWarehouses(),                 // 19
        inventoryApi.listTransfers({ limit: 100 }),    // 20
        documentApi.list({ limit: 50 }),               // 21
        canManageUsers ? userApi.list({ limit: 100 }) : Promise.resolve(null),  // 22
        isSuperAdmin ? companyApi.list({ limit: 50 }) : Promise.resolve(null), // 23
        purchaseApi.listSuppliers(),                                            // 24
        authUser?.company_id ? branchApi.list(authUser.company_id) : Promise.resolve(null), // 25
      ])

      const ok = (i) => results[i]?.status === 'fulfilled' ? (results[i].value) : null

      if (ok(0)) {
        // Normalize enquiries: flatten populated order_id → top-level order_code
        const rawEnqs = arr(ok(0), 'enquiries')
        setEnquiries(rawEnqs.map(e => {
          if (e.order_id && typeof e.order_id === 'object') {
            return {
              ...e,
              order_code: e.order_id.order_code || e.order_code || '',
              // keep order_id as the ObjectId string for lookups
              order_id: e.order_id._id || e.order_id,
            }
          }
          return e
        }))
      }
      if (ok(1))  {
        const rawOrders = arr(ok(1), 'orders')
        // Deduplicate by _id to prevent double entries
        const seen = new Set()
        const uniqueOrders = rawOrders.filter(o => {
          const id = String(o._id || o.id || '')
          if (seen.has(id)) return false
          seen.add(id)
          return true
        })
        setOrders(uniqueOrders)
      }
      if (ok(2))  setDispatches(arr(ok(2), 'dispatches'))
      if (ok(3))  setInventory(arr(ok(3), 'inventory'))
      if (ok(4))  setPurchases(arr(ok(4), 'purchases'))
      if (ok(5)) {
        const rawSales = arr(ok(5), 'sales')
        // Normalize: flatten populated order_id so components can read order_code directly.
        setSales(rawSales.map(s => {
          if (s.order_id && typeof s.order_id === 'object') {
            return {
              ...s,
              order_code: s.order_id.order_code || s.order_code || '',
              order_status: s.order_id.status || '',
              order_id: s.order_id._id || s.order_id,
            }
          }
          return s
        }))
      }
      if (ok(9))  setNotifications(arr(ok(9), 'notifications'))
      if (ok(10)) setProducts(arr(ok(10), 'products'))
      if (ok(11)) setCategories(Array.isArray(ok(11)?.data) ? ok(11).data : (ok(11) || []))
      if (ok(12)) setBrands(Array.isArray(ok(12)?.data) ? ok(12).data : (ok(12) || []))
      if (ok(13)) setSubCategories(Array.isArray(ok(13)?.data) ? ok(13).data : (ok(13) || []))
      if (ok(14)) setCustomers(arr(ok(14), 'customers'))
      if (ok(15)) setLeads(arr(ok(15), 'leads'))
      if (ok(16)) setFollowups(arr(ok(16), 'followups'))
      if (ok(17)) setEmployees(arr(ok(17), 'employees'))
      if (ok(18)) setExpenses(arr(ok(18), 'expenses'))
      if (ok(19)) setWarehouses(Array.isArray(ok(19)?.data) ? ok(19).data : (ok(19) || []))
      if (ok(20)) setTransfers(arr(ok(20), 'transfers'))
      if (ok(21)) setDocuments(arr(ok(21), 'documents'))
      if (ok(22)) setUsers(arr(ok(22), 'users'))
      if (ok(23)) setCompanies(arr(ok(23), 'companies'))
      if (ok(24)) {
        const sRes = ok(24)
        const sData = sRes?.data || sRes
        setSuppliers(Array.isArray(sData) ? sData : (Array.isArray(sData?.suppliers) ? sData.suppliers : []))
      }
      if (ok(25)) {
        const bData = ok(25)?.data || ok(25)
        setBranches(Array.isArray(bData) ? bData : (Array.isArray(bData?.branches) ? bData.branches : []))
      }

      const rcv = ok(6) ? arr(ok(6), 'receivables') : []
      const pay = ok(7) ? arr(ok(7), 'payables')    : []
      const txn = ok(8) ? arr(ok(8), 'transactions') : []
      setPayments({ receivables: rcv, payables: pay, history: txn })

      try {
        const statsRes = await reportApi.getDashboardStats()
        setDashboardStats(statsRes?.data || statsRes)
      } catch { /* non-fatal */ }

    } catch (err) {
      console.error('[ERP] fetchAll error:', err)
    } finally {
      setLoadingData(false)
    }
  }, [isLoggedIn, authUser?.role, authUser?.company_id])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Notification helper ───────────────────────────────────
  const addNotification = useCallback((msg, type = 'info') => {
    setNotifications(prev => [{
      _id: Date.now(), type, message: msg, title: msg,
      is_read: false, created_at: new Date().toISOString(),
    }, ...prev])
  }, [])

  // ─────────────────────────────────────────────────────────
  // ENQUIRY ACTIONS
  // ─────────────────────────────────────────────────────────
  const addEnquiry = useCallback(async (data) => {
    try {
      const res = await enquiryApi.create(data)
      const newEnq = res?.data || res
      // A BROADCAST returns a summary ({ broadcast, recipients, ids }), not an
      // enquiry document — prepending it would put a phantom row in the table
      // with no _id. Refresh the list instead so the real per-recipient rows
      // (and any replies) load.
      if (newEnq?.broadcast) {
        addNotification(`Enquiry broadcast to ${newEnq.recipients} compan${newEnq.recipients === 1 ? 'y' : 'ies'}`, 'enquiry')
        fetchAll?.()
        return { success: true, data: newEnq }
      }
      setEnquiries(prev => [newEnq, ...prev])
      addNotification(`New Enquiry ${newEnq.enq_code || ''} from ${data.retailer_name || data.retailer || ''}`, 'enquiry')
      return { success: true, data: newEnq }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Failed to create enquiry' }
    }
  }, [addNotification, fetchAll])

  const updateEnquiry = useCallback(async (id, changes) => {
    try {
      const res = await enquiryApi.update(id, changes)
      const updated = res?.data || res
      setEnquiries(prev => prev.map(e => (e._id === id || e.id === id) ? { ...e, ...updated } : e))
      return { success: true, data: updated }
    } catch (err) {
      setEnquiries(prev => prev.map(e => (e._id === id || e.id === id) ? { ...e, ...changes } : e))
      return { success: false, message: err.response?.data?.message || 'Update failed' }
    }
  }, [])

  const deleteEnquiry = useCallback(async (id) => {
    try {
      const res = await enquiryApi.delete(id)
      const data = res?.data || res
      // Remove enquiry from state
      setEnquiries(prev => prev.filter(e => e._id !== id && e.id !== id))
      // Cascade: also remove the linked order from state
      const deletedOrderId = data?.deleted_order_id
      if (deletedOrderId) {
        setOrders(prev => prev.filter(o =>
          (o._id || o.id) !== deletedOrderId &&
          String(o._id || o.id) !== String(deletedOrderId)
        ))
      }
      // Deleting a BROADCAST removes every sibling row (`deleted_count > 1`), but
      // only one was filtered out above — so the rest would ghost on screen until
      // the next navigation. Refetch instead of trying to patch the list by hand.
      if ((data?.deleted_count || 0) > 1) fetchAll?.()
      return { success: true, deletedOrderId }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Delete failed' }
    }
  }, [fetchAll])

  const convertEnquiryToOrder = useCallback(async (enquiry, agreedRate, extraData = {}) => {
    try {
      const enquiryId = enquiry._id || enquiry.id
      const rate      = parseFloat(agreedRate || enquiry.offered_price || 0)

      const res = await orderApi.fromEnquiry({
        enquiry_id:       enquiryId,
        rate,
        gst_percent:      parseFloat(enquiry.gst_percent || 18),
        branch_id:        extraData.branch_id   || null,
        branch_name:      extraData.branch_name || '',
        delivery_address: extraData.delivery_address || enquiry.location || '',
        notes:            extraData.notes || enquiry.remarks || '',
      })

      const newOrder = res?.data || res
      const alreadyExists = res?.message?.toLowerCase().includes('already')

      // Update orders list — remove any dupe then prepend
      setOrders(prev => {
        const without = prev.filter(o => String(o.enquiry_id) !== String(enquiryId))
        return [newOrder, ...without]
      })

      // Update enquiry to link order_id and order_code
      setEnquiries(prev => prev.map(e => {
        const eId = e._id || e.id
        if (eId !== enquiryId) return e
        return {
          ...e,
          order_id:   newOrder._id || newOrder.id || '',
          order_code: newOrder.order_code || '',
        }
      }))

      addNotification(`Order ${newOrder.order_code} created`, 'order')
      return { success: true, data: newOrder, alreadyExists }
    } catch (err) {
      const errData = err.response?.data
      // 200 already-exists also comes as success from backend
      if (errData?.data?.order_code) {
        const existing = errData.data
        setOrders(prev => {
          const enquiryId2 = enquiry._id || enquiry.id
          const without = prev.filter(o => String(o.enquiry_id) !== String(enquiryId2))
          return [existing, ...without]
        })
        setEnquiries(prev => prev.map(e =>
          (e._id || e.id) === (enquiry._id || enquiry.id)
            ? { ...e, order_id: existing._id, order_code: existing.order_code }
            : e
        ))
        return { success: true, data: existing, alreadyExists: true }
      }
      return { success: false, message: errData?.message || 'Failed to create order' }
    }
  }, [addNotification])

  // ─────────────────────────────────────────────────────────
  // ORDER ACTIONS
  // ─────────────────────────────────────────────────────────
  const addOrder = useCallback(async (data) => {
    try {
      const res = await orderApi.create(data)
      const newOrder = res?.data || res
      const newId = String(newOrder._id || newOrder.id || '')
      // Deduplicate: remove any existing entry with same id before prepending
      setOrders(prev => {
        const without = prev.filter(o => String(o._id || o.id || '') !== newId)
        return [newOrder, ...without]
      })
      addNotification(`Order ${newOrder.order_code || ''} created for ${data.customer_name}`, 'order')
      return { success: true, data: newOrder }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Failed to create order' }
    }
  }, [addNotification])

  const deleteOrder = useCallback(async (id) => {
    try {
      await orderApi.delete(id)
      setOrders(prev => prev.filter(o => (o._id || o.id) !== id))
      return { success: true }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Delete failed' }
    }
  }, [])

  // Assign order to a staff user — updates orders list in-place so the
  // dropdown reflects the new assignment without a full page refresh.
  const assignOrder = useCallback(async (orderId, staffId, staffName) => {
    try {
      const res     = await orderApi.assign(orderId, { staff_id: staffId })
      const updated = res?.data || res
      setOrders(prev => prev.map(o =>
        (String(o._id || o.id) === String(orderId))
          ? { ...o, assigned_to: staffId, assigned_to_name: updated?.assigned_to_name || staffName }
          : o
      ))
      return { success: true, data: updated }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Assignment failed' }
    }
  }, [])

  const updateOrderStatus = useCallback(async (orderId, statusData) => {
    try {
      const res     = await orderApi.updateStatus(orderId, statusData)
      const updated = res?.data || res
      setOrders(prev => prev.map(o =>
        (o._id === orderId || o.id === orderId) ? { ...o, ...updated } : o
      ))
      return { success: true, data: updated }
    } catch (err) {
      const errData = err.response?.data
      return { success: false, message: errData?.message || 'Status update failed' }
    }
  }, [])

  // Legacy helpers — map old names to new SOW statuses
  const startPacking         = useCallback((id) => updateOrderStatus(id, { status: 'Picking Started',   remarks: 'Picking started' }), [updateOrderStatus])
  const markReadyForDispatch = useCallback((id) => updateOrderStatus(id, { status: 'Ready for Dispatch', remarks: 'Ready for dispatch' }), [updateOrderStatus])

  // ─────────────────────────────────────────────────────────
  // DISPATCH ACTIONS
  // ─────────────────────────────────────────────────────────
  const createDispatch = useCallback(async (data) => {
    try {
      const res        = await dispatchApi.create(data)
      const newDispatch = res?.data || res
      setDispatches(prev => [newDispatch, ...prev])
      setOrders(prev => prev.map(o => {
        const oid = o._id || o.id
        if (oid === (data.order_id || data.orderId))
          return { ...o, status: 'Dispatched', dispatch_id: newDispatch._id || newDispatch.id }
        return o
      }))
      addNotification(`Order dispatched via ${data.transport_name}`, 'dispatch')
      return { success: true, data: newDispatch }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Dispatch failed' }
    }
  }, [addNotification])

  const markInTransit = useCallback(async (dispatchId) => {
    try {
      const res     = await dispatchApi.markInTransit(dispatchId)
      const updated = res?.data || res
      setDispatches(prev => prev.map(d =>
        (d._id === dispatchId || d.id === dispatchId) ? { ...d, ...updated, status: 'In Transit' } : d
      ))
      setOrders(prev => prev.map(o => {
        const dId = o.dispatch_id?._id || o.dispatch_id
        if (String(dId) === String(dispatchId)) return { ...o, status: 'In Transit' }
        return o
      }))
      return { success: true, data: updated }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Mark in-transit failed' }
    }
  }, [])

  const markDelivered = useCallback(async (dispatchId, delivered_date) => {
    try {
      const res     = await dispatchApi.markDelivered(dispatchId, delivered_date)
      const updated = res?.data || res
      setDispatches(prev => prev.map(d =>
        (d._id === dispatchId || d.id === dispatchId) ? { ...d, ...updated, status: 'Delivered' } : d
      ))
      await fetchAll()
      addNotification('Delivery confirmed. Sale & receivable auto-created.', 'delivery')
      return { success: true, data: updated }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Mark delivered failed' }
    }
  }, [fetchAll, addNotification])

  // Partial packing: packs a qty of an order → creates invoice + dispatch.
  const packOrder = useCallback(async (orderId, data) => {
    try {
      const res = await orderApi.pack(orderId, data)
      const payload = res?.data || res
      const updatedOrder = payload?.order || payload
      if (updatedOrder) {
        setOrders(prev => prev.map(o =>
          (o._id === orderId || o.id === orderId) ? { ...o, ...updatedOrder } : o
        ))
      }
      await fetchAll()
      addNotification(res?.message || 'Pack dispatched.', 'dispatch')
      return { success: true, data: payload }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Packing failed' }
    }
  }, [fetchAll, addNotification])

  // ─────────────────────────────────────────────────────────
  // PURCHASE ACTIONS
  // ─────────────────────────────────────────────────────────
  const addPurchase = useCallback(async (data) => {
    try {
      const res = await purchaseApi.create(data)
      const payload = res?.data || res
      // Backend may return { bill_code, purchases: [...] } for multi-item or a single record.
      const newPurchases = Array.isArray(payload?.purchases)
        ? payload.purchases
        : [payload?.first || payload]
      setPurchases(prev => [...newPurchases.filter(Boolean), ...prev])
      const billCode = payload?.bill_code || newPurchases[0]?.purchase_code || ''
      addNotification(`Purchase bill ${billCode} created (${newPurchases.length} item(s)) — Status: Pending`, 'purchase')
      return { success: true, data: payload }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Purchase failed' }
    }
  }, [addNotification])

  const updatePurchase = useCallback(async (id, data) => {
    try {
      const res = await purchaseApi.update(id, data)
      const updated = res?.data || res
      setPurchases(prev => prev.map(p => (p._id || p.id) === id ? { ...p, ...updated } : p))
      return { success: true, data: updated }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Update failed' }
    }
  }, [])

  const updatePurchaseStatus = useCallback(async (id, status) => {
    try {
      const res = await purchaseApi.updateStatus(id, status)
      const updated = res?.data || res
      // Update the purchase row with the fresh data returned from the server
      setPurchases(prev => prev.map(p => (p._id || p.id) === id ? { ...p, ...updated } : p))
      // If receiving, refresh inventory so stock counts are up-to-date
      if (status === 'Received') {
        try {
          const invRes = await inventoryApi.list({ limit: 200 })
          setInventory(arr(invRes, 'inventory'))
        } catch { /* non-fatal */ }
      }
      return { success: true, data: updated }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Status update failed' }
    }
  }, [])

  const deletePurchase = useCallback(async (id) => {
    try {
      await purchaseApi.delete(id)
      setPurchases(prev => prev.filter(p => (p._id || p.id) !== id))
      // Refresh inventory — backend reverses stock-in if purchase was 'Received'
      try {
        const invRes = await inventoryApi.list({ limit: 500 })
        const d = invRes?.data || invRes
        const rows = Array.isArray(d) ? d : (Array.isArray(d?.inventory) ? d.inventory : [])
        setInventory(rows)
      } catch { /* non-fatal */ }
      return { success: true }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Delete failed' }
    }
  }, [])

  const updatePurchasePayment = useCallback(async (id, data) => {
    try {
      const res = await purchaseApi.updatePayment(id, data)
      const updated = res?.data || res
      setPurchases(prev => prev.map(p => (p._id || p.id) === id ? { ...p, ...updated } : p))
      return { success: true, data: updated }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Payment update failed' }
    }
  }, [])


  // ─────────────────────────────────────────────────────────
  // PAYMENT ACTIONS
  // ─────────────────────────────────────────────────────────
  const recordPayment = useCallback(async (receivableId, amount, mode, reference, notes) => {
    try {
      const res = await paymentApi.collectReceivable(receivableId, { amount, mode, reference, notes })
      const updated = res?.data || res
      setPayments(prev => ({
        ...prev,
        receivables: prev.receivables.map(r =>
          (r._id === receivableId || r.id === receivableId) ? { ...r, ...updated } : r
        ),
      }))
      addNotification(`Payment ₹${parseFloat(amount).toLocaleString()} received`, 'payment')
      return { success: true, data: updated }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Payment failed' }
    }
  }, [addNotification])

  // ─────────────────────────────────────────────────────────
  // CUSTOMER ACTIONS
  // ─────────────────────────────────────────────────────────
  const addCustomer = useCallback(async (data) => {
    try {
      const res = await customerApi.create(data)
      const newCust = res?.data || res
      setCustomers(prev => [newCust, ...prev])
      return { success: true, data: newCust }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Failed to create customer' }
    }
  }, [])

  const updateCustomer = useCallback(async (id, data) => {
    try {
      const res = await customerApi.update(id, data)
      const updated = res?.data || res
      setCustomers(prev => prev.map(c => (c._id === id || c.id === id) ? { ...c, ...updated } : c))
      return { success: true, data: updated }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Update failed' }
    }
  }, [])

  const deleteCustomer = useCallback(async (id) => {
    try {
      await customerApi.delete(id)
      setCustomers(prev => prev.filter(c => c._id !== id && c.id !== id))
      return { success: true }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Delete failed' }
    }
  }, [])

  // ─────────────────────────────────────────────────────────
  // LEAD ACTIONS
  // ─────────────────────────────────────────────────────────
  const addLead = useCallback(async (data) => {
    try {
      const res = await leadApi.create(data)
      const newLead = res?.data || res
      setLeads(prev => [newLead, ...prev])
      return { success: true, data: newLead }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Failed to create lead' }
    }
  }, [])

  const updateLead = useCallback(async (id, data) => {
    try {
      const res = await leadApi.update(id, data)
      const updated = res?.data || res
      setLeads(prev => prev.map(l => (l._id === id || l.id === id) ? { ...l, ...updated } : l))
      return { success: true, data: updated }
    } catch (err) {
      setLeads(prev => prev.map(l => (l._id === id || l.id === id) ? { ...l, ...data } : l))
      return { success: false, message: err.response?.data?.message || 'Update failed' }
    }
  }, [])

  const deleteLead = useCallback(async (id) => {
    try {
      await leadApi.delete(id)
      setLeads(prev => prev.filter(l => l._id !== id && l.id !== id))
      return { success: true }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Delete failed' }
    }
  }, [])

  const convertLead = useCallback(async (id) => {
    try {
      const res = await leadApi.convert(id)
      const result = res?.data || res
      const lead = result?.lead || result
      setLeads(prev => prev.map(l => (l._id === id || l.id === id) ? { ...l, status: 'Converted' } : l))
      if (result?.customer) setCustomers(prev => [result.customer, ...prev])
      return { success: true, data: result }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Convert failed' }
    }
  }, [])

  // ─────────────────────────────────────────────────────────
  // FOLLOW-UP ACTIONS
  // ─────────────────────────────────────────────────────────
  const addFollowup = useCallback(async (data) => {
    try {
      const res = await followupApi.create(data)
      const newF = res?.data || res
      setFollowups(prev => [newF, ...prev])
      return { success: true, data: newF }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Failed to create follow-up' }
    }
  }, [])

  const updateFollowup = useCallback(async (id, data) => {
    try {
      const res = await followupApi.update(id, data)
      const updated = res?.data || res
      setFollowups(prev => prev.map(f => (f._id === id || f.id === id) ? { ...f, ...updated } : f))
      return { success: true, data: updated }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Update failed' }
    }
  }, [])

  const deleteFollowup = useCallback(async (id) => {
    try {
      await followupApi.delete(id)
      setFollowups(prev => prev.filter(f => f._id !== id && f.id !== id))
      return { success: true }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Delete failed' }
    }
  }, [])

  // ─────────────────────────────────────────────────────────
  // EMPLOYEE ACTIONS
  // ─────────────────────────────────────────────────────────
  const addEmployee = useCallback(async (data) => {
    try {
      const res = await hrApi.createEmployee(data)
      const newEmp = res?.data || res
      setEmployees(prev => [newEmp, ...prev])
      return { success: true, data: newEmp }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Failed to create employee' }
    }
  }, [])

  const updateEmployee = useCallback(async (id, data) => {
    try {
      const res = await hrApi.updateEmployee(id, data)
      const updated = res?.data || res
      setEmployees(prev => prev.map(e => (e._id === id || e.id === id) ? { ...e, ...updated } : e))
      return { success: true, data: updated }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Update failed' }
    }
  }, [])

  const deleteEmployee = useCallback(async (id) => {
    try {
      await hrApi.deleteEmployee(id)
      setEmployees(prev => prev.filter(e => String(e._id || e.id) !== String(id)))
      return { success: true }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Delete failed' }
    }
  }, [])

  // ─────────────────────────────────────────────────────────
  // CATEGORY & BRAND ACTIONS
  // ─────────────────────────────────────────────────────────
  const addCategory = useCallback(async (data) => {
    try {
      const res = await categoryApi.create(data)
      const newCat = res?.data || res
      setCategories(prev => [...prev, newCat])
      return { success: true, data: newCat }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Failed' }
    }
  }, [])

  const updateCategory = useCallback(async (id, data) => {
    try {
      const res = await categoryApi.update(id, data)
      const updated = res?.data || res
      setCategories(prev => prev.map(c => (c._id === id || c.id === id) ? { ...c, ...updated } : c))
      return { success: true, data: updated }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Failed' }
    }
  }, [])

  const deleteCategory = useCallback(async (id) => {
    try {
      await categoryApi.delete(id)
      setCategories(prev => prev.filter(c => c._id !== id && c.id !== id))
      return { success: true }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Failed' }
    }
  }, [])

  const addBrand = useCallback(async (data) => {    try {
      const res = await brandApi.create(data)
      const newBrand = res?.data || res
      setBrands(prev => [...prev, newBrand])
      return { success: true, data: newBrand }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Failed' }
    }
  }, [])

  const updateBrand = useCallback(async (id, data) => {
    try {
      const res = await brandApi.update(id, data)
      const updated = res?.data || res
      setBrands(prev => prev.map(b => (b._id === id || b.id === id) ? { ...b, ...updated } : b))
      return { success: true, data: updated }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Failed' }
    }
  }, [])

  const deleteBrand = useCallback(async (id) => {
    try {
      await brandApi.delete(id)
      setBrands(prev => prev.filter(b => b._id !== id && b.id !== id))
      return { success: true }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Failed' }
    }
  }, [])

  // ─────────────────────────────────────────────────────────
  // SUB-CATEGORY ACTIONS
  // ─────────────────────────────────────────────────────────
  const addSubCategory = useCallback(async (data) => {
    try {
      const res = await subCategoryApi.create(data)
      const newSub = res?.data || res
      setSubCategories(prev => [...prev, newSub])
      return { success: true, data: newSub }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Failed' }
    }
  }, [])

  const updateSubCategory = useCallback(async (id, data) => {
    try {
      const res = await subCategoryApi.update(id, data)
      const updated = res?.data || res
      setSubCategories(prev => prev.map(s => (s._id === id || s.id === id) ? { ...s, ...updated } : s))
      return { success: true, data: updated }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Failed' }
    }
  }, [])

  const deleteSubCategory = useCallback(async (id) => {
    try {
      await subCategoryApi.delete(id)
      setSubCategories(prev => prev.filter(s => s._id !== id && s.id !== id))
      return { success: true }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Failed' }
    }
  }, [])

  // ─────────────────────────────────────────────────────────
  // PRODUCT ACTIONS
  // ─────────────────────────────────────────────────────────
  const addProduct = useCallback(async (data) => {
    try {
      const res = await productApi.create(data)
      const createdData = res?.data || res
      const openingInventory = createdData?.opening_inventory || null
      const newProd = createdData && typeof createdData === 'object'
        ? Object.fromEntries(Object.entries(createdData).filter(([key]) => key !== 'opening_inventory'))
        : createdData

      if (openingInventory) {
        try {
          const inventoryRes = await inventoryApi.list({ limit: 200 })
          setInventory(arr(inventoryRes, 'inventory'))
        } catch {
          setInventory(prev => [openingInventory, ...prev])
        }
      }

      // Re-fetch the product so it has populated category_name / brand_name
      try {
        const id = newProd._id || newProd.id
        if (id) {
          const fetched = await productApi.get(id)
          const populated = fetched?.data || fetched
          setProducts(prev => [populated, ...prev])
          return { success: true, data: populated }
        }
      } catch { /* fall through to unpopulated */ }
      setProducts(prev => [newProd, ...prev])
      return { success: true, data: newProd }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Failed to create product' }
    }
  }, [])

  const updateProduct = useCallback(async (id, data) => {
    try {
      const res = await productApi.update(id, data)
      const updated = res?.data || res
      // Re-fetch so category_name / brand_name are populated
      try {
        const fetched = await productApi.get(id)
        const populated = fetched?.data || fetched
        setProducts(prev => prev.map(p =>
          (p._id === id || p.id === id) ? populated : p
        ))
        return { success: true, data: populated }
      } catch { /* fall through */ }
      setProducts(prev => prev.map(p =>
        (p._id === id || p.id === id) ? { ...p, ...updated } : p
      ))
      return { success: true, data: updated }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Update failed' }
    }
  }, [])

  const deleteProduct = useCallback(async (id) => {
    try {
      await productApi.delete(id)
      setProducts(prev => prev.filter(p => p._id !== id && p.id !== id))
      return { success: true }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Delete failed' }
    }
  }, [])

  const checkProductTransactions = useCallback(async (id) => {
    try {
      const res = await productApi.checkTransactions(id)
      const data = res?.data || res
      return { success: true, hasTransactions: data?.hasTransactions ?? false }
    } catch (err) {
      // On error, assume transactions exist (safe default — show second popup)
      return { success: true, hasTransactions: true }
    }
  }, [])

  // ─────────────────────────────────────────────────────────
  // SALES ACTIONS — manual entry (auto-entry via dispatch→deliver)
  // ─────────────────────────────────────────────────────────
  const addSale = useCallback(async (data) => {
    try {
      const res = await salesApi.create(data)
      const newSale = res?.data || res
      setSales(prev => [newSale, ...prev])
      addNotification(`Sale recorded: ₹${(data.total_amount || 0).toLocaleString()}`, 'sale')
      return { success: true, data: newSale }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Failed to create sale' }
    }
  }, [addNotification])

  // ─────────────────────────────────────────────────────────
  // EXPENSE ACTIONS
  // ─────────────────────────────────────────────────────────
  const addExpense = useCallback(async (data) => {
    try {
      const res = await expenseApi.create(data)
      const newExp = res?.data || res
      setExpenses(prev => [newExp, ...prev])
      return { success: true, data: newExp }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Failed to create expense' }
    }
  }, [])

  const updateExpense = useCallback(async (id, data) => {
    try {
      const res = await expenseApi.update(id, data)
      const updated = res?.data || res
      setExpenses(prev => prev.map(e => (e._id === id || e.id === id) ? { ...e, ...updated } : e))
      return { success: true, data: updated }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Update failed' }
    }
  }, [])

  const deleteExpense = useCallback(async (id) => {
    try {
      await expenseApi.delete(id)
      setExpenses(prev => prev.filter(e => e._id !== id && e.id !== id))
      return { success: true }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Delete failed' }
    }
  }, [])

  // ─────────────────────────────────────────────────────────
  // NOTIFICATION ACTIONS
  // ─────────────────────────────────────────────────────────
  const markNotifRead = useCallback(async (id) => {
    try {
      await notificationApi.markRead(id)
      setNotifications(prev => prev.map(n =>
        (n._id === id || n.id === id) ? { ...n, is_read: true } : n
      ))
      return { success: true }
    } catch (err) {
      setNotifications(prev => prev.map(n =>
        (n._id === id || n.id === id) ? { ...n, is_read: true } : n
      ))
      return { success: false }
    }
  }, [])

  const markAllNotifsRead = useCallback(async () => {
    try {
      await notificationApi.markAllRead()
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      return { success: true }
    } catch (err) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      return { success: false }
    }
  }, [])

  const deleteNotif = useCallback(async (id) => {
    const removeLocal = () =>
      setNotifications(prev => prev.filter(n => n._id !== id && n.id !== id))
    try {
      await notificationApi.delete(id)
      removeLocal()
      return { success: true }
    } catch (err) {
      // A 404 means the record is already gone (or not server-backed, e.g. a
      // locally-generated toast notification). Either way, drop it from the UI.
      if (err?.response?.status === 404) {
        removeLocal()
        return { success: true }
      }
      return { success: false }
    }
  }, [])

  const clearAllNotifs = useCallback(async () => {
    try {
      await notificationApi.deleteAll()
      setNotifications([])
      return { success: true }
    } catch (err) {
      // Clear locally regardless so the UI empties even if the record set
      // was already gone server-side.
      setNotifications([])
      return { success: false }
    }
  }, [])

  // ─────────────────────────────────────────────────────────
  // WAREHOUSE & TRANSFER ACTIONS
  // ─────────────────────────────────────────────────────────
  const addWarehouse = useCallback(async (data) => {
    try {
      const res = await inventoryApi.createWarehouse(data)
      const newWH = res?.data || res
      setWarehouses(prev => [...prev, newWH])
      return { success: true, data: newWH }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Failed' }
    }
  }, [])

  const updateWarehouse = useCallback(async (id, data) => {
    try {
      const res = await inventoryApi.updateWarehouse(id, data)
      const updated = res?.data || res
      setWarehouses(prev => prev.map(w => (w._id === id || w.id === id) ? { ...w, ...updated } : w))
      return { success: true, data: updated }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Failed' }
    }
  }, [])

  const deleteWarehouse = useCallback(async (id) => {
    try {
      await inventoryApi.deleteWarehouse(id)
      setWarehouses(prev => prev.filter(w => w._id !== id && w.id !== id))
      return { success: true }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Failed' }
    }
  }, [])

  const createTransfer = useCallback(async (data) => {
    try {
      const res = await inventoryApi.createTransfer(data)
      const newT = res?.data || res
      // The create response is a raw doc (unpopulated warehouse/product names).
      // Refresh the transfer list from the server so the new row shows
      // From / To / Product properly. Fall back to prepending the raw doc.
      try {
        const listRes = await inventoryApi.listTransfers({ limit: 100 })
        setTransfers(arr(listRes, 'transfers'))
      } catch {
        setTransfers(prev => [newT, ...prev])
      }
      // Refresh inventory since stock moved
      try {
        const invRes = await inventoryApi.list({ limit: 200 })
        setInventory(arr(invRes, 'inventory'))
      } catch { /* non-fatal — transfer already succeeded */ }
      return { success: true, data: newT }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Transfer failed' }
    }
  }, [])

  const updateTransferStatus = useCallback(async (id, status) => {
    try {
      const res = await inventoryApi.updateTransferStatus(id, status)
      const updated = res?.data || res
      // Merge the returned doc, preserving the populated display fields the
      // list endpoint added (the status update response is unpopulated).
      setTransfers(prev => prev.map(t => (t._id === id || t.id === id) ? { ...t, ...updated } : t))
      if (status === 'Completed' || status === 'Cancelled') {
        try {
          const invRes = await inventoryApi.list({ limit: 200 })
          setInventory(arr(invRes, 'inventory'))
        } catch { /* non-fatal — status already updated */ }
      }
      return { success: true, data: updated }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Failed' }
    }
  }, [])

  const deleteTransfer = useCallback(async (id) => {
    try {
      await inventoryApi.deleteTransfer(id)
      setTransfers(prev => prev.filter(t => t._id !== id && t.id !== id))
      try {
        const invRes = await inventoryApi.list({ limit: 200 })
        setInventory(arr(invRes, 'inventory'))
      } catch { /* non-fatal — transfer already deleted */ }
      return { success: true }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Failed' }
    }
  }, [])

  // ─────────────────────────────────────────────────────────
  // SUPPLIER ACTIONS
  // ─────────────────────────────────────────────────────────
  const addSupplier = useCallback(async (data) => {
    try {
      const res = await purchaseApi.createSupplier(data)
      const newSup = res?.data || res
      setSuppliers(prev => [newSup, ...prev])
      return { success: true, data: newSup }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Failed to create supplier' }
    }
  }, [])

  const updateSupplier = useCallback(async (id, data) => {
    try {
      const res = await purchaseApi.updateSupplier(id, data)
      const updated = res?.data || res
      setSuppliers(prev => prev.map(s => (s._id === id || s.id === id) ? { ...s, ...updated } : s))
      return { success: true, data: updated }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Update failed' }
    }
  }, [])

  const deleteSupplier = useCallback(async (id) => {
    try {
      await purchaseApi.deleteSupplier(id)
      setSuppliers(prev => prev.filter(s => s._id !== id && s.id !== id))
      return { success: true }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Delete failed' }
    }
  }, [])

  // ─────────────────────────────────────────────────────────
  // BRANCH ACTIONS
  // ─────────────────────────────────────────────────────────
  const addBranch = useCallback(async (data) => {
    const companyId = authUser?.company_id
    if (!companyId) return { success: false, message: 'No company associated' }
    try {
      const res = await branchApi.create(companyId, data)
      const newBranch = res?.data || res
      setBranches(prev => [newBranch, ...prev])
      return { success: true, data: newBranch }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Failed to create branch' }
    }
  }, [authUser?.company_id])

  const updateBranch = useCallback(async (id, data) => {
    const companyId = authUser?.company_id
    if (!companyId) return { success: false, message: 'No company associated' }
    try {
      const res = await branchApi.update(companyId, id, data)
      const updated = res?.data || res
      setBranches(prev => prev.map(b => (b._id === id || b.id === id) ? { ...b, ...updated } : b))
      return { success: true, data: updated }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Failed to update branch' }
    }
  }, [authUser?.company_id])

  const deleteBranch = useCallback(async (id) => {
    const companyId = authUser?.company_id
    if (!companyId) return { success: false, message: 'No company associated' }
    try {
      await branchApi.delete(companyId, id)
      setBranches(prev => prev.filter(b => b._id !== id && b.id !== id))
      return { success: true }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Failed to delete branch' }
    }
  }, [authUser?.company_id])

  // ─────────────────────────────────────────────────────────
  // USER ACTIONS (Super Admin only)
  // ─────────────────────────────────────────────────────────
  const addUser = useCallback(async (data) => {
    try {
      const res = await userApi.create(data)
      const newUser = res?.data || res
      setUsers(prev => [newUser, ...prev])
      return { success: true, data: newUser }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Failed to create user' }
    }
  }, [])

  const updateUser = useCallback(async (id, data) => {
    try {
      const res = await userApi.update(id, data)
      const updated = res?.data || res
      setUsers(prev => prev.map(u => (u._id === id || u.id === id) ? { ...u, ...updated } : u))
      return { success: true, data: updated }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Update failed' }
    }
  }, [])

  const deleteUser = useCallback(async (id) => {
    try {
      await userApi.delete(id)
      setUsers(prev => prev.filter(u => u._id !== id && u.id !== id))
      return { success: true }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Delete failed' }
    }
  }, [])

  const resetUserPassword = useCallback(async (id, new_password) => {
    try {
      await userApi.resetPassword(id, new_password)
      return { success: true }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Reset failed' }
    }
  }, [])

  // ─────────────────────────────────────────────────────────
  // CONTEXT VALUE
  // ─────────────────────────────────────────────────────────
  const ctx = {
    // ── Data ─────────────────────────────────────────────
    enquiries, orders, dispatches, inventory, purchases, sales, expenses,
    payments, notifications, products, categories, subCategories, brands,
    customers, leads, followups, employees, users, companies,
    warehouses, transfers, documents, dashboardStats, loadingData,
    suppliers, branches, selectedStoneCalculations,

    // ── Setters (for optimistic local updates) ────────────
    setEnquiries, setOrders, setDispatches, setInventory, setPurchases,
    setSales, setExpenses, setPayments, setNotifications, setProducts,
    setCategories, setSubCategories, setBrands, setCustomers, setLeads, setFollowups,
    setEmployees, setUsers, setCompanies, setWarehouses, setTransfers, setDocuments,
    setSuppliers, setBranches, setSelectedStoneCalculations,

    // ── Enquiry actions ───────────────────────────────────
    addEnquiry, updateEnquiry, deleteEnquiry, convertEnquiryToOrder,

    // ── Order actions ─────────────────────────────────────
    addOrder, assignOrder, updateOrderStatus, startPacking, markReadyForDispatch, deleteOrder, packOrder,

    // ── Dispatch actions ──────────────────────────────────
    createDispatch, markInTransit, markDelivered,

    // ── Purchase actions ──────────────────────────────────
    addPurchase, updatePurchase, deletePurchase, updatePurchaseStatus, updatePurchasePayment,

    // ── Supplier actions ──────────────────────────────────
    addSupplier, updateSupplier, deleteSupplier,

    // ── Branch actions ────────────────────────────────────
    addBranch, updateBranch, deleteBranch,

    // ── Payment actions ───────────────────────────────────
    recordPayment,

    // ── Customer actions ──────────────────────────────────
    addCustomer, updateCustomer, deleteCustomer,

    // ── Lead actions ──────────────────────────────────────
    addLead, updateLead, deleteLead, convertLead,

    // ── Follow-up actions ─────────────────────────────────
    addFollowup, updateFollowup, deleteFollowup,

    // ── Employee actions ──────────────────────────────────
    addEmployee, updateEmployee, deleteEmployee,

    // ── Category & Brand actions ──────────────────────────
    addCategory, updateCategory, deleteCategory,
    addSubCategory, updateSubCategory, deleteSubCategory,
    addBrand, updateBrand, deleteBrand,

    // ── Product actions ───────────────────────────────────
    addProduct, updateProduct, deleteProduct, checkProductTransactions,

    // ── Sales actions ─────────────────────────────────────
    addSale,

    // ── Expense actions ───────────────────────────────────
    addExpense, updateExpense, deleteExpense,

    // ── Notification actions ──────────────────────────────
    markNotifRead, markAllNotifsRead, deleteNotif, clearAllNotifs, addNotification,

    // ── Warehouse & Transfer actions ──────────────────────
    addWarehouse, updateWarehouse, deleteWarehouse,
    createTransfer, updateTransferStatus, deleteTransfer,

    // ── User actions ──────────────────────────────────────
    addUser, updateUser, deleteUser, resetUserPassword,

    // ── Stone Calculation Selection actions ────────────────
    setStoneSelectionsForSheet, clearStoneSelections, getStoneSelections,

    // ── Refresh ───────────────────────────────────────────
    fetchAll,
  }

  return <ErpContext.Provider value={ctx}>{children}</ErpContext.Provider>
}

export function useErp() {
  const ctx = useContext(ErpContext)
  if (!ctx) throw new Error('useErp must be used within <ErpProvider>')
  return ctx
}

export default ErpContext
