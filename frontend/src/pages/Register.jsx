/**
 * Register.jsx — Exact match to Sign Up Page.jpg (Step 1) and Sign Up Page 2.jpg (Step 2).
 * White card left, library background, two-step form.
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { dashboardPath } from '../utils/roleGuard'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [step, setStep]         = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors]     = useState({})
  const [apiError, setApiError] = useState('')

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    idNumber: '',
  })

  const set = (field) => (e) => {
    const val = field === 'idNumber' ? e.target.value.toUpperCase() : e.target.value
    setForm((prev) => ({ ...prev, [field]: val }))
    setErrors((prev) => ({ ...prev, [field]: '' }))
    setApiError('')
  }

  /* ── Step 1 validation ── */
  const validateStep1 = () => {
    const errs = {}
    if (!form.fullName.trim()) errs.fullName = 'Full name is required.'
    if (!form.email.trim()) errs.email = 'Email address is required.'
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email.'
    if (!form.password) errs.password = 'Password is required.'
    else if (form.password.length < 6) errs.password = 'Minimum 6 characters.'
    setErrors(errs)
    return !Object.keys(errs).length
  }

  const handleContinue = (e) => {
    e.preventDefault()
    if (validateStep1()) setStep(2)
  }

  /* ── Step 2 submission ── */
  const handleSubmit = async (e) => {
    e.preventDefault()
    setApiError('')
    if (!form.idNumber.trim()) {
      setErrors({ idNumber: 'Please enter your institution ID.' })
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

  /* Shared input style */
  const inputClass = (field) =>
    `w-full px-4 py-3 rounded-xl border bg-gray-50 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 ${
      errors[field] ? 'border-red-300 bg-red-50' : 'border-gray-200'
    }`

  /* Logo mark SVG */
  const LogoMark = () => (
    <div className="flex justify-center mb-10">
      <svg width="36" height="28" viewBox="0 0 36 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 26L18 4L34 26" stroke="#111111" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M9 26L18 12L27 26" stroke="#111111" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )

  return (
    /* Full-screen background — library image */
    <div
      className="min-h-screen w-full bg-cover bg-center flex items-center"
      style={{ backgroundImage: "url('/library-bg.png')" }}
    >
      {/* White card — left side */}
      <div className="bg-white rounded-2xl shadow-xl mx-8 md:mx-16 w-full max-w-sm p-10 flex flex-col">

        {/* ── STEP 1: Create your account ── */}
        <div className={step === 1 ? 'flex flex-col' : 'hidden'}>
          <LogoMark />

          <h1 className="text-2xl font-semibold text-gray-900 text-center mb-1">
            Create your account
          </h1>
          <p className="text-sm text-gray-400 text-center mb-8">Join LecturaMind today</p>

          <form onSubmit={handleContinue} className="flex flex-col gap-3">
            <div>
              <input
                type="text"
                placeholder="Full name"
                value={form.fullName}
                onChange={set('fullName')}
                className={inputClass('fullName')}
              />
              {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>}
            </div>

            <div>
              <input
                type="email"
                placeholder="Email address"
                value={form.email}
                onChange={set('email')}
                className={inputClass('email')}
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>

            <div>
              <input
                type="password"
                placeholder="Password"
                value={form.password}
                onChange={set('password')}
                className={inputClass('password')}
              />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            </div>

            <button
              type="submit"
              className="w-full py-3 mt-2 bg-gray-900 text-white rounded-xl font-medium text-sm hover:bg-gray-800 transition-colors"
            >
              Continue
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-gray-800 font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        {/* ── STEP 2: Enter Your ID ── */}
        <div className={step === 2 ? 'flex flex-col' : 'hidden'}>
          <LogoMark />

          <h1 className="text-2xl font-semibold text-gray-900 text-center mb-1">
            Enter Your ID
          </h1>
          <p className="text-sm text-gray-400 text-center mb-8 leading-relaxed">
            In LecturaMind your ID tells us who you are.{' '}
            <span className="block">Never share your ID.</span>
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <input
                type="text"
                placeholder="Enter ID"
                value={form.idNumber}
                onChange={set('idNumber')}
                autoComplete="off"
                className={inputClass('idNumber')}
              />
              {errors.idNumber && <p className="text-red-500 text-xs mt-1">{errors.idNumber}</p>}
              {apiError && <p className="text-red-500 text-xs mt-2 text-center">{apiError}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 mt-2 bg-gray-900 text-white rounded-xl font-medium text-sm hover:bg-gray-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isLoading && (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              )}
              {isLoading ? 'Creating account…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            Already have an account?{' '}
            <button
              onClick={() => { setStep(1); setApiError('') }}
              className="text-gray-800 font-semibold hover:underline"
            >
              Sign in
            </button>
          </p>
        </div>

      </div>
    </div>
  )
}
