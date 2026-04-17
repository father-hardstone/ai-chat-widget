import { useEffect, useRef } from 'react'
import type { ChatMessage } from '../../../types/chat'
import { MessageBubble } from './MessageBubble'
import { LoadingBubble } from './LoadingBubble'

type MessageListProps = {
  messages: ChatMessage[]
  isSending: boolean
  isWelcomeLoading: boolean
}

export function MessageList({ messages, isSending, isWelcomeLoading }: MessageListProps) {
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, isSending, isWelcomeLoading])

  const showWelcomeLoading = messages.length === 0 && isWelcomeLoading

  return (
    <div className="minimal-scrollbar flex-1 space-y-2 overflow-y-auto px-3 py-3">
      <LoadingBubble active={showWelcomeLoading} />

      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}

      <LoadingBubble active={isSending} />

      <div ref={endRef} />
    </div>
  )
}
