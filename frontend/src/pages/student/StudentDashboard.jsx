/**
 * StudentDashboard.jsx — Synapse-inspired layout.
 * Light theme: #F0F0F2 background, #D2D4D9 borders/accents.
 * Own full-page layout — no shared Navbar/Sidebar.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { courseService } from '../../services/courseService'

/* ── Greeting based on time of day ── */
function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

/* ── Chevron logo mark ── */
const LogoMark = () => (
  <svg width="24" height="20" viewBox="0 0 40 32" fill="none">
    <path d="M2 30L20 4L38 30" stroke="#111" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M10 30L20 14L30 30" stroke="#111" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

/* ── Sidebar toggle icon ── */
const SidebarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <path d="M9 3v18"/>
  </svg>
)

export default function StudentDashboard() {
  const { user, logout } = useAuth()
  const navigate          = useNavigate()

  const [courses,      setCourses]      = useState([])
  const [sidebarOpen,  setSidebarOpen]  = useState(true)
  const [greeting,     setGreeting]     = useState(getGreeting())
  const [query,        setQuery]        = useState('')
  const [selectedCourse, setSelectedCourse] = useState(null)

  const firstName = user?.full_name?.split(' ')[0] || 'Student'

  useEffect(() => {
    courseService.getEnrolled()
      .then((res) => {
        setCourses(res.data)
        if (res.data.length) setSelectedCourse(res.data[0])
      })
      .catch(() => {})
  }, [])

  /* Navigate to a course tab */
  const goTo = (courseId, tab) => {
    navigate(`/student/courses/${courseId}`, { state: { tab } })
  }

  const handleSend = (e) => {
    e.preventDefault()
    if (!selectedCourse) return
    navigate(`/student/courses/${selectedCourse.id}`, { state: { tab: 'chatbot', prefill: query } })
  }

  const quickActions = [
    { label: 'View Materials',   icon: '📄', tab: 'materials'      },
    { label: 'AI Chatbot',       icon: '🤖', tab: 'chatbot'        },
    { label: 'Announcements',    icon: '📢', tab: 'announcements'  },
    { label: 'Take a Quiz',      icon: '📝', tab: 'quiz'           },
    { label: 'Live Q&A',         icon: '🎙️', tab: 'qna'            },
  ]

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#F0F0F2' }}>

      {/* ══ LEFT SIDEBAR ══ */}
      {sidebarOpen && (
        <aside
          className="flex flex-col h-full w-56 shrink-0"
          style={{ backgroundColor: '#F0F0F2', borderRight: '1px solid #D2D4D9' }}
        >
          {/* Brand row */}
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2">
              <LogoMark />
              <span className="text-sm font-semibold text-gray-800 tracking-tight">LecturaMind</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-gray-400 hover:text-gray-700 transition-colors"
            >
              <SidebarIcon />
            </button>
          </div>

          {/* Nav */}
          <nav className="px-3 mt-1">
            <button
              onClick={() => navigate('/student/dashboard')}
              className="flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-white transition-colors"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              Home
            </button>
          </nav>

          {/* Enrolled Courses (Folders) */}
          <div className="px-3 mt-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">
              My Courses
            </p>
            <div className="flex flex-col gap-0.5">
              {!courses.length ? (
                <p className="text-xs text-gray-400 px-3 py-2">No courses yet</p>
              ) : (
                courses.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedCourse(c); navigate(`/student/courses/${c.id}`) }}
                    className="flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-white transition-colors truncate"
                  >
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="shrink-0">
                      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                    </svg>
                    <span className="truncate">{c.course_name}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="px-3 mt-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">
              Quick Actions
            </p>
            <div className="flex flex-col gap-0.5">
              {quickActions.map(({ label, icon, tab }) => (
                <button
                  key={tab}
                  onClick={() => {
                    const course = selectedCourse || courses[0]
                    if (course) goTo(course.id, tab)
                  }}
                  className="flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-white transition-colors"
                >
                  <span className="text-base leading-none">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* User profile */}
          <div
            className="mx-3 mb-4 px-3 py-3 rounded-xl flex items-center gap-2.5"
            style={{ backgroundColor: '#D2D4D9' }}
          >
            <div className="h-7 w-7 rounded-full bg-gray-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
              {user?.full_name?.[0] || 'S'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 truncate">{user?.full_name}</p>
              <p className="text-xs text-gray-500">{user?.user_id_number}</p>
            </div>
            <button
              onClick={logout}
              title="Logout"
              className="text-gray-400 hover:text-gray-700 transition-colors shrink-0"
            >
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </aside>
      )}

      {/* ══ MAIN CONTENT ══ */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative">

        {/* Show sidebar toggle when sidebar is closed */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute top-4 left-4 text-gray-500 hover:text-gray-800 transition-colors"
          >
            <SidebarIcon />
          </button>
        )}

        {/* Greeting */}
        <h1 className="text-3xl font-semibold text-gray-900 mb-1.5 text-center">
          {greeting}, {firstName}
        </h1>
        <p className="text-gray-500 text-base mb-10 text-center">
          How can I help you today?
        </p>

        {/* Chat input box */}
        <form
          onSubmit={handleSend}
          className="w-full max-w-2xl rounded-2xl shadow-sm overflow-hidden"
          style={{ backgroundColor: '#fff', border: '1px solid #D2D4D9' }}
        >
          {/* Course selector row */}
          {courses.length > 1 && (
            <div className="px-4 pt-3 pb-1">
              <select
                value={selectedCourse?.id || ''}
                onChange={(e) => setSelectedCourse(courses.find((c) => c.id === e.target.value))}
                className="text-xs text-gray-500 bg-transparent focus:outline-none cursor-pointer"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.course_name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Input row */}
          <div className="flex items-center px-4 py-3 gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask LecturaMind..."
              className="flex-1 text-sm text-gray-700 placeholder-gray-400 focus:outline-none bg-transparent"
            />
            <button
              type="submit"
              disabled={!selectedCourse || !query.trim()}
              className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30"
              style={{ backgroundColor: '#111' }}
            >
              <svg width="14" height="14" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </form>

      </main>
    </div>
  )
}
