/**
 * LecturerDashboard.jsx — Content only. Sidebar comes from LecturerLayout.
 * Layout: greeting + horizontal stats → summary card grid with clean padding.
 */

import { useState, useEffect } from 'react'
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
const Ic = {
  Folder:  () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>,
  Users:   () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  Chat:    () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  Star:    () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  Flag:    () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>,
  File:    () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  Bell:    () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
  Eye:     () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  Upload:  () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  Arrow:   () => <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
}

/* Reusable summary card */
function Card({ title, Icon, linkText, onLink, children }) {
  return (
    <div className="rounded-2xl flex flex-col overflow-hidden h-full"
      style={{ backgroundColor: '#fff', border: '1px solid #D2D4D9' }}>
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#F0F0F2' }}>
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <Icon /> {title}
        </div>
        {linkText && (
          <button onClick={onLink}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors">
            {linkText} <Ic.Arrow />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}

const timeAgo = (ts) => {
  if (!ts) return ''
  const m = Math.floor((Date.now() - new Date(ts)) / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

export default function LecturerDashboard() {
  const { user }   = useAuth()
  const { socket } = useSocket()
  const navigate   = useNavigate()
  const firstName  = user?.full_name?.split(' ')[0] || 'Lecturer'

  const [stats,         setStats]         = useState(null)
  const [allStudents,   setAllStudents]   = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [chatLogs,      setChatLogs]      = useState([])
  const [materials,     setMaterials]     = useState([])
  const [onlineUsers,   setOnlineUsers]   = useState([])
  const [loading,       setLoading]       = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/api/dashboard/lecturer/stats'),
      courseService.getMyCourses(),
    ]).then(async ([statsRes, coursesRes]) => {
      setStats(statsRes.data)
      const courses = coursesRes.data

      if (courses.length) {
        const firstId = courses[0].id
        const [annRes, chatRes, matRes, ...studentArrs] = await Promise.all([
          api.get(`/api/announcements/course/${firstId}`).catch(() => ({ data: [] })),
          api.get(`/api/chatbot/logs/${firstId}`).catch(() => ({ data: [] })),
          api.get(`/api/materials/course/${firstId}`).catch(() => ({ data: [] })),
          ...courses.map((c) =>
            api.get(`/api/courses/${c.id}/students`)
              .then((r) => r.data.map((s) => ({ ...s, course_name: c.course_name })))
              .catch(() => [])
          ),
        ])
        setAnnouncements(annRes.data.slice(0, 4))
        setChatLogs(chatRes.data.slice(0, 5))
        setMaterials(matRes.data.slice(0, 4))
        setAllStudents(studentArrs.flat().slice(0, 8))
      }
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!socket) return
    socket.on('active_users_updated', setOnlineUsers)
    return () => socket.off('active_users_updated')
  }, [socket])

  const statCards = [
    { label: 'Total Courses',    value: stats?.total_courses,    Icon: Ic.Folder, path: '/lecturer/courses'    },
    { label: 'Total Students',   value: stats?.total_students,   Icon: Ic.Users,  path: '/lecturer/courses'    },
    { label: 'Queries Today',    value: stats?.queries_today,    Icon: Ic.Chat,   path: '/lecturer/chat-logs'  },
    { label: 'Active Quizzes',   value: stats?.active_quizzes,   Icon: Ic.Star,   path: '/lecturer/quizzes'    },
    { label: 'Flagged Messages', value: stats?.flagged_messages, Icon: Ic.Flag,   path: '/lecturer/chat-logs'  },
  ]

  return (
    /* Clean padding — sidebar is handled by LecturerLayout */
    <div className="flex flex-col gap-6">

      {/* ── Greeting ── */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          {getGreeting()}, {firstName}
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">Here's a summary of your platform today</p>
      </div>

      {/* ── Stats row — 5 cards horizontally ── */}
      <div className="grid grid-cols-5 gap-3">
        {statCards.map(({ label, value, Icon, path }) => (
          <button key={label} onClick={() => navigate(path)}
            className="flex items-center gap-3 px-4 py-4 rounded-2xl text-left transition-all hover:shadow-md active:scale-[0.98]"
            style={{ backgroundColor: '#fff', border: '1px solid #D2D4D9' }}>
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: '#F0F0F2' }}>
              <Icon />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 leading-tight">
                {loading ? '—' : (value ?? 0)}
              </p>
              <p className="text-xs text-gray-400 leading-tight">{label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* ── Summary grid ── */}
      <div className="grid grid-cols-3 gap-4">

        {/* Students table — spans 2 columns */}
        <div className="col-span-2" style={{ minHeight: 280 }}>
          <Card title="Enrolled Students" Icon={Ic.Users} linkText="Manage courses" onLink={() => navigate('/lecturer/courses')}>
            {!allStudents.length ? (
              <div className="flex items-center justify-center h-32 text-xs text-gray-400">
                No students enrolled yet
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: '#F0F0F2' }}>
                    {['Student', 'Course', 'Status'].map((h) => (
                      <th key={h} className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allStudents.map((s, i) => (
                    <tr key={i} className="border-t hover:bg-gray-50 transition-colors" style={{ borderColor: '#F0F0F2' }}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-bold shrink-0">
                            {s.full_name?.[0] || '?'}
                          </div>
                          <span className="font-medium text-gray-800 text-sm">{s.full_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-500">{s.course_name}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center text-xs text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full font-medium">
                          Enrolled
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        {/* Live Monitor — 1 column */}
        <div style={{ minHeight: 280 }}>
          <Card title="Live Monitor" Icon={Ic.Eye} linkText="Open" onLink={() => navigate('/lecturer/live-monitor')}>
            <div className="p-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl flex items-center justify-center text-2xl font-bold"
                  style={{ backgroundColor: onlineUsers.length ? '#ecfdf5' : '#F0F0F2',
                           color: onlineUsers.length ? '#059669' : '#9ca3af' }}>
                  {onlineUsers.length}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {onlineUsers.length === 0 ? 'No one online' : `${onlineUsers.length} online`}
                  </p>
                  <p className="text-xs text-gray-400">across all courses</p>
                </div>
              </div>
              {onlineUsers.slice(0, 5).map((u, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                  {u.name || 'Student'}
                </div>
              ))}
              {!onlineUsers.length && (
                <p className="text-xs text-gray-400">Students will appear here when they log in</p>
              )}
            </div>
          </Card>
        </div>

        {/* Announcements */}
        <div style={{ minHeight: 220 }}>
          <Card title="Announcements" Icon={Ic.Bell} linkText="Manage" onLink={() => navigate('/lecturer/announcements')}>
            {!announcements.length ? (
              <div className="flex items-center justify-center h-24 text-xs text-gray-400">No announcements yet</div>
            ) : (
              <div>
                {announcements.map((a) => (
                  <div key={a.id} className="px-5 py-3.5 border-t" style={{ borderColor: '#F0F0F2' }}>
                    <p className="text-sm font-medium text-gray-800 truncate">{a.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{timeAgo(a.posted_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Recent Chats */}
        <div style={{ minHeight: 220 }}>
          <Card title="Recent Chats" Icon={Ic.Chat} linkText="View logs" onLink={() => navigate('/lecturer/chat-logs')}>
            {!chatLogs.length ? (
              <div className="flex items-center justify-center h-24 text-xs text-gray-400">No chat activity yet</div>
            ) : (
              <div>
                {chatLogs.map((log) => (
                  <div key={log.id} className="px-5 py-3.5 border-t" style={{ borderColor: '#F0F0F2' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-5 w-5 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-bold shrink-0">
                        {log.profiles?.full_name?.[0] || '?'}
                      </div>
                      <span className="text-xs font-medium text-gray-700 flex-1 truncate">
                        {log.profiles?.full_name || 'Student'}
                      </span>
                      <span className="text-xs text-gray-400 shrink-0">{timeAgo(log.timestamp)}</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{log.query}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Materials */}
        <div style={{ minHeight: 220 }}>
          <Card title="Course Materials" Icon={Ic.File} linkText="Upload" onLink={() => navigate('/lecturer/materials')}>
            {!materials.length ? (
              <div className="flex flex-col items-center justify-center h-24 gap-2">
                <p className="text-xs text-gray-400">No materials uploaded yet</p>
                <button onClick={() => navigate('/lecturer/materials')}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
                  style={{ backgroundColor: '#F0F0F2', color: '#374151' }}>
                  <Ic.Upload /> Upload now
                </button>
              </div>
            ) : (
              <div>
                {materials.map((m) => (
                  <div key={m.id} className="px-5 py-3.5 border-t flex items-center gap-3" style={{ borderColor: '#F0F0F2' }}>
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: '#F0F0F2' }}>
                      <Ic.File />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{m.file_name}</p>
                      <p className="text-xs text-gray-400 uppercase">{m.file_type}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

      </div>
    </div>
  )
}
