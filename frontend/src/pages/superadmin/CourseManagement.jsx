import { useState, useEffect, useCallback } from 'react'
import { adminService } from '../../services/adminService'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { AdminActionButton } from '../../components/ui/AdminActionButton'
import { LEVELS } from '../../utils/constants'

export default function CourseManagement() {
  const [courses, setCourses] = useState([])
  const [lecturers, setLecturers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [editModal, setEditModal] = useState(false)
  const [formData, setFormData] = useState({})
  const [saving, setSaving] = useState(false)
  const [createModal, setCreateModal] = useState(false)
  const toast = useToast()

  const fetchCourses = useCallback(() => {
    setLoading(true)
    const params = {}
    if (search.trim()) params.search = search.trim()
    if (levelFilter) params.level = levelFilter
    adminService.getCourses(params)
      .then((r) => setCourses(r.data))
      .catch(() => toast.error('Failed to load courses'))
      .finally(() => setLoading(false))
  }, [search, levelFilter, toast])

  useEffect(() => { fetchCourses() }, [fetchCourses])

  useEffect(() => {
    adminService.getUsers({ role: 'lecturer' })
      .then((r) => setLecturers(r.data || []))
      .catch(() => toast.error('Failed to load lecturer accounts'))
  }, [toast])

  const openCreate = () => {
    setFormData({ course_name: '', course_code: '', description: '', level: '', programme: '', lecturer_id: '', semester: 'Semester 1' })
    setCreateModal(true)
  }

  const handleCreate = async () => {
    if (!formData.course_name?.trim() || !formData.course_code?.trim() || !formData.programme || !formData.level || !formData.lecturer_id) {
      toast.warning('Complete the course, programme, level, and lecturer fields')
      return
    }
    setSaving(true)
    try {
      const result = await adminService.createCourse({ ...formData, course_name: formData.course_name.trim(), course_code: formData.course_code.trim() })
      toast.success(`Course created and lecturer assigned${result.data?.students_enrolled ? ` · ${result.data.students_enrolled} students enrolled` : ''}`)
      setCreateModal(false)
      fetchCourses()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create course and assign lecturer')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (course) => {
    setSelectedCourse(course)
    setFormData({
      course_name: course.course_name || '',
      course_code: course.course_code || '',
      description: course.description || '',
      level: course.level || '',
      programme: course.programme || '',
    })
    setEditModal(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await adminService.updateCourse(selectedCourse.id, formData)
      toast.success('Course updated successfully')
      setEditModal(false)
      fetchCourses()
    } catch {
      toast.error('Failed to update course')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (course) => {
    if (!window.confirm(`Delete "${course.course_name}"? This will remove all associated data.`)) return
    try {
      await adminService.deleteCourse(course.id)
      toast.success('Course deleted')
      fetchCourses()
    } catch {
      toast.error('Failed to delete course')
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Course Management</h1>
            <p className="text-sm text-gray-500 mt-1">Manage programme courses, levels, and lecturer assignments</p>
          </div>
          <Button variant="primary" onClick={openCreate}>+ Add Course</Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex gap-1 rounded-lg p-1" style={{ backgroundColor: '#E5E7EB' }}>
          {['', '100', '200', '300', '400'].map((lvl) => (
            <button key={lvl} onClick={() => setLevelFilter(lvl)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                levelFilter === lvl ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {lvl || 'All'}
            </button>
          ))}
        </div>
        <input type="text" placeholder="Search by course name or code..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg text-sm border"
          style={{ borderColor: '#D2D4D9' }} />
      </div>

      {loading ? <Spinner /> : (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff', border: '1px solid #D2D4D9' }}>
          <div className="overflow-x-auto">
            <table className="superadmin-admin-table w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase" style={{ borderBottom: '1px solid #F0F0F2' }}>
                  <th className="text-left px-5 py-3 font-semibold">Course</th>
                  <th className="text-left px-5 py-3 font-semibold">Code</th>
                  <th className="text-left px-5 py-3 font-semibold">Lecturer</th>
                  <th className="text-left px-5 py-3 font-semibold">Level</th>
                  <th className="text-left px-5 py-3 font-semibold">Programme</th>
                  <th className="text-right px-5 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {courses.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">No courses found</td></tr>
                ) : courses.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors" style={{ borderBottom: '1px solid #F0F0F2' }}>
                    <td className="px-5 py-3 font-medium text-gray-800">{c.course_name}</td>
                    <td className="px-5 py-3 text-gray-600">{c.course_code}</td>
                    <td className="px-5 py-3 text-gray-500">{c.lecturer_name}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                        Level {c.level}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{c.programme || '-'}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="admin-action-group">
                        <AdminActionButton icon="edit" label={`Edit ${c.course_name}`} onClick={() => handleEdit(c)} />
                        <AdminActionButton icon="delete" tone="danger" label={`Delete ${c.course_name}`} onClick={() => handleDelete(c)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={editModal} onClose={() => setEditModal(false)} title="Edit Course">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Course Name</label>
            <input type="text" value={formData.course_name || ''} onChange={(e) => setFormData({ ...formData, course_name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Course Code</label>
            <input type="text" value={formData.course_code || ''} onChange={(e) => setFormData({ ...formData, course_code: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm border" rows={3} style={{ borderColor: '#D2D4D9' }} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Level</label>
            <select value={formData.level || ''} onChange={(e) => setFormData({ ...formData, level: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }}>
              <option value="">Select level</option>
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Programme</label>
            <input type="text" value={formData.programme || ''} onChange={(e) => setFormData({ ...formData, programme: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>Save</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={createModal} onClose={() => setCreateModal(false)} title="Create Course and Assign Lecturer">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Course Name</label>
              <input type="text" value={formData.course_name || ''} onChange={(e) => setFormData({ ...formData, course_name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Course Code</label>
              <input type="text" value={formData.course_code || ''} onChange={(e) => setFormData({ ...formData, course_code: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Programme</label>
            <select value={formData.programme || ''} onChange={(e) => setFormData({ ...formData, programme: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }}>
              <option value="">Select programme</option>
              {['BSc Information Technology', 'BSc Information Systems', 'BSc Business Administration'].map((programme) => <option key={programme} value={programme}>{programme}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Level</label>
              <select value={formData.level || ''} onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }}>
                <option value="">Select level</option>
                {LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Semester</label>
              <select value={formData.semester || 'Semester 1'} onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }}>
                {['Semester 1', 'Semester 2'].map((semester) => <option key={semester} value={semester}>{semester}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Lecturer</label>
            <select value={formData.lecturer_id || ''} onChange={(e) => setFormData({ ...formData, lecturer_id: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }}>
              <option value="">Select lecturer</option>
              {lecturers.map((lecturer) => <option key={lecturer.id} value={lecturer.id}>{lecturer.full_name} ({lecturer.user_id_number})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm border" rows={2} style={{ borderColor: '#D2D4D9' }} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCreateModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} loading={saving}>Create and Assign</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
