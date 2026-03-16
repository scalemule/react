/**
 * ScaleMule React Context and Provider
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { ScaleMule } from '@scalemule/sdk'
import type { AuthSession } from '@scalemule/sdk'
import type { User, AuthState, ScaleMuleConfig, LoginCredentials, RegisterCredentials } from './types'
import { toBaseConfig } from './types'

interface ScaleMuleContextValue {
  client: ScaleMule
  auth: AuthState
  login: (credentials: LoginCredentials) => Promise<User>
  register: (credentials: RegisterCredentials) => Promise<User>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  signInWithOtp: (data: { email: string }) => Promise<void>
  verifyOtp: (data: { email: string; code: string }) => Promise<User>
  signInWithMagicLink: (data: { email: string }) => Promise<void>
  verifyMagicLink: (data: { token: string }) => Promise<User>
  setAccessToken: (token: string) => void
  clearAccessToken: () => void
}

const ScaleMuleContext = createContext<ScaleMuleContextValue | null>(null)

interface ScaleMuleProviderProps {
  config: ScaleMuleConfig
  children: ReactNode
  /** Session token to restore on mount */
  initialToken?: string
  /** Callback when auth state changes */
  onAuthChange?: (user: User | null) => void
}

/**
 * ScaleMule Provider Component
 *
 * Wrap your app with this provider to use ScaleMule hooks.
 *
 * @example
 * ```tsx
 * <ScaleMuleProvider config={{ apiKey: 'your_api_key' }}>
 *   <App />
 * </ScaleMuleProvider>
 * ```
 */
export function ScaleMuleProvider({
  config,
  children,
  initialToken,
  onAuthChange,
}: ScaleMuleProviderProps) {
  const [client] = useState(() => new ScaleMule(toBaseConfig(config)))
  const [auth, setAuth] = useState<AuthState>({
    user: null,
    isLoading: !!initialToken,
    isAuthenticated: false,
    error: null,
  })

  // Notify on auth change
  useEffect(() => {
    onAuthChange?.(auth.user)
  }, [auth.user, onAuthChange])

  const refreshUser = useCallback(async () => {
    setAuth((prev) => ({ ...prev, isLoading: true, error: null }))
    const response = await client.auth.me()
    if (response.error) {
      setAuth({ user: null, isLoading: false, isAuthenticated: false, error: response.error })
    } else {
      setAuth({ user: response.data as User, isLoading: false, isAuthenticated: true, error: null })
    }
  }, [client])

  // Set initial token and fetch user
  useEffect(() => {
    if (!initialToken) return
    client.setAccessToken(initialToken)
    void refreshUser()
  }, [initialToken, client, refreshUser])

  const login = useCallback(
    async (credentials: LoginCredentials): Promise<User> => {
      setAuth((prev) => ({ ...prev, isLoading: true, error: null }))
      const response = await client.auth.login(credentials)
      if (response.error) {
        setAuth((prev) => ({ ...prev, isLoading: false, error: response.error }))
        throw new Error(response.error.message)
      }
      const data = response.data as AuthSession | null
      const token = data?.session_token || data?.access_token
      if (token) {
        client.setAccessToken(token)
      }
      const user = (data?.user || data) as User
      setAuth({ user, isLoading: false, isAuthenticated: true, error: null })
      return user
    },
    [client]
  )

  const register = useCallback(
    async (credentials: RegisterCredentials): Promise<User> => {
      setAuth((prev) => ({ ...prev, isLoading: true, error: null }))
      const response = await client.auth.register(credentials)
      if (response.error) {
        setAuth((prev) => ({ ...prev, isLoading: false, error: response.error }))
        throw new Error(response.error.message)
      }
      const data = response.data as AuthSession | null
      const token = data?.session_token || data?.access_token
      if (token) {
        client.setAccessToken(token)
      }
      const user = (data?.user || data) as User
      setAuth({ user, isLoading: false, isAuthenticated: true, error: null })
      return user
    },
    [client]
  )

  const logout = useCallback(async () => {
    setAuth((prev) => ({ ...prev, isLoading: true }))
    await client.auth.logout()
    client.clearAccessToken()
    setAuth({ user: null, isLoading: false, isAuthenticated: false, error: null })
  }, [client])

  const signInWithOtp = useCallback(
    async (data: { email: string }) => {
      setAuth((prev) => ({ ...prev, isLoading: true, error: null }))
      const response = await client.auth.signInWithOtp(data)
      if (response.error) {
        setAuth((prev) => ({ ...prev, isLoading: false, error: response.error }))
        throw new Error(response.error.message)
      }
      setAuth((prev) => ({ ...prev, isLoading: false }))
    },
    [client]
  )

  const verifyOtp = useCallback(
    async (otpData: { email: string; code: string }): Promise<User> => {
      setAuth((prev) => ({ ...prev, isLoading: true, error: null }))
      const response = await client.auth.verifyOtp(otpData)
      if (response.error) {
        setAuth((prev) => ({ ...prev, isLoading: false, error: response.error }))
        throw new Error(response.error.message)
      }
      const session = response.data as AuthSession | null
      const token = session?.session_token || session?.access_token
      if (token) {
        client.setAccessToken(token)
      }
      const user = (session?.user || session) as User
      setAuth({ user, isLoading: false, isAuthenticated: true, error: null })
      return user
    },
    [client]
  )

  const signInWithMagicLink = useCallback(
    async (data: { email: string }) => {
      setAuth((prev) => ({ ...prev, isLoading: true, error: null }))
      const response = await client.auth.signInWithMagicLink(data)
      if (response.error) {
        setAuth((prev) => ({ ...prev, isLoading: false, error: response.error }))
        throw new Error(response.error.message)
      }
      setAuth((prev) => ({ ...prev, isLoading: false }))
    },
    [client]
  )

  const verifyMagicLink = useCallback(
    async (data: { token: string }): Promise<User> => {
      setAuth((prev) => ({ ...prev, isLoading: true, error: null }))
      const response = await client.auth.verifyMagicLink(data)
      if (response.error) {
        setAuth((prev) => ({ ...prev, isLoading: false, error: response.error }))
        throw new Error(response.error.message)
      }
      const session = response.data as AuthSession
      const token = session.session_token || session.access_token
      if (token) {
        client.setAccessToken(token)
      }
      const user = session.user as User
      setAuth({ user, isLoading: false, isAuthenticated: true, error: null })
      return user
    },
    [client]
  )

  const setAccessToken = useCallback(
    (token: string) => {
      client.setAccessToken(token)
    },
    [client]
  )

  const clearAccessToken = useCallback(() => {
    client.clearAccessToken()
    setAuth({ user: null, isLoading: false, isAuthenticated: false, error: null })
  }, [client])

  const value: ScaleMuleContextValue = {
    client,
    auth,
    login,
    register,
    logout,
    refreshUser,
    signInWithOtp,
    verifyOtp,
    signInWithMagicLink,
    verifyMagicLink,
    setAccessToken,
    clearAccessToken,
  }

  return (
    <ScaleMuleContext.Provider value={value}>
      {children}
    </ScaleMuleContext.Provider>
  )
}

/**
 * Hook to access the ScaleMule context
 *
 * @throws Error if used outside of ScaleMuleProvider
 */
export function useScaleMuleContext(): ScaleMuleContextValue {
  const context = useContext(ScaleMuleContext)
  if (!context) {
    throw new Error('useScaleMuleContext must be used within a ScaleMuleProvider')
  }
  return context
}
