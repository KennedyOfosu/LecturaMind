/**
 * AuthContext.jsx — Global auth state using ID-number based login.
 * Token and user are persisted in localStorage for page-refresh survival.
 */

import { createContext, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService } from '../services/authService'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'

export const AuthContext = createContext(null)

const SESSION_EXIT_SECONDS = 120

export function AuthProvider({ children }) {
  const navigate = useNavigate()
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lm_user')) || null } catch { return null }
  })
  const [token, setToken] = useState(() => localStorage.getItem('lm_token'))
  const [loading, setLoading] = useState(true)
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [sessionPromptOpen, setSessionPromptOpen] = useState(false)
  const [sessionSecondsLeft, setSessionSecondsLeft] = useState(SESSION_EXIT_SECONDS)
  const [checkingSession, setCheckingSession] = useState(false)

  const clearSession = useCallback(() => {
    localStorage.removeItem('lm_token')
    localStorage.removeItem('lm_user')
    setUser(null)
    setToken(null)
  }, [])

  const finishSession = useCallback(async () => {
    setSessionPromptOpen(false)
    setCheckingSession(false)
    try { await authService.logout({ skipAuthPrompt: true }) } catch { /* ignore */ }
    clearSession()
    navigate('/login', { replace: true })
  }, [clearSession, navigate])

  // Restore session on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('lm_token')
    if (!storedToken) {
      setLoading(false)
      setIsAuthReady(true)
      return
    }
    setToken(storedToken)
    authService.me({ skipAuthPrompt: true })
      .then((res) => setUser(res.data))
      .catch(() => {
        clearSession()
      })
      .finally(() => {
        setLoading(false)
        setIsAuthReady(true)
      })
  }, [clearSession])

  useEffect(() => {
    const handler = () => {
      if (!localStorage.getItem('lm_token')) return
      setSessionSecondsLeft(SESSION_EXIT_SECONDS)
      setSessionPromptOpen(true)
    }
    window.addEventListener('lecturamind:session-expiring', handler)
    return () => window.removeEventListener('lecturamind:session-expiring', handler)
  }, [])

  useEffect(() => {
    if (!sessionPromptOpen) return undefined
    const tick = setInterval(() => {
      setSessionSecondsLeft((seconds) => {
        return Math.max(0, seconds - 1)
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [sessionPromptOpen])

  useEffect(() => {
    if (sessionPromptOpen && sessionSecondsLeft === 0) {
      finishSession()
    }
  }, [finishSession, sessionPromptOpen, sessionSecondsLeft])

  const login = useCallback(async (idNumber, password) => {
    const res = await authService.login({ id_number: idNumber, password })
    const { token: tok, user: userData } = res.data
    localStorage.setItem('lm_token', tok)
    localStorage.setItem('lm_user', JSON.stringify(userData))
    setToken(tok)
    setUser(userData)
    setSessionPromptOpen(false)
    return userData
  }, [])

  const register = useCallback(async (payload) => {
    // Accepts: { full_name, email, password, id_number, programme?, level?, academic_year? }
    const res = await authService.register(payload)
    const { token: tok, user: userData } = res.data
    localStorage.setItem('lm_token', tok)
    localStorage.setItem('lm_user', JSON.stringify(userData))
    setToken(tok)
    setUser(userData)
    setSessionPromptOpen(false)
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
    await finishSession()
  }, [finishSession])

  const continueSession = useCallback(async () => {
    setCheckingSession(true)
    try {
      const res = await authService.me({ skipAuthPrompt: true })
      localStorage.setItem('lm_user', JSON.stringify(res.data))
      setUser(res.data)
      setSessionPromptOpen(false)
      window.dispatchEvent(new CustomEvent('lecturamind:toast', {
        detail: { message: 'Session continued successfully.', type: 'success' },
      }))
    } catch {
      window.dispatchEvent(new CustomEvent('lecturamind:toast', {
        detail: { message: 'Your session has ended. Please sign in again.', type: 'warning' },
      }))
      await finishSession()
    } finally {
      setCheckingSession(false)
    }
  }, [finishSession])

  const minutesLeft = Math.max(1, Math.ceil(sessionSecondsLeft / 60))

  return (
    <AuthContext.Provider value={{ user, token, loading, isAuthReady, login, logout, register, refreshUser }}>
      {children}
      <Modal
        isOpen={sessionPromptOpen}
        onClose={finishSession}
        title="Session ending soon"
        maxWidth="max-w-md"
        closeOnBackdrop={false}
        showCloseButton={false}
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              There has been no recent verified activity. For your security, the system will end this session in about {minutesLeft} minute{minutesLeft === 1 ? '' : 's'}.
            </p>
            <p className="text-sm text-gray-600">
              Do you want to continue working, or exit now?
            </p>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <Button variant="outline" onClick={finishSession}>
              Exit now
            </Button>
            <Button variant="primary" onClick={continueSession} loading={checkingSession}>
              Continue session
            </Button>
          </div>
        </div>
      </Modal>
    </AuthContext.Provider>
  )
}
