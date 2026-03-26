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
 * By default renders simple built-in toasts. For branded styling, provide
 * a renderToast prop or use NotificationToast from @scalemule/ui.
 */

import React from 'react'
import { createPortal } from 'react-dom'
import { useNotificationsContext } from './NotificationsProvider'
import type { ToastItem } from './NotificationsProvider'

// ============================================================================
// Types
// ============================================================================

export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'

export interface NotificationsViewportProps {
  /** Max toasts visible at once (default: 3) */
  maxVisible?: number
  /** Auto-hide duration per toast in ms (default: 5000, 0 = sticky) */
  autoHideDuration?: number
  /** Screen position (default: 'top-right') */
  position?: ToastPosition
  /** Custom toast renderer — overrides built-in toast */
  renderToast?: (toast: ToastItem, helpers: { dismiss: () => void }) => React.ReactNode
  /** Called when user clicks a toast action */
  onAction?: (id: string, actionUrl?: string) => void
}

// ============================================================================
// Built-in minimal toast (no @scalemule/ui dependency)
// ============================================================================

function DefaultToast({
  toast,
  onDismiss,
  onAction
}: {
  toast: ToastItem
  onDismiss: () => void
  onAction?: (id: string, actionUrl?: string) => void
}) {
  return (
    <div
      onClick={() => { onAction?.(toast.id, toast.actionUrl); onDismiss() }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '14px 16px',
        background: 'var(--sm-toast-bg, #ffffff)',
        color: 'var(--sm-toast-text, #1a1a1a)',
        borderRadius: 'var(--sm-toast-border-radius, 10px)',
        boxShadow: 'var(--sm-toast-shadow, 0 4px 20px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08))',
        fontFamily: 'var(--sm-toast-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
        fontSize: '14px',
        lineHeight: '1.4',
        maxWidth: '380px',
        width: '100%',
        cursor: 'pointer',
        border: '1px solid var(--sm-toast-border, rgba(0,0,0,0.06))'
      }}
      role="alert"
    >
      {toast.iconUrl && (
        <img
          src={toast.iconUrl}
          alt=""
          style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>{toast.title}</div>
        <div style={{ color: 'var(--sm-toast-text-secondary, #666)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {toast.body}
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss() }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--sm-toast-text-secondary, #999)', fontSize: 18, lineHeight: 1, flexShrink: 0 }}
        aria-label="Dismiss notification"
      >
        &times;
      </button>
    </div>
  )
}

// ============================================================================
// Component
// ============================================================================

const positionStyles: Record<ToastPosition, React.CSSProperties> = {
  'top-right': { top: 16, right: 16 },
  'top-left': { top: 16, left: 16 },
  'bottom-right': { bottom: 16, right: 16 },
  'bottom-left': { bottom: 16, left: 16 }
}

export function NotificationsViewport({
  maxVisible = 3,
  position = 'top-right',
  renderToast,
  onAction
}: NotificationsViewportProps) {
  const { toasts, dismissToast } = useNotificationsContext()
  const visibleToasts = toasts.slice(0, maxVisible)

  if (visibleToasts.length === 0) return null

  const content = (
    <div
      style={{
        position: 'fixed',
        display: 'flex',
        flexDirection: position.startsWith('bottom') ? 'column-reverse' : 'column',
        gap: 8,
        zIndex: 99999,
        pointerEvents: 'none',
        maxHeight: 'calc(100vh - 32px)',
        overflow: 'hidden',
        ...positionStyles[position]
      }}
    >
      {visibleToasts.map((toast) => (
        <div key={toast.id} style={{ pointerEvents: 'auto' }}>
          {renderToast
            ? renderToast(toast, { dismiss: () => dismissToast(toast.id) })
            : <DefaultToast toast={toast} onDismiss={() => dismissToast(toast.id)} onAction={onAction} />
          }
        </div>
      ))}
    </div>
  )

  if (typeof document !== 'undefined') {
    return createPortal(content, document.body)
  }
  return content
}
