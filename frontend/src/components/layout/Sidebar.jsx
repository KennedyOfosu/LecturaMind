/**
 * Sidebar.jsx — Role-based navigation sidebar.
 */

import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const lecturerLinks = [
  { to: '/lecturer/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/lecturer/courses', label: 'Courses', icon: '📚' },
  { to: '/lecturer/materials', label: 'Materials', icon: '📄' },
  { to: '/lecturer/announcements', label: 'Announcements', icon: '📢' },
  { to: '/lecturer/chat-logs', label: 'Chat Logs', icon: '💬' },
  { to: '/lecturer/quizzes', label: 'Quizzes', icon: '📝' },
  { to: '/lecturer/live-monitor', label: 'Live Monitor', icon: '👁️' },
  { to: '/lecturer/live-qna', label: 'Live Q&A', icon: '🎙️' },
]

const studentLinks = [
  { to: '/student/dashboard', label: 'Dashboard', icon: '🏠' },
]

export function Sidebar() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const links = user?.role === 'lecturer' ? lecturerLinks : studentLinks

  return (
    <aside className="w-64 min-h-screen bg-white border-r border-gray-200 flex flex-col py-6 shrink-0">
      <nav className="flex flex-col gap-1 px-3">
        {links.map(({ to, label, icon }) => (
          <div key={to}>
            <NavLink
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-navy text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-navy'
                }`
              }
            >
              <span className="text-base">{icon}</span>
              {label}
            </NavLink>

            {/* New Course sub-button — only shown under the Courses link for lecturers */}
            {to === '/lecturer/courses' && user?.role === 'lecturer' && (
              <button
                onClick={() => navigate('/lecturer/courses?new=1')}
                className="w-full flex items-center gap-2 pl-10 pr-3 py-1.5 text-xs font-medium text-gray-500 hover:text-navy hover:bg-gray-100 rounded-lg transition-colors mt-0.5"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                New Course
              </button>
            )}
          </div>
        ))}
      </nav>
    </aside>
  )
}
