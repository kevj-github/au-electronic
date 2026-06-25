import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useRealtimeRefresh } from './use-realtime-refresh'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

let capturedCallback: (() => void) | null = null
let capturedAuthListener: ((event: string, session: { access_token: string } | null) => void) | null = null
const removeChannel = vi.fn()
// Mirrors the real supabase-js chaining: .channel().on() and .subscribe()
// both return the same channel object, so `channel` ends up truthy.
let channelObj: { on: typeof on; subscribe: typeof subscribe }
const subscribe = vi.fn(() => channelObj)
const on = vi.fn((_event: string, _config: unknown, callback: () => void) => {
  capturedCallback = callback
  return channelObj
})
channelObj = { on, subscribe }
const channel = vi.fn(() => channelObj)
const setAuth = vi.fn()
const unsubscribeAuthListener = vi.fn()
const getSession = vi.fn(() =>
  Promise.resolve({ data: { session: { access_token: 'test-access-token' } } })
)
const onAuthStateChange = vi.fn((callback: (event: string, session: { access_token: string } | null) => void) => {
  capturedAuthListener = callback
  return { data: { subscription: { unsubscribe: unsubscribeAuthListener } } }
})

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel,
    removeChannel,
    auth: { getSession, onAuthStateChange },
    realtime: { setAuth },
  }),
}))

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve()
  })
}

describe('useRealtimeRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    refresh.mockClear()
    channel.mockClear()
    on.mockClear()
    subscribe.mockClear()
    removeChannel.mockClear()
    setAuth.mockClear()
    getSession.mockClear()
    onAuthStateChange.mockClear()
    unsubscribeAuthListener.mockClear()
    capturedCallback = null
    capturedAuthListener = null
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('applies the session access token to the realtime socket before subscribing', async () => {
    renderHook(() => useRealtimeRefresh('pesanan'))
    await flushMicrotasks()
    expect(setAuth).toHaveBeenCalledWith('test-access-token')
    expect(channel).toHaveBeenCalledWith('pesanan-all')
    // Order matters: setAuth must apply before the channel joins, or the
    // socket authenticates as anon and RLS silently drops every event.
    expect(setAuth.mock.invocationCallOrder[0]).toBeLessThan(channel.mock.invocationCallOrder[0])
    expect(setAuth.mock.invocationCallOrder[0]).toBeLessThan(subscribe.mock.invocationCallOrder[0])
  })

  it('subscribes to postgres_changes for the given table', async () => {
    renderHook(() => useRealtimeRefresh('pesanan'))
    await flushMicrotasks()
    expect(channel).toHaveBeenCalledWith('pesanan-all')
    expect(on).toHaveBeenCalledWith(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pesanan' },
      expect.any(Function)
    )
    expect(subscribe).toHaveBeenCalled()
  })

  it('applies a column filter when provided', async () => {
    renderHook(() => useRealtimeRefresh('pesanan', { column: 'id', value: 'abc-123' }))
    await flushMicrotasks()
    expect(channel).toHaveBeenCalledWith('pesanan-id-abc-123')
    expect(on).toHaveBeenCalledWith(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pesanan', filter: 'id=eq.abc-123' },
      expect.any(Function)
    )
  })

  it('re-applies a refreshed access token to the realtime socket', async () => {
    renderHook(() => useRealtimeRefresh('pesanan'))
    await flushMicrotasks()
    setAuth.mockClear()
    capturedAuthListener?.('TOKEN_REFRESHED', { access_token: 'refreshed-token' })
    expect(setAuth).toHaveBeenCalledWith('refreshed-token')
  })

  it('debounces router.refresh by 300ms after a change event', async () => {
    renderHook(() => useRealtimeRefresh('pesanan'))
    await flushMicrotasks()
    capturedCallback?.()
    expect(refresh).not.toHaveBeenCalled()
    vi.advanceTimersByTime(299)
    expect(refresh).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('coalesces bursts of events into a single refresh', async () => {
    renderHook(() => useRealtimeRefresh('pesanan'))
    await flushMicrotasks()
    capturedCallback?.()
    vi.advanceTimersByTime(100)
    capturedCallback?.()
    vi.advanceTimersByTime(100)
    capturedCallback?.()
    vi.advanceTimersByTime(300)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('removes the channel and the auth listener on unmount', async () => {
    const { unmount } = renderHook(() => useRealtimeRefresh('pesanan'))
    await flushMicrotasks()
    unmount()
    expect(removeChannel).toHaveBeenCalled()
    expect(unsubscribeAuthListener).toHaveBeenCalled()
  })
})
