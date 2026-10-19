import { useState, useEffect, useCallback } from 'react'
import { adminService } from '../../services/adminService'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { Card } from '../../components/ui/Card'
import { useToast } from '../../components/ui/Toast'
import { AdminActionButton } from '../../components/ui/AdminActionButton'

export default function Enrolments() {
  const [enrolments, setEnrolments] = useState([])
  const [students, setStudents] = useState([])
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ student_id: '', course_id: '' })
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const fetch = useCallback(() => {
    setLoading(true)
    Promise.all([
      adminService.getEnrolments(),
      adminService.getUsers({ role: 'student' }),
      adminService.getCourses(),
    ]).then(([enrRes, stuRes, couRes]) => {
      setEnrolments(enrRes.data)
      setStudents(stuRes.data)
      setCourses(couRes.data)
    }).catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false))
  }, [toast])

  useEffect(() => { fetch() }, [fetch])

  const openCreate = () => {
    setForm({ student_id: '', course_id: '' })
    setModal(true)
  }

  const handleCreate = async () => {
    if (!form.student_id || !form.course_id) { toast.warning('Select student and course'); return }
    setSaving(true)
    try {
      await adminService.createEnrolment(form)
      toast.success('Student enrolled')
      setModal(false)
      fetch()
    } catch (err) {
      const msg = err?.response?.data?.error || 'Failed to enrol'
      toast.error(msg)
    } finally { setSaving(false) }
  }

  const handleRemove = async (enrolment) => {
    if (!window.confirm(`Remove ${enrolment.profiles?.full_name} from ${enrolment.courses?.course_name}?`)) return
    try {
      await adminService.removeEnrolment(enrolment.id)
      toast.success('Enrolment removed')
      fetch()
    } catch { toast.error('Failed to remove') }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Enrolments</h1>
          <p className="text-sm text-gray-500 mt-1">Manage student course enrolments</p>
        </div>
        <Button variant="primary" onClick={openCreate}>+ Enrol Student</Button>
      </div>

      {loading ? <Spinner /> : (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff', border: '1px solid #D2D4D9' }}>
          <div className="overflow-x-auto">
            <table className="superadmin-admin-table w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase" style={{ borderBottom: '1px solid #F0F0F2' }}>
                  <th className="text-left px-5 py-3 font-semibold">Student</th>
                  <th className="text-left px-5 py-3 font-semibold">ID</th>
                  <th className="text-left px-5 py-3 font-semibold">Course</th>
                  <th className="text-left px-5 py-3 font-semibold">Enrolled</th>
                  <th className="text-right px-5 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {enrolments.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-400">No enrolments found</td></tr>
                ) : enrolments.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50" style={{ borderBottom: '1px solid #F0F0F2' }}>
                    <td className="px-5 py-3 font-medium text-gray-800">{e.profiles?.full_name || 'Unknown'}</td>
                    <td className="px-5 py-3 text-gray-500">{e.profiles?.user_id_number || '-'}</td>
                    <td className="px-5 py-3 text-gray-800">{e.courses?.course_name} ({e.courses?.course_code})</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{new Date(e.created_at).toLocaleDateString()}</td>
                    <td className="px-5 py-3 text-right">
                      <AdminActionButton icon="remove" tone="danger" label={`Remove enrolment for ${e.profiles?.full_name || 'student'}`} onClick={() => handleRemove(e)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={modal} onClose={() => setModal(false)} title="Enrol Student">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Student</label>
            <select value={form.student_id || ''} onChange={(e) => setForm({ ...form, student_id: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }}>
              <option value="">Select student</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.user_id_number})</option>)}
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
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} loading={saving}>Enrol</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
