/**
 * api/index.js — Axios instance + re-exports for all API modules
 *
 * • baseURL  → company-web backend (set VITE_API_URL in deployed environments)
 * • Every request automatically gets  Authorization: Bearer <token>
 * • Any 401 response clears storage and redirects to /login
 *
 * Usage:
 *   import api from './api'                     // axios instance
 *   import { authApi } from './api/authApi'     // named module
 */
import axios from 'axios'

// Keep company-web traffic on its dedicated backend. That API tags new
// registrations as `company_web`, which the admin website excludes.
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000, // 60s — handles Render free-tier cold start (~30-50s wake-up)
  headers: { 'Content-Type': 'application/json' },
})

// ── Attach JWT on every request ────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => Promise.reject(error),
)

// ── Handle 401 globally ────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('isLoggedIn')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export default api

// ── Re-export all API modules ───────────────────────────────
export { authApi }            from './authApi'
export { companyApi }         from './companyApi'
export { branchApi }          from './branchApi'
export { userApi }            from './userApi'
export { profileApi }         from './profileApi'
export { categoryApi, brandApi, productApi } from './productApi'
export { inventoryApi }       from './inventoryApi'
export { enquiryApi }         from './enquiryApi'
export { orderApi }           from './orderApi'
export { dispatchApi }        from './dispatchApi'
export { customerApi, leadApi, followupApi } from './crmApi'
export { purchaseApi, salesApi, expenseApi, paymentApi, invoiceApi } from './financeApi'
export { hrApi }              from './hrApi'
export { employeeMasterApi }  from './employeeMasterApi'
export { notificationApi, documentApi, subscriptionApi, reportApi } from './systemApi'
export { rolePermissionApi }  from './rolePermissionApi'
export { wholesalerApi }      from './wholesalerApi'
export { stoneApi }           from './stoneApi'
