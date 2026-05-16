/**
 * Register.jsx — 3-step registration redesigned to match Figma.
 * Left : Signup_Page.jpg bg + Group 160.png character + Tusker Grotesk headline
 * Right: white panel with tab progress + form steps
 * All existing form logic (validation, API call) is preserved.
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { dashboardPath } from '../utils/roleGuard'
import { PROGRAMMES, LEVELS } from '../utils/constants'

const BLUE = '#2e54fe'

/* ── shared input style ─────────────────────────────────────── */
const inputBase = {
  width: '100%',
  padding: '13px 16px',
  borderRadius: '10px',
  border: '1.5px solid #e5e7eb',
  backgroundColor: '#fff',
  fontSize: '14px',
  color: '#1a1a1a',
  outline: 'none',
  fontFamily: 'Inter, sans-serif',
}
const inputErr = { ...inputBase, borderColor: '#fca5a5', backgroundColor: '#fff5f5' }

/* ── Step tab bar ───────────────────────────────────────────── */
function StepTabs({ step }) {
  const tabs = ['Basic Info', 'Academic Profile', 'Review']
  return (
    <div style={{ display: 'flex', borderBottom: '1.5px solid #f0f0f0' }}>
      {tabs.map((label, i) => {
        const num   = i + 1
        const active = step === num
        const done   = step > num
        return (
          <div
            key={label}
            style={{
              flex: 1,
              padding: '14px 0',
              textAlign: 'center',
              fontSize: '13px',
              fontWeight: active ? 600 : 400,
              color: active ? BLUE : done ? '#6b7280' : '#9ca3af',
              fontFamily: 'Inter, sans-serif',
              borderTop: `3px solid ${active ? BLUE : 'transparent'}`,
              cursor: 'default',
            }}
          >
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
      {error && <span style={{ color: '#ef4444', fontSize: 11 }}>{error}</span>}
    </div>
  )
}

/* ── Blue action button ─────────────────────────────────────── */
function BlueBtn({ children, disabled, onClick, type = 'submit' }) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: '100%',
        padding: '14px',
        backgroundColor: disabled ? '#93aeff' : BLUE,
        color: '#fff',
        border: 'none',
        borderRadius: '10px',
        fontSize: '15px',
        fontWeight: 600,
        fontFamily: 'Inter, sans-serif',
        cursor: disabled ? 'not-allowed' : 'pointer',
        marginTop: '6px',
      }}
    >
      {children}
    </button>
  )
}

/* ── Outline back button ────────────────────────────────────── */
function BackBtn({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: '13px',
        backgroundColor: '#fff',
        color: '#374151',
        border: '1.5px solid #e5e7eb',
        borderRadius: '10px',
        fontSize: '14px',
        fontWeight: 500,
        fontFamily: 'Inter, sans-serif',
        cursor: 'pointer',
      }}
    >
      ← Back
    </button>
  )
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
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
    const errs = {}
    if (!form.fullName.trim())           errs.fullName        = 'Full name is required.'
    if (!form.email.trim())              errs.email           = 'Email is required.'
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email    = 'Enter a valid email.'
    if (!form.password)                  errs.password        = 'Password is required.'
    else if (form.password.length < 6)   errs.password        = 'At least 6 characters.'
    if (!form.confirmPassword)           errs.confirmPassword = 'Please confirm your password.'
    else if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match.'
    setErrors(errs); return !Object.keys(errs).length
  }

  const validateStep2 = () => {
    const errs = {}
    if (!form.idNumber.trim()) errs.idNumber = 'ID number is required.'
    else if (!form.idNumber.startsWith('STU-') && !form.idNumber.startsWith('LEC-'))
      errs.idNumber = 'ID must start with STU- or LEC-.'
    if (isStudent) {
      if (!form.programme) errs.programme = 'Select your programme.'
      if (!form.level)     errs.level     = 'Select your level.'
    }
    setErrors(errs); return !Object.keys(errs).length
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

  const reviewRows = [
    { label: 'Name',      value: form.fullName  },
    { label: 'Email',     value: form.email     },
    { label: 'ID Number', value: form.idNumber  },
    isStudent && { label: 'Programme', value: form.programme },
    isStudent && { label: 'Level',     value: form.level ? `Level ${form.level}` : '' },
    isStudent && form.academicYear && { label: 'Academic Year', value: form.academicYear },
  ].filter(Boolean)

  const inp = (f) => ({ style: errors[f] ? inputErr : inputBase })

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>

      {/* ══ LEFT — background + character + headline ══════════ */}
      <div
        style={{
          position: 'relative',
          width: '55%',
          height: '100%',
          backgroundImage: "url('/Signup_Page.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          overflow: 'hidden',
        }}
      >
        {/* Logo mark — top left */}
        <img
          src="/Colored_Logo_Mark.svg"
          alt="LecturaMind"
          style={{
            position: 'absolute',
            top: 36,
            left: 48,
            height: 44,
            width: 'auto',
          }}
        />

        {/* Character — Group 160.png, left-center */}
        <img
          src="/Group%20160.png"
          alt="Lecturer"
          style={{
            position: 'absolute',
            bottom: 0,
            left: '0%',
            height: '88%',
            width: 'auto',
            objectFit: 'contain',
            objectPosition: 'bottom left',
          }}
        />

        {/* Headline + subtitle — bottom-left above character */}
        <div
          style={{
            position: 'absolute',
            bottom: 80,
            left: '38%',
            right: 0,
            padding: '0 32px 0 0',
          }}
        >
          <p
            style={{
              fontFamily: "'Tusker Grotesk', sans-serif",
              fontWeight: 800,
              fontSize: 'clamp(2.2rem, 4.5vw, 4rem)',
              color: BLUE,
              lineHeight: 1.05,
              margin: '0 0 14px 0',
            }}
          >
            Teaching,<br />Reimagined
          </p>
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 14,
              color: '#374151',
              lineHeight: 1.6,
              margin: 0,
              maxWidth: 320,
            }}
          >
            An AI-powered platform designed to support lecturers,
            engage students, and modernize higher education.
          </p>
        </div>
      </div>

      {/* ══ RIGHT — white form panel ══════════════════════════ */}
      <div
        style={{
          width: '45%',
          height: '100%',
          backgroundColor: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        {/* Step tabs — pinned to top of the panel */}
        <StepTabs step={step} />

        {/* Form content — scrollable, centered */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 48px',
          }}
        >
          <div style={{ width: '100%', maxWidth: 420 }}>

            {/* Logo mark */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
              <img
                src="/Colored_Logo_Mark.svg"
                alt="LecturaMind"
                style={{ height: 42, width: 'auto' }}
              />
            </div>

            {/* ── STEP 1 — Basic Info ── */}
            {step === 1 && (
              <>
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                  <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: 24, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>
                    Create your account
                  </h1>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#9ca3af', margin: 0 }}>
                    Lets start with basic details
                  </p>
                </div>

                <form onSubmit={handleStep1} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                  <BlueBtn>Continue</BlueBtn>
                </form>
              </>
            )}

            {/* ── STEP 2 — Academic Profile ── */}
            {step === 2 && (
              <>
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                  <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: 24, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>
                    Academic Profile
                  </h1>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#9ca3af', margin: 0 }}>
                    Tell us about your studies
                  </p>
                </div>

                <form onSubmit={handleStep2} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <Field error={errors.idNumber}>
                    <label style={{ fontSize: 12, fontWeight: 500, color: '#6b7280', fontFamily: 'Inter, sans-serif' }}>
                      Student / Lecturer ID
                    </label>
                    <input placeholder="e.g. STU-2001" value={form.idNumber} onChange={set('idNumber')} autoComplete="off" {...inp('idNumber')} />
                    <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'Inter, sans-serif' }}>
                      Use STU- for students or LEC- for lecturers.
                    </span>
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

                  <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                    <BackBtn onClick={() => setStep(1)} />
                    <button type="submit" style={{ flex: 2, padding: '13px', backgroundColor: BLUE, color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                      Continue
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* ── STEP 3 — Review ── */}
            {step === 3 && (
              <>
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                  <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: 24, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>
                    Review your details
                  </h1>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#9ca3af', margin: 0 }}>
                    Confirm everything looks right before creating your account.
                  </p>
                </div>

                <div style={{ backgroundColor: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
                  {reviewRows.map(({ label, value }) => (
                    <div key={label} style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: '1px solid #f0f0f0', fontFamily: 'Inter, sans-serif' }}>
                      <span style={{ fontSize: 12, color: '#9ca3af', width: 100, flexShrink: 0 }}>{label}</span>
                      <span style={{ fontSize: 13, color: '#111827', wordBreak: 'break-all' }}>{value}</span>
                    </div>
                  ))}
                </div>

                {apiError && (
                  <p style={{ color: '#ef4444', fontSize: 13, textAlign: 'center', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontFamily: 'Inter, sans-serif' }}>
                    {apiError}
                  </p>
                )}

                <div style={{ display: 'flex', gap: 12 }}>
                  <BackBtn onClick={() => setStep(2)} />
                  <button
                    onClick={handleSubmit}
                    disabled={isLoading}
                    style={{ flex: 2, padding: '13px', backgroundColor: isLoading ? '#93aeff' : BLUE, color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: isLoading ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
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
            <p style={{ textAlign: 'center', fontSize: 13, color: '#9ca3af', marginTop: 24, fontFamily: 'Inter, sans-serif' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: BLUE, fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
            </p>

          </div>
        </div>
      </div>
    </div>
  )
}
