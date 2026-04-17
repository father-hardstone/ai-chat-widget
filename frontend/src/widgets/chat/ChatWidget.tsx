import { useCallback, useState } from 'react'
import { useChat } from './useChat'
import { ChatToast } from './components/ChatToast'
import { FloatingChatButton } from './components/FloatingChatButton'
import { ChatPanel } from './components/ChatPanel'

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const { messages, isSending, isWelcomeLoading, toast, rateLimitInfo, send, dismissToast } =
    useChat(isOpen)

  const toggle = useCallback(() => setIsOpen((v) => !v), [])
  const close = useCallback(() => setIsOpen(false), [])

  return (
    <>
      {toast ? <ChatToast message={toast} onDismiss={dismissToast} /> : null}
      <ChatPanel
        isOpen={isOpen}
        onClose={close}
        messages={messages}
        isSending={isSending}
        isWelcomeLoading={isWelcomeLoading}
        rateLimitInfo={rateLimitInfo}
        onSend={(text) => {
          void send(text)
        }}
      />
      <FloatingChatButton isOpen={isOpen} onClick={toggle} />
    </>
  )
}
