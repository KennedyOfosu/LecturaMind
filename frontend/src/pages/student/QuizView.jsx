/**
 * QuizView.jsx — Student quiz interface.
 * Supports both regular (self-paced) quizzes and live PIN-based sessions.
 */

import { useState, useEffect, useContext, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { quizService } from '../../services/quizService'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { QuizCard } from '../../components/quiz/QuizCard'
import { QuizResults } from '../../components/quiz/QuizResults'
import { Card } from '../../components/ui/Card'
import { useToast } from '../../components/ui/Toast'
import { formatDate } from '../../utils/formatDate'
import { SocketContext } from '../../context/SocketContext'
import { useAuth } from '../../hooks/useAuth'

export default function QuizView({ courseId }) {
  const toast = useToast()
  const { socket } = useContext(SocketContext)
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const autoJoinedRef = useRef(false)

  // Regular quiz state
  const [quizzes,      setQuizzes]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [fetchError,   setFetchError]   = useState(false)
  const [activeQuiz,   setActiveQuiz]   = useState(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers,      setAnswers]      = useState({})
  const [result,       setResult]       = useState(null)
  const [submitting,   setSubmitting]   = useState(false)

  // Live session state
  const [activeLive,   setActiveLive]   = useState(null)   // { quiz_id, quiz_title, pin } | null
  const [pinInput,     setPinInput]     = useState('')
  const [joiningPin,   setJoiningPin]   = useState(false)
  const [liveQuiz,     setLiveQuiz]     = useState(null)   // quiz object from PIN lookup
  const [liveIndex,    setLiveIndex]    = useState(0)
  const [liveFeedback, setLiveFeedback] = useState(null)   // { is_correct, correct_answer, score }
  const [liveScore,    setLiveScore]    = useState(0)
  const [liveComplete, setLiveComplete] = useState(false)
  const [liveAnswered, setLiveAnswered] = useState({})     // question_index → answer

  /* ── Load regular quizzes ── */
  const load = () => {
    setLoading(true)
    setFetchError(false)
    quizService.getByCourse(courseId)
      .then((res) => setQuizzes(res.data))
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false))
  }
  useEffect(load, [courseId])

  /* ── Pull-based check: is a live session active for this course right now? ── */
  const loadActiveLive = () => {
    quizService.getActiveLive(courseId)
      .then((res) => setActiveLive(res.data?.active ? res.data : null))
      .catch(() => {})
  }
  useEffect(loadActiveLive, [courseId])

  /* ── Socket: a live session started while the student is on this page ── */
  useEffect(() => {
    if (!socket) return
    const handler = (data) => {
      if (data?.course_id && String(data.course_id) === String(courseId)) {
        setActiveLive(data)
      }
    }
    socket.on('live_session_started', handler)
    return () => socket.off('live_session_started', handler)
  }, [socket, courseId])

  /* ── Socket: answer result for live session ── */
  useEffect(() => {
    if (!socket || !liveQuiz) return
    const handler = ({ question_index, is_correct, correct_answer, score }) => {
      setLiveFeedback({ is_correct, correct_answer, score })
      setLiveScore(score)
    }
    socket.on('answer_result', handler)
    return () => socket.off('answer_result', handler)
  }, [socket, liveQuiz?.id])

  /* ── Join live session via PIN ── */
  const joinWithPin = async (rawPin) => {
    const pin = (rawPin || '').trim().toUpperCase()
    if (pin.length < 4) { toast.warning('Please enter a valid PIN.'); return }
    setJoiningPin(true)
    try {
      const res = await quizService.getByPin(pin)
      const quiz = res.data
      setLiveQuiz(quiz)
      setLiveIndex(0)
      setLiveFeedback(null)
      setLiveScore(0)
      setLiveComplete(false)
      setLiveAnswered({})
      socket?.emit('join_live_quiz', {
        quiz_id:      quiz.id,
        student_id:   user?.id,
        student_name: user?.full_name || user?.email || 'Student',
      })
      toast.success(`Joined live session: ${quiz.title}`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid PIN or session has ended.')
    } finally {
      setJoiningPin(false)
      setPinInput('')
    }
  }

  const handleJoinPin = () => joinWithPin(pinInput)

  /* ── Auto-join when arriving from a live-session notification (?pin=…) ── */
  useEffect(() => {
    const pin = searchParams.get('pin')
    if (!pin || autoJoinedRef.current) return
    autoJoinedRef.current = true
    setPinInput(pin.toUpperCase())
    joinWithPin(pin)
    // Strip the pin param so a refresh doesn't re-trigger the join
    const next = new URLSearchParams(searchParams)
    next.delete('pin')
    setSearchParams(next, { replace: true })
  }, [searchParams])

  /* ── Live answer submission ── */
  const handleLiveAnswer = (answer) => {
    if (liveAnswered[liveIndex] !== undefined) return // already answered
    setLiveAnswered(prev => ({ ...prev, [liveIndex]: answer }))
    socket?.emit('submit_live_answer', {
      quiz_id:        liveQuiz.id,
      student_id:     user?.id,
      student_name:   user?.full_name || user?.email || 'Student',
      question_index: liveIndex,
      answer,
    })
  }

  const handleLiveNext = () => {
    const next = liveIndex + 1
    if (next >= liveQuiz.questions.length) {
      setLiveComplete(true)
    } else {
      setLiveIndex(next)
      setLiveFeedback(null)
    }
  }

  /* ── Regular quiz ── */
  const startQuiz = (quiz) => {
    setActiveQuiz(quiz)
    setCurrentIndex(0)
    setAnswers({})
    setResult(null)
  }

  const handleSelect = (answer) => {
    setAnswers((prev) => ({ ...prev, [String(currentIndex)]: answer }))
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const res = await quizService.submitAttempt(activeQuiz.id, answers)
      setResult(res.data)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit quiz')
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Live session: complete screen ── */
  if (liveComplete && liveQuiz) return (
    <Card className="flex flex-col items-center gap-4 py-10 text-center">
      <div className="text-5xl">🎉</div>
      <h2 className="text-xl font-bold text-navy">Session Complete!</h2>
      <p className="text-gray-500 text-sm">{liveQuiz.title}</p>
      <div className="bg-violet-50 border border-violet-200 rounded-2xl px-10 py-6 mt-2">
        <p className="text-[11px] uppercase tracking-widest text-violet-400 mb-1">Your Score</p>
        <p className="text-4xl font-bold text-navy">{liveScore}</p>
        <p className="text-xs text-gray-400 mt-1">
          {Object.values(liveAnswered).length} questions answered ·{' '}
          {Object.keys(liveAnswered).filter(k => liveAnswered[k] === liveQuiz.questions[k]?.correct_answer).length} correct
        </p>
      </div>
      <Button variant="outline" onClick={() => { setLiveQuiz(null); setLiveComplete(false) }} className="mt-2">
        Back to Quizzes
      </Button>
    </Card>
  )

  /* ── Live session: question screen ── */
  if (liveQuiz && !liveComplete) {
    const q = liveQuiz.questions[liveIndex]
    const answered = liveAnswered[liveIndex]
    const total = liveQuiz.questions.length

    return (
      <Card className="flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-violet-500 uppercase tracking-widest">Live Session</span>
            <h2 className="text-sm font-bold text-navy mt-0.5">{liveQuiz.title}</h2>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest">Score</p>
            <p className="text-lg font-bold text-navy">{liveScore} pts</p>
          </div>
        </div>

        {/* Progress */}
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1.5">
            <span>Question {liveIndex + 1} of {total}</span>
            <span>{Object.keys(liveAnswered).length} answered</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 rounded-full transition-all duration-300"
              style={{ width: `${((liveIndex + 1) / total) * 100}%` }}
            />
          </div>
        </div>

        {/* Question */}
        <p className="text-base font-semibold text-gray-900">{q.question}</p>

        {/* Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {q.options?.map((opt, j) => {
            let style = 'border-gray-200 bg-gray-50 text-gray-700 hover:border-violet-300 hover:bg-violet-50'
            if (answered) {
              if (opt === liveFeedback?.correct_answer) {
                style = 'border-emerald-400 bg-emerald-50 text-emerald-800 font-semibold'
              } else if (opt === answered && opt !== liveFeedback?.correct_answer) {
                style = 'border-red-300 bg-red-50 text-red-700'
              } else {
                style = 'border-gray-100 bg-gray-50 text-gray-400 opacity-60'
              }
            }
            return (
              <button
                key={j}
                disabled={!!answered}
                onClick={() => handleLiveAnswer(opt)}
                className={`px-4 py-3 rounded-xl border-2 text-sm text-left transition-all ${style}`}
              >
                <span className="font-bold mr-2">{String.fromCharCode(65 + j)}.</span>{opt}
              </button>
            )
          })}
        </div>

        {/* Feedback banner */}
        {liveFeedback && (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${liveFeedback.is_correct ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
            <span className="text-xl">{liveFeedback.is_correct ? '✅' : '❌'}</span>
            <div>
              <p className={`text-sm font-semibold ${liveFeedback.is_correct ? 'text-emerald-700' : 'text-red-700'}`}>
                {liveFeedback.is_correct ? `Correct! +10 pts` : 'Wrong answer'}
              </p>
              {!liveFeedback.is_correct && (
                <p className="text-xs text-gray-500 mt-0.5">Correct: {liveFeedback.correct_answer}</p>
              )}
            </div>
            <button
              onClick={handleLiveNext}
              className="ml-auto px-4 py-1.5 rounded-lg bg-navy text-white text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              {liveIndex + 1 < total ? 'Next →' : 'Finish'}
            </button>
          </div>
        )}
      </Card>
    )
  }

  /* ── Regular quiz states ── */
  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  if (fetchError) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <p className="text-sm text-gray-500">Could not load quizzes. Check your connection and try again.</p>
      <button onClick={load} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: '#111' }}>
        Try again
      </button>
    </div>
  )

  // Results view
  if (result) return (
    <QuizResults
      score={result.score}
      total={activeQuiz.questions.length}
      questions={activeQuiz.questions}
      userAnswers={answers}
      onRetry={() => startQuiz(activeQuiz)}
    />
  )

  // Quiz taking view
  if (activeQuiz) {
    const questions = activeQuiz.questions
    const isLast = currentIndex === questions.length - 1
    const answeredAll = questions.every((_, i) => answers[String(i)])

    return (
      <Card className="flex flex-col gap-6">
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1.5">
            <span>Question {currentIndex + 1} of {questions.length}</span>
            <span>{Object.keys(answers).length} answered</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal rounded-full transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>

        <QuizCard
          question={questions[currentIndex]}
          questionIndex={currentIndex}
          total={questions.length}
          selectedAnswer={answers[String(currentIndex)]}
          onSelect={handleSelect}
        />

        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <Button variant="outline" disabled={currentIndex === 0} onClick={() => setCurrentIndex((i) => i - 1)}>
            Previous
          </Button>
          {!isLast ? (
            <Button variant="teal" className="ml-auto" onClick={() => setCurrentIndex((i) => i + 1)}>
              Next
            </Button>
          ) : (
            <Button variant="teal" className="ml-auto" onClick={handleSubmit} loading={submitting} disabled={!answeredAll}>
              {answeredAll ? 'Submit Quiz' : `Answer all questions (${Object.keys(answers).length}/${questions.length})`}
            </Button>
          )}
        </div>
      </Card>
    )
  }

  // Quiz list view
  return (
    <div className="flex flex-col gap-4">
      {/* Active live session banner — shown whenever a session is running */}
      {activeLive && (
        <div className="rounded-2xl border-2 border-violet-200 bg-violet-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#7C3AED' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" stroke="none">
                <path d="M13 2L4.09 12.26a1 1 0 0 0 .79 1.61H11l-1 8.14 8.91-10.26a1 1 0 0 0-.79-1.61H13l1-8.14z"/>
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-violet-700">Live session in progress</p>
              <p className="text-sm font-bold text-navy truncate">{activeLive.quiz_title}</p>
              <p className="text-xs text-gray-500">PIN: <span className="font-mono font-bold tracking-widest text-violet-700">{activeLive.pin}</span></p>
            </div>
          </div>
          <Button variant="teal" loading={joiningPin} onClick={() => joinWithPin(activeLive.pin)}>
            Join Now
          </Button>
        </div>
      )}

      {/* Join live session */}
      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b" stroke="none">
            <path d="M13 2L4.09 12.26a1 1 0 0 0 .79 1.61H11l-1 8.14 8.91-10.26a1 1 0 0 0-.79-1.61H13l1-8.14z"/>
          </svg>
          <h3 className="text-sm font-bold text-navy">Join Live Session</h3>
        </div>
        <p className="text-xs text-gray-400">Enter the PIN shown by your lecturer to join a live quiz</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={pinInput}
            onChange={e => setPinInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleJoinPin()}
            placeholder="e.g. ABC123"
            maxLength={6}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-violet-300"
          />
          <Button variant="teal" onClick={handleJoinPin} loading={joiningPin}>
            Join
          </Button>
        </div>
      </Card>

      {/* Regular quiz list */}
      {!quizzes.length ? (
        <EmptyState icon="📝" title="No quizzes available" description="Your lecturer hasn't activated any quizzes for this course yet." />
      ) : (
        quizzes.map((quiz) => (
          <Card key={quiz.id} className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-navy">{quiz.title}</h3>
              <p className="text-xs text-gray-400 mt-0.5">{quiz.questions?.length} questions · Available since {formatDate(quiz.generated_at)}</p>
            </div>
            <Button variant="teal" onClick={() => startQuiz(quiz)}>Start Quiz</Button>
          </Card>
        ))
      )}
    </div>
  )
}
