/**
 * Register.jsx — Two-step registration form.
 * Step 1: Basic info (name, email, password).
 * Step 2: Institution ID number (role auto-detected from prefix).
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { dashboardPath } from '../utils/roleGuard'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [stepErrors, setStepErrors] = useState({})
  const [apiError, setApiError] = useState('')

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    idNumber: '',
  })

  const set = (field) => (e) => {
    const val = field === 'idNumber' ? e.target.value.toUpperCase() : e.target.value
    setForm((prev) => ({ ...prev, [field]: val }))
    setStepErrors((prev) => ({ ...prev, [field]: '' }))
  }

  // ── Step 1 validation ──
  const validateStep1 = () => {
    const errs = {}
    if (!form.fullName.trim()) errs.fullName = 'Full name is required.'
    if (!form.email.trim()) errs.email = 'Email address is required.'
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email address.'
    if (!form.password) errs.password = 'Password is required.'
    else if (form.password.length < 6) errs.password = 'Password must be at least 6 characters.'
    if (!form.confirmPassword) errs.confirmPassword = 'Please confirm your password.'
    else if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match.'
    setStepErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleContinue = (e) => {
    e.preventDefault()
    if (validateStep1()) setStep(2)
  }

  // ── Step 2 submission ──
  const handleSubmit = async (e) => {
    e.preventDefault()
    setApiError('')

    if (!form.idNumber.trim()) {
      setStepErrors({ idNumber: 'Institution ID number is required.' })
      return
    }

    setIsLoading(true)
    try {
      const user = await register(form.fullName, form.email, form.password, form.idNumber)
      navigate(dashboardPath(user.role))
    } catch (err) {
      setApiError(err.response?.data?.error || 'Registration failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const inputClass = (field) =>
    `w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-teal/50 bg-gray-50 ${
      stepErrors[field] ? 'border-red-400' : 'border-gray-200'
    }`

  return (
    <div className="min-h-screen flex">
      {/* Left — form panel */}
      <div className="w-full md:w-2/5 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="mb-8 text-center">
            <img src="/logo.svg" alt="LecturaMind" className="h-12 w-12 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
            <p className="text-gray-500 text-sm mt-1">Join LecturaMind today</p>
          </div>

          {/* ── STEP 1 ── */}
          <div className={step === 1 ? 'block' : 'hidden'}>
            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-6">
              <div className="h-2 flex-1 rounded-full bg-teal" />
              <div className="h-2 flex-1 rounded-full bg-gray-200" />
              <span className="text-xs text-gray-400 ml-1">Step 1 of 2</span>
            </div>

            <form onSubmit={handleContinue} className="flex flex-col gap-4">
              <div>
                <input
                  type="text"
                  placeholder="Full name"
                  value={form.fullName}
                  onChange={set('fullName')}
                  className={inputClass('fullName')}
                />
                {stepErrors.fullName && <p className="text-red-500 text-xs mt-1">{stepErrors.fullName}</p>}
              </div>

              <div>
                <input
                  type="email"
                  placeholder="Email address"
                  value={form.email}
                  onChange={set('email')}
                  className={inputClass('email')}
                />
                {stepErrors.email && <p className="text-red-500 text-xs mt-1">{stepErrors.email}</p>}
              </div>

              <div>
                <input
                  type="password"
                  placeholder="Password"
                  value={form.password}
                  onChange={set('password')}
                  className={inputClass('password')}
                />
                {stepErrors.password && <p className="text-red-500 text-xs mt-1">{stepErrors.password}</p>}
              </div>

              <div>
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={form.confirmPassword}
                  onChange={set('confirmPassword')}
                  className={inputClass('confirmPassword')}
                />
                {stepErrors.confirmPassword && <p className="text-red-500 text-xs mt-1">{stepErrors.confirmPassword}</p>}
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-gray-900 text-white rounded-xl font-semibold text-sm hover:bg-gray-800 transition-colors mt-2"
              >
                Continue →
              </button>
            </form>
          </div>

          {/* ── STEP 2 ── */}
          <div className={step === 2 ? 'block' : 'hidden'}>
            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-6">
              <div className="h-2 flex-1 rounded-full bg-teal" />
              <div className="h-2 flex-1 rounded-full bg-teal" />
              <span className="text-xs text-gray-400 ml-1">Step 2 of 2</span>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Institution ID Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. LEC-1001 or STU-2001"
                  value={form.idNumber}
                  onChange={set('idNumber')}
                  autoComplete="off"
                  className={inputClass('idNumber')}
                />
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                  Your ID number was provided by your institution. It tells the system whether you are a Lecturer or a Student.
                </p>
                {stepErrors.idNumber && <p className="text-red-500 text-xs mt-1">{stepErrors.idNumber}</p>}
                {apiError && <p className="text-red-500 text-xs mt-2">{apiError}</p>}
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => { setStep(1); setApiError('') }}
                  className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-semibold text-sm hover:bg-gray-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isLoading && (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  )}
                  {isLoading ? 'Creating…' : 'Verify & Create Account'}
                </button>
              </div>
            </form>
          </div>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-teal font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Right — background image panel */}
      <div
        className="hidden md:flex md:w-3/5 bg-cover bg-center relative"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=1200&auto=format&fit=crop&q=80')" }}
      >
        <div className="absolute inset-0 bg-navy/30" />
        <div className="relative z-10 flex items-end p-12">
          <div className="text-white">
            <h2 className="text-4xl font-bold mb-2">LecturaMind</h2>
            <p className="text-white/80 text-lg">AI-Powered Teaching Assistant Platform</p>
            <p className="text-white/60 text-sm mt-1">SIIMT University College · Accra, Ghana</p>
          </div>
        </div>
      </div>
    </div>
  )
}
