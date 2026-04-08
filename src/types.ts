/**
 * ScaleMule React SDK Types
 */

import type {
  ApiError,
  AuthUser,
  SessionInfo,
  OAuthProvider,
  DeviceInfo,
  ScaleMuleConfig as BaseConfig,
} from '@scalemule/sdk'

// Re-export base SDK types under React-friendly aliases
export type { ApiError }
export type User = AuthUser
export type Session = SessionInfo
export type LinkedOAuthProvider = OAuthProvider
export type Device = DeviceInfo

export interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  error: ApiError | null
}

/**
 * React SDK configuration.
 *
 * Passes through to the base SDK config with React-friendly aliases.
 */
export interface ScaleMuleConfig {
  /** API key (publishable key for browser, secret key for server) */
  apiKey: string
  /** Application ID — required for realtime features (WebSocket auth, notifications) */
  applicationId?: string
  /** Base URL for API requests. Overrides environment preset. */
  baseUrl?: string
  /** Environment preset. Defaults to 'prod'. */
  environment?: 'dev' | 'prod'
  /** Request timeout in ms (default: 30000) */
  timeout?: number
  /** Enable debug logging to console */
  debug?: boolean
  /** Enable rate limit queue — auto-queues requests when rate limited */
  enableRateLimitQueue?: boolean
  /** Enable offline queue — queues requests when offline, syncs on reconnect */
  enableOfflineQueue?: boolean
  /** Enable the account switcher — remembers which accounts logged in on this device */
  enableAccountSwitcher?: boolean
  /** Privacy level for the account switcher ('full' | 'masked' | 'minimal'). Default: 'full' */
  accountSwitcherPrivacy?: 'full' | 'masked' | 'minimal'
}

export interface LoginCredentials {
  email: string
  password: string
  /** Extends session lifetime (72 hours idle, 90 days absolute) */
  remember_me?: boolean
}

export interface RegisterCredentials {
  email: string
  password: string
  full_name?: string
}

export interface PhoneOtpRequest {
  phone: string
  purpose?: 'verify_phone' | 'login' | 'password_reset' | 'change_phone'
}

/** Convert React SDK config to base SDK config */
export function toBaseConfig(config: ScaleMuleConfig): BaseConfig {
  return {
    apiKey: config.apiKey,
    applicationId: config.applicationId,
    baseUrl: config.baseUrl,
    environment: config.environment,
    timeout: config.timeout,
    debug: config.debug,
    enableRateLimitQueue: config.enableRateLimitQueue,
    enableOfflineQueue: config.enableOfflineQueue,
    enableAccountSwitcher: config.enableAccountSwitcher,
    accountSwitcherPrivacy: config.accountSwitcherPrivacy,
  }
}
