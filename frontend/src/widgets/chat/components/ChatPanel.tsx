import { useEffect } from 'react'
import type { ChatMessage } from '../../../types/chat'
import type { RateLimitInfo } from '../useChat'
import { BOT_NAME, MESEEKS_FACE_URL } from '../meeseeks'
import { MessageComposer } from './MessageComposer'
import { MessageList } from './MessageList'

type ChatPanelProps = {
  isOpen: boolean
  onClose: () => void
  messages: ChatMessage[]
  isSending: boolean
  isWelcomeLoading: boolean
  rateLimitInfo: RateLimitInfo | null
  onSend: (text: string) => void
}

export function ChatPanel({
  isOpen,
  onClose,
  messages,
  isSending,
  isWelcomeLoading,
  rateLimitInfo,
  onSend,
}: ChatPanelProps) {
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-label={`${BOT_NAME} chat`}
      className="fixed bottom-20 right-5 z-50 flex h-[520px] w-[360px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl shadow-black/30 ring-1 ring-black/5 dark:bg-zinc-950 dark:ring-white/10"
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <img
            src={MESEEKS_FACE_URL}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-zinc-200 dark:ring-zinc-700"
            width={36}
            height={36}
          />
          <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {BOT_NAME}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg leading-none text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
          aria-label="Close chat"
        >
          ×
        </button>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="relative min-h-0 flex flex-1 flex-col">
          {rateLimitInfo ? (
            <div
              className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 px-4 text-center dark:bg-zinc-950/90"
              role="alert"
            >
              <p className="max-w-[280px] text-sm font-medium leading-relaxed text-zinc-800 dark:text-zinc-100">
                {rateLimitInfo.message}
              </p>
            </div>
          ) : null}

          <MessageList
            messages={messages}
            isSending={isSending}
            isWelcomeLoading={isWelcomeLoading}
          />
        </div>
      </div>

      <MessageComposer
        disabled={isSending || isWelcomeLoading}
        isLoading={isSending}
        onSend={onSend}
      />
    </div>
  )
}
