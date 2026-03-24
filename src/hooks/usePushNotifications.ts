/**
 * usePushNotifications — React hook for browser push notification management
 *
 * Uses the ScaleMule SDK client directly for API calls (not a proxy).
 * For NextJS apps that use proxy-mode auth, use the @scalemule/nextjs version instead.
 *
 * @example
 * ```tsx
 * function NotificationPrompt() {
 *   const { isSupported, permission, isSubscribed, subscribe } = usePushNotifications()
 *   if (!isSupported || permission === 'denied' || isSubscribed) return null
 *   return <button onClick={subscribe}>Enable Notifications</button>
 * }
 * ```
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useScaleMuleContext } from '../context'
import { WebPushManager } from '@scalemule/sdk'
import type { PushApiFetcher, ApiError } from '@scalemule/sdk'

// ============================================================================
// Types
// ============================================================================

export interface UsePushNotificationsOptions {
  /** Service worker URL (default: '/sw.js') */
  serviceWorkerUrl?: string
  /** Called when a push notification is received while app is in foreground */
  onNotification?: (data: unknown) => void
}

export interface UsePushNotificationsReturn {
  isSupported: boolean
  permission: NotificationPermission | 'unsupported'
  isSubscribed: boolean
  isLoading: boolean
  error: ApiError | null
  subscribe: () => Promise<void>
  unsubscribe: () => Promise<void>
  disassociateUser: () => Promise<void>
  tokenId: string | null
}

// ============================================================================
// Hook
// ============================================================================

export function usePushNotifications(
  options: UsePushNotificationsOptions = {}
): UsePushNotificationsReturn {
  const { serviceWorkerUrl = '/sw.js', onNotification } = options
  const { client, auth } = useScaleMuleContext()

  const [isSupported, setIsSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [tokenId, setTokenId] = useState<string | null>(null)

  const onNotificationRef = useRef(onNotification)
  useEffect(() => {
    onNotificationRef.current = onNotification
  }, [onNotification])

  const prevAuthRef = useRef<boolean>(false)

  // Build fetcher that calls the SDK client directly
  const fetcher: PushApiFetcher = useMemo(() => ({
    async getSettings() {
      const result = await client.communication.getMyPushSettings()
      if (result.error) throw new Error(result.error.message)
      return result.data!
    },
    async registerToken(data) {
      const result = await client.communication.registerPushToken(data)
      if (result.error) throw new Error(result.error.message)
      return { id: result.data!.id }
    },
    async unregisterToken(id) {
      await client.communication.unregisterPushTokenById(id)
    },
    async associateUser(id) {
      await client.communication.associatePushTokenUserById(id)
    },
    async disassociateUser(id) {
      await client.communication.disassociatePushTokenUser(id)
    },
  }), [client])

  // Build the WebPushManager
  const manager = useMemo(() => {
    if (typeof window === 'undefined') return null
    try {
      return new WebPushManager({ fetcher, serviceWorkerUrl })
    } catch {
      return null
    }
  }, [fetcher, serviceWorkerUrl])

  // Check initial state
  useEffect(() => {
    if (!manager) return
    const supported = manager.isSupported()
    setIsSupported(supported)
    setPermission(manager.getPermissionState())

    if (supported) {
      manager.isSubscribed().then((sub) => {
        setIsSubscribed(sub)
        setTokenId(manager.getTokenId())
      })
    }
  }, [manager])

  // Listen for service worker messages
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    function handleMessage(event: MessageEvent) {
      if (event.data?.type === 'push-received') {
        onNotificationRef.current?.(event.data.payload)
      }
    }

    navigator.serviceWorker.addEventListener('message', handleMessage)
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage)
  }, [])

  // Auto-associate on login
  useEffect(() => {
    if (!manager) return
    const isAuthed = auth.isAuthenticated
    const wasAuthed = prevAuthRef.current

    if (isAuthed && !wasAuthed && isSubscribed) {
      manager.associateUser().catch(() => {})
    }

    prevAuthRef.current = isAuthed
  }, [auth.isAuthenticated, manager, isSubscribed])

  const subscribe = useCallback(async () => {
    if (!manager) return
    setIsLoading(true)
    setError(null)

    try {
      const result = await manager.subscribe()
      if (result) {
        setIsSubscribed(true)
        setTokenId(result.tokenId)
        setPermission('granted')
      } else {
        setPermission(manager.getPermissionState())
      }
    } catch (e) {
      setError({
        code: 'PUSH_SUBSCRIBE_ERROR',
        message: e instanceof Error ? e.message : 'Failed to subscribe',
        status: 500,
      })
    } finally {
      setIsLoading(false)
    }
  }, [manager])

  const unsubscribe = useCallback(async () => {
    if (!manager) return
    setIsLoading(true)
    setError(null)

    try {
      await manager.unsubscribe()
      setIsSubscribed(false)
      setTokenId(null)
    } catch (e) {
      setError({
        code: 'PUSH_UNSUBSCRIBE_ERROR',
        message: e instanceof Error ? e.message : 'Failed to unsubscribe',
        status: 500,
      })
    } finally {
      setIsLoading(false)
    }
  }, [manager])

  const disassociateUser = useCallback(async () => {
    if (!manager) return
    try {
      await manager.disassociateUser()
    } catch {
      // Best effort
    }
  }, [manager])

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    disassociateUser,
    tokenId,
  }
}
