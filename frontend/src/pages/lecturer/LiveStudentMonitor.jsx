/**
 * LiveStudentMonitor.jsx — Real-time view of active students per course.
 */

import { useState, useEffect } from 'react'
import { courseService } from '../../services/courseService'
import { useSocket } from '../../hooks/useSocket'
import { Card } from '../../components/ui/Card'
import { ActiveUsersList } from '../../components/realtime/ActiveUsersList'
import { timeAgo } from '../../utils/formatDate'
import { GroupedCourseSelect } from '../../components/ui/LevelFilter'

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

    setActiveUsers([])
    socket.emit('lecturer_watch_course', { course_id: selectedCourse })
    socket.emit('lecturer_join', { course_id: selectedCourse })  // legacy

    const onList = (data) => {
      if (data.course_id !== selectedCourse) return
      setActiveUsers(data.active_students || [])
    }
    const onJoin = (data) => {
      if (data.course_id !== selectedCourse) return
      setActiveUsers((prev) =>
        prev.find((s) => (s.student_id || s.user_id) === (data.student_id || data.user_id))
          ? prev
          : [...prev, data]
      )
    }
    const onLeave = (data) => {
      if (data.course_id !== selectedCourse) return
      setActiveUsers((prev) =>
        prev.filter((s) => (s.student_id || s.user_id) !== data.student_id)
      )
    }
    const onLegacy = (users) => setActiveUsers(users || [])
    const onActivity = (data) => {
      if (data.course_id !== selectedCourse) return
      setActivityFeed((prev) => [
        { ...data, timestamp: new Date().toISOString() },
        ...prev.slice(0, 19),
      ])
    }

    socket.on('active_students_list', onList)
    socket.on('student_came_online', onJoin)
    socket.on('student_went_offline', onLeave)
    socket.on('active_users_updated', onLegacy)
    socket.on('student_activity', onActivity)

    return () => {
      socket.off('active_students_list', onList)
      socket.off('student_came_online', onJoin)
      socket.off('student_went_offline', onLeave)
      socket.off('active_users_updated', onLegacy)
      socket.off('student_activity', onActivity)
    }
  }, [socket, selectedCourse])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Live Student Monitor</h1>
        <p className="text-gray-500 text-sm mt-1">See who's actively studying right now</p>
      </div>

      <GroupedCourseSelect courses={courses} value={selectedCourse} onChange={setSelectedCourse} />

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
