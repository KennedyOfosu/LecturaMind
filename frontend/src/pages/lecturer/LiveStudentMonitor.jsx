/**
 * LiveStudentMonitor.jsx — Real-time view of active students per course.
 */

import { useState, useEffect } from 'react'
import { courseService } from '../../services/courseService'
import { useSocket } from '../../hooks/useSocket'
import { Card } from '../../components/ui/Card'
import { ActiveUsersList } from '../../components/realtime/ActiveUsersList'
import { timeAgo } from '../../utils/formatDate'

export default function LiveStudentMonitor() {
  const { socket } = useSocket()
  const [courses, setCourses] = useState([])
  const [selectedCourse, setSelectedCourse] = useState('')
  const [activeUsers, setActiveUsers] = useState([])
  const [activityFeed, setActivityFeed] = useState([])

  useEffect(() => {
    courseService.getMyCourses().then((res) => {
      setCourses(res.data)
      if (res.data.length) setSelectedCourse(res.data[0].id)
    })
  }, [])

  useEffect(() => {
    if (!socket || !selectedCourse) return

    socket.emit('lecturer_join', { course_id: selectedCourse })

    socket.on('active_users_updated', (users) => setActiveUsers(users))

    socket.on('student_activity', (data) => {
      if (data.course_id !== selectedCourse) return
      setActivityFeed((prev) => [
        { ...data, timestamp: new Date().toISOString() },
        ...prev.slice(0, 19),
      ])
    })

    return () => {
      socket.off('active_users_updated')
      socket.off('student_activity')
    }
  }, [socket, selectedCourse])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Live Student Monitor</h1>
        <p className="text-gray-500 text-sm mt-1">See who's actively studying right now</p>
      </div>

      <select
        value={selectedCourse}
        onChange={(e) => setSelectedCourse(e.target.value)}
        className="w-fit px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50"
      >
        {courses.map((c) => (
          <option key={c.id} value={c.id}>{c.course_name}</option>
        ))}
      </select>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-navy">Active Now</h2>
            <span className="text-sm font-bold text-emerald-600">{activeUsers.length} online</span>
          </div>
          <ActiveUsersList users={activeUsers} />
        </Card>

        <Card>
          <h2 className="font-semibold text-navy mb-4">Recent Activity</h2>
          {!activityFeed.length ? (
            <p className="text-gray-400 text-sm text-center py-8">Activity will appear here in real time</p>
          ) : (
            <div className="flex flex-col gap-2">
              {activityFeed.map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-sm py-2 border-b border-gray-50 last:border-0">
                  <div className="h-7 w-7 rounded-full bg-navy/10 text-navy flex items-center justify-center text-xs font-bold shrink-0">
                    {item.user_name?.[0] || '?'}
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">{item.user_name}</span>
                    <span className="text-gray-500"> {item.action}</span>
                  </div>
                  <span className="text-xs text-gray-400 ml-auto shrink-0">{timeAgo(item.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
