/**
 * ChatInput.jsx — Message input bar for the AI chatbot.
 */

import { useState } from 'react'
import { Button } from '../ui/Button'

export function ChatInput({ onSend, disabled = false }) {
  const [value, setValue] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-4 border-t border-gray-100 bg-white">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        placeholder="Ask a question about this course…"
        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal/50 text-sm disabled:bg-gray-50"
      />
      <Button type="submit" variant="teal" disabled={!value.trim() || disabled}>
        Send
      </Button>
    </form>
  )
}
