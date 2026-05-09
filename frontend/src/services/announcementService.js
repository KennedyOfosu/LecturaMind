import api from './api'

export const announcementService = {
  create: (data) => api.post('/api/announcements', data),
  getByCourse: (courseId) => api.get(`/api/announcements/course/${courseId}`),
  update: (id, data) => api.put(`/api/announcements/${id}`, data),
  delete: (id) => api.delete(`/api/announcements/${id}`),
}
