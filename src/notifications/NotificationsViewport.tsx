/**
 * NotificationsViewport — renders toast notifications via a React portal.
 *
 * Mount once at the app root alongside NotificationsProvider:
 * ```tsx
 * <ScaleMuleProvider config={...}>
 *   <NotificationsProvider>
 *     <App />
 *     <NotificationsViewport />
 *   </NotificationsProvider>
 * </ScaleMuleProvider>
 * ```
 *
 * Optional — apps that want custom toast UI can use useNotifications() directly.
 */

import React from 'react'
import { createPortal } from 'react-dom'
import { useNotificationsContext } from './NotificationsProvider'
import type { ToastItem } from './NotificationsProvider'
import type { ToastPosition, NotificationToastClassNames, NotificationContainerClassNames } from '@scalemule/ui/react'

// Lazy import NotificationContainer to avoid hard dependency on @scalemule/ui
// at module level. This allows the React SDK to work without @scalemule/ui installed
// if the consumer provides their own renderToast.
let NotificationContainer: React.ComponentType<{
  toasts: ToastItem[]
  onDismiss: (id: string) => void
  onAction?: (id: string, actionUrl?: string) => void
  position?: ToastPosition
  autoHideDuration?: number
  classNames?: NotificationContainerClassNames
  toastClassNames?: NotificationToastClassNames
  renderToast?: (toast: ToastItem, helpers: { dismiss: () => void }) => React.ReactNode
}> | null = null

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ui = require('@scalemule/ui/react')
  NotificationContainer = ui.NotificationContainer
} catch {
  // @scalemule/ui not installed — renderToast must be provided
}

// ============================================================================
// Types
// ============================================================================

export interface NotificationsViewportProps {
  /** Max toasts visible at once (default: 3) */
  maxVisible?: number
  /** Auto-hide duration per toast in ms (default: 5000, 0 = sticky) */
  autoHideDuration?: number
  /** Screen position (default: 'top-right') */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  /** Custom toast renderer — overrides default NotificationToast from @scalemule/ui */
  renderToast?: (toast: ToastItem, helpers: { dismiss: () => void }) => React.ReactNode
  /** Called when user clicks a toast action */
  onAction?: (id: string, actionUrl?: string) => void
  /** Custom class names for the container */
  classNames?: NotificationContainerClassNames
  /** Custom class names for individual toasts */
  toastClassNames?: NotificationToastClassNames
}

// ============================================================================
// Component
// ============================================================================

export function NotificationsViewport({
  maxVisible = 3,
  autoHideDuration = 5000,
  position = 'top-right',
  renderToast,
  onAction,
  classNames,
  toastClassNames,
}: NotificationsViewportProps) {
  const { toasts, dismissToast } = useNotificationsContext()
  const visibleToasts = toasts.slice(0, maxVisible)

  if (visibleToasts.length === 0) return null

  // Render without @scalemule/ui if renderToast is provided
  if (renderToast || !NotificationContainer) {
    if (!renderToast) {
      // No @scalemule/ui and no custom renderer — can't render
      if (typeof console !== 'undefined') {
        console.warn(
          '[ScaleMule] NotificationsViewport: Install @scalemule/ui or provide renderToast prop'
        )
      }
      return null
    }

    // Custom render path — simple fixed container
    const content = (
      <div
        style={{
          position: 'fixed',
          [position.includes('top') ? 'top' : 'bottom']: '16px',
          [position.includes('right') ? 'right' : 'left']: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          zIndex: 99999,
        }}
      >
        {visibleToasts.map((toast) =>
          renderToast(toast, { dismiss: () => dismissToast(toast.id) })
        )}
      </div>
    )

    if (typeof document !== 'undefined') {
      return createPortal(content, document.body)
    }
    return content
  }

  // Default path — use @scalemule/ui NotificationContainer
  const content = (
    <NotificationContainer
      toasts={visibleToasts}
      onDismiss={dismissToast}
      onAction={onAction}
      position={position}
      autoHideDuration={autoHideDuration}
      classNames={classNames}
      toastClassNames={toastClassNames}
    />
  )

  if (typeof document !== 'undefined') {
    return createPortal(content, document.body)
  }
  return content
}
