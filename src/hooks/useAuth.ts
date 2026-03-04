/**
 * useAuth Hook
 *
 * Provides authentication state and methods including
 * OTP and magic link sign-in.
 */

import { useScaleMuleContext } from '../context'
import type { User, AuthState, LoginCredentials, RegisterCredentials } from '../types'

interface UseAuthReturn extends AuthState {
  login: (credentials: LoginCredentials) => Promise<User>
  register: (credentials: RegisterCredentials) => Promise<User>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  signInWithOtp: (data: { email: string }) => Promise<void>
  verifyOtp: (data: { email: string; code: string }) => Promise<User>
  signInWithMagicLink: (data: { email: string }) => Promise<void>
  verifyMagicLink: (data: { token: string }) => Promise<User>
}

/**
 * Hook for authentication operations
 *
 * @example
 * ```tsx
 * function LoginForm() {
 *   const { login, isLoading, error } = useAuth()
 *
 *   const handleSubmit = async (e) => {
 *     e.preventDefault()
 *     try {
 *       await login({ email, password })
 *     } catch (err) {
 *       // Handle error
 *     }
 *   }
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       {error && <div>{error.message}</div>}
 *       <button disabled={isLoading}>Login</button>
 *     </form>
 *   )
 * }
 *
 * // OTP sign-in
 * function OtpLogin() {
 *   const { signInWithOtp, verifyOtp, isLoading } = useAuth()
 *   const [sent, setSent] = useState(false)
 *
 *   const sendCode = async () => {
 *     await signInWithOtp({ email })
 *     setSent(true)
 *   }
 *
 *   const verify = async () => {
 *     const user = await verifyOtp({ email, code })
 *   }
 * }
 * ```
 */
export function useAuth(): UseAuthReturn {
  const {
    auth,
    login,
    register,
    logout,
    refreshUser,
    signInWithOtp,
    verifyOtp,
    signInWithMagicLink,
    verifyMagicLink,
  } = useScaleMuleContext()

  return {
    ...auth,
    login,
    register,
    logout,
    refreshUser,
    signInWithOtp,
    verifyOtp,
    signInWithMagicLink,
    verifyMagicLink,
  }
}
