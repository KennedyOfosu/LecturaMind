/**
 * CourseView.jsx — Tabbed course page rendered inside StudentLayout.
 * Shows dark header, tab bar (Materials | Announcements | AI Assistant | Quiz | Live Q&A),
 * and the relevant content for the active tab.
 */

import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useSessions } from '../../context/SessionsContext'
import { PageSpinner } from '../../components/ui/Spinner'
import AIChatInterface from '../../components/chat/AIChatInterface'
import MaterialsView from './MaterialsView'
import AnnouncementsView from './AnnouncementsView'
import QuizView from './QuizView'
import StudentLiveQnA from './LiveQnA'
import api from '../../services/api'

const TABS = [
  { id: 'materials',     label: 'Materials'     },
  { id: 'announcements', label: 'Announcements' },
  { id: 'ai',            label: 'AI Assistant'  },
  { id: 'quiz',          label: 'Quiz'          },
  { id: 'qna',           label: 'Live Q&A'      },
]

export default function CourseView() {
  const { courseId }        = useParams()
  const [searchParams]      = useSearchParams()
  const { refreshSessions } = useSessions()
  const sessionId           = searchParams.get('session')

  const [course,     setCourse]     = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [activeTab,  setActiveTab]  = useState(sessionId ? 'ai' : 'materials')

  useEffect(() => {
    if (!courseId) return
    setLoading(true)
    api.get(`/api/courses/${courseId}`)
      .then((res) => setCourse(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [courseId])

  // When arriving from a session link, scroll to that message once AI tab loads
  useEffect(() => {
    if (!sessionId || activeTab !== 'ai') return
    const interval = setInterval(() => {
      const el = document.getElementById(`${sessionId}-q`) || document.getElementById(`${sessionId}-r`)
      if (el) {
        clearInterval(interval)
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('highlight-flash')
        setTimeout(() => el.classList.remove('highlight-flash'), 2000)
      }
    }, 400)
    const timeout = setTimeout(() => clearInterval(interval), 8000)
    return () => { clearInterval(interval); clearTimeout(timeout) }
  }, [sessionId, activeTab])

  if (loading) return <PageSpinner />

  const lecturerName = course?.lecturer_name || course?.profiles?.full_name || 'Lecturer'

  return (
    <div className="flex flex-col gap-0 -m-8">  {/* cancel StudentLayout's p-8 so header is edge-to-edge */}

      {/* ── Dark course header ── */}
      <div className="px-8 py-6 text-white" style={{ backgroundColor: '#111' }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {course?.course_code && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/20">
                  {course.course_code}
                </span>
              )}
              {course?.level && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                  Level {course.level}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold mb-1">{course?.course_name || 'Course'}</h1>
            {course?.description && (
              <p className="text-white/60 text-sm mb-2">{course.description}</p>
            )}
            <div className="flex items-center gap-2 text-sm text-white/60">
              <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold shrink-0">
                {lecturerName[0]}
              </div>
              <span>{lecturerName}</span>
            </div>
          </div>

          <button onClick={() => setActiveTab('ai')}
            className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold bg-white text-gray-900 hover:bg-gray-100 transition-colors">
            Ask AI
          </button>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="border-b px-8 bg-white" style={{ borderColor: '#E5E7EB' }}>
        <nav className="flex gap-1">
          {TABS.map(({ id, label }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`py-3 px-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Tab content ── */}
      <div className={activeTab === 'ai' ? '' : 'p-8'}>
        {activeTab === 'materials'     && <MaterialsView courseId={courseId} />}
        {activeTab === 'announcements' && <AnnouncementsView courseId={courseId} />}
        {activeTab === 'ai' && (
          <div style={{ height: 'calc(100vh - 200px)' }} className="flex flex-col">
            <AIChatInterface
              courseId={courseId}
              mode="history"
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
