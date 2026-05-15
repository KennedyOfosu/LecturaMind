/**
 * CourseManager.jsx — Linear-inspired course management table.
 * Stats strip + sortable table + level filter tabs + CRUD modals.
 */

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { courseService } from '../../services/courseService'
import api from '../../services/api'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { PROGRAMMES, SEMESTERS } from '../../utils/constants'

const LEVELS = [100, 200, 300, 400]

/* Color dot per level */
const LEVEL_COLORS = {
  100: '#6366f1', // indigo
  200: '#0d9488', // teal
  300: '#f59e0b', // amber
  400: '#8b5cf6', // violet
}

const LevelDot = ({ level }) => (
  <span
    style={{
      display: 'inline-block',
      width: 8,
      height: 8,
      borderRadius: 99,
      background: LEVEL_COLORS[level] ?? '#9ca3af',
      flexShrink: 0,
    }}
  />
)

/* Level badge pill */
const LevelBadge = ({ level }) =>
  level ? (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border"
      style={{
        background: LEVEL_COLORS[level] + '18',
        borderColor: LEVEL_COLORS[level] + '40',
        color: LEVEL_COLORS[level],
      }}
    >
      L{level}
    </span>
  ) : (
    <span className="text-xs text-gray-400">—</span>
  )

/* Level filter tabs */
function LevelTabs({ active, onChange }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {['all', ...LEVELS].map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          className={`px-3.5 py-1 rounded-md text-xs font-medium border transition-all ${
            active === l
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700'
          }`}
        >
          {l === 'all' ? 'All Levels' : `Level ${l}`}
        </button>
      ))}
    </div>
  )
}

/* Stat chip */
function StatChip({ label, value, sub }) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3 bg-white border border-gray-200 rounded-lg min-w-[110px]">
      <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-xl font-bold text-gray-900 tabular-nums">{value}</span>
      {sub && <span className="text-[11px] text-gray-400">{sub}</span>}
    </div>
  )
}

/* Sort arrow */
function SortArrow({ active, dir }) {
  if (!active) return <span className="text-gray-300 text-xs ml-1">↕</span>
  return <span className="text-gray-600 text-xs ml-1">{dir === 'asc' ? '↑' : '↓'}</span>
}

/* Course create / edit form */
function CourseForm({ initial = {}, onSubmit, loading }) {
  const [form, setForm] = useState({
    course_name: '', course_code: '', description: '',
    level: initial.level ?? '',
    ...initial,
    level: initial.level ?? '',
  })
  const [errors, setErrors] = useState({})

  const validate = () => {
    const errs = {}
    if (!form.course_name.trim()) errs.course_name = 'Course name is required'
    if (!form.course_code.trim()) errs.course_code = 'Course code is required'
    if (!form.level) errs.level = 'Please select an academic level'
    setErrors(errs)
    return !Object.keys(errs).length
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (validate()) onSubmit({ ...form, level: parseInt(form.level) })
  }

  const f = (key) => ({
    value: form[key] ?? '',
    onChange: (e) => setForm({ ...form, [key]: e.target.value }),
  })

  const inputCls = (key) =>
    `w-full px-3.5 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 ${
      errors[key] ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'
    }`

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {[
        { label: 'Course Name', key: 'course_name', placeholder: 'Introduction to Computing' },
        { label: 'Course Code', key: 'course_code', placeholder: 'ICT 101' },
      ].map(({ label, key, placeholder }) => (
        <div key={key}>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">{label}</label>
          <input {...f(key)} placeholder={placeholder} className={inputCls(key)} />
          {errors[key] && <p className="text-red-500 text-xs mt-1">{errors[key]}</p>}
        </div>
      ))}

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Academic Level</label>
        <select {...f('level')} className={inputCls('level')}>
          <option value="">Select level…</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>Level {l}</option>
          ))}
        </select>
        {errors.level && <p className="text-red-500 text-xs mt-1">{errors.level}</p>}
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Description</label>
        <textarea
          {...f('description')}
          rows={3}
          placeholder="Brief course description…"
          className="w-full px-3.5 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none"
        />
      </div>

      <Button type="submit" variant="teal" loading={loading} className="w-full mt-1">
        {initial.id ? 'Save Changes' : 'Create Course'}
      </Button>
    </form>
  )
}

/* Course table row */
function CourseRow({ course, onEdit, onDelete, onViewStudents, isLast }) {
  const students  = course.enrolments?.[0]?.count ?? 0
  const materials = course.materials?.[0]?.count ?? 0

  return (
    <tr
      className="group hover:bg-gray-50/80 transition-colors cursor-default"
      style={{ borderBottom: isLast ? 'none' : '1px solid #f3f4f6' }}
    >
      {/* Code + dot */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-2.5">
          <LevelDot level={course.level} />
          <span className="font-mono text-xs font-semibold text-gray-500 tracking-wide">
            {course.course_code}
          </span>
        </div>
      </td>

      {/* Name */}
      <td className="px-4 py-3">
        <span className="text-sm font-semibold text-gray-900">{course.course_name}</span>
        {course.description && (
          <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{course.description}</p>
        )}
      </td>

      {/* Level */}
      <td className="px-4 py-3 whitespace-nowrap">
        <LevelBadge level={course.level} />
      </td>

      {/* Students */}
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <span className="text-sm font-semibold tabular-nums text-gray-800">{students}</span>
        <span className="text-xs text-gray-400 ml-1">enrolled</span>
      </td>

      {/* Materials */}
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <span className="text-sm tabular-nums text-gray-600">{materials}</span>
        <span className="text-xs text-gray-400 ml-1">files</span>
      </td>

      {/* Status */}
      <td className="px-4 py-3 whitespace-nowrap">
        {students > 0 ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
            Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-500 border border-gray-200">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block"></span>
            Empty
          </span>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onViewStudents(course)}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-gray-600 bg-white border border-gray-200 hover:border-gray-400 hover:text-gray-900 transition-all"
          >
            Students
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
          <button
            onClick={() => onEdit(course)}
            className="px-2.5 py-1 rounded text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-all"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(course)}
            className="px-2.5 py-1 rounded text-xs font-medium text-red-500 hover:bg-red-50 hover:text-red-700 transition-all"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  )
}

export default function CourseManager() {
  const toast    = useToast()
  const navigate = useNavigate()
  const [courses,       setCourses]       = useState([])
  const [loading,       setLoading]       = useState(true)
  const [levelFilter,   setLevelFilter]   = useState('all')
  const [search,        setSearch]        = useState('')
  const [sort,          setSort]          = useState({ key: 'course_name', dir: 'asc' })
  const [modalState,    setModalState]    = useState({ type: null, course: null })
  const [actionLoading, setActionLoading] = useState(false)
  const [deleteTarget,  setDeleteTarget]  = useState(null)
  const [justCreated,   setJustCreated]   = useState(null)
  const [assignForm,    setAssignForm]    = useState({ programme: '', level: '', semester: '', academic_year: '' })
  const [savingAssign,  setSavingAssign]  = useState(false)

  const fetchCourses = () => {
    setLoading(true)
    courseService.getMyCourses()
      .then((res) => setCourses(res.data))
      .catch(() => toast.error('Failed to load courses'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchCourses() }, [])

  /* Stats */
  const totalStudents = useMemo(
    () => courses.reduce((sum, c) => sum + (c.enrolments?.[0]?.count ?? 0), 0),
    [courses]
  )
  const activeCourses = useMemo(
    () => courses.filter((c) => (c.enrolments?.[0]?.count ?? 0) > 0).length,
    [courses]
  )

  /* Filter + sort */
  const displayed = useMemo(() => {
    let list = courses
    if (levelFilter !== 'all') list = list.filter((c) => c.level === levelFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (c) =>
          c.course_name.toLowerCase().includes(q) ||
          c.course_code.toLowerCase().includes(q)
      )
    }
    return [...list].sort((a, b) => {
      let av = a[sort.key] ?? ''
      let bv = b[sort.key] ?? ''
      if (sort.key === 'students') { av = a.enrolments?.[0]?.count ?? 0; bv = b.enrolments?.[0]?.count ?? 0 }
      if (sort.key === 'materials') { av = a.materials?.[0]?.count ?? 0; bv = b.materials?.[0]?.count ?? 0 }
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      if (av < bv) return sort.dir === 'asc' ? -1 : 1
      if (av > bv) return sort.dir === 'asc' ? 1 : -1
      return 0
    })
  }, [courses, levelFilter, search, sort])

  const toggleSort = (key) =>
    setSort((s) => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })

  const Th = ({ label, sortKey, className = '' }) => (
    <th
      className={`px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide select-none cursor-pointer hover:text-gray-600 transition-colors whitespace-nowrap ${className}`}
      onClick={() => toggleSort(sortKey)}
    >
      {label}
      <SortArrow active={sort.key === sortKey} dir={sort.dir} />
    </th>
  )

  /* Handlers */
  const handleCreate = async (form) => {
    setActionLoading(true)
    try {
      const res = await courseService.create(form)
      toast.success('Course created!')
      setJustCreated(res.data)
      setAssignForm({ programme: '', level: form.level || '', semester: '', academic_year: '' })
      setModalState({ type: 'assign' })
      fetchCourses()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create course')
    } finally { setActionLoading(false) }
  }

  const handleSaveAssignment = async () => {
    if (!assignForm.programme || !assignForm.level) {
      toast.error('Programme and level are required')
      return
    }
    setSavingAssign(true)
    try {
      const res = await api.post('/api/assignments/create', {
        course_id:     justCreated.id,
        programme:     assignForm.programme,
        level:         parseInt(assignForm.level),
        semester:      assignForm.semester || null,
        academic_year: assignForm.academic_year || null,
      })
      toast.success(res.data.message || 'Assignment saved!')
      setModalState({ type: null })
      setJustCreated(null)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save assignment')
    } finally { setSavingAssign(false) }
  }

  const skipAssignment = () => { setModalState({ type: null }); setJustCreated(null) }

  const handleEdit = async (form) => {
    setActionLoading(true)
    try {
      await courseService.update(modalState.course.id, form)
      toast.success('Course updated!')
      setModalState({ type: null })
      fetchCourses()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update course')
    } finally { setActionLoading(false) }
  }

  const handleDelete = async () => {
    setActionLoading(true)
    try {
      await courseService.delete(deleteTarget.id)
      toast.success('Course deleted')
      setDeleteTarget(null)
      fetchCourses()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete course')
    } finally { setActionLoading(false) }
  }

  return (
    <div className="flex flex-col gap-5">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Course Manager</h1>
          <p className="text-gray-400 text-sm mt-0.5">Create, configure and manage your courses</p>
        </div>
        <button
          onClick={() => setModalState({ type: 'create' })}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
          Create Course
        </button>
      </div>

      {/* ── Stats strip ── */}
      {!loading && (
        <div className="flex gap-3 flex-wrap">
          <StatChip label="Total Courses" value={courses.length} />
          <StatChip label="Total Enrolled" value={totalStudents} sub="across all courses" />
          <StatChip label="Active Courses" value={activeCourses} sub="with students" />
          <StatChip label="Levels" value={[...new Set(courses.map((c) => c.level).filter(Boolean))].length} sub="distinct levels" />
        </div>
      )}

      {/* ── Filter bar ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <LevelTabs active={levelFilter} onChange={setLevelFilter} />

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses…"
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-300 w-52"
          />
        </div>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-200 text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-2xl">📚</div>
          <div>
            <p className="font-semibold text-gray-700">
              {search ? 'No matching courses' : levelFilter === 'all' ? 'No courses yet' : `No Level ${levelFilter} courses`}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {search ? 'Try a different search term' : 'Create your first course to get started'}
            </p>
          </div>
          {!search && (
            <button
              onClick={() => setModalState({ type: 'create' })}
              className="mt-1 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              + Create Course
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Table header showing count */}
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {displayed.length} course{displayed.length !== 1 ? 's' : ''}
              {levelFilter !== 'all' ? ` · Level ${levelFilter}` : ''}
            </span>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>Active
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gray-300 inline-block"></span>Empty
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <Th label="Code"      sortKey="course_code" />
                  <Th label="Name"      sortKey="course_name" />
                  <Th label="Level"     sortKey="level" />
                  <Th label="Students"  sortKey="students"  className="text-right" />
                  <Th label="Materials" sortKey="materials" className="text-right" />
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((course, idx) => (
                  <CourseRow
                    key={course.id}
                    course={course}
                    isLast={idx === displayed.length - 1}
                    onEdit={(c)          => setModalState({ type: 'edit', course: c })}
                    onDelete={(c)        => setDeleteTarget(c)}
                    onViewStudents={(c)  => navigate(`/lecturer/courses/${c.id}/students`)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modals ── */}

      {/* Create */}
      <Modal isOpen={modalState.type === 'create'} onClose={() => setModalState({ type: null })} title="Create New Course">
        <CourseForm onSubmit={handleCreate} loading={actionLoading} />
      </Modal>

      {/* Edit */}
      <Modal isOpen={modalState.type === 'edit'} onClose={() => setModalState({ type: null })} title="Edit Course">
        <CourseForm initial={modalState.course} onSubmit={handleEdit} loading={actionLoading} />
      </Modal>

      {/* Assignment prompt (after course creation) */}
      <Modal isOpen={modalState.type === 'assign'} onClose={skipAssignment} title="Assign to a class">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-500">
            Link <strong className="text-gray-800">{justCreated?.course_name}</strong> to a programme
            and level so students in that cohort are automatically connected.
          </p>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Programme</label>
            <select
              value={assignForm.programme}
              onChange={(e) => setAssignForm({ ...assignForm, programme: e.target.value })}
              className="w-full px-3.5 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              <option value="">Select programme…</option>
              {PROGRAMMES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Level</label>
              <select
                value={assignForm.level}
                onChange={(e) => setAssignForm({ ...assignForm, level: e.target.value })}
                className="w-full px-3.5 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                <option value="">Level…</option>
                {LEVELS.map((l) => <option key={l} value={l}>Level {l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Semester</label>
              <select
                value={assignForm.semester}
                onChange={(e) => setAssignForm({ ...assignForm, semester: e.target.value })}
                className="w-full px-3.5 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                <option value="">Optional</option>
                {SEMESTERS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Academic Year</label>
            <input
              value={assignForm.academic_year}
              onChange={(e) => setAssignForm({ ...assignForm, academic_year: e.target.value })}
              placeholder="e.g. 2025/2026"
              className="w-full px-3.5 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={skipAssignment}
              className="flex-1 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Skip for now
            </button>
            <Button variant="teal" onClick={handleSaveAssignment} loading={savingAssign} className="flex-1">
              Save Assignment
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Course">
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3 p-3.5 rounded-lg bg-red-50 border border-red-100">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" className="mt-0.5 flex-shrink-0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <p className="text-sm text-red-700">
              Deleting <strong>{deleteTarget?.course_name}</strong> will permanently remove all
              materials, announcements, chat history, and student enrollments.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setDeleteTarget(null)}
              className="flex-1 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <Button variant="danger" onClick={handleDelete} loading={actionLoading} className="flex-1">
              Delete Course
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
