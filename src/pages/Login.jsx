import { useState } from 'react'
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import logoImg from '/logo.png'
import { useAuth } from '../context/AuthContext'

const DEMO_USERS = [
  { email: 'ezyenquiry@gmail.com', password: 'ezyenquiry@123', name: 'Super Admin', role: 'Owner' },
]

export default function Login() {
  const { login, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email.trim())    return setError('Please enter your email address.')
    if (!password.trim()) return setError('Please enter your password.')

    setLoading(true)
    const result = await login(email.trim(), password)
    setLoading(false)

    if (result.success) {
      navigate('/dashboard', { replace: true })
    } else {
      setError(result.message || 'Invalid email or password. Please try again.')
    }
  }

  const fillDemo = (u) => {
    setEmail(u.email)
    setPassword(u.password)
    setError('')
  }

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .demo-btn:hover { border-color: #FD5C02 !important; background: #FFF7F3 !important; }
        .login-submit:hover:not(:disabled) { filter: brightness(1.08); box-shadow: 0 6px 28px rgba(253,92,2,0.45) !important; }
      `}</style>

      {/* Full-page white background */}
      <div style={{
        minHeight: '100vh',
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}>

        {/* Card */}
        <div style={{
          width: '100%',
          maxWidth: 480,
          background: '#ffffff',
          borderRadius: 24,
          boxShadow: '0 8px 32px rgba(1,21,45,0.10), 0 32px 80px rgba(1,21,45,0.10)',
          border: '1px solid #EEF2F7',
          padding: '32px 44px 28px',
          boxSizing: 'border-box',
        }}>

          {/* ── Logo + Brand ── */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{
              width: 64, height: 64,
              borderRadius: 16,
              background: '#FFF3EC',
              border: '2px solid #FED7B8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 10px',
              boxShadow: '0 4px 16px rgba(253,92,2,0.15)',
            }}>
              <img src={logoImg} alt="EzyEnquiry" style={{ width: 44, height: 44, objectFit: 'contain' }} />
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#01152D', letterSpacing: '-0.5px', lineHeight: 1.1 }}>
              EzyEnquiry
            </div>
          </div>

          {/* Orange accent line */}
          <div style={{ height: 3, background: 'linear-gradient(90deg, #FD5C02, #FE8A3A, #FFF3EC)', borderRadius: 2, marginBottom: 20 }} />

          <>
              {/* ── Heading ── */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 19, fontWeight: 800, color: '#01152D', marginBottom: 4 }}>Welcome back</div>
                <div style={{ fontSize: 13, color: '#64748B' }}>Login with your email and password</div>
              </div>

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

              {/* ── Form ── */}
              <form onSubmit={handleSubmit} noValidate>

                {/* Email */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                    Email Address
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                    <input
                      type="email"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setError('') }}
                      placeholder="admin@ezyenquiry.com"
                      autoComplete="email"
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        padding: '11px 12px 11px 36px',
                        border: '1.5px solid #E2E8F0',
                        borderRadius: 10, fontSize: 13.5, color: '#01152D',
                        background: '#FAFBFC', outline: 'none',
                        transition: 'border-color 0.15s, box-shadow 0.15s',
                      }}
                      onFocus={e => { e.target.style.borderColor = '#FD5C02'; e.target.style.boxShadow = '0 0 0 3px rgba(253,92,2,0.1)'; e.target.style.background = '#fff' }}
                      onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; e.target.style.background = '#FAFBFC' }}
                    />
                  </div>
                </div>

                {/* Password */}
                <div style={{ marginBottom: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Password</label>
                    <a href="#" style={{ fontSize: 11.5, color: '#FD5C02', fontWeight: 600, textDecoration: 'none' }}>Forgot password?</a>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={password}
                      onChange={e => { setPassword(e.target.value); setError('') }}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        padding: '11px 40px 11px 36px',
                        border: '1.5px solid #E2E8F0',
                        borderRadius: 10, fontSize: 13.5, color: '#01152D',
                        background: '#FAFBFC', outline: 'none',
                        transition: 'border-color 0.15s, box-shadow 0.15s',
                      }}
                      onFocus={e => { e.target.style.borderColor = '#FD5C02'; e.target.style.boxShadow = '0 0 0 3px rgba(253,92,2,0.1)'; e.target.style.background = '#fff' }}
                      onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; e.target.style.background = '#FAFBFC' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(s => !s)}
                      style={{
                        position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#9CA3AF', display: 'flex', padding: 2, borderRadius: 4,
                      }}
                    >
                      {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="login-submit"
                  style={{
                    width: '100%', padding: '13px 0',
                    background: loading ? '#FDBA8C' : 'linear-gradient(135deg, #FD5C02 0%, #FE7722 100%)',
                    color: '#fff', border: 'none', borderRadius: 11,
                    fontSize: 14, fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: '0 4px 20px rgba(253,92,2,0.30)',
                    transition: 'all 0.2s',
                  }}
                >
                  {loading ? (
                    <>
                      <span style={{ width: 16, height: 16, border: '2.5px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                      Signing in…
                    </>
                  ) : (
                    <>Login <ArrowRight size={16} /></>
                  )}
                </button>
              </form>

              {/* ── Quick login ── */}
              <div style={{ marginTop: 24 }}>
                <div style={{ height: 1, background: '#E8EDF3', marginBottom: 11 }} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {DEMO_USERS.map(u => (
                    <button
                      key={u.email}
                      type="button"
                      className="demo-btn"
                      onClick={() => fillDemo(u)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', borderRadius: 10,
                        border: '1.5px solid #E8EDF3', background: '#FAFBFC',
                        cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                        width: '100%',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                          background: 'linear-gradient(135deg, #FD5C02, #FE8A3A)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 800, color: '#fff',
                        }}>
                          SA
                        </div>
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#01152D', lineHeight: 1.3 }}>Super Admin</div>
                          <div style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.3 }}>{u.email}</div>
                        </div>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '3px 9px',
                        borderRadius: 6, background: '#FFF3EC',
                        color: '#FD5C02', border: '1px solid #FED7C0',
                        flexShrink: 0,
                      }}>{u.role}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>

          {/* Footer */}
          <div style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: '#CBD5E1' }}>
            © 2026 EzyEnquiry · Secure Enterprise ERP Platform
          </div>
        </div>
      </div>
    </>
  )
}
