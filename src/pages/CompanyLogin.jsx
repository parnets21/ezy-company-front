import { useState } from 'react'
import { Phone, KeyRound, ArrowRight, AlertCircle, ArrowLeft, Info } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import logoImg from '/logo.png'
import { useAuth } from '../context/AuthContext'
import { authApi } from '../api/authApi'

/**
 * CompanyLogin — company web-app entry point (/company-login).
 *
 * Flow:
 *   1. Company owner enters their registered 10-digit mobile number.
 *   2. Backend validates the company is Approved + active, then returns a
 *      fresh random "demo OTP" (SMS is not integrated yet) which we show
 *      on screen for testing.
 *   3. Owner enters the OTP → verified → JWT issued for the Company Owner
 *      user (scoped to company_id) → redirect to /dashboard.
 */
export default function CompanyLogin() {
  const { loginCompany, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [step,     setStep]     = useState('mobile') // 'mobile' | 'otp'
  const [mobile,   setMobile]   = useState('')
  const [otp,      setOtp]      = useState('')
  const [demoOtp,  setDemoOtp]  = useState('')
  const [company,  setCompany]  = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const resetErr = () => setError('')

  // ── Step 1: request OTP ──────────────────────────────────
  const handleSendOtp = async (e) => {
    e.preventDefault()
    resetErr()
    if (!/^\d{10}$/.test(mobile.trim())) {
      return setError('Please enter a valid 10-digit mobile number.')
    }
    setLoading(true)
    try {
      const res = await authApi.companyLoginSendOtp(mobile.trim())
      const data = res?.data || res
      setDemoOtp(data?.demo_otp || '')
      setCompany(data?.company_name || '')
      setOtp('')
      setStep('otp')
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send OTP. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: verify OTP ───────────────────────────────────
  const handleVerify = async (e) => {
    e.preventDefault()
    resetErr()
    if (!otp.trim()) return setError('Please enter the OTP.')

    setLoading(true)
    const result = await loginCompany(mobile.trim(), otp.trim())
    setLoading(false)

    if (result.success) {
      navigate('/dashboard', { replace: true })
    } else {
      setError(result.message || 'OTP verification failed. Please try again.')
    }
  }

  // ── Step 1 helper: resend OTP from the OTP screen ────────
  const handleResend = async () => {
    resetErr()
    setLoading(true)
    try {
      const res = await authApi.companyLoginSendOtp(mobile.trim())
      const data = res?.data || res
      setDemoOtp(data?.demo_otp || '')
      setOtp('')
    } catch (err) {
      setError(err.response?.data?.message || 'Could not resend OTP.')
    } finally {
      setLoading(false)
    }
  }

  const busy = loading || authLoading

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    padding: '11px 12px 11px 36px',
    border: '1.5px solid #E2E8F0',
    borderRadius: 10, fontSize: 13.5, color: '#01152D',
    background: '#FAFBFC', outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  }
  const onFocus = (e) => { e.target.style.borderColor = '#FD5C02'; e.target.style.boxShadow = '0 0 0 3px rgba(253,92,2,0.1)'; e.target.style.background = '#fff' }
  const onBlur  = (e) => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; e.target.style.background = '#FAFBFC' }

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .login-submit:hover:not(:disabled) { filter: brightness(1.08); box-shadow: 0 6px 28px rgba(253,92,2,0.45) !important; }
      `}</style>

      <div style={{
        minHeight: '100vh', background: '#ffffff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px 16px', fontFamily: "'Inter', system-ui, sans-serif",
      }}>
        <div style={{
          width: '100%', maxWidth: 480, background: '#ffffff',
          borderRadius: 24,
          boxShadow: '0 8px 32px rgba(1,21,45,0.10), 0 32px 80px rgba(1,21,45,0.10)',
          border: '1px solid #EEF2F7', padding: '32px 44px 28px', boxSizing: 'border-box',
        }}>

          {/* ── Logo + Brand ── */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16,
              background: '#FFF3EC', border: '2px solid #FED7B8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 10px', boxShadow: '0 4px 16px rgba(253,92,2,0.15)',
            }}>
              <img src={logoImg} alt="EzyEnquiry" style={{ width: 44, height: 44, objectFit: 'contain' }} />
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#01152D', letterSpacing: '-0.5px', lineHeight: 1.1 }}>
              EzyEnquiry
            </div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2, fontWeight: 600 }}>Company Portal</div>
          </div>

          <div style={{ height: 3, background: 'linear-gradient(90deg, #FD5C02, #FE8A3A, #FFF3EC)', borderRadius: 2, marginBottom: 20 }} />

          {/* ── Error ── */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '11px 14px', borderRadius: 10, marginBottom: 16,
              background: '#FEF2F2', border: '1px solid #FECACA',
              color: '#991B1B', fontSize: 13,
            }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}

          {step === 'mobile' && (
            <>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 19, fontWeight: 800, color: '#01152D', marginBottom: 4 }}>Company Login</div>
                <div style={{ fontSize: 13, color: '#64748B' }}>Enter your registered mobile number to continue</div>
              </div>

              <form onSubmit={handleSendOtp} noValidate>
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                    Mobile Number
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={mobile}
                      onChange={e => { setMobile(e.target.value.replace(/\D/g, '').slice(0, 10)); resetErr() }}
                      placeholder="10-digit registered mobile"
                      autoComplete="tel"
                      style={inputStyle}
                      onFocus={onFocus}
                      onBlur={onBlur}
                    />
                  </div>
                </div>

                <button type="submit" disabled={busy} className="login-submit" style={submitStyle(busy)}>
                  {busy ? (<><Spinner />Sending OTP…</>) : (<>Send OTP <ArrowRight size={16} /></>)}
                </button>
              </form>
            </>
          )}

          {step === 'otp' && (
            <>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 19, fontWeight: 800, color: '#01152D', marginBottom: 4 }}>Enter OTP</div>
                <div style={{ fontSize: 13, color: '#64748B' }}>
                  {company ? <>Signing in to <strong style={{ color: '#01152D' }}>{company}</strong>. </> : null}
                  Sent to mobile ending <strong>{mobile.slice(-4)}</strong>
                </div>
              </div>

              {/* Demo OTP banner (SMS not integrated) */}
              {demoOtp && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '11px 14px', borderRadius: 10, marginBottom: 16,
                  background: '#FFF7F3', border: '1px solid #FED7B8', color: '#9A3412',
                }}>
                  <Info size={16} style={{ flexShrink: 0 }} />
                  <div style={{ fontSize: 13 }}>
                    Demo OTP (testing):{' '}
                    <strong style={{ fontSize: 16, letterSpacing: 2, color: '#FD5C02' }}>{demoOtp}</strong>
                  </div>
                </div>
              )}

              <form onSubmit={handleVerify} noValidate>
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                    One-Time Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <KeyRound size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                    <input
                      type="text"
                      inputMode="numeric"
                      value={otp}
                      onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 8)); resetErr() }}
                      placeholder="Enter the OTP"
                      autoComplete="one-time-code"
                      style={{ ...inputStyle, letterSpacing: 4, fontWeight: 700 }}
                      onFocus={onFocus}
                      onBlur={onBlur}
                    />
                  </div>
                </div>

                <button type="submit" disabled={busy} className="login-submit" style={submitStyle(busy)}>
                  {busy ? (<><Spinner />Verifying…</>) : (<>Verify & Login <ArrowRight size={16} /></>)}
                </button>
              </form>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => { setStep('mobile'); resetErr() }}
                  style={linkBtnStyle}
                >
                  <ArrowLeft size={13} /> Change number
                </button>
                <button type="button" onClick={handleResend} disabled={busy} style={linkBtnStyle}>
                  Resend OTP
                </button>
              </div>
            </>
          )}

          <div style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: '#CBD5E1' }}>
            © 2026 EzyEnquiry · Secure Enterprise ERP Platform
          </div>
        </div>
      </div>
    </>
  )
}

function submitStyle(busy) {
  return {
    width: '100%', padding: '13px 0',
    background: busy ? '#FDBA8C' : 'linear-gradient(135deg, #FD5C02 0%, #FE7722 100%)',
    color: '#fff', border: 'none', borderRadius: 11,
    fontSize: 14, fontWeight: 700,
    cursor: busy ? 'not-allowed' : 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    boxShadow: '0 4px 20px rgba(253,92,2,0.30)', transition: 'all 0.2s',
  }
}

const linkBtnStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  background: 'none', border: 'none', cursor: 'pointer',
  color: '#FD5C02', fontSize: 12.5, fontWeight: 600, padding: 2,
}

function Spinner() {
  return (
    <span style={{ width: 16, height: 16, border: '2.5px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
  )
}
