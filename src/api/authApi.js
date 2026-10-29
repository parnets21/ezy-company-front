/**
 * authApi.js
 * Endpoints: POST /auth/login | /auth/send-otp | /auth/verify-otp
 *            GET  /auth/me
 *            POST /auth/change-password | /auth/logout
 */
import api from './index'

export const authApi = {
  // ── Login with email + password ───────────────────────────
  login: (email, password) =>
    api.post('/auth/login', { email, password }).then(r => r.data),

  // ── Send OTP (email or mobile) ────────────────────────────
  sendOtp: (target, type = 'email', purpose = 'login') =>
    api.post('/auth/send-otp', { target, type, purpose }).then(r => r.data),

  // ── Verify OTP ────────────────────────────────────────────
  verifyOtp: (target, otp, purpose = 'login') =>
    api.post('/auth/verify-otp', { target, otp, purpose }).then(r => r.data),

  // ── Register a new company (public onboarding step 1) ──────
  // Creates Company + Owner user. Returns { userId, companyId, companyCode }.
  register: (data) =>
    api.post('/auth/register', data).then(r => r.data),

  // ── Upload KYC documents (public onboarding step 2) ────────
  // `files` is an object like { gst: File, pan: File, trade: File, reg: File }.
  // Identified by `mobile`. Sent as multipart/form-data.
  uploadDocs: (mobile, files = {}) => {
    const fd = new FormData()
    fd.append('mobile', mobile)
    Object.entries(files).forEach(([field, file]) => { if (file) fd.append(field, file) })
    // IMPORTANT: do NOT hardcode 'multipart/form-data' — that omits the boundary
    // and the server can't parse the files. Setting Content-Type to undefined
    // lets axios/the browser generate the correct multipart boundary itself.
    return api.post('/auth/upload-docs', fd, {
      headers: { 'Content-Type': undefined },
    }).then(r => r.data)
  },

  // ── Company web-app login (mobile + demo OTP) ─────────────
  // Step 1: request a fresh OTP for a registered company mobile.
  // Response data includes { sent, demo_otp, company_name }.
  companyLoginSendOtp: (mobile) =>
    api.post('/auth/company-login/send-otp', { mobile }).then(r => r.data),

  // Step 2: verify the OTP → returns { token, user }.
  companyLoginVerifyOtp: (mobile, otp) =>
    api.post('/auth/company-login/verify-otp', { mobile, otp }).then(r => r.data),

  // ── Get logged-in user profile ────────────────────────────
  me: () =>
    api.get('/auth/me').then(r => r.data),

  // ── Change password ───────────────────────────────────────
  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/change-password', { currentPassword, newPassword }).then(r => r.data),

  // ── Logout (clears localStorage too) ─────────────────────
  logout: async () => {
    try { await api.post('/auth/logout') } catch { /* server-side logout is best-effort */ }
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('isLoggedIn')
  },
}
