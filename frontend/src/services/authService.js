import api from './api'

export const authService = {
  register: (data) =>
    api.post('/api/auth/register', data),

  login: ({ id_number, password }) =>
    api.post('/api/auth/login', { id_number, password }),

  logout: (config = {}) => api.post('/api/auth/logout', null, config),

  me: (config = {}) => api.get('/api/auth/me', config),
}
