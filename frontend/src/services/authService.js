import api from './api'

const TOKEN_KEY = 'lm_token'
const REFRESH_TOKEN_KEY = 'lm_refresh_token'
const USER_KEY = 'lm_user'

export const authService = {
  register: (data) =>
    api.post('/api/auth/register', data),

  validateRegistration: (data) =>
    api.post('/api/auth/validate-registration', data, { suppressNetworkToast: true }),

  validateLecturerActivation: (token) =>
    api.post('/api/auth/activation/validate', { token }),

  completeLecturerActivation: (data) =>
    api.post('/api/auth/activation/complete', data),

  login: ({ id_number, password }) =>
    api.post('/api/auth/login', { id_number, password }),

  logout: (config = {}) => api.post('/api/auth/logout', null, config),

  me: (config = {}) => api.get('/api/auth/me', config),

  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem(TOKEN_KEY, accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  },

  getAccessToken: () => localStorage.getItem(TOKEN_KEY),

  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),

  clearTokens: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  },

  refreshAccessToken: async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
    if (!refreshToken) {
      throw new Error('No refresh token available')
    }

    try {
      const response = await api.post('/api/auth/refresh', { refresh_token: refreshToken })
      const { access_token, refresh_token } = response.data
      localStorage.setItem(TOKEN_KEY, access_token)
      if (refresh_token) {
        localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token)
      }
      return access_token
    } catch (error) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(REFRESH_TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      window.dispatchEvent(new CustomEvent('lecturamind:session-invalid'))
      throw error
    }
  },

  isTokenExpired: (token) => {
    if (!token) return true
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const exp = payload.exp * 1000
      return Date.now() >= exp - 5 * 60 * 1000
    } catch {
      return true
    }
  },
}

export { TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY }
