/**
 * Format an ISO date string into a human-readable format.
 * @param {string} iso - ISO 8601 date string
 * @returns {string}
 */
export function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Format an ISO date string with time.
 * @param {string} iso
 * @returns {string}
 */
export function formatDateTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Format a timestamp for chat messages.
 * Today → "2:45 PM"; previous days → "14 May · 2:45 PM"
 * @param {string} timestamp - ISO 8601 string
 * @returns {string}
 */
export function formatMessageTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (isToday) return timeStr
  const dateStr = date.toLocaleDateString([], { day: 'numeric', month: 'short' })
  return `${dateStr} · ${timeStr}`
}

/**
 * Return a relative time string (e.g. "3 minutes ago").
 * @param {string} iso
 * @returns {string}
 */
export function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days !== 1 ? 's' : ''} ago`
}
