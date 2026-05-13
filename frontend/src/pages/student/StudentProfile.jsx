/**
 * StudentProfile.jsx — Personal info + academic info + enrolled courses.
 * Changing programme/level triggers auto-enrolment into matching courses.
 */

import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { courseService } from '../../services/courseService'
import api from '../../services/api'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { PROGRAMMES, LEVELS } from '../../utils/constants'

export default function StudentProfile() {
  const { user, refreshUser } = useAuth()
  const toast = useToast()

  const [profile,    setProfile]    = useState(null)
  const [courses,    setCourses]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [savingInfo, setSavingInfo] = useState(false)
  const [savingAca,  setSavingAca]  = useState(false)

  const [info, setInfo] = useState({ full_name: '', phone: '' })
  const [aca,  setAca]  = useState({ programme: '', level: '', academic_year: '' })

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [pRes, cRes] = await Promise.all([
        api.get('/api/profile/'),
        courseService.getEnrolled(),
      ])
      setProfile(pRes.data)
      setInfo({
        full_name: pRes.data.full_name || '',
        phone:     pRes.data.phone     || '',
      })
      setAca({
        programme:     pRes.data.programme     || '',
        level:         pRes.data.level         || '',
        academic_year: pRes.data.academic_year || '',
      })
      setCourses(cRes.data)
    } catch {
      toast.error('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

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

  const handleSaveAca = async () => {
    if (!aca.programme || !aca.level) {
      toast.error('Programme and level are required')
      return
    }
    setSavingAca(true)
    try {
      const res = await api.put('/api/profile/update', {
        programme:     aca.programme,
        level:         parseInt(aca.level),
        academic_year: aca.academic_year || null,
      })
      const newEnrols = res.data.auto_enrolled || 0
      toast.success(
        newEnrols > 0
          ? `Academic info updated. Enrolled in ${newEnrols} new course(s).`
          : 'Your academic information has been updated.'
      )
      await refreshUser()
      fetchAll()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update academic info')
    } finally {
      setSavingAca(false)
    }
  }

  /* Group enrolled courses by lecturer */
  const grouped = courses.reduce((acc, c) => {
    const lecturer = c.profiles?.full_name || 'Lecturer'
    if (!acc[lecturer]) acc[lecturer] = []
    acc[lecturer].push(c)
    return acc
  }, {})

  if (loading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

  const initials = user?.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'S'

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-gray-900 text-white flex items-center justify-center text-lg font-bold">
          {initials}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
          <p className="text-sm text-gray-500">Manage your account and academic information</p>
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
            <label className="block text-xs font-medium text-gray-600 mb-1">Student ID</label>
            <input value={profile?.user_id_number || ''} disabled
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Phone Number</label>
            <input value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value })}
              placeholder="+233…"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="teal" loading={savingInfo} onClick={handleSaveInfo}>Save Changes</Button>
        </div>
      </Card>

      {/* Academic info */}
      <Card>
        <h2 className="font-semibold text-gray-900 mb-1">My Academic Information</h2>
        <p className="text-xs text-gray-400 mb-4">
          Updating your level will automatically connect you to all matching courses.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Programme</label>
            <select value={aca.programme} onChange={(e) => setAca({ ...aca, programme: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300">
              <option value="">Select your programme</option>
              {PROGRAMMES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Current Level</label>
            <select value={aca.level} onChange={(e) => setAca({ ...aca, level: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300">
              <option value="">Select your level</option>
              {LEVELS.map((l) => <option key={l} value={l}>Level {l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Academic Year</label>
            <input value={aca.academic_year} onChange={(e) => setAca({ ...aca, academic_year: e.target.value })}
              placeholder="e.g. 2025/2026"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="teal" loading={savingAca} onClick={handleSaveAca}>Update Academic Info</Button>
        </div>
      </Card>

      {/* Enrolled courses */}
      <Card>
        <h2 className="font-semibold text-gray-900 mb-4">My Enrolled Courses</h2>
        {!Object.keys(grouped).length ? (
          <p className="text-sm text-gray-400 py-6 text-center">
            You are not enrolled in any courses yet. Update your programme and level above to get connected automatically.
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {Object.entries(grouped).map(([lecturer, lecCourses]) => (
              <div key={lecturer}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{lecturer}</p>
                <div className="flex flex-col gap-2">
                  {lecCourses.map((c) => (
                    <div key={c.id} className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 bg-gray-50">
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {c.course_name} <span className="text-gray-400">({c.course_code})</span>
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {[c.programme, c.level && `Level ${c.level}`].filter(Boolean).join(' · ') || 'Course'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
