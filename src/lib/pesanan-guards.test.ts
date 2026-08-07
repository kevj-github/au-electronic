import { describe, it, expect, vi } from 'vitest'
import {
  requireActivePesanan,
  requireActivePesananByItem,
  isGuardError,
  getRole,
  PESANAN_NOT_MODIFIABLE,
  ITEM_NOT_FOUND,
} from './pesanan-guards'

type Row = Record<string, unknown> | null

/**
 * Minimal stand-in for the supabase-js query builder. Every chained method
 * returns the same object, and `single()` resolves to the row we were given —
 * mirroring the real client's chaining (same approach as the realtime hook test).
 */
function mockClient(row: Row, authUserId: string | null = 'user-1') {
  const single = vi.fn(async () => ({ data: row }))
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single,
  }
  return {
    from: vi.fn(() => builder),
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: authUserId ? { id: authUserId } : null },
      })),
    },
    __single: single,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe('requireActivePesananByItem', () => {
  it('resolves pesanan_id and qty from the DB for an active order', async () => {
    const supabase = mockClient({
      pesanan_id: 'pesanan-9',
      qty: 5,
      pesanan: { status: 'diproses' },
    })

    const result = await requireActivePesananByItem(supabase, 'item-1')

    expect(isGuardError(result)).toBe(false)
    expect(result).toEqual({ pesanan_id: 'pesanan-9', qty: 5, status: 'diproses' })
  })

  it('rejects when the parent order is selesai', async () => {
    const supabase = mockClient({
      pesanan_id: 'pesanan-9',
      qty: 5,
      pesanan: { status: 'selesai' },
    })

    const result = await requireActivePesananByItem(supabase, 'item-1')

    expect(result).toEqual({ error: PESANAN_NOT_MODIFIABLE })
  })

  it('rejects when the parent order is dibatalkan', async () => {
    const supabase = mockClient({
      pesanan_id: 'pesanan-9',
      qty: 5,
      pesanan: { status: 'dibatalkan' },
    })

    expect(await requireActivePesananByItem(supabase, 'item-1')).toEqual({
      error: PESANAN_NOT_MODIFIABLE,
    })
  })

  it('rejects when the item does not exist', async () => {
    const supabase = mockClient(null)

    expect(await requireActivePesananByItem(supabase, 'nope')).toEqual({
      error: ITEM_NOT_FOUND,
    })
  })

  it('never uses a client-supplied pesanan id — it queries item_pesanan by item id', async () => {
    const supabase = mockClient({
      pesanan_id: 'real-parent',
      qty: 1,
      pesanan: { status: 'diproses' },
    })

    const result = await requireActivePesananByItem(supabase, 'item-1')

    expect(supabase.from).toHaveBeenCalledWith('item_pesanan')
    // The returned id comes from the DB row, not from anything the caller passed.
    expect(result).toMatchObject({ pesanan_id: 'real-parent' })
  })
})

describe('requireActivePesanan', () => {
  it('accepts an order that is still diproses', async () => {
    const supabase = mockClient({ status: 'diproses' })

    expect(await requireActivePesanan(supabase, 'pesanan-1')).toEqual({
      pesanan_id: 'pesanan-1',
      status: 'diproses',
    })
  })

  it.each(['selesai', 'dibatalkan'])('rejects a %s order', async (status) => {
    const supabase = mockClient({ status })

    expect(await requireActivePesanan(supabase, 'pesanan-1')).toEqual({
      error: PESANAN_NOT_MODIFIABLE,
    })
  })

  it('rejects a missing order', async () => {
    const supabase = mockClient(null)

    expect(await requireActivePesanan(supabase, 'ghost')).toEqual({
      error: PESANAN_NOT_MODIFIABLE,
    })
  })
})

describe('getRole', () => {
  it('returns the role for a signed-in user', async () => {
    expect(await getRole(mockClient({ role: 'owner' }))).toBe('owner')
    expect(await getRole(mockClient({ role: 'helper' }))).toBe('helper')
  })

  it('returns null when unauthenticated, without querying users', async () => {
    const supabase = mockClient({ role: 'owner' }, null)

    expect(await getRole(supabase)).toBeNull()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('returns null when the user has no users row', async () => {
    expect(await getRole(mockClient(null))).toBeNull()
  })
})

describe('isGuardError', () => {
  it('narrows error results only', () => {
    expect(isGuardError({ error: 'boom' })).toBe(true)
    expect(isGuardError({ pesanan_id: 'x', status: 'diproses' })).toBe(false)
  })
})
