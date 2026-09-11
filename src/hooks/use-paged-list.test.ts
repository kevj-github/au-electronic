// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePagedList } from './use-paged-list'

const items = (n: number) => Array.from({ length: n }, (_, i) => i)

describe('usePagedList', () => {
  it('starts on page 1 and slices the first page', () => {
    const { result } = renderHook(() => usePagedList(items(25), 10, 'k'))

    expect(result.current.page).toBe(1)
    expect(result.current.pageRows).toEqual(items(10))
  })

  it('computes totalPages from the list length and page size, rounding up', () => {
    const { result } = renderHook(() => usePagedList(items(25), 10, 'k'))
    expect(result.current.totalPages).toBe(3)
  })

  it('totalPages is never less than 1, even for an empty list', () => {
    const { result } = renderHook(() => usePagedList<number>([], 10, 'k'))
    expect(result.current.totalPages).toBe(1)
    expect(result.current.pageRows).toEqual([])
  })

  it('setPage moves to the requested page and slices accordingly', () => {
    const { result } = renderHook(() => usePagedList(items(25), 10, 'k'))

    act(() => result.current.setPage(2))
    expect(result.current.page).toBe(2)
    expect(result.current.pageRows).toEqual(items(20).slice(10))

    act(() => result.current.setPage(3))
    expect(result.current.page).toBe(3)
    expect(result.current.pageRows).toEqual([20, 21, 22, 23, 24])
  })

  it('resets to page 1 when filterKey changes, overriding a manually-set page', () => {
    const { result, rerender } = renderHook(
      ({ filterKey }) => usePagedList(items(25), 10, filterKey),
      { initialProps: { filterKey: 'a' } }
    )

    act(() => result.current.setPage(3))
    expect(result.current.page).toBe(3)

    rerender({ filterKey: 'b' })
    expect(result.current.page).toBe(1)
  })

  it('does not reset the page when filterKey is unchanged across a re-render', () => {
    const { result, rerender } = renderHook(
      ({ filtered }) => usePagedList(filtered, 10, 'same-key'),
      { initialProps: { filtered: items(25) } }
    )

    act(() => result.current.setPage(2))
    expect(result.current.page).toBe(2)

    // Same filterKey, but the filtered array reference changed (e.g. a
    // re-render with equivalent-but-new data) — must not reset the page.
    rerender({ filtered: items(25) })
    expect(result.current.page).toBe(2)
  })

  it('re-slices pageRows when the filtered list changes without a filterKey change', () => {
    const { result, rerender } = renderHook(
      ({ filtered }) => usePagedList(filtered, 10, 'same-key'),
      { initialProps: { filtered: items(25) } }
    )

    rerender({ filtered: items(5) })
    expect(result.current.pageRows).toEqual(items(5))
  })
})
