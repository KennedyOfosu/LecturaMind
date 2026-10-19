import api from './api'

export const adminService = {
  // Dashboard
  getDashboard: () => api.get('/api/admin/dashboard', { params: { _refresh: Date.now() } }),

  // Users
  getUsers: (params) => api.get('/api/admin/users', { params }),
  getUser: (userId) => api.get(`/api/admin/users/${userId}`),
  updateUser: (userId, data) => api.patch(`/api/admin/users/${userId}`, data),
  deleteUser: (userId) => api.delete(`/api/admin/users/${userId}`),
  getActivationMode: () => api.get('/api/admin/activation-mode'),
  generateLecturerActivationLink: (userId) => api.post(`/api/admin/users/${userId}/activation-link`),
  updateLecturerClassrooms: (userId, classroom_ids) => api.patch(`/api/admin/users/${userId}/classrooms`, { classroom_ids }),
  updateLecturerStatus: (userId, account_status) => api.patch(`/api/admin/users/${userId}/status`, { account_status }),

  // Courses
  getCourses: (params) => api.get('/api/admin/courses', { params }),
  createCourse: (data) => api.post('/api/admin/courses', data),
  getCourse: (courseId) => api.get(`/api/admin/courses/${courseId}`),
  updateCourse: (courseId, data) => api.patch(`/api/admin/courses/${courseId}`, data),
  deleteCourse: (courseId) => api.delete(`/api/admin/courses/${courseId}`),

  // Enrolments
  getEnrolments: (params) => api.get('/api/admin/enrolments', { params }),
  createEnrolment: (data) => api.post('/api/admin/enrolments', data),
  removeEnrolment: (enrolmentId) => api.delete(`/api/admin/enrolments/${enrolmentId}`),

  // Admin registration
  registerLecturer: (data) => api.post('/api/admin/register-lecturer', data),
  registerStudent: (data) => api.post('/api/admin/register-student', data),
  generateAccountId: (role) => api.post('/api/admin/generate-account-id', { role }),

  // Classrooms
  getClassrooms: (filters = {}) => api.get('/api/admin/classrooms', {
    // A classroom list is small and changes infrequently, but stale cached
    // empty responses make lecturer assignment look as if classes vanished.
    params: { ...filters, _refresh: Date.now() },
  }).then((response) => {
    const payload = response.data
    const classrooms = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.classrooms)
        ? payload.classrooms
        : Array.isArray(payload?.data)
          ? payload.data
          : null
    if (!classrooms) throw new Error('The classrooms API returned an unexpected response.')
    return { ...response, data: classrooms }
  }),
  getRooms: () => api.get('/api/admin/rooms', { params: { _refresh: Date.now() } }),
  getClassroomMigrationReview: () => api.get('/api/admin/classroom-migration-review', { params: { _refresh: Date.now() } }),
  createClassroom: (data) => api.post('/api/admin/classrooms', data),
  updateClassroom: (id, data) => api.patch(`/api/admin/classrooms/${id}`, data),
  deleteClassroom: (id) => api.delete(`/api/admin/classrooms/${id}`),

  // Academic Years
  getAcademicYears: () => api.get('/api/admin/academic-years'),
  createAcademicYear: (data) => api.post('/api/admin/academic-years', data),
  updateAcademicYear: (id, data) => api.patch(`/api/admin/academic-years/${id}`, data),

  // Semesters
  getSemesters: (params) => api.get('/api/admin/semesters', { params }),
  createSemester: (data) => api.post('/api/admin/semesters', data),
  updateSemester: (id, data) => api.patch(`/api/admin/semesters/${id}`, data),

  // Grading Scales
  getGradingScales: (params) => api.get('/api/admin/grading-scales', { params }),
  createGradingScale: (data) => api.post('/api/admin/grading-scales', data),
  updateGradingScale: (id, data) => api.patch(`/api/admin/grading-scales/${id}`, data),
  deleteGradingScale: (id) => api.delete(`/api/admin/grading-scales/${id}`),

  // Allocations
  allocateLecturer: (data) => api.post('/api/admin/allocate-lecturer', data),
  allocateClassroom: (data) => api.post('/api/admin/allocate-classroom', data),
  getAllocations: () => api.get('/api/admin/allocations'),

  // Fees
  getFees: (params) => api.get('/api/admin/fees', { params }),
  createFee: (data) => api.post('/api/admin/fees', data),
  updateFee: (id, data) => api.patch(`/api/admin/fees/${id}`, data),
  getFeeTypes: () => api.get('/api/admin/fees/types'),
  createFeeType: (data) => api.post('/api/admin/fees/types', data),
  deleteFeeType: (id) => api.delete(`/api/admin/fees/types/${id}`),

  // Payments
  getPayments: (params) => api.get('/api/admin/payments', { params }),
  recordPayment: (data) => api.post('/api/admin/payments', data),

  // Attendance
  getAttendance: (params) => api.get('/api/admin/attendance', { params }),
  updateAttendance: (id, data) => api.patch(`/api/admin/attendance/${id}`, data),

  // Report Cards
  generateReportCard: (data) => api.post('/api/admin/report-cards/generate', data),
  generateBulkReportCards: (data) => api.post('/api/admin/report-cards/generate-bulk', data),
  getReportCards: (params) => api.get('/api/admin/report-cards', { params }),
  getReportCard: (id) => api.get(`/api/admin/report-cards/${id}`),
  finalizeReportCard: (id) => api.post(`/api/admin/report-cards/${id}/finalize`),

  // Timetable Slots
  getTimetableSlots: () => api.get('/api/admin/timetable-slots'),
  createTimetableSlot: (data) => api.post('/api/admin/timetable-slots', data),
  deleteTimetableSlot: (id) => api.delete(`/api/admin/timetable-slots/${id}`),
  getCourseSchedules: (params) => api.get('/api/admin/course-schedules', { params }),
}
