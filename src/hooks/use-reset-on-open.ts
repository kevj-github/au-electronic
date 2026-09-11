import { useState, type Dispatch, type SetStateAction } from 'react'

/**
 * useState that resets to `computeValue()` every time `open` transitions from
 * closed to open — not on every render, and not when `open` closes.
 *
 * Built for dialog-scoped form state that must be re-seeded on each open
 * (e.g. a payment amount prefilled from an outstanding balance): the source
 * value can change while the dialog is mounted-but-closed (a stale value
 * would be offered on next open) or while it's open (a value arriving via
 * Realtime must not clobber what the user is currently typing). Keying the
 * reset on the `open` transition itself, rather than on the source value via
 * `usePropSyncedState`, is what gets both right at once.
 */
export function useResetOnOpen<V>(
  open: boolean,
  computeValue: () => V,
): [V, Dispatch<SetStateAction<V>>] {
  const [value, setValue] = useState(computeValue)
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setValue(computeValue())
  }
  return [value, setValue]
}
