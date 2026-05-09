/**
 * StudentDashboard.jsx — Welcome dashboard with enrolled course cards and quick stats.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { courseService } from '../../services/courseService'
import { useAuth } from '../../hooks/useAuth'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import api from '../../services/api'

export default function StudentDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ queries: 0, quizzes: 0 })

  useEffect(() => {
    Promise.all([
      courseService.getEnrolled(),
      api.get('/api/chatbot/history/all').catch(() => ({ data: [] })),
    ])
      .then(([coursesRes]) => {
        setCourses(coursesRes.data)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-navy">
          Welcome, {user?.full_name?.split(' ')[0]} 👋
        </h1>
        <p className="text-gray-500 mt-1">Here are your enrolled courses</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Enrolled Courses', value: courses.length, icon: '📚' },
          { label: 'AI Queries Sent', value: stats.queries, icon: '💬' },
          { label: 'Quizzes Completed', value: stats.quizzes, icon: '📝' },
        ].map(({ label, value, icon }) => (
          <Card key={label} className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-teal/10 flex items-center justify-center text-2xl">{icon}</div>
            <div>
              <p className="text-2xl font-bold text-navy">{value}</p>
              <p className="text-sm text-gray-500">{label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Courses */}
      {!courses.length ? (
        <EmptyState
          icon="🎓"
          title="No courses enrolled"
          description="Your lecturer will enrol you into courses. Check back soon!"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {courses.map((course) => {
            const lecturer = course.profiles
            return (
              <Card
                key={course.id}
                hover
                onClick={() => navigate(`/student/courses/${course.id}`)}
                className="flex flex-col gap-3"
              >
                <div className="h-2 bg-teal rounded-full" />
                <h3 className="font-bold text-navy text-lg">{course.course_name}</h3>
                <p className="text-xs font-medium text-teal bg-teal/10 w-fit px-2 py-0.5 rounded-full">
                  {course.course_code}
                </p>
                {course.description && (
                  <p className="text-sm text-gray-500 line-clamp-2">{course.description}</p>
                )}
                <div className="flex items-center gap-2 mt-auto pt-2 border-t border-gray-100">
                  <div className="h-7 w-7 rounded-full bg-navy/10 text-navy flex items-center justify-center text-xs font-bold">
                    {lecturer?.full_name?.[0] || 'L'}
                  </div>
                  <span className="text-xs text-gray-500">{lecturer?.full_name || 'Lecturer'}</span>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
