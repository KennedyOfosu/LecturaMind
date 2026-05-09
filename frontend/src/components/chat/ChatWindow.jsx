/**
 * ChatWindow.jsx — Scrollable container for all chat messages.
 */

import { useEffect, useRef } from 'react'
import { ChatBubble } from './ChatBubble'
import { TypingIndicator } from './TypingIndicator'

export function ChatWindow({ messages, isTyping }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
      {messages.map((msg, i) => (
        <ChatBubble key={msg.id || i} message={msg} />
      ))}
      {isTyping && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  )
}
