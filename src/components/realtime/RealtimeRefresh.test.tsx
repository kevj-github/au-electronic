import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { RealtimeRefresh } from './RealtimeRefresh'

const useRealtimeRefresh = vi.fn()
vi.mock('@/hooks/use-realtime-refresh', () => ({
  useRealtimeRefresh: (...args: unknown[]) => useRealtimeRefresh(...args),
}))

describe('RealtimeRefresh', () => {
  it('calls useRealtimeRefresh with the given table and filter, and renders nothing', () => {
    const { container } = render(
      <RealtimeRefresh table="pesanan" filter={{ column: 'id', value: 'abc' }} />
    )
    expect(useRealtimeRefresh).toHaveBeenCalledWith('pesanan', { column: 'id', value: 'abc' })
    expect(container).toBeEmptyDOMElement()
  })

  it('works without a filter', () => {
    render(<RealtimeRefresh table="pelanggan" />)
    expect(useRealtimeRefresh).toHaveBeenCalledWith('pelanggan', undefined)
  })
})
