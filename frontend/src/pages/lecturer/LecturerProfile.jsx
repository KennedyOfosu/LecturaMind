/**
 * LecturerProfile.jsx — Personal info + teaching assignments management.
 */

import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { courseService } from '../../services/courseService'
import api from '../../services/api'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { PROGRAMMES, LEVELS, SEMESTERS } from '../../utils/constants'

export default function LecturerProfile() {
  const { user, token, refreshUser } = useAuth()
  const toast = useToast()
  const [loadError, setLoadError] = useState('')
  const [retryCount, setRetryCount] = useState(0)

  const [profile,     setProfile]     = useState(null)
  const [courses,     setCourses]     = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [savingInfo,  setSavingInfo]  = useState(false)
  const [showAddModal,setShowAddModal]= useState(false)
  const [adding,      setAdding]      = useState(false)
  const [removing,    setRemoving]    = useState(null)

  const [info, setInfo] = useState({
    full_name:  '',
    department: '',
    phone:      '',
    bio:        '',
  })

  const [newA, setNewA] = useState({
    course_id:     '',
    programme:     '',
    level:         '',
    semester:      '',
    academic_year: '',
  })

  const fetchAll = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [pRes, cRes, aRes] = await Promise.all([
        api.get('/api/profile/'),
        courseService.getMyCourses(),
        api.get('/api/assignments/my'),
      ])
      setProfile(pRes.data)
      setInfo({
        full_name:  pRes.data.full_name  || '',
        department: pRes.data.department || '',
        phone:      pRes.data.phone      || '',
        bio:        pRes.data.bio        || '',
      })
      setCourses(cRes.data)
      setAssignments(Array.isArray(aRes.data) ? aRes.data : [])
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to load your profile.'
      setLoadError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user || !token) return
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token, retryCount])

  const handleSaveInfo = async () => {
    setSavingInfo(true)
    try {
      await api.put('/api/profile/update', info)
      toast.success('Profile updated successfully')
      await refreshUser()
      fetchAll()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile')
    } finally {
      setSavingInfo(false)
    }
  }

  const handleAddAssignment = async () => {
    if (!newA.course_id || !newA.programme || !newA.level) {
      toast.error('Course, programme, and level are required')
      return
    }
    setAdding(true)
    try {
      const res = await api.post('/api/assignments/create', {
        course_id:     newA.course_id,
        programme:     newA.programme,
        level:         parseInt(newA.level),
        semester:      newA.semester || null,
        academic_year: newA.academic_year || null,
      })
      toast.success(res.data.message || 'Assignment created')
      setShowAddModal(false)
      setNewA({ course_id: '', programme: '', level: '', semester: '', academic_year: '' })
      fetchAll()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create assignment')
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (id) => {
    setRemoving(id)
    try {
      await api.delete(`/api/assignments/${id}`)
      toast.success('Assignment removed')
      setAssignments((p) => p.filter((a) => a.id !== id))
    } catch {
      toast.error('Failed to remove assignment')
    } finally {
      setRemoving(null)
    }
  }

  /* Group assignments by programme → level */
  const grouped = assignments.reduce((acc, a) => {
    const key = `${a.programme} — Level ${a.level}`
    if (!acc[key]) acc[key] = []
    acc[key].push(a)
    return acc
  }, {})

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-gray-500">Loading your profile…</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <p className="text-sm text-red-600">{loadError}</p>
        <Button variant="teal" onClick={() => setRetryCount((c) => c + 1)}>Retry</Button>
      </div>
    )
  }

  const initials = user?.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'L'

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-gray-900 text-white flex items-center justify-center text-lg font-bold">
          {initials}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
          <p className="text-sm text-gray-500">Manage your account and teaching assignments</p>
        </div>
      </div>

      {/* Personal info */}
      <Card>
        <h2 className="font-semibold text-gray-900 mb-4">Profile Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
            <input value={info.full_name} onChange={(e) => setInfo({ ...info, full_name: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
            <input value={profile?.email || ''} disabled
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Lecturer ID</label>
            <input value={profile?.user_id_number || ''} disabled
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Phone Number</label>
            <input value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value })}
              placeholder="+233…"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
            <input value={info.department} onChange={(e) => setInfo({ ...info, department: e.target.value })}
              placeholder="e.g. Department of Information Technology"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Bio (max 300 characters)</label>
            <textarea value={info.bio} onChange={(e) => setInfo({ ...info, bio: e.target.value.slice(0, 300) })}
              rows={3} placeholder="A short description about you"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none" />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="teal" loading={savingInfo} onClick={handleSaveInfo}>Save Changes</Button>
        </div>
      </Card>

      {/* Teaching Assignments */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">My Teaching Assignments This Semester</h2>
          <Button variant="teal" size="sm" onClick={() => setShowAddModal(true)}>+ Add Assignment</Button>
        </div>

        {!Object.keys(grouped).length ? (
          <p className="text-sm text-gray-400 py-6 text-center">
            No teaching assignments yet. Click "Add Assignment" to link your courses to a programme and level.
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {Object.entries(grouped).map(([groupKey, items]) => (
              <div key={groupKey}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{groupKey}</p>
                <div className="flex flex-col gap-2">
                  {items.map((a) => (
                    <div key={a.id} className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 bg-gray-50">
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {a.courses?.course_name} ({a.courses?.course_code})
                        </p>
                        {(a.semester || a.academic_year) && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {[a.semester, a.academic_year].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                      <button onClick={() => handleRemove(a.id)} disabled={removing === a.id}
                        className="text-red-500 hover:text-red-700 transition-colors disabled:opacity-50 text-xs font-medium">
                        {removing === a.id ? '…' : 'Remove'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add assignment modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Teaching Assignment">
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Course</label>
            <select value={newA.course_id} onChange={(e) => setNewA({ ...newA, course_id: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300">
              <option value="">Select a course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.course_name} ({c.course_code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Programme</label>
            <select value={newA.programme} onChange={(e) => setNewA({ ...newA, programme: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300">
              <option value="">Select programme</option>
              {PROGRAMMES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Level</label>
              <select value={newA.level} onChange={(e) => setNewA({ ...newA, level: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300">
                <option value="">Level</option>
                {LEVELS.map((l) => <option key={l} value={l}>Level {l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Semester (optional)</label>
              <select value={newA.semester} onChange={(e) => setNewA({ ...newA, semester: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300">
                <option value="">—</option>
                {SEMESTERS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Academic Year (optional)</label>
            <input value={newA.academic_year} onChange={(e) => setNewA({ ...newA, academic_year: e.target.value })}
              placeholder="e.g. 2025/2026"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
          </div>
          <Button variant="teal" onClick={handleAddAssignment} loading={adding} className="w-full">
            Save Assignment
          </Button>
        </div>
      </Modal>
    </div>
  )
}
