/**
 * useUser Hook
 *
 * Provides the current user and loading state
 */

import { useScaleMuleContext } from '../context'
import type { User } from '../types'

interface UseUserReturn {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  refreshUser: () => Promise<void>
}

/**
 * Hook for accessing the current user
 *
 * @example
 * ```tsx
 * function Profile() {
 *   const { user, isLoading, isAuthenticated } = useUser()
 *
 *   if (isLoading) return <div>Loading...</div>
 *   if (!isAuthenticated) return <div>Please log in</div>
 *
 *   return (
 *     <div>
 *       <h1>Welcome, {user.full_name || user.email}</h1>
 *       <p>Email: {user.email} {user.email_verified ? '(verified)' : '(not verified)'}</p>
 *     </div>
 *   )
 * }
 * ```
 */
export function useUser(): UseUserReturn {
  const { auth, refreshUser } = useScaleMuleContext()

  return {
    user: auth.user,
    isLoading: auth.isLoading,
    isAuthenticated: auth.isAuthenticated,
    refreshUser,
  }
}
