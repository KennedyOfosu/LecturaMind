/**
 * LecturerLayout.jsx — Synapse-style layout for all lecturer pages.
 * Sidebar with navigation + main scrollable content area.
 */

import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useSearchParams, Outlet } from 'react-router-dom'
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
  Plus: () => (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="16"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
  ),
  Upload: () => (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  Bell: () => (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 01-3.46 0"/>
    </svg>
  ),
  Star: () => (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  Chat: () => (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  ),
  Eye: () => (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  Mic: () => (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
      <path d="M19 10v2a7 7 0 01-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
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
}

const navItems = [
  { label: 'Upload Materials', Icon: I.Upload, path: '/lecturer/materials'     },
  { label: 'Announcements',    Icon: I.Bell,   path: '/lecturer/announcements' },
  { label: 'Generate Quiz',    Icon: I.Star,   path: '/lecturer/quizzes'       },
  { label: 'Chat Logs',        Icon: I.Chat,   path: '/lecturer/chat-logs'     },
  { label: 'Live Monitor',     Icon: I.Eye,    path: '/lecturer/live-monitor'  },
  { label: 'Live Q&A',         Icon: I.Mic,    path: '/lecturer/live-qna'      },
]

export default function LecturerLayout() {
  const { user, logout } = useAuth()
  const navigate          = useNavigate()
  const location          = useLocation()
  const [urlParams]       = useSearchParams()
  const [courses,     setCourses]     = useState([])
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    courseService.getMyCourses().then((r) => setCourses(r.data)).catch(() => {})
  }, [])

  const isActive       = (path) => location.pathname === path
  const activeCourseId = location.pathname === '/lecturer/courses' ? urlParams.get('course') : null

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#F0F0F2' }}>

      {/* ══ SIDEBAR ══ */}
      {sidebarOpen && (
        <aside className="flex flex-col h-full w-56 shrink-0"
          style={{ backgroundColor: '#F0F0F2', borderRight: '1px solid #D2D4D9' }}>

          {/* Brand */}
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/lecturer/dashboard')}>
              <I.Logo />
              <span className="text-sm font-semibold text-gray-800 tracking-tight">LecturaMind</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-gray-700 transition-colors">
              <I.Toggle />
            </button>
          </div>

          {/* Home + My Profile */}
          <nav className="px-3 mt-1 flex flex-col gap-0.5">
            <button
              onClick={() => navigate('/lecturer/dashboard')}
              className={`flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/lecturer/dashboard') ? 'bg-white text-gray-900' : 'text-gray-600 hover:bg-white'
              }`}>
              <I.Home /> Home
            </button>
            <button
              onClick={() => navigate('/lecturer/profile')}
              className={`flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/lecturer/profile') ? 'bg-white text-gray-900' : 'text-gray-600 hover:bg-white'
              }`}>
              <I.User /> My Profile
            </button>
          </nav>

          {/* My Courses */}
          <div className="px-3 mt-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">My Courses</p>
            <div className="flex flex-col gap-0.5 max-h-32 overflow-y-auto">
              {!courses.length
                ? <p className="text-xs text-gray-400 px-3 py-1">No courses yet</p>
                : courses.map((c) => (
                  <button key={c.id} onClick={() => navigate(`/lecturer/courses?course=${c.id}`)}
                    className={`flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg text-sm transition-colors truncate ${
                      activeCourseId === c.id
                        ? 'bg-white text-gray-900 font-medium'
                        : 'text-gray-600 hover:bg-white'
                    }`}>
                    <span className="shrink-0"><I.Folder /></span>
                    <span className="truncate">{c.course_name}</span>
                  </button>
                ))
              }
            </div>
            {/* New Course button — same dashed style as the second sidebar had */}
            <button
              onClick={() => navigate('/lecturer/courses?new=1')}
              className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-white transition-colors"
              style={{ border: '1.5px dashed #D2D4D9' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              New Course
            </button>
          </div>

          {/* Management */}
          <div className="px-3 mt-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">Management</p>
            <div className="flex flex-col gap-0.5">
              {navItems.map(({ label, Icon, path }) => (
                <button key={path} onClick={() => navigate(path)}
                  className={`flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive(path) ? 'bg-white text-gray-900 font-medium' : 'text-gray-600 hover:bg-white'
                  }`}>
                  <Icon /> {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1" />

          {/* User profile (clickable → profile page) */}
          <div className="mx-3 mb-4 px-3 py-3 rounded-xl flex items-center gap-2.5"
            style={{ backgroundColor: '#D2D4D9' }}>
            <button onClick={() => navigate('/lecturer/profile')}
              className="flex items-center gap-2.5 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity">
              <div className="h-7 w-7 rounded-full bg-gray-700 text-white flex items-center justify-center text-xs font-bold shrink-0">
                {user?.full_name?.[0] || 'L'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">{user?.full_name}</p>
                <p className="text-xs text-gray-500">{user?.user_id_number}</p>
              </div>
            </button>
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
