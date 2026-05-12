/**
 * LecturerDashboard.jsx — Synapse-inspired layout for lecturers.
 * Light theme: #F0F0F2 bg, #D2D4D9 borders. SVG icons, no emojis.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
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
    <svg width="24" height="20" viewBox="0 0 40 32" fill="none">
      <path d="M2 30L20 4L38 30" stroke="#111" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 30L20 14L30 30" stroke="#111" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Sidebar: () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>
    </svg>
  ),
  Home: () => (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  Folder: () => (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
    </svg>
  ),
  PlusCircle: () => (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
  ),
  Upload: () => (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  Bell: () => (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
    </svg>
  ),
  Sparkle: () => (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  MessageSquare: () => (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  ),
  Eye: () => (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  Mic: () => (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/>
    </svg>
  ),
  Users: () => (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  ),
  Logout: () => (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
}

const managementActions = [
  { label: 'Create Course',       Icon: Icons.PlusCircle,     path: '/lecturer/courses'       },
  { label: 'Upload Materials',    Icon: Icons.Upload,          path: '/lecturer/materials'     },
  { label: 'Announcements',       Icon: Icons.Bell,            path: '/lecturer/announcements' },
  { label: 'Generate Quiz',       Icon: Icons.Sparkle,         path: '/lecturer/quizzes'       },
  { label: 'Chat Logs',           Icon: Icons.MessageSquare,   path: '/lecturer/chat-logs'     },
  { label: 'Live Monitor',        Icon: Icons.Eye,             path: '/lecturer/live-monitor'  },
  { label: 'Live Q&A',            Icon: Icons.Mic,             path: '/lecturer/live-qna'      },
]

export default function LecturerDashboard() {
  const { user, logout } = useAuth()
  const navigate          = useNavigate()

  const [courses,     setCourses]     = useState([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [stats,       setStats]       = useState(null)

  const firstName = user?.full_name?.split(' ')[0] || 'Lecturer'

  useEffect(() => {
    courseService.getMyCourses()
      .then((res) => setCourses(res.data))
      .catch(() => {})

    api.get('/api/dashboard/lecturer/stats')
      .then((res) => setStats(res.data))
      .catch(() => {})
  }, [])

  const statCards = stats ? [
    { label: 'Courses',          value: stats.total_courses,    Icon: Icons.Folder        },
    { label: 'Students',         value: stats.total_students,   Icon: Icons.Users         },
    { label: 'Queries Today',    value: stats.queries_today,    Icon: Icons.MessageSquare },
    { label: 'Active Quizzes',   value: stats.active_quizzes,   Icon: Icons.Sparkle       },
    { label: 'Flagged Messages', value: stats.flagged_messages, Icon: Icons.Eye           },
  ] : []

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#F0F0F2' }}>

      {/* ══ SIDEBAR ══ */}
      {sidebarOpen && (
        <aside className="flex flex-col h-full w-56 shrink-0"
          style={{ backgroundColor: '#F0F0F2', borderRight: '1px solid #D2D4D9' }}>

          {/* Brand */}
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2">
              <Icons.Logo />
              <span className="text-sm font-semibold text-gray-800 tracking-tight">LecturaMind</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-gray-700 transition-colors">
              <Icons.Sidebar />
            </button>
          </div>

          {/* Home */}
          <nav className="px-3 mt-1">
            <button onClick={() => navigate('/lecturer/dashboard')}
              className="flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-white transition-colors">
              <Icons.Home /> Home
            </button>
          </nav>

          {/* My Courses */}
          <div className="px-3 mt-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">My Courses</p>
            <div className="flex flex-col gap-0.5 max-h-36 overflow-y-auto">
              {!courses.length ? (
                <p className="text-xs text-gray-400 px-3 py-2">No courses yet</p>
              ) : courses.map((c) => (
                <button key={c.id}
                  onClick={() => navigate('/lecturer/courses')}
                  className="flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-white transition-colors truncate">
                  <span className="shrink-0"><Icons.Folder /></span>
                  <span className="truncate">{c.course_name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Management */}
          <div className="px-3 mt-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">Management</p>
            <div className="flex flex-col gap-0.5">
              {managementActions.map(({ label, Icon, path }) => (
                <button key={path}
                  onClick={() => navigate(path)}
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
            <div className="h-7 w-7 rounded-full bg-gray-700 text-white flex items-center justify-center text-xs font-bold shrink-0">
              {user?.full_name?.[0] || 'L'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 truncate">{user?.full_name}</p>
              <p className="text-xs text-gray-500">{user?.user_id_number}</p>
            </div>
            <button onClick={logout} title="Logout" className="text-gray-400 hover:text-gray-700 transition-colors shrink-0">
              <Icons.Logout />
            </button>
          </div>
        </aside>
      )}

      {/* ══ MAIN CONTENT ══ */}
      <main className="flex-1 flex flex-col items-center justify-center px-8 py-12 overflow-y-auto relative">

        {!sidebarOpen && (
          <button onClick={() => setSidebarOpen(true)}
            className="absolute top-4 left-4 text-gray-500 hover:text-gray-800 transition-colors">
            <Icons.Sidebar />
          </button>
        )}

        {/* Greeting */}
        <h1 className="text-3xl font-semibold text-gray-900 mb-1.5 text-center">
          {getGreeting()}, {firstName}
        </h1>
        <p className="text-gray-500 text-base mb-12 text-center">
          What would you like to manage today?
        </p>

        {/* Stats row */}
        {stats && (
          <div className="flex flex-wrap justify-center gap-3 w-full max-w-2xl">
            {statCards.map(({ label, value, Icon }) => (
              <div key={label}
                className="flex items-center gap-3 px-5 py-4 rounded-2xl min-w-[140px]"
                style={{ backgroundColor: '#fff', border: '1px solid #D2D4D9' }}>
                <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: '#F0F0F2' }}>
                  <Icon />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">{value ?? 0}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
