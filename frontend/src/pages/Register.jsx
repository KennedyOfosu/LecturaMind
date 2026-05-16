/**
 * Register.jsx — Figma-faithful split layout.
 * Full page: Signup_Background_Page.jpg background
 * Left 55% : Colored_Logo_Mark.svg + Group 160.png character + Tusker Grotesk headline
 * Right 45%: FLOATING white card (not full-height panel) — background visible around it
 * All 3-step form logic preserved.
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { dashboardPath } from '../utils/roleGuard'
import { PROGRAMMES, LEVELS } from '../utils/constants'

const BLUE = '#2e54fe'

/* ── Step tab bar inside card header ───────────────────────── */
function StepTabs({ step }) {
  const tabs = ['Basic Info', 'Academic Profile', 'Review']
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid #efefef' }}>
      {tabs.map((label, i) => {
        const num    = i + 1
        const active = step === num
        return (
          <div key={label} style={{
            flex: 1, padding: '13px 0', textAlign: 'center',
            fontSize: 13, fontWeight: active ? 600 : 400,
            color: active ? BLUE : '#b0b8c8',
            fontFamily: 'Inter, sans-serif',
            borderTop: `3px solid ${active ? BLUE : 'transparent'}`,
            cursor: 'default',
          }}>
            {label}
          </div>
        )
      })}
    </div>
  )
}

/* ── Field wrapper ──────────────────────────────────────────── */
function Field({ error, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {children}
      {error && <span style={{ color: '#ef4444', fontSize: 11, fontFamily: 'Inter, sans-serif' }}>{error}</span>}
    </div>
  )
}

const inputBase = {
  width: '100%', padding: '13px 16px', borderRadius: 10,
  border: '1.5px solid #e8eaf0', backgroundColor: '#fff',
  fontSize: 14, color: '#1a1a1a', outline: 'none',
  fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
}
const inputErr = { ...inputBase, borderColor: '#fca5a5', backgroundColor: '#fff5f5' }

/* ══════════════════════════════════════════════════════════════ */
export default function Register() {
  const { register } = useAuth()
  const navigate     = useNavigate()

  const [step,      setStep]      = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [errors,    setErrors]    = useState({})
  const [apiError,  setApiError]  = useState('')

  const [form, setForm] = useState({
    fullName: '', email: '', password: '', confirmPassword: '',
    idNumber: '', programme: '', level: '', academicYear: '',
  })

  const isStudent  = form.idNumber.startsWith('STU-')
  const isLecturer = form.idNumber.startsWith('LEC-')

  const set = (field) => (e) => {
    const val = field === 'idNumber' ? e.target.value.toUpperCase() : e.target.value
    setForm((p) => ({ ...p, [field]: val }))
    setErrors((p) => ({ ...p, [field]: '' }))
    setApiError('')
  }

  const validateStep1 = () => {
    const e = {}
    if (!form.fullName.trim()) e.fullName = 'Full name is required.'
    if (!form.email.trim()) e.email = 'Email is required.'
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email.'
    if (!form.password) e.password = 'Password is required.'
    else if (form.password.length < 6) e.password = 'At least 6 characters.'
    if (!form.confirmPassword) e.confirmPassword = 'Please confirm your password.'
    else if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match.'
    setErrors(e); return !Object.keys(e).length
  }

  const validateStep2 = () => {
    const e = {}
    if (!form.idNumber.trim()) e.idNumber = 'ID number is required.'
    else if (!form.idNumber.startsWith('STU-') && !form.idNumber.startsWith('LEC-'))
      e.idNumber = 'ID must start with STU- or LEC-.'
    if (isStudent) {
      if (!form.programme) e.programme = 'Select your programme.'
      if (!form.level)     e.level     = 'Select your level.'
    }
    setErrors(e); return !Object.keys(e).length
  }

  const handleStep1 = (e) => { e.preventDefault(); if (validateStep1()) setStep(2) }
  const handleStep2 = (e) => { e.preventDefault(); if (validateStep2()) setStep(3) }

  const handleSubmit = async (e) => {
    e.preventDefault(); setApiError(''); setIsLoading(true)
    try {
      const payload = {
        full_name: form.fullName, email: form.email,
        password:  form.password, id_number: form.idNumber,
      }
      if (isStudent) {
        payload.programme     = form.programme
        payload.level         = parseInt(form.level)
        payload.academic_year = form.academicYear || null
      }
      const user = await register(payload)
      navigate(dashboardPath(user.role))
    } catch (err) {
      setApiError(err.response?.data?.error || 'Registration failed. Please try again.')
    } finally { setIsLoading(false) }
  }

  const inp = (f) => ({ style: errors[f] ? inputErr : inputBase })

  const reviewRows = [
    { label: 'Name',      value: form.fullName  },
    { label: 'Email',     value: form.email     },
    { label: 'ID Number', value: form.idNumber  },
    isStudent && { label: 'Programme', value: form.programme },
    isStudent && { label: 'Level',     value: form.level ? `Level ${form.level}` : '' },
    isStudent && form.academicYear && { label: 'Academic Year', value: form.academicYear },
  ].filter(Boolean)

  return (
    /* ── Full-page background ── */
    <div style={{
      width: '100vw', height: '100vh', overflow: 'hidden',
      backgroundImage: "url('/Signup_Background_Page.jpg')",
      backgroundSize: 'cover', backgroundPosition: 'center',
      display: 'flex',
    }}>

      {/* ══ LEFT — character + logo + headline ══════════════════ */}
      <div style={{ width: '55%', position: 'relative', height: '100%' }}>

        {/* Logo mark top-left */}
        <img
          src="/Colored_Logo_Mark.svg"
          alt="LecturaMind"
          style={{ position: 'absolute', top: 36, left: 48, height: 40, width: 'auto' }}
        />

        {/* Headline + subtitle — mid-right of left panel, beside the character */}
        <div style={{
          position: 'absolute',
          left: '50%',       /* starts halfway across the left panel — beside the character */
          top: '52%',        /* vertically centred-lower, matching Figma */
          width: 320,
        }}>
          <p style={{
            fontFamily: "'Tusker Grotesk', sans-serif", fontWeight: 800,
            fontSize: 'clamp(2.2rem, 4vw, 3.6rem)', color: BLUE,
            lineHeight: 1.05, margin: '0 0 14px',
          }}>
            Teaching,<br />Reimagined
          </p>
          <p style={{
            fontFamily: 'Inter, sans-serif', fontSize: 14,
            color: '#374151', lineHeight: 1.65, margin: 0,
          }}>
            An AI-powered platform designed to support lecturers,
            engage students, and modernize higher education.
          </p>
        </div>
      </div>

      {/* ══ RIGHT — floating card centred vertically ════════════ */}
      <div style={{
        width: '45%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '32px 40px 32px 16px',   /* breathing room around the card */
        boxSizing: 'border-box',
      }}>

        {/* The floating card */}
        <div style={{
          width: '100%', maxWidth: 490,
          backgroundColor: '#ffffff',
          borderRadius: 20,
          boxShadow: '0 24px 64px rgba(0,0,0,0.13)',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          maxHeight: '92vh',              /* never taller than the viewport */
        }}>

          {/* Tab bar — top of card */}
          <StepTabs step={step} />

          {/* Scrollable form body */}
          <div style={{
            flex: 1, overflowY: 'auto',
            padding: '32px 40px 28px',
          }}>

            {/* Logo mark centred */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <img src="/Colored_Logo_Mark.svg" alt="" style={{ height: 38, width: 'auto' }} />
            </div>

            {/* ── STEP 1 ── */}
            {step === 1 && (
              <>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                  <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 5px' }}>
                    Create your account
                  </h1>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#9ca3af', margin: 0 }}>
                    Lets start with basic details
                  </p>
                </div>

                <form onSubmit={handleStep1} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Field error={errors.fullName}>
                    <input placeholder="Full name" value={form.fullName} onChange={set('fullName')} {...inp('fullName')} />
                  </Field>
                  <Field error={errors.email}>
                    <input type="email" placeholder="Email address" value={form.email} onChange={set('email')} {...inp('email')} />
                  </Field>
                  <Field error={errors.password}>
                    <input type="password" placeholder="Password" value={form.password} onChange={set('password')} {...inp('password')} />
                  </Field>
                  <Field error={errors.confirmPassword}>
                    <input type="password" placeholder="Confirm password" value={form.confirmPassword} onChange={set('confirmPassword')} {...inp('confirmPassword')} />
                  </Field>

                  <button type="submit" style={{
                    width: '100%', padding: '14px', backgroundColor: BLUE, color: '#fff',
                    border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600,
                    fontFamily: 'Inter, sans-serif', cursor: 'pointer', marginTop: 4,
                  }}>
                    Continue
                  </button>
                </form>
              </>
            )}

            {/* ── STEP 2 ── */}
            {step === 2 && (
              <>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                  <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 5px' }}>
                    Academic Profile
                  </h1>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#9ca3af', margin: 0 }}>
                    Tell us about your studies
                  </p>
                </div>

                <form onSubmit={handleStep2} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Field error={errors.idNumber}>
                    <label style={{ fontSize: 12, fontWeight: 500, color: '#6b7280', fontFamily: 'Inter, sans-serif' }}>Student / Lecturer ID</label>
                    <input placeholder="e.g. STU-2001" value={form.idNumber} onChange={set('idNumber')} autoComplete="off" {...inp('idNumber')} />
                    <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'Inter, sans-serif' }}>Use STU- for students or LEC- for lecturers.</span>
                  </Field>

                  {isStudent && (
                    <>
                      <Field error={errors.programme}>
                        <label style={{ fontSize: 12, fontWeight: 500, color: '#6b7280', fontFamily: 'Inter, sans-serif' }}>Programme</label>
                        <select value={form.programme} onChange={set('programme')} {...inp('programme')}>
                          <option value="">Select your programme</option>
                          {PROGRAMMES.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </Field>
                      <Field error={errors.level}>
                        <label style={{ fontSize: 12, fontWeight: 500, color: '#6b7280', fontFamily: 'Inter, sans-serif' }}>Level</label>
                        <select value={form.level} onChange={set('level')} {...inp('level')}>
                          <option value="">Select your level</option>
                          {LEVELS.map((l) => <option key={l} value={l}>Level {l}</option>)}
                        </select>
                      </Field>
                      <Field>
                        <label style={{ fontSize: 12, fontWeight: 500, color: '#6b7280', fontFamily: 'Inter, sans-serif' }}>
                          Academic Year <span style={{ color: '#d1d5db' }}>(optional)</span>
                        </label>
                        <input placeholder="e.g. 2025/2026" value={form.academicYear} onChange={set('academicYear')} style={inputBase} />
                      </Field>
                    </>
                  )}

                  {isLecturer && (
                    <p style={{ fontSize: 13, color: '#6b7280', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', fontFamily: 'Inter, sans-serif' }}>
                      You can add teaching assignments later from your profile.
                    </p>
                  )}

                  <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                    <button type="button" onClick={() => setStep(1)} style={{
                      flex: 1, padding: '13px', backgroundColor: '#fff', color: '#374151',
                      border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, fontWeight: 500,
                      fontFamily: 'Inter, sans-serif', cursor: 'pointer',
                    }}>← Back</button>
                    <button type="submit" style={{
                      flex: 2, padding: '13px', backgroundColor: BLUE, color: '#fff',
                      border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600,
                      fontFamily: 'Inter, sans-serif', cursor: 'pointer',
                    }}>Continue</button>
                  </div>
                </form>
              </>
            )}

            {/* ── STEP 3 ── */}
            {step === 3 && (
              <>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                  <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 5px' }}>
                    Review your details
                  </h1>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#9ca3af', margin: 0 }}>
                    Confirm everything looks right before creating your account.
                  </p>
                </div>

                <div style={{ backgroundColor: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: 12, padding: '14px 18px', marginBottom: 18 }}>
                  {reviewRows.map(({ label, value }) => (
                    <div key={label} style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: '1px solid #f0f0f0', fontFamily: 'Inter, sans-serif' }}>
                      <span style={{ fontSize: 12, color: '#9ca3af', width: 96, flexShrink: 0 }}>{label}</span>
                      <span style={{ fontSize: 13, color: '#111827', wordBreak: 'break-all' }}>{value}</span>
                    </div>
                  ))}
                </div>

                {apiError && (
                  <p style={{ color: '#ef4444', fontSize: 13, textAlign: 'center', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontFamily: 'Inter, sans-serif' }}>
                    {apiError}
                  </p>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" onClick={() => setStep(2)} style={{
                    flex: 1, padding: '13px', backgroundColor: '#fff', color: '#374151',
                    border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, fontWeight: 500,
                    fontFamily: 'Inter, sans-serif', cursor: 'pointer',
                  }}>← Back</button>
                  <button onClick={handleSubmit} disabled={isLoading} style={{
                    flex: 2, padding: '13px', backgroundColor: isLoading ? '#93aeff' : BLUE,
                    color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600,
                    fontFamily: 'Inter, sans-serif', cursor: isLoading ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                    {isLoading && (
                      <svg style={{ animation: 'spin 1s linear infinite', height: 16, width: 16 }} fill="none" viewBox="0 0 24 24">
                        <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                      </svg>
                    )}
                    {isLoading ? 'Creating…' : 'Create Account'}
                  </button>
                </div>
              </>
            )}

            {/* Sign in link */}
            <p style={{ textAlign: 'center', fontSize: 13, color: '#9ca3af', marginTop: 20, fontFamily: 'Inter, sans-serif' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: BLUE, fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
            </p>

          </div>
        </div>
      </div>
    </div>
  )
}
