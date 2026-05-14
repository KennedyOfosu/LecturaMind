/**
 * CourseStudentView.jsx — Split-panel student roster + performance tracker.
 *
 * Left panel : table of enrolled students (searchable).
 * Right panel: selected student's performance breakdown — quiz scores
 *              (auto), manual marks (midterm, test, presentation, etc.),
 *              overall average, and an inline "Add Mark" form.
 */

import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'

const ASSESSMENT_TYPES = ['Quiz', 'Midterm', 'Test', 'Assignment', 'Presentation', 'Other']

/* ── tiny helpers ─────────────────────────────────────────────── */
function pct(score, max) {
  if (!max) return 0
  return Math.round((score / max) * 100)
}
function avg(marks) {
  if (!marks.length) return null
  return Math.round(marks.reduce((s, m) => s + pct(m.score, m.max_score), 0) / marks.length)
}
function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'
}

/* ── colour per assessment type ──────────────────────────────── */
const TYPE_COLOURS = {
  Quiz:         'bg-blue-50 text-blue-600',
  Midterm:      'bg-purple-50 text-purple-600',
  Test:         'bg-orange-50 text-orange-600',
  Assignment:   'bg-amber-50 text-amber-600',
  Presentation: 'bg-pink-50 text-pink-600',
  Other:        'bg-gray-100 text-gray-600',
}

/* ── score bar ────────────────────────────────────────────────── */
function ScoreBar({ score, max }) {
  const p = pct(score, max)
  const colour = p >= 70 ? '#10B981' : p >= 50 ? '#F59E0B' : '#EF4444'
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${p}%`, backgroundColor: colour }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 shrink-0 w-10 text-right">
        {score}/{max}
      </span>
    </div>
  )
}

/* ── Add Mark inline form ─────────────────────────────────────── */
function AddMarkForm({ studentId, courseId, onSaved, onCancel }) {
  const toast = useToast()
  const [form, setForm]   = useState({ assessment_type: 'Midterm', title: '', score: '', max_score: '100', notes: '' })
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!form.title.trim() || form.score === '') { toast.error('Title and score are required'); return }
    setSaving(true)
    try {
      await api.post('/api/marks', {
        student_id:      studentId,
        course_id:       courseId,
        assessment_type: form.assessment_type,
        title:           form.title.trim(),
        score:           parseFloat(form.score),
        max_score:       parseFloat(form.max_score) || 100,
        notes:           form.notes.trim() || null,
      })
      toast.success('Mark recorded')
      onSaved()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save mark')
    } finally { setSaving(false) }
  }

  const inp = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300'

  return (
    <form onSubmit={submit} className="mt-4 p-4 rounded-xl border border-gray-200 bg-gray-50 flex flex-col gap-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Add New Mark</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Type</label>
          <select value={form.assessment_type} onChange={(e) => setForm({ ...form, assessment_type: e.target.value })} className={inp}>
            {ASSESSMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Title</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Week 5 Test" className={inp} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Score</label>
          <input type="number" min="0" value={form.score}
            onChange={(e) => setForm({ ...form, score: e.target.value })}
            placeholder="0" className={inp} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Out of</label>
          <input type="number" min="1" value={form.max_score}
            onChange={(e) => setForm({ ...form, max_score: e.target.value })}
            className={inp} />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Reason / Notes <span className="text-gray-300">(optional)</span></label>
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={2} placeholder="e.g. Excellent presentation on network topologies…"
          className={`${inp} resize-none`} />
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={saving}
          className="flex-1 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40 transition-colors"
          style={{ backgroundColor: '#111' }}>
          {saving ? 'Saving…' : 'Save Mark'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  )
}

/* ── Performance panel (right side) ──────────────────────────── */
function PerformancePanel({ student, courseId, onMarkAdded }) {
  const [marks,      setMarks]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [deleting,   setDeleting]   = useState(null)
  const toast = useToast()

  const fetchMarks = () => {
    setLoading(true)
    api.get(`/api/marks/student/${student.id}/course/${courseId}`)
      .then((r) => setMarks(r.data || []))
      .catch(() => setMarks([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchMarks() }, [student.id, courseId])

  const handleDelete = async (markId) => {
    setDeleting(markId)
    try {
      await api.delete(`/api/marks/${markId}`)
      setMarks((p) => p.filter((m) => m.id !== markId))
      toast.success('Mark removed')
    } catch { toast.error('Failed to remove mark') }
    finally { setDeleting(null) }
  }

  const average = avg(marks)

  return (
    <div className="h-full flex flex-col">
      {/* Student header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold text-white shrink-0"
          style={{ backgroundColor: '#374151' }}>
          {initials(student.full_name)}
        </div>
        <div>
          <p className="font-bold text-gray-900">{student.full_name}</p>
          <p className="text-xs text-gray-400">{student.user_id_number}
            {student.programme && <> · {student.programme}</>}
            {student.level && <> · Level {student.level}</>}
          </p>
        </div>
      </div>

      {/* Overall summary */}
      {marks.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Avg Score', value: average !== null ? `${average}%` : '—' },
            { label: 'Assessments', value: marks.length },
            { label: 'Best', value: marks.length ? `${Math.max(...marks.map((m) => pct(m.score, m.max_score)))}%` : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl p-3 text-center" style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
              <p className="text-xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Mark list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : !marks.length ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <p className="text-gray-400 text-sm">No marks recorded yet</p>
            <p className="text-gray-300 text-xs">Use the form below to add the first mark</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {marks.map((m) => (
              <div key={m.id} className="rounded-xl p-3 border hover:border-gray-200 transition-colors"
                style={{ borderColor: '#F3F4F6', backgroundColor: '#FAFAFA' }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${TYPE_COLOURS[m.assessment_type] || TYPE_COLOURS.Other}`}>
                      {m.assessment_type}
                    </span>
                    <p className="text-sm font-medium text-gray-800 truncate">{m.title}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                      pct(m.score, m.max_score) >= 70 ? 'text-emerald-600 bg-emerald-50'
                      : pct(m.score, m.max_score) >= 50 ? 'text-amber-600 bg-amber-50'
                      : 'text-red-500 bg-red-50'
                    }`}>
                      {pct(m.score, m.max_score)}%
                    </span>
                    {m.source !== 'auto' && (
                      <button onClick={() => handleDelete(m.id)} disabled={deleting === m.id}
                        className="text-gray-300 hover:text-red-400 transition-colors disabled:opacity-40"
                        title="Remove mark">
                        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                          <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                <ScoreBar score={m.score} max={m.max_score} />
                <div className="flex items-center justify-between mt-1.5">
                  {m.notes && <p className="text-xs text-gray-400 italic truncate flex-1">{m.notes}</p>}
                  <span className="text-xs text-gray-300 ml-auto shrink-0">{fmtDate(m.awarded_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add mark */}
      {showForm ? (
        <AddMarkForm
          studentId={student.id}
          courseId={courseId}
          onSaved={() => { setShowForm(false); fetchMarks(); onMarkAdded() }}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <button onClick={() => setShowForm(true)}
          className="mt-4 w-full py-2.5 rounded-xl text-sm font-semibold border-2 border-dashed border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-700 transition-colors">
          + Add Mark
        </button>
      )}
    </div>
  )
}

/* ── Main page ────────────────────────────────────────────────── */
export default function CourseStudentView() {
  const { courseId } = useParams()
  const navigate     = useNavigate()
  const toast        = useToast()

  const [course,   setCourse]   = useState(null)
  const [students, setStudents] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState(null)
  const [search,   setSearch]   = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get(`/api/courses/${courseId}`),
      api.get(`/api/courses/${courseId}/students`),
    ]).then(([cRes, sRes]) => {
      setCourse(cRes.data)
      const list = sRes.data || []
      setStudents(list)
      if (list.length) setSelected(list[0])
    }).catch(() => toast.error('Failed to load course data'))
      .finally(() => setLoading(false))
  }, [courseId])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return students.filter((s) =>
      s.full_name?.toLowerCase().includes(q) ||
      s.user_id_number?.toLowerCase().includes(q)
    )
  }, [students, search])

  if (loading) return (
    <div className="flex justify-center py-24"><Spinner size="lg" /></div>
  )

  return (
    <div className="flex flex-col gap-5 h-full">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => navigate('/lecturer/courses')}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Courses
        </button>
        <span className="text-gray-300">/</span>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{course?.course_name}</h1>
          <p className="text-xs text-gray-400">{students.length} student{students.length !== 1 ? 's' : ''} enrolled</p>
        </div>
      </div>

      {/* ── Two-panel layout ── */}
      <div className="flex gap-5 min-h-0" style={{ height: 'calc(100vh - 180px)' }}>

        {/* ── LEFT: Student roster ── */}
        <div className="w-72 shrink-0 flex flex-col gap-3 bg-white rounded-2xl p-4 border overflow-hidden"
          style={{ borderColor: '#E5E7EB' }}>

          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Enrolled Students
          </p>

          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" width="13" height="13"
              fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search students…"
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-gray-300" />
          </div>

          {/* Student list */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-1 min-h-0">
            {!filtered.length ? (
              <p className="text-xs text-gray-400 text-center py-6">No students found</p>
            ) : filtered.map((s) => (
              <button key={s.id} onClick={() => setSelected(s)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-colors ${
                  selected?.id === s.id
                    ? 'bg-gray-900 text-white'
                    : 'hover:bg-gray-50 text-gray-700'
                }`}>
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  selected?.id === s.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  {initials(s.full_name)}
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-semibold truncate ${selected?.id === s.id ? 'text-white' : 'text-gray-800'}`}>
                    {s.full_name}
                  </p>
                  <p className={`text-xs truncate ${selected?.id === s.id ? 'text-white/60' : 'text-gray-400'}`}>
                    {s.user_id_number}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── RIGHT: Performance panel ── */}
        <div className="flex-1 min-w-0 bg-white rounded-2xl p-5 border overflow-y-auto"
          style={{ borderColor: '#E5E7EB' }}>
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center">
                <svg width="28" height="28" fill="none" stroke="#9CA3AF" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <p className="text-gray-400 text-sm">Select a student to view their performance</p>
            </div>
          ) : (
            <PerformancePanel
              key={selected.id}
              student={selected}
              courseId={courseId}
              onMarkAdded={() => {}}
            />
          )}
        </div>
      </div>
    </div>
  )
}
