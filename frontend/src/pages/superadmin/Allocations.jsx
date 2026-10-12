import { useState, useEffect, useCallback } from 'react'
import { adminService } from '../../services/adminService'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { SEMESTERS } from '../../utils/constants'

const TAB_COLORS = {
  active: 'bg-white text-gray-900 shadow-sm',
  inactive: 'text-gray-500 hover:text-gray-700',
}

function LecturerAllocationTab({ toast }) {
  const [lecturers, setLecturers] = useState([])
  const [courses, setCourses] = useState([])
  const [allocations, setAllocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  const fetch = useCallback(() => {
    setLoading(true)
    Promise.all([
      adminService.getUsers({ role: 'lecturer' }),
      adminService.getCourses(),
      adminService.getAllocations(),
    ]).then(([lecRes, couRes, allocRes]) => {
      setLecturers(lecRes.data)
      setCourses(couRes.data)
      setAllocations(allocRes.data)
    }).catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false))
  }, [toast])

  useEffect(() => { fetch() }, [fetch])

  const openModal = () => {
    setForm({ lecturer_id: '', course_id: '', semester: 'Semester 1', academic_year: '' })
    setModal(true)
  }

  const handleAllocate = async () => {
    if (!form.lecturer_id || !form.course_id) { toast.warning('Select lecturer and course'); return }
    setSaving(true)
    try {
      await adminService.allocateLecturer(form)
      toast.success('Lecturer allocated')
      setModal(false)
      fetch()
    } catch { toast.error('Failed to allocate') }
    finally { setSaving(false) }
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button variant="primary" onClick={openModal}>+ Allocate Lecturer</Button></div>
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff', border: '1px solid #D2D4D9' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 uppercase" style={{ borderBottom: '1px solid #F0F0F2' }}>
              <th className="text-left px-5 py-3 font-semibold">Lecturer</th>
              <th className="text-left px-5 py-3 font-semibold">Course</th>
              <th className="text-left px-5 py-3 font-semibold">Code</th>
              <th className="text-left px-5 py-3 font-semibold">Semester</th>
            </tr>
          </thead>
          <tbody>
            {allocations.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-8 text-gray-400">No allocations yet</td></tr>
            ) : allocations.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50" style={{ borderBottom: '1px solid #F0F0F2' }}>
                <td className="px-5 py-3 font-medium text-gray-800">{a.lecturer_name}</td>
                <td className="px-5 py-3 text-gray-800">{a.course_name}</td>
                <td className="px-5 py-3">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{a.course_code}</span>
                </td>
                <td className="px-5 py-3 text-gray-500">{a.semester || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title="Allocate Lecturer to Course">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Lecturer</label>
            <select value={form.lecturer_id || ''} onChange={(e) => setForm({ ...form, lecturer_id: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }}>
              <option value="">Select lecturer</option>
              {lecturers.map((l) => <option key={l.id} value={l.id}>{l.full_name} ({l.user_id_number})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Course</label>
            <select value={form.course_id || ''} onChange={(e) => setForm({ ...form, course_id: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }}>
              <option value="">Select course</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.course_name} ({c.course_code})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Semester</label>
            <select value={form.semester || 'Semester 1'} onChange={(e) => setForm({ ...form, semester: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }}>
              {SEMESTERS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleAllocate} loading={saving}>Allocate</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function ClassroomAllocationTab({ toast }) {
  const [students, setStudents] = useState([])
  const [classrooms, setClassrooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const fetch = useCallback(() => {
    setLoading(true)
    Promise.all([
      adminService.getUsers({ role: 'student' }),
      adminService.getClassrooms(),
    ]).then(([stuRes, crRes]) => {
      setStudents(stuRes.data)
      setClassrooms(crRes.data)
    }).catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false))
  }, [toast])

  useEffect(() => { fetch() }, [fetch])

  const openModal = (student) => {
    setForm({ student_id: student.id, classroom_id: student.classroom_id || '', section: student.section || '' })
    setModal(true)
  }

  const handleAllocate = async () => {
    if (!form.classroom_id) { toast.warning('Select a classroom'); return }
    setSaving(true)
    try {
      await adminService.allocateClassroom(form)
      toast.success('Student allocated to classroom')
      setModal(false)
      fetch()
    } catch { toast.error('Failed to allocate') }
    finally { setSaving(false) }
  }

  const filtered = students.filter((s) =>
    !search || s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.user_id_number?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">
      <input type="text" placeholder="Search students by name or ID..."
        value={search} onChange={(e) => setSearch(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }} />
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff', border: '1px solid #D2D4D9' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 uppercase" style={{ borderBottom: '1px solid #F0F0F2' }}>
              <th className="text-left px-5 py-3 font-semibold">Student</th>
              <th className="text-left px-5 py-3 font-semibold">ID</th>
              <th className="text-left px-5 py-3 font-semibold">Programme</th>
              <th className="text-left px-5 py-3 font-semibold">Current Classroom</th>
              <th className="text-right px-5 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">No students found</td></tr>
            ) : filtered.map((s) => {
              const cr = classrooms.find((c) => c.id === s.classroom_id)
              return (
                <tr key={s.id} className="hover:bg-gray-50" style={{ borderBottom: '1px solid #F0F0F2' }}>
                  <td className="px-5 py-3 font-medium text-gray-800">{s.full_name}</td>
                  <td className="px-5 py-3 text-gray-500">{s.user_id_number}</td>
                  <td className="px-5 py-3 text-gray-500">{s.programme || '-'}</td>
                  <td className="px-5 py-3">
                    {cr ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{cr.name}</span>
                    ) : <span className="text-xs text-gray-400">Unassigned</span>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => openModal(s)} className="text-xs text-gray-500 hover:text-gray-800">
                      {cr ? 'Change' : 'Assign'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title="Assign Classroom">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Classroom</label>
            <select value={form.classroom_id || ''} onChange={(e) => setForm({ ...form, classroom_id: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }}>
              <option value="">Select classroom</option>
              {classrooms.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Section</label>
            <input type="text" value={form.section || ''} onChange={(e) => setForm({ ...form, section: e.target.value })}
              placeholder="e.g. A, B, Morning, Evening"
              className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleAllocate} loading={saving}>Assign</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default function Allocations() {
  const [activeTab, setActiveTab] = useState('lecturer')
  const toast = useToast()

  const tabs = [
    { key: 'lecturer', label: 'Lecturer → Course' },
    { key: 'classroom', label: 'Student → Classroom' },
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Allocations</h1>
        <p className="text-sm text-gray-500 mt-1">Map lecturers to courses and students to classrooms</p>
      </div>
      <div className="flex gap-1 rounded-lg p-1" style={{ backgroundColor: '#E5E7EB' }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === t.key ? TAB_COLORS.active : TAB_COLORS.inactive}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'lecturer' && <LecturerAllocationTab toast={toast} />}
      {activeTab === 'classroom' && <ClassroomAllocationTab toast={toast} />}
    </div>
  )
}
