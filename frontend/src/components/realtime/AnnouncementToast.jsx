/**
 * AnnouncementToast.jsx — Real-time slide-in notification card.
 * Listens for "new_announcement" socket events and shows a card that
 * slides in from the top of the screen. Works on every student page.
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../../hooks/useSocket'

function timeAgo() {
  return 'just now'
}

function Toast({ note, onDismiss, onReadMore }) {
  const initials = note.lecturer_name
    ? note.lecturer_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'LM'

  return (
    <div
      className="w-80 bg-white rounded-2xl shadow-xl border overflow-hidden"
      style={{
        borderColor: '#E5E7EB',
        animation: 'announcementSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both',
      }}
    >
      {/* Header row */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        {/* Avatar */}
        <div
          className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
          style={{ backgroundColor: '#374151' }}
        >
          {initials}
        </div>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className="text-xs font-semibold text-gray-800 truncate">
              New Announcement
            </p>
            <span className="text-xs text-gray-400 shrink-0">{timeAgo()}</span>
          </div>
          <p className="text-xs text-gray-500 truncate mt-0.5">{note.course_name}</p>
        </div>

        {/* Dismiss X */}
        <button
          onClick={onDismiss}
          className="text-gray-300 hover:text-gray-500 transition-colors shrink-0 -mt-0.5"
          aria-label="Dismiss"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="px-4 pb-3">
        <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-1">
          {note.title}
        </p>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
          {note.content}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 pb-4">
        <button
          onClick={onReadMore}
          className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white transition-colors"
          style={{ backgroundColor: '#111' }}
        >
          Read More
        </button>
        <button
          onClick={onDismiss}
          className="px-3 py-1.5 rounded-xl text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}

export default function AnnouncementToast() {
  const { socket }   = useSocket()
  const navigate     = useNavigate()
  const [queue, setQueue] = useState([])   // array of notification objects

  const dismiss = useCallback((id) => {
    setQueue((q) => q.filter((n) => n.announcement_id !== id))
  }, [])

  const readMore = useCallback((note) => {
    dismiss(note.announcement_id)
    navigate(`/student/courses/${note.course_id}?tab=announcements`)
  }, [navigate, dismiss])

  useEffect(() => {
    if (!socket) return

    const shown = new Set()   // dedup within this socket session

    const handler = (data) => {
      if (shown.has(data.announcement_id)) return
      shown.add(data.announcement_id)

      setQueue((q) => [data, ...q])

      // Auto-dismiss after 12 seconds
      setTimeout(() => {
        setQueue((q) => q.filter((n) => n.announcement_id !== data.announcement_id))
      }, 12000)
    }

    socket.on('new_announcement', handler)
    return () => socket.off('new_announcement', handler)
  }, [socket])

  if (!queue.length) return null

  return (
    <div
      className="fixed top-5 right-5 z-50 flex flex-col gap-3"
      style={{ maxWidth: 320 }}
    >
      {queue.map((note) => (
        <Toast
          key={note.announcement_id}
          note={note}
          onDismiss={() => dismiss(note.announcement_id)}
          onReadMore={() => readMore(note)}
        />
      ))}
    </div>
  )
}
