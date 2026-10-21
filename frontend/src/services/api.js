/**
 * api.js — Axios base instance with JWT auth interceptor.
 * Automatically attaches the stored token and handles 401/403 globally.
 * Includes automatic token refresh before expiry.
 */

import axios from 'axios'
import { authService, TOKEN_KEY, REFRESH_TOKEN_KEY } from './authService'

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL
const apiBaseUrl = import.meta.env.DEV
  ? ''
  : (configuredApiBaseUrl || 'https://lecturamind.onrender.com')

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
})

let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

const startTokenRefreshScheduler = () => {
  const checkAndRefresh = async () => {
    const token = authService.getAccessToken()
    if (token && authService.isTokenExpired(token)) {
      try {
        await authService.refreshAccessToken()
      } catch (e) {
        // Token refresh failed, user will be logged out
      }
    }
  }

  // Check every 5 minutes
  setInterval(checkAndRefresh, 5 * 60 * 1000)
  
  // Also check on page visibility change (when user returns to tab)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      checkAndRefresh()
    }
  })

  // Initial check
  checkAndRefresh()
}

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = authService.getAccessToken()
  config.__authToken = token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/* Fire a toast from outside the React tree via the window event bridge */
function showToast(message, type) {
  window.dispatchEvent(new CustomEvent('lecturamind:toast', { detail: { message, type } }))
}

function isLoginRequest(config) {
  return config?.url?.replace(/\?.*$/, '').endsWith('/api/auth/login')
}

function isRefreshRequest(config) {
  return config?.url?.replace(/\?.*$/, '').endsWith('/api/auth/refresh')
}

// Handle auth errors globally + auto-retry on network errors / 5xx (backend cold start)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config
    const requestToken = config?.__authToken
    const activeToken = authService.getAccessToken()

    // Ignore late responses from a previous account/session.
    // Allow login requests through even if token changed (login sets new token)
    const isLogin = isLoginRequest(config)
    const isRefresh = isRefreshRequest(config)
    if (requestToken && activeToken && requestToken !== activeToken && !isLogin && !isRefresh) {
      return Promise.reject(error)
    }

    if (error.response?.status === 401 && !isRefresh) {
      if (!config?.skipAuthPrompt && !isLoginRequest(config) && requestToken && requestToken === activeToken) {
        // Try to refresh the token
        if (!isRefreshing) {
          isRefreshing = true
          try {
            const newToken = await authService.refreshAccessToken()
            isRefreshing = false
            processQueue(null, newToken)
            
            // Retry the original request with new token
            config.headers.Authorization = `Bearer ${newToken}`
            return api(config)
          } catch (refreshError) {
            isRefreshing = false
            processQueue(refreshError, null)
            
            if (!isLoginRequest(config) && requestToken && requestToken === activeToken) {
              showToast('Your session has expired. Please sign in again.', 'warning')
              window.dispatchEvent(new CustomEvent('lecturamind:session-invalid'))
            }
            return Promise.reject(refreshError)
          }
        }
        
        // Wait for the token refresh to complete
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          config.headers.Authorization = `Bearer ${token}`
          return api(config)
        }).catch((err) => {
          return Promise.reject(err)
        })
      }
      return Promise.reject(error)
    }

    if (error.response?.status === 403) {
      showToast('You do not have permission to perform this action.', 'warning')
      return Promise.reject(error)
    }

    // Retry up to 2 times on network errors or 5xx responses
    const shouldRetry = !axios.isCancel(error) && error.code !== 'ERR_CANCELED'
      && (!error.response || error.response.status >= 500)
    if (shouldRetry && config && (config.__retryCount || 0) < 2) {
      config.__retryCount = (config.__retryCount || 0) + 1
      await new Promise((r) => setTimeout(r, 1000 * config.__retryCount))
      return api(config)
    }

    // After retries exhausted, surface network errors
    if (!error.response && !config?.suppressNetworkToast) {
      const requestPath = config?.url?.split('?')[0]
      const message = requestPath
        ? `Could not reach ${requestPath}. Check the local API connection and try again.`
        : 'Could not reach the API. Check the local API connection and try again.'
      showToast(message, 'error')
    }

    return Promise.reject(error)
  }
)

// Start the token refresh scheduler
if (typeof window !== 'undefined') {
  startTokenRefreshScheduler()
}

export default api
