import { useState, useEffect, useCallback } from 'react'
import { adminService } from '../../services/adminService'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { AdminActionButton } from '../../components/ui/AdminActionButton'

const TAB_COLORS = {
  active: 'bg-white text-gray-900 shadow-sm',
  inactive: 'text-gray-500 hover:text-gray-700',
}

function TabBar({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 rounded-lg p-1" style={{ backgroundColor: '#E5E7EB' }}>
      {tabs.map((t) => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${active === t.key ? TAB_COLORS.active : TAB_COLORS.inactive}`}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

function AcademicYearsTab({ toast }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  const fetch = useCallback(() => {
    setLoading(true)
    adminService.getAcademicYears()
      .then((r) => setItems(r.data))
      .catch(() => toast.error('Failed to load academic years'))
      .finally(() => setLoading(false))
  }, [toast])

  useEffect(() => { fetch() }, [fetch])

  const openCreate = () => {
    setEditItem(null)
    setForm({ name: '', start_date: '', end_date: '', is_active: false })
    setModal(true)
  }

  const openEdit = (item) => {
    setEditItem(item)
    setForm({
      name: item.name || '',
      start_date: item.start_date || '',
      end_date: item.end_date || '',
      is_active: item.is_active || false,
    })
    setModal(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.start_date || !form.end_date) { toast.warning('All fields required'); return }
    setSaving(true)
    try {
      if (editItem) await adminService.updateAcademicYear(editItem.id, form)
      else await adminService.createAcademicYear(form)
      toast.success(editItem ? 'Updated' : 'Created')
      setModal(false)
      fetch()
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button variant="primary" onClick={openCreate}>+ Academic Year</Button></div>
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff', border: '1px solid #D2D4D9' }}>
        <table className="superadmin-admin-table w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 uppercase" style={{ borderBottom: '1px solid #F0F0F2' }}>
              <th className="text-left px-5 py-3 font-semibold">Name</th>
              <th className="text-left px-5 py-3 font-semibold">Start</th>
              <th className="text-left px-5 py-3 font-semibold">End</th>
              <th className="text-left px-5 py-3 font-semibold">Status</th>
              <th className="text-right px-5 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">No academic years</td></tr>
            ) : items.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50" style={{ borderBottom: '1px solid #F0F0F2' }}>
                <td className="px-5 py-3 font-medium text-gray-800">{item.name}</td>
                <td className="px-5 py-3 text-gray-500">{item.start_date}</td>
                <td className="px-5 py-3 text-gray-500">{item.end_date}</td>
                <td className="px-5 py-3">
                  {item.is_active ? (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">Active</span>
                  ) : <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>}
                </td>
                <td className="px-5 py-3 text-right">
                  <AdminActionButton icon="edit" label={`Edit ${item.name}`} onClick={() => openEdit(item)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editItem ? 'Edit Academic Year' : 'Create Academic Year'}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
            <input type="text" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
              <input type="date" value={form.start_date || ''} onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
              <input type="date" value={form.end_date || ''} onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active || false} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            <span className="text-gray-700">Set as active year</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function SemestersTab({ toast }) {
  const [items, setItems] = useState([])
  const [years, setYears] = useState([])
  const [loading, setLoading] = useState(true)
  const [yearFilter, setYearFilter] = useState('')
  const [modal, setModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  const fetch = useCallback(() => {
    setLoading(true)
    Promise.all([
      adminService.getSemesters(yearFilter ? { academic_year_id: yearFilter } : {}),
      adminService.getAcademicYears(),
    ]).then(([semRes, yrRes]) => {
      setItems(semRes.data)
      setYears(yrRes.data)
    }).catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false))
  }, [toast, yearFilter])

  useEffect(() => { fetch() }, [fetch])

  const openCreate = () => {
    setEditItem(null)
    setForm({ academic_year_id: yearFilter || '', name: '', semester_number: 1, start_date: '', end_date: '', is_active: false })
    setModal(true)
  }

  const openEdit = (item) => {
    setEditItem(item)
    setForm({
      academic_year_id: item.academic_year_id || '',
      name: item.name || '',
      semester_number: item.semester_number || 1,
      start_date: item.start_date || '',
      end_date: item.end_date || '',
      is_active: item.is_active || false,
    })
    setModal(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.start_date || !form.end_date) { toast.warning('All fields required'); return }
    setSaving(true)
    try {
      if (editItem) await adminService.updateSemester(editItem.id, form)
      else await adminService.createSemester(form)
      toast.success(editItem ? 'Updated' : 'Created')
      setModal(false)
      fetch()
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }}>
          <option value="">All years</option>
          {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
        </select>
        <Button variant="primary" onClick={openCreate}>+ Semester</Button>
      </div>
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff', border: '1px solid #D2D4D9' }}>
        <table className="superadmin-admin-table w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 uppercase" style={{ borderBottom: '1px solid #F0F0F2' }}>
              <th className="text-left px-5 py-3 font-semibold">Name</th>
              <th className="text-left px-5 py-3 font-semibold">Academic Year</th>
              <th className="text-left px-5 py-3 font-semibold">Semester</th>
              <th className="text-left px-5 py-3 font-semibold">Period</th>
              <th className="text-left px-5 py-3 font-semibold">Status</th>
              <th className="text-right px-5 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">No semesters</td></tr>
            ) : items.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50" style={{ borderBottom: '1px solid #F0F0F2' }}>
                <td className="px-5 py-3 font-medium text-gray-800">{item.name}</td>
                <td className="px-5 py-3 text-gray-500">{item.academic_year_name || '-'}</td>
                <td className="px-5 py-3">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">S{item.semester_number}</span>
                </td>
                <td className="px-5 py-3 text-gray-500 text-xs">{item.start_date} &rarr; {item.end_date}</td>
                <td className="px-5 py-3">
                  {item.is_active ? (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">Active</span>
                  ) : <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>}
                </td>
                <td className="px-5 py-3 text-right">
                  <AdminActionButton icon="edit" label={`Edit ${item.name}`} onClick={() => openEdit(item)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editItem ? 'Edit Semester' : 'Create Semester'}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Academic Year</label>
            <select value={form.academic_year_id || ''} onChange={(e) => setForm({ ...form, academic_year_id: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }}>
              <option value="">Select year</option>
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
            <input type="text" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Semester Number</label>
            <select value={form.semester_number || 1} onChange={(e) => setForm({ ...form, semester_number: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }}>
              <option value={1}>Semester 1</option>
              <option value={2}>Semester 2</option>
              <option value={3}>Semester 3</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
              <input type="date" value={form.start_date || ''} onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
              <input type="date" value={form.end_date || ''} onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active || false} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            <span className="text-gray-700">Set as active semester</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function GradingScalesTab({ toast }) {
  const [items, setItems] = useState([])
  const [years, setYears] = useState([])
  const [loading, setLoading] = useState(true)
  const [yearFilter, setYearFilter] = useState('')
  const [modal, setModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  const fetch = useCallback(() => {
    setLoading(true)
    Promise.all([
      adminService.getGradingScales(yearFilter ? { academic_year_id: yearFilter } : {}),
      adminService.getAcademicYears(),
    ]).then(([gsRes, yrRes]) => {
      setItems(gsRes.data)
      setYears(yrRes.data)
    }).catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false))
  }, [toast, yearFilter])

  useEffect(() => { fetch() }, [fetch])

  const openCreate = () => {
    setEditItem(null)
    setForm({ label: '', grade_letter: 'A', min_score: '', max_score: '', grade_point: '', academic_year_id: yearFilter || '' })
    setModal(true)
  }

  const openEdit = (item) => {
    setEditItem(item)
    setForm({
      label: item.label || '',
      grade_letter: item.grade_letter || '',
      min_score: item.min_score || '',
      max_score: item.max_score || '',
      grade_point: item.grade_point || '',
    })
    setModal(true)
  }

  const handleSave = async () => {
    if (!form.label || !form.grade_letter || form.min_score === '' || form.max_score === '' || form.grade_point === '') {
      toast.warning('All fields required'); return
    }
    setSaving(true)
    try {
      if (editItem) await adminService.updateGradingScale(editItem.id, form)
      else await adminService.createGradingScale(form)
      toast.success(editItem ? 'Updated' : 'Created')
      setModal(false)
      fetch()
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete grade "${item.label}"?`)) return
    try { await adminService.deleteGradingScale(item.id); toast.success('Deleted'); fetch() }
    catch { toast.error('Failed to delete') }
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }}>
          <option value="">All years</option>
          {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
        </select>
        <Button variant="primary" onClick={openCreate}>+ Grade Band</Button>
      </div>
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff', border: '1px solid #D2D4D9' }}>
        <table className="superadmin-admin-table w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 uppercase" style={{ borderBottom: '1px solid #F0F0F2' }}>
              <th className="text-left px-5 py-3 font-semibold">Label</th>
              <th className="text-left px-5 py-3 font-semibold">Grade</th>
              <th className="text-left px-5 py-3 font-semibold">Min</th>
              <th className="text-left px-5 py-3 font-semibold">Max</th>
              <th className="text-left px-5 py-3 font-semibold">GP</th>
              <th className="text-left px-5 py-3 font-semibold">Active</th>
              <th className="text-right px-5 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">No grading scales</td></tr>
            ) : items.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50" style={{ borderBottom: '1px solid #F0F0F2' }}>
                <td className="px-5 py-3 font-medium text-gray-800">{item.label}</td>
                <td className="px-5 py-3"><span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{item.grade_letter}</span></td>
                <td className="px-5 py-3 text-gray-500">{item.min_score}</td>
                <td className="px-5 py-3 text-gray-500">{item.max_score}</td>
                <td className="px-5 py-3 text-gray-500">{item.grade_point}</td>
                <td className="px-5 py-3">
                  {item.is_active ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Active</span>
                  ) : <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <AdminActionButton icon="edit" label={`Edit ${item.label}`} onClick={() => openEdit(item)} />
                    <AdminActionButton icon="delete" tone="danger" label={`Delete ${item.label}`} onClick={() => handleDelete(item)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editItem ? 'Edit Grade Band' : 'Create Grade Band'}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
            <input type="text" value={form.label || ''} onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Grade Letter</label>
              <input type="text" value={form.grade_letter || ''} onChange={(e) => setForm({ ...form, grade_letter: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Grade Point</label>
              <input type="number" step="0.1" value={form.grade_point || ''} onChange={(e) => setForm({ ...form, grade_point: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Min Score</label>
              <input type="number" step="0.01" value={form.min_score || ''} onChange={(e) => setForm({ ...form, min_score: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Max Score</label>
              <input type="number" step="0.01" value={form.max_score || ''} onChange={(e) => setForm({ ...form, max_score: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }} />
            </div>
          </div>
          {years.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Academic Year</label>
              <select value={form.academic_year_id || ''} onChange={(e) => setForm({ ...form, academic_year_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }}>
                <option value="">All years</option>
                {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default function AcademicStructure() {
  const [activeTab, setActiveTab] = useState('years')
  const toast = useToast()

  const tabs = [
    { key: 'years', label: 'Academic Years' },
    { key: 'semesters', label: 'Semesters' },
    { key: 'grading', label: 'Grading Scales' },
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Academic Structure</h1>
        <p className="text-sm text-gray-500 mt-1">Manage academic years, semesters, and grading scales</p>
      </div>
      <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'years' && <AcademicYearsTab toast={toast} />}
      {activeTab === 'semesters' && <SemestersTab toast={toast} />}
      {activeTab === 'grading' && <GradingScalesTab toast={toast} />}
    </div>
  )
}
