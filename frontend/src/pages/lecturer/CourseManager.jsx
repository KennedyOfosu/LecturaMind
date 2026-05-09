/**
 * CourseManager.jsx — Create, edit, delete courses and enrol students.
 */

import { useState, useEffect } from 'react'
import { courseService } from '../../services/courseService'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'

function CourseForm({ initial = {}, onSubmit, loading }) {
  const [form, setForm] = useState({ course_name: '', course_code: '', description: '', ...initial })
  const [errors, setErrors] = useState({})

  const validate = () => {
    const errs = {}
    if (!form.course_name.trim()) errs.course_name = 'Course name is required'
    if (!form.course_code.trim()) errs.course_code = 'Course code is required'
    setErrors(errs)
    return !Object.keys(errs).length
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (validate()) onSubmit(form)
  }

  const field = (key) => ({
    value: form[key],
    onChange: (e) => setForm({ ...form, [key]: e.target.value }),
  })

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {[
        { label: 'Course Name', key: 'course_name', placeholder: 'Introduction to Computing' },
        { label: 'Course Code', key: 'course_code', placeholder: 'ICT 101' },
      ].map(({ label, key, placeholder }) => (
        <div key={key}>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
          <input
            {...field(key)}
            placeholder={placeholder}
            className={`w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-teal/50 ${errors[key] ? 'border-red-400' : 'border-gray-200'}`}
          />
          {errors[key] && <p className="text-red-500 text-xs mt-1">{errors[key]}</p>}
        </div>
      ))}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
        <textarea
          {...field('description')}
          rows={3}
          placeholder="Brief description of the course…"
          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50 resize-none"
        />
      </div>
      <Button type="submit" variant="teal" loading={loading} className="w-full">
        {initial.id ? 'Save Changes' : 'Create Course'}
      </Button>
    </form>
  )
}

export default function CourseManager() {
  const toast = useToast()
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalState, setModalState] = useState({ type: null, course: null })
  const [actionLoading, setActionLoading] = useState(false)
  const [enrolEmail, setEnrolEmail] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)

  const fetchCourses = () => {
    setLoading(true)
    courseService.getMyCourses()
      .then((res) => setCourses(res.data))
      .catch(() => toast.error('Failed to load courses'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchCourses() }, [])

  const handleCreate = async (form) => {
    setActionLoading(true)
    try {
      await courseService.create(form)
      toast.success('Course created!')
      setModalState({ type: null })
      fetchCourses()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create course')
    } finally {
      setActionLoading(false)
    }
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
    } finally {
      setActionLoading(false)
    }
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
    } finally {
      setActionLoading(false)
    }
  }

  const handleEnrol = async () => {
    if (!enrolEmail.trim()) return
    setActionLoading(true)
    try {
      await courseService.enrolStudent(modalState.course.id, enrolEmail.trim())
      toast.success('Student enrolled!')
      setEnrolEmail('')
      setModalState({ type: null })
    } catch (err) {
      toast.error(err.response?.data?.error || 'Enrolment failed')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Course Manager</h1>
          <p className="text-gray-500 text-sm mt-1">Create and manage your courses</p>
        </div>
        <Button variant="teal" onClick={() => setModalState({ type: 'create' })}>
          + Create Course
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : !courses.length ? (
        <EmptyState
          icon="📚"
          title="No courses yet"
          description="Create your first course to get started"
          action={<Button variant="teal" onClick={() => setModalState({ type: 'create' })}>+ Create Course</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {courses.map((course) => (
            <Card key={course.id} className="flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-navy text-lg leading-tight">{course.course_name}</h3>
                  <Badge variant="teal" className="mt-1">{course.course_code}</Badge>
                </div>
              </div>

              {course.description && (
                <p className="text-sm text-gray-500 line-clamp-2">{course.description}</p>
              )}

              <div className="flex gap-4 text-sm text-gray-500">
                <span>👥 {course.enrolments?.[0]?.count ?? 0} students</span>
                <span>📄 {course.materials?.[0]?.count ?? 0} materials</span>
              </div>

              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <Button size="sm" variant="outline" onClick={() => setModalState({ type: 'enrol', course })}>
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

      {/* Create Modal */}
      <Modal isOpen={modalState.type === 'create'} onClose={() => setModalState({ type: null })} title="Create New Course">
        <CourseForm onSubmit={handleCreate} loading={actionLoading} />
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={modalState.type === 'edit'} onClose={() => setModalState({ type: null })} title="Edit Course">
        <CourseForm initial={modalState.course} onSubmit={handleEdit} loading={actionLoading} />
      </Modal>

      {/* Enrol Modal */}
      <Modal isOpen={modalState.type === 'enrol'} onClose={() => setModalState({ type: null })} title="Enrol Student">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-500">Enter the student's email address to enrol them in <strong>{modalState.course?.course_name}</strong>.</p>
          <input
            type="email"
            value={enrolEmail}
            onChange={(e) => setEnrolEmail(e.target.value)}
            placeholder="student@example.com"
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50"
          />
          <Button variant="teal" onClick={handleEnrol} loading={actionLoading} className="w-full">
            Enrol Student
          </Button>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Course">
        <div className="flex flex-col gap-5">
          <p className="text-gray-600 text-sm">
            Are you sure you want to delete <strong>{deleteTarget?.course_name}</strong>? This will permanently remove all materials, announcements, and chat history associated with it.
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
