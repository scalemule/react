/**
 * useVote Hook
 *
 * Manages a single target's vote state with optimistic updates. Wraps
 * `client.social.vote` / `client.social.getVote`.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useScaleMuleContext } from '../context'
import type { ApiError, VoteState } from '@scalemule/sdk'

export interface UseVoteOptions {
  /** Application-defined target type. e.g. "weekmob_post", "gistyo_gist". */
  targetType: string
  targetId: string
  /**
   * Optional seed (from SSR or list query). When provided, the hook
   * doesn't fetch on mount unless `refetchOnMount` is true.
   */
  initialState?: VoteState | null
  /** Refetch even when initialState is provided. Default false. */
  refetchOnMount?: boolean
  /** If false, skip the initial fetch entirely (useful for anonymous viewers). */
  enabled?: boolean
}

export interface UseVoteReturn {
  state: VoteState
  isLoading: boolean
  error: ApiError | null
  /** Cast (or change/clear) the caller's vote with optimistic update. */
  cast: (value: 1 | -1 | 0) => Promise<void>
  /** Refetch the canonical state from the server. */
  refetch: () => Promise<void>
}

const ZERO: VoteState = { value: 0, up_count: 0, down_count: 0, score: 0 }

export function useVote({
  targetType,
  targetId,
  initialState,
  refetchOnMount = false,
  enabled = true,
}: UseVoteOptions): UseVoteReturn {
  const { client } = useScaleMuleContext()
  const [state, setState] = useState<VoteState>(initialState ?? ZERO)
  const [isLoading, setIsLoading] = useState<boolean>(!initialState && enabled)
  const [error, setError] = useState<ApiError | null>(null)
  const inFlight = useRef<Promise<void> | null>(null)

  const refetch = useCallback(async () => {
    if (!enabled) return
    setIsLoading(true)
    setError(null)
    try {
      const resp = await client.social.getVote(targetType, targetId)
      if (resp.error) {
        setError(resp.error)
      } else if (resp.data) {
        setState(resp.data)
      }
    } catch (e) {
      setError(e as ApiError)
    } finally {
      setIsLoading(false)
    }
  }, [client, targetType, targetId, enabled])

  useEffect(() => {
    if (!enabled) return
    if (initialState && !refetchOnMount) return
    void refetch()
  }, [enabled, refetch, initialState, refetchOnMount])

  const cast = useCallback(
    async (value: 1 | -1 | 0) => {
      // Compute optimistic next state.
      const prev = state
      const optimistic: VoteState = applyVote(prev, value)
      setState(optimistic)
      setError(null)

      // Single-flight: if a cast is in flight, wait for it before sending
      // the next so the server's view of value-flips is consistent.
      const send = async () => {
        try {
          const resp = await client.social.vote(targetType, targetId, value)
          if (resp.error) {
            // Roll back optimistic change.
            setState(prev)
            setError(resp.error)
          } else if (resp.data) {
            setState(resp.data)
          }
        } catch (e) {
          setState(prev)
          setError(e as ApiError)
        }
      }
      const p = (inFlight.current ? inFlight.current.then(send) : send())
      inFlight.current = p
      await p
      if (inFlight.current === p) inFlight.current = null
    },
    [client, state, targetType, targetId],
  )

  return { state, isLoading, error, cast, refetch }
}

/**
 * Compute the optimistic next state after the caller casts `value`.
 * Mirrors the server's aggregate math so the UI feels instant.
 */
function applyVote(prev: VoteState, next: 1 | -1 | 0): VoteState {
  let { up_count, down_count } = prev
  if (prev.value === 1) up_count = Math.max(0, up_count - 1)
  if (prev.value === -1) down_count = Math.max(0, down_count - 1)
  if (next === 1) up_count += 1
  if (next === -1) down_count += 1
  return {
    value: next,
    up_count,
    down_count,
    score: up_count - down_count,
  }
}
