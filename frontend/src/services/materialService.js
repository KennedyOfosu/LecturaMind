import api from './api'

export const materialService = {
  upload: (formData, onUploadProgress) =>
    api.post('/api/materials/upload', formData, {
      // Do NOT set Content-Type — Axios sets it with the multipart boundary
      headers: { 'Content-Type': undefined },
      onUploadProgress,
    }),
  getByCourse: (courseId) => api.get(`/api/materials/course/${courseId}`),
  delete: (id) => api.delete(`/api/materials/${id}`),
}
