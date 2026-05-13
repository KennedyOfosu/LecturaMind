/**
 * CourseManager.jsx — Create, edit, delete courses and enrol students by ID.
 * Supports level filtering (100 / 200 / 300 / 400) and level badges on cards.
 */

import { useState, useEffect } from 'react'
import { courseService } from '../../services/courseService'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'

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
  const toast = useToast()
  const [courses,      setCourses]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [levelFilter,  setLevelFilter]  = useState('all')
  const [modalState,   setModalState]   = useState({ type: null, course: null })
  const [actionLoading,setActionLoading]= useState(false)
  const [enrolId,      setEnrolId]      = useState('')
  const [enrolMsg,     setEnrolMsg]     = useState({ text: '', isError: false })
  const [deleteTarget, setDeleteTarget] = useState(null)

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
      await courseService.create(form)
      toast.success('Course created!')
      setModalState({ type: null })
      fetchCourses()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create course')
    } finally { setActionLoading(false) }
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

  const handleEnrol = async () => {
    const idVal = enrolId.trim().toUpperCase()
    if (!idVal) return
    setActionLoading(true)
    setEnrolMsg({ text: '', isError: false })
    try {
      const res = await courseService.enrolStudent(modalState.course.id, idVal)
      setEnrolMsg({ text: res.data.message, isError: false })
      setEnrolId('')
      fetchCourses()
    } catch (err) {
      setEnrolMsg({ text: err.response?.data?.error || 'Enrolment failed', isError: true })
    } finally { setActionLoading(false) }
  }

  const openEnrol = (course) => {
    setEnrolId('')
    setEnrolMsg({ text: '', isError: false })
    setModalState({ type: 'enrol', course })
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

              <div className="flex gap-2 pt-2 border-t border-gray-100 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => openEnrol(course)}>
                  Enrol Student
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setModalState({ type: 'edit', course })}>
                  Edit
                </Button>
                <Button size="sm" variant="danger" onClick={() => setDeleteTarget(course)}>
                  Delete
                </Button>
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

      {/* Enrol by Student ID */}
      <Modal isOpen={modalState.type === 'enrol'} onClose={() => setModalState({ type: null })} title="Enrol Student">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-500">
            Enter the student's ID number to enrol them in{' '}
            <strong>{modalState.course?.course_name}</strong>.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Student ID Number</label>
            <input
              type="text"
              value={enrolId}
              onChange={(e) => { setEnrolId(e.target.value.toUpperCase()); setEnrolMsg({ text: '', isError: false }) }}
              onKeyDown={(e) => e.key === 'Enter' && handleEnrol()}
              placeholder="e.g. STU-2001"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
            <p className="text-xs text-gray-400 mt-1">
              Enter the student's ID number exactly as it was given to them.
            </p>
          </div>

          {enrolMsg.text && (
            <p className={`text-sm rounded-lg px-3 py-2 ${
              enrolMsg.isError ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'
            }`}>
              {enrolMsg.text}
            </p>
          )}

          <Button variant="teal" onClick={handleEnrol} loading={actionLoading} className="w-full">
            Enrol Student
          </Button>
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
