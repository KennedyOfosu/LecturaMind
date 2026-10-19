import { useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { adminService } from '../../services/adminService'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { DAYS_OF_WEEK, LEVELS } from '../../utils/constants'
import { ClassroomMultiSelect } from '../../components/ui/ClassroomMultiSelect'
import { AdminActionButton } from '../../components/ui/AdminActionButton'
import { classroomLabel } from '../../utils/classroomDisplay'
import './UserManagement.css'

const ROLE_COLORS = {
  superadmin: 'bg-purple-100 text-purple-700',
  lecturer: 'bg-blue-100 text-blue-700',
  student: 'bg-green-100 text-green-700',
}

const formatAssignedCourseCount = (user) => {
  const count = user.assigned_course_count ?? new Set(
    (user.assigned_courses || []).map((course) => course.course_id || course.id).filter(Boolean),
  ).size
  return `${count} ${count === 1 ? 'Course' : 'Courses'}`
}

export default function UserManagement() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [users, setUsers] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState(searchParams.get('role') || '')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '')
  const [unassignedFilter, setUnassignedFilter] = useState(searchParams.get('unassigned') === 'true')
  const [classroomFilter, setClassroomFilter] = useState(searchParams.get('classroom_id') || '')
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [editModal, setEditModal] = useState(false)
  const [createModal, setCreateModal] = useState(false)
  const [createRole, setCreateRole] = useState('student')
  const [formData, setFormData] = useState({})
  const [createData, setCreateData] = useState({})
  const [saving, setSaving] = useState(false)
  const [idGenerating, setIdGenerating] = useState(false)
  const [classrooms, setClassrooms] = useState([])
  const [classroomsLoading, setClassroomsLoading] = useState(true)
  const [classroomsError, setClassroomsError] = useState('')
  const [activationLinksEnabled, setActivationLinksEnabled] = useState(false)
  const [activationLink, setActivationLink] = useState(null)
  const [activationModal, setActivationModal] = useState(false)
  const [detailsModal, setDetailsModal] = useState(false)
  const [linkLoading, setLinkLoading] = useState(false)
  const toast = useToast()

  const fetchClassrooms = useCallback((silent = false) => {
    if (!silent) setClassroomsLoading(true)
    setClassroomsError('')
    adminService.getClassrooms()
      .then((response) => setClassrooms(response.data || []))
      .catch((error) => {
        const status = error.response?.status
        const apiMessage = error.response?.data?.error
        setClassroomsError(status
          ? `Could not load classes (HTTP ${status}): ${apiMessage || 'The API could not complete the request.'}`
          : 'Could not reach the classrooms API. Check your connection and try again.')
      })
      .finally(() => { if (!silent) setClassroomsLoading(false) })
  }, [])

  useEffect(() => {
    adminService.getActivationMode()
      .then((response) => setActivationLinksEnabled(Boolean(response.data?.development_links_enabled)))
      .catch(() => setActivationLinksEnabled(false))
    fetchClassrooms()
  }, [fetchClassrooms])

  const fetchUsers = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    const params = {}
    if (roleFilter) params.role = roleFilter
    if (statusFilter) params.status = statusFilter
    if (unassignedFilter) params.unassigned = 'true'
    if (classroomFilter) params.classroom_id = classroomFilter
    if (search.trim()) params.search = search.trim()
    adminService.getUsers(params)
      .then((r) => setUsers(r.data))
      .catch(() => { if (!silent) toast.error('Failed to load users') })
      .finally(() => { if (!silent) setLoading(false) })
  }, [roleFilter, statusFilter, unassignedFilter, classroomFilter, search, toast])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  useEffect(() => { setCurrentPage(1) }, [roleFilter, statusFilter, unassignedFilter, classroomFilter, search])

  const pageCount = Math.max(1, Math.ceil(users.length / pageSize))
  const pageStart = (currentPage - 1) * pageSize
  const paginatedUsers = users.slice(pageStart, pageStart + pageSize)
  const firstVisibleUser = users.length ? pageStart + 1 : 0
  const lastVisibleUser = Math.min(pageStart + pageSize, users.length)

  useEffect(() => {
    if (currentPage > pageCount) setCurrentPage(pageCount)
  }, [currentPage, pageCount])

  // Activation may finish in another tab or device. Refresh when this page
  // becomes visible and periodically while it remains open.
  useEffect(() => {
    const refreshVisibleData = () => {
      if (document.visibilityState === 'hidden') return
      fetchUsers(true)
      fetchClassrooms(true)
    }
    window.addEventListener('focus', refreshVisibleData)
    document.addEventListener('visibilitychange', refreshVisibleData)
    const interval = window.setInterval(refreshVisibleData, 30000)
    return () => {
      window.removeEventListener('focus', refreshVisibleData)
      document.removeEventListener('visibilitychange', refreshVisibleData)
      window.clearInterval(interval)
    }
  }, [fetchUsers, fetchClassrooms])

  useEffect(() => {
    const role = location.state?.openCreateRole
    if (!['lecturer', 'student'].includes(role)) return
    setCreateData({})
    setCreateRole(role)
    setCreateModal(true)
    if (role === 'lecturer') fetchClassrooms()
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null })
  }, [location.state, location.pathname, location.search, navigate, fetchClassrooms])

  useEffect(() => {
    const next = {}
    if (roleFilter) next.role = roleFilter
    if (statusFilter) next.status = statusFilter
    if (unassignedFilter) next.unassigned = 'true'
    if (classroomFilter) next.classroom_id = classroomFilter
    setSearchParams(next, { replace: true })
  }, [roleFilter, statusFilter, unassignedFilter, classroomFilter, setSearchParams])

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
      classroom_ids: (user.assigned_classrooms || []).map((classroom) => classroom.id),
      classroom_id: user.classroom_id || '',
    })
    setEditModal(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {}
      for (const key of Object.keys(formData)) {
        if (key === 'classroom_ids' || (key === 'classroom_id' && selectedUser.role === 'student')) continue
        if (String(formData[key] ?? '') !== String(selectedUser[key] ?? '')) {
          if (key === 'level' && !formData[key]) continue
          payload[key] = formData[key]
        }
      }
      const nextClassroomIds = formData.classroom_ids || []
      const previousClassroomIds = (selectedUser.assigned_classrooms || []).map((classroom) => classroom.id)
      const classesChanged = selectedUser.role === 'lecturer'
        && JSON.stringify([...nextClassroomIds].sort()) !== JSON.stringify([...previousClassroomIds].sort())
      const studentClassChanged = selectedUser.role === 'student'
        && String(formData.classroom_id || '') !== String(selectedUser.classroom_id || '')
      if (Object.keys(payload).length === 0 && !classesChanged && !studentClassChanged) {
        toast.info('No changes made')
        setEditModal(false)
        return
      }
      if (Object.keys(payload).length) await adminService.updateUser(selectedUser.id, payload)
      if (classesChanged) {
        if (!nextClassroomIds.length) throw new Error('Assign at least one class to the lecturer.')
        await adminService.updateLecturerClassrooms(selectedUser.id, nextClassroomIds)
      }
      if (studentClassChanged) {
        await adminService.updateUser(selectedUser.id, { classroom_id: formData.classroom_id || null })
      }
      toast.success('User updated successfully')
      setEditModal(false)
      fetchUsers()
    } catch (error) {
      toast.error(error.response?.data?.error || error.message || 'Failed to update user')
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

  const generateAccountId = async () => {
    setIdGenerating(true)
    try {
      const response = await adminService.generateAccountId(createRole)
      const reservation = response.data
      setCreateData((current) => ({
        ...current,
        id_number: reservation.user_id_number,
        id_reservation_token: reservation.reservation_token,
        id_expires_at: reservation.expires_at,
      }))
      toast.success(`${reservation.user_id_number} generated. It is valid for 30 minutes.`)
    } catch (error) {
      toast.error(error.response?.data?.error || `Could not generate a ${createRole} ID. Please try again.`)
    } finally {
      setIdGenerating(false)
    }
  }

  const handleCreate = async () => {
    const requiredMissing = !createData.full_name || !createData.email || !createData.id_number || !createData.id_reservation_token
      || (createRole === 'student' && !createData.password)
      || (createRole === 'lecturer' && !(createData.classroom_ids || []).length)
    if (requiredMissing) {
      toast.warning(!createData.id_reservation_token
        ? `Generate a ${createRole === 'lecturer' ? 'Staff' : 'Student'} ID before creating the account.`
        : createRole === 'lecturer' ? 'Enter the lecturer details and assign at least one class' : 'Please fill in all required fields')
      return
    }
    setSaving(true)
    try {
      const service = createRole === 'lecturer' ? adminService.registerLecturer : adminService.registerStudent
      const payload = { ...createData }
      if (createRole === 'lecturer') delete payload.password
      const response = await service(payload)
      setCreateModal(false)
      setCreateData({})
      if (createRole === 'lecturer') {
        setLinkLoading(true)
        try {
          const linkResponse = await adminService.generateLecturerActivationLink(response.data.user.id)
          setActivationLink(linkResponse.data)
          setActivationModal(true)
          toast.success('Lecturer account created and is pending activation')
        } catch (error) {
          toast.error(error.response?.data?.error || 'Lecturer created, but the activation link could not be generated')
        } finally {
          setLinkLoading(false)
        }
      } else {
        toast.success(`${createRole} created successfully`)
      }
      fetchUsers()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create user')
    } finally {
      setSaving(false)
    }
  }

  const generateActivationLink = async (user) => {
    setLinkLoading(true)
    try {
      const response = await adminService.generateLecturerActivationLink(user.id)
      setActivationLink(response.data)
      setActivationModal(true)
      toast.success('Development activation link generated')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not generate activation link')
    } finally {
      setLinkLoading(false)
    }
  }

  const copyActivationLink = async () => {
    try {
      await navigator.clipboard.writeText(activationLink.activation_url)
      toast.success('Activation link copied')
    } catch {
      toast.error('Could not copy the link. Select and copy it manually.')
    }
  }

  const toggleLecturerStatus = async (user) => {
    const nextStatus = user.account_status === 'deactivated' ? 'active' : 'deactivated'
    if (nextStatus === 'deactivated' && !window.confirm(`Deactivate ${user.full_name}? They will lose access immediately.`)) return
    try {
      await adminService.updateLecturerStatus(user.id, nextStatus)
      toast.success(nextStatus === 'active' ? 'Lecturer account reactivated' : 'Lecturer account deactivated')
      fetchUsers()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not update lecturer status')
    }
  }

  return (
    <div className="user-management-page w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage all lecturers and students</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setCreateData({}); setCreateRole('lecturer'); setCreateModal(true); fetchClassrooms() }}>
            + Lecturer
          </Button>
          <Button variant="primary" onClick={() => { setCreateData({}); setCreateRole('student'); setCreateModal(true) }}>
            + Student
          </Button>
        </div>
      </div>
      {!activationLinksEnabled && <p className="text-xs text-amber-700" role="status">Lecturer setup needs local activation links enabled. If creation is rejected, set DEV_ACTIVATION_LINKS_ENABLED=true in backend/.env and restart the backend.</p>}

      <div className="flex items-center gap-3 flex-wrap">
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
        <select aria-label="Filter by class" value={classroomFilter} onChange={(e) => setClassroomFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm border bg-white" style={{ borderColor: '#D2D4D9' }}>
          <option value="">All classes</option>
          {classrooms.map((classroom) => <option key={classroom.id} value={classroom.id}>{classroomLabel(classroom)}</option>)}
        </select>
        <select aria-label="Filter by account status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm border bg-white" style={{ borderColor: '#D2D4D9' }}>
          <option value="">All account statuses</option>
          <option value="active">Active</option>
          <option value="pending_activation">Pending activation</option>
          <option value="deactivated">Deactivated</option>
        </select>
        <select aria-label="Filter by class assignment" value={unassignedFilter ? 'unassigned' : ''}
          onChange={(e) => setUnassignedFilter(e.target.value === 'unassigned')}
          className="px-3 py-2 rounded-lg text-sm border bg-white" style={{ borderColor: '#D2D4D9' }}>
          <option value="">All class assignments</option>
          <option value="unassigned">Needs class assignment</option>
        </select>
      </div>

      {loading ? <Spinner /> : (
        <div className="user-management-table-card rounded-2xl" style={{ backgroundColor: '#fff', border: '1px solid #D2D4D9' }}>
            <table className="superadmin-admin-table user-management-table w-full text-sm">
              <colgroup>
                <col style={{ width: '8%' }} /><col style={{ width: '7%' }} />
                <col style={{ width: '9%' }} /><col style={{ width: '7%' }} />
                <col style={{ width: '11%' }} /><col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} /><col style={{ width: '11%' }} />
                <col style={{ width: '9%' }} /><col style={{ width: '5%' }} />
                <col style={{ width: '13%' }} />
              </colgroup>
              <thead>
                <tr className="text-xs text-gray-500 uppercase" style={{ borderBottom: '1px solid #F0F0F2' }}>
                  <th className="text-left font-semibold">Name</th>
                  <th className="text-left font-semibold">ID</th>
                  <th className="text-left font-semibold">Email</th>
                  <th className="text-left font-semibold">Role</th>
                  <th className="text-left font-semibold">Account Status</th>
                  <th className="text-left font-semibold">Assigned Classes</th>
                  <th className="text-left font-semibold">Assigned Courses</th>
                  <th className="text-left font-semibold">Teaching Schedule</th>
                  <th className="text-left font-semibold">Programme</th>
                  <th className="text-left font-semibold">Level</th>
                  <th className="text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={11} className="text-center py-8 text-gray-400">No users found</td></tr>
                ) : paginatedUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors" style={{ borderBottom: '1px solid #F0F0F2' }}>
                    <td data-label="Name" className="px-2 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                          {u.full_name?.[0] || '?'}
                        </div>
                        <span className="user-management-truncate font-medium text-gray-800" tabIndex={0} title={u.full_name} aria-label={`Full name: ${u.full_name}`}>
                          {u.full_name}
                        </span>
                      </div>
                    </td>
                    <td data-label="ID" className="px-2 py-3 text-gray-600">{u.user_id_number}</td>
                    <td data-label="Email" className="px-2 py-3 text-gray-500">
                      <span className="user-management-truncate" tabIndex={0} title={u.email} aria-label={`Email: ${u.email}`}>{u.email}</span>
                    </td>
                    <td data-label="Role" className="px-2 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] || ''}`}>
                        {u.role}
                      </span>
                    </td>
                    <td data-label="Account Status" className="px-2 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        (u.account_status || 'active') === 'pending_activation' ? 'bg-amber-100 text-amber-800'
                          : (u.account_status || 'active') === 'deactivated' ? 'bg-red-100 text-red-700'
                            : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {(u.account_status || 'active') === 'pending_activation' ? 'Pending Activation'
                          : (u.account_status || 'active') === 'deactivated' ? 'Deactivated' : 'Active'}
                      </span>
                    </td>
                    <td data-label="Assigned Classes" className="px-2 py-3 text-gray-500">
                      <span className="user-management-truncate" tabIndex={0}
                        title={u.role === 'lecturer' ? (u.assigned_classrooms || []).map((classroom) => classroomLabel(classroom)).join(', ') : u.classroom ? classroomLabel(u.classroom) : '—'}
                        aria-label={`Assigned classes: ${u.role === 'lecturer' ? (u.assigned_classrooms || []).map((classroom) => classroomLabel(classroom)).join(', ') || 'None' : u.classroom ? classroomLabel(u.classroom) : 'None'}`}>
                        {u.role === 'lecturer' ? (u.assigned_classrooms || []).map((classroom) => classroomLabel(classroom)).join(', ') || '—' : (u.classroom ? classroomLabel(u.classroom) : '—')}
                      </span>
                    </td>
                    <td data-label="Assigned Courses" className="px-2 py-3 text-gray-500">
                      <span className="font-medium text-gray-700">{formatAssignedCourseCount(u)}</span>
                    </td>
                    <td data-label="Teaching Schedule" className="px-2 py-3 text-gray-500">
                      {u.role === 'lecturer'
                        ? <div>
                            {(u.teaching_schedules || []).length
                              ? <span className="user-management-truncate block text-[11px] text-gray-500" tabIndex={0} title={u.teaching_schedules.map((schedule) => `${schedule.session_type === 'weekend' ? 'Weekend' : 'Weekday'} · ${DAYS_OF_WEEK.find((day) => day.value === schedule.day_of_week)?.label || ''} ${String(schedule.start_time || '').slice(0, 5)}–${String(schedule.end_time || '').slice(0, 5)}`).join('; ')} aria-label={`Teaching schedule: ${u.teaching_schedules.map((schedule) => `${schedule.session_type === 'weekend' ? 'Weekend' : 'Weekday'} · ${DAYS_OF_WEEK.find((day) => day.value === schedule.day_of_week)?.label || ''} ${String(schedule.start_time || '').slice(0, 5)}–${String(schedule.end_time || '').slice(0, 5)}`).join('; ')}`}>{u.teaching_schedules.map((schedule) => `${schedule.session_type === 'weekend' ? 'Weekend' : 'Weekday'} · ${DAYS_OF_WEEK.find((day) => day.value === schedule.day_of_week)?.label || ''} ${String(schedule.start_time || '').slice(0, 5)}–${String(schedule.end_time || '').slice(0, 5)}`).join('; ')}</span>
                              : 'Schedule pending'}
                          </div>
                        : '—'}
                    </td>
                    <td data-label="Programme" className="px-2 py-3 text-gray-500">
                      <span className="user-management-truncate user-management-level-truncate" tabIndex={0}
                        title={u.role === 'lecturer' ? (u.assigned_programmes || []).join(', ') : u.programme || '-'}
                        aria-label={`Programme: ${u.role === 'lecturer' ? (u.assigned_programmes || []).join(', ') || 'None' : u.programme || 'None'}`}>
                        {u.role === 'lecturer' ? (u.assigned_programmes || []).join(', ') || '-' : u.programme || '-'}
                      </span>
                    </td>
                    <td data-label="Level" className="px-3 py-4 text-gray-500">
                      <span className="user-management-truncate" tabIndex={0}
                        title={u.role === 'lecturer' ? (u.teaching_levels || []).map((level) => `Level ${level}`).join(', ') : u.level || '-'}
                        aria-label={`Level: ${u.role === 'lecturer' ? (u.teaching_levels || []).map((level) => `Level ${level}`).join(', ') || 'None' : u.level || 'None'}`}>
                        {u.role === 'lecturer' ? (u.teaching_levels || []).map((level) => `L${level}`).join(', ') || '-' : u.level || '-'}
                      </span>
                    </td>
                    <td data-label="Actions" className="user-management-actions-cell">
                      <div className="admin-action-group">
                        <AdminActionButton icon="view" label={`View ${u.full_name}`} onClick={() => { setSelectedUser(u); setDetailsModal(true) }} />
                        <AdminActionButton icon="edit" label={`Edit ${u.full_name}`} onClick={() => handleEdit(u)} />
                        {u.role !== 'superadmin' && (
                          <AdminActionButton icon="delete" tone="danger" label={`Delete ${u.full_name}`} onClick={() => handleDelete(u)} />
                        )}
                        {u.role === 'lecturer' && u.account_status !== 'pending_activation' && (
                          <AdminActionButton icon={u.account_status === 'deactivated' ? 'activate' : 'deactivate'} tone={u.account_status === 'deactivated' ? 'success' : 'warning'} label={`${u.account_status === 'deactivated' ? 'Reactivate' : 'Deactivate'} ${u.full_name}`} onClick={() => toggleLecturerStatus(u)} />
                        )}
                        {u.role === 'lecturer' && u.account_status === 'pending_activation' && (
                          <AdminActionButton icon="setup" tone="info" disabled={linkLoading} label={`Generate setup link for ${u.full_name}`} onClick={() => generateActivationLink(u)} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="user-management-pagination">
              <div className="user-management-pagination-summary" aria-live="polite">
                Showing <strong>{firstVisibleUser}–{lastVisibleUser}</strong> of <strong>{users.length}</strong> users
              </div>
              <div className="user-management-pagination-controls">
                <label className="user-management-page-size">
                  <span>Rows</span>
                  <select aria-label="Users per page" value={pageSize} onChange={(event) => {
                    setPageSize(Number(event.target.value))
                    setCurrentPage(1)
                  }}>
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                  </select>
                  <span>per page</span>
                </label>
                <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage <= 1} aria-label="Previous page" className="user-management-page-button">
                  Previous
                </button>
                <span className="user-management-page-indicator">Page {Math.min(currentPage, pageCount)} of {pageCount}</span>
                <button type="button" onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
                  disabled={currentPage >= pageCount} aria-label="Next page" className="user-management-page-button">
                  Next
                </button>
              </div>
            </div>
        </div>
      )}

      {selectedUser && (
        <Modal isOpen={editModal} onClose={() => setEditModal(false)} title="Edit User">
          <div className="space-y-4">
            {(selectedUser.role === 'lecturer'
              ? ['full_name', 'email', 'user_id_number']
              : ['full_name', 'email', 'user_id_number', 'programme', 'academic_year']).map((field) => (
              <div key={field}>
                <label className="block text-xs font-medium text-gray-600 mb-1 capitalize">{field.replace(/_/g, ' ')}</label>
                <input type="text" value={formData[field] || ''} readOnly={field === 'user_id_number'} onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                  className={`w-full px-3 py-2 rounded-lg text-sm border ${field === 'user_id_number' ? 'bg-gray-50 text-gray-500' : ''}`} style={{ borderColor: '#D2D4D9' }} />
              </div>
            ))}
            {selectedUser.role !== 'lecturer' && <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Level</label>
              <select value={formData.level || ''} onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }}>
                <option value="">-</option>
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>}
            {selectedUser.role === 'student' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Assigned Class</label>
                <select value={formData.classroom_id || ''} onChange={(e) => setFormData({ ...formData, classroom_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }}>
                  <option value="">No class assigned</option>
                  {classrooms.map((classroom) => <option key={classroom.id} value={classroom.id}>{classroomLabel(classroom)}</option>)}
                </select>
                {classroomsLoading && <p className="mt-1 text-xs text-gray-500">Loading classes…</p>}
                {classroomsError && <p className="mt-1 text-xs text-red-600">{classroomsError} <button type="button" className="underline" onClick={() => fetchClassrooms()}>Retry</button></p>}
                {!classroomsLoading && !classroomsError && classrooms.length === 0 && <button type="button" className="mt-1 text-xs text-blue-700 underline" onClick={() => navigate('/superadmin/classrooms')}>Create a class first</button>}
              </div>
            )}
            {selectedUser.role === 'lecturer' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Assigned Classes *</label>
                <ClassroomMultiSelect classrooms={classrooms} value={formData.classroom_ids || []} onChange={(value) => setFormData({ ...formData, classroom_ids: value })} loading={classroomsLoading} error={classroomsError} onRetry={() => fetchClassrooms()} onCreateClass={() => navigate('/superadmin/classrooms')} />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleSave} loading={saving}>Save</Button>
            </div>
          </div>
        </Modal>
      )}

      <Modal isOpen={createModal} onClose={() => { if (!saving) setCreateModal(false) }} closeOnBackdrop={!saving} title={`Create ${createRole}`}>
        <div className="space-y-4">
          {(createRole === 'lecturer' ? ['full_name', 'email', 'id_number'] : ['full_name', 'email', 'password', 'id_number']).map((field) => (
            <div key={field}>
              <label className="block text-xs font-medium text-gray-600 mb-1 capitalize">
                {field === 'id_number' ? (createRole === 'lecturer' ? 'Staff ID' : 'Student ID') : field.replace(/_/g, ' ')}
              </label>
              {field === 'id_number' ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input type="text" value={createData.id_number || ''} readOnly aria-describedby="generated-id-help"
                    placeholder={`Click Generate ${createRole === 'lecturer' ? 'Staff' : 'Student'} ID`}
                    className="w-full min-w-0 flex-1 px-3 py-2 rounded-lg text-sm border bg-gray-50 text-gray-700 font-mono"
                    style={{ borderColor: '#D2D4D9' }} />
                  <Button variant="outline" size="sm" onClick={generateAccountId} loading={idGenerating} disabled={saving}>
                    Generate {createRole === 'lecturer' ? 'Staff' : 'Student'} ID
                  </Button>
                </div>
              ) : (
                <input type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'} value={createData[field] || ''} onChange={(e) => setCreateData({ ...createData, [field]: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }} />
              )}
              {field === 'id_number' && (
                <p id="generated-id-help" className="mt-1 text-[11px] text-gray-500">
                  Generated by the system. You can generate another ID before creating this account.
                </p>
              )}
            </div>
          ))}
          {createRole === 'lecturer' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Assigned Classes *</label>
                <ClassroomMultiSelect classrooms={classrooms} value={createData.classroom_ids || []} onChange={(value) => setCreateData({ ...createData, classroom_ids: value })} loading={classroomsLoading} error={classroomsError} onRetry={() => fetchClassrooms()} onCreateClass={() => navigate('/superadmin/classrooms')} />
                <p className="mt-1 text-[11px] text-gray-500">Select one or more classes. The lecturer will set their own password from a secure setup link.</p>
              </div>
              <p className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">Development activation mode is enabled. No email will be sent; a setup link will be shown after account creation.</p>
            </>
          )}
          {createRole === 'student' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Assigned Class</label>
                <select value={createData.classroom_id || ''} onChange={(e) => setCreateData({ ...createData, classroom_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }}>
                  <option value="">No class assigned</option>
                  {classrooms.map((classroom) => <option key={classroom.id} value={classroom.id}>{classroomLabel(classroom)}</option>)}
                </select>
                {classroomsLoading && <p className="mt-1 text-xs text-gray-500">Loading classes…</p>}
                {classroomsError && <p className="mt-1 text-xs text-red-600">{classroomsError} <button type="button" className="underline" onClick={() => fetchClassrooms()}>Retry</button></p>}
                {!classroomsLoading && !classroomsError && classrooms.length === 0 && <button type="button" className="mt-1 text-xs text-blue-700 underline" onClick={() => navigate('/superadmin/classrooms')}>Create a class first</button>}
              </div>
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
            <Button variant="primary" onClick={handleCreate} loading={saving || idGenerating}>{createRole === 'lecturer' ? 'Create Lecturer' : 'Create'}</Button>
          </div>
        </div>
      </Modal>

      {selectedUser && (
        <Modal isOpen={detailsModal} onClose={() => setDetailsModal(false)} title="User Details">
          <div className="space-y-3 text-sm">
            <div><span className="text-gray-500">Name</span><p className="font-medium text-gray-900">{selectedUser.full_name}</p></div>
            <div><span className="text-gray-500">Email</span><p className="font-medium text-gray-900">{selectedUser.email}</p></div>
            <div><span className="text-gray-500">Staff ID</span><p className="font-medium text-gray-900">{selectedUser.user_id_number || '—'}</p></div>
            <div><span className="text-gray-500">Account status</span><p className="font-medium text-gray-900">{selectedUser.account_status === 'pending_activation' ? 'Pending Activation' : selectedUser.account_status === 'deactivated' ? 'Deactivated' : 'Active'}</p></div>
            <div><span className="text-gray-500">Assigned classes</span><p className="font-medium text-gray-900">{(selectedUser.assigned_classrooms || []).map((classroom) => classroomLabel(classroom)).join(', ') || 'None'}</p></div>
            {selectedUser.role === 'lecturer' && (
              <>
                <div>
                  <span className="text-gray-500">Teaching assignments</span>
                  {(selectedUser.assigned_courses || []).length ? (
                    <ul className="mt-1 space-y-2">
                      {selectedUser.assigned_courses.map((course) => (
                        <li key={course.assignment_id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                          <p className="font-medium text-gray-900">{course.course_code} · {course.course_name}</p>
                          <p className="text-xs text-gray-500">{course.programme} · Level {course.level} · {course.semester || 'Semester not set'}</p>
                          {course.schedule && <p className="mt-1 text-xs text-blue-700">{course.schedule.session_type === 'weekend' ? 'Weekend' : 'Weekday'} · {DAYS_OF_WEEK.find((day) => day.value === course.schedule.day_of_week)?.label} · {String(course.schedule.start_time || '').slice(0, 5)}–{String(course.schedule.end_time || '').slice(0, 5)} · {classroomLabel({ ...course.schedule.classroom, physical_room: course.schedule.physical_room || course.schedule.classroom?.physical_room })}</p>}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="font-medium text-gray-900">No courses assigned</p>}
                </div>
                <div><span className="text-gray-500">Programmes</span><p className="font-medium text-gray-900">{(selectedUser.assigned_programmes || []).join(', ') || 'None'}</p></div>
                <div><span className="text-gray-500">Teaching levels</span><p className="font-medium text-gray-900">{(selectedUser.teaching_levels || []).map((level) => `Level ${level}`).join(', ') || 'None'}</p></div>
              </>
            )}
            {selectedUser.activated_at && <div><span className="text-gray-500">Activated</span><p className="font-medium text-gray-900">{new Date(selectedUser.activated_at).toLocaleString()}</p></div>}
            <div className="flex justify-end pt-2"><Button variant="outline" onClick={() => setDetailsModal(false)}>Close</Button></div>
          </div>
        </Modal>
      )}

      <Modal isOpen={activationModal} onClose={() => setActivationModal(false)} title="Development Activation Link">
        {activationLink && (
          <div className="space-y-4">
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              Development feature only. This link is shown to an authorized Super-Admin and has not been emailed. Anyone with the link can set this lecturer’s password.
            </p>
            <div className="text-sm">
              <p className="font-semibold text-gray-900">{activationLink.lecturer.full_name}</p>
              <p className="text-gray-600">{activationLink.lecturer.email}</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Setup link</label>
              <textarea readOnly rows={3} value={activationLink.activation_url} className="w-full rounded-lg border px-3 py-2 text-xs text-gray-700" style={{ borderColor: '#D2D4D9' }} />
            </div>
            <p className="text-xs text-gray-500">Expires {new Date(activationLink.expires_at).toLocaleString()}</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" loading={linkLoading} onClick={() => generateActivationLink({ id: activationLink.lecturer.id })}>Generate new link</Button>
              <Button variant="primary" onClick={copyActivationLink}>Copy link</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
