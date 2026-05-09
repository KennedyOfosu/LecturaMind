/**
 * ChatBubble.jsx — Renders a single AI chat message bubble.
 */

import { formatDateTime } from '../../utils/formatDate'

export function ChatBubble({ message }) {
  const isStudent = message.role === 'student' || message.sender === 'student'

  return (
    <div className={`flex flex-col ${isStudent ? 'items-end' : 'items-start'} gap-1`}>
      {!isStudent && (
        <span className="text-xs font-semibold text-teal ml-1">LecturaMind AI</span>
      )}
      <div
        className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
          isStudent
            ? 'bg-navy text-white rounded-br-none'
            : 'bg-teal/10 text-gray-800 border border-teal/20 rounded-bl-none'
        }`}
      >
        {message.content || message.query || message.response}
      </div>
      {message.timestamp && (
        <span className="text-xs text-gray-400 mx-1">
          {formatDateTime(message.timestamp)}
        </span>
      )}
    </div>
  )
}
