/**
 * LecturerDashboard.jsx — Content only. Sidebar comes from LecturerLayout.
 * Layout: greeting + horizontal stats → summary card grid with clean padding.
 */

import { useState, useEffect, useMemo } from 'react'
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
    <div className="rounded-2xl flex flex-col overflow-hidden"
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
  if (m < 1440) return `${Math.floor(m / 60)}h ago`
  return `${Math.floor(m / 1440)}d ago`
}

const DAYS   = ['SUN','MON','TUE','WED','THU','FRI','SAT']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const SHORT_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function announcementStatus(postedAt) {
  const days = (Date.now() - new Date(postedAt)) / 86400000
  if (days < 2)  return { label:'New',    bg:'#dcfce7', color:'#15803d' }
  if (days < 7)  return { label:'Recent', bg:'#dbeafe', color:'#1d4ed8' }
  if (days < 30) return { label:'Posted', bg:'#f3f4f6', color:'#6b7280' }
  return               { label:'Archived',bg:'#fef9c3', color:'#a16207' }
}

function AnnouncementsCalendarCard({ announcements, onManage }) {
  const today = new Date()
  const [viewYear,  setViewYear]  = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  /* days in current view that have announcements */
  const announcedDays = new Set(
    announcements.map(a => {
      const d = new Date(a.posted_at)
      if (d.getFullYear() === viewYear && d.getMonth() === viewMonth)
        return d.getDate()
      return null
    }).filter(Boolean)
  )

  /* build calendar grid */
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const prevDays    = new Date(viewYear, viewMonth, 0).getDate()
  const cells = []
  for (let i = firstDay - 1; i >= 0; i--)
    cells.push({ day: prevDays - i, cur: false })
  for (let i = 1; i <= daysInMonth; i++)
    cells.push({ day: i, cur: true })
  while (cells.length % 7 !== 0)
    cells.push({ day: cells.length - daysInMonth - firstDay + 1, cur: false })

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const isToday = (day, cur) =>
    cur && day === today.getDate() &&
    viewMonth === today.getMonth() && viewYear === today.getFullYear()

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col"
      style={{ backgroundColor:'#fff', border:'1px solid #D2D4D9' }}>

      {/* ── Calendar ── */}
      <div className="px-5 pt-4 pb-3">
        {/* Month header */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-800">
            {MONTHS[viewMonth]} <span className="text-gray-400 font-normal">{viewYear}</span>
          </p>
          <div className="flex items-center gap-1">
            <button onClick={prevMonth}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <span className="text-xs font-medium text-gray-500 px-1.5 py-0.5 rounded-lg border border-gray-200">
              Month
            </span>
            <button onClick={nextMonth}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {cells.map((cell, i) => (
            <div key={i} className="flex flex-col items-center py-0.5">
              <span className={`text-xs w-6 h-6 flex items-center justify-center rounded-full font-medium transition-colors
                ${!cell.cur ? 'text-gray-300' : isToday(cell.day, cell.cur)
                  ? 'bg-gray-900 text-white font-bold'
                  : 'text-gray-700 hover:bg-gray-100'
                }`}>
                {cell.day}
              </span>
              {/* dot for announcement days */}
              <span className={`w-1 h-1 rounded-full mt-0.5 ${
                cell.cur && announcedDays.has(cell.day) ? 'bg-blue-400' : 'invisible'
              }`}/>
            </div>
          ))}
        </div>
      </div>

      {/* ── Divider + Announcements header ── */}
      <div className="flex items-center justify-between px-5 py-3">
        <p className="text-sm font-semibold text-gray-800">Your announcements</p>
        <button onClick={onManage}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-colors"
          style={{ backgroundColor:'#111' }}>
          + Add new
        </button>
      </div>

      {/* ── Announcements list — 2 items visible, scrollable, no scrollbar ── */}
      <div
        className="px-3 flex flex-col gap-2 ann-list"
        style={{
          maxHeight: 150,
          overflowY: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {!announcements.length ? (
          <div className="flex items-center justify-center py-6 text-xs text-gray-400">
            No announcements yet
          </div>
        ) : announcements.map(a => {
          const d   = new Date(a.posted_at)
          const st  = announcementStatus(a.posted_at)
          const day = d.getDate()
          const dow = SHORT_DAYS[d.getDay()]
          return (
            <div key={a.id}
              className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-default"
              style={{ border: '1px solid #E5E7EB', backgroundColor: '#fff' }}
            >
              {/* date block */}
              <div className="flex flex-col items-center justify-center shrink-0 w-9">
                <span className="text-base font-bold text-gray-800 leading-none">{day}</span>
                <span className="text-[10px] font-semibold text-gray-400 uppercase">{dow}</span>
              </div>
              {/* content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate leading-tight">{a.title}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: st.bg, color: st.color }}>
                    {st.label}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-gray-400">
                    <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <rect x="3" y="4" width="18" height="18" rx="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    {d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'})} at {d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
        <div style={{ height: 8, flexShrink: 0 }} />
      </div>
    </div>
  )
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
  const [myCourseIds,   setMyCourseIds]   = useState([])
  const [loading,       setLoading]       = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/api/dashboard/lecturer/stats'),
      courseService.getMyCourses(),
    ]).then(async ([statsRes, coursesRes]) => {
      setStats(statsRes.data)
      const courses = coursesRes.data
      setMyCourseIds(courses.map((c) => c.id))

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
    // eslint-disable-next-line no-unused-vars
    const _deps = myCourseIds.length
    const onLegacy = (users) => setOnlineUsers(users || [])
    const onJoin = (data) => {
      setOnlineUsers((prev) => {
        const id = data.student_id || data.user_id
        if (prev.find((u) => (u.student_id || u.user_id) === id)) return prev
        return [...prev, { ...data, name: data.student_name || data.name }]
      })
    }
    const onLeave = (data) => {
      setOnlineUsers((prev) =>
        prev.filter((u) => (u.student_id || u.user_id) !== data.student_id)
      )
    }
    // Watch every course we own for presence updates
    myCourseIds.forEach((cid) => socket.emit('lecturer_watch_course', { course_id: cid }))

    socket.on('active_users_updated', onLegacy)
    socket.on('student_came_online', onJoin)
    socket.on('student_went_offline', onLeave)
    return () => {
      socket.off('active_users_updated', onLegacy)
      socket.off('student_came_online', onJoin)
      socket.off('student_went_offline', onLeave)
    }
  }, [socket, myCourseIds])

  const statCards = [
    { label: 'Total Courses',    short: 'Courses',  unit: 'courses',  value: stats?.total_courses,    Icon: Ic.Folder, path: '/lecturer/courses',   iconBg: '#eff6ff', iconColor: '#3b82f6' },
    { label: 'Total Students',   short: 'Students', unit: 'enrolled', value: stats?.total_students,   Icon: Ic.Users,  path: '/lecturer/courses',   iconBg: '#ecfdf5', iconColor: '#10b981' },
    { label: 'Queries Today',    short: 'AI Chats', unit: 'today',    value: stats?.queries_today,    Icon: Ic.Chat,   path: '/lecturer/chat-logs', iconBg: '#f5f3ff', iconColor: '#8b5cf6' },
    { label: 'Active Quizzes',   short: 'Quizzes',  unit: 'active',   value: stats?.active_quizzes,   Icon: Ic.Star,   path: '/lecturer/quizzes',   iconBg: '#fffbeb', iconColor: '#f59e0b' },
    { label: 'Flagged Messages', short: 'Flagged',  unit: 'messages', value: stats?.flagged_messages, Icon: Ic.Flag,   path: '/lecturer/chat-logs', iconBg: '#fef2f2', iconColor: '#ef4444' },
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
        {statCards.map(({ label, short, unit, value, Icon, path, iconBg, iconColor }) => (
          <button key={label} onClick={() => navigate(path)}
            className="flex flex-col justify-between p-5 rounded-2xl text-left transition-all hover:shadow-md active:scale-[0.98]"
            style={{ backgroundColor: '#fff', border: '1px solid #D2D4D9', minHeight: '140px' }}>

            {/* Top row: circular icon + short label with chevron */}
            <div className="flex items-start justify-between w-full">
              <div className="h-11 w-11 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: iconBg }}>
                <span style={{ color: iconColor }}><Icon /></span>
              </div>
              <span className="flex items-center gap-0.5 text-xs font-medium text-gray-400 mt-1">
                {short}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </span>
            </div>

            {/* Bottom: stat label + value */}
            <div className="mt-3">
              <p className="text-sm font-bold text-gray-900 leading-snug">{label}</p>
              <p className="text-sm mt-0.5">
                <span className="font-bold" style={{ color: iconColor }}>
                  {loading ? '—' : (value ?? 0)}
                </span>
                <span className="text-gray-400 font-normal text-xs ml-1">{unit}</span>
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* ── Summary grid: 2 cols left (students) + 1 col right (stacked cards) ── */}
      <div className="grid grid-cols-3 gap-4 items-start">

        {/* ── Enrolled Students — tall, spans 2 cols, fills height ── */}
        <div className="col-span-2 rounded-2xl overflow-hidden flex flex-col"
          style={{ backgroundColor: '#fff', border: '1px solid #D2D4D9' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#F0F0F2' }}>
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <Ic.Users /> Enrolled Students
            </div>
            <button onClick={() => navigate('/lecturer/courses')}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors">
              Manage courses <Ic.Arrow />
            </button>
          </div>

          {!allStudents.length ? (
            <div className="flex items-center justify-center py-16 text-xs text-gray-400">
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
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-bold shrink-0">
                          {s.full_name?.[0] || '?'}
                        </div>
                        <span className="font-medium text-gray-800 text-sm">{s.full_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-500">{s.course_name}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full font-medium">
                        Enrolled
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Right column: Live Monitor → Announcements → Materials (stacked) ── */}
        <div className="flex flex-col gap-4">

          {/* Live Monitor */}
          <Card title="Live Monitor" Icon={Ic.Eye} linkText="Open" onLink={() => navigate('/lecturer/live-monitor')}>
            <div className="p-5 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl flex items-center justify-center text-xl font-bold"
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
              {onlineUsers.slice(0, 4).map((u, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                  {u.name || 'Student'}
                </div>
              ))}
              {!onlineUsers.length && (
                <p className="text-xs text-gray-400">Students appear here when active</p>
              )}
            </div>
          </Card>

          {/* Announcements — calendar + event list */}
          <AnnouncementsCalendarCard
            announcements={announcements}
            onManage={() => navigate('/lecturer/announcements')}
          />


        </div>
      </div>
    </div>
  )
}
