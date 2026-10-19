import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authService } from '../services/authService'
import { useToast } from '../components/ui/Toast'

const BLUE = '#2e54fe'
const inputStyle = {
  width: '100%', padding: '13px 16px', borderRadius: 10,
  border: '1.5px solid #e8eaf0', backgroundColor: '#fff',
  fontSize: 14, color: '#1a1a1a', outline: 'none',
  fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
}

function VisibilityToggle({ visible, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-label={visible ? 'Hide password' : 'Show password'} style={{
      position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
      border: 0, padding: 0, color: '#9ca3af', background: 'none', cursor: 'pointer',
    }}>
      {visible ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M3 3l18 18" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      )}
    </button>
  )
}

export default function ActivateAccount() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const token = searchParams.get('token') || ''
  const [lecturer, setLecturer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [pageError, setPageError] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    let current = true
    if (!token) {
      setPageError('This activation link is invalid. Request a new link from your administrator.')
      setLoading(false)
      return () => { current = false }
    }
    authService.validateLecturerActivation(token)
      .then((response) => { if (current) setLecturer(response.data?.lecturer || null) })
      .catch((error) => {
        if (current) setPageError(error.response?.data?.error || 'We could not verify this activation link. Please try again.')
      })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [token])

  const passwordMeetsPolicy = password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password)
  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword
  const canSubmit = Boolean(lecturer && passwordMeetsPolicy && passwordsMatch && !submitting)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFieldError('')
    if (!passwordMeetsPolicy) {
      setFieldError('Use at least 8 characters, including at least one letter and one number.')
      return
    }
    if (password !== confirmPassword) {
      setFieldError('The passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      await authService.completeLecturerActivation({ token, password })
      toast.success('Password set. Your account is active. Sign in with your Staff ID and new password.')
      navigate('/login', { replace: true })
    } catch (error) {
      const message = error.response?.data?.error || 'We could not activate your account. Please try again.'
      if (error.response?.data?.field === 'password') setFieldError(message)
      else setPageError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const statusText = useMemo(() => {
    if (loading) return 'Checking your secure setup link…'
    if (pageError) return 'Your account was not changed.'
    return 'Choose a personal password to finish activating your lecturer account.'
  }, [loading, pageError])

  return (
    <main style={{
      minHeight: '100vh', padding: 24, boxSizing: 'border-box',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: "linear-gradient(rgba(245,247,255,.78), rgba(245,247,255,.9)), url('/Login_Background_Page.jpg') center / cover fixed",
      fontFamily: 'Inter, sans-serif',
    }}>
      <section style={{ width: '100%', maxWidth: 480, padding: '38px 34px', borderRadius: 20, background: '#fff', boxShadow: '0 24px 64px rgba(0,0,0,.13)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <img src="/Colored_Logo_Mark.svg" alt="LecturaMind" style={{ height: 40 }} />
        </div>
        <h1 style={{ margin: 0, textAlign: 'center', color: '#111827', fontSize: 23, fontWeight: 700 }}>Set up your password</h1>
        <p style={{ margin: '9px 0 22px', textAlign: 'center', color: '#6b7280', fontSize: 13, lineHeight: 1.6 }}>{statusText}</p>

        {loading && <p role="status" style={{ textAlign: 'center', color: '#6b7280', fontSize: 13 }}>Please wait…</p>}
        {!loading && pageError && (
          <div role="alert" style={{ padding: 14, border: '1px solid #fecaca', borderRadius: 10, color: '#b91c1c', background: '#fef2f2', fontSize: 13, lineHeight: 1.5 }}>
            {pageError}
          </div>
        )}

        {!loading && lecturer && !pageError && (
          <>
            <div style={{ marginBottom: 20, padding: 14, border: '1px solid #e5e7eb', borderRadius: 10, background: '#f9fafb' }}>
              <p style={{ margin: 0, fontSize: 13, color: '#374151' }}>Activating account for</p>
              <p style={{ margin: '5px 0 0', fontSize: 15, fontWeight: 600, color: '#111827' }}>{lecturer.full_name}</p>
              <p style={{ margin: '3px 0 0', fontSize: 13, color: '#6b7280' }}>{lecturer.email}</p>
            </div>

            <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, color: '#4b5563', fontSize: 12, fontWeight: 600 }}>
                New password
                <span style={{ position: 'relative' }}>
                  <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password}
                    onChange={(event) => { setPassword(event.target.value); setFieldError('') }}
                    style={{ ...inputStyle, paddingRight: 58, borderColor: password && !passwordMeetsPolicy ? '#fca5a5' : inputStyle.border }} />
                  <VisibilityToggle visible={showPassword} onClick={() => setShowPassword((value) => !value)} />
                </span>
              </label>
              <p style={{ margin: '-9px 0 0', color: password && !passwordMeetsPolicy ? '#dc2626' : '#6b7280', fontSize: 11 }}>
                At least 8 characters, with at least one letter and one number.
              </p>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, color: '#4b5563', fontSize: 12, fontWeight: 600 }}>
                Confirm password
                <span style={{ position: 'relative' }}>
                  <input type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword}
                    onChange={(event) => { setConfirmPassword(event.target.value); setFieldError('') }}
                    style={{ ...inputStyle, paddingRight: 58, borderColor: passwordsMismatch ? '#fca5a5' : inputStyle.border }} />
                  <VisibilityToggle visible={showConfirmPassword} onClick={() => setShowConfirmPassword((value) => !value)} />
                </span>
              </label>
              {passwordsMatch && <p style={{ margin: '-9px 0 0', color: '#059669', fontSize: 12 }}>✓ Passwords match</p>}
              {passwordsMismatch && <p style={{ margin: '-9px 0 0', color: '#dc2626', fontSize: 12 }}>Passwords do not match.</p>}
              {fieldError && <p role="alert" style={{ margin: 0, color: '#dc2626', fontSize: 12 }}>{fieldError}</p>}

              <button type="submit" disabled={!canSubmit} style={{
                marginTop: 3, padding: 13, border: 0, borderRadius: 10,
                background: canSubmit ? BLUE : '#93aeff', color: '#fff',
                fontSize: 14, fontWeight: 600, cursor: canSubmit ? 'pointer' : 'not-allowed',
              }}>{submitting ? 'Activating…' : 'Set password and activate'}</button>
            </form>
          </>
        )}

        <p style={{ margin: '22px 0 0', textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>
          <Link to="/login" style={{ color: BLUE, fontWeight: 600, textDecoration: 'none' }}>Back to sign in</Link>
        </p>
      </section>
    </main>
  )
}
