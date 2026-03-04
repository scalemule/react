/**
 * useChat Hook
 *
 * Messages, typing indicators, and read receipts for a conversation.
 */

import { useState, useCallback, useEffect } from 'react'
import { useScaleMuleContext } from '../context'
import type { ApiError } from '@scalemule/sdk'
import type { Conversation, ChatMessage } from '@scalemule/sdk'

interface UseChatOptions {
  /** Auto-fetch messages on mount when conversationId is provided */
  autoFetch?: boolean
}

interface UseChatReturn {
  conversations: Conversation[]
  messages: ChatMessage[]
  isLoading: boolean
  error: ApiError | null

  /** List all conversations */
  listConversations: () => Promise<void>
  /** Create a new conversation */
  createConversation: (data: { participant_ids: string[]; name?: string }) => Promise<Conversation | null>
  /** Load messages for a conversation */
  loadMessages: (conversationId: string) => Promise<void>
  /** Send a message */
  sendMessage: (conversationId: string, data: { content: string; type?: string }) => Promise<ChatMessage | null>
  /** Edit a message */
  editMessage: (messageId: string, data: { content: string }) => Promise<ChatMessage | null>
  /** Delete a message */
  deleteMessage: (messageId: string) => Promise<boolean>
  /** Add a reaction to a message */
  addReaction: (messageId: string, emoji: string) => Promise<boolean>
  /** Send typing indicator */
  sendTyping: (conversationId: string) => Promise<void>
  /** Mark conversation as read */
  markRead: (conversationId: string) => Promise<void>
}

/**
 * Hook for chat operations
 *
 * @example
 * ```tsx
 * function ChatRoom({ conversationId }: { conversationId: string }) {
 *   const { messages, sendMessage, sendTyping, markRead, isLoading } = useChat(conversationId)
 *
 *   const handleSend = async (content: string) => {
 *     await sendMessage(conversationId, { content })
 *   }
 *
 *   useEffect(() => { markRead(conversationId) }, [messages])
 *
 *   return (
 *     <div>
 *       {messages.map((msg) => (
 *         <div key={msg.id}>{msg.content}</div>
 *       ))}
 *       <input
 *         onChange={() => sendTyping(conversationId)}
 *         onKeyDown={(e) => e.key === 'Enter' && handleSend(e.currentTarget.value)}
 *       />
 *     </div>
 *   )
 * }
 * ```
 */
export function useChat(conversationId?: string, options?: UseChatOptions): UseChatReturn {
  const { client } = useScaleMuleContext()
  const autoFetch = options?.autoFetch !== false
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const listConversations = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    const response = await client.chat.listConversations()
    if (response.error) {
      setError(response.error)
    } else {
      setConversations(response.data || [])
    }
    setIsLoading(false)
  }, [client])

  const createConversation = useCallback(
    async (data: { participant_ids: string[]; name?: string }): Promise<Conversation | null> => {
      setError(null)
      const response = await client.chat.createConversation(data)
      if (response.error) {
        setError(response.error)
        return null
      }
      const conv = response.data as Conversation
      setConversations((prev) => [conv, ...prev])
      return conv
    },
    [client]
  )

  const loadMessages = useCallback(
    async (convId: string) => {
      setIsLoading(true)
      setError(null)
      const response = await client.chat.getMessages(convId)
      if (response.error) {
        setError(response.error)
      } else {
        setMessages(response.data || [])
      }
      setIsLoading(false)
    },
    [client]
  )

  const sendMessage = useCallback(
    async (convId: string, data: { content: string; type?: string }): Promise<ChatMessage | null> => {
      setError(null)
      const response = await client.chat.sendMessage(convId, data)
      if (response.error) {
        setError(response.error)
        return null
      }
      const msg = response.data as ChatMessage
      setMessages((prev) => [...prev, msg])
      return msg
    },
    [client]
  )

  const editMessage = useCallback(
    async (messageId: string, data: { content: string }): Promise<ChatMessage | null> => {
      setError(null)
      const response = await client.chat.editMessage(messageId, data)
      if (response.error) {
        setError(response.error)
        return null
      }
      const updated = response.data as ChatMessage
      setMessages((prev) => prev.map((m) => (m.id === messageId ? updated : m)))
      return updated
    },
    [client]
  )

  const deleteMessage = useCallback(
    async (messageId: string): Promise<boolean> => {
      setError(null)
      const response = await client.chat.deleteMessage(messageId)
      if (response.error) {
        setError(response.error)
        return false
      }
      setMessages((prev) => prev.filter((m) => m.id !== messageId))
      return true
    },
    [client]
  )

  const addReaction = useCallback(
    async (messageId: string, emoji: string): Promise<boolean> => {
      setError(null)
      const response = await client.chat.addReaction(messageId, { emoji })
      if (response.error) {
        setError(response.error)
        return false
      }
      return true
    },
    [client]
  )

  const sendTyping = useCallback(
    async (convId: string) => {
      await client.chat.sendTyping(convId)
    },
    [client]
  )

  const markRead = useCallback(
    async (convId: string) => {
      await client.chat.markRead(convId)
    },
    [client]
  )

  // Auto-fetch messages when conversationId is provided
  useEffect(() => {
    if (!conversationId || !autoFetch) return
    void loadMessages(conversationId)
  }, [conversationId, autoFetch, loadMessages])

  return {
    conversations, messages, isLoading, error,
    listConversations, createConversation, loadMessages,
    sendMessage, editMessage, deleteMessage, addReaction,
    sendTyping, markRead,
  }
}
