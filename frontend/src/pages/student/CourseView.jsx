/**
 * CourseView.jsx — Tabbed course view for students: Materials, Announcements, AI Chatbot, Quiz, Live Q&A.
 */

import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useCourse } from '../../hooks/useCourse'
import { PageSpinner } from '../../components/ui/Spinner'
import MaterialsView from './MaterialsView'
import AnnouncementsView from './AnnouncementsView'
import AIChatbot from './AIChatbot'
import QuizView from './QuizView'
import StudentLiveQnA from './LiveQnA'

const TABS = [
  { id: 'materials', label: '📄 Materials' },
  { id: 'announcements', label: '📢 Announcements' },
  { id: 'chatbot', label: '🤖 AI Chatbot' },
  { id: 'quiz', label: '📝 Quiz' },
  { id: 'qna', label: '🎙️ Live Q&A' },
]

export default function CourseView() {
  const { courseId } = useParams()
  const { course, loading } = useCourse(courseId)
  const [activeTab, setActiveTab] = useState('materials')

  if (loading) return <PageSpinner />

  const lecturer = course?.profiles

  return (
    <div className="flex flex-col gap-6">
      {/* Course header */}
      <div className="bg-navy text-white rounded-2xl p-6">
        <p className="text-teal text-sm font-medium mb-1">{course?.course_code}</p>
        <h1 className="text-2xl font-bold">{course?.course_name}</h1>
        {course?.description && <p className="text-white/60 text-sm mt-1">{course.description}</p>}
        <div className="flex items-center gap-2 mt-3">
          <div className="h-7 w-7 rounded-full bg-teal/20 text-teal flex items-center justify-center text-xs font-bold">
            {lecturer?.full_name?.[0] || 'L'}
          </div>
          <span className="text-white/70 text-sm">{lecturer?.full_name || 'Your Lecturer'}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto pb-0">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === id
                ? 'border-teal text-teal'
                : 'border-transparent text-gray-500 hover:text-navy'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'materials' && <MaterialsView courseId={courseId} />}
        {activeTab === 'announcements' && <AnnouncementsView courseId={courseId} />}
        {activeTab === 'chatbot' && <AIChatbot courseId={courseId} />}
        {activeTab === 'quiz' && <QuizView courseId={courseId} />}
        {activeTab === 'qna' && <StudentLiveQnA courseId={courseId} />}
      </div>
    </div>
  )
}
