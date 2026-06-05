/**
 * LiveSessionToast.jsx — Real-time "live quiz started" notification.
 * Listens for "live_session_started" socket events emitted when a lecturer
 * starts a live session, and shows a card with the quiz info plus the PIN.
 * Students can copy the PIN or hit "Join Now" to jump straight into the quiz.
 * Works on every student page (mounted globally in StudentLayout).
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../../hooks/useSocket'

function PinCard({ note, onDismiss, onJoin }) {
  const [copied, setCopied] = useState(false)

  const copyPin = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(note.pin).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }

  return (
    <div
      className="w-80 bg-white rounded-2xl shadow-xl border overflow-hidden"
      style={{
        borderColor: '#DDD6FE',
        animation: 'announcementSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both',
      }}
    >
      {/* Header row */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        {/* Lightning badge */}
        <div
          className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: '#7C3AED' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" stroke="none">
            <path d="M13 2L4.09 12.26a1 1 0 0 0 .79 1.61H11l-1 8.14 8.91-10.26a1 1 0 0 0-.79-1.61H13l1-8.14z"/>
          </svg>
        </div>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className="text-xs font-semibold text-violet-700 truncate">
              Live Quiz Started
            </p>
            <span className="text-xs text-gray-400 shrink-0">just now</span>
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
        <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
          {note.quiz_title}
        </p>
        {note.num_questions ? (
          <p className="text-xs text-gray-400 mt-0.5">{note.num_questions} questions</p>
        ) : null}

        {/* PIN block */}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 rounded-xl border-2 border-dashed border-violet-200 bg-violet-50 px-3 py-2 text-center">
            <p className="text-[10px] uppercase tracking-widest text-violet-400">Session PIN</p>
            <p className="text-2xl font-bold font-mono tracking-[0.3em] text-violet-700">{note.pin}</p>
          </div>
          <button
            onClick={copyPin}
            className="h-12 px-3 rounded-xl text-xs font-semibold text-violet-700 bg-violet-100 hover:bg-violet-200 transition-colors"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 pb-4">
        <button
          onClick={onJoin}
          className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#7C3AED' }}
        >
          Join Now
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

export default function LiveSessionToast() {
  const { socket } = useSocket()
  const navigate   = useNavigate()
  const [queue, setQueue] = useState([])   // array of live-session notifications

  const dismiss = useCallback((quizId) => {
    setQueue((q) => q.filter((n) => n.quiz_id !== quizId))
  }, [])

  const join = useCallback((note) => {
    dismiss(note.quiz_id)
    navigate(`/student/courses/${note.course_id}?tab=quiz&pin=${note.pin}`)
  }, [navigate, dismiss])

  useEffect(() => {
    if (!socket) return

    const handler = (data) => {
      if (!data?.pin) return
      // Replace any existing card for the same quiz (fresh PIN wins)
      setQueue((q) => [data, ...q.filter((n) => n.quiz_id !== data.quiz_id)])

      // Auto-dismiss after 45 seconds (long enough to copy the PIN)
      setTimeout(() => {
        setQueue((q) => q.filter((n) => !(n.quiz_id === data.quiz_id && n.pin === data.pin)))
      }, 45000)
    }

    socket.on('live_session_started', handler)
    return () => socket.off('live_session_started', handler)
  }, [socket])

  if (!queue.length) return null

  return (
    <div
      className="fixed top-5 right-5 z-50 flex flex-col gap-3"
      style={{ maxWidth: 320 }}
    >
      {queue.map((note) => (
        <PinCard
          key={`${note.quiz_id}-${note.pin}`}
          note={note}
          onDismiss={() => dismiss(note.quiz_id)}
          onJoin={() => join(note)}
        />
      ))}
    </div>
  )
}
