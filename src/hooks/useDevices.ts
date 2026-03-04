/**
 * useDevices Hook
 *
 * Provides device management functionality
 */

import { useState, useCallback } from 'react'
import { useScaleMuleContext } from '../context'
import type { ApiError, DeviceInfo } from '@scalemule/sdk'

type Device = DeviceInfo

interface UseDevicesReturn {
  devices: Device[]
  isLoading: boolean
  error: ApiError | null
  fetchDevices: () => Promise<void>
  trustDevice: (deviceId: string) => Promise<void>
  blockDevice: (deviceId: string) => Promise<void>
  deleteDevice: (deviceId: string) => Promise<void>
}

/**
 * Hook for device management
 *
 * @example
 * ```tsx
 * function DevicesPage() {
 *   const { devices, fetchDevices, trustDevice, blockDevice } = useDevices()
 *
 *   useEffect(() => { fetchDevices() }, [])
 *
 *   return (
 *     <ul>
 *       {devices.map((device) => (
 *         <li key={device.id}>
 *           {device.device_name} - Trust: {device.trust_level}
 *           {device.is_current && ' (current)'}
 *         </li>
 *       ))}
 *     </ul>
 *   )
 * }
 * ```
 */
export function useDevices(): UseDevicesReturn {
  const { client } = useScaleMuleContext()
  const [devices, setDevices] = useState<Device[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const fetchDevices = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    const response = await client.auth.devices.list()
    if (response.error) {
      setError(response.error)
    } else {
      const raw = response.data as unknown
      setDevices(Array.isArray(raw) ? raw : (raw as { devices?: Device[] })?.devices ?? [])
    }
    setIsLoading(false)
  }, [client])

  const trustDevice = useCallback(
    async (deviceId: string) => {
      setIsLoading(true)
      setError(null)
      const response = await client.auth.devices.trust(deviceId)
      if (response.error) {
        setError(response.error)
        setIsLoading(false)
        throw new Error(response.error.message)
      }
      setDevices((prev) =>
        prev.map((d) => (d.id === deviceId ? { ...d, trust_level: 'high' } : d))
      )
      setIsLoading(false)
    },
    [client]
  )

  const blockDevice = useCallback(
    async (deviceId: string) => {
      setIsLoading(true)
      setError(null)
      const response = await client.auth.devices.block(deviceId)
      if (response.error) {
        setError(response.error)
        setIsLoading(false)
        throw new Error(response.error.message)
      }
      setDevices((prev) =>
        prev.map((d) => (d.id === deviceId ? { ...d, is_blocked: true } : d))
      )
      setIsLoading(false)
    },
    [client]
  )

  const deleteDevice = useCallback(
    async (deviceId: string) => {
      setIsLoading(true)
      setError(null)
      const response = await client.auth.devices.delete(deviceId)
      if (response.error) {
        setError(response.error)
        setIsLoading(false)
        throw new Error(response.error.message)
      }
      setDevices((prev) => prev.filter((d) => d.id !== deviceId))
      setIsLoading(false)
    },
    [client]
  )

  return { devices, isLoading, error, fetchDevices, trustDevice, blockDevice, deleteDevice }
}
