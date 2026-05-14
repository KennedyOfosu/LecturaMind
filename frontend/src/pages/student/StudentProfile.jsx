/**
 * StudentProfile.jsx — Redesigned profile page.
 * Banner + centered avatar, line-separated sections, unified Save Changes.
 */

import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { courseService } from '../../services/courseService'
import api from '../../services/api'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { PROGRAMMES, LEVELS } from '../../utils/constants'
import { useNavigate } from 'react-router-dom'

/* ── Inline field (underline style, no card box) ── */
function Field({ label, value, onChange, disabled, type = 'text', as, children }) {
  const base = 'w-full bg-transparent border-b py-2 text-sm text-gray-800 focus:outline-none transition-colors'
  const enabled = 'border-gray-200 focus:border-gray-500'
  const dis = 'border-gray-100 text-gray-400 cursor-not-allowed'
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 mb-1">{label}</p>
      {children || (
        as === 'select' ? (
          <select value={value} onChange={onChange} disabled={disabled}
            className={`${base} ${disabled ? dis : enabled}`}>
            {/* options injected via children not available here — handled inline */}
          </select>
        ) : (
          <input type={type} value={value} onChange={onChange} disabled={disabled}
            className={`${base} ${disabled ? dis : enabled}`} />
        )
      )}
    </div>
  )
}

/* ── Section divider ── */
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

export default function StudentProfile() {
  const { user, token, refreshUser } = useAuth()
  const toast    = useToast()
  const navigate = useNavigate()

  const [profile,  setProfile]  = useState(null)
  const [courses,  setCourses]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [dirty,    setDirty]    = useState(false)
  const [enrolling, setEnrolling] = useState(false)
  const [courseCode, setCourseCode] = useState('')

  const [form, setForm] = useState({
    full_name:     '',
    phone:         '',
    programme:     '',
    level:         '',
    academic_year: '',
  })
  const [original, setOriginal] = useState(null)

  const patch = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }))
    setDirty(true)
  }

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [pRes, cRes] = await Promise.all([
        api.get('/api/profile/'),
        courseService.getEnrolled(),
      ])
      const d = pRes.data
      const initial = {
        full_name:     d.full_name     || '',
        phone:         d.phone         || '',
        programme:     d.programme     || '',
        level:         d.level         || '',
        academic_year: d.academic_year || '',
      }
      setProfile(d)
      setForm(initial)
      setOriginal(initial)
      setCourses(Array.isArray(cRes.data) ? cRes.data : [])
    } catch {
      toast.error('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (user && token) fetchAll() }, [user, token])

  const handleDiscard = () => {
    if (original) { setForm(original); setDirty(false) }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put('/api/profile/update', {
        full_name:     form.full_name,
        phone:         form.phone,
        programme:     form.programme,
        level:         form.level ? parseInt(form.level) : undefined,
        academic_year: form.academic_year || null,
      })
      toast.success('Profile saved successfully')
      setDirty(false)
      await refreshUser()
      fetchAll()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleEnrol = async () => {
    if (!courseCode.trim()) return
    setEnrolling(true)
    try {
      const res = await api.post('/api/courses/enrol-self', { course_code: courseCode.trim() })
      toast.success(res.data.message)
      setCourseCode('')
      fetchAll()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Enrolment failed')
    } finally {
      setEnrolling(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24 gap-3">
      <Spinner size="lg" />
    </div>
  )

  const initials = user?.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'S'

  return (
    <div className="max-w-2xl mx-auto">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <button onClick={() => navigate('/student/dashboard')} className="hover:text-gray-600">Home</button>
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
        style={{ background: 'linear-gradient(135deg, #a8c8f8 0%, #c3b1e1 40%, #f0c4d4 100%)' }} />

      {/* ── Avatar ── */}
      <div className="flex justify-center -mt-10 mb-3">
        <div className="h-20 w-20 rounded-full flex items-center justify-center text-2xl font-bold border-4 border-white shadow-md"
          style={{ backgroundColor: '#111', color: '#fff' }}>
          {initials}
        </div>
      </div>

      {/* ── Name + ID centred ── */}
      <div className="text-center mb-2">
        <h1 className="text-xl font-bold text-gray-900">{profile?.full_name}</h1>
        <p className="text-sm text-gray-400 mt-0.5 font-mono">{profile?.user_id_number}</p>
      </div>
      <div className="flex justify-center gap-6 mb-8 text-sm">
        <span className="text-gray-500"><strong className="text-gray-800">{courses.length}</strong> Courses</span>
        {form.level && <span className="text-gray-500">Level <strong className="text-gray-800">{form.level}</strong></span>}
      </div>

      {/* ══ Section: Personal Information ══ */}
      <Section icon={
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="text-gray-400">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
      } title="Personal Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field label="Full Name" value={form.full_name} onChange={(e) => patch('full_name', e.target.value)} />
          <Field label="Email" value={profile?.email || ''} disabled />
          <Field label="Student ID" value={profile?.user_id_number || ''} disabled />
          <Field label="Phone Number" value={form.phone} onChange={(e) => patch('phone', e.target.value)} />
        </div>
      </Section>

      {/* ══ Section: Academic Information ══ */}
      <Section icon={
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="text-gray-400">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
        </svg>
      } title="Academic Information">
        <p className="text-xs text-gray-400 mb-5">Updating your level automatically connects you to matching courses.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <p className="text-xs font-medium text-gray-400 mb-1">Programme</p>
            <select value={form.programme} onChange={(e) => patch('programme', e.target.value)}
              className="w-full bg-transparent border-b border-gray-200 py-2 text-sm text-gray-800 focus:outline-none focus:border-gray-500">
              <option value="">Select your programme</option>
              {PROGRAMMES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 mb-1">Current Level</p>
            <select value={form.level} onChange={(e) => patch('level', e.target.value)}
              className="w-full bg-transparent border-b border-gray-200 py-2 text-sm text-gray-800 focus:outline-none focus:border-gray-500">
              <option value="">Select level</option>
              {LEVELS.map((l) => <option key={l} value={l}>Level {l}</option>)}
            </select>
          </div>
          <Field label="Academic Year" value={form.academic_year}
            onChange={(e) => patch('academic_year', e.target.value)} />
        </div>
      </Section>

      {/* ══ Section: Enrolled Courses ══ */}
      <Section icon={
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="text-gray-400">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
        </svg>
      } title="My Enrolled Courses">

        {/* Self-enrol form */}
        <div className="flex items-center gap-2 mb-6">
          <input
            value={courseCode}
            onChange={(e) => setCourseCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleEnrol()}
            placeholder="Enter course code (e.g. DC 201)"
            className="flex-1 bg-transparent border-b border-gray-200 py-2 text-sm text-gray-800 focus:outline-none focus:border-gray-500"
          />
          <button onClick={handleEnrol} disabled={enrolling || !courseCode.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
            style={{ backgroundColor: '#111' }}>
            {enrolling ? '…' : 'Enrol'}
          </button>
        </div>

        {!courses.length ? (
          <p className="text-sm text-gray-400">
            No courses yet. Enter a course code above to enrol, or ask your lecturer to connect courses to your programme.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-gray-100">
            {courses.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {c.course_name}
                    {c.course_code && <span className="text-gray-400 ml-2 text-xs">({c.course_code})</span>}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {c.profiles?.full_name || 'Lecturer'}
                    {c.level && <span> · Level {c.level}</span>}
                  </p>
                </div>
                <button onClick={() => navigate(`/student/courses/${c.id}`)}
                  className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
                  View →
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

    </div>
  )
}
