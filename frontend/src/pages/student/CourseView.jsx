/**
 * CourseView.jsx — Student course dashboard. Four zones:
 * 1. Dark header banner  2. Sticky tab bar  3. Tab content  4. Slide-in AI panel
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

/* ── Tab definitions ──────────────────────────────────────────────── */
const TABS = ['Materials', 'Announcements', 'AI Assistant', 'Quiz', 'Live Q&A']

/* ── Slide-in AI chat panel ───────────────────────────────────────── */
function ChatPanel({ courseId, onClose }) {
  return (
    <>
      {/* backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-50 flex flex-col shadow-2xl">
        {/* panel header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <span className="font-semibold text-gray-900 text-sm">Ask AI</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18"/>
            </svg>
          </button>
        </div>
        {/* chat */}
        <div className="flex-1 min-h-0">
          <AIChatInterface courseId={courseId} mode="history" />
        </div>
      </div>
    </>
  )
}

/* ── Main page ────────────────────────────────────────────────────── */
export default function CourseView() {
  const { courseId }        = useParams()
  const [searchParams]      = useSearchParams()
  const { refreshSessions } = useSessions()

  /* resolve initial tab from URL params */
  const sessionId = searchParams.get('session')
  const tabParam  = searchParams.get('tab')
  const initialTab = (() => {
    if (tabParam === 'announcements') return 'Announcements'
    if (tabParam === 'quiz')          return 'Quiz'
    if (tabParam === 'qna')           return 'Live Q&A'
    if (sessionId)                    return 'AI Assistant'
    return 'Materials'
  })()

  const [course,      setCourse]      = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [activeTab,   setActiveTab]   = useState(initialTab)
  const [chatOpen,    setChatOpen]    = useState(false)

  /* fetch course */
  useEffect(() => {
    if (!courseId) return
    setLoading(true)
    api.get(`/api/courses/${courseId}`)
      .then((res) => setCourse(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [courseId])

  /* scroll to session message after AI tab loads */
  useEffect(() => {
    if (!sessionId || activeTab !== 'AI Assistant') return
    const poll = setInterval(() => {
      const el = document.getElementById(`${sessionId}-q`) || document.getElementById(`${sessionId}-r`)
      if (el) {
        clearInterval(poll)
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('highlight-flash')
        setTimeout(() => el.classList.remove('highlight-flash'), 2000)
      }
    }, 400)
    const stop = setTimeout(() => clearInterval(poll), 8000)
    return () => { clearInterval(poll); clearTimeout(stop) }
  }, [sessionId, activeTab])

  if (loading) return <PageSpinner />

  const lecturerName = course?.lecturer_name || course?.profiles?.full_name || 'Lecturer'

  const handleAskAI = () => {
    if (activeTab === 'AI Assistant') return  /* already on AI tab */
    setChatOpen(true)
  }

  return (
    /* cancel StudentLayout padding so the header is truly edge-to-edge */
    <div className="flex flex-col -m-8">

      {/* ── Zone 1: Dark course header ──────────────────────────── */}
      <div className="bg-gray-900 text-white px-8 py-8">
        <div className="flex items-start justify-between gap-6">

          {/* Left: course info */}
          <div className="flex flex-col gap-2 flex-1 min-w-0">
            {/* Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {course?.course_code && (
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/15 text-white tracking-wide">
                  {course.course_code}
                </span>
              )}
              {course?.level && (
                <span className="text-xs font-medium px-3 py-1 rounded-full bg-white/10 text-white/80">
                  Level {course.level}
                </span>
              )}
            </div>

            {/* Course name */}
            <h1 className="text-3xl font-bold text-white leading-tight">
              {course?.course_name || 'Course'}
            </h1>

            {/* Lecturer */}
            <div className="flex items-center gap-2 opacity-70">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold shrink-0">
                {lecturerName[0]?.toUpperCase() || 'L'}
              </div>
              <span className="text-sm">{lecturerName}</span>
            </div>
          </div>

          {/* Right: Ask AI */}
          <button
            onClick={handleAskAI}
            className="shrink-0 px-5 py-2 bg-white text-gray-900 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors"
          >
            Ask AI
          </button>
        </div>
      </div>

      {/* ── Zone 2: Sticky tab bar ──────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="px-8">
          <nav className="flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3.5 px-4 text-sm font-medium border-b-2 -mb-px transition-colors duration-150 whitespace-nowrap ${
                  activeTab === tab
                    ? 'border-teal-500 text-gray-900 opacity-100'
                    : 'border-transparent text-gray-500 opacity-60 hover:opacity-80 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* ── Zone 3: Tab content ─────────────────────────────────── */}
      <div className={activeTab === 'AI Assistant' ? '' : 'px-8 py-6'}>
        {activeTab === 'Materials'     && <MaterialsView courseId={courseId} />}
        {activeTab === 'Announcements' && <AnnouncementsView courseId={courseId} />}
        {activeTab === 'AI Assistant'  && (
          <div style={{ height: 'calc(100vh - 220px)' }} className="flex flex-col">
            <AIChatInterface
              courseId={courseId}
              mode="history"
              onRefreshSessions={refreshSessions}
            />
          </div>
        )}
        {activeTab === 'Quiz'          && <QuizView courseId={courseId} />}
        {activeTab === 'Live Q&A'      && <StudentLiveQnA courseId={courseId} />}
      </div>

      {/* ── Zone 4: Slide-in chat panel ─────────────────────────── */}
      {chatOpen && (
        <ChatPanel courseId={courseId} onClose={() => setChatOpen(false)} />
      )}
    </div>
  )
}
