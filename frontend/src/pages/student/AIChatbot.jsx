/**
 * AIChatbot.jsx — Full-height AI chat interface for student course queries.
 */

import { useState, useEffect } from 'react'
import { chatService } from '../../services/chatService'
import { useAuth } from '../../hooks/useAuth'
import { useSocket } from '../../hooks/useSocket'
import { ChatWindow } from '../../components/chat/ChatWindow'
import { ChatInput } from '../../components/chat/ChatInput'
import { Spinner } from '../../components/ui/Spinner'

export default function AIChatbot({ courseId }) {
  const { user } = useAuth()
  const { socket } = useSocket()
  const [messages, setMessages] = useState([])
  const [isTyping, setIsTyping] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load chat history on mount
  useEffect(() => {
    chatService.getHistory(courseId)
      .then((res) => {
        // Flatten history: each row has query + response, expand into message pairs
        const msgs = []
        res.data.forEach((row) => {
          msgs.push({ id: `${row.id}-q`, role: 'student', content: row.query, timestamp: row.timestamp })
          msgs.push({ id: `${row.id}-r`, role: 'ai', content: row.response, timestamp: row.timestamp })
        })
        setMessages(msgs)
      })
      .finally(() => setLoading(false))
  }, [courseId])

  // Notify lecturer that student is using chatbot
  useEffect(() => {
    if (!socket || !courseId) return
    socket.emit('join_course', {
      course_id: courseId,
      user_name: user?.full_name,
      avatar_url: user?.avatar_url,
    })
    socket.emit('student_active', {
      course_id: courseId,
      user_name: user?.full_name,
      action: 'opened the AI Chatbot',
    })
    return () => {
      socket.emit('leave_course', { course_id: courseId })
    }
  }, [socket, courseId, user])

  const handleSend = async (query) => {
    const userMsg = { id: Date.now(), role: 'student', content: query, timestamp: new Date().toISOString() }
    setMessages((prev) => [...prev, userMsg])
    setIsTyping(true)

    // Notify lecturer of activity
    socket?.emit('student_active', {
      course_id: courseId,
      user_name: user?.full_name,
      action: 'submitted an AI query',
    })

    try {
      const res = await chatService.query(courseId, query)
      const aiMsg = { id: Date.now() + 1, role: 'ai', content: res.data.response, timestamp: new Date().toISOString() }
      setMessages((prev) => [...prev, aiMsg])
    } catch {
      setMessages((prev) => [...prev, {
        id: Date.now() + 1,
        role: 'ai',
        content: 'Sorry, I\'m having trouble connecting right now. Please try again in a moment.',
        timestamp: new Date().toISOString(),
      }])
    } finally {
      setIsTyping(false)
    }
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" style={{ height: '600px' }}>
      {/* Chat header */}
      <div className="bg-navy text-white px-5 py-3 flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-teal flex items-center justify-center text-sm font-bold">AI</div>
        <div>
          <p className="text-sm font-semibold">LecturaMind AI</p>
          <p className="text-xs text-white/60">Ask anything about this course</p>
        </div>
      </div>

      {/* Messages */}
      {messages.length === 0 && !isTyping ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-400">
          <div className="text-5xl mb-3">🤖</div>
          <p className="font-medium text-gray-600 mb-1">Hello! I'm LecturaMind AI</p>
          <p className="text-sm">Ask me anything about your course materials and I'll do my best to help.</p>
        </div>
      ) : (
        <ChatWindow messages={messages} isTyping={isTyping} />
      )}

      <ChatInput onSend={handleSend} disabled={isTyping} />
    </div>
  )
}
