export type ChatRole = 'user' | 'assistant'

export type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  createdAtMs: number
}

/** Prior turns sent to the API (last few messages) for multi-turn context. */
export type ChatHistoryTurn = {
  role: ChatRole
  content: string
}

