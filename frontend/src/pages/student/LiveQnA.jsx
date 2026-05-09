/**
 * LiveQnA.jsx — Student panel for participating in live Q&A sessions.
 */

import { useState, useEffect } from 'react'
import { useSocket } from '../../hooks/useSocket'
import { useAuth } from '../../hooks/useAuth'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { LiveQuestionFeed } from '../../components/realtime/LiveQuestionFeed'
import { OnlineIndicator } from '../../components/realtime/OnlineIndicator'

export default function StudentLiveQnA({ courseId }) {
  const { socket } = useSocket()
  const { user } = useAuth()
  const [sessionActive, setSessionActive] = useState(false)
  const [questions, setQuestions] = useState([])
  const [questionText, setQuestionText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!socket || !courseId) return
    socket.emit('join_course', { course_id: courseId, user_name: user?.full_name })

    socket.on('session_started', () => setSessionActive(true))
    socket.on('session_ended', () => setSessionActive(false))
    socket.on('new_live_question', (q) => {
      setQuestions((prev) => [q, ...prev])
    })
    socket.on('question_answered', (updated) => {
      setQuestions((prev) =>
        prev.map((q) => q.id === updated.question_id ? { ...q, answered: true, answer: updated.answer } : q)
      )
    })

    return () => {
      socket.off('session_started')
      socket.off('session_ended')
      socket.off('new_live_question')
      socket.off('question_answered')
      socket.emit('leave_course', { course_id: courseId })
    }
  }, [socket, courseId, user])

  const handleSubmitQuestion = () => {
    if (!questionText.trim() || !socket) return
    setSubmitting(true)
    socket.emit('live_question', {
      course_id: courseId,
      question: questionText.trim(),
      student_name: user?.full_name,
      student_id: user?.id,
    })
    setQuestionText('')
    setSubmitting(false)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Session status */}
      <Card className={`flex items-center gap-4 ${sessionActive ? 'border-emerald-200 bg-emerald-50' : 'border-gray-100'}`}>
        {sessionActive ? (
          <>
            <OnlineIndicator />
            <div>
              <p className="font-semibold text-emerald-700">Live Session is Active</p>
              <p className="text-sm text-emerald-600">Your lecturer is online — submit your questions below</p>
            </div>
          </>
        ) : (
          <>
            <div className="h-3 w-3 rounded-full bg-gray-300" />
            <div>
              <p className="font-semibold text-gray-600">No Live Session Running</p>
              <p className="text-sm text-gray-400">Check back when your lecturer starts a session</p>
            </div>
          </>
        )}
      </Card>

      {/* Question input */}
      <Card>
        <h2 className="font-semibold text-navy mb-3">Ask a Question</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder="Type your question here…"
            onKeyDown={(e) => e.key === 'Enter' && handleSubmitQuestion()}
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50"
          />
          <Button variant="teal" onClick={handleSubmitQuestion} disabled={!questionText.trim() || submitting}>
            Ask
          </Button>
        </div>
      </Card>

      {/* Question feed */}
      <Card>
        <h2 className="font-semibold text-navy mb-4">Questions {questions.length > 0 && `(${questions.length})`}</h2>
        <LiveQuestionFeed questions={questions} isLecturer={false} />
      </Card>
    </div>
  )
}
