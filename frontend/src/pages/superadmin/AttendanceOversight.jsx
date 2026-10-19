import { useState, useEffect, useCallback } from 'react'
import { adminService } from '../../services/adminService'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { AdminActionButton } from '../../components/ui/AdminActionButton'
import { ATTENDANCE_STATUSES } from '../../utils/constants'

export default function AttendanceOversight() {
  const [data, setData] = useState({ records: [], summary: {} })
  const [loading, setLoading] = useState(true)
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [selected, setSelected] = useState(null)
  const [editModal, setEditModal] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const fetch = useCallback(() => {
    setLoading(true)
    const params = { flagged: flaggedOnly }
    adminService.getAttendance(params)
      .then((r) => setData(r.data))
      .catch(() => toast.error('Failed to load attendance'))
      .finally(() => setLoading(false))
  }, [toast, flaggedOnly])

  useEffect(() => { fetch() }, [fetch])

  const openEdit = (record) => {
    setSelected(record)
    setEditForm({ status: record.status, is_flagged: record.is_flagged, flag_reason: record.flag_reason || '' })
    setEditModal(true)
  }

  const handleUpdate = async () => {
    setSaving(true)
    try {
      await adminService.updateAttendance(selected.id, editForm)
      toast.success('Attendance record updated')
      setEditModal(false)
      fetch()
    } catch { toast.error('Failed to update') }
    finally { setSaving(false) }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Attendance Oversight</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor and manage attendance records across all courses</p>
        </div>
      </div>

      {!loading && data.summary && (
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'Total Records', value: data.summary.total, color: 'text-gray-900' },
            { label: 'Present', value: data.summary.present, color: 'text-green-600' },
            { label: 'Absent', value: data.summary.absent, color: 'text-red-600' },
            { label: 'Late', value: data.summary.late, color: 'text-yellow-600' },
            { label: 'Attendance Rate', value: `${data.summary.attendance_rate}%`, color: 'text-indigo-600' },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl p-4 text-center" style={{ backgroundColor: '#fff', border: '1px solid #D2D4D9' }}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)}
            className="rounded" />
          <span className="text-gray-700">Flagged records only</span>
        </label>
        <span className="text-xs text-gray-400">
          {flaggedOnly ? 'Showing only flagged attendance' : 'Showing all attendance records'}
        </span>
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
                  <th className="text-left px-5 py-3 font-semibold">Date</th>
                  <th className="text-left px-5 py-3 font-semibold">Status</th>
                  <th className="text-left px-5 py-3 font-semibold">Flagged</th>
                  <th className="text-right px-5 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.records?.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-400">No attendance records</td></tr>
                ) : data.records?.map((r) => (
                  <tr key={r.id} className={`hover:bg-gray-50 transition-colors ${r.is_flagged ? 'bg-red-50' : ''}`}
                    style={{ borderBottom: '1px solid #F0F0F2' }}>
                    <td className="px-5 py-3 font-medium text-gray-800">{r.profiles?.full_name || 'Unknown'}</td>
                    <td className="px-5 py-3 text-gray-500">{r.profiles?.user_id_number || '-'}</td>
                    <td className="px-5 py-3 text-gray-500">{r.courses?.course_name || '-'}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{r.date}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        r.status === 'present' ? 'bg-green-100 text-green-700' :
                        r.status === 'absent' ? 'bg-red-100 text-red-700' :
                        r.status === 'late' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>{r.status}</span>
                    </td>
                    <td className="px-5 py-3">
                      {r.is_flagged ? (
                        <span className="text-xs text-red-600 font-medium" title={r.flag_reason || ''}>Yes</span>
                      ) : <span className="text-xs text-gray-400">No</span>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <AdminActionButton icon="edit" label={`Edit attendance for ${r.profiles?.full_name || 'student'}`} onClick={() => openEdit(r)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={editModal} onClose={() => setEditModal(false)} title="Edit Attendance Record">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select value={editForm.status || ''} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }}>
              {ATTENDANCE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={editForm.is_flagged || false}
              onChange={(e) => setEditForm({ ...editForm, is_flagged: e.target.checked })} />
            <span className="text-gray-700">Flag this record</span>
          </label>
          {editForm.is_flagged && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Flag Reason</label>
              <textarea value={editForm.flag_reason || ''} onChange={(e) => setEditForm({ ...editForm, flag_reason: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm border" rows={2} style={{ borderColor: '#D2D4D9' }} />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleUpdate} loading={saving}>Update</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
