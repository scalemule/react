/**
 * useAccountSwitcher Hook
 *
 * Google-style account switcher for apps with multiple user accounts.
 * Remembers which accounts have logged in on this device (metadata only — no tokens).
 * Switching accounts requires re-authentication.
 *
 * Requires `enableAccountSwitcher: true` in the ScaleMule config.
 */

import { useState, useCallback, useEffect } from 'react'
import type { KnownAccountDisplay } from '@scalemule/sdk'
import { useScaleMuleContext } from '../context'

export interface UseAccountSwitcherReturn {
  /** All accounts that have previously logged in on this device */
  knownAccounts: KnownAccountDisplay[]
  /** The currently logged-in account, or null */
  activeAccount: KnownAccountDisplay | null
  /**
   * Switch to a different known account.
   * Logs out the current session and returns the target account's email
   * so the login form can be pre-filled. The user must re-authenticate.
   *
   * Returns the target account so the caller can pre-fill the login form.
   */
  switchAccount: (userId: string) => Promise<KnownAccountDisplay | null>
  /** Remove a specific account from the known accounts list */
  removeKnownAccount: (userId: string) => Promise<void>
  /** Clear all known accounts from this device */
  clearKnownAccounts: () => Promise<void>
  /** Whether the account switcher feature is enabled */
  enabled: boolean
}

/**
 * Hook for account switching
 *
 * @example
 * ```tsx
 * function AccountMenu() {
 *   const { knownAccounts, activeAccount, switchAccount, removeKnownAccount } = useAccountSwitcher()
 *
 *   return (
 *     <div>
 *       <p>Signed in as {activeAccount?.email}</p>
 *       <h3>Switch account</h3>
 *       {knownAccounts
 *         .filter(a => a.userId !== activeAccount?.userId)
 *         .map(account => (
 *           <div key={account.userId}>
 *             <button onClick={async () => {
 *               const target = await switchAccount(account.userId)
 *               if (target) router.push(`/login?email=${encodeURIComponent(target.email)}`)
 *             }}>
 *               {account.fullName || account.email}
 *             </button>
 *             <button onClick={() => removeKnownAccount(account.userId)}>Forget</button>
 *           </div>
 *         ))}
 *     </div>
 *   )
 * }
 * ```
 */
export function useAccountSwitcher(): UseAccountSwitcherReturn {
  const { client, auth } = useScaleMuleContext()
  const enabled = client.isAccountSwitcherEnabled()

  const [knownAccounts, setKnownAccounts] = useState<KnownAccountDisplay[]>(() =>
    enabled ? client.getKnownAccounts() : []
  )

  // Refresh known accounts when auth state changes (e.g., after login adds a new account)
  useEffect(() => {
    if (enabled) {
      setKnownAccounts(client.getKnownAccounts())
    }
  }, [client, enabled, auth.user])

  const activeAccount: KnownAccountDisplay | null = (() => {
    if (!auth.user) return null
    return knownAccounts.find(a => a.userId === auth.user?.id) || null
  })()

  const switchAccount = useCallback(
    async (userId: string): Promise<KnownAccountDisplay | null> => {
      const target = knownAccounts.find(a => a.userId === userId) || null
      if (!target) return null

      // Log out the current session — the user must re-authenticate as the target account
      await client.auth.logout()
      client.clearAccessToken()

      return target
    },
    [client, knownAccounts]
  )

  const removeKnownAccount = useCallback(
    async (userId: string) => {
      await client.removeKnownAccount(userId)
      setKnownAccounts(client.getKnownAccounts())
    },
    [client]
  )

  const clearKnownAccounts = useCallback(async () => {
    await client.clearKnownAccounts()
    setKnownAccounts([])
  }, [client])

  return {
    knownAccounts,
    activeAccount,
    switchAccount,
    removeKnownAccount,
    clearKnownAccounts,
    enabled,
  }
}
