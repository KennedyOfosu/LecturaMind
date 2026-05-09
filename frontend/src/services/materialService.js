import api from './api'

export const materialService = {
  upload: (formData) =>
    api.post('/api/materials/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getByCourse: (courseId) => api.get(`/api/materials/course/${courseId}`),
  delete: (id) => api.delete(`/api/materials/${id}`),
}
