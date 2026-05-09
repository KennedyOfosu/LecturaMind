/**
 * QuizView.jsx — Student quiz taking interface with score reveal and answer review.
 */

import { useState, useEffect } from 'react'
import { quizService } from '../../services/quizService'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { QuizCard } from '../../components/quiz/QuizCard'
import { QuizResults } from '../../components/quiz/QuizResults'
import { Card } from '../../components/ui/Card'
import { useToast } from '../../components/ui/Toast'
import { formatDate } from '../../utils/formatDate'

export default function QuizView({ courseId }) {
  const toast = useToast()
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeQuiz, setActiveQuiz] = useState(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    quizService.getByCourse(courseId)
      .then((res) => setQuizzes(res.data))
      .finally(() => setLoading(false))
  }, [courseId])

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

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  if (!quizzes.length) return (
    <EmptyState icon="📝" title="No quizzes available" description="Your lecturer hasn't activated any quizzes for this course yet." />
  )

  // Quiz list view
  if (!activeQuiz) return (
    <div className="flex flex-col gap-4">
      {quizzes.map((quiz) => (
        <Card key={quiz.id} className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-navy">{quiz.title}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{quiz.questions?.length} questions · Available since {formatDate(quiz.generated_at)}</p>
          </div>
          <Button variant="teal" onClick={() => startQuiz(quiz)}>Start Quiz</Button>
        </Card>
      ))}
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
  const questions = activeQuiz.questions
  const isLast = currentIndex === questions.length - 1
  const answeredAll = questions.every((_, i) => answers[String(i)])

  return (
    <Card className="flex flex-col gap-6">
      {/* Progress bar */}
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
