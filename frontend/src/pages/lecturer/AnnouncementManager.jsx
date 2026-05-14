/**
 * AnnouncementManager.jsx — Table-style announcement management.
 * Reference design: clean rows with initials badge, status badge, icon controls.
 */

import { useState, useEffect, useMemo } from 'react'
import { announcementService } from '../../services/announcementService'
import { courseService }       from '../../services/courseService'
import { Modal }    from '../../components/ui/Modal'
import { Button }   from '../../components/ui/Button'
import { Spinner }  from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'

const PAGE_SIZE = 10

/* ── helpers ── */
function fmtDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function toInputValue(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function isUpcoming(iso) {
  if (!iso) return false
  return new Date(iso) > new Date()
}

function courseInitials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'AN'
}

/* ── icons ── */
const EditIcon = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)
const TrashIcon = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/>
    <path d="M9 6V4h6v2"/>
  </svg>
)
const ChevronLeft = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
)
const ChevronRight = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
)

/* ── status badge ── */
function StatusBadge({ iso }) {
  const upcoming = isUpcoming(iso)
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
      upcoming ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${upcoming ? 'bg-blue-400' : 'bg-emerald-400'}`} />
      {upcoming ? 'Upcoming' : 'Posted'}
    </span>
  )
}

/* ── empty row ── */
function EmptyRow() {
  return (
    <tr>
      <td colSpan={6} className="py-16 text-center">
        <p className="text-gray-400 text-sm">No announcements for this filter.</p>
        <p className="text-gray-300 text-xs mt-1">Post your first announcement using the button above.</p>
      </td>
    </tr>
  )
}

/* ── pagination ── */
function Pagination({ page, total, pageSize, onChange }) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null

  const pages = []
  for (let i = 1; i <= Math.min(totalPages, 5); i++) pages.push(i)
  if (totalPages > 5) pages.push('…', totalPages)

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
      <button
        onClick={() => onChange(page - 1)} disabled={page === 1}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-colors">
        <ChevronLeft /> Prev
      </button>
      <div className="flex items-center gap-1">
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-gray-400 text-sm">…</span>
          ) : (
            <button key={p} onClick={() => onChange(p)}
              className={`h-8 w-8 rounded-lg text-sm font-medium transition-colors ${
                p === page ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}>
              {p}
            </button>
          )
        )}
      </div>
      <button
        onClick={() => onChange(page + 1)} disabled={page === totalPages}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-colors">
        Next <ChevronRight />
      </button>
    </div>
  )
}

/* ── main component ── */
export default function AnnouncementManager() {
  const toast = useToast()

  const [courses,       setCourses]       = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [loading,       setLoading]       = useState(true)
  const [courseFilter,  setCourseFilter]  = useState('all')
  const [page,          setPage]          = useState(1)
  const [modalState,    setModalState]    = useState({ type: null, item: null })
  const [form,          setForm]          = useState({ title: '', content: '', event_date: '' })
  const [saving,        setSaving]        = useState(false)
  const [deleteTarget,  setDeleteTarget]  = useState(null)
  const [deleting,      setDeleting]      = useState(false)

  /* fetch everything once */
  const fetchAll = () => {
    setLoading(true)
    Promise.all([
      courseService.getMyCourses(),
      announcementService.getAll(),
    ]).then(([cRes, aRes]) => {
      setCourses(cRes.data || [])
      setAnnouncements(aRes.data || [])
    }).catch(() => toast.error('Failed to load announcements'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchAll() }, [])

  /* filtered + paginated */
  const filtered = useMemo(() => {
    if (courseFilter === 'all') return announcements
    return announcements.filter((a) => a.course_id === courseFilter)
  }, [announcements, courseFilter])

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  /* reset page when filter changes */
  useEffect(() => setPage(1), [courseFilter])

  /* modal helpers */
  const openCreate = () => {
    setForm({ title: '', content: '', event_date: '' })
    setModalState({ type: 'create', item: null })
  }
  const openEdit = (item) => {
    setForm({ title: item.title, content: item.content, event_date: toInputValue(item.posted_at) })
    setModalState({ type: 'edit', item })
  }

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) { toast.error('Title and content are required'); return }
    setSaving(true)
    try {
      const payload = {
        title:      form.title.trim(),
        content:    form.content.trim(),
        event_date: form.event_date ? new Date(form.event_date).toISOString() : undefined,
      }
      if (modalState.type === 'create') {
        await announcementService.create({ course_id: courseFilter !== 'all' ? courseFilter : courses[0]?.id, ...payload })
        toast.success('Announcement posted!')
      } else {
        await announcementService.update(modalState.item.id, payload)
        toast.success('Announcement updated!')
      }
      setModalState({ type: null, item: null })
      fetchAll()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save')
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await announcementService.delete(deleteTarget.id)
      toast.success('Deleted')
      setAnnouncements((p) => p.filter((a) => a.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch { toast.error('Failed to delete') }
    finally { setDeleting(false) }
  }

  /* course name lookup */
  const courseName = (id) => courses.find((c) => c.id === id)?.course_name || 'Unknown Course'

  return (
    <div className="flex flex-col gap-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
          <p className="text-gray-500 text-sm mt-1">Post updates and notifications to your students</p>
        </div>
        <Button variant="teal" onClick={openCreate}>+ New Announcement</Button>
      </div>

      {/* ── Course filter tabs ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {[{ id: 'all', label: 'All Courses' }, ...courses.map((c) => ({ id: c.id, label: c.course_name }))].map((tab) => (
          <button key={tab.id} onClick={() => setCourseFilter(tab.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
              courseFilter === tab.id
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Table card ── */}
      <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>

        {loading ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: '#F3F4F6', backgroundColor: '#FAFAFA' }}>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-10"></th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Title</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Content</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Course</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Date & Time</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {!paginated.length ? <EmptyRow /> : paginated.map((a) => {
                    const cname = (a.courses?.course_name) || courseName(a.course_id)
                    const ccode = a.courses?.course_code || ''
                    return (
                      <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                        {/* Initials badge */}
                        <td className="px-5 py-3.5">
                          <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                            style={{ backgroundColor: '#374151' }}>
                            {courseInitials(cname)}
                          </div>
                        </td>

                        {/* Title */}
                        <td className="px-4 py-3.5 max-w-[180px]">
                          <p className="font-semibold text-gray-900 truncate">{a.title}</p>
                        </td>

                        {/* Content */}
                        <td className="px-4 py-3.5 max-w-[220px]">
                          <p className="text-gray-500 truncate">{a.content}</p>
                        </td>

                        {/* Course */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {ccode || cname}
                          </span>
                        </td>

                        {/* Date & Time */}
                        <td className="px-4 py-3.5 whitespace-nowrap text-gray-500">
                          {fmtDateTime(a.posted_at)}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5">
                          <StatusBadge iso={a.posted_at} />
                        </td>

                        {/* Controls */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <button onClick={() => openEdit(a)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                              title="Edit">
                              <EditIcon />
                            </button>
                            <button onClick={() => setDeleteTarget(a)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              title="Delete">
                              <TrashIcon />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
          </>
        )}
      </div>

      {/* ── Create / Edit Modal ── */}
      <Modal
        isOpen={!!modalState.type}
        onClose={() => setModalState({ type: null, item: null })}
        title={modalState.type === 'create' ? 'New Announcement' : 'Edit Announcement'}
        maxWidth="max-w-2xl">
        <div className="flex flex-col gap-4">

          {/* Course selector (create only) */}
          {modalState.type === 'create' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Course</label>
              <select
                value={courseFilter !== 'all' ? courseFilter : (courses[0]?.id || '')}
                onChange={(e) => setCourseFilter(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300">
                {courses.map((c) => <option key={c.id} value={c.id}>{c.course_name}</option>)}
              </select>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Announcement title"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Content</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={5}
              placeholder="Write your announcement here…"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none"
            />
          </div>

          {/* Date & Time picker */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Date &amp; Time <span className="text-gray-300 font-normal">(optional — attach a date to this announcement)</span>
            </label>
            <input
              type="datetime-local"
              value={form.event_date}
              onChange={(e) => setForm({ ...form, event_date: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
            <p className="text-xs text-gray-400 mt-1">
              If set to a future date, the announcement shows as <strong>Upcoming</strong> in the table.
            </p>
          </div>

          <Button variant="teal" onClick={handleSave} loading={saving} className="w-full mt-1">
            {modalState.type === 'create' ? 'Post Announcement' : 'Save Changes'}
          </Button>
        </div>
      </Modal>

      {/* ── Delete confirmation ── */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Announcement">
        <div className="flex flex-col gap-5">
          <p className="text-gray-600 text-sm">
            Are you sure you want to delete <strong>"{deleteTarget?.title}"</strong>? This cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="flex-1">Cancel</Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting} className="flex-1">Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
