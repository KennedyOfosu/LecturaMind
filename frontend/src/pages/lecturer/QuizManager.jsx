/**
 * QuizManager.jsx — Generate, manage, and preview quizzes (AI or manual).
 */

import { useState, useEffect } from 'react'
import { courseService } from '../../services/courseService'
import { quizService } from '../../services/quizService'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { QuizGenerator } from '../../components/quiz/QuizGenerator'
import { useToast } from '../../components/ui/Toast'
import { GroupedCourseSelect } from '../../components/ui/LevelFilter'
import { formatDate } from '../../utils/formatDate'

const emptyQuestion = () => ({
  question: '',
  options: ['', '', '', ''],
  correct_answer: '',
  explanation: '',
})

const DIFF_STYLE = {
  easy:   'bg-emerald-100 text-emerald-700',
  medium: 'bg-amber-100 text-amber-700',
  hard:   'bg-red-100 text-red-700',
}

export default function QuizManager() {
  const toast = useToast()
  const [courses, setCourses] = useState([])
  const [selectedCourse, setSelectedCourse] = useState('')
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [savingManual, setSavingManual] = useState(false)
  const [showGenerator, setShowGenerator] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [previewQuiz, setPreviewQuiz] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [manualForm, setManualForm] = useState({ title: '', questions: [emptyQuestion()] })

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

  /* ── AI generation ── */
  const handleGenerate = async ({ num_questions, difficulty }) => {
    if (!selectedCourse) { toast.warning('Please select a course before generating a quiz.'); return }
    setGenerating(true)
    const dismiss = toast.loading('Generating quiz from course content, please wait...')
    try {
      await quizService.generate({ course_id: selectedCourse, num_questions, difficulty })
      dismiss()
      toast.success('Quiz generated successfully. Review it before activating for students.')
      setShowGenerator(false)
      const res = await quizService.getByCourse(selectedCourse)
      setQuizzes(res.data)
    } catch (err) {
      dismiss()
      const msg = (err.response?.data?.error || '').toLowerCase()
      if (msg.includes('material') || msg.includes('content') || msg.includes('no text')) {
        toast.error('Quiz generation failed. Please upload course materials before generating a quiz.')
      } else {
        toast.error('Quiz generation failed. Please try again in a moment.')
      }
    } finally {
      setGenerating(false)
    }
  }

  /* ── Manual save ── */
  const handleSaveManual = async () => {
    if (!selectedCourse) { toast.warning('Please select a course first.'); return }
    if (!manualForm.title.trim()) { toast.warning('Please enter a quiz title.'); return }
    for (let i = 0; i < manualForm.questions.length; i++) {
      const q = manualForm.questions[i]
      if (!q.question.trim())             { toast.warning(`Question ${i + 1} is missing its text.`); return }
      if (q.options.some(o => !o.trim())) { toast.warning(`All 4 options in question ${i + 1} must be filled.`); return }
      if (!q.correct_answer)              { toast.warning(`Select the correct answer for question ${i + 1}.`); return }
    }
    setSavingManual(true)
    try {
      await quizService.createManual({
        course_id: selectedCourse,
        title: manualForm.title.trim(),
        questions: manualForm.questions.map(q => ({
          question:       q.question.trim(),
          options:        q.options.map(o => o.trim()),
          correct_answer: q.correct_answer.trim(),
          explanation:    q.explanation.trim(),
        })),
      })
      toast.success("Quiz saved. Activate it when you're ready for students.")
      setShowManual(false)
      setManualForm({ title: '', questions: [emptyQuestion()] })
      const res = await quizService.getByCourse(selectedCourse)
      setQuizzes(res.data)
    } catch {
      toast.error('Could not save quiz. Please try again.')
    } finally {
      setSavingManual(false)
    }
  }

  const handleToggleActive = async (quiz) => {
    try {
      const res = await quizService.toggleActivate(quiz.id)
      setQuizzes(prev => prev.map(q => q.id === quiz.id ? res.data : q))
      toast.info(res.data.is_active ? 'Quiz is now visible to enrolled students.' : 'Quiz is now hidden from students.')
    } catch {
      toast.error('Could not update quiz. Please try again.')
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await quizService.delete(deleteTarget.id)
      toast.info('Quiz deleted.')
      setQuizzes(prev => prev.filter(q => q.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch {
      toast.error('Could not delete quiz. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  /* ── Manual form helpers ── */
  const updateQuestion = (qi, field, value) =>
    setManualForm(prev => {
      const questions = [...prev.questions]
      questions[qi] = { ...questions[qi], [field]: value }
      return { ...prev, questions }
    })

  const updateOption = (qi, oi, value) =>
    setManualForm(prev => {
      const questions = [...prev.questions]
      const options = [...questions[qi].options]
      const wasCorrect = questions[qi].correct_answer === options[oi]
      options[oi] = value
      questions[qi] = {
        ...questions[qi],
        options,
        correct_answer: wasCorrect ? value : questions[qi].correct_answer,
      }
      return { ...prev, questions }
    })

  const openManual = () => {
    setManualForm({ title: '', questions: [emptyQuestion()] })
    setShowManual(true)
  }

  /* ── Render ── */
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-navy">Quiz Manager</h1>
          <p className="text-gray-500 text-sm mt-1">Create and manage quizzes for your students</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={openManual}>✏️ Create Manually</Button>
          <Button variant="teal" onClick={() => setShowGenerator(true)}>✨ Generate with AI</Button>
        </div>
      </div>

      {/* Course selector */}
      <GroupedCourseSelect
        courses={courses}
        value={selectedCourse}
        onChange={(v) => { setSelectedCourse(v); setQuizzes([]) }}
      />

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : !quizzes.length ? (
        /* Empty — two creation cards */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
          <button
            onClick={() => setShowGenerator(true)}
            className="border-2 border-dashed border-gray-300 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 hover:border-violet-400 hover:bg-violet-50 transition-all min-h-[220px] group"
          >
            <span className="text-3xl">✨</span>
            <div className="text-center">
              <p className="font-semibold text-gray-700 group-hover:text-violet-700 transition-colors">Generate with AI</p>
              <p className="text-xs text-gray-400 mt-1">Auto-create questions from uploaded course materials</p>
            </div>
          </button>
          <button
            onClick={openManual}
            className="border-2 border-dashed border-gray-300 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 hover:border-teal-500 hover:bg-teal-50 transition-all min-h-[220px] group"
          >
            <span className="text-3xl">✏️</span>
            <div className="text-center">
              <p className="font-semibold text-gray-700 group-hover:text-teal-600 transition-colors">Create Manually</p>
              <p className="text-xs text-gray-400 mt-1">Write your own questions and answer choices</p>
            </div>
          </button>
        </div>
      ) : (
        /* Quiz card grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Persistent creation cards */}
          <button
            onClick={() => setShowGenerator(true)}
            className="border-2 border-dashed border-gray-300 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 hover:border-violet-400 hover:bg-violet-50 transition-all min-h-[200px] group"
          >
            <span className="text-2xl">✨</span>
            <p className="text-sm font-semibold text-gray-600 group-hover:text-violet-700 transition-colors">Generate with AI</p>
          </button>
          <button
            onClick={openManual}
            className="border-2 border-dashed border-gray-300 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 hover:border-teal-500 hover:bg-teal-50 transition-all min-h-[200px] group"
          >
            <span className="text-2xl">✏️</span>
            <p className="text-sm font-semibold text-gray-600 group-hover:text-teal-600 transition-colors">Create Manually</p>
          </button>

          {quizzes.map((quiz) => (
            <div key={quiz.id} className="bg-white rounded-2xl p-5 shadow-sm flex flex-col" style={{ minHeight: '260px' }}>
              {/* Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full tracking-wide ${
                  quiz.is_active ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {quiz.is_active ? 'ACTIVE' : 'INACTIVE'}
                </span>
                {quiz.difficulty && DIFF_STYLE[quiz.difficulty] && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full tracking-wide ${DIFF_STYLE[quiz.difficulty]}`}>
                    {quiz.difficulty.toUpperCase()}
                  </span>
                )}
              </div>

              {/* Title + meta */}
              <h3 className="text-base font-bold text-gray-900 mt-2 leading-snug">{quiz.title}</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {quiz.questions?.length || 0} questions · {formatDate(quiz.generated_at)}
              </p>

              {/* Question preview with bottom fade */}
              <div className="relative flex-1 overflow-hidden mt-3">
                <div className="text-xs text-gray-500 space-y-1.5 leading-relaxed">
                  {quiz.questions?.slice(0, 6).map((q, i) => (
                    <p key={i}><span className="font-medium text-gray-600">{i + 1}.</span> {q.question}</p>
                  ))}
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white to-transparent pointer-events-none" />
              </div>

              {/* Actions */}
              <div className="flex gap-1.5 mt-4 pt-3 border-t border-gray-100">
                <button
                  onClick={() => setPreviewQuiz(quiz)}
                  className="flex-1 text-xs font-medium py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Preview
                </button>
                <button
                  onClick={() => handleToggleActive(quiz)}
                  className={`flex-1 text-xs font-medium py-1.5 rounded-lg transition-colors ${
                    quiz.is_active
                      ? 'text-gray-600 hover:bg-gray-100'
                      : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                  }`}
                >
                  {quiz.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => setDeleteTarget(quiz)}
                  className="flex-1 text-xs font-medium py-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── AI Generator Modal ── */}
      <Modal isOpen={showGenerator} onClose={() => setShowGenerator(false)} title="Generate AI Quiz">
        <QuizGenerator onGenerate={handleGenerate} loading={generating} />
      </Modal>

      {/* ── Manual Quiz Builder Modal ── */}
      <Modal isOpen={showManual} onClose={() => setShowManual(false)} title="Create Quiz Manually" maxWidth="max-w-2xl">
        <div className="flex flex-col gap-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Quiz Title</label>
            <input
              type="text"
              value={manualForm.title}
              onChange={e => setManualForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. Chapter 3 Review Quiz"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50"
            />
          </div>

          {/* Questions */}
          <div className="flex flex-col gap-4">
            {manualForm.questions.map((q, qi) => (
              <div key={qi} className="border border-gray-200 rounded-xl p-4 flex flex-col gap-3 bg-gray-50/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Question {qi + 1}</span>
                  {manualForm.questions.length > 1 && (
                    <button
                      onClick={() => setManualForm(prev => ({ ...prev, questions: prev.questions.filter((_, i) => i !== qi) }))}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <textarea
                  value={q.question}
                  onChange={e => updateQuestion(qi, 'question', e.target.value)}
                  placeholder="Enter the question…"
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50 resize-none bg-white"
                />

                <div className="grid grid-cols-2 gap-2">
                  {q.options.map((opt, oi) => (
                    <label key={oi} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`correct-${qi}`}
                        checked={q.correct_answer === opt && opt !== ''}
                        onChange={() => updateQuestion(qi, 'correct_answer', opt)}
                        className="shrink-0 accent-teal-600"
                        title="Mark as correct answer"
                      />
                      <input
                        type="text"
                        value={opt}
                        onChange={e => updateOption(qi, oi, e.target.value)}
                        placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50 bg-white"
                      />
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-400 -mt-1">Click the radio button next to the correct answer.</p>

                <input
                  type="text"
                  value={q.explanation}
                  onChange={e => updateQuestion(qi, 'explanation', e.target.value)}
                  placeholder="Explanation (optional)"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50 bg-white text-gray-500"
                />
              </div>
            ))}
          </div>

          <button
            onClick={() => setManualForm(prev => ({ ...prev, questions: [...prev.questions, emptyQuestion()] }))}
            className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-300 text-sm font-medium text-gray-500 hover:border-teal-500 hover:text-teal-600 transition-colors"
          >
            + Add Question
          </button>

          <Button variant="teal" onClick={handleSaveManual} loading={savingManual} className="w-full">
            Save Quiz
          </Button>
        </div>
      </Modal>

      {/* ── Preview Modal ── */}
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

      {/* ── Delete Confirmation ── */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Quiz">
        <div className="flex flex-col gap-5">
          <p className="text-gray-600 text-sm">
            Are you sure you want to delete <strong>{deleteTarget?.title}</strong>? All student attempts will also be deleted.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="flex-1">Cancel</Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting} className="flex-1">Delete Quiz</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
