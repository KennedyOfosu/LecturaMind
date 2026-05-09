import api from './api'

export const chatService = {
  query: (courseId, query) => api.post('/api/chatbot/query', { course_id: courseId, query }),
  getHistory: (courseId) => api.get(`/api/chatbot/history/${courseId}`),
  getLogs: (courseId) => api.get(`/api/chatbot/logs/${courseId}`),
  flagMessage: (messageId) => api.patch(`/api/chatbot/flag/${messageId}`),
}
