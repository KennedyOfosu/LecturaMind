/**
 * Register.jsx — 3-step registration form.
 * Step 1: Basic info (name, email, password, confirm)
 * Step 2: Academic profile (ID, programme, level, academic year)
 * Step 3: Review & Create Account
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { dashboardPath } from '../utils/roleGuard'
import { PROGRAMMES, LEVELS } from '../utils/constants'

const LogoMark = () => (
  <div className="flex justify-center mb-10">
    <svg width="40" height="32" viewBox="0 0 40 32" fill="none">
      <path d="M2 30L20 4L38 30" stroke="#111" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 30L20 14L30 30" stroke="#111" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </div>
)

/* Step progress indicator */
function StepIndicator({ step }) {
  const steps = [
    { num: 1, label: 'Basic Info' },
    { num: 2, label: 'Academic Profile' },
    { num: 3, label: 'Review' },
  ]
  return (
    <div className="flex items-center justify-between mb-8 w-full">
      {steps.map((s, i) => (
        <div key={s.num} className="flex items-center flex-1">
          <div className="flex flex-col items-center">
            <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
              step >= s.num ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-400'
            }`}>
              {step > s.num ? '✓' : s.num}
            </div>
            <span className={`text-[10px] mt-1 ${step >= s.num ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 -mt-4 ${step > s.num ? 'bg-gray-900' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

export default function Register() {
  const { register } = useAuth()
  const navigate     = useNavigate()

  const [step,       setStep]      = useState(1)
  const [isLoading,  setIsLoading] = useState(false)
  const [errors,     setErrors]    = useState({})
  const [apiError,   setApiError]  = useState('')

  const [form, setForm] = useState({
    fullName:        '',
    email:           '',
    password:        '',
    confirmPassword: '',
    idNumber:        '',
    programme:       '',
    level:           '',
    academicYear:    '',
  })

  const isStudent = form.idNumber.startsWith('STU-')
  const isLecturer = form.idNumber.startsWith('LEC-')

  const set = (field) => (e) => {
    const val = field === 'idNumber' ? e.target.value.toUpperCase() : e.target.value
    setForm((p) => ({ ...p, [field]: val }))
    setErrors((p) => ({ ...p, [field]: '' }))
    setApiError('')
  }

  /* ── Step 1 validation ── */
  const validateStep1 = () => {
    const errs = {}
    if (!form.fullName.trim()) errs.fullName = 'Full name is required.'
    if (!form.email.trim()) errs.email = 'Email is required.'
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email.'
    if (!form.password) errs.password = 'Password is required.'
    else if (form.password.length < 6) errs.password = 'Password must be at least 6 characters.'
    if (!form.confirmPassword) errs.confirmPassword = 'Please confirm your password.'
    else if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match.'
    setErrors(errs)
    return !Object.keys(errs).length
  }

  /* ── Step 2 validation ── */
  const validateStep2 = () => {
    const errs = {}
    if (!form.idNumber.trim()) errs.idNumber = 'ID number is required.'
    else if (!form.idNumber.startsWith('STU-') && !form.idNumber.startsWith('LEC-')) {
      errs.idNumber = 'ID must start with STU- or LEC-.'
    }
    if (isStudent) {
      if (!form.programme) errs.programme = 'Please select your programme.'
      if (!form.level)     errs.level     = 'Please select your level.'
    }
    setErrors(errs)
    return !Object.keys(errs).length
  }

  const handleStep1 = (e) => {
    e.preventDefault()
    if (validateStep1()) setStep(2)
  }

  const handleStep2 = (e) => {
    e.preventDefault()
    if (validateStep2()) setStep(3)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setApiError('')
    setIsLoading(true)
    try {
      const payload = {
        full_name: form.fullName,
        email:     form.email,
        password:  form.password,
        id_number: form.idNumber,
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
    } finally {
      setIsLoading(false)
    }
  }

  const inputCls = (f) =>
    `w-full px-4 py-3 rounded-xl border text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-gray-400 ${
      errors[f] ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'
    }`

  /* Map labels for review */
  const reviewRows = [
    { label: 'Name',       value: form.fullName },
    { label: 'Email',      value: form.email },
    { label: 'ID Number',  value: form.idNumber },
    isStudent && { label: 'Programme', value: form.programme },
    isStudent && { label: 'Level',     value: form.level ? `Level ${form.level}` : '' },
    isStudent && form.academicYear && { label: 'Academic Year', value: form.academicYear },
  ].filter(Boolean)

  return (
    <div className="min-h-screen w-full bg-cover bg-center flex items-stretch p-8"
      style={{ backgroundImage: "url('/library-bg.png')" }}>

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col justify-center px-12 py-14 overflow-y-auto">

        <LogoMark />

        <StepIndicator step={step} />

        {/* ── STEP 1 ── */}
        <div className={step === 1 ? 'flex flex-col' : 'hidden'}>
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-gray-900 mb-1.5">Create your account</h1>
            <p className="text-sm text-gray-400">Let's start with your basic details</p>
          </div>

          <form onSubmit={handleStep1} className="flex flex-col gap-3">
            <div>
              <input type="text" placeholder="Full name" value={form.fullName}
                onChange={set('fullName')} className={inputCls('fullName')} />
              {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>}
            </div>
            <div>
              <input type="email" placeholder="Email address" value={form.email}
                onChange={set('email')} className={inputCls('email')} />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>
            <div>
              <input type="password" placeholder="Password" value={form.password}
                onChange={set('password')} className={inputCls('password')} />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            </div>
            <div>
              <input type="password" placeholder="Confirm password" value={form.confirmPassword}
                onChange={set('confirmPassword')} className={inputCls('confirmPassword')} />
              {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
            </div>

            <button type="submit"
              className="w-full py-3 mt-3 bg-gray-900 text-white rounded-xl font-medium text-sm hover:bg-gray-800 transition-colors">
              Continue →
            </button>
          </form>
        </div>

        {/* ── STEP 2 ── */}
        <div className={step === 2 ? 'flex flex-col' : 'hidden'}>
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-gray-900 mb-1.5">Academic Profile</h1>
            <p className="text-sm text-gray-400">Tell us about your studies</p>
          </div>

          <form onSubmit={handleStep2} className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Student / Lecturer ID</label>
              <input type="text" placeholder="e.g. STU-2001" value={form.idNumber}
                onChange={set('idNumber')} autoComplete="off" className={inputCls('idNumber')} />
              <p className="text-xs text-gray-400 mt-1">
                Your ID was provided by your institution. Use STU- for students or LEC- for lecturers.
              </p>
              {errors.idNumber && <p className="text-red-500 text-xs mt-1">{errors.idNumber}</p>}
            </div>

            {/* Show programme/level only for students */}
            {isStudent && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">What are you studying?</label>
                  <select value={form.programme} onChange={set('programme')} className={inputCls('programme')}>
                    <option value="">Select your programme</option>
                    {PROGRAMMES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  {errors.programme && <p className="text-red-500 text-xs mt-1">{errors.programme}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">What level are you currently in?</label>
                  <select value={form.level} onChange={set('level')} className={inputCls('level')}>
                    <option value="">Select your level</option>
                    {LEVELS.map((l) => <option key={l} value={l}>Level {l}</option>)}
                  </select>
                  {errors.level && <p className="text-red-500 text-xs mt-1">{errors.level}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Academic Year (optional)</label>
                  <input type="text" placeholder="e.g. 2025/2026" value={form.academicYear}
                    onChange={set('academicYear')} className={inputCls('academicYear')} />
                </div>
              </>
            )}

            {isLecturer && (
              <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                You can add teaching assignments later from your profile.
              </p>
            )}

            <div className="flex gap-3 mt-3">
              <button type="button" onClick={() => setStep(1)}
                className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                ← Back
              </button>
              <button type="submit"
                className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-medium text-sm hover:bg-gray-800 transition-colors">
                Continue →
              </button>
            </div>
          </form>
        </div>

        {/* ── STEP 3 ── */}
        <div className={step === 3 ? 'flex flex-col' : 'hidden'}>
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-gray-900 mb-1.5">Review your details</h1>
            <p className="text-sm text-gray-400 leading-relaxed">
              Please review your details before creating your account.{' '}
              {isStudent && <span>You can update your level and programme later from your profile.</span>}
            </p>
          </div>

          {/* Summary */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
            <dl className="flex flex-col gap-2 text-sm">
              {reviewRows.map(({ label, value }) => (
                <div key={label} className="flex items-baseline gap-3">
                  <dt className="text-xs font-medium text-gray-400 w-24 shrink-0">{label}:</dt>
                  <dd className="text-gray-800 break-all">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {apiError && (
            <p className="text-red-500 text-xs text-center mb-3 bg-red-50 rounded-lg px-3 py-2">{apiError}</p>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(2)}
              className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              ← Back
            </button>
            <button onClick={handleSubmit} disabled={isLoading}
              className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-medium text-sm hover:bg-gray-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {isLoading && (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              )}
              {isLoading ? 'Creating…' : 'Create Account'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-gray-800 font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
