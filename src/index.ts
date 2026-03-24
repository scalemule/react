/**
 * ScaleMule React SDK
 *
 * Official React hooks and components for ScaleMule Backend-as-a-Service (v2)
 *
 * All hooks use the { data, error } response contract from the base SDK.
 *
 * @packageDocumentation
 */

// Context and Provider
export { ScaleMuleProvider, useScaleMuleContext } from './context'

// Hooks
export { useAuth } from './hooks/useAuth'
export { useUser } from './hooks/useUser'
export { useSessions } from './hooks/useSessions'
export { useDevices } from './hooks/useDevices'
export { useLoginHistory } from './hooks/useLoginHistory'
export { useData } from './hooks/useData'
export { useStorage } from './hooks/useStorage'
export { useChat } from './hooks/useChat'
export { useRealtime } from './hooks/useRealtime'
export { useFeatureFlags } from './hooks/useFeatureFlags'
export type { UseFeatureFlagsOptions, UseFeatureFlagsReturn } from './hooks/useFeatureFlags'
export { usePushNotifications } from './hooks/usePushNotifications'
export type { UsePushNotificationsOptions, UsePushNotificationsReturn } from './hooks/usePushNotifications'

// Types
export type {
  User,
  Session,
  Device,
  LinkedOAuthProvider,
  AuthState,
  ScaleMuleConfig,
  LoginCredentials,
  RegisterCredentials,
  PhoneOtpRequest,
  ApiError,
} from './types'

// Re-export commonly needed base SDK types
export type {
  ApiResponse,
  PaginatedResponse,
  PaginationParams,
  ConnectionStatus,
  Document,
  Collection,
  QueryOptions,
  FileInfo,
  UploadOptions,
  Conversation,
  ChatMessage,
  FlagEvaluation,
  FlagDefinition,
  FlagDetail,
  FlagCondition,
  TargetingRule,
  FlagVariant,
  FlagSegment,
} from '@scalemule/sdk'

// Re-export the base SDK for advanced usage
export { ScaleMule } from '@scalemule/sdk'
export {
  PHONE_COUNTRIES,
  normalizePhoneNumber,
  normalizeAndValidatePhone,
  composePhoneNumber,
  isValidE164Phone,
  findPhoneCountryByCode,
  findPhoneCountryByDialCode,
} from '@scalemule/sdk'
export type { PhoneCountry, PhoneNormalizationResult } from '@scalemule/sdk'
