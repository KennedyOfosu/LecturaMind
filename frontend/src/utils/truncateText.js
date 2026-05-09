/**
 * Truncate a string to a given character limit, appending '…' if cut.
 * @param {string} text
 * @param {number} limit
 * @returns {string}
 */
export function truncateText(text, limit = 100) {
  if (!text) return ''
  return text.length <= limit ? text : text.slice(0, limit).trimEnd() + '…'
}
