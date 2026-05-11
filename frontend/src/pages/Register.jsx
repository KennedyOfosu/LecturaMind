/**
 * Register.jsx — Exact replica of Sign Up Page.jpg and Sign Up Page 2.jpg.
 * Full-height white card on the left, library background fills the right.
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { dashboardPath } from '../utils/roleGuard'

const LogoMark = () => (
  <div className="flex justify-center mb-14">
    <svg width="40" height="32" viewBox="0 0 40 32" fill="none">
      <path d="M2 30L20 4L38 30" stroke="#111" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 30L20 14L30 30" stroke="#111" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </div>
)

export default function Register() {
  const { register } = useAuth()
  const navigate     = useNavigate()

  const [step,      setStep]      = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [errors,    setErrors]    = useState({})
  const [apiError,  setApiError]  = useState('')

  const [form, setForm] = useState({
    fullName: '',
    email:    '',
    password: '',
    idNumber: '',
  })

  const set = (field) => (e) => {
    const val = field === 'idNumber' ? e.target.value.toUpperCase() : e.target.value
    setForm((prev) => ({ ...prev, [field]: val }))
    setErrors((prev) => ({ ...prev, [field]: '' }))
    setApiError('')
  }

  const validateStep1 = () => {
    const errs = {}
    if (!form.fullName.trim())  errs.fullName = 'Full name is required.'
    if (!form.email.trim())     errs.email    = 'Email address is required.'
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email.'
    if (!form.password)         errs.password = 'Password is required.'
    else if (form.password.length < 6) errs.password = 'Minimum 6 characters.'
    setErrors(errs)
    return !Object.keys(errs).length
  }

  const handleContinue = (e) => {
    e.preventDefault()
    if (validateStep1()) setStep(2)
  }

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

  const inputClass = (field) =>
    `w-full px-4 py-3.5 rounded-xl border text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-gray-400 ${
      errors[field] ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'
    }`

  return (
    <div className="flex min-h-screen">

      {/* ── Left panel: full-height white card ── */}
      <div className="relative z-10 flex flex-col justify-center px-14 py-16 bg-white w-full max-w-md min-h-screen shadow-2xl">

        {/* ── STEP 1: Create your account ── */}
        <div className={step === 1 ? 'flex flex-col' : 'hidden'}>
          <LogoMark />

          <div className="mb-10 text-center">
            <h1 className="text-2xl font-semibold text-gray-900 mb-1.5">Create your account</h1>
            <p className="text-sm text-gray-400">Join LecturaMind today</p>
          </div>

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
              className="w-full py-3.5 mt-3 bg-gray-900 text-white rounded-xl font-medium text-sm hover:bg-gray-800 transition-colors"
            >
              Continue
            </button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-8">
            Already have an account?{' '}
            <Link to="/login" className="text-gray-900 font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        {/* ── STEP 2: Enter Your ID ── */}
        <div className={step === 2 ? 'flex flex-col' : 'hidden'}>
          <LogoMark />

          <div className="mb-10 text-center">
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Enter Your ID</h1>
            <p className="text-sm text-gray-400 leading-relaxed">
              In LecturaMind your ID tells us who you are.<br />Never share your ID.
            </p>
          </div>

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
              {apiError        && <p className="text-red-500 text-xs mt-2 text-center">{apiError}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 mt-3 bg-gray-900 text-white rounded-xl font-medium text-sm hover:bg-gray-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
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

          <p className="text-center text-sm text-gray-400 mt-8">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => { setStep(1); setApiError('') }}
              className="text-gray-900 font-semibold hover:underline"
            >
              Sign in
            </button>
          </p>
        </div>

      </div>

      {/* ── Right panel: full-height library background image ── */}
      <div
        className="flex-1 bg-cover bg-center"
        style={{ backgroundImage: "url('/library-bg.png')" }}
      />
    </div>
  )
}
