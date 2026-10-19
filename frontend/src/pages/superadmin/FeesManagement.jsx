import { useState, useEffect, useCallback } from 'react'
import { adminService } from '../../services/adminService'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { AdminActionButton } from '../../components/ui/AdminActionButton'
import { FEE_STATUSES, PAYMENT_METHODS } from '../../utils/constants'

const TAB_COLORS = {
  active: 'bg-white text-gray-900 shadow-sm',
  inactive: 'text-gray-500 hover:text-gray-700',
}

function FeeRecordsTab({ toast }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [modal, setModal] = useState(false)
  const [students, setStudents] = useState([])
  const [feeTypes, setFeeTypes] = useState([])
  const [years, setYears] = useState([])
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  const fetch = useCallback(() => {
    setLoading(true)
    const params = {}
    if (statusFilter) params.status = statusFilter
    adminService.getFees(params)
      .then((r) => setRecords(r.data))
      .catch(() => toast.error('Failed to load fees'))
      .finally(() => setLoading(false))
  }, [toast, statusFilter])

  useEffect(() => { fetch() }, [fetch])

  const openCreate = async () => {
    try {
      const [stuRes, ftRes, yrRes] = await Promise.all([
        adminService.getUsers({ role: 'student' }),
        adminService.getFeeTypes(),
        adminService.getAcademicYears(),
      ])
      setStudents(stuRes.data)
      setFeeTypes(ftRes.data)
      setYears(yrRes.data)
    } catch {}
    setForm({ student_id: '', fee_type_id: '', total_amount: '', due_date: '', academic_year_id: '' })
    setModal(true)
  }

  const handleCreate = async () => {
    if (!form.student_id || !form.fee_type_id || !form.total_amount) { toast.warning('Fill required fields'); return }
    setSaving(true)
    try {
      await adminService.createFee(form)
      toast.success('Fee record created')
      setModal(false)
      fetch()
    } catch { toast.error('Failed to create') }
    finally { setSaving(false) }
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-lg p-1" style={{ backgroundColor: '#E5E7EB' }}>
          {['', ...FEE_STATUSES].map((s) => (
            <button key={s || 'all'} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${statusFilter === s ? TAB_COLORS.active : TAB_COLORS.inactive}`}>
              {s || 'All'}
            </button>
          ))}
        </div>
        <Button variant="primary" onClick={openCreate}>+ New Fee Record</Button>
      </div>
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff', border: '1px solid #D2D4D9' }}>
        <table className="superadmin-admin-table w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 uppercase" style={{ borderBottom: '1px solid #F0F0F2' }}>
              <th className="text-left px-5 py-3 font-semibold">Student</th>
              <th className="text-left px-5 py-3 font-semibold">Fee Type</th>
              <th className="text-left px-5 py-3 font-semibold">Total</th>
              <th className="text-left px-5 py-3 font-semibold">Paid</th>
              <th className="text-left px-5 py-3 font-semibold">Balance</th>
              <th className="text-left px-5 py-3 font-semibold">Status</th>
              <th className="text-left px-5 py-3 font-semibold">Due Date</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">No fee records</td></tr>
            ) : records.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50" style={{ borderBottom: '1px solid #F0F0F2' }}>
                <td className="px-5 py-3 font-medium text-gray-800">{r.profiles?.full_name || 'Unknown'}</td>
                <td className="px-5 py-3 text-gray-500">{r.fee_types?.name || '-'}</td>
                <td className="px-5 py-3 text-gray-800 font-medium">GH&#x20b5;{r.total_amount?.toFixed(2)}</td>
                <td className="px-5 py-3 text-gray-600">GH&#x20b5;{(r.amount_paid || 0)?.toFixed(2)}</td>
                <td className="px-5 py-3 font-medium" style={{ color: (r.balance || 0) > 0 ? '#dc2626' : '#16a34a' }}>
                  GH&#x20b5;{(r.balance || 0).toFixed(2)}
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    r.status === 'paid' ? 'bg-green-100 text-green-700' :
                    r.status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                    r.status === 'overpaid' ? 'bg-blue-100 text-blue-700' :
                    r.status === 'waived' ? 'bg-gray-100 text-gray-500' :
                    'bg-red-100 text-red-700'
                  }`}>{r.status}</span>
                </td>
                <td className="px-5 py-3 text-gray-500 text-xs">{r.due_date || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title="Create Fee Record" size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Student</label>
            <select value={form.student_id || ''} onChange={(e) => setForm({ ...form, student_id: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }}>
              <option value="">Select student</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.user_id_number})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fee Type</label>
            <select value={form.fee_type_id || ''} onChange={(e) => setForm({ ...form, fee_type_id: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }}>
              <option value="">Select fee type</option>
              {feeTypes.map((ft) => <option key={ft.id} value={ft.id}>{ft.name} (GH&#x20b5;{ft.amount})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Total Amount (GH&#x20b5;)</label>
              <input type="number" step="0.01" value={form.total_amount || ''} onChange={(e) => setForm({ ...form, total_amount: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Due Date</label>
              <input type="date" value={form.due_date || ''} onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Academic Year</label>
            <select value={form.academic_year_id || ''} onChange={(e) => setForm({ ...form, academic_year_id: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }}>
              <option value="">Select year</option>
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} loading={saving}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function FeeTypesTab({ toast }) {
  const [items, setItems] = useState([])
  const [years, setYears] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  const fetch = useCallback(() => {
    setLoading(true)
    Promise.all([
      adminService.getFeeTypes(),
      adminService.getAcademicYears(),
    ]).then(([ftRes, yrRes]) => { setItems(ftRes.data); setYears(yrRes.data) })
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false))
  }, [toast])

  useEffect(() => { fetch() }, [fetch])

  const openCreate = () => {
    setForm({ name: '', description: '', amount: '', academic_year_id: '', is_compulsory: true })
    setModal(true)
  }

  const handleCreate = async () => {
    if (!form.name || !form.amount) { toast.warning('Name and amount required'); return }
    setSaving(true)
    try { await adminService.createFeeType(form); toast.success('Fee type created'); setModal(false); fetch() }
    catch { toast.error('Failed') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this fee type?')) return
    try { await adminService.deleteFeeType(id); toast.success('Deleted'); fetch() }
    catch { toast.error('Failed') }
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button variant="primary" onClick={openCreate}>+ Fee Type</Button></div>
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff', border: '1px solid #D2D4D9' }}>
        <table className="superadmin-admin-table w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 uppercase" style={{ borderBottom: '1px solid #F0F0F2' }}>
              <th className="text-left px-5 py-3 font-semibold">Name</th>
              <th className="text-left px-5 py-3 font-semibold">Amount</th>
              <th className="text-left px-5 py-3 font-semibold">Compulsory</th>
              <th className="text-right px-5 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-8 text-gray-400">No fee types</td></tr>
            ) : items.map((ft) => (
              <tr key={ft.id} className="hover:bg-gray-50" style={{ borderBottom: '1px solid #F0F0F2' }}>
                <td className="px-5 py-3 font-medium text-gray-800">{ft.name}</td>
                <td className="px-5 py-3 font-medium text-gray-800">GH&#x20b5;{ft.amount?.toFixed(2)}</td>
                <td className="px-5 py-3">
                  {ft.is_compulsory ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Compulsory</span>
                  ) : <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Optional</span>}
                </td>
                <td className="px-5 py-3 text-right">
                  <AdminActionButton icon="delete" tone="danger" label={`Delete fee type ${ft.name}`} onClick={() => handleDelete(ft.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title="Create Fee Type">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
            <input type="text" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm border" rows={2} style={{ borderColor: '#D2D4D9' }} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Amount (GH&#x20b5;)</label>
            <input type="number" step="0.01" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Academic Year</label>
              <select value={form.academic_year_id || ''} onChange={(e) => setForm({ ...form, academic_year_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }}>
                <option value="">Select year</option>
                {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_compulsory || false} onChange={(e) => setForm({ ...form, is_compulsory: e.target.checked })} />
                <span className="text-gray-700">Compulsory</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} loading={saving}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function PaymentsTab({ toast }) {
  const [payments, setPayments] = useState([])
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  const fetch = useCallback(() => {
    setLoading(true)
    Promise.all([
      adminService.getPayments(),
      adminService.getFees(),
    ]).then(([payRes, feeRes]) => { setPayments(payRes.data); setRecords(feeRes.data) })
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false))
  }, [toast])

  useEffect(() => { fetch() }, [fetch])

  const openModal = () => {
    setForm({ fee_record_id: '', amount: '', payment_method: 'cash', reference: '', notes: '' })
    setModal(true)
  }

  const handleRecord = async () => {
    if (!form.fee_record_id || !form.amount) { toast.warning('Fee record and amount required'); return }
    setSaving(true)
    try { await adminService.recordPayment(form); toast.success('Payment recorded'); setModal(false); fetch() }
    catch { toast.error('Failed') }
    finally { setSaving(false) }
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button variant="primary" onClick={openModal}>+ Record Payment</Button></div>
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff', border: '1px solid #D2D4D9' }}>
        <table className="superadmin-admin-table w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 uppercase" style={{ borderBottom: '1px solid #F0F0F2' }}>
              <th className="text-left px-5 py-3 font-semibold">Date</th>
              <th className="text-left px-5 py-3 font-semibold">Amount</th>
              <th className="text-left px-5 py-3 font-semibold">Method</th>
              <th className="text-left px-5 py-3 font-semibold">Reference</th>
              <th className="text-left px-5 py-3 font-semibold">Recorded By</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">No payments recorded</td></tr>
            ) : payments.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50" style={{ borderBottom: '1px solid #F0F0F2' }}>
                <td className="px-5 py-3 text-gray-500 text-xs">{new Date(p.payment_date).toLocaleDateString()}</td>
                <td className="px-5 py-3 font-medium text-gray-800">GH&#x20b5;{p.amount?.toFixed(2)}</td>
                <td className="px-5 py-3">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{p.payment_method}</span>
                </td>
                <td className="px-5 py-3 text-gray-500">{p.reference || '-'}</td>
                <td className="px-5 py-3 text-gray-500">{p.profiles?.full_name || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title="Record Payment">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fee Record</label>
            <select value={form.fee_record_id || ''} onChange={(e) => setForm({ ...form, fee_record_id: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }}>
              <option value="">Select fee record</option>
              {records.filter((r) => r.status !== 'paid' && r.status !== 'overpaid').map((r) => (
                <option key={r.id} value={r.id}>
                  {r.profiles?.full_name} — GH&#x20b5;{r.total_amount?.toFixed(2)} (Balance: GH&#x20b5;{(r.balance || 0)?.toFixed(2)})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Amount (GH&#x20b5;)</label>
              <input type="number" step="0.01" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
              <select value={form.payment_method || 'cash'} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }}>
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Reference</label>
            <input type="text" value={form.reference || ''} onChange={(e) => setForm({ ...form, reference: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#D2D4D9' }} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm border" rows={2} style={{ borderColor: '#D2D4D9' }} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleRecord} loading={saving}>Record</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default function FeesManagement() {
  const [activeTab, setActiveTab] = useState('records')
  const toast = useToast()

  const tabs = [
    { key: 'records', label: 'Fee Records' },
    { key: 'types', label: 'Fee Types' },
    { key: 'payments', label: 'Payments' },
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Fees & Payments</h1>
        <p className="text-sm text-gray-500 mt-1">Track student fee balances, record payments, and manage fee types</p>
      </div>
      <div className="flex gap-1 rounded-lg p-1" style={{ backgroundColor: '#E5E7EB' }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === t.key ? TAB_COLORS.active : TAB_COLORS.inactive}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'records' && <FeeRecordsTab toast={toast} />}
      {activeTab === 'types' && <FeeTypesTab toast={toast} />}
      {activeTab === 'payments' && <PaymentsTab toast={toast} />}
    </div>
  )
}
