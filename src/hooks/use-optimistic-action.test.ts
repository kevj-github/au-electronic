import { describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useOptimisticAction } from './use-optimistic-action'

describe('useOptimisticAction', () => {
  it('starts at the server value', () => {
    const action = vi.fn()
    const { result } = renderHook(() => useOptimisticAction(false, action))
    expect(result.current.value).toBe(false)
    expect(result.current.loading).toBe(false)
  })

  it('shows the optimistic value immediately, before the action resolves', async () => {
    let resolveAction: (v: { error?: string } | undefined) => void = () => {}
    const action = vi.fn(() => new Promise<{ error?: string } | undefined>((resolve) => { resolveAction = resolve }))
    const { result } = renderHook(() => useOptimisticAction(false, action))

    act(() => { result.current.commit(true) })

    expect(result.current.value).toBe(true)
    expect(result.current.loading).toBe(true)
    expect(action).toHaveBeenCalledWith(true)

    await act(async () => { resolveAction({}) })
    expect(result.current.loading).toBe(false)
    expect(result.current.value).toBe(true)
  })

  it('reverts to the server value when the action reports an error', async () => {
    const action = vi.fn(async () => ({ error: 'Gagal.' }))
    const { result } = renderHook(() => useOptimisticAction(false, action))

    await act(async () => { await result.current.commit(true) })

    expect(result.current.value).toBe(false)
    expect(result.current.loading).toBe(false)
  })

  it('keeps the optimistic value when the action succeeds (resolves without error)', async () => {
    const action = vi.fn(async () => ({}))
    const { result } = renderHook(() => useOptimisticAction(false, action))

    await act(async () => { await result.current.commit(true) })

    expect(result.current.value).toBe(true)
  })

  it('drops a stale optimistic value the moment the server value changes for any reason', async () => {
    let resolveAction: (v: { error?: string } | undefined) => void = () => {}
    const action = vi.fn(() => new Promise<{ error?: string } | undefined>((resolve) => { resolveAction = resolve }))
    const { result, rerender } = renderHook(
      ({ serverValue }) => useOptimisticAction(serverValue, action),
      { initialProps: { serverValue: 0 } }
    )

    act(() => { result.current.commit(5) })
    expect(result.current.value).toBe(5)

    // Someone else's action (or a checklist reset) revalidates the server
    // value to something else entirely while ours is still in flight.
    rerender({ serverValue: 9 })
    expect(result.current.value).toBe(9)

    await act(async () => { resolveAction({}) })
    // The stale commit resolving afterwards must not resurrect the dropped overlay.
    expect(result.current.value).toBe(9)
  })

  it('does not resync when the server value is set to the same value again', () => {
    const action = vi.fn()
    const { result, rerender } = renderHook(
      ({ serverValue }) => useOptimisticAction(serverValue, action),
      { initialProps: { serverValue: 3 } }
    )
    act(() => { result.current.commit(7) })
    rerender({ serverValue: 3 })
    expect(result.current.value).toBe(7)
  })

  it('returns the action result from commit', async () => {
    const action = vi.fn(async () => ({ error: 'oops' }))
    const { result } = renderHook(() => useOptimisticAction(false, action))

    let returned: { error?: string } | undefined
    await act(async () => { returned = await result.current.commit(true) })

    expect(returned).toEqual({ error: 'oops' })
  })

  it('reflects loading:false and the reverted value together after a rejected commit resolves', async () => {
    const action = vi.fn(async () => ({ error: 'Gagal.' }))
    const { result } = renderHook(() => useOptimisticAction(1, action))

    act(() => { result.current.commit(2) })
    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.value).toBe(1)
  })
})
