/**
 * Login.jsx — ID number + password login with split-screen design.
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { dashboardPath } from '../utils/roleGuard'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [idNumber, setIdNumber] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

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
    <div className="min-h-screen flex">
      {/* Left — form panel */}
      <div className="w-full md:w-2/5 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="mb-10 text-center">
            <img src="/logo.svg" alt="LecturaMind" className="h-12 w-12 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">Welcome Back</h1>
            <p className="text-gray-500 text-sm mt-1">Sign in to your LecturaMind account</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* ID Number */}
            <div>
              <input
                type="text"
                placeholder="Enter ID number (e.g. LEC-1001)"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value.toUpperCase())}
                autoComplete="off"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50 bg-gray-50"
              />
            </div>

            {/* Password */}
            <div>
              <input
                type="password"
                placeholder="Enter Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50 bg-gray-50"
              />
            </div>

            {/* Error */}
            {error && (
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gray-900 text-white rounded-xl font-semibold text-sm hover:bg-gray-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
            >
              {isLoading && (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              Sign In
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-teal font-semibold hover:underline">
              Sign Up
            </Link>
          </p>
        </div>
      </div>

      {/* Right — background image panel */}
      <div
        className="hidden md:flex md:w-3/5 bg-cover bg-center relative"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1607237138185-eedd9c632b0b?w=1200&auto=format&fit=crop&q=80')" }}
      >
        <div className="absolute inset-0 bg-navy/30" />
        <div className="relative z-10 flex items-end p-12">
          <div className="text-white">
            <h2 className="text-4xl font-bold mb-2">LecturaMind</h2>
            <p className="text-white/80 text-lg">AI-Powered Teaching Assistant Platform</p>
          </div>
        </div>
      </div>
    </div>
  )
}
