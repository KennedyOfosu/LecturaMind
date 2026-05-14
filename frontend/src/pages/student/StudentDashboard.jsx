/**
 * StudentDashboard.jsx — Home page content for student.
 * Sidebar is provided by StudentLayout. This renders the main chat area.
 */

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useSocket } from '../../hooks/useSocket'
import { courseService } from '../../services/courseService'
import { useSessions } from '../../context/SessionsContext'
import AIChatInterface from '../../components/chat/AIChatInterface'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function StudentDashboard() {
  const { user }            = useAuth()
  const { socket }          = useSocket()
  const { refreshSessions } = useSessions()
  const hasEmittedLogin     = useRef(false)

  const [courses, setCourses] = useState([])
  const firstName = user?.full_name?.split(' ')[0] || 'Student'

  useEffect(() => {
    courseService.getEnrolled()
      .then((res) => setCourses(res.data))
      .catch(() => {})
  }, [])

  // Announce presence to live monitor once socket + courses are ready
  useEffect(() => {
    if (socket && user && courses.length > 0 && !hasEmittedLogin.current) {
      socket.emit('student_login', {
        student_id:        user.id,
        student_name:      user.full_name,
        student_id_number: user.user_id_number,
        programme:         user.programme,
        level:             user.level,
        course_ids:        courses.map((c) => c.id),
      })
      hasEmittedLogin.current = true
    }
  }, [socket, user, courses])

  const greeting = (
    <div className="flex flex-col items-center justify-center gap-2 pt-10 pb-4 text-center shrink-0">
      <h1 className="text-3xl font-semibold text-gray-900">
        {getGreeting()}, {firstName}
      </h1>
      <p className="text-gray-400 text-sm">
        {courses.length ? 'Click ⊕ to pick a course, then ask anything' : 'You have no enrolled courses yet'}
      </p>
    </div>
  )

  return (
    /* Full-height column — StudentLayout provides the outer scroll container */
    <div className="flex flex-col" style={{ height: 'calc(100vh - 4rem)' }}>
      <AIChatInterface
        courses={courses}
        mode="new"
        onRefreshSessions={refreshSessions}
        greeting={greeting}
      />
    </div>
  )
}
