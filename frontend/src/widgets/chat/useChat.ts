import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChatApiError, fetchWelcomeMessage, sendChatMessage } from '../../api/chat'
import type { ChatMessage } from '../../types/chat'
import { WELCOME_FALLBACK_MESSAGE } from './meeseeks'
import { makeId } from './utils'

export type RateLimitInfo = {
  message: string
  untilMs: number
}

type UseChatState = {
  messages: ChatMessage[]
  isSending: boolean
  isWelcomeLoading: boolean
  toast: string | null
  rateLimitInfo: RateLimitInfo | null
  send: (text: string) => Promise<void>
  dismissToast: () => void
}

function formatRateLimitMinutes(seconds: number): string {
  const s = Math.max(1, Math.ceil(seconds))
  const mins = s / 60
  if (mins <= 1.5) return 'about a minute'
  return `${Math.ceil(mins)} minutes`
}

function meeseeksRateLimitMessage(retryAfterSeconds: number): string {
  const windowLabel = formatRateLimitMinutes(retryAfterSeconds)
  return `I'm Meeseeks—I've got to pace myself! You've hit the message limit for now. Try again in ${windowLabel}.`
}

export function useChat(panelOpen: boolean): UseChatState {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isSending, setIsSending] = useState(false)
  const [isWelcomeLoading, setIsWelcomeLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null)

  /** Load first message from API when the panel opens on an empty thread. */
  useEffect(() => {
    if (!panelOpen || messages.length > 0) return

    const ac = new AbortController()

    ;(async () => {
      setIsWelcomeLoading(true)
      try {
        const reply = await fetchWelcomeMessage(ac.signal)
        if (ac.signal.aborted) return
        setMessages((prev) => {
          if (prev.length > 0) return prev
          return [
            {
              id: makeId('msg'),
              role: 'assistant',
              content: reply,
              createdAtMs: Date.now(),
            },
          ]
        })
      } catch (e) {
        if (ac.signal.aborted) return
        const isAbort =
          e instanceof DOMException && e.name === 'AbortError'
        if (isAbort) return
        setMessages((prev) => {
          if (prev.length > 0) return prev
          return [
            {
              id: makeId('msg'),
              role: 'assistant',
              content: WELCOME_FALLBACK_MESSAGE,
              createdAtMs: Date.now(),
            },
          ]
        })
        if (e instanceof ChatApiError) {
          setToast(e.getToastSummary())
        }
      } finally {
        setIsWelcomeLoading(false)
      }
    })()

    return () => ac.abort()
  }, [panelOpen, messages.length])

  /** Auto-clear rate limit overlay when the window expires. */
  useEffect(() => {
    if (!rateLimitInfo) return
    const id = window.setInterval(() => {
      if (Date.now() >= rateLimitInfo.untilMs) {
        setRateLimitInfo(null)
      }
    }, 500)
    return () => window.clearInterval(id)
  }, [rateLimitInfo])

  /** Toast auto-dismiss. */
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 7000)
    return () => window.clearTimeout(t)
  }, [toast])

  const dismissToast = useCallback(() => setToast(null), [])

  const send = useCallback(async (text: string) => {
    const content = text.trim()
    if (!content) return

    const userMsg: ChatMessage = {
      id: makeId('msg'),
      role: 'user',
      content,
      createdAtMs: Date.now(),
    }

    const history = messages.slice(-4).map(({ role, content: c }) => ({ role, content: c }))
    const userMessageCount = messages.filter((m) => m.role === 'user').length + 1

    setMessages((prev) => [...prev, userMsg])
    setIsSending(true)
    setToast(null)
    setRateLimitInfo(null)

    try {
      const reply = await sendChatMessage({ message: content, history, userMessageCount })
      const assistantMsg: ChatMessage = {
        id: makeId('msg'),
        role: 'assistant',
        content: reply,
        createdAtMs: Date.now(),
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (e) {
      if (e instanceof ChatApiError && e.code === 'CLIENT_RATE_LIMIT') {
        const sec = e.retryAfterSeconds ?? 60
        setRateLimitInfo({
          message: meeseeksRateLimitMessage(sec),
          untilMs: Date.now() + sec * 1000,
        })
        return
      }

      if (e instanceof ChatApiError) {
        setToast(e.getToastSummary())
        return
      }

      const fallback =
        e instanceof Error ? e.message.slice(0, 280) : 'Something went wrong. Please try again.'
      setToast(fallback)
    } finally {
      setIsSending(false)
    }
  }, [messages])

  return useMemo(
    () => ({
      messages,
      isSending,
      isWelcomeLoading,
      toast,
      rateLimitInfo,
      send,
      dismissToast,
    }),
    [messages, isSending, isWelcomeLoading, toast, rateLimitInfo, send, dismissToast],
  )
}
