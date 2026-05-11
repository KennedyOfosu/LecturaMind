import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { dashboardPath } from '../utils/roleGuard'

export default function Login() {
  const { login }   = useAuth()
  const navigate    = useNavigate()
  const [idNumber,  setIdNumber]  = useState('')
  const [password,  setPassword]  = useState('')
  const [error,     setError]     = useState('')
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
    /* Full-screen campus background */
    <div
      className="min-h-screen w-full bg-cover bg-center flex items-stretch p-8"
      style={{ backgroundImage: "url('/campus-bg.png')" }}
    >
      {/* Floating white card — left side, gap on all edges */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col justify-center px-12 py-14">

        {/* Logo */}
        <div className="flex justify-center mb-12">
          <svg width="40" height="32" viewBox="0 0 40 32" fill="none">
            <path d="M2 30L20 4L38 30" stroke="#111" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10 30L20 14L30 30" stroke="#111" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        {/* Heading */}
        <div className="text-center mb-10">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1.5">Welcome Back</h1>
          <p className="text-sm text-gray-400">Sign in to your LecturaMind account</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Enter ID"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value.toUpperCase())}
            autoComplete="off"
            className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-gray-400"
          />
          <input
            type="password"
            placeholder="Enter Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-gray-400"
          />
          {error && <p className="text-red-500 text-xs text-center">{error}</p>}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 mt-2 bg-gray-900 text-white rounded-xl font-medium text-sm hover:bg-gray-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
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

        <p className="text-center text-sm text-gray-400 mt-8">
          Don't have an account?{' '}
          <Link to="/register" className="text-gray-900 font-semibold hover:underline">
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  )
}
