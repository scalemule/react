/**
 * NotificationsProvider — shared state store for in-app notifications.
 *
 * Mount once at app root inside <ScaleMuleProvider>:
 * ```tsx
 * <ScaleMuleProvider config={...}>
 *   <NotificationsProvider>
 *     <App />
 *   </NotificationsProvider>
 * </ScaleMuleProvider>
 * ```
 *
 * Auth gating: stays idle until auth.isAuthenticated && user?.id && applicationId
 * are all present. Tears down on logout/user switch.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'
import { useScaleMuleContext } from '../context'
import type { Notification } from '@scalemule/sdk'
import type { ConnectionStatus } from '@scalemule/sdk'

// ============================================================================
// Context types
// ============================================================================

export interface ToastItem {
  id: string
  title: string
  body: string
  iconUrl?: string
  actionUrl?: string
  createdAt: string
}

export interface NotificationsContextValue {
  /** All recent notifications (from API) */
  notifications: Notification[]
  /** Currently visible toasts */
  toasts: ToastItem[]
  /** Number of unread notifications */
  unreadCount: number
  /** Mark a notification as read */
  markRead: (id: string) => Promise<void>
  /** Mark all notifications as read */
  markAllRead: () => Promise<void>
  /** Dismiss a notification (removes from list) */
  dismiss: (id: string) => Promise<void>
  /** Dismiss a toast (removes from visible toasts, does not affect notification record) */
  dismissToast: (id: string) => void
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

// ============================================================================
// Provider
// ============================================================================

interface NotificationsProviderProps {
  children: ReactNode
  /** Max number of toasts visible simultaneously (default: 3) */
  maxToasts?: number
  /** Auto-dismiss toast after this many ms (default: 5000, 0 = sticky) */
  autoHideDuration?: number
  /** Called when a new notification arrives */
  onNotification?: (notification: Notification) => void
}

export function NotificationsProvider({
  children,
  maxToasts = 3,
  onNotification,
}: NotificationsProviderProps) {
  const { client, auth } = useScaleMuleContext()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const unsubRef = useRef<(() => void) | null>(null)
  const statusUnsubRef = useRef<(() => void) | null>(null)
  const prevUserRef = useRef<string | null>(null)

  const isReady = auth.isAuthenticated && auth.user?.id && client.getApplicationId()
  const userId = auth.user?.id ?? null
  const appId = client.getApplicationId()

  // Fetch all unread notifications
  const fetchUnread = useCallback(async () => {
    const { data } = await client.notifications.list({ unread_only: true })
    if (data) {
      setNotifications(data.notifications)
      setUnreadCount(data.notifications.filter((n: Notification) => !n.is_read).length)
    }
  }, [client])

  // Handle incoming realtime messages on the private channel
  const handleRealtimeMessage = useCallback(
    (data: unknown) => {
      const msg = data as Record<string, unknown>
      const event = msg.event as string

      if (event === 'notification.created') {
        const notif = msg.data as Notification
        // Add to notifications list
        setNotifications((prev) => [notif, ...prev])
        setUnreadCount((prev) => prev + 1)

        // Add to toast queue
        setToasts((prev) => {
          const toast: ToastItem = {
            id: notif.id,
            title: notif.title,
            body: notif.body,
            iconUrl: notif.icon_url,
            actionUrl: notif.action_url,
            createdAt: notif.created_at,
          }
          const next = [toast, ...prev]
          return next.slice(0, maxToasts)
        })

        onNotification?.(notif)
      } else if (event === 'notification.state_changed') {
        const payload = msg.data as { action: string; notification_id?: string }
        if (payload.action === 'read' && payload.notification_id) {
          setNotifications((prev) =>
            prev.map((n) =>
              n.id === payload.notification_id ? { ...n, is_read: true } : n
            )
          )
          setUnreadCount((prev) => Math.max(0, prev - 1))
        } else if (payload.action === 'read_all') {
          setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
          setUnreadCount(0)
        } else if (payload.action === 'dismiss' && payload.notification_id) {
          setNotifications((prev) =>
            prev.filter((n) => n.id !== payload.notification_id)
          )
        }
      }
    },
    [maxToasts, onNotification]
  )

  // Subscribe to realtime + fetch initial data when auth is ready
  useEffect(() => {
    if (!isReady || !appId || !userId) {
      // Not ready — tear down any existing subscription
      if (unsubRef.current) {
        unsubRef.current()
        unsubRef.current = null
      }
      if (statusUnsubRef.current) {
        statusUnsubRef.current()
        statusUnsubRef.current = null
      }
      return
    }

    // User changed (login/switch) — reset state
    if (prevUserRef.current !== userId) {
      setNotifications([])
      setToasts([])
      setUnreadCount(0)
      prevUserRef.current = userId
    }

    // Subscribe to private notification channel
    // Server uses hex-encoded UUIDs (no dashes, lowercase) for channel names
    const appIdHex = appId.replace(/-/g, '').toLowerCase()
    const userIdHex = userId.replace(/-/g, '').toLowerCase()
    const privateChannel = `private:${appIdHex}:${userIdHex}`
    const unsub = client.realtime.subscribe(privateChannel, handleRealtimeMessage)
    unsubRef.current = unsub

    // Listen for reconnect to refetch unread
    const statusUnsub = client.realtime.onStatusChange((status: ConnectionStatus) => {
      if (status === 'connected') {
        // Refetch full unread set on reconnect (handles offline state changes)
        fetchUnread()
      }
    })
    statusUnsubRef.current = statusUnsub

    // Initial fetch
    fetchUnread()

    return () => {
      unsub()
      statusUnsub()
      unsubRef.current = null
      statusUnsubRef.current = null
    }
  }, [isReady, appId, userId, client, fetchUnread, handleRealtimeMessage])

  // Actions
  const markRead = useCallback(
    async (id: string) => {
      await client.notifications.markRead(id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    },
    [client]
  )

  const markAllRead = useCallback(async () => {
    await client.notifications.markAllRead()
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }, [client])

  const dismiss = useCallback(
    async (id: string) => {
      await client.notifications.dismiss(id)
      setNotifications((prev) => prev.filter((n) => n.id !== id))
      setToasts((prev) => prev.filter((t) => t.id !== id))
    },
    [client]
  )

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const value: NotificationsContextValue = {
    notifications,
    toasts,
    unreadCount,
    markRead,
    markAllRead,
    dismiss,
    dismissToast,
  }

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  )
}

// ============================================================================
// Consumer hook
// ============================================================================

export function useNotificationsContext(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext)
  if (!ctx) {
    throw new Error(
      'useNotificationsContext must be used within a NotificationsProvider'
    )
  }
  return ctx
}
