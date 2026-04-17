const fs = require('fs')
const path = require('path')

const KB_PATH = path.join(__dirname, '..', 'knowledge_base.json')

let cache = { mtimeMs: null, entries: null }

function loadKnowledgeBase() {
  const stat = fs.statSync(KB_PATH)
  if (cache.entries && cache.mtimeMs === stat.mtimeMs) {
    return cache.entries
  }
  const raw = fs.readFileSync(KB_PATH, 'utf8')
  const data = JSON.parse(raw)
  if (!Array.isArray(data)) {
    throw new Error('knowledge_base.json must be a JSON array')
  }
  cache = { mtimeMs: stat.mtimeMs, entries: data }
  return data
}

/**
 * Plain-text block injected into the Gemini system instruction.
 */
function formatKnowledgeBaseForPrompt(entries) {
  return entries
    .map((e) => {
      const variants = Array.isArray(e.variants) ? e.variants.join(' | ') : ''
      const lines = [
        `[${e.category || 'general'}] ${e.question}`,
        variants ? `Related phrasings: ${variants}` : null,
        `Answer: ${e.answer}`,
      ].filter(Boolean)
      return lines.join('\n')
    })
    .join('\n\n---\n\n')
}

function getKnowledgeContextString() {
  return formatKnowledgeBaseForPrompt(loadKnowledgeBase())
}

module.exports = {
  getKnowledgeContextString,
  loadKnowledgeBase,
}
