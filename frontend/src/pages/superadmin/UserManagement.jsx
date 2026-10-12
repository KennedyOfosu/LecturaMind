import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { adminService } from '../../services/adminService'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { LEVELS } from '../../utils/constants'

const ROLE_COLORS = {
  superadmin: 'bg-purple-100 text-purple-700',
  lecturer: 'bg-blue-100 text-blue-700',
  student: 'bg-green-100 text-green-700',
}

export default function UserManagement() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState(searchParams.get('role') || '')
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [editModal, setEditModal] = useState(false)
  const [createModal, setCreateModal] = useState(false)
  const [createRole, setCreateRole] = useState('student')
  const [formData, setFormData] = useState({})
  const [createData, setCreateData] = useState({})
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const fetchUsers = useCallback(() => {
    setLoading(true)
    const params = {}
    if (roleFilter) params.role = roleFilter
    if (search.trim()) params.search = search.trim()
    adminService.getUsers(params)
      .then((r) => setUsers(r.data))
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false))
  }, [roleFilter, search, toast])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  useEffect(() => {
    if (roleFilter) setSearchParams({ role: roleFilter })
    else setSearchParams({})
  }, [roleFilter, setSearchParams])

  const handleEdit = (user) => {
    setSelectedUser(user)
    setFormData({
      full_name: user.full_name || '',
      email: user.email || '',
      user_id_number: user.user_id_number || '',
      role: user.role || '',
      programme: user.programme || '',
      level: user.level || '',
      academic_year: user.academic_year || '',
    })
    setEditModal(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {}
      for (const key of Object.keys(formData)) {
        if (formData[key] !== selectedUser[key]) {
          payload[key] = formData[key]
        }
      }
      if (Object.keys(payload).length === 0) {
        toast.info('No changes made')
        setEditModal(false)
        return
      }
      await adminService.updateUser(selectedUser.id, payload)
      toast.success('User updated successfully')
      setEditModal(false)
      fetchUsers()
    } catch {
      toast.error('Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (user) => {
    if (!window.confirm(`Are you sure you want to delete ${user.full_name}? This cannot be undone.`)) return
    try {
      await adminService.deleteUser(user.id)
      toast.success('User deleted')
      fetchUsers()
    } catch {
      toast.error('Failed to delete user')
    }
  }

  const handleCreate = async () => {
    if (!createData.full_name || !createData.email || !createData.password || !createData.id_number) {
      toast.warning('Please fill in all required fields')
      return
    }
    setSaving(true)
    try {
      const service = createRole === 'lecturer' ? adminService.registerLecturer : adminService.registerStudent
      await service(createData)
      toast.success(`${createRole} created successfully`)
      setCreateModal(false)
      setCreateData({})
      fetchUsers()
    } catch {
      toast.error('Failed to create user')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage all lecturers and students</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setCreateRole('lecturer'); setCreateModal(true) }}>
            + Lecturer
          </Button>
          <Button variant="primary" onClick={() => { setCreateRole('student'); setCreateModal(true) }}>
            + Student
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex gap-1 rounded-lg p-1" style={{ backgroundColor: '#E5E7EB' }}>
          {['', 'lecturer', 'student', 'superadmin'].map((r) => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                roleFilter === r ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {r || 'All'}
            </button>
          ))}
        </div>
        <input type="text" placeholder="Search by name, ID, or email..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg text-sm border"
          style={{ borderColor: '#D2D4D9' }} />
      </div>

      {loading ? <Spinner /> : (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff', border: '1px solid #D2D4D9' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase" style={{ borderBottom: '1px solid #F0F0F2' }}>
                  <th className="text-left px-5 py-3 font-semibold">Name</th>
                  <th className="text-left px-5 py-3 font-semibold">ID</th>
                  <th className="text-left px-5 py-3 font-semibold">Email</th>
                  <th className="text-left px-5 py-3 font-semibold">Role</th>
                  <th className="text-left px-5 py-3 font-semibold">Programme</th>
                  <th className="text-left px-5 py-3 font-semibold">Level</th>
                  <th className="text-right px-5 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-400">No users found</td></tr>
                ) : users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors" style={{ borderBottom: '1px solid #F0F0F2' }}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                          {u.full_name?.[0] || '?'}
                        </div>
                        <span className="font-medium text-gray-800">{u.full_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{u.user_id_number}</td>
                    <td className="px-5 py-3 text-gray-500">{u.email}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] || ''}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{u.programme || '-'}</td>
                    <td className="px-5 py-3 text-gray-500">{u.level || '-'}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEdit(u)}
                          className="text-xs text-gray-500 hover:text-gray-800 transition-colors">
                          Edit
                        </button>
                        {u.role !== 'superadmin' && (
                          <button onClick={() => handleDelete(u)}
                            className="text-xs text-red-500 hover:text-red-700 transition-colors">
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedUser && (
        <Modal isOpen={editModal} onClose={() => setEditModal(false)} title="Edit User">
          <div className="space-y-4">
            {['full_name', 'email', 'user_id_number', 'programme', 'academic_year'].map((field) => (
              <div key={field}>
                <label className="block text-xs font-medium text-gray-600 mb-1 capitalize">{field.replace(/_/g, ' ')}</label>
                <input type="text" value={formData[field] || ''} onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }} />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Level</label>
              <select value={formData.level || ''} onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }}>
                <option value="">-</option>
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleSave} loading={saving}>Save</Button>
            </div>
          </div>
        </Modal>
      )}

      <Modal isOpen={createModal} onClose={() => setCreateModal(false)} title={`Create ${createRole}`}>
        <div className="space-y-4">
          {['full_name', 'email', 'password', 'id_number'].map((field) => (
            <div key={field}>
              <label className="block text-xs font-medium text-gray-600 mb-1 capitalize">{field.replace(/_/g, ' ')}</label>
              <input type={field === 'password' ? 'password' : 'text'} value={createData[field] || ''} onChange={(e) => setCreateData({ ...createData, [field]: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }} />
            </div>
          ))}
          {createRole === 'student' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Programme</label>
                <input type="text" value={createData.programme || ''} onChange={(e) => setCreateData({ ...createData, programme: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Level</label>
                <select value={createData.level || ''} onChange={(e) => setCreateData({ ...createData, level: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }}>
                  <option value="">Select level</option>
                  {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCreateModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} loading={saving}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
