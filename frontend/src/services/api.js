/**
 * api.js — Axios base instance with JWT auth interceptor.
 * Automatically attaches the stored token and handles 401/403 globally.
 */

import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
  headers: { 'Content-Type': 'application/json' },
})

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('lm_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle auth errors globally + auto-retry on network errors / 5xx (backend cold start)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config

    if (error.response?.status === 401) {
      localStorage.removeItem('lm_token')
      localStorage.removeItem('lm_user')
      window.location.href = '/login'
      return Promise.reject(error)
    }

    // Retry up to 2 times on network errors or 5xx responses
    const shouldRetry = !error.response || error.response.status >= 500
    if (shouldRetry && (config.__retryCount || 0) < 2) {
      config.__retryCount = (config.__retryCount || 0) + 1
      await new Promise((r) => setTimeout(r, 1000 * config.__retryCount))
      return api(config)
    }

    return Promise.reject(error)
  }
)

export default api
