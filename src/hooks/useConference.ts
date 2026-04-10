/**
 * useConference Hook
 *
 * Audio/video conferencing: call lifecycle, participants, recording, and settings.
 */

import { useCallback, useState } from 'react'
import { useScaleMuleContext } from '../context'
import type {
  CallSession,
  CallParticipant,
  JoinCallResponse,
  ConferenceSettings,
  WebrtcStats,
} from '@scalemule/sdk'
import type { ApiError } from '@scalemule/sdk'

interface UseConferenceOptions {
  autoFetch?: boolean
}

interface UseConferenceReturn {
  call: CallSession | null
  participants: CallParticipant[]
  isLoading: boolean
  error: ApiError | null

  createCall: (data: {
    conversation_id?: string
    call_type?: 'audio' | 'video' | 'screen_share'
    metadata?: Record<string, unknown>
  }) => Promise<CallSession | null>

  joinCall: (callId: string) => Promise<JoinCallResponse | null>
  leaveCall: (callId: string) => Promise<boolean>
  endCall: (callId: string) => Promise<CallSession | null>

  getCall: (callId: string) => Promise<CallSession | null>
  listParticipants: (callId: string) => Promise<void>

  startRecording: (callId: string) => Promise<{ recording_id: string } | null>
  stopRecording: (callId: string) => Promise<{ recording_id: string } | null>
  consentToRecording: (callId: string) => Promise<boolean>

  getSettings: () => Promise<ConferenceSettings | null>
  updateSettings: (data: Partial<ConferenceSettings>) => Promise<ConferenceSettings | null>

  submitStats: (callId: string, stats: WebrtcStats) => Promise<boolean>
}

/**
 * Hook for audio/video conferencing operations
 *
 * @example
 * ```tsx
 * function VideoCall({ callId }: { callId: string }) {
 *   const { call, participants, joinCall, leaveCall, isLoading } = useConference()
 *
 *   useEffect(() => { joinCall(callId) }, [callId])
 *
 *   return (
 *     <div>
 *       <p>Status: {call?.status}</p>
 *       <p>Participants: {participants.length}</p>
 *       <button onClick={() => leaveCall(callId)}>Leave</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useConference(_options?: UseConferenceOptions): UseConferenceReturn {
  const { client } = useScaleMuleContext()
  const [call, setCall] = useState<CallSession | null>(null)
  const [participants, setParticipants] = useState<CallParticipant[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const createCall = useCallback(
    async (data: {
      conversation_id?: string
      call_type?: 'audio' | 'video' | 'screen_share'
      metadata?: Record<string, unknown>
    }): Promise<CallSession | null> => {
      setError(null)
      setIsLoading(true)
      try {
        const response = await client.conference.createCall(data)
        if (response.error) {
          setError(response.error)
          return null
        }
        setCall(response.data)
        return response.data
      } finally {
        setIsLoading(false)
      }
    },
    [client],
  )

  const joinCall = useCallback(
    async (callId: string): Promise<JoinCallResponse | null> => {
      setError(null)
      const response = await client.conference.joinCall(callId)
      if (response.error) {
        setError(response.error)
        return null
      }
      return response.data
    },
    [client],
  )

  const leaveCall = useCallback(
    async (callId: string): Promise<boolean> => {
      setError(null)
      const response = await client.conference.leaveCall(callId)
      if (response.error) {
        setError(response.error)
        return false
      }
      setCall(null)
      return true
    },
    [client],
  )

  const endCall = useCallback(
    async (callId: string): Promise<CallSession | null> => {
      setError(null)
      const response = await client.conference.endCall(callId)
      if (response.error) {
        setError(response.error)
        return null
      }
      setCall(response.data)
      return response.data
    },
    [client],
  )

  const getCall = useCallback(
    async (callId: string): Promise<CallSession | null> => {
      setError(null)
      const response = await client.conference.getCall(callId)
      if (response.error) {
        setError(response.error)
        return null
      }
      setCall(response.data)
      return response.data
    },
    [client],
  )

  const listParticipants = useCallback(
    async (callId: string): Promise<void> => {
      setError(null)
      const response = await client.conference.listParticipants(callId)
      if (response.error) {
        setError(response.error)
        return
      }
      if (response.data) {
        setParticipants(response.data)
      }
    },
    [client],
  )

  const startRecording = useCallback(
    async (callId: string): Promise<{ recording_id: string } | null> => {
      setError(null)
      const response = await client.conference.startRecording(callId)
      if (response.error) {
        setError(response.error)
        return null
      }
      return response.data as { recording_id: string } | null
    },
    [client],
  )

  const stopRecording = useCallback(
    async (callId: string): Promise<{ recording_id: string } | null> => {
      setError(null)
      const response = await client.conference.stopRecording(callId)
      if (response.error) {
        setError(response.error)
        return null
      }
      return response.data as { recording_id: string } | null
    },
    [client],
  )

  const consentToRecording = useCallback(
    async (callId: string): Promise<boolean> => {
      setError(null)
      const response = await client.conference.consentToRecording(callId)
      if (response.error) {
        setError(response.error)
        return false
      }
      return true
    },
    [client],
  )

  const getSettings = useCallback(async (): Promise<ConferenceSettings | null> => {
    setError(null)
    const response = await client.conference.getSettings()
    if (response.error) {
      setError(response.error)
      return null
    }
    return response.data
  }, [client])

  const updateSettings = useCallback(
    async (data: Partial<ConferenceSettings>): Promise<ConferenceSettings | null> => {
      setError(null)
      const response = await client.conference.updateSettings(data)
      if (response.error) {
        setError(response.error)
        return null
      }
      return response.data
    },
    [client],
  )

  const submitStats = useCallback(
    async (callId: string, stats: WebrtcStats): Promise<boolean> => {
      const response = await client.conference.submitStats(callId, stats)
      return !response.error
    },
    [client],
  )

  return {
    call,
    participants,
    isLoading,
    error,
    createCall,
    joinCall,
    leaveCall,
    endCall,
    getCall,
    listParticipants,
    startRecording,
    stopRecording,
    consentToRecording,
    getSettings,
    updateSettings,
    submitStats,
  }
}
