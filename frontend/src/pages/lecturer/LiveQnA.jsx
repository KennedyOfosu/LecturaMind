/**
 * LiveQnA.jsx — Lecturer panel for hosting live Q&A sessions.
 */

import { useState, useEffect } from 'react'
import { courseService } from '../../services/courseService'
import { useSocket } from '../../hooks/useSocket'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { LiveQuestionFeed } from '../../components/realtime/LiveQuestionFeed'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { useAuth } from '../../hooks/useAuth'

export default function LecturerLiveQnA() {
  const { socket } = useSocket()
  const { user } = useAuth()
  const toast = useToast()
  const [courses, setCourses] = useState([])
  const [selectedCourse, setSelectedCourse] = useState('')
  const [sessionActive, setSessionActive] = useState(false)
  const [questions, setQuestions] = useState([])
  const [answerModal, setAnswerModal] = useState(null)
  const [answerText, setAnswerText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    courseService.getMyCourses().then((res) => {
      setCourses(res.data)
      if (res.data.length) setSelectedCourse(res.data[0].id)
    })
  }, [])

  useEffect(() => {
    if (!socket || !selectedCourse) return
    socket.emit('lecturer_join', { course_id: selectedCourse })

    socket.on('new_live_question', (question) => {
      setQuestions((prev) => [question, ...prev])
      toast.info(`New question from ${question.student_name || 'a student'}`)
    })

    socket.on('question_answered', (updated) => {
      setQuestions((prev) => prev.map((q) => q.id === updated.question_id ? { ...q, ...updated, answered: true } : q))
    })

    return () => {
      socket.off('new_live_question')
      socket.off('question_answered')
    }
  }, [socket, selectedCourse])

  const handleAnswer = async () => {
    if (!answerText.trim() || !answerModal) return
    setSubmitting(true)
    socket?.emit('lecturer_answer', {
      question_id: answerModal.id,
      answer: answerText,
      course_id: selectedCourse,
    })
    setQuestions((prev) => prev.map((q) => q.id === answerModal.id ? { ...q, answered: true, answer: answerText } : q))
    setAnswerModal(null)
    setAnswerText('')
    setSubmitting(false)
    toast.success('Answer sent to students')
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Live Q&A</h1>
        <p className="text-gray-500 text-sm mt-1">Host live question and answer sessions with your students</p>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <select
          value={selectedCourse}
          onChange={(e) => { setSelectedCourse(e.target.value); setQuestions([]) }}
          className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50"
        >
          {courses.map((c) => <option key={c.id} value={c.id}>{c.course_name}</option>)}
        </select>

        <Button
          variant={sessionActive ? 'danger' : 'teal'}
          onClick={() => {
            setSessionActive(!sessionActive)
            toast.info(sessionActive ? 'Session ended' : 'Session started — students can now ask questions!')
          }}
        >
          {sessionActive ? '⏹ End Session' : '▶ Start Live Q&A Session'}
        </Button>

        {sessionActive && (
          <span className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            Session Live
          </span>
        )}
      </div>

      <Card>
        <h2 className="font-semibold text-navy mb-4">
          Student Questions {questions.length > 0 && <span className="text-gray-400 font-normal">({questions.length})</span>}
        </h2>
        {!sessionActive && !questions.length ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-3xl mb-2">🎙️</div>
            <p className="text-sm">Start a session to begin receiving questions from students</p>
          </div>
        ) : (
          <LiveQuestionFeed
            questions={questions}
            onAnswer={setAnswerModal}
            isLecturer
          />
        )}
      </Card>

      {/* Answer Modal */}
      <Modal isOpen={!!answerModal} onClose={() => setAnswerModal(null)} title="Answer Question">
        <div className="flex flex-col gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-400 mb-1">Question from {answerModal?.student_name}</p>
            <p className="text-sm font-medium text-gray-800">{answerModal?.question}</p>
          </div>
          <textarea
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            placeholder="Type your answer here…"
            rows={4}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50 resize-none"
          />
          <Button variant="teal" onClick={handleAnswer} loading={submitting} className="w-full">
            Send Answer
          </Button>
        </div>
      </Modal>
    </div>
  )
}
