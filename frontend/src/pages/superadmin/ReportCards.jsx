import { useState, useEffect, useCallback } from 'react'
import { adminService } from '../../services/adminService'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { Card } from '../../components/ui/Card'
import { useToast } from '../../components/ui/Toast'
import { LEVELS, PROGRAMMES } from '../../utils/constants'

export default function ReportCards() {
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [semesters, setSemesters] = useState([])
  const [years, setYears] = useState([])
  const [students, setStudents] = useState([])
  const [reportCards, setReportCards] = useState([])
  const [viewRc, setViewRc] = useState(null)
  const [viewModal, setViewModal] = useState(false)
  const [genForm, setGenForm] = useState({
    student_id: '', semester_id: '', academic_year_id: '',
    programme: '', level: '', bulk: false,
  })
  const toast = useToast()

  const fetchInitial = useCallback(async () => {
    try {
      const [semRes, yrRes, stuRes, rcRes] = await Promise.all([
        adminService.getSemesters(),
        adminService.getAcademicYears(),
        adminService.getUsers({ role: 'student' }),
        adminService.getReportCards(),
      ])
      setSemesters(semRes.data)
      setYears(yrRes.data)
      setStudents(stuRes.data)
      setReportCards(rcRes.data)
    } catch {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchInitial() }, [fetchInitial])

  const handleGenerate = async () => {
    if (!genForm.semester_id || !genForm.academic_year_id) {
      toast.warning('Select semester and academic year'); return
    }

    if (!genForm.bulk && !genForm.student_id) {
      toast.warning('Select a student or switch to bulk mode'); return
    }

    setGenerating(true)
    try {
      if (genForm.bulk) {
        const res = await adminService.generateBulkReportCards({
          semester_id: genForm.semester_id,
          academic_year_id: genForm.academic_year_id,
          programme: genForm.programme || undefined,
          level: genForm.level || undefined,
        })
        toast.success(`Generated ${res.data.total} report cards`)
      } else {
        await adminService.generateReportCard({
          student_id: genForm.student_id,
          semester_id: genForm.semester_id,
          academic_year_id: genForm.academic_year_id,
        })
        toast.success('Report card generated')
      }
      fetchInitial()
    } catch {
      toast.error('Failed to generate report cards')
    } finally {
      setGenerating(false)
    }
  }

  const openView = async (rc) => {
    try {
      const res = await adminService.getReportCard(rc.id)
      setViewRc(res.data)
      setViewModal(true)
    } catch {
      toast.error('Failed to load report card')
    }
  }

  const handleFinalize = async (rcId) => {
    if (!window.confirm('Finalize this report card? This makes it read-only.')) return
    try {
      await adminService.finalizeReportCard(rcId)
      toast.success('Report card finalized')
      setViewModal(false)
      fetchInitial()
    } catch {
      toast.error('Failed to finalize')
    }
  }

  if (loading) return <Spinner />

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Report Cards</h1>
        <p className="text-sm text-gray-500 mt-1">Generate and manage student report cards</p>
      </div>

      <Card>
        <div className="px-5 py-4 border-b" style={{ borderColor: '#F0F0F2' }}>
          <h2 className="text-sm font-semibold text-gray-800">Generate Report Cards</h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Semester</label>
              <select value={genForm.semester_id || ''} onChange={(e) => setGenForm({ ...genForm, semester_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }}>
                <option value="">Select</option>
                {semesters.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Academic Year</label>
              <select value={genForm.academic_year_id || ''} onChange={(e) => setGenForm({ ...genForm, academic_year_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }}>
                <option value="">Select</option>
                {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </div>
            {!genForm.bulk && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Student</label>
                <select value={genForm.student_id || ''} onChange={(e) => setGenForm({ ...genForm, student_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }}>
                  <option value="">Select</option>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.user_id_number})</option>)}
                </select>
              </div>
            )}
            {genForm.bulk && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Programme (optional)</label>
                  <select value={genForm.programme || ''} onChange={(e) => setGenForm({ ...genForm, programme: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }}>
                    <option value="">All programmes</option>
                    {PROGRAMMES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Level (optional)</label>
                  <select value={genForm.level || ''} onChange={(e) => setGenForm({ ...genForm, level: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }}>
                    <option value="">All levels</option>
                    {LEVELS.map((l) => <option key={l} value={l}>Level {l}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={genForm.bulk} onChange={(e) => setGenForm({ ...genForm, bulk: e.target.checked })} />
              <span className="text-gray-700">Bulk generate (all students)</span>
            </label>
            <Button variant="primary" onClick={handleGenerate} loading={generating}>
              {genForm.bulk ? 'Generate All' : 'Generate'}
            </Button>
          </div>
        </div>
      </Card>

      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff', border: '1px solid #D2D4D9' }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: '#F0F0F2' }}>
          <h2 className="text-sm font-semibold text-gray-800">Generated Report Cards</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase" style={{ borderBottom: '1px solid #F0F0F2' }}>
                <th className="text-left px-5 py-3 font-semibold">Student</th>
                <th className="text-left px-5 py-3 font-semibold">Semester</th>
                <th className="text-left px-5 py-3 font-semibold">Score</th>
                <th className="text-left px-5 py-3 font-semibold">Grade</th>
                <th className="text-left px-5 py-3 font-semibold">GP</th>
                <th className="text-left px-5 py-3 font-semibold">Status</th>
                <th className="text-right px-5 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reportCards.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">No report cards generated yet</td></tr>
              ) : reportCards.map((rc) => (
                <tr key={rc.id} className="hover:bg-gray-50" style={{ borderBottom: '1px solid #F0F0F2' }}>
                  <td className="px-5 py-3 font-medium text-gray-800">{rc.student_name}</td>
                  <td className="px-5 py-3 text-gray-500">{rc.semester_name}</td>
                  <td className="px-5 py-3 font-medium text-gray-800">{rc.cumulative_score}%</td>
                  <td className="px-5 py-3">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{rc.grade_letter}</span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{rc.grade_point}</td>
                  <td className="px-5 py-3">
                    {rc.is_finalized ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Finalized</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">Draft</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openView(rc)} className="text-xs text-gray-500 hover:text-gray-800">View</button>
                      {!rc.is_finalized && (
                        <button onClick={() => handleFinalize(rc.id)} className="text-xs text-indigo-500 hover:text-indigo-700">Finalize</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={viewModal} onClose={() => setViewModal(false)} title="Report Card" size="max-w-3xl">
        {viewRc && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm p-4 rounded-xl bg-gray-50">
              <div><span className="text-gray-500">Student:</span> <span className="font-medium text-gray-800">{viewRc.student_name}</span></div>
              <div><span className="text-gray-500">Semester:</span> <span className="font-medium text-gray-800">{viewRc.semester_name}</span></div>
              <div><span className="text-gray-500">Academic Year:</span> <span className="font-medium text-gray-800">{viewRc.academic_year_name}</span></div>
              <div>
                <span className="text-gray-500">Status:</span>{' '}
                {viewRc.is_finalized ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Finalized</span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">Draft</span>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Course Breakdown</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase" style={{ borderBottom: '1px solid #E5E7EB' }}>
                    <th className="text-left px-3 py-2 font-semibold">Course</th>
                    <th className="text-left px-3 py-2 font-semibold">Code</th>
                    <th className="text-right px-3 py-2 font-semibold">Marks</th>
                    <th className="text-right px-3 py-2 font-semibold">Max</th>
                    <th className="text-right px-3 py-2 font-semibold">Grade</th>
                    <th className="text-right px-3 py-2 font-semibold">GP</th>
                  </tr>
                </thead>
                <tbody>
                  {viewRc.courses?.map((c) => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #F0F0F2' }}>
                      <td className="px-3 py-2 text-gray-800">{c.course_name}</td>
                      <td className="px-3 py-2 text-gray-500">{c.course_code}</td>
                      <td className="px-3 py-2 text-right text-gray-800 font-medium">{c.marks_obtained}</td>
                      <td className="px-3 py-2 text-right text-gray-500">{c.max_marks}</td>
                      <td className="px-3 py-2 text-right">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{c.grade_letter}</span>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500">{c.grade_point}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-3 gap-4 p-4 rounded-xl" style={{ backgroundColor: '#F0F4F8' }}>
              <div className="text-center">
                <p className="text-xs text-gray-500">Total Marks</p>
                <p className="text-lg font-bold text-gray-900">{viewRc.total_marks_obtained}/{viewRc.total_max_marks}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Attendance Yield</p>
                <p className="text-lg font-bold text-green-600">+{viewRc.attendance_yield}%</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Cumulative Score</p>
                <p className="text-lg font-bold text-indigo-600">{viewRc.cumulative_score}% ({viewRc.grade_letter})</p>
              </div>
            </div>

            {!viewRc.is_finalized && (
              <div className="flex justify-end pt-2">
                <Button variant="primary" onClick={() => handleFinalize(viewRc.id)} loading={generating}>
                  Finalize Report Card
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
