/**
 * LecturerDashboard.jsx — Analytics overview with stats, activity, and quick actions.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../hooks/useAuth'
import { useSocket } from '../../hooks/useSocket'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { Button } from '../../components/ui/Button'
import { truncateText } from '../../utils/truncateText'
import { timeAgo } from '../../utils/formatDate'

const StatCard = ({ label, value, icon, onClick, color = 'navy' }) => (
  <Card hover onClick={onClick} className="flex items-center gap-4">
    <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-2xl bg-${color}/10`}>
      {icon}
    </div>
    <div>
      <p className="text-2xl font-bold text-navy">{value ?? '—'}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  </Card>
)

export default function LecturerDashboard() {
  const { user } = useAuth()
  const { socket } = useSocket()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [onlineCount, setOnlineCount] = useState(0)

  useEffect(() => {
    api.get('/api/dashboard/lecturer/stats')
      .then((res) => setStats(res.data))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!socket) return
    socket.on('active_users_updated', (users) => setOnlineCount(users.length))
    return () => socket.off('active_users_updated')
  }, [socket])

  if (loading) return (
    <div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>
  )

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy">Welcome back, {user?.full_name?.split(' ')[0]} 👋</h1>
        <p className="text-gray-500 mt-1">Here's what's happening across your courses</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard label="Total Courses" value={stats?.total_courses} icon="📚" onClick={() => navigate('/lecturer/courses')} />
        <StatCard label="Total Students" value={stats?.total_students} icon="🎓" onClick={() => navigate('/lecturer/courses')} />
        <StatCard label="Queries Today" value={stats?.queries_today} icon="💬" onClick={() => navigate('/lecturer/chat-logs')} />
        <StatCard label="Active Quizzes" value={stats?.active_quizzes} icon="📝" onClick={() => navigate('/lecturer/quizzes')} />
        <StatCard label="Flagged Messages" value={stats?.flagged_messages} icon="🚩" onClick={() => navigate('/lecturer/chat-logs')} color="red-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <Card>
            <h2 className="font-semibold text-navy mb-4">Recent Student Activity</h2>
            {!stats?.recent_activity?.length ? (
              <p className="text-gray-400 text-sm text-center py-8">No recent activity yet</p>
            ) : (
              <div className="flex flex-col divide-y divide-gray-50">
                {stats.recent_activity.map((item, i) => (
                  <div key={i} className="py-3 flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-navy/10 text-navy flex items-center justify-center text-xs font-bold shrink-0">
                      {item.profiles?.full_name?.[0] || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{item.profiles?.full_name || 'Student'}</p>
                      <p className="text-xs text-gray-500 truncate">{truncateText(item.query, 80)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{item.courses?.course_name} · {timeAgo(item.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right panel */}
        <div className="flex flex-col gap-4">
          {/* Online students */}
          <Card>
            <h2 className="font-semibold text-navy mb-2">Currently Online</h2>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl font-bold">
                {onlineCount}
              </div>
              <p className="text-sm text-gray-500">student{onlineCount !== 1 ? 's' : ''} online right now</p>
            </div>
          </Card>

          {/* Quick actions */}
          <Card>
            <h2 className="font-semibold text-navy mb-3">Quick Actions</h2>
            <div className="flex flex-col gap-2">
              {[
                { label: '+ Create Course', path: '/lecturer/courses' },
                { label: '↑ Upload Material', path: '/lecturer/materials' },
                { label: '📢 Post Announcement', path: '/lecturer/announcements' },
                { label: '🎙️ Start Live Q&A', path: '/lecturer/live-qna' },
                { label: '📝 Generate Quiz', path: '/lecturer/quizzes' },
              ].map(({ label, path }) => (
                <Button key={path} variant="ghost" size="sm" onClick={() => navigate(path)} className="justify-start">
                  {label}
                </Button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
