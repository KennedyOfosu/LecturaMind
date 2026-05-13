/**
 * CourseView.jsx — Tabbed course view with AI chat as a slide-in panel.
 */

import { useState, useEffect, useRef } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { useCourse } from '../../hooks/useCourse'
import { PageSpinner } from '../../components/ui/Spinner'
import MaterialsView from './MaterialsView'
import AnnouncementsView from './AnnouncementsView'
import QuizView from './QuizView'
import StudentLiveQnA from './LiveQnA'
import api from '../../services/api'

/* ── Icons ── */
const CloseIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const SendIcon = () => (
  <svg width="16" height="16" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
)
const SpinnerIcon = () => (
  <svg className="animate-spin" width="16" height="16" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4"/>
    <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8H4z"/>
  </svg>
)

const TABS = [
  { id: 'materials',     label: 'Materials'      },
  { id: 'announcements', label: 'Announcements'  },
  { id: 'quiz',          label: 'Quiz'           },
  { id: 'qna',           label: 'Live Q&A'       },
]

/* ── AI Chat Slide-in Panel ── */
function ChatPanel({ courseId, courseName, onClose }) {
  const [messages, setMessages] = useState([])
  const [query,    setQuery]    = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    // Load history
    api.get(`/api/chatbot/history/${courseId}`)
      .then((res) => {
        const msgs = []
        res.data.forEach((row) => {
          msgs.push({ id: `${row.id}-q`, role: 'user', content: row.query })
          msgs.push({ id: `${row.id}-r`, role: 'ai',   content: row.response })
        })
        setMessages(msgs)
      })
      .catch(() => {})

    setTimeout(() => inputRef.current?.focus(), 100)
  }, [courseId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const handleSubmit = async () => {
    const text = query.trim()
    if (!text || isTyping) return
    setMessages((p) => [...p, { id: Date.now(), role: 'user', content: text }])
    setQuery('')
    setIsTyping(true)
    try {
      const res = await api.post('/api/chatbot/query', { course_id: courseId, query: text })
      setMessages((p) => [...p, { id: Date.now() + 1, role: 'ai', content: res.data.response }])
    } catch {
      setMessages((p) => [...p, {
        id: Date.now() + 1, role: 'ai',
        content: "I'm having trouble connecting right now. Please try again.",
      }])
    } finally { setIsTyping(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 flex flex-col w-full max-w-md h-full bg-white shadow-2xl animate-slide-in-right">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">LecturaMind AI</h2>
            <p className="text-xs text-gray-400 mt-0.5">{courseName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
            <CloseIcon />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          {messages.length === 0 && !isTyping && (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
              <p className="text-gray-400 text-sm">
                Ask me anything about <strong>{courseName}</strong>
              </p>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              {msg.role === 'ai' && (
                <span className="text-xs font-semibold text-gray-400 mb-1 px-1">LecturaMind AI</span>
              )}
              <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gray-900 text-white rounded-br-none'
                  : 'bg-gray-50 border border-gray-200 text-gray-800 rounded-bl-none'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex items-start">
              <div className="bg-gray-50 border border-gray-200 px-4 py-3 rounded-2xl rounded-bl-none">
                <div className="flex gap-1 items-center h-4">
                  {[0,1,2].map((i) => (
                    <span key={i} className="h-2 w-2 rounded-full bg-gray-400 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-4 border-t border-gray-100">
          <div className="flex items-end gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2">
            <textarea
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
              }}
              placeholder="Ask a question about this course..."
              rows={2}
              disabled={isTyping}
              className="flex-1 resize-none bg-transparent text-sm text-gray-700 placeholder-gray-400 focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={handleSubmit}
              disabled={!query.trim() || isTyping}
              className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 transition-colors disabled:opacity-30 bg-gray-900"
            >
              {isTyping ? <SpinnerIcon /> : <SendIcon />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── CourseView ── */
export default function CourseView() {
  const { courseId } = useParams()
  const location     = useLocation()
  const { course, loading } = useCourse(courseId)

  const [activeTab,  setActiveTab]  = useState(location.state?.tab || 'materials')
  const [isChatOpen, setIsChatOpen] = useState(false)

  if (loading) return <PageSpinner />

  const lecturer = course?.profiles

  return (
    <div className="flex flex-col gap-6">
      {/* Course header */}
      <div className="rounded-2xl p-6" style={{ backgroundColor: '#111', color: '#fff' }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/20 text-white">
                {course?.course_code}
              </span>
              {course?.level && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                  Level {course.level}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold">{course?.course_name}</h1>
            {course?.description && (
              <p className="text-white/60 text-sm mt-1">{course.description}</p>
            )}
            <div className="flex items-center gap-2 mt-3">
              <div className="h-6 w-6 rounded-full bg-white/20 text-white flex items-center justify-center text-xs font-bold">
                {lecturer?.full_name?.[0] || 'L'}
              </div>
              <span className="text-white/60 text-sm">{lecturer?.full_name || 'Your Lecturer'}</span>
            </div>
          </div>

          {/* Ask AI button */}
          <button
            onClick={() => setIsChatOpen(true)}
            className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white text-gray-900 hover:bg-gray-100 transition-colors"
          >
            Ask AI
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === id
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'materials'     && <MaterialsView courseId={courseId} />}
        {activeTab === 'announcements' && <AnnouncementsView courseId={courseId} />}
        {activeTab === 'quiz'          && <QuizView courseId={courseId} />}
        {activeTab === 'qna'           && <StudentLiveQnA courseId={courseId} />}
      </div>

      {/* AI Chat slide-in panel */}
      {isChatOpen && (
        <ChatPanel
          courseId={courseId}
          courseName={course?.course_name || 'this course'}
          onClose={() => setIsChatOpen(false)}
        />
      )}
    </div>
  )
}
