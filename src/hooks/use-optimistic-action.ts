'use client'

import { useState } from 'react'

/**
 * A local optimistic overlay atop a server-revalidated value: `commit(next)`
 * updates the displayed value immediately, then reverts to `serverValue` if
 * the action reports an error. Any change to `serverValue` for any other
 * reason (someone else's action, a checklist reset, RealtimeRefresh) drops
 * the stale overlay too, via the same render-phase prev-value compare
 * `usePropSyncedState` uses — a `useState` initialiser only runs once, so
 * without this the overlay would keep comparing against a server value no
 * longer current.
 *
 * Distinct from `usePropSyncedState`: that hook has no separate "in flight"
 * overlay, so a failed update there just never applies. This hook shows the
 * optimistic value the instant `commit` is called (before the action
 * resolves) and only rolls it back on error — for controls like a checkbox
 * where the UI must flip immediately rather than wait a round trip.
 *
 * No `error` is surfaced — callers that need to display a message instead of
 * silently rolling back should use `setErrorFromResult` directly (see its
 * doc comment).
 */
export function useOptimisticAction<V>(
  serverValue: V,
  action: (next: V) => Promise<{ error?: string } | undefined>,
) {
  const [prevServerValue, setPrevServerValue] = useState(serverValue)
  const [pending, setPending] = useState<V | null>(null)
  const [loading, setLoading] = useState(false)

  if (serverValue !== prevServerValue) {
    setPrevServerValue(serverValue)
    setPending(null)
  }

  const value = pending ?? serverValue

  async function commit(next: V) {
    setPending(next)
    setLoading(true)
    const result = await action(next)
    if (result?.error) setPending(null)
    setLoading(false)
    return result
  }

  return { value, commit, loading } as const
}
