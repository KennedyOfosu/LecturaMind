import api from './api'

export const courseService = {
  create: (data) => api.post('/api/courses/', data),
  getMyCourses: () => api.get('/api/courses/my'),
  getEnrolled: () => api.get('/api/courses/enrolled'),
  getById: (id) => api.get(`/api/courses/${id}`),
  update: (id, data) => api.put(`/api/courses/${id}`, data),
  delete: (id) => api.delete(`/api/courses/${id}`),
  enrolStudent: (courseId, email) => api.post(`/api/courses/${courseId}/enrol`, { email }),
  getStudents: (courseId) => api.get(`/api/courses/${courseId}/students`),
}
