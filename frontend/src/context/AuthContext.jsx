/**
 * AuthContext.jsx — Global auth state using ID-number based login.
 * Token and user are persisted in localStorage for page-refresh survival.
 * Includes automatic token refresh before expiry.
 */

import { createContext, useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService, TOKEN_KEY, REFRESH_TOKEN_KEY } from '../services/authService'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'

export const AuthContext = createContext(null)

const SESSION_EXIT_SECONDS = 120

export function AuthProvider({ children }) {
  const sessionRestoreRequest = useRef(null)
  const sessionRestoreToken = useRef(null)
  const navigate = useNavigate()
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lm_user')) || null } catch { return null }
  })
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [loading, setLoading] = useState(true)
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [authError, setAuthError] = useState(false)
  const restoreAttempt = useRef(0)
  const [sessionPromptOpen, setSessionPromptOpen] = useState(false)
  const [sessionSecondsLeft, setSessionSecondsLeft] = useState(SESSION_EXIT_SECONDS)
  const [checkingSession, setCheckingSession] = useState(false)

  const clearSession = useCallback(() => {
    authService.clearTokens()
    setUser(null)
    setToken(null)
    sessionRestoreRequest.current = null
    sessionRestoreToken.current = null
  }, [])

  const finishSession = useCallback(async () => {
    // Increment restore attempt to invalidate any in-flight restoreSession calls
    restoreAttempt.current += 1
    sessionRestoreRequest.current = null
    sessionRestoreToken.current = null

    setSessionPromptOpen(false)
    setCheckingSession(false)
    try { await authService.logout({ skipAuthPrompt: true }) } catch { /* ignore */ }
    clearSession()
    window.dispatchEvent(new CustomEvent('lecturamind:toast', {
      detail: { message: 'You have been signed out successfully.', type: 'success' },
    }))
    navigate('/login', { replace: true })
  }, [clearSession, navigate])

  const restoreSession = useCallback(async () => {
    const attempt = ++restoreAttempt.current
    const storedToken = localStorage.getItem(TOKEN_KEY)

    // No token - clear session immediately and mark ready
    if (!storedToken) {
      clearSession()
      sessionRestoreRequest.current = null
      sessionRestoreToken.current = null
      setAuthError(false)
      setLoading(false)
      setIsAuthReady(true)
      return
    }

    // Set token immediately for request interceptors
    setToken(storedToken)
    setLoading(true)
    setAuthError(false)

    let retryCount = 0
    const maxRetries = 3

    try {
      while (retryCount <= maxRetries) {
        try {
          // Proactively refresh token if expired before verifying session
          if (authService.isTokenExpired(storedToken)) {
            try {
              await authService.refreshAccessToken()
            } catch {
              // Refresh failed, will be handled by me() call
            }
          }

          // ALWAYS make a fresh request for this attempt - don't share promises across attempts
          // This prevents race conditions where an old logout's promise resolves after a new login
          const res = await authService.me({ skipAuthPrompt: true })

          // If another restore attempt started while we were waiting, discard this result
          if (attempt !== restoreAttempt.current) return

          setUser(res.data)
          localStorage.setItem('lm_user', JSON.stringify(res.data))
          break // Success - exit retry loop
        } catch (error) {
          // If another restore attempt started, discard this result
          if (attempt !== restoreAttempt.current) return

          const status = error.response?.status
          const isTransient = !status || status >= 500 || status === 0 || error.code === 'ECONNABORTED'

          if ([401, 403, 404].includes(status)) {
            clearSession()
            break
          } else if (isTransient && retryCount < maxRetries) {
            retryCount++
            // Wait before retry: 500ms, 1000ms, 2000ms
            await new Promise(r => setTimeout(r, 500 * retryCount))
            continue
          } else {
            // Non-transient error or max retries exceeded
            setAuthError(true)
            break
          }
        }
      }
    } finally {
      if (attempt === restoreAttempt.current) {
        setLoading(false)
        setIsAuthReady(true)
      }
    }
  }, [clearSession])

  // Restore session on mount. The shared request prevents StrictMode's
  // development remount from issuing two simultaneous identity checks.
  useEffect(() => { restoreSession() }, [restoreSession])

  useEffect(() => {
    const invalidate = () => {
      restoreAttempt.current += 1
      sessionRestoreRequest.current = null
      sessionRestoreToken.current = null
      clearSession()
      setAuthError(false)
      setLoading(false)
      setIsAuthReady(true)
    }
    window.addEventListener('lecturamind:session-invalid', invalidate)
    return () => window.removeEventListener('lecturamind:session-invalid', invalidate)
  }, [clearSession])

  useEffect(() => {
    const handler = () => {
      if (!localStorage.getItem(TOKEN_KEY)) return
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
    // Reset restore attempt counter on fresh login to prevent old promises from interfering
    restoreAttempt.current = 0
    sessionRestoreRequest.current = null
    sessionRestoreToken.current = null

    const res = await authService.login({ id_number: idNumber, password })
    const { token: tok, user: userData, refresh_token: refreshTok } = res.data
    authService.setTokens(tok, refreshTok)
    setToken(tok)
    setUser(userData)
    setAuthError(false)
    setIsAuthReady(true)
    setLoading(false)
    setSessionPromptOpen(false)
    return userData
  }, [])

  const register = useCallback(async (payload) => {
    // Accepts: { full_name, email, password, id_number, programme?, level?, academic_year? }
    // Reset restore attempt counter on fresh registration
    restoreAttempt.current = 0
    sessionRestoreRequest.current = null
    sessionRestoreToken.current = null

    const res = await authService.register(payload)
    const { token: tok, user: userData, refresh_token: refreshTok } = res.data
    authService.setTokens(tok, refreshTok)
    setToken(tok)
    setUser(userData)
    setAuthError(false)
    setIsAuthReady(true)
    setLoading(false)
    setSessionPromptOpen(false)
    return userData
  }, [])

  const refreshUser = useCallback(async () => {
    const res = await authService.me()
    localStorage.setItem('lm_user', JSON.stringify(res.data))
    setUser(res.data)
    return res.data
  }, [])

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
    } catch (error) {
      if ([400, 401, 403].includes(error.response?.status)) {
        window.dispatchEvent(new CustomEvent('lecturamind:toast', {
          detail: { message: 'Your session has ended. Please sign in again.', type: 'warning' },
        }))
        await finishSession()
      } else {
        window.dispatchEvent(new CustomEvent('lecturamind:toast', {
          detail: { message: 'Could not check your session because the server is unavailable. Please try again.', type: 'warning' },
        }))
      }
    } finally {
      setCheckingSession(false)
    }
  }, [finishSession])

  const minutesLeft = Math.max(1, Math.ceil(sessionSecondsLeft / 60))

  return (
    <AuthContext.Provider value={{ user, token, loading, isAuthReady, authError, retryAuth: restoreSession, login, logout, register, refreshUser }}>
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
