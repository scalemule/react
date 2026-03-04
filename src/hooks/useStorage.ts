/**
 * useStorage Hook
 *
 * Upload, list, and delete files with progress tracking.
 */

import { useState, useCallback, useEffect } from 'react'
import { useScaleMuleContext } from '../context'
import type { ApiError } from '@scalemule/sdk'
import type { FileInfo, UploadOptions } from '@scalemule/sdk'

interface UseStorageOptions {
  /** Auto-fetch file list on mount */
  autoFetch?: boolean
}

interface UseStorageReturn {
  files: FileInfo[]
  isLoading: boolean
  isUploading: boolean
  uploadProgress: number
  error: ApiError | null

  /** Upload a file */
  upload: (file: File, options?: UploadOptions) => Promise<FileInfo | null>
  /** List files */
  list: () => Promise<void>
  /** Get file info */
  get: (fileId: string) => Promise<FileInfo | null>
  /** Delete a file */
  remove: (fileId: string) => Promise<boolean>
  /** Get a signed download URL */
  getUrl: (fileId: string) => Promise<string | null>
  /** Refresh the file list */
  refresh: () => Promise<void>
}

/**
 * Hook for storage operations
 *
 * @example
 * ```tsx
 * function FileManager() {
 *   const { files, upload, remove, isUploading, uploadProgress } = useStorage({ autoFetch: true })
 *
 *   const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
 *     const file = e.target.files?.[0]
 *     if (file) {
 *       await upload(file, { onProgress: (p) => console.log(p) })
 *     }
 *   }
 *
 *   return (
 *     <div>
 *       <input type="file" onChange={handleUpload} />
 *       {isUploading && <progress value={uploadProgress} max={100} />}
 *       <ul>
 *         {files.map((f) => (
 *           <li key={f.id}>
 *             {f.filename} ({f.size_bytes} bytes)
 *             <button onClick={() => remove(f.id)}>Delete</button>
 *           </li>
 *         ))}
 *       </ul>
 *     </div>
 *   )
 * }
 * ```
 */
export function useStorage(options?: UseStorageOptions): UseStorageReturn {
  const { client } = useScaleMuleContext()
  const autoFetch = options?.autoFetch ?? false
  const [files, setFiles] = useState<FileInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<ApiError | null>(null)

  const list = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    const response = await client.storage.list()
    if (response.error) {
      setError(response.error)
    } else {
      setFiles(response.data || [])
    }
    setIsLoading(false)
  }, [client])

  const upload = useCallback(
    async (file: File, uploadOpts?: UploadOptions): Promise<FileInfo | null> => {
      setIsUploading(true)
      setUploadProgress(0)
      setError(null)
      const response = await client.storage.upload(file, {
        ...uploadOpts,
        onProgress: (progress: number) => {
          setUploadProgress(progress)
          uploadOpts?.onProgress?.(progress)
        },
      })
      setIsUploading(false)
      if (response.error) {
        setError(response.error)
        return null
      }
      const fileInfo = response.data as FileInfo
      setFiles((prev) => [fileInfo, ...prev])
      return fileInfo
    },
    [client]
  )

  const get = useCallback(
    async (fileId: string): Promise<FileInfo | null> => {
      setError(null)
      const response = await client.storage.getInfo(fileId)
      if (response.error) {
        setError(response.error)
        return null
      }
      return response.data as FileInfo
    },
    [client]
  )

  const remove = useCallback(
    async (fileId: string): Promise<boolean> => {
      setError(null)
      const response = await client.storage.delete(fileId)
      if (response.error) {
        setError(response.error)
        return false
      }
      setFiles((prev) => prev.filter((f) => f.id !== fileId))
      return true
    },
    [client]
  )

  const getUrl = useCallback(
    async (fileId: string): Promise<string | null> => {
      setError(null)
      const response = await client.storage.getDownloadUrl(fileId)
      if (response.error) {
        setError(response.error)
        return null
      }
      return response.data?.url || null
    },
    [client]
  )

  const refresh = useCallback(async () => {
    await list()
  }, [list])

  // Auto-fetch on mount
  useEffect(() => {
    if (!autoFetch) return
    void list()
  }, [autoFetch, list])

  return { files, isLoading, isUploading, uploadProgress, error, upload, list, get, remove, getUrl, refresh }
}
