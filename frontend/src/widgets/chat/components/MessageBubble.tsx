import type { ChatMessage } from '../../../types/chat'
import { BOT_NAME } from '../meeseeks'

type MessageBubbleProps = {
  message: ChatMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={isUser ? 'flex justify-end' : 'flex justify-start'}>
      <div className="max-w-[85%]">
        {!isUser ? (
          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-400">
            {BOT_NAME}
          </div>
        ) : null}
        <div
          className={[
            'rounded-2xl px-3 py-2 text-sm leading-5',
            isUser
              ? 'rounded-br-md bg-indigo-600 text-white'
              : 'rounded-bl-md bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100',
          ].join(' ')}
        >
          {message.content}
        </div>
      </div>
    </div>
  )
}
