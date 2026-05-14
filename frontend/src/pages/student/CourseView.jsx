/**
 * CourseView.jsx — Tabbed course view for students.
 * AI tab uses the shared AIChatInterface component.
 * Reads ?session= query param to scroll to a specific message.
 */

import { useState, useEffect } from 'react'
import { useParams, useLocation, useSearchParams } from 'react-router-dom'
import { useCourse } from '../../hooks/useCourse'
import { useSessions } from '../../context/SessionsContext'
import { PageSpinner } from '../../components/ui/Spinner'
import AIChatInterface from '../../components/chat/AIChatInterface'
import MaterialsView from './MaterialsView'
import AnnouncementsView from './AnnouncementsView'
import QuizView from './QuizView'
import StudentLiveQnA from './LiveQnA'

const TABS = [
  { id: 'materials',     label: 'Materials'     },
  { id: 'announcements', label: 'Announcements' },
  { id: 'ai',            label: 'AI Assistant'  },
  { id: 'quiz',          label: 'Quiz'          },
  { id: 'qna',           label: 'Live Q&A'      },
]

export default function CourseView() {
  const { courseId }            = useParams()
  const location                = useLocation()
  const [searchParams]          = useSearchParams()
  const { course, loading }     = useCourse(courseId)
  const { refreshSessions }     = useSessions()
  const sessionId               = searchParams.get('session')

  // Open AI tab automatically when arriving from a session link
  const [activeTab, setActiveTab] = useState(
    sessionId ? 'ai' : (location.state?.tab || 'materials')
  )

  // Scroll to + flash the target message after chat history loads
  useEffect(() => {
    if (!sessionId || activeTab !== 'ai') return
    const interval = setInterval(() => {
      const el = document.getElementById(`${sessionId}-q`)
        || document.getElementById(`${sessionId}-r`)
      if (el) {
        clearInterval(interval)
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('highlight-flash')
        setTimeout(() => el.classList.remove('highlight-flash'), 2000)
      }
    }, 300)
    return () => clearInterval(interval)
  }, [sessionId, activeTab])

  if (loading) return <PageSpinner />

  const lecturer = course?.profiles

  return (
    <div className="flex flex-col gap-6">
      {/* Course header */}
      <div className="rounded-2xl p-6" style={{ backgroundColor: '#111', color: '#fff' }}>
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/20 text-white">
                {course?.course_code}
              </span>
              {course?.level && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                  Level {course.level}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold">{course?.course_name}</h1>
            {course?.description && (
              <p className="text-white/60 text-sm mt-1">{course.description}</p>
            )}
            <div className="flex items-center gap-2 mt-3">
              <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
                {lecturer?.full_name?.[0] || 'L'}
              </div>
              <span className="text-white/60 text-sm">{lecturer?.full_name || 'Your Lecturer'}</span>
            </div>
          </div>

          {/* Quick link to AI tab */}
          <button onClick={() => setActiveTab('ai')}
            className="shrink-0 px-4 py-2 rounded-xl text-sm font-medium bg-white text-gray-900 hover:bg-gray-100 transition-colors">
            Ask AI
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map(({ id, label }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === id
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'materials'     && <MaterialsView courseId={courseId} />}
        {activeTab === 'announcements' && <AnnouncementsView courseId={courseId} />}
        {activeTab === 'ai' && (
          <div style={{ height: 'calc(100vh - 24rem)' }} className="flex flex-col">
            <AIChatInterface
              courseId={courseId}
              onRefreshSessions={refreshSessions}
            />
          </div>
        )}
        {activeTab === 'quiz'          && <QuizView courseId={courseId} />}
        {activeTab === 'qna'           && <StudentLiveQnA courseId={courseId} />}
      </div>
    </div>
  )
}
