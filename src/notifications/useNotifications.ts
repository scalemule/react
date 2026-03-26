/**
 * useNotifications — consumer hook for notification data and actions.
 *
 * Returns notification state and actions from the shared NotificationsProvider.
 * Does NOT render anything — use <NotificationsViewport> for toast rendering.
 *
 * @example
 * ```tsx
 * function NotificationBadge() {
 *   const { unreadCount, markAllRead } = useNotifications()
 *   return (
 *     <button onClick={markAllRead}>
 *       Notifications {unreadCount > 0 && `(${unreadCount})`}
 *     </button>
 *   )
 * }
 * ```
 */

import { useNotificationsContext } from './NotificationsProvider'
import type { Notification } from '@scalemule/sdk'

export interface UseNotificationsReturn {
  /** All recent notifications */
  notifications: Notification[]
  /** Number of unread notifications */
  unreadCount: number
  /** Mark a single notification as read */
  markRead: (id: string) => Promise<void>
  /** Mark all notifications as read */
  markAllRead: () => Promise<void>
  /** Dismiss a notification */
  dismiss: (id: string) => Promise<void>
}

export function useNotifications(): UseNotificationsReturn {
  const { notifications, unreadCount, markRead, markAllRead, dismiss } =
    useNotificationsContext()

  return {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    dismiss,
  }
}
