/**
 * Sidebar.jsx — Role-based navigation sidebar.
 */

import { NavLink } from 'react-router-dom'
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
  const links = user?.role === 'lecturer' ? lecturerLinks : studentLinks

  return (
    <aside className="w-64 min-h-screen bg-white border-r border-gray-200 flex flex-col py-6 shrink-0">
      <nav className="flex flex-col gap-1 px-3">
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
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
        ))}
      </nav>
    </aside>
  )
}
