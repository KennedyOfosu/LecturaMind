/**
 * AuthContext.jsx — Global auth state using ID-number based login.
 * Token and user are persisted in localStorage for page-refresh survival.
 */

import { createContext, useState, useEffect, useCallback } from 'react'
import { authService } from '../services/authService'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lm_user')) || null } catch { return null }
  })
  const [loading, setLoading] = useState(true)

  // Restore session on mount
  useEffect(() => {
    const token = localStorage.getItem('lm_token')
    if (!token) { setLoading(false); return }
    authService.me()
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem('lm_token')
        localStorage.removeItem('lm_user')
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (idNumber, password) => {
    const res = await authService.login({ id_number: idNumber, password })
    const { token, user: userData } = res.data
    localStorage.setItem('lm_token', token)
    localStorage.setItem('lm_user', JSON.stringify(userData))
    setUser(userData)
    return userData
  }, [])

  const register = useCallback(async (payload) => {
    // Accepts: { full_name, email, password, id_number, programme?, level?, academic_year? }
    const res = await authService.register(payload)
    const { token, user: userData } = res.data
    localStorage.setItem('lm_token', token)
    localStorage.setItem('lm_user', JSON.stringify(userData))
    setUser(userData)
    return userData
  }, [])

  const refreshUser = useCallback(async () => {
    const res = await authService.me()
    const merged = { ...user, ...res.data }
    localStorage.setItem('lm_user', JSON.stringify(merged))
    setUser(merged)
    return merged
  }, [user])

  const logout = useCallback(async () => {
    try { await authService.logout() } catch { /* ignore */ }
    localStorage.removeItem('lm_token')
    localStorage.removeItem('lm_user')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}
