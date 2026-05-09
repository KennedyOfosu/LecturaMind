/**
 * AnnouncementsView.jsx — Student view of course announcements.
 */

import { useState, useEffect } from 'react'
import { announcementService } from '../../services/announcementService'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { Card } from '../../components/ui/Card'
import { formatDate } from '../../utils/formatDate'

export default function AnnouncementsView({ courseId }) {
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    announcementService.getByCourse(courseId)
      .then((res) => setAnnouncements(res.data))
      .finally(() => setLoading(false))
  }, [courseId])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  if (!announcements.length) return (
    <EmptyState icon="📢" title="No announcements yet" description="Your lecturer hasn't posted any announcements for this course." />
  )

  return (
    <div className="flex flex-col gap-4">
      {announcements.map((a) => (
        <Card key={a.id}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="font-semibold text-navy">{a.title}</h3>
              <p className="text-xs text-gray-400 mt-0.5">Posted {formatDate(a.posted_at)}</p>
              <p className={`text-sm text-gray-600 mt-2 ${expanded !== a.id ? 'line-clamp-3' : ''}`}>
                {a.content}
              </p>
            </div>
          </div>
          {a.content.length > 200 && (
            <button
              onClick={() => setExpanded(expanded === a.id ? null : a.id)}
              className="text-teal text-xs font-medium mt-2 hover:underline"
            >
              {expanded === a.id ? 'Show less' : 'Read more'}
            </button>
          )}
        </Card>
      ))}
    </div>
  )
}
