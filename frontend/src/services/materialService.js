import api from './api'

export const materialService = {
  upload: (formData, onUploadProgress) =>
    api.post('/api/materials/upload', formData, {
      // Do NOT set Content-Type — Axios sets it with the multipart boundary
      headers: { 'Content-Type': undefined },
      onUploadProgress,
    }),
  getByCourse: (courseId) => api.get(`/api/materials/course/${courseId}`),
  getDownloadUrl: (id) => api.get(`/api/materials/${id}/download`),
  downloadFile: (id) =>
    api.get(`/api/materials/${id}/file`, { responseType: 'blob' }),
  downloadAll: (materialIds) =>
    api.post('/api/materials/download-all', { material_ids: materialIds }),
  delete: (id) => api.delete(`/api/materials/${id}`),
}

