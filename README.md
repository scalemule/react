# @scalemule/react

React hooks and provider for ScaleMule.

## Install

```bash
npm install @scalemule/react @scalemule/sdk
```

## Quick Start

```tsx
import { ScaleMuleProvider } from '@scalemule/react'

export function AppRoot({ children }: { children: React.ReactNode }) {
  return (
    <ScaleMuleProvider config={{ apiKey: 'sm_pb_xxx' }}>
      {children}
    </ScaleMuleProvider>
  )
}
```

```tsx
import { useAuth, useUser } from '@scalemule/react'

export function LoginForm() {
  const { login, isLoading, error } = useAuth()
  const { user, isAuthenticated } = useUser()

  if (isAuthenticated) return <div>Signed in as {user?.email}</div>

  return (
    <button
      disabled={isLoading}
      onClick={async () => {
        await login({ email: 'user@example.com', password: 'secret' })
      }}
    >
      {isLoading ? 'Signing in...' : 'Sign in'}
      {error ? ` (${error.message})` : ''}
    </button>
  )
}
```

## Available Hooks

### `useAuth()`

Returns auth state and auth actions:

- `user`, `isLoading`, `isAuthenticated`, `error`
- `login(credentials) => Promise<User>`
- `register(credentials) => Promise<User>`
- `logout() => Promise<void>`
- `refreshUser() => Promise<void>`
- `signInWithOtp({ email }) => Promise<void>`
- `verifyOtp({ email, code }) => Promise<User>`
- `signInWithMagicLink({ email }) => Promise<void>`
- `verifyMagicLink({ token }) => Promise<User>`

Note: methods reject on API failure and also set `error` in auth state.

### `useUser()`

- `user`, `isLoading`, `isAuthenticated`
- `refreshUser() => Promise<void>`

### `useData(collection, options?)`

- State: `documents`, `isLoading`, `error`, `total`, `page`, `totalPages`
- Methods: `fetch`, `create`, `get`, `update`, `remove`, `query`, `mine`

### `useStorage(options?)`

- State: `files`, `isLoading`, `isUploading`, `uploadProgress`, `error`
- Methods: `upload`, `list`, `get`, `remove`, `getUrl`, `refresh`

### `useChat(conversationId?, options?)`

- State: `conversations`, `messages`, `isLoading`, `error`
- Methods:
  - `listConversations`, `createConversation`
  - `loadMessages`, `sendMessage`, `editMessage`, `deleteMessage`
  - `addReaction`, `sendTyping`, `markRead`

### `useRealtime(options?)`

- State: `status`, `lastMessage`
- Methods: `subscribe`, `publish`, `disconnect`

### `useSessions()`

- State: `sessions`, `isLoading`, `error`
- Methods: `fetchSessions`, `revokeSession`, `revokeOtherSessions`

### `useDevices()`

- State: `devices`, `isLoading`, `error`
- Methods: `fetchDevices`, `trustDevice`, `blockDevice`, `deleteDevice`

### `useLoginHistory()`

- State: `history`, `summary`, `isLoading`, `error`, `page`, `totalPages`
- Methods: `fetchHistory`, `fetchSummary`, `nextPage`, `prevPage`

## Direct SDK Access

```tsx
import { useScaleMuleContext } from '@scalemule/react'

export function AdvancedUsage() {
  const { client } = useScaleMuleContext()

  async function search() {
    await client.search.query('products', { query: 'headphones' })
  }

  return <button onClick={search}>Search</button>
}
```

## License

MIT
