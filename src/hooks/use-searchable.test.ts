// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSearchable } from './use-searchable'

describe('useSearchable', () => {
  it('pairs each item with a lowercased haystack built from toHaystack', () => {
    const items = [{ nama: 'Toko Sumber' }, { nama: 'CV Makmur' }]
    const { result } = renderHook(() => useSearchable(items, (i) => i.nama))

    expect(result.current).toEqual([
      { item: items[0], haystack: 'toko sumber' },
      { item: items[1], haystack: 'cv makmur' },
    ])
  })

  it('returns an empty array for an empty items list', () => {
    const { result } = renderHook(() => useSearchable<{ nama: string }>([], (i) => i.nama))
    expect(result.current).toEqual([])
  })

  it('only recomputes when the items array reference changes, not on every render', () => {
    const toHaystack = vi.fn((i: { nama: string }) => i.nama)
    const items = [{ nama: 'Toko Sumber' }]
    const { result, rerender } = renderHook(
      ({ items }) => useSearchable(items, toHaystack),
      { initialProps: { items } }
    )
    const first = result.current
    expect(toHaystack).toHaveBeenCalledTimes(1)

    // Same items reference, toHaystack given a fresh inline identity — must
    // not defeat the memoization (this is the whole point of `items` being
    // the only dep, per the hook's own doc comment).
    rerender({ items })
    expect(result.current).toBe(first)
    expect(toHaystack).toHaveBeenCalledTimes(1)

    const newItems = [{ nama: 'Toko Baru' }]
    rerender({ items: newItems })
    expect(result.current).not.toBe(first)
    expect(toHaystack).toHaveBeenCalledTimes(2)
    expect(result.current).toEqual([{ item: newItems[0], haystack: 'toko baru' }])
  })

  it('preserves item order and count', () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }]
    const { result } = renderHook(() => useSearchable(items, (i) => String(i.id)))

    expect(result.current.map((r) => r.item.id)).toEqual([1, 2, 3])
  })
})
