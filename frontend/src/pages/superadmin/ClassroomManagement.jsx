import { useState, useEffect, useCallback } from 'react'
import { adminService } from '../../services/adminService'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'

export default function ClassroomManagement() {
  const [classrooms, setClassrooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [createModal, setCreateModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [selected, setSelected] = useState(null)
  const [formData, setFormData] = useState({})
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const fetch = useCallback(() => {
    setLoading(true)
    adminService.getClassrooms()
      .then((r) => setClassrooms(r.data))
      .catch(() => toast.error('Failed to load classrooms'))
      .finally(() => setLoading(false))
  }, [toast])

  useEffect(() => { fetch() }, [fetch])

  const openCreate = () => {
    setFormData({ name: '', code: '', capacity: '', building: '' })
    setCreateModal(true)
  }

  const openEdit = (c) => {
    setSelected(c)
    setFormData({
      name: c.name || '',
      code: c.code || '',
      capacity: c.capacity || '',
      building: c.building || '',
    })
    setEditModal(true)
  }

  const handleCreate = async () => {
    if (!formData.name || !formData.code) { toast.warning('Name and code are required'); return }
    setSaving(true)
    try {
      await adminService.createClassroom(formData)
      toast.success('Classroom created')
      setCreateModal(false)
      fetch()
    } catch { toast.error('Failed to create classroom') }
    finally { setSaving(false) }
  }

  const handleUpdate = async () => {
    setSaving(true)
    try {
      await adminService.updateClassroom(selected.id, formData)
      toast.success('Classroom updated')
      setEditModal(false)
      fetch()
    } catch { toast.error('Failed to update classroom') }
    finally { setSaving(false) }
  }

  const handleDelete = async (c) => {
    if (!window.confirm(`Delete classroom "${c.name}"?`)) return
    try {
      await adminService.deleteClassroom(c.id)
      toast.success('Classroom deleted')
      fetch()
    } catch { toast.error('Failed to delete classroom') }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Classroom Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage classrooms, sections, and capacity</p>
        </div>
        <Button variant="primary" onClick={openCreate}>+ Classroom</Button>
      </div>

      {loading ? <Spinner /> : (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff', border: '1px solid #D2D4D9' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase" style={{ borderBottom: '1px solid #F0F0F2' }}>
                  <th className="text-left px-5 py-3 font-semibold">Name</th>
                  <th className="text-left px-5 py-3 font-semibold">Code</th>
                  <th className="text-left px-5 py-3 font-semibold">Building</th>
                  <th className="text-left px-5 py-3 font-semibold">Capacity</th>
                  <th className="text-left px-5 py-3 font-semibold">Students</th>
                  <th className="text-right px-5 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {classrooms.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">No classrooms found</td></tr>
                ) : classrooms.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors" style={{ borderBottom: '1px solid #F0F0F2' }}>
                    <td className="px-5 py-3 font-medium text-gray-800">{c.name}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{c.code}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{c.building || '-'}</td>
                    <td className="px-5 py-3 text-gray-500">{c.capacity || '-'}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{c.student_count || 0}</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(c)} className="text-xs text-gray-500 hover:text-gray-800">Edit</button>
                        <button onClick={() => handleDelete(c)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={createModal} onClose={() => setCreateModal(false)} title="Create Classroom">
        <div className="space-y-4">
          {[
            { key: 'name', label: 'Name', type: 'text' },
            { key: 'code', label: 'Code', type: 'text' },
            { key: 'capacity', label: 'Capacity', type: 'number' },
            { key: 'building', label: 'Building', type: 'text' },
          ].map(({ key, label, type }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <input type={type} value={formData[key] || ''} onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }} />
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCreateModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} loading={saving}>Create</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={editModal} onClose={() => setEditModal(false)} title="Edit Classroom">
        <div className="space-y-4">
          {[
            { key: 'name', label: 'Name', type: 'text' },
            { key: 'code', label: 'Code', type: 'text' },
            { key: 'capacity', label: 'Capacity', type: 'number' },
            { key: 'building', label: 'Building', type: 'text' },
          ].map(({ key, label, type }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <input type={type} value={formData[key] || ''} onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }} />
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleUpdate} loading={saving}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
