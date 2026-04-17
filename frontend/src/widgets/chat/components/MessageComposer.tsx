import { useState } from 'react'

type MessageComposerProps = {
  disabled?: boolean
  isLoading?: boolean
  onSend: (text: string) => void
}

export function MessageComposer({ disabled, isLoading, onSend }: MessageComposerProps) {
  const [text, setText] = useState('')

  const busy = Boolean(disabled || isLoading)

  const submit = () => {
    if (busy) return
    const v = text.trim()
    if (!v) return
    onSend(v)
    setText('')
  }

  return (
    <form
      className="flex items-end gap-2 border-t border-zinc-200 p-2 dark:border-zinc-800"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          if (e.shiftKey) return
          e.preventDefault()
          submit()
        }}
        placeholder={busy ? 'Waiting for Meeseeks…' : 'Message Meeseeks…'}
        rows={1}
        className="min-h-[40px] max-h-28 flex-1 resize-none rounded-xl bg-zinc-100 px-3 py-2 text-sm text-zinc-900 outline-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-cyan-400 disabled:opacity-70 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-800"
        disabled={busy}
      />
      <button
        type="submit"
        disabled={busy || !text.trim()}
        className="inline-flex h-10 min-w-[5.25rem] shrink-0 items-center justify-center rounded-xl bg-cyan-600 px-4 text-sm font-medium text-white ring-1 ring-white/10 transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Wait
          </span>
        ) : (
          'Send'
        )}
      </button>
    </form>
  )
}
