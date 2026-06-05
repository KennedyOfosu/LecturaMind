import api from './api'

export const quizService = {
  generate:       (data)            => api.post('/api/quiz/generate', data),
  createManual:   (data)            => api.post('/api/quiz/manual', data),
  getByCourse:    (courseId)        => api.get(`/api/quiz/course/${courseId}`),
  toggleActivate: (quizId)          => api.patch(`/api/quiz/${quizId}/activate`),
  delete:         (quizId)          => api.delete(`/api/quiz/${quizId}`),
  submitAttempt:  (quizId, answers) => api.post(`/api/quiz/${quizId}/attempt`, { answers }),
  getResults:     (quizId)          => api.get(`/api/quiz/${quizId}/results`),
  getMyAttempt:   (quizId)          => api.get(`/api/quiz/${quizId}/my-attempt`),
  // Live session
  startLive:      (quizId)          => api.post(`/api/quiz/${quizId}/start-live`),
  endLive:        (quizId)          => api.post(`/api/quiz/${quizId}/end-live`),
  deployMarks:    (quizId)          => api.post(`/api/quiz/${quizId}/deploy-marks`),
  getByPin:       (pin)             => api.get(`/api/quiz/pin/${pin}`),
  getActiveLive:  (courseId)        => api.get(`/api/quiz/course/${courseId}/live`),
}
