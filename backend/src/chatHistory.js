const MAX_ITEMS = 4

/**
 * @param {unknown} raw
 * @returns {{ role: 'user' | 'assistant', content: string }[]}
 */
function normalizeHistory(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const role = item.role === 'assistant' ? 'assistant' : item.role === 'user' ? 'user' : null
    const content = typeof item.content === 'string' ? item.content : ''
    if (!role || !content.trim()) continue
    out.push({ role, content: content.trim() })
  }
  return out.slice(-MAX_ITEMS)
}

module.exports = {
  normalizeHistory,
  MAX_HISTORY_ITEMS: MAX_ITEMS,
}
