/**
 * StudentDashboard.jsx — Home page content for student.
 * Sidebar is provided by StudentLayout. This renders the main chat area.
 */

import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import api from '../../services/api'
import { useCourses } from '../../context/CoursesContext'
import { useSessions } from '../../context/SessionsContext'
import AIChatInterface from '../../components/chat/AIChatInterface'
import { classroomLabel } from '../../utils/classroomDisplay'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function StudentDashboard() {
  const { user }            = useAuth()
  const { courses }         = useCourses()
  const { refreshSessions } = useSessions()
  const [profile, setProfile] = useState(null)
  const [profileLoadError, setProfileLoadError] = useState(false)

  useEffect(() => {
    api.get('/api/profile/')
      .then((response) => setProfile(response.data))
      .catch(() => setProfileLoadError(true))
  }, [])

  const firstName = user?.full_name?.split(' ')[0] || 'Student'

  // Greeting rendered in the CENTRE of the empty chat area by AIChatInterface
  const greeting = (
    <div className="flex flex-col items-center gap-3">
      <h1 className="text-3xl font-semibold text-gray-900">
        {getGreeting()}, {firstName}
      </h1>
      <p className="text-gray-400 text-sm">
        {courses.length
          ? 'Click ⊕ to pick a course, then ask anything'
          : 'You have no enrolled courses yet'}
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
      <div className="mx-auto mb-3 w-full max-w-3xl rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm">
        <span className="text-gray-500">Your class: </span>
        <span className="font-medium text-gray-800">{profileLoadError ? 'Class details could not be loaded' : profile?.classroom ? classroomLabel(profile.classroom) : 'No class assigned yet'}</span>
      </div>
    </div>
  )
}
