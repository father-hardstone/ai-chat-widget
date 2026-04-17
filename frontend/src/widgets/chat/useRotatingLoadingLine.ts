import { useEffect, useState } from 'react'
import { API_WAITING_LINES } from './loadingMessages'

const ROTATE_MS = 2400

/**
 * Cycles through {@link API_WAITING_LINES} while `active` is true.
 */
export function useRotatingLoadingLine(active: boolean): string {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!active) return

    setIndex(Math.floor(Math.random() * API_WAITING_LINES.length))

    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % API_WAITING_LINES.length)
    }, ROTATE_MS)

    return () => window.clearInterval(id)
  }, [active])

  return API_WAITING_LINES[index] ?? API_WAITING_LINES[0]
}
