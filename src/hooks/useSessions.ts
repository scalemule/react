/**
 * useSessions Hook
 *
 * Provides session management functionality
 */

import { useState, useCallback } from 'react'
import { useScaleMuleContext } from '../context'
import type { ApiError } from '@scalemule/sdk'
import type { Session } from '../types'

interface UseSessionsReturn {
  sessions: Session[]
  isLoading: boolean
  error: ApiError | null
  fetchSessions: () => Promise<void>
  revokeSession: (sessionId: string) => Promise<void>
  revokeOtherSessions: () => Promise<number>
}

/**
 * Hook for session management
 *
 * @example
 * ```tsx
 * function SessionsList() {
 *   const { sessions, isLoading, fetchSessions, revokeSession } = useSessions()
 *
 *   useEffect(() => { fetchSessions() }, [])
 *
 *   if (isLoading) return <div>Loading sessions...</div>
 *
 *   return (
 *     <ul>
 *       {sessions.map((session) => (
 *         <li key={session.id}>
 *           {session.device} {session.is_current && '(current)'}
 *           {!session.is_current && (
 *             <button onClick={() => revokeSession(session.id)}>Revoke</button>
 *           )}
 *         </li>
 *       ))}
 *     </ul>
 *   )
 * }
 * ```
 */
export function useSessions(): UseSessionsReturn {
  const { client } = useScaleMuleContext()
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const fetchSessions = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    const response = await client.auth.sessions.list()
    if (response.error) {
      setError(response.error)
    } else {
      const raw = response.data as unknown
      setSessions(Array.isArray(raw) ? raw : (raw as { sessions?: Session[] })?.sessions ?? [])
    }
    setIsLoading(false)
  }, [client])

  const revokeSession = useCallback(
    async (sessionId: string) => {
      setIsLoading(true)
      setError(null)
      const response = await client.auth.sessions.revoke(sessionId)
      if (response.error) {
        setError(response.error)
        setIsLoading(false)
        throw new Error(response.error.message)
      }
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
      setIsLoading(false)
    },
    [client]
  )

  const revokeOtherSessions = useCallback(async (): Promise<number> => {
    setIsLoading(true)
    setError(null)
    const response = await client.auth.sessions.revokeAll()
    if (response.error) {
      setError(response.error)
      setIsLoading(false)
      throw new Error(response.error.message)
    }
    const revokedCount = response.data?.revoked_count || 0
    setSessions((prev) => prev.filter((s) => s.is_current))
    setIsLoading(false)
    return revokedCount
  }, [client])

  return { sessions, isLoading, error, fetchSessions, revokeSession, revokeOtherSessions }
}
