/**
 * LecturerDashboard.jsx — Content only. Sidebar comes from LecturerLayout.
 * Layout: greeting + horizontal stats → summary card grid with clean padding.
 */

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useSocket } from '../../hooks/useSocket'
import { useToast } from '../../components/ui/Toast'
import { Modal } from '../../components/ui/Modal'
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

/* ── Live Monitor Card ──────────────────────────────────────── */
function LiveMonitorCard({ onlineUsers = [], onOpenFull }) {
  const ITEMS_PER_PAGE = 4
  const [page, setPage] = useState(0)
  const totalPages = Math.max(1, Math.ceil(onlineUsers.length / ITEMS_PER_PAGE))
  const safePage = Math.min(page, totalPages - 1)
  const paged = onlineUsers.slice(safePage * ITEMS_PER_PAGE, (safePage + 1) * ITEMS_PER_PAGE)
  const count = onlineUsers.length

  return (
    <div className="rounded-2xl flex flex-col overflow-hidden cursor-pointer transition-all hover:shadow-md active:scale-[0.99]"
      style={{ backgroundColor: '#fff', border: '1px solid #D2D4D9' }}
      onClick={onOpenFull}>
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#F0F0F2' }}>
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <Ic.Eye /> Live Monitor
        </div>
        <span className="flex items-center gap-1 text-xs text-gray-400">
          View all <Ic.Arrow />
        </span>
      </div>
      <div className="flex gap-4 px-5 py-4">
        {/* Left — count */}
        <div className="w-28 shrink-0 flex flex-col items-center justify-center text-center p-3 rounded-xl"
          style={{ backgroundColor: count ? '#ecfdf5' : '#F0F0F2' }}>
          <span className="text-3xl font-bold" style={{ color: count ? '#059669' : '#9ca3af' }}>
            {count}
          </span>
          <p className="text-xs font-semibold text-gray-800 mt-1">
            {count === 0 ? 'No one online' : `Active ${count === 1 ? 'Student' : 'Students'}`}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">across courses</p>
        </div>

        {/* Divider */}
        <div className="w-px shrink-0" style={{ backgroundColor: '#E5E7EB' }} />

        {/* Right — list */}
        <div className="flex-1 min-w-0">
          {count > 0 ? (
            <div className="flex flex-col">
              {paged.map((u, i) => {
                const name = u.student_name || u.name || 'Student'
                const idNum = u.id_number || u.student_id_number || ''
                const uid = u.student_id || u.user_id || i
                return (
                  <div key={uid} className="flex items-center gap-2.5 py-2 border-b last:border-0" style={{ borderColor: '#F0F0F2' }}>
                    <div className="h-7 w-7 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-bold shrink-0">
                      {name[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{name}</p>
                      {idNum && <p className="text-xs text-gray-400 truncate">{idNum}</p>}
                    </div>
                    <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-400 py-4 text-center">Students appear here when active</p>
          )}

          {count > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between pt-2">
              <button onClick={(e) => { e.stopPropagation(); setPage(p => Math.max(0, p - 1)) }}
                disabled={safePage === 0}
                className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                ← Previous
              </button>
              <span className="text-xs text-gray-400">{safePage + 1} of {totalPages}</span>
              <button onClick={(e) => { e.stopPropagation(); setPage(p => Math.min(totalPages - 1, p + 1)) }}
                disabled={safePage === totalPages - 1}
                className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                Next →
              </button>
            </div>
          )}
        </div>
      </div>
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
  const toast      = useToast()
  const firstName  = user?.full_name?.split(' ')[0] || 'Lecturer'

  const [stats,         setStats]         = useState(null)
  const [allStudents,   setAllStudents]   = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [chatLogs,      setChatLogs]      = useState([])
  const [materials,     setMaterials]     = useState([])
  const [onlineUsers,   setOnlineUsers]   = useState([])
  const [myCourseIds,   setMyCourseIds]   = useState([])
  const [loading,       setLoading]       = useState(true)
  const [liveMonitorOpen, setLiveMonitorOpen] = useState(false)
  const [studentPage, setStudentPage] = useState(0)
  const STUDENTS_PER_PAGE = 8
  const totalStudentPages = Math.max(1, Math.ceil(allStudents.length / STUDENTS_PER_PAGE))
  const safeStudentPage = Math.min(studentPage, totalStudentPages - 1)
  const pagedStudents = allStudents.slice(safeStudentPage * STUDENTS_PER_PAGE, (safeStudentPage + 1) * STUDENTS_PER_PAGE)

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
    }).catch(() => toast.error('Could not load dashboard data. Please refresh the page.'))
      .finally(() => setLoading(false))
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
      <div className="grid grid-cols-3 gap-4">

        {/* ── Enrolled Students — fixed height, scroll + pagination ── */}
        <div className="col-span-2 rounded-2xl overflow-hidden flex flex-col"
          style={{
            backgroundColor: '#fff',
            border: '1px solid #D2D4D9',
            maxHeight: 'calc(100vh - 300px)',
          }}>
          <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: '#F0F0F2' }}>
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <Ic.Users /> Enrolled Students
            </div>
            <button onClick={() => navigate('/lecturer/courses')}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors">
              Manage courses <Ic.Arrow />
            </button>
          </div>

          {!allStudents.length ? (
            <div className="flex items-center justify-center flex-1 text-xs text-gray-400" style={{ minHeight: 200 }}>
              No students enrolled yet
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto min-h-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ backgroundColor: '#F0F0F2' }}>
                      {['Student', 'Course', 'Status'].map((h) => (
                        <th key={h} className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 sticky top-0"
                          style={{ backgroundColor: '#F0F0F2', zIndex: 1 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedStudents.map((s, i) => (
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
              </div>

              {allStudents.length > STUDENTS_PER_PAGE && (
                <div className="flex items-center justify-between px-5 py-3 border-t shrink-0" style={{ borderColor: '#F0F0F2' }}>
                  <button onClick={() => setStudentPage(p => Math.max(0, p - 1))}
                    disabled={safeStudentPage === 0}
                    className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    ← Previous
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalStudentPages }, (_, i) => (
                      <button key={i} onClick={() => setStudentPage(i)}
                        className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                          i === safeStudentPage
                            ? 'bg-gray-900 text-white'
                            : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                        }`}>
                        {i + 1}
                      </button>
                    ))}
                  </div>

                  <button onClick={() => setStudentPage(p => Math.min(totalStudentPages - 1, p + 1))}
                    disabled={safeStudentPage === totalStudentPages - 1}
                    className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Right column: Live Monitor → Announcements → Materials (stacked) ── */}
        <div className="flex flex-col gap-4">

          {/* Live Monitor */}
          <LiveMonitorCard onlineUsers={onlineUsers} onOpenFull={() => setLiveMonitorOpen(true)} />

          {/* Expanded Live Monitor overlay */}
          <Modal isOpen={liveMonitorOpen} onClose={() => setLiveMonitorOpen(false)}
            title="Live Monitor" maxWidth="max-w-xl">
            <div>
              {onlineUsers.length > 0 ? (
                <div className="flex flex-col divide-y" style={{ borderColor: '#F0F0F2' }}>
                  {onlineUsers.map((u, i) => {
                    const name = u.student_name || u.name || 'Student'
                    const idNum = u.id_number || u.student_id_number || ''
                    const uid = u.student_id || u.user_id || i
                    return (
                      <div key={uid} className="flex items-center gap-3 py-3">
                        <div className="relative">
                          <div className="h-9 w-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-sm font-bold shrink-0">
                            {name[0]?.toUpperCase() || '?'}
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800">{name}</p>
                          <p className="text-xs text-gray-400">{idNum || 'No ID'}</p>
                        </div>
                        <span className="text-xs text-gray-400">{u.course_name || ''}</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-sm font-medium">No students are currently online</p>
                  <p className="text-xs mt-1">Students will appear here when they log into their dashboard</p>
                </div>
              )}
            </div>
          </Modal>

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
