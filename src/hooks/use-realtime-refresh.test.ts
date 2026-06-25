import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRealtimeRefresh } from './use-realtime-refresh'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

let capturedCallback: (() => void) | null = null
const removeChannel = vi.fn()
const subscribe = vi.fn()
const on = vi.fn((_event: string, _config: unknown, callback: () => void) => {
  capturedCallback = callback
  return { subscribe }
})
const channel = vi.fn(() => ({ on }))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ channel, removeChannel }),
}))

describe('useRealtimeRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    refresh.mockClear()
    channel.mockClear()
    on.mockClear()
    subscribe.mockClear()
    removeChannel.mockClear()
    capturedCallback = null
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('subscribes to postgres_changes for the given table', () => {
    renderHook(() => useRealtimeRefresh('pesanan'))
    expect(channel).toHaveBeenCalledWith('pesanan-all')
    expect(on).toHaveBeenCalledWith(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pesanan' },
      expect.any(Function)
    )
    expect(subscribe).toHaveBeenCalled()
  })

  it('applies a column filter when provided', () => {
    renderHook(() => useRealtimeRefresh('pesanan', { column: 'id', value: 'abc-123' }))
    expect(channel).toHaveBeenCalledWith('pesanan-id-abc-123')
    expect(on).toHaveBeenCalledWith(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pesanan', filter: 'id=eq.abc-123' },
      expect.any(Function)
    )
  })

  it('debounces router.refresh by 300ms after a change event', () => {
    renderHook(() => useRealtimeRefresh('pesanan'))
    capturedCallback?.()
    expect(refresh).not.toHaveBeenCalled()
    vi.advanceTimersByTime(299)
    expect(refresh).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('coalesces bursts of events into a single refresh', () => {
    renderHook(() => useRealtimeRefresh('pesanan'))
    capturedCallback?.()
    vi.advanceTimersByTime(100)
    capturedCallback?.()
    vi.advanceTimersByTime(100)
    capturedCallback?.()
    vi.advanceTimersByTime(300)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('removes the channel on unmount', () => {
    const { unmount } = renderHook(() => useRealtimeRefresh('pesanan'))
    unmount()
    expect(removeChannel).toHaveBeenCalled()
  })
})
