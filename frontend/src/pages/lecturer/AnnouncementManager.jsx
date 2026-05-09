/**
 * AnnouncementManager.jsx — Post, edit, and delete course announcements.
 */

import { useState, useEffect } from 'react'
import { courseService } from '../../services/courseService'
import { announcementService } from '../../services/announcementService'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'
import { formatDate } from '../../utils/formatDate'
import { truncateText } from '../../utils/truncateText'

export default function AnnouncementManager() {
  const toast = useToast()
  const [courses, setCourses] = useState([])
  const [selectedCourse, setSelectedCourse] = useState('')
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalState, setModalState] = useState({ type: null, item: null })
  const [form, setForm] = useState({ title: '', content: '' })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    courseService.getMyCourses().then((res) => {
      setCourses(res.data)
      if (res.data.length) setSelectedCourse(res.data[0].id)
    })
  }, [])

  useEffect(() => {
    if (!selectedCourse) return
    setLoading(true)
    announcementService.getByCourse(selectedCourse)
      .then((res) => setAnnouncements(res.data))
      .finally(() => setLoading(false))
  }, [selectedCourse])

  const openCreate = () => {
    setForm({ title: '', content: '' })
    setModalState({ type: 'create' })
  }

  const openEdit = (item) => {
    setForm({ title: item.title, content: item.content })
    setModalState({ type: 'edit', item })
  }

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Title and content are required')
      return
    }
    setSaving(true)
    try {
      if (modalState.type === 'create') {
        await announcementService.create({ course_id: selectedCourse, ...form })
        toast.success('Announcement posted!')
      } else {
        await announcementService.update(modalState.item.id, form)
        toast.success('Announcement updated!')
      }
      const res = await announcementService.getByCourse(selectedCourse)
      setAnnouncements(res.data)
      setModalState({ type: null })
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await announcementService.delete(deleteTarget.id)
      toast.success('Announcement deleted')
      setAnnouncements((prev) => prev.filter((a) => a.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch {
      toast.error('Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Announcements</h1>
          <p className="text-gray-500 text-sm mt-1">Post updates and notifications to your students</p>
        </div>
        <Button variant="teal" onClick={openCreate}>+ New Announcement</Button>
      </div>

      {/* Course selector */}
      <div>
        <select
          value={selectedCourse}
          onChange={(e) => setSelectedCourse(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50"
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.course_name} ({c.course_code})</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : !announcements.length ? (
        <EmptyState icon="📢" title="No announcements yet" description="Post your first announcement for this course" action={<Button variant="teal" onClick={openCreate}>+ New Announcement</Button>} />
      ) : (
        <div className="flex flex-col gap-4">
          {announcements.map((a) => (
            <Card key={a.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-navy">{a.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{truncateText(a.content, 100)}</p>
                  <p className="text-xs text-gray-400 mt-2">Posted {formatDate(a.posted_at)}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(a)}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => setDeleteTarget(a)}>Delete</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={!!modalState.type} onClose={() => setModalState({ type: null })} title={modalState.type === 'create' ? 'New Announcement' : 'Edit Announcement'} maxWidth="max-w-2xl">
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Announcement title"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Content</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={6}
              placeholder="Write your announcement here…"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50 resize-none"
            />
          </div>
          <Button variant="teal" onClick={handleSave} loading={saving} className="w-full">
            {modalState.type === 'create' ? 'Post Announcement' : 'Save Changes'}
          </Button>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Announcement">
        <div className="flex flex-col gap-5">
          <p className="text-gray-600 text-sm">Are you sure you want to delete <strong>{deleteTarget?.title}</strong>?</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="flex-1">Cancel</Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting} className="flex-1">Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
