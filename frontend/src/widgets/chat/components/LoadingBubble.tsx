import { BOT_NAME } from '../meeseeks'
import { useRotatingLoadingLine } from '../useRotatingLoadingLine'

type LoadingBubbleProps = {
  active: boolean
}

export function LoadingBubble({ active }: LoadingBubbleProps) {
  const caption = useRotatingLoadingLine(active)

  if (!active) return null

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%]">
        <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-400">
          {BOT_NAME}
        </div>
        <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-zinc-200 px-3 py-2 text-sm dark:bg-zinc-800">
          <span className="inline-flex gap-0.5">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:-0.2s] dark:bg-zinc-400" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:-0.1s] dark:bg-zinc-400" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 dark:bg-zinc-400" />
          </span>
          <span className="text-xs text-zinc-600 dark:text-zinc-300">{caption}</span>
        </div>
      </div>
    </div>
  )
}
