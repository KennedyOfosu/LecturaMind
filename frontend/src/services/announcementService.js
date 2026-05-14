import api from './api'

export const announcementService = {
  create:        (data)       => api.post('/api/announcements', data),
  getAll:        ()           => api.get('/api/announcements/my'),
  getByCourse:   (courseId)   => api.get(`/api/announcements/course/${courseId}`),
  update:        (id, data)   => api.put(`/api/announcements/${id}`, data),
  delete:        (id)         => api.delete(`/api/announcements/${id}`),
}
