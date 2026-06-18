/**
 * AnnouncementsView.jsx - Grouped student announcements with in-page preview.
 */

import { useState, useEffect, useMemo } from 'react'
import { announcementService } from '../../services/announcementService'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { formatDate, formatDateTime } from '../../utils/formatDate'

const PRIORITY_WORDS = [
  'urgent',
  'important',
  'deadline',
  'exam',
  'test',
  'quiz',
  'assignment',
  'submission',
]

function isUpcoming(announcement) {
  if (!announcement?.posted_at) return false
  return new Date(announcement.posted_at).getTime() > Date.now()
}

function isPriority(announcement) {
  const text = `${announcement?.title || ''} ${announcement?.content || ''}`.toLowerCase()
  return isUpcoming(announcement) || PRIORITY_WORDS.some((word) => text.includes(word))
}

function getPreview(content) {
  if (!content) return 'No details provided yet.'
  return content.length > 86 ? `${content.slice(0, 86).trim()}...` : content
}

function GroupCard({ group, selectedId, onSelect }) {
  return (
    <section className={`flex min-h-0 flex-col rounded-lg border bg-white p-4 shadow-sm ${group.borderClass}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{group.title}</h3>
          <p className="text-xs text-gray-500">{group.subtitle}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${group.countClass}`}>
          {group.items.length}
        </span>
      </div>

      <div className="min-h-0 space-y-2 overflow-y-auto pr-1 scrollbar-hide xl:max-h-[260px]">
        {group.items.map((announcement) => {
          const selected = selectedId === announcement.id
          return (
            <button
              key={announcement.id}
              type="button"
              onClick={() => onSelect(announcement)}
              className={`group flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-all ${
                selected
                  ? `${group.activeClass} shadow-sm`
                  : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span
                className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  selected ? group.dotActiveClass : 'border-gray-300 bg-white'
                }`}
                aria-hidden="true"
              >
                {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-gray-900">
                  {announcement.title || 'Untitled announcement'}
                </span>
                <span className="mt-1 block line-clamp-2 text-xs leading-5 text-gray-500">
                  {getPreview(announcement.content)}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function DetailPane({ announcement, groupMeta }) {
  if (!announcement) {
    return (
      <aside className="flex min-h-[300px] items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white p-8 text-center xl:max-h-[calc(100vh-250px)]">
        <p className="max-w-xs text-sm text-gray-500">
          Select an announcement from a group to preview the full message here.
        </p>
      </aside>
    )
  }

  const meta = groupMeta || {}

  return (
    <aside className="flex min-h-[300px] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm xl:max-h-[calc(100vh-250px)]">
      <div className={`h-1.5 rounded-t-lg ${meta.barClass || 'bg-teal-500'}`} />
      <div className="flex min-h-0 flex-1 flex-col p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.countClass || 'bg-teal-50 text-teal-700'}`}>
            {meta.title || 'Announcement'}
          </span>
          {isUpcoming(announcement) && (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              Upcoming
            </span>
          )}
          <span className="text-xs text-gray-400">
            {formatDateTime(announcement.posted_at)}
          </span>
        </div>

        <h2 className="text-xl font-bold leading-tight text-gray-950">
          {announcement.title || 'Untitled announcement'}
        </h2>

        <div className="mt-2 text-sm text-gray-500">
          Posted {formatDate(announcement.posted_at)}
        </div>

        <div className="mt-5 min-h-0 flex-1 overflow-y-auto whitespace-pre-line pr-2 text-sm leading-7 text-gray-700 scrollbar-thin">
          {announcement.content || 'No announcement details were provided.'}
        </div>
      </div>
    </aside>
  )
}

export default function AnnouncementsView({ courseId }) {
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [selectedId, setSelectedId] = useState(null)

  const load = () => {
    setLoading(true)
    setFetchError(false)
    announcementService.getByCourse(courseId)
      .then((res) => {
        const data = res.data || []
        setAnnouncements(data)
        setSelectedId((current) => current || data[0]?.id || null)
      })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false))
  }

  useEffect(load, [courseId])

  const groups = useMemo(() => {
    const priority = []
    const general = []

    announcements.forEach((announcement) => {
      if (isPriority(announcement)) priority.push(announcement)
      else general.push(announcement)
    })

    return [
      {
        key: 'priority',
        title: 'Priority',
        subtitle: 'Deadlines, tests and time-sensitive notices',
        items: priority,
        borderClass: 'border-red-100',
        countClass: 'bg-red-50 text-red-700',
        activeClass: 'border-red-200 bg-red-50',
        dotActiveClass: 'border-red-500 bg-red-500',
        barClass: 'bg-red-500',
      },
      {
        key: 'general',
        title: 'General updates',
        subtitle: 'Course news and regular messages',
        items: general,
        borderClass: 'border-gray-200',
        countClass: 'bg-teal-50 text-teal-700',
        activeClass: 'border-teal-200 bg-teal-50',
        dotActiveClass: 'border-teal-600 bg-teal-600',
        barClass: 'bg-teal-500',
      },
    ].filter((group) => group.items.length)
  }, [announcements])

  const selected = announcements.find((announcement) => announcement.id === selectedId) || announcements[0]
  const selectedGroup = groups.find((group) => group.items.some((item) => item.id === selected?.id))

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>

  if (fetchError) return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <p className="text-sm text-gray-500">Could not load announcements. Check your connection and try again.</p>
      <button onClick={load} className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: '#111' }}>
        Try again
      </button>
    </div>
  )

  if (!announcements.length) return (
    <EmptyState
      icon="📢"
      title="No announcements yet"
      description="Your lecturer hasn't posted any announcements for this course."
    />
  )

  return (
    <div className="grid w-full items-start gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-gray-950">Announcements</h2>
          <p className="mt-1 text-sm text-gray-500">
            Latest course notices from your lecturer.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
          {groups.map((group) => (
            <GroupCard
              key={group.key}
              group={group}
              selectedId={selected?.id}
              onSelect={(announcement) => setSelectedId(announcement.id)}
            />
          ))}
        </div>
      </div>

      <DetailPane announcement={selected} groupMeta={selectedGroup} />
    </div>
  )
}
