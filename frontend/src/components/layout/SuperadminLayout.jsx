import { useState } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import '../../components/ui/superadmin-tables.css'

const I = {
  Logo: () => (
    <svg width="20" height="16" viewBox="0 0 40 32" fill="none">
      <path d="M2 30L20 4L38 30" stroke="#111827" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 30L20 14L30 30" stroke="#315dff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Toggle: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>
    </svg>
  ),
  Home: () => (<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>),
  Users: () => (<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>),
  Courses: () => (<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>),
  Building: () => (<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><line x1="8" y1="6" x2="10" y2="6"/><line x1="14" y1="6" x2="16" y2="6"/></svg>),
  Link: () => (<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>),
  Calendar: () => (<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>),
  Shield: () => (<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>),
  File: () => (<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>),
  Logout: () => (<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>),
}

const navItems = [
  { label: 'Dashboard',  Icon: I.Home,     path: '/superadmin/dashboard' },
  { label: 'Users',      Icon: I.Users,    path: '/superadmin/users' },
  { label: 'Courses',    Icon: I.Courses,  path: '/superadmin/courses' },
  { label: 'Classrooms', Icon: I.Building, path: '/superadmin/classrooms' },
  { label: 'Allocations',Icon: I.Link,     path: '/superadmin/allocations' },
  { label: 'Enrolments', Icon: I.Users,    path: '/superadmin/enrolments' },
  { label: 'Academics',  Icon: I.Calendar, path: '/superadmin/academics' },
  { label: 'Reports',    Icon: I.File,     path: '/superadmin/report-cards' },
]

export default function SuperadminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const isActive = (path) => location.pathname === path

  const sidebarContent = (collapsed) => (
    <>
      <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-4 py-5`}>
        <div className={`flex items-center gap-2.5 cursor-pointer ${collapsed ? 'hidden' : ''}`}
          onClick={() => navigate('/superadmin/dashboard')}>
          <img src="/LecturaMind Logo.svg" alt="LecturaMind" className="h-7 w-auto" />
        </div>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} className="text-gray-400 hover:text-gray-700 transition-colors">
          <I.Toggle />
        </button>
      </div>

      <div className={`${collapsed ? 'px-2' : 'px-3'} mt-4`}>
        {!collapsed && <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">ADMINISTRATION</p>}
        <nav className="flex flex-col gap-0.5">
          {navItems.map(({ label, Icon, path }) => (
            <button key={path} onClick={() => navigate(path)} title={collapsed ? label : undefined}
              className={`flex items-center gap-2.5 w-full text-left ${collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'} rounded-lg text-sm font-medium transition-colors ${
                isActive(path)
                ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white'
              }`}>
              <Icon />
              {!collapsed && label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1" />

      <div className={`mx-3 mb-4 px-3 py-3 rounded-xl flex items-center gap-2.5 ${collapsed ? 'justify-center' : ''}`}
        style={{ backgroundColor: '#D2D4D9' }}>
        {collapsed ? (
          <button onClick={logout} title="Logout" className="text-gray-500 hover:text-gray-300">
            <I.Logout />
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="h-7 w-7 rounded-full bg-gray-700 text-white flex items-center justify-center text-xs font-bold shrink-0">
                {user?.full_name?.[0] || 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">{user?.full_name}</p>
                <p className="text-xs text-gray-500">{user?.user_id_number}</p>
              </div>
            </div>
            <button onClick={logout} title="Logout" className="text-gray-500 hover:text-gray-300 shrink-0">
              <I.Logout />
            </button>
          </>
        )}
      </div>
    </>
  )

  return (
    <div className="superadmin-shell flex h-screen overflow-hidden" style={{ backgroundColor: '#F0F0F2' }}>
      <aside className={`flex flex-col h-full ${sidebarOpen ? 'w-56' : 'w-14'} shrink-0`}
        style={{ backgroundColor: '#F0F0F2', borderRight: '1px solid #D2D4D9' }}>
        {sidebarContent(!sidebarOpen)}
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 min-h-full">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
