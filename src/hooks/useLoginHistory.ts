/**
 * useLoginHistory Hook
 *
 * Provides login history and activity tracking
 */

import { useState, useCallback } from 'react'
import { useScaleMuleContext } from '../context'
import type { ApiError, LoginHistoryEntry, LoginActivitySummary } from '@scalemule/sdk'

interface UseLoginHistoryReturn {
  history: LoginHistoryEntry[]
  summary: LoginActivitySummary | null
  isLoading: boolean
  error: ApiError | null
  page: number
  totalPages: number
  fetchHistory: (params?: { success?: boolean; page?: number }) => Promise<void>
  fetchSummary: () => Promise<void>
  nextPage: () => void
  prevPage: () => void
}

/**
 * Hook for login history and activity tracking
 *
 * @example
 * ```tsx
 * function SecurityPage() {
 *   const { history, summary, fetchHistory, fetchSummary, page, nextPage, prevPage } = useLoginHistory()
 *
 *   useEffect(() => {
 *     fetchHistory()
 *     fetchSummary()
 *   }, [])
 *
 *   return (
 *     <div>
 *       {summary && <p>Total logins (30d): {summary.total_logins_30d}</p>}
 *       <ul>
 *         {history.map((entry) => (
 *           <li key={entry.id}>
 *             {entry.device?.name} - {entry.location?.city}
 *             {entry.risk_score > 60 && <span>High Risk</span>}
 *           </li>
 *         ))}
 *       </ul>
 *       <button onClick={prevPage} disabled={page === 1}>Previous</button>
 *       <button onClick={nextPage}>Next</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useLoginHistory(): UseLoginHistoryReturn {
  const { client } = useScaleMuleContext()
  const [history, setHistory] = useState<LoginHistoryEntry[]>([])
  const [summary, setSummary] = useState<LoginActivitySummary | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const perPage = 20

  const fetchHistory = useCallback(
    async (params?: { success?: boolean; page?: number }) => {
      setIsLoading(true)
      setError(null)
      const queryParams = {
        page: params?.page || page,
        per_page: perPage,
        ...(params?.success !== undefined && { success: params.success }),
      }
      const response = await client.auth.loginHistory.list(queryParams)
      if (response.error) {
        setError(response.error)
      } else {
        const data = response.data as unknown as { entries?: LoginHistoryEntry[]; page?: number; total?: number } | null
        setHistory(data?.entries || [])
        setPage(data?.page || 1)
        setTotalPages(Math.ceil((data?.total || 0) / perPage))
      }
      setIsLoading(false)
    },
    [client, page]
  )

  const fetchSummary = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    const response = await client.auth.loginHistory.getSummary()
    if (response.error) {
      setError(response.error)
    } else {
      setSummary(response.data as LoginActivitySummary)
    }
    setIsLoading(false)
  }, [client])

  const nextPage = useCallback(() => {
    if (page < totalPages) {
      const newPage = page + 1
      setPage(newPage)
      fetchHistory({ page: newPage })
    }
  }, [page, totalPages, fetchHistory])

  const prevPage = useCallback(() => {
    if (page > 1) {
      const newPage = page - 1
      setPage(newPage)
      fetchHistory({ page: newPage })
    }
  }, [page, fetchHistory])

  return {
    history, summary, isLoading, error, page, totalPages,
    fetchHistory, fetchSummary, nextPage, prevPage,
  }
}
