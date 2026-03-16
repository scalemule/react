import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useScaleMuleContext } from '../context'
import type { ApiError, FlagEvaluation } from '@scalemule/sdk'

export interface UseFeatureFlagsOptions {
  environment?: string
  context?: Record<string, unknown>
  keys?: string[]
  enabled?: boolean
}

export interface UseFeatureFlagsReturn {
  flags: Record<string, FlagEvaluation>
  loading: boolean
  error: ApiError | null
  refresh: () => Promise<void>
  isEnabled: (flagKey: string, fallback?: boolean) => boolean
  getFlag: <T = unknown>(flagKey: string, fallback?: T) => T
}

export function useFeatureFlags(options: UseFeatureFlagsOptions = {}): UseFeatureFlagsReturn {
  const { environment = 'prod', context = {}, keys, enabled = true } = options

  const { client } = useScaleMuleContext()
  const [flags, setFlags] = useState<Record<string, FlagEvaluation>>({})
  const [loading, setLoading] = useState<boolean>(enabled)
  const [error, setError] = useState<ApiError | null>(null)

  // Deprecation warning for keyless usage (once per mount)
  const warnedRef = useRef(false)
  useEffect(() => {
    if (!warnedRef.current && (!keys || keys.length === 0)) {
      warnedRef.current = true
      console.warn(
        'useFeatureFlags: "keys" option should be provided. Calling /evaluate/all without explicit keys is deprecated and will be blocked in a future release. Pass keys: ["flag1", "flag2"].'
      )
    }
  }, [keys])

  const contextRef = useRef<Record<string, unknown>>(context)
  const keysKey = useMemo(() => (keys && keys.length > 0 ? [...keys].sort().join('|') : ''), [keys])

  useEffect(() => {
    contextRef.current = context
  }, [context])

  const keysRef = useRef(keys)
  useEffect(() => {
    keysRef.current = keys
  }, [keys])

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      return
    }

    setLoading(true)
    const currentKeys = keysRef.current
    const result = currentKeys && currentKeys.length > 0
      ? await client.flags.evaluateBatch(currentKeys, contextRef.current, environment)
      : await client.flags.evaluateAll(contextRef.current, environment)

    if (result.error) {
      setError(result.error)
    } else {
      setFlags(result.data || {})
      setError(null)
    }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, enabled, environment, keysKey])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const isEnabled = useCallback(
    (flagKey: string, fallback = false): boolean => {
      const evaluation = flags[flagKey]
      if (!evaluation) return fallback
      return typeof evaluation.value === 'boolean' ? evaluation.value : fallback
    },
    [flags]
  )

  const getFlag = useCallback(
    <T,>(flagKey: string, fallback?: T): T => {
      const evaluation = flags[flagKey]
      if (!evaluation) return fallback as T
      return (evaluation.value as T) ?? (fallback as T)
    },
    [flags]
  )

  return { flags, loading, error, refresh, isEnabled, getFlag }
}
