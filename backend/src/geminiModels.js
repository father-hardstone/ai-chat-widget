const LIST_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

/**
 * Lists models that support generateContent for this API key (Google AI / AI Studio).
 * @param {string} apiKey
 * @returns {Promise<{ id: string, name: string, displayName: string }[]>}
 */
async function listModelsWithGenerateContent(apiKey) {
  const url = new URL(LIST_URL)
  url.searchParams.set('key', apiKey)

  const res = await fetch(url)
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`ListModels HTTP ${res.status}: ${text.slice(0, 500)}`)
  }

  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('ListModels returned non-JSON')
  }

  const raw = Array.isArray(data.models) ? data.models : []
  return raw
    .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
    .map((m) => {
      const full = typeof m.name === 'string' ? m.name : ''
      const id = full.replace(/^models\//, '')
      return {
        id,
        name: full,
        displayName: typeof m.displayName === 'string' ? m.displayName : id,
      }
    })
}

module.exports = { listModelsWithGenerateContent }
