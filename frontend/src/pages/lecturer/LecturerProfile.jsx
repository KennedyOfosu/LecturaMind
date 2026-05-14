/**
 * LecturerProfile.jsx — Redesigned profile page.
 * Banner + centered avatar, line-separated sections, unified Save Changes.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { courseService } from '../../services/courseService'
import api from '../../services/api'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { PROGRAMMES, LEVELS, SEMESTERS } from '../../utils/constants'

/* ── Inline field ── */
function Field({ label, value, onChange, disabled, placeholder }) {
  const base = 'w-full bg-transparent border-b py-2 text-sm text-gray-800 focus:outline-none transition-colors'
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 mb-1">{label}</p>
      <input value={value || ''} onChange={onChange} disabled={disabled} placeholder={placeholder}
        className={`${base} ${disabled ? 'border-gray-100 text-gray-400 cursor-not-allowed' : 'border-gray-200 focus:border-gray-500'}`} />
    </div>
  )
}

function Section({ icon, title, children }) {
  return (
    <div className="border-t border-gray-100 pt-7 pb-7">
      <div className="flex items-center gap-2 mb-6">
        {icon}
        <span className="text-sm font-semibold text-gray-700">{title}</span>
      </div>
      {children}
    </div>
  )
}

export default function LecturerProfile() {
  const { user, token, refreshUser } = useAuth()
  const toast    = useToast()
  const navigate = useNavigate()

  const [profile,     setProfile]     = useState(null)
  const [courses,     setCourses]     = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [dirty,       setDirty]       = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [adding,      setAdding]      = useState(false)
  const [removing,    setRemoving]    = useState(null)

  const [form, setForm] = useState({ full_name: '', department: '', phone: '', bio: '' })
  const [original, setOriginal] = useState(null)

  const [newA, setNewA] = useState({ course_id: '', programme: '', level: '', semester: '', academic_year: '' })

  const patch = (key, val) => { setForm((f) => ({ ...f, [key]: val })); setDirty(true) }

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [pRes, cRes, aRes] = await Promise.all([
        api.get('/api/profile/'),
        courseService.getMyCourses(),
        api.get('/api/assignments/my'),
      ])
      const d = pRes.data
      const initial = { full_name: d.full_name || '', department: d.department || '', phone: d.phone || '', bio: d.bio || '' }
      setProfile(d)
      setForm(initial)
      setOriginal(initial)
      setCourses(cRes.data)
      setAssignments(Array.isArray(aRes.data) ? aRes.data : [])
    } catch {
      toast.error('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (user && token) fetchAll() }, [user, token])

  const handleDiscard = () => { if (original) { setForm(original); setDirty(false) } }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put('/api/profile/update', form)
      toast.success('Profile saved successfully')
      setDirty(false)
      await refreshUser()
      fetchAll()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed')
    } finally { setSaving(false) }
  }

  const handleAddAssignment = async () => {
    if (!newA.course_id || !newA.programme || !newA.level) { toast.error('Course, programme, and level are required'); return }
    setAdding(true)
    try {
      await api.post('/api/assignments/create', { ...newA, level: parseInt(newA.level) })
      toast.success('Assignment added')
      setShowAddModal(false)
      setNewA({ course_id: '', programme: '', level: '', semester: '', academic_year: '' })
      fetchAll()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed')
    } finally { setAdding(false) }
  }

  const handleRemove = async (id) => {
    setRemoving(id)
    try {
      await api.delete(`/api/assignments/${id}`)
      setAssignments((p) => p.filter((a) => a.id !== id))
    } catch { toast.error('Failed to remove') }
    finally { setRemoving(null) }
  }

  if (loading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>

  const initials = user?.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'L'

  const grouped = assignments.reduce((acc, a) => {
    const key = `${a.programme} — Level ${a.level}`
    if (!acc[key]) acc[key] = []
    acc[key].push(a)
    return acc
  }, {})

  return (
    <div className="max-w-2xl mx-auto">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <button onClick={() => navigate('/lecturer/dashboard')} className="hover:text-gray-600">Home</button>
          <span>›</span>
          <span className="text-gray-700 font-medium">General information</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleDiscard} disabled={!dirty || saving}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-40 transition-colors">
            Discard
          </button>
          <button onClick={handleSave} disabled={!dirty || saving}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-colors"
            style={{ backgroundColor: '#111' }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* ── Banner ── */}
      <div className="h-32 rounded-2xl overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #c3b1e1 0%, #a8c8f8 50%, #b8e4c9 100%)' }} />

      {/* ── Avatar ── */}
      <div className="flex justify-center -mt-10 mb-3">
        <div className="h-20 w-20 rounded-full flex items-center justify-center text-2xl font-bold border-4 border-white shadow-md"
          style={{ backgroundColor: '#374151', color: '#fff' }}>
          {initials}
        </div>
      </div>

      {/* ── Name + ID ── */}
      <div className="text-center mb-2">
        <h1 className="text-xl font-bold text-gray-900">{profile?.full_name}</h1>
        <p className="text-sm text-gray-400 mt-0.5 font-mono">{profile?.user_id_number}</p>
        {profile?.department && <p className="text-xs text-gray-400 mt-1">{profile.department}</p>}
      </div>
      <div className="flex justify-center gap-6 mb-8 text-sm">
        <span className="text-gray-500"><strong className="text-gray-800">{courses.length}</strong> Courses</span>
        <span className="text-gray-500"><strong className="text-gray-800">{assignments.length}</strong> Assignments</span>
      </div>

      {/* ══ Section: Personal Information ══ */}
      <Section icon={
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="text-gray-400">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
      } title="Personal Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field label="Full Name"    value={form.full_name}  onChange={(e) => patch('full_name', e.target.value)} />
          <Field label="Email"        value={profile?.email}  disabled />
          <Field label="Lecturer ID"  value={profile?.user_id_number} disabled />
          <Field label="Phone Number" value={form.phone}      onChange={(e) => patch('phone', e.target.value)} placeholder="+233…" />
          <div className="md:col-span-2">
            <Field label="Department"   value={form.department} onChange={(e) => patch('department', e.target.value)} placeholder="e.g. Department of Information Technology" />
          </div>
          <div className="md:col-span-2">
            <p className="text-xs font-medium text-gray-400 mb-1">Bio</p>
            <textarea value={form.bio} onChange={(e) => patch('bio', e.target.value.slice(0, 300))} rows={3}
              placeholder="A short description about you (max 300 characters)"
              className="w-full bg-transparent border-b border-gray-200 py-2 text-sm text-gray-800 focus:outline-none focus:border-gray-500 resize-none" />
            <p className="text-xs text-gray-300 mt-0.5">{form.bio.length}/300</p>
          </div>
        </div>
      </Section>

      {/* ══ Section: Teaching Assignments ══ */}
      <Section icon={
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="text-gray-400">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
        </svg>
      } title="Teaching Assignments">

        <div className="flex justify-end mb-4">
          <button onClick={() => setShowAddModal(true)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-gray-400 transition-colors">
            + Add Assignment
          </button>
        </div>

        {!Object.keys(grouped).length ? (
          <p className="text-sm text-gray-400">No assignments yet. Add one to connect your courses to student programmes.</p>
        ) : (
          <div className="flex flex-col gap-5">
            {Object.entries(grouped).map(([groupKey, items]) => (
              <div key={groupKey}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{groupKey}</p>
                <div className="flex flex-col divide-y divide-gray-100">
                  {items.map((a) => (
                    <div key={a.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {a.courses?.course_name} <span className="text-gray-400 text-xs">({a.courses?.course_code})</span>
                        </p>
                        {(a.semester || a.academic_year) && (
                          <p className="text-xs text-gray-400 mt-0.5">{[a.semester, a.academic_year].filter(Boolean).join(' · ')}</p>
                        )}
                      </div>
                      <button onClick={() => handleRemove(a.id)} disabled={removing === a.id}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-40">
                        {removing === a.id ? '…' : 'Remove'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ══ Section: My Courses ══ */}
      <Section icon={
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="text-gray-400">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
        </svg>
      } title="My Courses">
        {!courses.length ? (
          <p className="text-sm text-gray-400">No courses yet. Create a course in the Course Manager.</p>
        ) : (
          <div className="flex flex-col divide-y divide-gray-100">
            {courses.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {c.course_name} <span className="text-gray-400 text-xs">({c.course_code})</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">Level {c.level}{c.programme && ` · ${c.programme}`}</p>
                </div>
                <button onClick={() => navigate('/lecturer/courses')}
                  className="text-xs text-gray-400 hover:text-gray-700">Manage →</button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Add assignment modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Teaching Assignment">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Course</p>
            <select value={newA.course_id} onChange={(e) => setNewA({ ...newA, course_id: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none">
              <option value="">Select a course</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.course_name} ({c.course_code})</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Programme</p>
            <select value={newA.programme} onChange={(e) => setNewA({ ...newA, programme: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none">
              <option value="">Select programme</option>
              {PROGRAMMES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Level</p>
              <select value={newA.level} onChange={(e) => setNewA({ ...newA, level: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none">
                <option value="">Level</option>
                {LEVELS.map((l) => <option key={l} value={l}>Level {l}</option>)}
              </select>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Semester</p>
              <select value={newA.semester} onChange={(e) => setNewA({ ...newA, semester: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none">
                <option value="">—</option>
                {SEMESTERS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Academic Year (optional)</p>
            <input value={newA.academic_year} onChange={(e) => setNewA({ ...newA, academic_year: e.target.value })}
              placeholder="e.g. 2025/2026"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none" />
          </div>
          <Button variant="teal" onClick={handleAddAssignment} loading={adding} className="w-full">Save Assignment</Button>
        </div>
      </Modal>
    </div>
  )
}
