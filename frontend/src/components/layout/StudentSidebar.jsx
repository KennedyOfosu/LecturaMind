/**
 * StudentSidebar.jsx — Unified sidebar for all student pages.
 * Shows navigation + collapsible course session groups.
 * Used by StudentLayout (which wraps every student route).
 */

import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { courseService } from '../../services/courseService'
import { useSessions } from '../../context/SessionsContext'

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
  User: () => (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  Logout: () => (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
      <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  Chevron: ({ open }) => (
    <svg className={`h-3 w-3 shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
}

/* ── Collapsible course session group ── */
function CourseSessionGroup({ course, sessions, defaultOpen }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const navigate = useNavigate()

  return (
    <div>
      {/* Course header row */}
      <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-white transition-colors">
        <button onClick={() => setIsOpen((v) => !v)}
          className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
          <I.Chevron open={isOpen} />
          <span className="text-xs font-semibold text-gray-600 truncate uppercase tracking-wide">
            {course.course_name}
          </span>
        </button>
        <button onClick={() => navigate(`/student/courses/${course.id}`)}
          className="text-xs text-gray-400 hover:text-gray-600 shrink-0 px-1" title="Open course">
          →
        </button>
      </div>

      {/* Session entries */}
      {isOpen && sessions.length > 0 && (
        <div className="ml-5 mt-0.5 flex flex-col gap-0.5">
          {sessions.slice(0, 5).map((s) => (
            <button key={s.id}
              onClick={() => navigate(`/student/courses/${course.id}?session=${s.id}`)}
              className="w-full text-left px-2 py-1.5 rounded-md text-xs text-gray-500 hover:text-gray-800 hover:bg-white transition-colors truncate">
              {s.query && s.query.length > 35 ? s.query.slice(0, 35) + '…' : s.query}
            </button>
          ))}
          {sessions.length > 5 && (
            <button onClick={() => navigate(`/student/courses/${course.id}`)}
              className="w-full text-left px-2 py-1 text-xs text-gray-400 hover:text-gray-600">
              See more →
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Sidebar ── */
export default function StudentSidebar({ open, onToggle }) {
  const { user, logout }     = useAuth()
  const { sessions, refreshSessions } = useSessions()
  const navigate             = useNavigate()
  const location             = useLocation()
  const [courses, setCourses] = useState([])

  useEffect(() => {
    courseService.getEnrolled().then((r) => setCourses(r.data)).catch(() => {})
    refreshSessions()
  }, [refreshSessions])

  if (!open) return null

  const isActive = (path) => location.pathname === path

  // Find the course with the most recent session
  const mostRecentCourseId = sessions[0]?.course_id

  return (
    <aside className="flex flex-col h-full w-56 shrink-0"
      style={{ backgroundColor: '#F0F0F2', borderRight: '1px solid #D2D4D9' }}>

      {/* Brand */}
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/student/dashboard')}>
          <I.Logo />
          <span className="text-sm font-semibold text-gray-800 tracking-tight">LecturaMind</span>
        </div>
        <button onClick={onToggle} className="text-gray-400 hover:text-gray-700 transition-colors">
          <I.Toggle />
        </button>
      </div>

      {/* Top nav */}
      <nav className="px-3 mt-1 flex flex-col gap-0.5">
        <button onClick={() => navigate('/student/dashboard')}
          className={`flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            isActive('/student/dashboard') ? 'bg-white text-gray-900' : 'text-gray-600 hover:bg-white'
          }`}>
          <I.Home /> Home
        </button>
        <button onClick={() => navigate('/student/profile')}
          className={`flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            isActive('/student/profile') ? 'bg-white text-gray-900' : 'text-gray-600 hover:bg-white'
          }`}>
          <I.User /> My Profile
        </button>
      </nav>

      {/* My Courses — collapsible with session groups */}
      <div className="px-3 mt-5 flex flex-col min-h-0 overflow-y-auto flex-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">
          My Courses
        </p>
        {!courses.length ? (
          <p className="text-xs text-gray-400 px-3 py-2">No courses yet</p>
        ) : (
          <div className="flex flex-col gap-1">
            {courses.map((course) => {
              const courseSessions = sessions.filter((s) => s.course_id === course.id)
              return (
                <CourseSessionGroup
                  key={course.id}
                  course={course}
                  sessions={courseSessions}
                  defaultOpen={course.id === mostRecentCourseId}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* User card + logout */}
      <div className="mx-3 mb-4 px-3 py-3 rounded-xl flex items-center gap-2.5 shrink-0"
        style={{ backgroundColor: '#D2D4D9' }}>
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
        <button onClick={logout} title="Logout" className="text-gray-400 hover:text-gray-700 shrink-0">
          <I.Logout />
        </button>
      </div>
    </aside>
  )
}
