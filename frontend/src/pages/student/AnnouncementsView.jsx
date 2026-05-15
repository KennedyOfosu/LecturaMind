/**
 * AnnouncementsView.jsx — Clean announcement cards with read-more toggle.
 */

import { useState, useEffect } from 'react'
import { announcementService } from '../../services/announcementService'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default function AnnouncementsView({ courseId }) {
  const [announcements, setAnnouncements] = useState([])
  const [loading,       setLoading]       = useState(true)
  const [expanded,      setExpanded]      = useState(null)

  useEffect(() => {
    announcementService.getByCourse(courseId)
      .then((res) => setAnnouncements(res.data || []))
      .finally(() => setLoading(false))
  }, [courseId])

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>

  if (!announcements.length) return (
    <EmptyState
      icon="📢"
      title="No announcements yet"
      description="Your lecturer hasn't posted any announcements for this course."
    />
  )

  return (
    <div className="flex flex-col gap-4">
      {announcements.map((a) => {
        const isLong = (a.content || '').length > 220
        const isOpen = expanded === a.id
        return (
          <div key={a.id} className="rounded-xl border border-gray-200 bg-white p-5">
            {/* title row */}
            <div className="flex items-start justify-between gap-4 mb-2">
              <h3 className="font-semibold text-gray-900 text-base leading-snug">{a.title}</h3>
              <span className="text-xs text-gray-400 shrink-0">{fmtDate(a.posted_at)}</span>
            </div>

            {/* body */}
            <p className={`text-sm text-gray-600 leading-relaxed ${!isOpen && isLong ? 'line-clamp-3' : ''}`}>
              {a.content}
            </p>

            {/* read more */}
            {isLong && (
              <button
                onClick={() => setExpanded(isOpen ? null : a.id)}
                className="mt-2 text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors"
              >
                {isOpen ? 'Show less' : 'Read more'}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
