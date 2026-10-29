/**
 * AuthContext — Real JWT authentication
 * Wraps the entire app; provides user, token, login, logout
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authApi as authService } from '../api/authApi'
import { rolePermissionApi } from '../api/rolePermissionApi'
import { setLivePermissions, clearLivePermissions } from '../config/permissions'

/** Fetch the current user's effective permissions and publish them to the RBAC layer. */
async function loadLivePermissions() {
  try {
    const res = await rolePermissionApi.me()
    const payload = res?.data || res
    if (payload?.permissions) setLivePermissions(payload.permissions)
  } catch {
    // No/failed permissions → keep code defaults as fallback.
    clearLivePermissions()
  }
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(() => {
    try {
      const stored = localStorage.getItem('user')
      return stored ? JSON.parse(stored) : null
    } catch { return null }
  })
  const [token,   setToken]   = useState(() => localStorage.getItem('token') || null)
  const [loading, setLoading] = useState(false)

  // ── On mount: verify token with /auth/me ──────────────────
  useEffect(() => {
    if (!token) return
    authService.me()
      .then(res => {
        // Backend returns { success: true, data: { ...user } }
        const u = res?.data || res
        setUser(u)
        localStorage.setItem('user', JSON.stringify(u))
        loadLivePermissions()
      })
      .catch(() => {
        // Token invalid/expired/wrong-secret — clear and stay on login
        setToken(null)
        setUser(null)
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        localStorage.removeItem('isLoggedIn')
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** Login with email + password */
  const login = useCallback(async (email, password) => {
    setLoading(true)
    try {
      const res = await authService.login(email, password)
      // Backend: { success: true, data: { token, user }, message }
      const payload = res?.data || res
      const tok = payload?.token
      const u   = payload?.user
      if (!tok) throw new Error('No token in response')
      localStorage.setItem('token', tok)
      localStorage.setItem('user', JSON.stringify(u))
      localStorage.setItem('isLoggedIn', 'true')
      setToken(tok)
      setUser(u)
      await loadLivePermissions()
      return { success: true }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Login failed. Please try again.'
      return { success: false, message: msg }
    } finally {
      setLoading(false)
    }
  }, [])

  /** OTP login */
  const loginWithOtp = useCallback(async (target, otp) => {
    setLoading(true)
    try {
      const res = await authService.verifyOtp(target, otp, 'login')
      const payload = res?.data || res
      const tok = payload?.token
      const u   = payload?.user
      if (!tok) throw new Error('No token in response')
      localStorage.setItem('token', tok)
      localStorage.setItem('user', JSON.stringify(u))
      localStorage.setItem('isLoggedIn', 'true')
      setToken(tok)
      setUser(u)
      await loadLivePermissions()
      return { success: true }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'OTP verification failed.'
      return { success: false, message: msg }
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Company web-app login — verifies a mobile + demo OTP against the
   * company-login endpoint and signs the Company Owner in. The issued
   * token is tied to the owner's company_id, so all data stays scoped.
   */
  const loginCompany = useCallback(async (mobile, otp) => {
    setLoading(true)
    try {
      const res = await authService.companyLoginVerifyOtp(mobile, otp)
      const payload = res?.data || res
      const tok = payload?.token
      const u   = payload?.user
      if (!tok) throw new Error('No token in response')
      localStorage.setItem('token', tok)
      localStorage.setItem('user', JSON.stringify(u))
      localStorage.setItem('isLoggedIn', 'true')
      setToken(tok)
      setUser(u)
      await loadLivePermissions()
      return { success: true }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'OTP verification failed.'
      return { success: false, message: msg }
    } finally {
      setLoading(false)
    }
  }, [])

  const updateCurrentUser = useCallback((updates) => {
    setUser(current => {
      const nextUser = { ...(current || {}), ...(updates || {}) }
      localStorage.setItem('user', JSON.stringify(nextUser))
      return nextUser
    })
  }, [])

  const refreshUser = useCallback(async () => {
    const res = await authService.me()
    const nextUser = res?.data || res
    setUser(nextUser)
    localStorage.setItem('user', JSON.stringify(nextUser))
    await loadLivePermissions()
    return nextUser
  }, [])

  /** Logout */
  const logout = useCallback(async () => {
    await authService.logout()
    setToken(null)
    setUser(null)
    clearLivePermissions()
  }, [])

  const isLoggedIn = Boolean(token && user)

  return (
    <AuthContext.Provider value={{ user, token, loading, isLoggedIn, login, loginWithOtp, loginCompany, logout, refreshUser, updateCurrentUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}

export default AuthContext
