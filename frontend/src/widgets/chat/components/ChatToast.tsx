type ChatToastProps = {
  message: string
  onDismiss: () => void
  /** Extra classes; base positions toast at viewport top-right. */
  className?: string
}

/** Fixed toast at viewport top-right (outside chat panel). */
export function ChatToast({ message, onDismiss, className = '' }: ChatToastProps) {
  return (
    <div
      role="status"
      className={`pointer-events-auto fixed right-4 top-4 z-[100] max-w-[min(360px,calc(100vw-2rem))] rounded-xl border border-red-200/90 bg-red-50/95 px-3 py-2 text-xs text-red-900 shadow-lg backdrop-blur-sm dark:border-red-900/50 dark:bg-red-950/95 dark:text-red-100 ${className}`}
    >
      <div className="flex gap-2">
        <p className="min-w-0 flex-1 whitespace-pre-wrap leading-snug">{message}</p>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-md px-1.5 py-0.5 text-red-700 hover:bg-red-100 dark:text-red-200 dark:hover:bg-red-900/50"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  )
}
