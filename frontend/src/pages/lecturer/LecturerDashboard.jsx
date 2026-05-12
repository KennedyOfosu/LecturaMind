/**
 * LecturerDashboard.jsx — Full summary dashboard.
 * Top: greeting + horizontal stats row.
 * Below: summary cards — Students, Announcements, Chat Logs, Materials, Live Monitor.
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

/* ── Inline icons ── */
const Icon = {
  Folder:  () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>,
  Users:   () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  Chat:    () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  Star:    () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  Flag:    () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>,
  Upload:  () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  Bell:    () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
  Eye:     () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  File:    () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  ArrowRight: () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  Dot:     () => <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />,
}

/* Section card wrapper */
function SectionCard({ title, icon, linkLabel, onLink, children }) {
  return (
    <div className="rounded-2xl overflow-hidden flex flex-col h-full" style={{ backgroundColor: '#fff', border: '1px solid #D2D4D9' }}>
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#F0F0F2' }}>
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          {icon} {title}
        </div>
        {linkLabel && (
          <button onClick={onLink} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors">
            {linkLabel} <Icon.ArrowRight />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}

export default function LecturerDashboard() {
  const { user }   = useAuth()
  const { socket } = useSocket()
  const navigate   = useNavigate()
  const firstName  = user?.full_name?.split(' ')[0] || 'Lecturer'

  const [stats,         setStats]         = useState(null)
  const [courses,       setCourses]       = useState([])
  const [allStudents,   setAllStudents]   = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [chatLogs,      setChatLogs]      = useState([])
  const [materials,     setMaterials]     = useState([])
  const [onlineCount,   setOnlineCount]   = useState(0)
  const [onlineUsers,   setOnlineUsers]   = useState([])
  const [loading,       setLoading]       = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/api/dashboard/lecturer/stats'),
      courseService.getMyCourses(),
    ]).then(async ([statsRes, coursesRes]) => {
      setStats(statsRes.data)
      const fetchedCourses = coursesRes.data
      setCourses(fetchedCourses)

      if (fetchedCourses.length) {
        const firstId = fetchedCourses[0].id

        // Fetch secondary data from first course
        const [annRes, chatRes, matRes] = await Promise.all([
          api.get(`/api/announcements/course/${firstId}`).catch(() => ({ data: [] })),
          api.get(`/api/chatbot/logs/${firstId}`).catch(() => ({ data: [] })),
          api.get(`/api/materials/course/${firstId}`).catch(() => ({ data: [] })),
        ])
        setAnnouncements(annRes.data.slice(0, 4))
        setChatLogs(chatRes.data.slice(0, 5))
        setMaterials(matRes.data.slice(0, 4))

        // Fetch students from all courses
        const studentPromises = fetchedCourses.map((c) =>
          api.get(`/api/courses/${c.id}/students`)
            .then((r) => r.data.map((s) => ({ ...s, course_name: c.course_name })))
            .catch(() => [])
        )
        const studentArrays = await Promise.all(studentPromises)
        setAllStudents(studentArrays.flat().slice(0, 8))
      }
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!socket) return
    socket.on('active_users_updated', (users) => {
      setOnlineUsers(users)
      setOnlineCount(users.length)
    })
    return () => socket.off('active_users_updated')
  }, [socket])

  const statCards = [
    { label: 'Total Courses',    value: stats?.total_courses,    Icon: Icon.Folder, path: '/lecturer/courses' },
    { label: 'Total Students',   value: stats?.total_students,   Icon: Icon.Users,  path: '/lecturer/courses' },
    { label: 'Queries Today',    value: stats?.queries_today,    Icon: Icon.Chat,   path: '/lecturer/chat-logs' },
    { label: 'Active Quizzes',   value: stats?.active_quizzes,   Icon: Icon.Star,   path: '/lecturer/quizzes' },
    { label: 'Flagged Messages', value: stats?.flagged_messages, Icon: Icon.Flag,   path: '/lecturer/chat-logs' },
  ]

  const timeAgo = (ts) => {
    if (!ts) return ''
    const diff = Math.floor((Date.now() - new Date(ts)) / 60000)
    if (diff < 1) return 'just now'
    if (diff < 60) return `${diff}m ago`
    return `${Math.floor(diff / 60)}h ago`
  }

  return (
    <div className="flex flex-col gap-6 h-full">

      {/* ── Greeting ── */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{getGreeting()}, {firstName}</h1>
        <p className="text-sm text-gray-500 mt-0.5">Here's a summary of your platform today</p>
      </div>

      {/* ── Horizontal Stats Row ── */}
      <div className="grid grid-cols-5 gap-3">
        {statCards.map(({ label, value, Icon: Ic, path }) => (
          <button key={label} onClick={() => navigate(path)}
            className="flex items-center gap-3 px-4 py-4 rounded-2xl text-left transition-all hover:shadow-sm active:scale-[0.98]"
            style={{ backgroundColor: '#fff', border: '1px solid #D2D4D9' }}>
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#F0F0F2' }}>
              <Ic />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 leading-tight">{loading ? '—' : (value ?? 0)}</p>
              <p className="text-xs text-gray-500 leading-tight">{label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* ── Summary Grid ── */}
      <div className="grid grid-cols-3 gap-4 flex-1 min-h-0" style={{ gridTemplateRows: 'auto auto' }}>

        {/* Students Table (spans 2 cols, 1 row) */}
        <div className="col-span-2">
          <SectionCard title="Enrolled Students" icon={<Icon.Users />} linkLabel="View all" onLink={() => navigate('/lecturer/courses')}>
            {!allStudents.length ? (
              <p className="text-xs text-gray-400 text-center py-8">No students enrolled yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: '#F0F0F2' }}>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500">Student</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500">Course</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: '#F0F0F2' }}>
                  {allStudents.map((s, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-bold shrink-0">
                            {s.full_name?.[0] || '?'}
                          </div>
                          <span className="font-medium text-gray-800">{s.full_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{s.course_name}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                          Enrolled
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </SectionCard>
        </div>

        {/* Live Monitor (1 col) */}
        <div>
          <SectionCard title="Live Monitor" icon={<Icon.Eye />} linkLabel="Open" onLink={() => navigate('/lecturer/live-monitor')}>
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center text-2xl font-bold text-emerald-700">
                  {onlineCount}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {onlineCount === 0 ? 'No one online' : `${onlineCount} online now`}
                  </p>
                  <p className="text-xs text-gray-400">across all courses</p>
                </div>
              </div>
              {onlineUsers.length > 0 && (
                <div className="flex flex-col gap-2">
                  {onlineUsers.slice(0, 4).map((u, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                      <Icon.Dot /> {u.name || 'Student'}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>
        </div>

        {/* Announcements (1 col) */}
        <div>
          <SectionCard title="Announcements" icon={<Icon.Bell />} linkLabel="Manage" onLink={() => navigate('/lecturer/announcements')}>
            {!announcements.length ? (
              <p className="text-xs text-gray-400 text-center py-8">No announcements yet</p>
            ) : (
              <div className="divide-y" style={{ borderColor: '#F0F0F2' }}>
                {announcements.map((a) => (
                  <div key={a.id} className="px-5 py-3">
                    <p className="text-sm font-medium text-gray-800 truncate">{a.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{timeAgo(a.posted_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Chat Logs (1 col) */}
        <div>
          <SectionCard title="Recent Chats" icon={<Icon.Chat />} linkLabel="View logs" onLink={() => navigate('/lecturer/chat-logs')}>
            {!chatLogs.length ? (
              <p className="text-xs text-gray-400 text-center py-8">No chat activity yet</p>
            ) : (
              <div className="divide-y" style={{ borderColor: '#F0F0F2' }}>
                {chatLogs.map((log) => (
                  <div key={log.id} className="px-5 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-5 w-5 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-bold">
                        {log.profiles?.full_name?.[0] || '?'}
                      </div>
                      <span className="text-xs font-medium text-gray-700">{log.profiles?.full_name || 'Student'}</span>
                      <span className="text-xs text-gray-400 ml-auto">{timeAgo(log.timestamp)}</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{log.query}</p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Materials (1 col) */}
        <div>
          <SectionCard title="Recent Materials" icon={<Icon.File />} linkLabel="Upload" onLink={() => navigate('/lecturer/materials')}>
            {!materials.length ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <p className="text-xs text-gray-400">No materials uploaded yet</p>
                <button onClick={() => navigate('/lecturer/materials')}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  style={{ backgroundColor: '#F0F0F2', color: '#374151' }}>
                  <Icon.Upload /> Upload Material
                </button>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: '#F0F0F2' }}>
                {materials.map((m) => (
                  <div key={m.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#F0F0F2' }}>
                      <Icon.File />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{m.file_name}</p>
                      <p className="text-xs text-gray-400 uppercase">{m.file_type}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

      </div>
    </div>
  )
}
