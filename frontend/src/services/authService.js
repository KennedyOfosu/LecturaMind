import api from './api'

export const authService = {
  register: (data) =>
    api.post('/api/auth/register', data),

  login: ({ id_number, password }) =>
    api.post('/api/auth/login', { id_number, password }),

  logout: () => api.post('/api/auth/logout'),

  me: () => api.get('/api/auth/me'),
}
