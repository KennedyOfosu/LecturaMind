import api from './api'

export const authService = {
  register: ({ full_name, email, password, id_number }) =>
    api.post('/api/auth/register', { full_name, email, password, id_number }),

  login: ({ id_number, password }) =>
    api.post('/api/auth/login', { id_number, password }),

  logout: () => api.post('/api/auth/logout'),

  me: () => api.get('/api/auth/me'),
}
