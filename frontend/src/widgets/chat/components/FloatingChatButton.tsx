import { MESEEKS_FACE_URL } from '../meeseeks'

type FloatingChatButtonProps = {
  isOpen: boolean
  onClick: () => void
}

/**
 * Speech-bubble shape (asymmetric corners like a chat icon); Meeseeks face only—no overlay icons.
 */
export function FloatingChatButton({ isOpen, onClick }: FloatingChatButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'fixed bottom-5 right-5 z-50 h-14 w-[3.85rem] shrink-0 overflow-hidden border-2 border-white/55 bg-indigo-600 bg-cover bg-center shadow-lg shadow-black/35 ring-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 dark:border-white/25',
        /* Chat-bubble silhouette: soft corners + tighter bottom-right “tail” corner */
        'rounded-[1.35rem] rounded-br-[0.35rem]',
        isOpen ? 'ring-cyan-400/85 ring-offset-2 ring-offset-zinc-950' : 'ring-black/15 hover:brightness-110 dark:ring-white/20',
      ].join(' ')}
      style={{ backgroundImage: `url(${MESEEKS_FACE_URL})` }}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      aria-label={isOpen ? 'Meeseeks chat is open' : 'Open Meeseeks chat'}
    />
  )
}
