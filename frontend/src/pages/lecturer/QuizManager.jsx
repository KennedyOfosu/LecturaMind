/**
 * QuizManager.jsx — Generate, manage, and preview AI-generated quizzes.
 */

import { useState, useEffect } from 'react'
import { courseService } from '../../services/courseService'
import { quizService } from '../../services/quizService'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { QuizGenerator } from '../../components/quiz/QuizGenerator'
import { useToast } from '../../components/ui/Toast'
import { formatDate } from '../../utils/formatDate'

export default function QuizManager() {
  const toast = useToast()
  const [courses, setCourses] = useState([])
  const [selectedCourse, setSelectedCourse] = useState('')
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [showGenerator, setShowGenerator] = useState(false)
  const [previewQuiz, setPreviewQuiz] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    courseService.getMyCourses().then((res) => {
      setCourses(res.data)
      if (res.data.length) setSelectedCourse(res.data[0].id)
    })
  }, [])

  useEffect(() => {
    if (!selectedCourse) return
    setLoading(true)
    quizService.getByCourse(selectedCourse)
      .then((res) => setQuizzes(res.data))
      .finally(() => setLoading(false))
  }, [selectedCourse])

  const handleGenerate = async ({ num_questions, difficulty }) => {
    setGenerating(true)
    try {
      await quizService.generate({ course_id: selectedCourse, num_questions, difficulty })
      toast.success('Quiz generated successfully!')
      setShowGenerator(false)
      const res = await quizService.getByCourse(selectedCourse)
      setQuizzes(res.data)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Quiz generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleToggleActive = async (quiz) => {
    try {
      const res = await quizService.toggleActivate(quiz.id)
      setQuizzes((prev) => prev.map((q) => q.id === quiz.id ? res.data : q))
      toast.success(res.data.is_active ? 'Quiz activated' : 'Quiz deactivated')
    } catch {
      toast.error('Failed to update quiz status')
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await quizService.delete(deleteTarget.id)
      toast.success('Quiz deleted')
      setQuizzes((prev) => prev.filter((q) => q.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch {
      toast.error('Failed to delete quiz')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Quiz Manager</h1>
          <p className="text-gray-500 text-sm mt-1">Generate AI-powered quizzes from course content</p>
        </div>
        <Button variant="teal" onClick={() => setShowGenerator(true)}>✨ Generate Quiz</Button>
      </div>

      <select
        value={selectedCourse}
        onChange={(e) => setSelectedCourse(e.target.value)}
        className="w-fit px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50"
      >
        {courses.map((c) => (
          <option key={c.id} value={c.id}>{c.course_name}</option>
        ))}
      </select>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : !quizzes.length ? (
        <EmptyState icon="📝" title="No quizzes yet" description="Generate your first AI quiz from uploaded course materials" action={<Button variant="teal" onClick={() => setShowGenerator(true)}>✨ Generate Quiz</Button>} />
      ) : (
        <div className="flex flex-col gap-4">
          {quizzes.map((quiz) => (
            <Card key={quiz.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-navy">{quiz.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400">{quiz.questions?.length || 0} questions · Generated {formatDate(quiz.generated_at)}</span>
                    <Badge variant={quiz.is_active ? 'success' : 'default'}>
                      {quiz.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => setPreviewQuiz(quiz)}>Preview</Button>
                  <Button size="sm" variant={quiz.is_active ? 'outline' : 'teal'} onClick={() => handleToggleActive(quiz)}>
                    {quiz.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setDeleteTarget(quiz)}>Delete</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Generator Modal */}
      <Modal isOpen={showGenerator} onClose={() => setShowGenerator(false)} title="Generate AI Quiz">
        <QuizGenerator onGenerate={handleGenerate} loading={generating} />
      </Modal>

      {/* Preview Modal */}
      <Modal isOpen={!!previewQuiz} onClose={() => setPreviewQuiz(null)} title={previewQuiz?.title} maxWidth="max-w-2xl">
        <div className="flex flex-col gap-5">
          {previewQuiz?.questions?.map((q, i) => (
            <div key={i} className="border border-gray-100 rounded-xl p-4">
              <p className="font-medium text-gray-800 mb-3">{i + 1}. {q.question}</p>
              <div className="flex flex-col gap-1.5">
                {q.options?.map((opt, j) => (
                  <div key={j} className={`px-3 py-2 rounded-lg text-sm ${opt === q.correct_answer ? 'bg-emerald-100 text-emerald-800 font-medium' : 'bg-gray-50 text-gray-600'}`}>
                    {String.fromCharCode(65 + j)}. {opt} {opt === q.correct_answer && '✓'}
                  </div>
                ))}
              </div>
              {q.explanation && <p className="text-xs text-gray-500 mt-2 italic">💡 {q.explanation}</p>}
            </div>
          ))}
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Quiz">
        <div className="flex flex-col gap-5">
          <p className="text-gray-600 text-sm">Are you sure you want to delete <strong>{deleteTarget?.title}</strong>? All student attempts will also be deleted.</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="flex-1">Cancel</Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting} className="flex-1">Delete Quiz</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
