import api from './api'

export const quizService = {
  generate: (data) => api.post('/api/quiz/generate', data),
  getByCourse: (courseId) => api.get(`/api/quiz/course/${courseId}`),
  toggleActivate: (quizId) => api.patch(`/api/quiz/${quizId}/activate`),
  delete: (quizId) => api.delete(`/api/quiz/${quizId}`),
  submitAttempt: (quizId, answers) => api.post(`/api/quiz/${quizId}/attempt`, { answers }),
  getResults: (quizId) => api.get(`/api/quiz/${quizId}/results`),
  getMyAttempt: (quizId) => api.get(`/api/quiz/${quizId}/my-attempt`),
}
