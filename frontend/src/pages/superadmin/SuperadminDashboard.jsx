import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminService } from '../../services/adminService'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'

const Ic = {
  Users: () => (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87"/>
      <path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  ),
  Lecturers: () => (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
    </svg>
  ),
  Courses: () => (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/>
      <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
    </svg>
  ),
  Building: () => (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/>
      <line x1="8" y1="6" x2="10" y2="6"/><line x1="14" y1="6" x2="16" y2="6"/>
      <line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/>
      <line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/>
    </svg>
  ),
  Flag: () => (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
      <line x1="4" y1="22" x2="4" y2="15"/>
    </svg>
  ),
  Dollar: () => (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
    </svg>
  ),
  Enrolments: () => (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
      <path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5"/>
    </svg>
  ),
  Calendar: () => (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
}

function StatCard({ title, value, Icon, color, onClick }) {
  return (
    <button onClick={onClick}
      className="rounded-2xl p-5 flex items-center gap-4 text-left transition-all hover:shadow-md active:scale-[0.99]"
      style={{ backgroundColor: '#fff', border: '1px solid #D2D4D9' }}>
      <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{title}</p>
      </div>
    </button>
  )
}

export default function SuperadminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminService.getDashboard()
      .then((r) => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">System-wide oversight and management</p>
        {stats?.active_semester && (
          <span className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full">
            <Ic.Calendar /> Active: {stats.active_semester}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Lecturers"  value={stats?.total_lecturers || 0}  Icon={Ic.Lecturers}  color="bg-blue-100 text-blue-600" onClick={() => navigate('/superadmin/users?role=lecturer')} />
        <StatCard title="Students"   value={stats?.total_students || 0}   Icon={Ic.Users}      color="bg-green-100 text-green-600" onClick={() => navigate('/superadmin/users?role=student')} />
        <StatCard title="Courses"    value={stats?.total_courses || 0}    Icon={Ic.Courses}    color="bg-purple-100 text-purple-600" onClick={() => navigate('/superadmin/courses')} />
        <StatCard title="Classrooms" value={stats?.total_classrooms || 0} Icon={Ic.Building}   color="bg-orange-100 text-orange-600" onClick={() => navigate('/superadmin/classrooms')} />
        <StatCard title="Enrolments" value={stats?.total_enrolments || 0} Icon={Ic.Enrolments} color="bg-teal-100 text-teal-600" />
        <StatCard title="Queries Today" value={stats?.queries_today || 0} Icon={Ic.Flag} color="bg-pink-100 text-pink-600" />
        <StatCard title="Flagged Attendance" value={stats?.flagged_attendance || 0} Icon={Ic.Flag} color="bg-red-100 text-red-600" onClick={() => navigate('/superadmin/attendance')} />
        <StatCard title="Unpaid Fees" value={stats?.unpaid_fees || 0} Icon={Ic.Dollar} color="bg-yellow-100 text-yellow-600" onClick={() => navigate('/superadmin/fees')} />
      </div>

      <Card>
        <div className="px-5 py-4 border-b" style={{ borderColor: '#F0F0F2' }}>
          <h2 className="text-sm font-semibold text-gray-800">Recent Users</h2>
        </div>
        <div className="p-5">
          {!stats?.recent_users?.length ? (
            <p className="text-sm text-gray-400">No users yet</p>
          ) : (
            <div className="space-y-3">
              {stats.recent_users.map((u) => (
                <div key={u.id} className="flex items-center gap-3 text-sm">
                  <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                    {u.full_name?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{u.full_name}</p>
                    <p className="text-xs text-gray-400">{u.user_id_number} &middot; {u.email}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    u.role === 'superadmin' ? 'bg-purple-100 text-purple-700' :
                    u.role === 'lecturer' ? 'bg-blue-100 text-blue-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {u.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
