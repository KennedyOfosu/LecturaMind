/**
 * AuthContext.jsx — Global authentication state.
 * Provides login, logout, register functions and the current user object.
 */

import { createContext, useState, useEffect, useCallback } from 'react'
import { authService } from '../services/authService'
import { dashboardPath } from '../utils/roleGuard'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('lm_user')) || null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(true)

  // Verify stored token on mount
  useEffect(() => {
    const token = localStorage.getItem('lm_token')
    if (!token) {
      setLoading(false)
      return
    }
    authService.me()
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem('lm_token')
        localStorage.removeItem('lm_user')
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email, password) => {
    const res = await authService.login({ email, password })
    const { token, user: userData } = res.data
    localStorage.setItem('lm_token', token)
    localStorage.setItem('lm_user', JSON.stringify(userData))
    setUser(userData)
    return userData
  }, [])

  const register = useCallback(async (formData) => {
    const res = await authService.register(formData)
    const { token, user: userData } = res.data
    localStorage.setItem('lm_token', token)
    localStorage.setItem('lm_user', JSON.stringify(userData))
    setUser(userData)
    return userData
  }, [])

  const logout = useCallback(async () => {
    try { await authService.logout() } catch { /* ignore */ }
    localStorage.removeItem('lm_token')
    localStorage.removeItem('lm_user')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  )
}
