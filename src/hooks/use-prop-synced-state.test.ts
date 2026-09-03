import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePropSyncedState } from './use-prop-synced-state'

describe('usePropSyncedState', () => {
  it('initialises state from transform(prop)', () => {
    const { result } = renderHook(() => usePropSyncedState('abc', (p: string) => p.toUpperCase()))
    expect(result.current[0]).toBe('ABC')
  })

  it('keeps a local edit across a re-render when the prop is unchanged', () => {
    const { result, rerender } = renderHook(
      ({ prop }) => usePropSyncedState(prop, (p: string) => p),
      { initialProps: { prop: 'server-value' } }
    )

    act(() => result.current[1]('typed-value'))
    expect(result.current[0]).toBe('typed-value')

    rerender({ prop: 'server-value' })
    expect(result.current[0]).toBe('typed-value')
  })

  it('resets to transform(prop) when the prop changes, overwriting an in-progress local edit', () => {
    const { result, rerender } = renderHook(
      ({ prop }) => usePropSyncedState(prop, (p: string) => p),
      { initialProps: { prop: 'server-value' } }
    )

    act(() => result.current[1]('typed-value'))
    expect(result.current[0]).toBe('typed-value')

    rerender({ prop: 'server-value-updated' })
    expect(result.current[0]).toBe('server-value-updated')
  })

  it('calls transform again on every prop change, not just the first', () => {
    const transform = vi.fn((p: number) => p * 2)
    const { result, rerender } = renderHook(
      ({ prop }) => usePropSyncedState(prop, transform),
      { initialProps: { prop: 1 } }
    )
    expect(result.current[0]).toBe(2)

    rerender({ prop: 2 })
    expect(result.current[0]).toBe(4)

    rerender({ prop: 3 })
    expect(result.current[0]).toBe(6)

    expect(transform).toHaveBeenCalledTimes(3)
  })

  it('does not reset state when the prop is referentially equal but re-rendered', () => {
    const prop = { id: 1 }
    const { result, rerender } = renderHook(
      ({ p }) => usePropSyncedState(p, (x: { id: number }) => x.id),
      { initialProps: { p: prop } }
    )

    act(() => result.current[1](999))
    rerender({ p: prop })
    expect(result.current[0]).toBe(999)
  })

  it('supports the normal setState updater-function form for local edits', () => {
    const { result } = renderHook(() => usePropSyncedState(10, (p: number) => p))
    act(() => result.current[1]((prev) => prev + 5))
    expect(result.current[0]).toBe(15)
  })
})
