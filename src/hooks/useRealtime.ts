/**
 * useRealtime Hook
 *
 * WebSocket connection with auto-subscribe/unsubscribe on mount/unmount,
 * automatic reconnection, and channel re-subscription.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useScaleMuleContext } from '../context'
import type { ConnectionStatus } from '@scalemule/sdk'

interface UseRealtimeOptions {
  /** Channels to subscribe to */
  channels?: string[]
  /** Called when a message arrives on any subscribed channel */
  onMessage?: (channel: string, data: unknown) => void
  /** Auto-connect on mount (default: true) — subscribing auto-connects */
  autoConnect?: boolean
}

interface UseRealtimeReturn {
  /** Connection status */
  status: ConnectionStatus
  /** Last received message */
  lastMessage: { channel: string; data: unknown } | null
  /** Manually disconnect */
  disconnect: () => void
  /** Subscribe to an additional channel (auto-connects) */
  subscribe: (channel: string, callback?: (data: unknown) => void) => () => void
  /** Publish data to a channel */
  publish: (channel: string, data: unknown) => void
}

/**
 * Hook for realtime WebSocket subscriptions
 *
 * @example
 * ```tsx
 * function ChatNotifications() {
 *   const { status, lastMessage } = useRealtime({
 *     channels: ['chat:room-1', 'notifications'],
 *     onMessage: (channel, data) => {
 *       console.log(`${channel}:`, data)
 *     },
 *   })
 *
 *   return <div>Status: {status}</div>
 * }
 *
 * // Manual subscription
 * function CustomSub() {
 *   const { subscribe, status } = useRealtime()
 *
 *   useEffect(() => {
 *     const unsub = subscribe('events:live', (data) => {
 *       console.log('Event:', data)
 *     })
 *     return unsub
 *   }, [])
 *
 *   return <div>Connected: {status}</div>
 * }
 * ```
 */
export function useRealtime(options?: UseRealtimeOptions): UseRealtimeReturn {
  const { client } = useScaleMuleContext()
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [lastMessage, setLastMessage] = useState<{ channel: string; data: unknown } | null>(null)
  const manualUnsubscribesRef = useRef<Array<() => void>>([])
  const autoUnsubscribesRef = useRef<Array<() => void>>([])
  const onMessageRef = useRef<UseRealtimeOptions['onMessage']>(undefined)
  const channelSignature = (options?.channels ?? []).join('\u001f')

  useEffect(() => {
    onMessageRef.current = options?.onMessage
  }, [options?.onMessage])

  const disconnect = useCallback(() => {
    client.realtime.disconnect()
  }, [client])

  const subscribe = useCallback(
    (channel: string, callback?: (data: unknown) => void) => {
      // subscribe() auto-connects the WebSocket
      const unsub = client.realtime.subscribe(channel, (data: unknown) => {
        setLastMessage({ channel, data })
        callback?.(data)
        onMessageRef.current?.(channel, data)
      })
      manualUnsubscribesRef.current.push(unsub)
      return () => {
        manualUnsubscribesRef.current = manualUnsubscribesRef.current.filter((fn) => fn !== unsub)
        unsub()
      }
    },
    [client]
  )

  const publish = useCallback(
    (channel: string, data: unknown) => {
      client.realtime.publish(channel, data)
    },
    [client]
  )

  // Subscribe to status changes
  useEffect(() => {
    const unsub = client.realtime.onStatusChange((newStatus: ConnectionStatus) => {
      setStatus(newStatus)
    })
    return unsub
  }, [client])

  // Keep auto subscriptions in sync with options.channels
  useEffect(() => {
    for (const unsub of autoUnsubscribesRef.current) {
      unsub()
    }
    autoUnsubscribesRef.current = []

    for (const channel of options?.channels ?? []) {
      const unsub = client.realtime.subscribe(channel, (data: unknown) => {
        setLastMessage({ channel, data })
        onMessageRef.current?.(channel, data)
      })
      autoUnsubscribesRef.current.push(unsub)
    }

    return () => {
      for (const unsub of autoUnsubscribesRef.current) {
        unsub()
      }
      autoUnsubscribesRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, channelSignature])

  // Cleanup on unmount — unsubscribe channels but do NOT disconnect the shared
  // RealtimeService singleton. Other hooks (useNotifications, etc.) may still
  // need the connection. disconnect() is an explicit user action only.
  useEffect(() => {
    return () => {
      for (const unsub of manualUnsubscribesRef.current) {
        unsub()
      }
      manualUnsubscribesRef.current = []

      for (const unsub of autoUnsubscribesRef.current) {
        unsub()
      }
      autoUnsubscribesRef.current = []
    }
  }, [])

  return { status, lastMessage, disconnect, subscribe, publish }
}
