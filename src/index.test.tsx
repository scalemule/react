/**
 * @scalemule/react — Comprehensive Unit Tests
 *
 * Tests the provider, context, and all 9 hooks:
 * useAuth, useUser, useData, useStorage, useChat,
 * useRealtime, useSessions, useDevices, useLoginHistory
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { render, screen } from '@testing-library/react'
import { ScaleMuleProvider, useScaleMuleContext } from './context'
import { useAuth } from './hooks/useAuth'
import { useUser } from './hooks/useUser'
import { useData } from './hooks/useData'
import { useStorage } from './hooks/useStorage'
import { useChat } from './hooks/useChat'
import { useRealtime } from './hooks/useRealtime'
import { useSessions } from './hooks/useSessions'
import { useDevices } from './hooks/useDevices'
import { useLoginHistory } from './hooks/useLoginHistory'

// ─── Mock ScaleMule SDK ───────────────────────────────────────────

const mockAuth = {
  me: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  signInWithMagicLink: vi.fn(),
  verifyMagicLink: vi.fn(),
  sessions: {
    list: vi.fn(),
    revoke: vi.fn(),
    revokeAll: vi.fn(),
  },
  devices: {
    list: vi.fn(),
    trust: vi.fn(),
    block: vi.fn(),
    delete: vi.fn(),
  },
  loginHistory: {
    list: vi.fn(),
    getSummary: vi.fn(),
  },
}

const mockData = {
  query: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  myDocuments: vi.fn(),
}

const mockStorage = {
  list: vi.fn(),
  upload: vi.fn(),
  getInfo: vi.fn(),
  delete: vi.fn(),
  getDownloadUrl: vi.fn(),
}

const mockChat = {
  listConversations: vi.fn(),
  createConversation: vi.fn(),
  getMessages: vi.fn(),
  sendMessage: vi.fn(),
  editMessage: vi.fn(),
  deleteMessage: vi.fn(),
  addReaction: vi.fn(),
  sendTyping: vi.fn(),
  markRead: vi.fn(),
}

const statusChangeCallbacks: Array<(s: string) => void> = []

const mockRealtime = {
  subscribe: vi.fn((_channel: string, _cb: (data: unknown) => void) => vi.fn()),
  publish: vi.fn(),
  disconnect: vi.fn(),
  onStatusChange: vi.fn((cb: (s: string) => void) => {
    statusChangeCallbacks.push(cb)
    return () => {
      const idx = statusChangeCallbacks.indexOf(cb)
      if (idx >= 0) statusChangeCallbacks.splice(idx, 1)
    }
  }),
  get status() {
    return 'disconnected'
  },
}

const mockSetAccessToken = vi.fn()
const mockClearAccessToken = vi.fn()

vi.mock('@scalemule/sdk', () => ({
  ScaleMule: vi.fn().mockImplementation(() => ({
    auth: mockAuth,
    data: mockData,
    storage: mockStorage,
    chat: mockChat,
    realtime: mockRealtime,
    setAccessToken: mockSetAccessToken,
    clearAccessToken: mockClearAccessToken,
  })),
}))

// ─── Test Helpers ─────────────────────────────────────────────────

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <ScaleMuleProvider config={{ apiKey: 'sm_pb_test' }}>
      {children}
    </ScaleMuleProvider>
  )
}

function resetMocks() {
  vi.clearAllMocks()
  statusChangeCallbacks.length = 0
}

beforeEach(resetMocks)

// ─── Provider & Context Tests ─────────────────────────────────────

describe('ScaleMuleProvider', () => {
  it('provides context to children', () => {
    const { result } = renderHook(() => useScaleMuleContext(), { wrapper })
    expect(result.current.client).toBeDefined()
    expect(result.current.auth).toBeDefined()
    expect(result.current.auth.user).toBeNull()
    expect(result.current.auth.isAuthenticated).toBe(false)
    expect(result.current.auth.isLoading).toBe(false)
  })

  it('throws when useScaleMuleContext used outside provider', () => {
    expect(() => {
      renderHook(() => useScaleMuleContext())
    }).toThrow('useScaleMuleContext must be used within a ScaleMuleProvider')
  })

  it('sets isLoading true when initialToken provided', () => {
    mockAuth.me.mockResolvedValueOnce({
      data: { id: 'u1', email: 'a@b.com', email_verified: true, phone_verified: false, status: 'active', created_at: '2026-01-01' },
      error: null,
    })

    function wrapperWithToken({ children }: { children: React.ReactNode }) {
      return (
        <ScaleMuleProvider config={{ apiKey: 'sm_pb_test' }} initialToken="tok_123">
          {children}
        </ScaleMuleProvider>
      )
    }

    const { result } = renderHook(() => useUser(), { wrapper: wrapperWithToken })
    // Initially loading because of initialToken
    expect(result.current.isLoading).toBe(true)
  })

  it('calls onAuthChange when user changes', async () => {
    const onAuthChange = vi.fn()
    mockAuth.me.mockResolvedValueOnce({
      data: { id: 'u1', email: 'a@b.com' },
      error: null,
    })

    function wrapperWithCallback({ children }: { children: React.ReactNode }) {
      return (
        <ScaleMuleProvider config={{ apiKey: 'sm_pb_test' }} onAuthChange={onAuthChange}>
          {children}
        </ScaleMuleProvider>
      )
    }

    renderHook(() => useUser(), { wrapper: wrapperWithCallback })
    // onAuthChange called with null initially
    expect(onAuthChange).toHaveBeenCalledWith(null)
  })

  it('renders children', () => {
    render(
      <ScaleMuleProvider config={{ apiKey: 'sm_pb_test' }}>
        <div data-testid="child">Hello</div>
      </ScaleMuleProvider>
    )
    expect(screen.getByTestId('child')).toBeDefined()
  })
})

// ─── useAuth Tests ────────────────────────────────────────────────

describe('useAuth', () => {
  it('returns initial unauthenticated state', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.user).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('login sets user and isAuthenticated on success', async () => {
    const mockUser = { id: 'u1', email: 'test@test.com', full_name: 'Test' }
    mockAuth.login.mockResolvedValueOnce({
      data: { user: mockUser, session_token: 'tok_abc' },
      error: null,
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      const user = await result.current.login({ email: 'test@test.com', password: 'pass123' })
      expect(user).toEqual(mockUser)
    })

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.user).toEqual(mockUser)
    expect(result.current.isLoading).toBe(false)
    expect(mockSetAccessToken).toHaveBeenCalledWith('tok_abc')
  })

  it('login throws on API error', async () => {
    mockAuth.login.mockResolvedValueOnce({
      data: null,
      error: { code: 'unauthorized', message: 'Invalid credentials', status: 401 },
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await expect(result.current.login({ email: 'a@b.com', password: 'wrong' }))
        .rejects.toThrow('Invalid credentials')
    })

    expect(result.current.error).toEqual({
      code: 'unauthorized',
      message: 'Invalid credentials',
      status: 401,
    })
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('register returns user on success', async () => {
    const mockUser = { id: 'u2', email: 'new@test.com' }
    mockAuth.register.mockResolvedValueOnce({ data: mockUser, error: null })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      const user = await result.current.register({ email: 'new@test.com', password: 'pass123' })
      expect(user).toEqual(mockUser)
    })
  })

  it('register throws on error', async () => {
    mockAuth.register.mockResolvedValueOnce({
      data: null,
      error: { code: 'conflict', message: 'Email already registered', status: 409 },
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await expect(result.current.register({ email: 'dup@test.com', password: 'pass' }))
        .rejects.toThrow('Email already registered')
    })
  })

  it('logout clears user and token', async () => {
    // First login
    mockAuth.login.mockResolvedValueOnce({
      data: { user: { id: 'u1', email: 'a@b.com' }, session_token: 'tok' },
      error: null,
    })
    mockAuth.logout.mockResolvedValueOnce({ data: null, error: null })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.login({ email: 'a@b.com', password: 'pass' })
    })
    expect(result.current.isAuthenticated).toBe(true)

    await act(async () => {
      await result.current.logout()
    })

    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
    expect(mockClearAccessToken).toHaveBeenCalled()
  })

  it('signInWithOtp sends OTP and does not authenticate yet', async () => {
    mockAuth.signInWithOtp.mockResolvedValueOnce({ data: { sent: true }, error: null })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.signInWithOtp({ email: 'otp@test.com' })
    })

    expect(result.current.isAuthenticated).toBe(false)
    expect(mockAuth.signInWithOtp).toHaveBeenCalledWith({ email: 'otp@test.com' })
  })

  it('verifyOtp authenticates on success', async () => {
    const mockUser = { id: 'u3', email: 'otp@test.com' }
    mockAuth.verifyOtp.mockResolvedValueOnce({
      data: { user: mockUser, session_token: 'tok_otp' },
      error: null,
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      const user = await result.current.verifyOtp({ email: 'otp@test.com', code: '123456' })
      expect(user).toEqual(mockUser)
    })

    expect(result.current.isAuthenticated).toBe(true)
    expect(mockSetAccessToken).toHaveBeenCalledWith('tok_otp')
  })

  it('verifyMagicLink authenticates on success', async () => {
    const mockUser = { id: 'u4', email: 'magic@test.com' }
    mockAuth.verifyMagicLink.mockResolvedValueOnce({
      data: { user: mockUser, access_token: 'tok_magic' },
      error: null,
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      const user = await result.current.verifyMagicLink({ token: 'link_tok' })
      expect(user).toEqual(mockUser)
    })

    expect(result.current.isAuthenticated).toBe(true)
    expect(mockSetAccessToken).toHaveBeenCalledWith('tok_magic')
  })

  it('exposes all auth methods', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(typeof result.current.login).toBe('function')
    expect(typeof result.current.register).toBe('function')
    expect(typeof result.current.logout).toBe('function')
    expect(typeof result.current.refreshUser).toBe('function')
    expect(typeof result.current.signInWithOtp).toBe('function')
    expect(typeof result.current.verifyOtp).toBe('function')
    expect(typeof result.current.signInWithMagicLink).toBe('function')
    expect(typeof result.current.verifyMagicLink).toBe('function')
  })
})

// ─── useUser Tests ────────────────────────────────────────────────

describe('useUser', () => {
  it('returns unauthenticated state initially', () => {
    const { result } = renderHook(() => useUser(), { wrapper })
    expect(result.current.user).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('refreshUser fetches current user', async () => {
    const mockUser = { id: 'u1', email: 'a@b.com' }
    mockAuth.me.mockResolvedValueOnce({ data: mockUser, error: null })

    const { result } = renderHook(() => useUser(), { wrapper })

    await act(async () => {
      await result.current.refreshUser()
    })

    expect(result.current.user).toEqual(mockUser)
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('exposes refreshUser function', () => {
    const { result } = renderHook(() => useUser(), { wrapper })
    expect(typeof result.current.refreshUser).toBe('function')
  })
})

// ─── useData Tests ────────────────────────────────────────────────

describe('useData', () => {
  it('returns empty initial state', () => {
    const { result } = renderHook(() => useData('todos'), { wrapper })
    expect(result.current.documents).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.total).toBe(0)
    expect(result.current.page).toBe(1)
    expect(result.current.totalPages).toBe(1)
  })

  it('fetch loads paginated documents', async () => {
    mockData.query.mockResolvedValueOnce({
      data: [{ id: 'd1', title: 'Todo 1' }, { id: 'd2', title: 'Todo 2' }],
      metadata: { total: 10, page: 1, totalPages: 5, perPage: 2 },
      error: null,
    })

    const { result } = renderHook(() => useData('todos'), { wrapper })

    await act(async () => {
      await result.current.fetch()
    })

    expect(result.current.documents).toHaveLength(2)
    expect(result.current.total).toBe(10)
    expect(result.current.page).toBe(1)
    expect(result.current.totalPages).toBe(5)
    expect(mockData.query).toHaveBeenCalledWith('todos', {})
  })

  it('fetch handles plain data response', async () => {
    mockData.query.mockResolvedValueOnce({
      data: [{ id: 'd1' }, { id: 'd2' }],
      error: null,
    })

    const { result } = renderHook(() => useData('todos'), { wrapper })

    await act(async () => {
      await result.current.fetch()
    })

    expect(result.current.documents).toHaveLength(2)
    expect(result.current.total).toBe(2)
  })

  it('fetch sets error on failure', async () => {
    mockData.query.mockResolvedValueOnce({
      data: null,
      error: { code: 'not_found', message: 'Collection not found', status: 404 },
    })

    const { result } = renderHook(() => useData('missing'), { wrapper })

    await act(async () => {
      await result.current.fetch()
    })

    expect(result.current.error?.code).toBe('not_found')
    expect(result.current.documents).toEqual([])
  })

  it('create returns new document', async () => {
    const newDoc = { id: 'd3', title: 'New Todo' }
    mockData.create.mockResolvedValueOnce({ data: newDoc, error: null })

    const { result } = renderHook(() => useData('todos'), { wrapper })

    let created: any
    await act(async () => {
      created = await result.current.create({ title: 'New Todo' })
    })

    expect(created).toEqual(newDoc)
    expect(mockData.create).toHaveBeenCalledWith('todos', { title: 'New Todo' })
  })

  it('create returns null on error', async () => {
    mockData.create.mockResolvedValueOnce({
      data: null,
      error: { code: 'validation_error', message: 'Title required', status: 422 },
    })

    const { result } = renderHook(() => useData('todos'), { wrapper })

    let created: any
    await act(async () => {
      created = await result.current.create({})
    })

    expect(created).toBeNull()
    expect(result.current.error?.code).toBe('validation_error')
  })

  it('get retrieves a document by ID', async () => {
    const doc = { id: 'd1', title: 'Test' }
    mockData.get.mockResolvedValueOnce({ data: doc, error: null })

    const { result } = renderHook(() => useData('todos'), { wrapper })

    let fetched: any
    await act(async () => {
      fetched = await result.current.get('d1')
    })

    expect(fetched).toEqual(doc)
    expect(mockData.get).toHaveBeenCalledWith('todos', 'd1')
  })

  it('update returns updated document', async () => {
    const updated = { id: 'd1', title: 'Updated', done: true }
    mockData.update.mockResolvedValueOnce({ data: updated, error: null })

    const { result } = renderHook(() => useData('todos'), { wrapper })

    let result2: any
    await act(async () => {
      result2 = await result.current.update('d1', { done: true })
    })

    expect(result2).toEqual(updated)
    expect(mockData.update).toHaveBeenCalledWith('todos', 'd1', { done: true })
  })

  it('remove deletes from local state', async () => {
    // First populate
    mockData.query.mockResolvedValueOnce({
      data: [{ id: 'd1' }, { id: 'd2' }],
      error: null,
    })
    mockData.delete.mockResolvedValueOnce({ data: null, error: null })

    const { result } = renderHook(() => useData('todos'), { wrapper })

    await act(async () => {
      await result.current.fetch()
    })
    expect(result.current.documents).toHaveLength(2)

    let success: any
    await act(async () => {
      success = await result.current.remove('d1')
    })

    expect(success).toBe(true)
    expect(result.current.documents).toHaveLength(1)
    expect(result.current.documents[0].id).toBe('d2')
  })

  it('query passes options through', async () => {
    mockData.query.mockResolvedValueOnce({
      data: [],
      metadata: { total: 0, page: 1, totalPages: 1, perPage: 20 },
      error: null,
    })

    const { result } = renderHook(() => useData('todos'), { wrapper })
    const queryOpts = {
      filters: [{ field: 'done', operator: 'eq' as const, value: true }],
      sort: [{ field: 'created_at', direction: 'desc' as const }],
    }

    await act(async () => {
      await result.current.query(queryOpts)
    })

    expect(mockData.query).toHaveBeenCalledWith('todos', queryOpts)
  })

  it('mine fetches current user documents', async () => {
    mockData.myDocuments.mockResolvedValueOnce({
      data: [{ id: 'd1', title: 'My Doc' }],
      error: null,
    })

    const { result } = renderHook(() => useData('todos'), { wrapper })

    await act(async () => {
      await result.current.mine()
    })

    expect(result.current.documents).toHaveLength(1)
    expect(mockData.myDocuments).toHaveBeenCalledWith('todos')
  })

  it('autoFetch fetches on mount', async () => {
    mockData.query.mockResolvedValueOnce({
      data: [{ id: 'd1' }],
      error: null,
    })

    renderHook(() => useData('todos', { autoFetch: true }), { wrapper })

    await waitFor(() => {
      expect(mockData.query).toHaveBeenCalledWith('todos', {})
    })
  })
})

// ─── useStorage Tests ─────────────────────────────────────────────

describe('useStorage', () => {
  it('returns empty initial state', () => {
    const { result } = renderHook(() => useStorage(), { wrapper })
    expect(result.current.files).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isUploading).toBe(false)
    expect(result.current.uploadProgress).toBe(0)
    expect(result.current.error).toBeNull()
  })

  it('list loads files', async () => {
    const files = [
      { id: 'f1', filename: 'a.jpg', size_bytes: 1024 },
      { id: 'f2', filename: 'b.png', size_bytes: 2048 },
    ]
    mockStorage.list.mockResolvedValueOnce({ data: files, error: null })

    const { result } = renderHook(() => useStorage(), { wrapper })

    await act(async () => {
      await result.current.list()
    })

    expect(result.current.files).toHaveLength(2)
    expect(result.current.files[0].filename).toBe('a.jpg')
  })

  it('list sets error on failure', async () => {
    mockStorage.list.mockResolvedValueOnce({
      data: null,
      error: { code: 'unauthorized', message: 'Not logged in', status: 401 },
    })

    const { result } = renderHook(() => useStorage(), { wrapper })

    await act(async () => {
      await result.current.list()
    })

    expect(result.current.error?.code).toBe('unauthorized')
  })

  it('upload adds file to list and tracks progress', async () => {
    const fileInfo = { id: 'f3', filename: 'new.pdf', size_bytes: 4096 }
    mockStorage.upload.mockImplementation(async (_file: any, opts: any) => {
      // Simulate progress
      opts?.onProgress?.(50)
      opts?.onProgress?.(100)
      return { data: fileInfo, error: null }
    })

    const { result } = renderHook(() => useStorage(), { wrapper })
    const file = new File(['test'], 'new.pdf', { type: 'application/pdf' })

    const progressSpy = vi.fn()
    let uploaded: any
    await act(async () => {
      uploaded = await result.current.upload(file, { onProgress: progressSpy })
    })

    expect(uploaded).toEqual(fileInfo)
    expect(result.current.files).toHaveLength(1)
    expect(result.current.files[0].id).toBe('f3')
    expect(progressSpy).toHaveBeenCalledWith(50)
    expect(progressSpy).toHaveBeenCalledWith(100)
    expect(result.current.isUploading).toBe(false)
  })

  it('upload returns null on error', async () => {
    mockStorage.upload.mockResolvedValueOnce({
      data: null,
      error: { code: 'file_scanning', message: 'Scan in progress', status: 202 },
    })

    const { result } = renderHook(() => useStorage(), { wrapper })
    const file = new File(['test'], 'virus.exe')

    let uploaded: any
    await act(async () => {
      uploaded = await result.current.upload(file)
    })

    expect(uploaded).toBeNull()
    expect(result.current.error?.code).toBe('file_scanning')
  })

  it('get retrieves file info', async () => {
    const info = { id: 'f1', filename: 'a.jpg', size_bytes: 1024 }
    mockStorage.getInfo.mockResolvedValueOnce({ data: info, error: null })

    const { result } = renderHook(() => useStorage(), { wrapper })

    let fetched: any
    await act(async () => {
      fetched = await result.current.get('f1')
    })

    expect(fetched).toEqual(info)
  })

  it('remove deletes from local state', async () => {
    // First populate
    mockStorage.list.mockResolvedValueOnce({
      data: [{ id: 'f1' }, { id: 'f2' }],
      error: null,
    })
    mockStorage.delete.mockResolvedValueOnce({ data: null, error: null })

    const { result } = renderHook(() => useStorage(), { wrapper })

    await act(async () => {
      await result.current.list()
    })
    expect(result.current.files).toHaveLength(2)

    let success: any
    await act(async () => {
      success = await result.current.remove('f1')
    })

    expect(success).toBe(true)
    expect(result.current.files).toHaveLength(1)
  })

  it('getUrl returns download URL', async () => {
    mockStorage.getDownloadUrl.mockResolvedValueOnce({
      data: { url: 'https://cdn.example.com/f1.jpg?sig=abc' },
      error: null,
    })

    const { result } = renderHook(() => useStorage(), { wrapper })

    let url: any
    await act(async () => {
      url = await result.current.getUrl('f1')
    })

    expect(url).toBe('https://cdn.example.com/f1.jpg?sig=abc')
  })

  it('autoFetch fetches on mount', async () => {
    mockStorage.list.mockResolvedValueOnce({ data: [], error: null })

    renderHook(() => useStorage({ autoFetch: true }), { wrapper })

    await waitFor(() => {
      expect(mockStorage.list).toHaveBeenCalled()
    })
  })
})

// ─── useChat Tests ────────────────────────────────────────────────

describe('useChat', () => {
  it('returns empty initial state', () => {
    const { result } = renderHook(() => useChat(), { wrapper })
    expect(result.current.conversations).toEqual([])
    expect(result.current.messages).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('listConversations loads conversations', async () => {
    const convos = [
      { id: 'c1', name: 'Chat 1' },
      { id: 'c2', name: 'Chat 2' },
    ]
    mockChat.listConversations.mockResolvedValueOnce({ data: convos, error: null })

    const { result } = renderHook(() => useChat(), { wrapper })

    await act(async () => {
      await result.current.listConversations()
    })

    expect(result.current.conversations).toHaveLength(2)
  })

  it('createConversation adds to list', async () => {
    const conv = { id: 'c3', name: 'New Chat' }
    mockChat.createConversation.mockResolvedValueOnce({ data: conv, error: null })

    const { result } = renderHook(() => useChat(), { wrapper })

    let created: any
    await act(async () => {
      created = await result.current.createConversation({ participant_ids: ['u1', 'u2'] })
    })

    expect(created).toEqual(conv)
    expect(result.current.conversations).toHaveLength(1)
  })

  it('sendMessage appends to messages', async () => {
    const msg = { id: 'm1', content: 'Hello', sender_id: 'u1' }
    mockChat.sendMessage.mockResolvedValueOnce({ data: msg, error: null })

    const { result } = renderHook(() => useChat(), { wrapper })

    let sent: any
    await act(async () => {
      sent = await result.current.sendMessage('c1', { content: 'Hello' })
    })

    expect(sent).toEqual(msg)
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].content).toBe('Hello')
  })

  it('editMessage updates in-place', async () => {
    // Pre-populate
    const msg1 = { id: 'm1', content: 'Old' }
    mockChat.getMessages.mockResolvedValueOnce({ data: [msg1], error: null })

    const { result } = renderHook(() => useChat(), { wrapper })

    await act(async () => {
      await result.current.loadMessages('c1')
    })

    const edited = { id: 'm1', content: 'New' }
    mockChat.editMessage.mockResolvedValueOnce({ data: edited, error: null })

    await act(async () => {
      await result.current.editMessage('m1', { content: 'New' })
    })

    expect(result.current.messages[0].content).toBe('New')
  })

  it('deleteMessage removes from list', async () => {
    // Pre-populate
    mockChat.getMessages.mockResolvedValueOnce({
      data: [{ id: 'm1' }, { id: 'm2' }],
      error: null,
    })
    mockChat.deleteMessage.mockResolvedValueOnce({ data: null, error: null })

    const { result } = renderHook(() => useChat(), { wrapper })

    await act(async () => {
      await result.current.loadMessages('c1')
    })
    expect(result.current.messages).toHaveLength(2)

    let deleted: any
    await act(async () => {
      deleted = await result.current.deleteMessage('m1')
    })

    expect(deleted).toBe(true)
    expect(result.current.messages).toHaveLength(1)
  })

  it('addReaction calls SDK', async () => {
    mockChat.addReaction.mockResolvedValueOnce({ data: null, error: null })

    const { result } = renderHook(() => useChat(), { wrapper })

    let success: any
    await act(async () => {
      success = await result.current.addReaction('m1', '👍')
    })

    expect(success).toBe(true)
    expect(mockChat.addReaction).toHaveBeenCalledWith('m1', { emoji: '👍' })
  })

  it('sendTyping calls SDK', async () => {
    mockChat.sendTyping.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useChat(), { wrapper })

    await act(async () => {
      await result.current.sendTyping('c1')
    })

    expect(mockChat.sendTyping).toHaveBeenCalledWith('c1')
  })

  it('markRead calls SDK', async () => {
    mockChat.markRead.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useChat(), { wrapper })

    await act(async () => {
      await result.current.markRead('c1')
    })

    expect(mockChat.markRead).toHaveBeenCalledWith('c1')
  })

  it('auto-fetches messages when conversationId provided', async () => {
    mockChat.getMessages.mockResolvedValueOnce({
      data: [{ id: 'm1', content: 'Hello' }],
      error: null,
    })

    renderHook(() => useChat('c1'), { wrapper })

    await waitFor(() => {
      expect(mockChat.getMessages).toHaveBeenCalledWith('c1')
    })
  })
})

// ─── useRealtime Tests ────────────────────────────────────────────

describe('useRealtime', () => {
  it('returns disconnected initial state', () => {
    const { result } = renderHook(() => useRealtime(), { wrapper })
    expect(result.current.status).toBe('disconnected')
    expect(result.current.lastMessage).toBeNull()
  })

  it('subscribe calls SDK subscribe', () => {
    const unsub = vi.fn()
    mockRealtime.subscribe.mockReturnValueOnce(unsub)

    const { result } = renderHook(() => useRealtime(), { wrapper })

    let returnedUnsub: any
    act(() => {
      returnedUnsub = result.current.subscribe('chat:room-1')
    })

    expect(mockRealtime.subscribe).toHaveBeenCalledWith('chat:room-1', expect.any(Function))
    expect(typeof returnedUnsub).toBe('function')
  })

  it('subscribe updates lastMessage on data', async () => {
    let capturedCallback: ((data: unknown) => void) | undefined
    mockRealtime.subscribe.mockImplementation((_ch: string, cb: (data: unknown) => void) => {
      capturedCallback = cb
      return vi.fn()
    })

    const { result } = renderHook(() => useRealtime(), { wrapper })

    act(() => {
      result.current.subscribe('chat:room-1')
    })

    act(() => {
      capturedCallback?.({ text: 'hello' })
    })

    expect(result.current.lastMessage).toEqual({
      channel: 'chat:room-1',
      data: { text: 'hello' },
    })
  })

  it('publish delegates to SDK', () => {
    const { result } = renderHook(() => useRealtime(), { wrapper })

    act(() => {
      result.current.publish('chat:room-1', { text: 'hi' })
    })

    expect(mockRealtime.publish).toHaveBeenCalledWith('chat:room-1', { text: 'hi' })
  })

  it('disconnect calls SDK disconnect', () => {
    const { result } = renderHook(() => useRealtime(), { wrapper })

    act(() => {
      result.current.disconnect()
    })

    expect(mockRealtime.disconnect).toHaveBeenCalled()
  })

  it('subscribes to initial channels on mount', () => {
    renderHook(
      () => useRealtime({ channels: ['chat:room-1', 'notifications'] }),
      { wrapper }
    )

    // 2 subscribe calls for initial channels
    expect(mockRealtime.subscribe).toHaveBeenCalledTimes(2)
    expect(mockRealtime.subscribe).toHaveBeenCalledWith('chat:room-1', expect.any(Function))
    expect(mockRealtime.subscribe).toHaveBeenCalledWith('notifications', expect.any(Function))
  })

  it('tracks status changes', () => {
    const { result } = renderHook(() => useRealtime(), { wrapper })

    act(() => {
      statusChangeCallbacks.forEach(cb => cb('connected'))
    })

    expect(result.current.status).toBe('connected')
  })

  it('cleans up subscriptions on unmount', () => {
    const unsub1 = vi.fn()
    const unsub2 = vi.fn()
    mockRealtime.subscribe
      .mockReturnValueOnce(unsub1)
      .mockReturnValueOnce(unsub2)

    const { unmount } = renderHook(
      () => useRealtime({ channels: ['ch1', 'ch2'] }),
      { wrapper }
    )

    unmount()

    expect(unsub1).toHaveBeenCalled()
    expect(unsub2).toHaveBeenCalled()
    expect(mockRealtime.disconnect).toHaveBeenCalled()
  })
})

// ─── useSessions Tests ────────────────────────────────────────────

describe('useSessions', () => {
  it('returns empty initial state', () => {
    const { result } = renderHook(() => useSessions(), { wrapper })
    expect(result.current.sessions).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('fetchSessions loads sessions', async () => {
    const sessions = [
      { id: 's1', device: 'Chrome', is_current: true, created_at: '2026-01-01', last_active_at: '2026-01-01' },
      { id: 's2', device: 'Firefox', is_current: false, created_at: '2026-01-01', last_active_at: '2026-01-01' },
    ]
    mockAuth.sessions.list.mockResolvedValueOnce({
      data: { sessions },
      error: null,
    })

    const { result } = renderHook(() => useSessions(), { wrapper })

    await act(async () => {
      await result.current.fetchSessions()
    })

    expect(result.current.sessions).toHaveLength(2)
    expect(result.current.sessions[0].device).toBe('Chrome')
  })

  it('fetchSessions handles bare array response', async () => {
    const sessions = [{ id: 's1', device: 'Chrome', is_current: true }]
    mockAuth.sessions.list.mockResolvedValueOnce({
      data: sessions,
      error: null,
    })

    const { result } = renderHook(() => useSessions(), { wrapper })

    await act(async () => {
      await result.current.fetchSessions()
    })

    expect(result.current.sessions).toHaveLength(1)
  })

  it('revokeSession removes from list', async () => {
    const sessions = [
      { id: 's1', device: 'Chrome', is_current: true },
      { id: 's2', device: 'Firefox', is_current: false },
    ]
    mockAuth.sessions.list.mockResolvedValueOnce({
      data: { sessions },
      error: null,
    })
    mockAuth.sessions.revoke.mockResolvedValueOnce({ data: null, error: null })

    const { result } = renderHook(() => useSessions(), { wrapper })

    await act(async () => {
      await result.current.fetchSessions()
    })

    await act(async () => {
      await result.current.revokeSession('s2')
    })

    expect(result.current.sessions).toHaveLength(1)
    expect(result.current.sessions[0].id).toBe('s1')
  })

  it('revokeSession throws on error', async () => {
    mockAuth.sessions.revoke.mockResolvedValueOnce({
      data: null,
      error: { code: 'not_found', message: 'Session not found', status: 404 },
    })

    const { result } = renderHook(() => useSessions(), { wrapper })

    await act(async () => {
      await expect(result.current.revokeSession('bad-id'))
        .rejects.toThrow('Session not found')
    })
  })

  it('revokeOtherSessions keeps only current', async () => {
    const sessions = [
      { id: 's1', device: 'Chrome', is_current: true },
      { id: 's2', device: 'Firefox', is_current: false },
      { id: 's3', device: 'Safari', is_current: false },
    ]
    mockAuth.sessions.list.mockResolvedValueOnce({ data: { sessions }, error: null })
    mockAuth.sessions.revokeAll.mockResolvedValueOnce({
      data: { revoked_count: 2 },
      error: null,
    })

    const { result } = renderHook(() => useSessions(), { wrapper })

    await act(async () => {
      await result.current.fetchSessions()
    })

    let count: any
    await act(async () => {
      count = await result.current.revokeOtherSessions()
    })

    expect(count).toBe(2)
    expect(result.current.sessions).toHaveLength(1)
    expect(result.current.sessions[0].is_current).toBe(true)
  })
})

// ─── useDevices Tests ─────────────────────────────────────────────

describe('useDevices', () => {
  it('returns empty initial state', () => {
    const { result } = renderHook(() => useDevices(), { wrapper })
    expect(result.current.devices).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('fetchDevices loads devices', async () => {
    const devices = [
      { id: 'dev1', device_name: 'MacBook', trust_level: 'high', is_current: true, is_blocked: false, successful_logins: 10, created_at: '2026-01-01' },
    ]
    mockAuth.devices.list.mockResolvedValueOnce({
      data: { devices },
      error: null,
    })

    const { result } = renderHook(() => useDevices(), { wrapper })

    await act(async () => {
      await result.current.fetchDevices()
    })

    expect(result.current.devices).toHaveLength(1)
    expect(result.current.devices[0].device_name).toBe('MacBook')
  })

  it('trustDevice updates trust_level to high', async () => {
    const devices = [
      { id: 'dev1', trust_level: 'low', is_current: false, is_blocked: false },
    ]
    mockAuth.devices.list.mockResolvedValueOnce({ data: { devices }, error: null })
    mockAuth.devices.trust.mockResolvedValueOnce({ data: null, error: null })

    const { result } = renderHook(() => useDevices(), { wrapper })

    await act(async () => {
      await result.current.fetchDevices()
    })

    await act(async () => {
      await result.current.trustDevice('dev1')
    })

    expect(result.current.devices[0].trust_level).toBe('high')
  })

  it('blockDevice sets is_blocked to true', async () => {
    const devices = [
      { id: 'dev1', trust_level: 'medium', is_current: false, is_blocked: false },
    ]
    mockAuth.devices.list.mockResolvedValueOnce({ data: { devices }, error: null })
    mockAuth.devices.block.mockResolvedValueOnce({ data: null, error: null })

    const { result } = renderHook(() => useDevices(), { wrapper })

    await act(async () => {
      await result.current.fetchDevices()
    })

    await act(async () => {
      await result.current.blockDevice('dev1')
    })

    expect(result.current.devices[0].is_blocked).toBe(true)
  })

  it('deleteDevice removes from list', async () => {
    const devices = [
      { id: 'dev1', is_current: false },
      { id: 'dev2', is_current: true },
    ]
    mockAuth.devices.list.mockResolvedValueOnce({ data: { devices }, error: null })
    mockAuth.devices.delete.mockResolvedValueOnce({ data: null, error: null })

    const { result } = renderHook(() => useDevices(), { wrapper })

    await act(async () => {
      await result.current.fetchDevices()
    })

    await act(async () => {
      await result.current.deleteDevice('dev1')
    })

    expect(result.current.devices).toHaveLength(1)
    expect(result.current.devices[0].id).toBe('dev2')
  })

  it('trustDevice throws on error', async () => {
    mockAuth.devices.trust.mockResolvedValueOnce({
      data: null,
      error: { code: 'forbidden', message: 'Cannot trust', status: 403 },
    })

    const { result } = renderHook(() => useDevices(), { wrapper })

    await act(async () => {
      await expect(result.current.trustDevice('dev1'))
        .rejects.toThrow('Cannot trust')
    })
  })
})

// ─── useLoginHistory Tests ────────────────────────────────────────

describe('useLoginHistory', () => {
  it('returns empty initial state', () => {
    const { result } = renderHook(() => useLoginHistory(), { wrapper })
    expect(result.current.history).toEqual([])
    expect(result.current.summary).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.page).toBe(1)
    expect(result.current.totalPages).toBe(1)
  })

  it('fetchHistory loads entries', async () => {
    const entries = [
      { id: 'lh1', login_method: 'email', success: true, risk_score: 10, risk_action: 'allow', created_at: '2026-01-01' },
      { id: 'lh2', login_method: 'email', success: false, risk_score: 80, risk_action: 'challenge', created_at: '2026-01-02' },
    ]
    mockAuth.loginHistory.list.mockResolvedValueOnce({
      data: { entries, page: 1, total: 20 },
      error: null,
    })

    const { result } = renderHook(() => useLoginHistory(), { wrapper })

    await act(async () => {
      await result.current.fetchHistory()
    })

    expect(result.current.history).toHaveLength(2)
    expect(result.current.page).toBe(1)
    expect(result.current.totalPages).toBe(1) // ceil(20/20)
  })

  it('fetchHistory with success filter', async () => {
    mockAuth.loginHistory.list.mockResolvedValueOnce({
      data: { entries: [], page: 1, total: 0 },
      error: null,
    })

    const { result } = renderHook(() => useLoginHistory(), { wrapper })

    await act(async () => {
      await result.current.fetchHistory({ success: false })
    })

    expect(mockAuth.loginHistory.list).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    )
  })

  it('fetchSummary loads summary', async () => {
    const summary = {
      total_logins_30d: 50,
      successful_logins_30d: 45,
      failed_logins_30d: 5,
      unique_devices: 3,
      unique_locations: 2,
      high_risk_logins_30d: 1,
    }
    mockAuth.loginHistory.getSummary.mockResolvedValueOnce({
      data: summary,
      error: null,
    })

    const { result } = renderHook(() => useLoginHistory(), { wrapper })

    await act(async () => {
      await result.current.fetchSummary()
    })

    expect(result.current.summary).toEqual(summary)
    expect(result.current.summary?.total_logins_30d).toBe(50)
  })

  it('nextPage increments page and fetches', async () => {
    // Set up with 40 total entries (2 pages)
    mockAuth.loginHistory.list.mockResolvedValueOnce({
      data: { entries: Array(20).fill({ id: 'x' }), page: 1, total: 40 },
      error: null,
    })

    const { result } = renderHook(() => useLoginHistory(), { wrapper })

    await act(async () => {
      await result.current.fetchHistory()
    })
    expect(result.current.totalPages).toBe(2)

    mockAuth.loginHistory.list.mockResolvedValueOnce({
      data: { entries: Array(20).fill({ id: 'y' }), page: 2, total: 40 },
      error: null,
    })

    await act(async () => {
      result.current.nextPage()
    })

    await waitFor(() => {
      expect(result.current.page).toBe(2)
    })
  })

  it('prevPage does not go below 1', async () => {
    const { result } = renderHook(() => useLoginHistory(), { wrapper })

    // page starts at 1, prevPage should be no-op
    act(() => {
      result.current.prevPage()
    })

    expect(result.current.page).toBe(1)
    expect(mockAuth.loginHistory.list).not.toHaveBeenCalled()
  })
})

// ─── Exports Test ─────────────────────────────────────────────────

describe('Module exports', () => {
  it('index exports all hooks and provider', async () => {
    const mod = await import('./index')
    expect(mod.ScaleMuleProvider).toBeDefined()
    expect(mod.useScaleMuleContext).toBeDefined()
    expect(mod.useAuth).toBeDefined()
    expect(mod.useUser).toBeDefined()
    expect(mod.useData).toBeDefined()
    expect(mod.useStorage).toBeDefined()
    expect(mod.useChat).toBeDefined()
    expect(mod.useRealtime).toBeDefined()
    expect(mod.useSessions).toBeDefined()
    expect(mod.useDevices).toBeDefined()
    expect(mod.useLoginHistory).toBeDefined()
    expect(mod.ScaleMule).toBeDefined()
  })
})
