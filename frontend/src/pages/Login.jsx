/**
 * Login.jsx — Exact match to Login Page.jpg design.
 * White card left, autumn campus background, ID + Password login.
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
  const [error, setError]       = useState('')
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
    /* Full-screen background — campus image */
    <div
      className="min-h-screen w-full bg-cover bg-center flex items-center"
      style={{ backgroundImage: "url('/campus-bg.png')" }}
    >
      {/* White card — left side */}
      <div className="bg-white rounded-2xl shadow-xl mx-8 md:mx-16 w-full max-w-xs p-10 flex flex-col">

        {/* Logo mark */}
        <div className="flex justify-center mb-10">
          <svg width="36" height="28" viewBox="0 0 36 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 26L18 4L34 26" stroke="#111111" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M9 26L18 12L27 26" stroke="#111111" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-semibold text-gray-900 text-center mb-1">Welcome Back</h1>
        <p className="text-sm text-gray-400 text-center mb-8">Sign in to your LecturaMind account</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* ID input */}
          <input
            type="text"
            placeholder="Enter ID"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value.toUpperCase())}
            autoComplete="off"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
          />

          {/* Password input */}
          <input
            type="password"
            placeholder="Enter Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
          />

          {/* Error */}
          {error && <p className="text-red-500 text-xs text-center">{error}</p>}

          {/* Sign In button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 mt-1 bg-gray-900 text-white rounded-xl font-medium text-sm hover:bg-gray-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isLoading && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
            )}
            Sign In
          </button>
        </form>

        {/* Sign up link */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-gray-800 font-semibold hover:underline">
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  )
}
