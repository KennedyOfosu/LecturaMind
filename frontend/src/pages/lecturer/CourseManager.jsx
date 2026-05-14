/**
 * CourseManager.jsx — Create, edit, delete courses and enrol students by ID.
 * Supports level filtering (100 / 200 / 300 / 400) and level badges on cards.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { courseService } from '../../services/courseService'
import api from '../../services/api'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'
import { PROGRAMMES, SEMESTERS } from '../../utils/constants'

const LEVELS = [100, 200, 300, 400]

/* Level badge */
const LevelBadge = ({ level }) =>
  level ? (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
      Level {level}
    </span>
  ) : null

/* Level filter tabs */
function LevelTabs({ active, onChange }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {['all', ...LEVELS].map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
            active === l
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
          }`}
        >
          {l === 'all' ? 'All Levels' : `Level ${l}`}
        </button>
      ))}
    </div>
  )
}

/* Course create / edit form */
function CourseForm({ initial = {}, onSubmit, loading }) {
  const [form, setForm]   = useState({
    course_name: '', course_code: '', description: '', level: '', ...initial,
    level: initial.level ?? '',
  })
  const [errors, setErrors] = useState({})

  const validate = () => {
    const errs = {}
    if (!form.course_name.trim()) errs.course_name = 'Course name is required'
    if (!form.course_code.trim()) errs.course_code = 'Course code is required'
    if (!form.level)               errs.level       = 'Please select an academic level'
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
    `w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 ${
      errors[key] ? 'border-red-400 bg-red-50' : 'border-gray-200'
    }`

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {[
        { label: 'Course Name', key: 'course_name', placeholder: 'Introduction to Computing' },
        { label: 'Course Code', key: 'course_code', placeholder: 'ICT 101' },
      ].map(({ label, key, placeholder }) => (
        <div key={key}>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
          <input {...f(key)} placeholder={placeholder} className={inputCls(key)} />
          {errors[key] && <p className="text-red-500 text-xs mt-1">{errors[key]}</p>}
        </div>
      ))}

      {/* Level selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Academic Level</label>
        <select {...f('level')} className={inputCls('level')}>
          <option value="">Select student level</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>Level {l}</option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1">The academic year level this course is intended for.</p>
        {errors.level && <p className="text-red-500 text-xs mt-1">{errors.level}</p>}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
        <textarea {...f('description')} rows={3} placeholder="Brief description…"
          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none" />
      </div>

      <Button type="submit" variant="teal" loading={loading} className="w-full">
        {initial.id ? 'Save Changes' : 'Create Course'}
      </Button>
    </form>
  )
}

export default function CourseManager() {
  const toast    = useToast()
  const navigate = useNavigate()
  const [courses,      setCourses]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [levelFilter,  setLevelFilter]  = useState('all')
  const [modalState,   setModalState]   = useState({ type: null, course: null })
  const [actionLoading,setActionLoading]= useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [justCreated,  setJustCreated]  = useState(null)
  const [assignForm,   setAssignForm]   = useState({ programme: '', level: '', semester: '', academic_year: '' })
  const [savingAssign, setSavingAssign] = useState(false)

  const fetchCourses = () => {
    setLoading(true)
    courseService.getMyCourses()
      .then((res) => setCourses(res.data))
      .catch(() => toast.error('Failed to load courses'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchCourses() }, [])

  const displayed = levelFilter === 'all'
    ? courses
    : courses.filter((c) => c.level === levelFilter)

  const handleCreate = async (form) => {
    setActionLoading(true)
    try {
      const res = await courseService.create(form)
      toast.success('Course created!')
      // Open assignment prompt with the new course
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

  const skipAssignment = () => {
    setModalState({ type: null })
    setJustCreated(null)
  }

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
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Course Manager</h1>
          <p className="text-gray-500 text-sm mt-1">Create and manage your courses</p>
        </div>
        <Button variant="teal" onClick={() => setModalState({ type: 'create' })}>
          + Create Course
        </Button>
      </div>

      {/* Level filter tabs */}
      <LevelTabs active={levelFilter} onChange={setLevelFilter} />

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : !displayed.length ? (
        <EmptyState
          icon="📚"
          title={levelFilter === 'all' ? 'No courses yet' : `No Level ${levelFilter} courses`}
          description="Create your first course to get started"
          action={<Button variant="teal" onClick={() => setModalState({ type: 'create' })}>+ Create Course</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {displayed.map((course) => (
            <Card key={course.id} className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 text-lg leading-tight truncate">
                    {course.course_name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal/10 text-teal">
                      {course.course_code}
                    </span>
                    <LevelBadge level={course.level} />
                  </div>
                </div>
              </div>

              {course.description && (
                <p className="text-sm text-gray-500 line-clamp-2">{course.description}</p>
              )}

              <div className="flex gap-4 text-sm text-gray-500">
                <span>{course.enrolments?.[0]?.count ?? 0} students</span>
                <span>{course.materials?.[0]?.count ?? 0} materials</span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100 gap-2 flex-wrap">
                <Button size="sm" variant="outline"
                  onClick={() => navigate(`/lecturer/courses/${course.id}/students`)}>
                  View Students →
                </Button>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setModalState({ type: 'edit', course })}>
                    Edit
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setDeleteTarget(course)}>
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create */}
      <Modal isOpen={modalState.type === 'create'} onClose={() => setModalState({ type: null })} title="Create New Course">
        <CourseForm onSubmit={handleCreate} loading={actionLoading} />
      </Modal>

      {/* Edit */}
      <Modal isOpen={modalState.type === 'edit'} onClose={() => setModalState({ type: null })} title="Edit Course">
        <CourseForm initial={modalState.course} onSubmit={handleEdit} loading={actionLoading} />
      </Modal>

      {/* Assignment prompt (after course creation) */}
      <Modal isOpen={modalState.type === 'assign'} onClose={skipAssignment} title="Assign this course to a class">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-500">
            Link <strong>{justCreated?.course_name}</strong> to a programme and level so students
            in that class are automatically connected. You can also do this later from your profile.
          </p>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Programme</label>
            <select value={assignForm.programme}
              onChange={(e) => setAssignForm({ ...assignForm, programme: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300">
              <option value="">Select programme</option>
              {PROGRAMMES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Level</label>
              <select value={assignForm.level}
                onChange={(e) => setAssignForm({ ...assignForm, level: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300">
                <option value="">Level</option>
                {[100, 200, 300, 400].map((l) => <option key={l} value={l}>Level {l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Semester (optional)</label>
              <select value={assignForm.semester}
                onChange={(e) => setAssignForm({ ...assignForm, semester: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300">
                <option value="">—</option>
                {SEMESTERS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Academic Year (optional)</label>
            <input value={assignForm.academic_year}
              onChange={(e) => setAssignForm({ ...assignForm, academic_year: e.target.value })}
              placeholder="e.g. 2025/2026"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
          </div>

          <div className="flex gap-3 mt-2">
            <Button variant="outline" onClick={skipAssignment} className="flex-1">Skip for now</Button>
            <Button variant="teal" onClick={handleSaveAssignment} loading={savingAssign} className="flex-1">
              Save Assignment
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Course">
        <div className="flex flex-col gap-5">
          <p className="text-gray-600 text-sm">
            Are you sure you want to delete <strong>{deleteTarget?.course_name}</strong>?
            This will permanently remove all materials, announcements, and chat history.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="flex-1">Cancel</Button>
            <Button variant="danger" onClick={handleDelete} loading={actionLoading} className="flex-1">Delete Course</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
