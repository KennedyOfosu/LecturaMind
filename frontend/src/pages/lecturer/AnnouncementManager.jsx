import { useState, useEffect, useMemo, useCallback } from 'react'
import { announcementService } from '../../services/announcementService'
import { courseService }       from '../../services/courseService'
import { Modal }    from '../../components/ui/Modal'
import { Button }   from '../../components/ui/Button'
import { Spinner }  from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'

/* ── constants ── */

const COLUMNS = [
  { key: 'draft',     label: 'Drafts' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'published', label: 'Published' },
  { key: 'archived',  label: 'Archived' },
]

const ACCENT = {
  draft: {
    headerBg: 'bg-violet-50',
    headerBorder: 'border-violet-200',
    headerText: 'text-violet-800',
    countBg: 'bg-violet-100',
    countText: 'text-violet-600',
    cardBorder: 'border-l-violet-400',
    accent: 'text-violet-500',
    lightBg: 'bg-violet-50/40',
    dotColor: '#8B5CF6',
  },
  scheduled: {
    headerBg: 'bg-blue-50',
    headerBorder: 'border-blue-200',
    headerText: 'text-blue-800',
    countBg: 'bg-blue-100',
    countText: 'text-blue-600',
    cardBorder: 'border-l-blue-400',
    accent: 'text-blue-500',
    lightBg: 'bg-blue-50/40',
    dotColor: '#3B82F6',
  },
  published: {
    headerBg: 'bg-emerald-50',
    headerBorder: 'border-emerald-200',
    headerText: 'text-emerald-800',
    countBg: 'bg-emerald-100',
    countText: 'text-emerald-600',
    cardBorder: 'border-l-emerald-400',
    accent: 'text-emerald-500',
    lightBg: 'bg-emerald-50/40',
    dotColor: '#10B981',
  },
  archived: {
    headerBg: 'bg-gray-50',
    headerBorder: 'border-gray-200',
    headerText: 'text-gray-700',
    countBg: 'bg-gray-100',
    countText: 'text-gray-500',
    cardBorder: 'border-l-gray-300',
    accent: 'text-gray-400',
    lightBg: 'bg-gray-50/40',
    dotColor: '#9CA3AF',
  },
}

const PRIORITY_STYLES = {
  high:   { label: 'High',   bg: 'bg-red-50 text-red-700 border border-red-200' },
  medium: { label: 'Medium', bg: 'bg-amber-50 text-amber-700 border border-amber-200' },
  low:    { label: 'Low',    bg: 'bg-blue-50 text-blue-700 border border-blue-200' },
}

/* ── helpers ── */

const AVATAR_COLORS = ['#EF4444','#F59E0B','#10B981','#3B82F6','#8B5CF6','#EC4899','#14B8A6','#F97316']

function colorFromName(name) {
  if (!name) return AVATAR_COLORS[0]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitials(name) {
  if (!name) return '?'
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function toInputValue(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/* ── icons ── */

const PlusIcon = ({ className = '' }) => (
  <svg className={className} width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)
const DotsIcon = ({ className = '' }) => (
  <svg className={className} width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="12" cy="5" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="19" r="1.5" fill="currentColor"/>
  </svg>
)
const EditIcon = () => (
  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)
const TrashIcon = () => (
  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
)
const ArchiveIcon = () => (
  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/>
  </svg>
)
const CommentIcon = () => (
  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
  </svg>
)
const EyeIcon = () => (
  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
)
const PaperclipIcon = () => (
  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
  </svg>
)

/* ── avatar stack ── */

function AvatarStack({ students = [], max = 3 }) {
  const visible = students.slice(0, max)
  const remainder = students.length - max
  return (
    <div className="flex items-center -space-x-2">
      {visible.map((s, i) => (
        <div
          key={s.id || i}
          title={s.name || 'Student'}
          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-white shadow-sm"
          style={{ backgroundColor: colorFromName(s.name || ''), zIndex: max - i }}
        >
          {getInitials(s.name)}
        </div>
      ))}
      {remainder > 0 && (
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold bg-gray-100 text-gray-600 ring-2 ring-white shadow-sm">
          +{remainder}
        </div>
      )}
    </div>
  )
}

/* ── priority badge ── */

function PriorityBadge({ priority }) {
  const style = PRIORITY_STYLES[priority] || PRIORITY_STYLES.medium
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold leading-tight ${style.bg}`}>
      {style.label}
    </span>
  )
}

/* ── status dot ── */

function StatusDot({ status }) {
  const a = ACCENT[status]
  return (
    <span
      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{ backgroundColor: a?.dotColor || '#9CA3AF' }}
    />
  )
}

/* ── announcement card ── */

function AnnouncementCard({ announcement, onEdit, onDelete, onArchive, onDragStart, accent }) {
  const { id, title, content, priority, status, posted_at, courses } = announcement
  const courseName = courses?.course_name || 'Course'
  const courseCode = courses?.course_code || ''

  const handleDragStart = (e) => {
    e.dataTransfer.setData('text/plain', id)
    e.dataTransfer.effectAllowed = 'move'
    if (onDragStart) onDragStart(id)
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={`group bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-grab active:cursor-grabbing select-none ${accent.cardBorder} border-l-4`}
    >
      {/* Top row: priority + course + menu */}
      <div className="flex items-center justify-between px-3.5 pt-3 pb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <PriorityBadge priority={priority} />
          <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded truncate max-w-[120px]">
            {courseCode || courseName}
          </span>
        </div>
        <div className="relative flex items-center flex-shrink-0 ml-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              const menu = e.currentTarget.nextElementSibling
              if (menu) menu.classList.toggle('hidden')
            }}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <DotsIcon />
          </button>
          <div className="hidden absolute right-0 top-full mt-1 z-20 w-36 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
            <button onClick={() => onEdit(announcement)} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
              <EditIcon /> Edit
            </button>
            {status !== 'archived' && (
              <button onClick={() => onArchive(announcement)} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
                <ArchiveIcon /> Archive
              </button>
            )}
            <button onClick={() => onDelete(announcement)} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors">
              <TrashIcon /> Delete
            </button>
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="px-3.5 py-1">
        <h3 className="text-[15px] font-semibold text-gray-900 leading-snug">{title}</h3>
      </div>

      {/* Preview */}
      <div className="px-3.5 pb-1.5">
        <p className="text-[13px] text-gray-600 leading-relaxed line-clamp-2">{content}</p>
      </div>

      {/* Bottom: avatars + date + stats */}
      <div className="flex items-center justify-between px-3.5 pb-3 pt-0.5 border-t border-gray-100 mt-2">
        <AvatarStack students={announcement._students || []} max={3} />
        <div className="flex items-center gap-2.5 text-[11px] text-gray-400 ml-auto">
          {posted_at && <span className="text-gray-500">{fmtDate(posted_at)}</span>}
          <span className="flex items-center gap-1" title="Views"><EyeIcon /> 0</span>
          <span className="flex items-center gap-1" title="Comments"><CommentIcon /> 0</span>
          <span className="flex items-center gap-1" title="Attachments"><PaperclipIcon /> 0</span>
        </div>
      </div>
    </div>
  )
}

/* ── kanban column ── */

function KanbanColumn({ column, announcements, accent, onEdit, onDelete, onArchive, onDrop, onDragStart }) {
  const [dropOver, setDropOver] = useState(false)

  const columnClasses = [
    'flex flex-col rounded-xl border min-h-[420px] transition-all duration-200 bg-white',
    accent.headerBorder,
    dropOver ? 'border-gray-400 shadow-lg' : 'shadow-sm',
  ].join(' ')

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropOver(true)
  }

  const handleDragLeave = () => setDropOver(false)

  const handleDrop = (e) => {
    e.preventDefault()
    setDropOver(false)
    const id = e.dataTransfer.getData('text/plain')
    if (id) onDrop(id, column.key)
  }

  return (
    <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} className={columnClasses}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 rounded-t-xl border-b ${accent.headerBg} ${accent.headerBorder}`}>
        <div className="flex items-center gap-2">
          <StatusDot status={column.key} />
          <h2 className={`text-sm font-semibold ${accent.headerText}`}>{column.label}</h2>
          <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${accent.countBg} ${accent.countText}`}>
            {announcements.length}
          </span>
        </div>
        <button
          onClick={() => onEdit({ _create: true, _column: column.key })}
          className={`p-1.5 rounded-lg hover:bg-white/60 transition-colors ${accent.accent} hover:opacity-80`}
          title={`New ${column.label}`}
        >
          <PlusIcon />
        </button>
      </div>

      {/* Cards */}
      <div className={`flex-1 overflow-y-auto p-3 space-y-3 ${accent.lightBg} rounded-b-xl`}>
        {announcements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${accent.countBg}`}>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className={accent.countText}>
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            </div>
            <p className={`text-sm font-medium ${accent.headerText}`}>No {column.label.toLowerCase()}</p>
            <p className="text-xs text-gray-400 mt-1">Drag announcements here</p>
          </div>
        ) : (
          announcements.map((a) => (
            <AnnouncementCard
              key={a.id}
              announcement={a}
              accent={accent}
              onEdit={onEdit}
              onDelete={onDelete}
              onArchive={onArchive}
              onDragStart={onDragStart}
            />
          ))
        )}
      </div>
    </div>
  )
}

/* ── main component ── */

export default function AnnouncementManager() {
  const toast = useToast()

  const [courses,          setCourses]       = useState([])
  const [announcements,    setAnnouncements] = useState([])
  const [loading,          setLoading]       = useState(true)
  const [courseFilter,     setCourseFilter]  = useState('all')
  const [modalState,       setModalState]    = useState({ type: null, item: null })
  const [form,             setForm]          = useState({ title: '', content: '', event_date: '', status: 'draft', priority: 'medium', course_id: '' })
  const [saving,           setSaving]        = useState(false)
  const [deleteTarget,     setDeleteTarget]  = useState(null)
  const [deleting,         setDeleting]      = useState(false)

  /* ── data fetching ── */

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

  /* ── filter + group into columns ── */

  const filtered = useMemo(() => {
    let list = announcements
    if (courseFilter !== 'all') list = list.filter((a) => a.course_id === courseFilter)
    return list
  }, [announcements, courseFilter])

  const grouped = useMemo(() => {
    const map = { draft: [], scheduled: [], published: [], archived: [] }
    for (const a of filtered) {
      let status = a.status || 'published'
      if (status === 'published' && a.posted_at && new Date(a.posted_at) > new Date()) status = 'scheduled'
      if (a.is_archived) status = 'archived'
      if (!map[status]) map[status] = []
      map[status].push(a)
    }
    return map
  }, [filtered])

  /* ── drag and drop ── */

  const handleDrop = useCallback(async (announcementId, newStatus) => {
    if (newStatus === 'archived') {
      try {
        await announcementService.update(announcementId, { is_archived: true, status: 'archived' })
        setAnnouncements((prev) => prev.map((a) => a.id === announcementId ? { ...a, is_archived: true, status: 'archived' } : a))
        toast.success('Announcement archived')
      } catch { toast.error('Failed to archive announcement') }
      return
    }

    try {
      await announcementService.update(announcementId, { status: newStatus })
      setAnnouncements((prev) => prev.map((a) => a.id === announcementId ? { ...a, status: newStatus, is_archived: false } : a))
    } catch { toast.error('Failed to move announcement') }
  }, [toast])

  /* ── CRUD ── */

  const openEdit = (item) => {
    if (item._create) {
      setForm({
        title: '',
        content: '',
        event_date: '',
        status: item._column || 'draft',
        priority: 'medium',
        course_id: courseFilter !== 'all' ? courseFilter : (courses[0]?.id || ''),
      })
      setModalState({ type: 'create', item: null })
    } else {
      setForm({
        title: item.title || '',
        content: item.content || '',
        event_date: toInputValue(item.posted_at),
        status: item.status || 'published',
        priority: item.priority || 'medium',
        course_id: item.course_id || '',
      })
      setModalState({ type: 'edit', item })
    }
  }

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) { toast.error('Title and content are required'); return }
    if (modalState.type === 'create' && !form.course_id) { toast.error('Please select a course'); return }
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        content: form.content.trim(),
        status: form.status,
        priority: form.priority,
        event_date: form.event_date ? new Date(form.event_date).toISOString() : undefined,
      }
      if (modalState.type === 'create') {
        await announcementService.create({ course_id: form.course_id, ...payload })
        toast.success('Announcement created.')
      } else {
        await announcementService.update(modalState.item.id, payload)
        toast.success('Announcement updated.')
      }
      setModalState({ type: null, item: null })
      fetchAll()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed')
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await announcementService.delete(deleteTarget.id)
      toast.info('Announcement deleted.')
      setAnnouncements((p) => p.filter((a) => a.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch { toast.error('Could not delete announcement.') }
    finally { setDeleting(false) }
  }

  const handleArchive = async (item) => {
    try {
      await announcementService.update(item.id, { is_archived: true, status: 'archived' })
      setAnnouncements((prev) => prev.map((a) => a.id === item.id ? { ...a, is_archived: true, status: 'archived' } : a))
      toast.success('Announcement archived')
    } catch { toast.error('Failed to archive') }
  }

  /* ── render ── */

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage and monitor announcements across your courses</p>
        </div>
      </div>

      {/* Course filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {[{ id: 'all', label: 'All Courses' }, ...courses.map((c) => ({ id: c.id, label: c.course_name }))].map((tab) => (
          <button key={tab.id} onClick={() => setCourseFilter(tab.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-all ${
              courseFilter === tab.id
                ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-800'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Kanban board */}
      {loading ? (
        <div className="flex justify-center py-24"><Spinner size="lg" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.key}
              column={col}
              accent={ACCENT[col.key]}
              announcements={grouped[col.key] || []}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
              onArchive={handleArchive}
              onDrop={handleDrop}
            />
          ))}
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      <Modal
        isOpen={!!modalState.type}
        onClose={() => setModalState({ type: null, item: null })}
        title={modalState.type === 'create' ? 'New Announcement' : 'Edit Announcement'}
        maxWidth="max-w-2xl"
      >
        <div className="flex flex-col gap-4">
          {modalState.type === 'create' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Course</label>
              <select value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900">
                <option value="">Select course</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.course_name}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900">
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Priority</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Title</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Announcement title"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Content</label>
            <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={5} placeholder="Write your announcement here..."
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 resize-none" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">
              Schedule date <span className="text-gray-400 font-normal normal-case">(optional)</span>
            </label>
            <input type="datetime-local" value={form.event_date}
              onChange={(e) => setForm({ ...form, event_date: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900" />
          </div>

          <Button variant="teal" onClick={handleSave} loading={saving} className="w-full mt-2">
            {modalState.type === 'create' ? 'Create Announcement' : 'Save Changes'}
          </Button>
        </div>
      </Modal>

      {/* ── Delete confirmation ── */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Announcement">
        <div className="flex flex-col gap-5">
          <p className="text-gray-700 text-sm">
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
