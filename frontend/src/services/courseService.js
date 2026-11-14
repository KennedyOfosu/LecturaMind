import api from './api'

export const courseService = {
  create: (data) => api.post('/api/courses/', data),
  getMyCourses: (config) => api.get('/api/courses/my', config).then((response) => {
    // Support both the legacy array response and the newer
    // { data, data_warnings } response used by the API.
    if (Array.isArray(response.data)) {
      response.data_warnings = []
      return response
    }
    response.data_warnings = response.data?.data_warnings || []
    response.data = Array.isArray(response.data?.data) ? response.data.data : []
    return response
  }),
  getEnrolled: () => api.get('/api/courses/enrolled'),
  getById: (id) => api.get(`/api/courses/${id}`),
  update: (id, data) => api.put(`/api/courses/${id}`, data),
  delete: (id) => api.delete(`/api/courses/${id}`),
  enrolStudent: (courseId, studentIdNumber) =>
    api.post(`/api/courses/${courseId}/enrol`, { student_id_number: studentIdNumber }),
  getStudents: (courseId) => api.get(`/api/courses/${courseId}/students`),
}
