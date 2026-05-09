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

// Handle auth errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('lm_token')
      localStorage.removeItem('lm_user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
