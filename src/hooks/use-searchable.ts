'use client'

import { useMemo } from 'react'

/**
 * Precomputes a lowercased search haystack per item, once per `items` change
 * rather than once per item *per keystroke*. `toHaystack` must be a pure
 * function of the item alone (no external state) — its identity is
 * deliberately not a dependency, so an inline arrow function at the call
 * site does not defeat the memoization the way including it would.
 *
 * Callers should join multi-field haystacks with a NUL separator (which
 * cannot appear in a typed query) so a match can never span a field
 * boundary — e.g. "00001 Toko" must not match `kode="...00001"`
 * concatenated with `nama="Toko ..."`.
 */
export function useSearchable<T>(items: T[], toHaystack: (item: T) => string) {
  return useMemo(
    () => items.map((item) => ({ item, haystack: toHaystack(item).toLowerCase() })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items],
  )
}
