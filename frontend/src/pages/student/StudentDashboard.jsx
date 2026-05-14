/**
 * StudentDashboard.jsx — Synapse layout with inline AI chat.
 * Course chips shown below greeting so student can select course and chat immediately.
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useSocket } from '../../hooks/useSocket'
import { courseService } from '../../services/courseService'
import api from '../../services/api'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

/* ── Icons ── */
const Icons = {
  Logo: () => (
    <svg width="22" height="18" viewBox="0 0 40 32" fill="none">
      <path d="M2 30L20 4L38 30" stroke="#111" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 30L20 14L30 30" stroke="#111" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Toggle: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>
    </svg>
  ),
  Home: () => (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  Folder: () => (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
    </svg>
  ),
  File: () => (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  ),
  Chat: () => (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  ),
  Bell: () => (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 01-3.46 0"/>
    </svg>
  ),
  Quiz: () => (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  Mic: () => (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
      <path d="M19 10v2a7 7 0 01-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
    </svg>
  ),
  Send: () => (
    <svg width="14" height="14" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  ),
  User: () => (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  Logout: () => (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  Spinner: () => (
    <svg className="animate-spin" width="14" height="14" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
    </svg>
  ),
}

const quickActions = [
  { label: 'View Materials', Icon: Icons.File,  tab: 'materials'     },
  { label: 'AI Chatbot',     Icon: Icons.Chat,  tab: 'chatbot'       },
  { label: 'Announcements',  Icon: Icons.Bell,  tab: 'announcements' },
  { label: 'Take a Quiz',    Icon: Icons.Quiz,  tab: 'quiz'          },
  { label: 'Live Q&A',       Icon: Icons.Mic,   tab: 'qna'           },
]

export default function StudentDashboard() {
  const { user, logout } = useAuth()
  const { socket }       = useSocket()
  const navigate          = useNavigate()
  const bottomRef         = useRef(null)
  const hasEmittedLogin   = useRef(false)

  const [courses,        setCourses]        = useState([])
  const [sidebarOpen,    setSidebarOpen]    = useState(true)
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [query,          setQuery]          = useState('')
  const [messages,       setMessages]       = useState([])
  const [isTyping,       setIsTyping]       = useState(false)

  const firstName = user?.full_name?.split(' ')[0] || 'Student'

  useEffect(() => {
    courseService.getEnrolled()
      .then((res) => {
        setCourses(res.data)
        // Don't auto-select — let student pick via chip
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // Announce presence once courses are loaded and socket is connected
  useEffect(() => {
    if (socket && user && courses.length > 0 && !hasEmittedLogin.current) {
      socket.emit('student_login', {
        student_id:        user.id,
        student_name:      user.full_name,
        student_id_number: user.user_id_number,
        programme:         user.programme,
        level:             user.level,
        course_ids:        courses.map((c) => c.id),
      })
      hasEmittedLogin.current = true
    }
  }, [socket, user, courses])

  const selectCourse = (c) => {
    setSelectedCourse(c)
    setMessages([])
    setQuery('')
  }

  const goTo = (courseId, tab) =>
    navigate(`/student/courses/${courseId}`, { state: { tab } })

  const handleSend = async (e) => {
    e.preventDefault()
    const text = query.trim()
    if (!text || !selectedCourse) return

    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setQuery('')
    setIsTyping(true)

    try {
      const res = await api.post('/api/chatbot/query', {
        course_id: selectedCourse.id,
        query: text,
      })
      setMessages((prev) => [...prev, { role: 'ai', content: res.data.response }])
    } catch {
      setMessages((prev) => [...prev, {
        role: 'ai',
        content: "I'm having trouble connecting right now. Please try again in a moment.",
      }])
    } finally {
      setIsTyping(false)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#F0F0F2' }}>

      {/* ══ SIDEBAR ══ */}
      {sidebarOpen && (
        <aside className="flex flex-col h-full w-56 shrink-0"
          style={{ backgroundColor: '#F0F0F2', borderRight: '1px solid #D2D4D9' }}>

          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/student/dashboard')}>
              <Icons.Logo /><span className="text-sm font-semibold text-gray-800 tracking-tight">LecturaMind</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-gray-700"><Icons.Toggle /></button>
          </div>

          <nav className="px-3 mt-1 flex flex-col gap-0.5">
            <button onClick={() => navigate('/student/dashboard')}
              className="flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-white transition-colors">
              <Icons.Home /> Home
            </button>
            <button onClick={() => navigate('/student/profile')}
              className="flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-white transition-colors">
              <Icons.User /> My Profile
            </button>
          </nav>

          <div className="px-3 mt-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">My Courses</p>
            <div className="flex flex-col gap-0.5">
              {!courses.length ? (
                <p className="text-xs text-gray-400 px-3 py-2">No courses yet</p>
              ) : courses.map((c) => (
                <button key={c.id}
                  onClick={() => { selectCourse(c) }}
                  className={`flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg text-sm transition-colors truncate ${
                    selectedCourse?.id === c.id ? 'bg-white font-medium text-gray-900' : 'text-gray-600 hover:bg-white'
                  }`}>
                  <span className="shrink-0"><Icons.Folder /></span>
                  <span className="truncate">{c.course_name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="px-3 mt-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">Quick Actions</p>
            <div className="flex flex-col gap-0.5">
              {quickActions.map(({ label, Icon, tab }) => (
                <button key={tab}
                  onClick={() => { const c = selectedCourse || courses[0]; if (c) goTo(c.id, tab) }}
                  className="flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-white transition-colors">
                  <Icon /> {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1" />

          <div className="mx-3 mb-4 px-3 py-3 rounded-xl flex items-center gap-2.5" style={{ backgroundColor: '#D2D4D9' }}>
            <button onClick={() => navigate('/student/profile')}
              className="flex items-center gap-2.5 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity">
              <div className="h-7 w-7 rounded-full bg-gray-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                {user?.full_name?.[0] || 'S'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">{user?.full_name}</p>
                <p className="text-xs text-gray-500">{user?.user_id_number}</p>
              </div>
            </button>
            <button onClick={logout} title="Logout" className="text-gray-400 hover:text-gray-700 shrink-0"><Icons.Logout /></button>
          </div>
        </aside>
      )}

      {/* ══ MAIN CONTENT ══ */}
      <main className="flex-1 flex flex-col overflow-hidden relative">

        {!sidebarOpen && (
          <button onClick={() => setSidebarOpen(true)}
            className="absolute top-4 left-4 text-gray-500 hover:text-gray-800 transition-colors z-10">
            <Icons.Toggle />
          </button>
        )}

        {/* Messages area or greeting */}
        <div className="flex-1 overflow-y-auto px-6 py-8 flex flex-col">
          {messages.length === 0 ? (
            /* ── Greeting + course chips ── */
            <div className="flex-1 flex flex-col items-center justify-center gap-6">
              <div className="text-center">
                <h1 className="text-3xl font-semibold text-gray-900 mb-1.5">
                  {getGreeting()}, {firstName}
                </h1>
                <p className="text-gray-500 text-base">
                  {courses.length
                    ? selectedCourse
                      ? `Ask me anything about ${selectedCourse.course_name}`
                      : 'Select a course below to start chatting'
                    : 'You have no enrolled courses yet'}
                </p>
              </div>

              {/* Course chips */}
              {courses.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2">
                  {courses.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => selectCourse(c)}
                      className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all border"
                      style={selectedCourse?.id === c.id
                        ? { backgroundColor: '#111', color: '#fff', borderColor: '#111' }
                        : { backgroundColor: '#fff', color: '#374151', borderColor: '#D2D4D9' }
                      }
                    >
                      <Icons.Folder />
                      {c.course_code ? `${c.course_code} — ${c.course_name}` : c.course_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* ── Chat messages ── */
            <div className="max-w-2xl w-full mx-auto flex flex-col gap-5 pb-4">
              {/* Course chip indicator at top of chat */}
              {selectedCourse && (
                <div className="flex justify-center">
                  <span className="text-xs text-gray-400 bg-white border px-3 py-1 rounded-full"
                    style={{ borderColor: '#D2D4D9' }}>
                    Chatting about: <strong>{selectedCourse.course_name}</strong>
                  </span>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {msg.role === 'ai' && (
                    <span className="text-xs font-semibold mb-1 px-1 text-gray-500">LecturaMind AI</span>
                  )}
                  <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user' ? 'text-white rounded-br-none' : 'rounded-bl-none border'
                  }`}
                    style={msg.role === 'user'
                      ? { backgroundColor: '#111' }
                      : { backgroundColor: '#fff', borderColor: '#D2D4D9', color: '#374151' }}>
                    {msg.content}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex items-start">
                  <div className="px-4 py-3 rounded-2xl rounded-bl-none border text-sm"
                    style={{ backgroundColor: '#fff', borderColor: '#D2D4D9' }}>
                    <div className="flex gap-1 items-center h-4">
                      {[0, 1, 2].map((i) => (
                        <span key={i} className="h-2 w-2 rounded-full bg-gray-400 animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* ── Chat input — pinned at bottom ── */}
        <div className="px-6 pb-6">
          <form onSubmit={handleSend}
            className="max-w-2xl mx-auto rounded-2xl shadow-sm overflow-hidden"
            style={{ backgroundColor: '#fff', border: '1px solid #D2D4D9' }}>

            {/* Course switcher row (inside input box) */}
            {courses.length > 0 && (
              <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b flex-wrap"
                style={{ borderColor: '#F0F0F2' }}>
                <span className="text-xs text-gray-400 shrink-0">Course:</span>
                {courses.map((c) => (
                  <button key={c.id} type="button" onClick={() => selectCourse(c)}
                    className="text-xs px-2.5 py-1 rounded-full border transition-all font-medium"
                    style={selectedCourse?.id === c.id
                      ? { backgroundColor: '#111', color: '#fff', borderColor: '#111' }
                      : { backgroundColor: '#F0F0F2', color: '#6b7280', borderColor: '#D2D4D9' }}>
                    {c.course_code || c.course_name}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center px-4 py-3 gap-3">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={selectedCourse
                  ? `Ask about ${selectedCourse.course_name}…`
                  : 'Select a course chip above to start chatting…'}
                disabled={!selectedCourse || isTyping}
                className="flex-1 text-sm text-gray-700 placeholder-gray-400 focus:outline-none bg-transparent disabled:opacity-50"
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend(e)}
              />
              <button type="submit"
                disabled={!selectedCourse || !query.trim() || isTyping}
                className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30"
                style={{ backgroundColor: '#111' }}>
                {isTyping ? <Icons.Spinner /> : <Icons.Send />}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
