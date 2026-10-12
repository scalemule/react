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

## Community Maps

Import reusable components from `@scalemule/react/community-maps` and include
`@scalemule/react/community-maps.css`. Components inherit your application's typography
and support an accent/theme. The main exports include CommunityMap, CommunityGuide,
CommunityCards, CommunityFeatureCard, CommunityFeatureDetail, CommunitySubmissionForm,
CommunityPhotoSubmission, CommunityReaction, CommunityReportForm, FeaturedAttractions,
and FeaturedStreets.

For the default MapLibre adapter, run `scalemule-community-map-assets` before your
framework build. It copies the installed MapLibre worker into
`public/_scalemule/community-maps/`. Serve this directory as static assets. The CLI
uses the installed library version and must run again when dependencies change.
Configure `collection.config.presentation.map_style_url` with a production tile style;
there is deliberately no public OpenStreetMap tile default. Preserve provider attribution.
A different renderer can implement CommunityMapProvider. GeoJSON remains vendor independent.

`createCommunityMapsBrowserClient('/api/community-maps')` uses your same-origin proxy.
`communityMapsSdkClient(service, mediaUrl, requestOptions)` adapts an authenticated SDK.
Never initialize a browser component with a server API key. Missing WebGL or map tiles
leaves the accessible feature cards, filters, and contribution forms available.
