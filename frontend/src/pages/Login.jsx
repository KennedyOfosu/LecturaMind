import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { dashboardPath } from '../utils/roleGuard'

const BLUE = '#2e54fe'

const inputBase = {
  width: '100%', padding: '13px 16px', borderRadius: 10,
  border: '1.5px solid #e8eaf0', backgroundColor: '#fff',
  fontSize: 14, color: '#1a1a1a', outline: 'none',
  fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
}

export default function Login() {
  const { login }   = useAuth()
  const navigate    = useNavigate()
  const [idNumber,  setIdNumber]  = useState('')
  const [password,  setPassword]  = useState('')
  const [error,     setError]     = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!idNumber.trim() || !password) {
      setError('Please enter your ID number and password.')
      return
    }
    setIsLoading(true)
    try {
      const user = await login(idNumber.trim(), password)
      navigate(dashboardPath(user.role))
    } catch (err) {
      setError(err.response?.data?.error || 'Sign in failed. Please check your credentials.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{
      width: '100vw', height: '100vh', overflow: 'hidden',
      backgroundImage: "url('/Login_Background_Page.jpg')",
      backgroundSize: 'cover', backgroundPosition: 'center',
      display: 'flex',
    }}>

      {/* LecturaMind Logo — top left */}
      <Link to="/" style={{ position: 'absolute', top: 36, left: 48 }}>
        <img src="/LecturaMind%20Logo.svg" alt="LecturaMind" style={{ height: 36, width: 'auto', display: 'block' }} />
      </Link>

      {/* LEFT — floating card */}
      <div style={{
        width: '45%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '32px 16px 32px 40px',
        boxSizing: 'border-box',
      }}>
        <div style={{
          width: '100%', maxWidth: 500,
          backgroundColor: '#ffffff',
          borderRadius: 20,
          boxShadow: '0 24px 64px rgba(0,0,0,0.13)',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          height: '62vh',
        }}>

          {/* Card body */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '48px 20px 24px',
            display: 'flex', flexDirection: 'column',
          }}>

            {/* Colored logo mark */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
              <img src="/Colored_Logo_Mark.svg" alt="" style={{ height: 36, width: 'auto' }} />
            </div>

            {/* Title + subtitle */}
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 5px' }}>
                Welcome Back
              </h1>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#9ca3af', margin: 0 }}>
                Sign in to your LecturaMind account
              </p>
            </div>

            {/* Form — pushed down via auto top margin */}
            <form onSubmit={handleSubmit} style={{
              display: 'flex', flexDirection: 'column', gap: 12,
              width: 360, maxWidth: '100%', margin: 'auto auto 0',
            }}>
              <input
                type="text"
                placeholder="Enter ID"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value.toUpperCase())}
                autoComplete="off"
                style={inputBase}
              />
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ ...inputBase, paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{
                    position: 'absolute', right: 14, top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: 0, color: '#9ca3af', display: 'flex', alignItems: 'center',
                  }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>

              {error && (
                <p style={{ color: '#ef4444', fontSize: 12, textAlign: 'center', margin: 0, fontFamily: 'Inter, sans-serif' }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%', padding: '13px',
                  backgroundColor: isLoading ? '#93aeff' : BLUE,
                  color: '#fff', border: 'none', borderRadius: 10,
                  fontSize: 15, fontWeight: 600,
                  fontFamily: 'Inter, sans-serif',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  marginTop: 4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {isLoading && (
                  <svg style={{ animation: 'spin 1s linear infinite', height: 16, width: 16 }} fill="none" viewBox="0 0 24 24">
                    <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                )}
                {isLoading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            {/* Sign up link — pinned to bottom */}
            <p style={{ textAlign: 'center', fontSize: 13, color: '#9ca3af', marginTop: 'auto', paddingTop: 16, fontFamily: 'Inter, sans-serif' }}>
              Don't have an account?{' '}
              <Link to="/register" style={{ color: BLUE, fontWeight: 600, textDecoration: 'none' }}>Sign Up</Link>
            </p>

          </div>
        </div>
      </div>

      {/* RIGHT — headline + subtext */}
      <div style={{
        width: '55%', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
        padding: '5% 60px 0 0',
        boxSizing: 'border-box',
      }}>
        <p style={{
          fontFamily: "'Tusker Grotesk', sans-serif", fontWeight: 800,
          fontSize: 'clamp(3rem, 6vw, 5.5rem)',
          color: '#2e54fe', lineHeight: 1.05, margin: '0 0 20px',
        }}>
          Smarter<br />Classrooms<br />Start Here
        </p>
        <p style={{
          fontFamily: 'Inter, sans-serif', fontSize: 18,
          color: '#202125', lineHeight: 1.6, margin: 0, maxWidth: 420,
        }}>
          Built to help lecturers teach better and students learn smarter.
        </p>
      </div>

    </div>
  )
}
