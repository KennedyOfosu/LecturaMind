import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { adminService } from '../../services/adminService'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { AdminActionButton } from '../../components/ui/AdminActionButton'
import { classroomLabel, classroomSearchText } from '../../utils/classroomDisplay'

const EMPTY_FORM = {
  programme: '', level: '', room_id: '', room_name: '', room_code: '',
  building: '', campus: '', capacity: '',
}

export default function ClassroomManagement() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const lecturerAssignmentFilter = searchParams.get('lecturer_assignment') || ''
  const [classrooms, setClassrooms] = useState([])
  const [rooms, setRooms] = useState([])
  const [courses, setCourses] = useState([])
  const [reviewRows, setReviewRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [createModal, setCreateModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [selected, setSelected] = useState(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const toast = useToast()

  const fetch = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    setLoadError('')
    Promise.all([
      adminService.getClassrooms(lecturerAssignmentFilter ? { lecturer_assignment: lecturerAssignmentFilter } : {}),
      adminService.getRooms(),
      adminService.getCourses(),
      adminService.getClassroomMigrationReview(),
    ]).then(([classroomResponse, roomResponse, courseResponse, reviewResponse]) => {
      setClassrooms(Array.isArray(classroomResponse.data) ? classroomResponse.data : [])
      setRooms(Array.isArray(roomResponse.data) ? roomResponse.data : [])
      setCourses(Array.isArray(courseResponse.data) ? courseResponse.data : [])
      setReviewRows(Array.isArray(reviewResponse.data) ? reviewResponse.data : [])
    }).catch((error) => {
      const status = error.response?.status
      const apiMessage = error.response?.data?.error
      setLoadError(status
        ? `Classroom request failed (HTTP ${status}): ${apiMessage || 'The API could not complete the request.'}`
        : 'Could not reach the classroom API. Check the backend connection and try again.')
      if (!silent) toast.error('Failed to load classroom data')
    }).finally(() => { if (!silent) setLoading(false) })
  }, [lecturerAssignmentFilter, toast])

  useEffect(() => { fetch() }, [fetch])

  useEffect(() => {
    if (!location.state?.openCreateClass) return
    setFormData(EMPTY_FORM)
    setCreateModal(true)
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null })
  }, [location.state, location.pathname, location.search, navigate])

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState !== 'hidden') fetch(true)
    }
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    const interval = window.setInterval(refreshWhenVisible, 30000)
    return () => {
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      window.clearInterval(interval)
    }
  }, [fetch])

  const programmes = useMemo(
    () => [...new Set(courses.map((course) => course.programme).filter(Boolean))].sort(),
    [courses],
  )
  const levels = useMemo(
    () => [...new Set(courses.map((course) => Number(course.level)).filter(Boolean))].sort((a, b) => a - b),
    [courses],
  )
  const buildings = useMemo(
    () => [...new Set([...rooms.map((room) => room.building), ...classrooms.map((classroom) => classroom.building).filter((value) => !/campus$/i.test(value || ''))].filter(Boolean))].sort(),
    [rooms, classrooms],
  )
  const campuses = useMemo(
    () => [...new Set([...rooms.map((room) => room.campus), ...classrooms.map((classroom) => classroom.campus), ...classrooms.map((classroom) => /campus$/i.test(classroom.building || '') ? classroom.building : null)].filter(Boolean))].sort(),
    [rooms, classrooms],
  )
  const filteredClassrooms = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    if (!query) return classrooms
    return classrooms.filter((classroom) => classroomSearchText(classroom).includes(query))
  }, [classrooms, search])
  const pageCount = Math.max(1, Math.ceil(filteredClassrooms.length / pageSize))
  const visibleClassrooms = filteredClassrooms.slice((page - 1) * pageSize, page * pageSize)
  const firstRow = filteredClassrooms.length ? (page - 1) * pageSize + 1 : 0
  const lastRow = Math.min(page * pageSize, filteredClassrooms.length)

  useEffect(() => { setPage(1) }, [search, lecturerAssignmentFilter])
  useEffect(() => { if (page > pageCount) setPage(pageCount) }, [page, pageCount])

  const openCreate = () => {
    setFormData(EMPTY_FORM)
    setCreateModal(true)
  }

  const openEdit = (classroom) => {
    setSelected(classroom)
    const room = classroom.physical_room || {}
    setFormData({
      programme: classroom.programme || '',
      level: classroom.level || '',
      room_id: room.id || '',
      room_name: room.name || '',
      room_code: room.code || '',
      building: room.building || '',
      campus: room.campus || '',
      capacity: room.capacity ?? '',
    })
    setEditModal(true)
  }

  const selectRoom = (roomId) => {
    const room = rooms.find((item) => item.id === roomId)
    setFormData((current) => ({
      ...current,
      room_id: roomId,
      room_name: room?.name || '',
      room_code: room?.code || '',
      building: room?.building || '',
      campus: room?.campus || '',
      capacity: room?.capacity ?? '',
    }))
  }

  const validate = () => {
    if (!formData.programme.trim()) return 'Select or enter a program.'
    if (!levels.map(Number).includes(Number(formData.level))) return 'Choose a level available in the course records.'
    if (!formData.room_name.trim() || !formData.room_code.trim()) return 'Room name and room code are required.'
    if (!Number.isInteger(Number(formData.capacity)) || Number(formData.capacity) < 1) return 'Room capacity must be a whole number greater than zero.'
    return ''
  }

  const save = async (isEdit) => {
    const validationError = validate()
    if (validationError) { toast.warning(validationError); return }
    setSaving(true)
    const payload = {
      programme: formData.programme.trim(), level: Number(formData.level),
      room_id: formData.room_id || null, room_name: formData.room_name.trim(),
      room_code: formData.room_code.trim(), building: formData.building.trim(),
      campus: formData.campus.trim(), capacity: Number(formData.capacity),
    }
    try {
      if (isEdit) await adminService.updateClassroom(selected.id, payload)
      else await adminService.createClassroom(payload)
      toast.success(isEdit ? 'Classroom updated' : 'Classroom created')
      setCreateModal(false)
      setEditModal(false)
      fetch()
    } catch (error) {
      toast.error(error.response?.data?.error || (isEdit ? 'Could not update classroom' : 'Could not create classroom'))
    } finally { setSaving(false) }
  }

  const handleDelete = async (classroom) => {
    if (!window.confirm(`Delete the ${classroomLabel(classroom, { includeLocation: false })} class group?`)) return
    try {
      await adminService.deleteClassroom(classroom.id)
      toast.success('Class group deleted')
      fetch()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not delete class group')
    }
  }

  const form = (isEdit) => (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Room</label>
        <select value={formData.room_id} onChange={(event) => selectRoom(event.target.value)} className="w-full rounded-lg border bg-white px-3 py-2 text-sm" style={{ borderColor: '#D2D4D9' }}>
          <option value="">Create a physical room</option>
          {rooms.map((room) => <option key={room.id} value={room.id}>{room.name} · {room.code}{room.building ? ` · ${room.building}` : ''}{room.campus ? ` · ${room.campus}` : ''}</option>)}
        </select>
        {formData.room_id && <p className="mt-1 text-[11px] text-gray-500">Room details are shared. Updating them changes the physical room everywhere it is used.</p>}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Room name or number *</label>
          <input value={formData.room_name} onChange={(event) => setFormData({ ...formData, room_name: event.target.value })} placeholder="Enter the verified room name" className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#D2D4D9' }} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Room code *</label>
          <input value={formData.room_code} onChange={(event) => setFormData({ ...formData, room_code: event.target.value })} placeholder="Enter a unique room code" className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#D2D4D9' }} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Program *</label>
          <input list="classroom-programmes" value={formData.programme} onChange={(event) => setFormData({ ...formData, programme: event.target.value })} placeholder="Choose or enter a program" className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#D2D4D9' }} />
          <datalist id="classroom-programmes">{programmes.map((programme) => <option key={programme} value={programme} />)}</datalist>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Level *</label>
          <input list="classroom-levels" type="number" min="100" step="100" value={formData.level} onChange={(event) => setFormData({ ...formData, level: event.target.value })} placeholder="Select an existing level" className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#D2D4D9' }} />
          <datalist id="classroom-levels">{levels.map((level) => <option key={level} value={level} />)}</datalist>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Building</label>
          <input list="classroom-buildings" value={formData.building} onChange={(event) => setFormData({ ...formData, building: event.target.value })} placeholder="Building name" className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#D2D4D9' }} />
          <datalist id="classroom-buildings">{buildings.map((building) => <option key={building} value={building} />)}</datalist>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Campus</label>
          <input list="classroom-campuses" value={formData.campus} onChange={(event) => setFormData({ ...formData, campus: event.target.value })} placeholder="Campus name" className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#D2D4D9' }} />
          <datalist id="classroom-campuses">{campuses.map((campus) => <option key={campus} value={campus} />)}</datalist>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Physical room capacity *</label>
          <input type="number" min="1" step="1" value={formData.capacity} onChange={(event) => setFormData({ ...formData, capacity: event.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#D2D4D9' }} />
        </div>
      </div>
      {isEdit && selected?.lecturer_count > 0 && <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">{selected.lecturer_count} lecturer(s) remain assigned to this class group. Manage assignments from Users.</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={() => { setCreateModal(false); setEditModal(false) }}>Cancel</Button>
        <Button variant="primary" onClick={() => save(isEdit)} loading={saving}>{isEdit ? 'Save changes' : 'Create class'}</Button>
      </div>
    </div>
  )

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Classroom Management</h1>
          <p className="mt-1 text-sm text-gray-500">Manage class groups and their reusable physical rooms{!loading && !loadError ? ` · ${classrooms.length} loaded` : ''}{lecturerAssignmentFilter === 'missing' ? ' · Classes missing a lecturer' : ''}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => fetch()}>Refresh</Button>
          <Button variant="primary" onClick={openCreate}>+ Classroom</Button>
        </div>
      </div>

      <input type="search" aria-label="Search classes and rooms" placeholder="Search room, program, level, code, building, or campus..." value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm sm:max-w-xl" style={{ borderColor: '#D2D4D9' }} />

      {reviewRows.length > 0 && <details className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <summary className="cursor-pointer font-semibold">{reviewRows.length} existing class group(s) need physical room review</summary>
        <p className="mt-2 text-xs text-amber-900">The migration retained their IDs and assignments. No room names were inferred because none were present in the source records.</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
          {reviewRows.map((record) => <li key={record.classroom_id}><strong>{record.original_name}</strong> — {record.reason}</li>)}
        </ul>
      </details>}

      {loading ? <Spinner /> : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {loadError && <p className="bg-amber-50 px-5 py-3 text-xs text-amber-800" role="status">{loadError} <button className="ml-2 underline" onClick={() => fetch()}>Retry</button></p>}
          <div className="overflow-x-auto">
            <table className="superadmin-admin-table min-w-[1050px]">
              <colgroup>
                <col style={{ width: '14%' }} /><col style={{ width: '20%' }} /><col style={{ width: '8%' }} />
                <col style={{ width: '10%' }} /><col style={{ width: '11%' }} /><col style={{ width: '12%' }} />
                <col style={{ width: '9%' }} /><col style={{ width: '6%' }} /><col style={{ width: '10%' }} />
              </colgroup>
              <thead><tr className="border-b border-gray-100">
                <th>Room</th><th>Program</th><th>Level</th><th>Code</th><th>Building</th><th>Campus</th><th>Capacity</th><th>Lecturers</th><th className="text-right">Actions</th>
              </tr></thead>
              <tbody>
                {loadError && classrooms.length === 0 ? (
                  <tr><td colSpan={9} className="py-8 text-center text-red-600">{loadError}</td></tr>
                ) : filteredClassrooms.length === 0 ? (
                  <tr><td colSpan={9} className="py-8 text-center text-gray-500">{search ? 'No classrooms match your search.' : lecturerAssignmentFilter === 'missing' ? 'All classes have a lecturer assigned.' : 'No class groups have been added.'}</td></tr>
                ) : visibleClassrooms.map((classroom) => {
                  const room = classroom.physical_room || {}
                  return <tr key={classroom.id} className="border-b border-gray-100 transition-colors hover:bg-gray-50">
                    <td title={room.name || 'Physical room not assigned'} className="truncate font-medium text-gray-800">{room.name || <span className="font-normal text-amber-700">Needs room assignment</span>}</td>
                    <td title={classroom.programme || ''} className="truncate text-gray-700">{classroom.programme || 'Needs review'}</td>
                    <td className="text-gray-600">{classroom.level || '—'}</td>
                    <td title={room.code || classroom.class_code || ''} className="truncate text-gray-600">{room.code || <span className="text-gray-400">Room code missing</span>}</td>
                    <td title={room.building || ''} className="truncate text-gray-600">{room.building || 'Not recorded'}</td>
                    <td title={room.campus || classroom.building || ''} className="truncate text-gray-600">{room.campus || (classroom.building?.toLowerCase().includes('campus') ? classroom.building : 'Not recorded')}</td>
                    <td className="text-gray-600">{room.capacity ?? 'Not recorded'}</td>
                    <td className="text-gray-600">{classroom.lecturer_count ?? 0}</td>
                    <td><div className="admin-action-group">
                      <AdminActionButton icon="edit" label={`Edit ${classroomLabel(classroom, { includeLocation: false })}`} onClick={() => openEdit(classroom)} />
                      <AdminActionButton icon="delete" tone="danger" label={`Delete ${classroomLabel(classroom, { includeLocation: false })}`} onClick={() => handleDelete(classroom)} />
                    </div></td>
                  </tr>
                })}
              </tbody>
            </table>
          </div>
          <div className="admin-table-pagination">
            <span>Showing <strong>{firstRow}–{lastRow}</strong> of <strong>{filteredClassrooms.length}</strong> class groups</span>
            <div className="admin-table-pagination-controls">
              <label className="admin-table-page-size">Rows <select aria-label="Classrooms per page" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }}><option value={5}>5</option><option value={10}>10</option></select> per page</label>
              <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
              <span>Page {page} of {pageCount}</span>
              <button type="button" disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Next</button>
            </div>
          </div>
        </div>
      )}

      <Modal isOpen={createModal} onClose={() => !saving && setCreateModal(false)} title="Create Class Group">{form(false)}</Modal>
      <Modal isOpen={editModal} onClose={() => !saving && setEditModal(false)} title="Edit Class Group">{form(true)}</Modal>
    </div>
  )
}
