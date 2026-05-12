/**
 * StudentLayout.jsx — Synapse-style layout for all student pages.
 * Sidebar with navigation + main scrollable content area.
 */

import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { courseService } from '../../services/courseService'

/* ── Icons ── */
const I = {
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
  Logout: () => (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
}

const quickActions = [
  { label: 'View Materials',  Icon: I.File,  tab: 'materials'     },
  { label: 'AI Chatbot',      Icon: I.Chat,  tab: 'chatbot'       },
  { label: 'Announcements',   Icon: I.Bell,  tab: 'announcements' },
  { label: 'Take a Quiz',     Icon: I.Quiz,  tab: 'quiz'          },
  { label: 'Live Q&A',        Icon: I.Mic,   tab: 'qna'           },
]

export default function StudentLayout() {
  const { user, logout } = useAuth()
  const navigate          = useNavigate()
  const location          = useLocation()
  const [courses,        setCourses]        = useState([])
  const [sidebarOpen,    setSidebarOpen]    = useState(true)
  const [selectedCourse, setSelectedCourse] = useState(null)

  useEffect(() => {
    courseService.getEnrolled()
      .then((r) => {
        setCourses(r.data)
        if (r.data.length) setSelectedCourse(r.data[0])
      })
      .catch(() => {})
  }, [])

  const isActive = (path) => location.pathname.startsWith(path)

  const goToCourseTab = (tab) => {
    const c = selectedCourse || courses[0]
    if (c) navigate(`/student/courses/${c.id}`, { state: { tab } })
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#F0F0F2' }}>

      {/* ══ SIDEBAR ══ */}
      {sidebarOpen && (
        <aside className="flex flex-col h-full w-56 shrink-0"
          style={{ backgroundColor: '#F0F0F2', borderRight: '1px solid #D2D4D9' }}>

          {/* Brand */}
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/student/dashboard')}>
              <I.Logo />
              <span className="text-sm font-semibold text-gray-800 tracking-tight">LecturaMind</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-gray-700 transition-colors">
              <I.Toggle />
            </button>
          </div>

          {/* Home */}
          <nav className="px-3 mt-1">
            <button
              onClick={() => navigate('/student/dashboard')}
              className={`flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === '/student/dashboard' ? 'bg-white text-gray-900' : 'text-gray-600 hover:bg-white'
              }`}>
              <I.Home /> Home
            </button>
          </nav>

          {/* My Courses */}
          <div className="px-3 mt-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">My Courses</p>
            <div className="flex flex-col gap-0.5">
              {!courses.length
                ? <p className="text-xs text-gray-400 px-3 py-1">No courses yet</p>
                : courses.map((c) => (
                  <button key={c.id}
                    onClick={() => { setSelectedCourse(c); navigate(`/student/courses/${c.id}`) }}
                    className={`flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg text-sm transition-colors truncate ${
                      location.pathname === `/student/courses/${c.id}` ? 'bg-white text-gray-900 font-medium' : 'text-gray-600 hover:bg-white'
                    }`}>
                    <span className="shrink-0"><I.Folder /></span>
                    <span className="truncate">{c.course_name}</span>
                  </button>
                ))
              }
            </div>
          </div>

          {/* Quick Actions */}
          <div className="px-3 mt-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">Quick Actions</p>
            <div className="flex flex-col gap-0.5">
              {quickActions.map(({ label, Icon, tab }) => (
                <button key={tab}
                  onClick={() => goToCourseTab(tab)}
                  className="flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-white transition-colors">
                  <Icon /> {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1" />

          {/* User profile */}
          <div className="mx-3 mb-4 px-3 py-3 rounded-xl flex items-center gap-2.5"
            style={{ backgroundColor: '#D2D4D9' }}>
            <div className="h-7 w-7 rounded-full bg-gray-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
              {user?.full_name?.[0] || 'S'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 truncate">{user?.full_name}</p>
              <p className="text-xs text-gray-500">{user?.user_id_number}</p>
            </div>
            <button onClick={logout} title="Logout" className="text-gray-400 hover:text-gray-700 shrink-0">
              <I.Logout />
            </button>
          </div>
        </aside>
      )}

      {/* ══ MAIN CONTENT ══ */}
      <main className="flex-1 overflow-y-auto relative" style={{ backgroundColor: '#F0F0F2' }}>
        {!sidebarOpen && (
          <button onClick={() => setSidebarOpen(true)}
            className="absolute top-4 left-4 text-gray-500 hover:text-gray-800 transition-colors z-10">
            <I.Toggle />
          </button>
        )}
        <div className={`p-8 min-h-full ${!sidebarOpen ? 'pl-14' : ''}`}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
