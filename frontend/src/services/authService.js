import api from './api'

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
}
