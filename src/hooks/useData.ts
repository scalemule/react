/**
 * useData Hook
 *
 * CRUD + query operations on a data collection with loading/error state.
 */

import { useState, useCallback, useEffect } from 'react'
import { useScaleMuleContext } from '../context'
import type { ApiError } from '@scalemule/sdk'
import type { Document, QueryOptions } from '@scalemule/sdk'

interface UseDataOptions {
  /** Auto-fetch documents on mount */
  autoFetch?: boolean
  /** Initial query options */
  initialQuery?: QueryOptions
}

interface UseDataReturn {
  documents: Document[]
  isLoading: boolean
  error: ApiError | null
  total: number
  page: number
  totalPages: number

  /** Fetch documents with optional query */
  fetch: (query?: QueryOptions) => Promise<void>
  /** Create a new document */
  create: (data: Record<string, unknown>) => Promise<Document | null>
  /** Get a single document by ID */
  get: (id: string) => Promise<Document | null>
  /** Update a document */
  update: (id: string, data: Record<string, unknown>) => Promise<Document | null>
  /** Delete a document */
  remove: (id: string) => Promise<boolean>
  /** Query with filters */
  query: (options: QueryOptions) => Promise<void>
  /** Fetch current user's documents */
  mine: () => Promise<void>
}

/**
 * Hook for data collection operations
 *
 * @example
 * ```tsx
 * function TodoList() {
 *   const { documents, isLoading, create, remove, fetch } = useData('todos', { autoFetch: true })
 *
 *   const addTodo = async (title: string) => {
 *     await create({ title, done: false })
 *     await fetch() // refresh list
 *   }
 *
 *   if (isLoading) return <div>Loading...</div>
 *
 *   return (
 *     <ul>
 *       {documents.map((doc) => (
 *         <li key={doc.id}>
 *           {(doc as any).title}
 *           <button onClick={() => remove(doc.id)}>Delete</button>
 *         </li>
 *       ))}
 *     </ul>
 *   )
 * }
 * ```
 */
export function useData(collection: string, options?: UseDataOptions): UseDataReturn {
  const { client } = useScaleMuleContext()
  const autoFetch = options?.autoFetch ?? false
  const initialQuery = options?.initialQuery
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetch = useCallback(
    async (query?: QueryOptions) => {
      setIsLoading(true)
      setError(null)
      const response = await client.data.query(collection, query || {})
      if (response.error) {
        setError(response.error)
      } else {
        const docs = response.data || []
        setDocuments(docs)
        setTotal(response.metadata?.total ?? docs.length)
        setPage(response.metadata?.page ?? 1)
        setTotalPages(response.metadata?.totalPages ?? 1)
      }
      setIsLoading(false)
    },
    [client, collection]
  )

  const create = useCallback(
    async (data: Record<string, unknown>): Promise<Document | null> => {
      setIsLoading(true)
      setError(null)
      const response = await client.data.create(collection, data)
      setIsLoading(false)
      if (response.error) {
        setError(response.error)
        return null
      }
      return response.data as Document
    },
    [client, collection]
  )

  const get = useCallback(
    async (id: string): Promise<Document | null> => {
      setIsLoading(true)
      setError(null)
      const response = await client.data.get(collection, id)
      setIsLoading(false)
      if (response.error) {
        setError(response.error)
        return null
      }
      return response.data as Document
    },
    [client, collection]
  )

  const update = useCallback(
    async (id: string, data: Record<string, unknown>): Promise<Document | null> => {
      setIsLoading(true)
      setError(null)
      const response = await client.data.update(collection, id, data)
      setIsLoading(false)
      if (response.error) {
        setError(response.error)
        return null
      }
      return response.data as Document
    },
    [client, collection]
  )

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      setIsLoading(true)
      setError(null)
      const response = await client.data.delete(collection, id)
      setIsLoading(false)
      if (response.error) {
        setError(response.error)
        return false
      }
      // Remove from local state
      setDocuments((prev) => prev.filter((d) => d.id !== id))
      setTotal((prev) => Math.max(0, prev - 1))
      return true
    },
    [client, collection]
  )

  const query = useCallback(
    async (queryOptions: QueryOptions) => {
      await fetch(queryOptions)
    },
    [fetch]
  )

  const mine = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    const response = await client.data.myDocuments(collection)
    if (response.error) {
      setError(response.error)
    } else {
      const docs = response.data || []
      setDocuments(docs)
      setTotal(response.metadata?.total ?? docs.length)
    }
    setIsLoading(false)
  }, [client, collection])

  // Auto-fetch on mount
  useEffect(() => {
    if (!autoFetch) return
    void fetch(initialQuery)
  }, [autoFetch, initialQuery, fetch])

  return { documents, isLoading, error, total, page, totalPages, fetch, create, get, update, remove, query, mine }
}
