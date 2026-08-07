import { describe, it, expect, vi } from 'vitest'
import {
  requireActivePesanan,
  requireActivePesananByItem,
  requireHelperCanMutateItem,
  requireHelperCanMutatePesanan,
  requireUnlocked,
  isGuardError,
  getRole,
  PESANAN_NOT_MODIFIABLE,
  ITEM_NOT_FOUND,
  NOT_AUTHENTICATED,
  LOCK_UNVERIFIABLE,
  PESANAN_LOCKED,
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

type TableResult = { data: Row; error?: { message: string } }

/**
 * Like `mockClient`, but answers per table — the combined gates touch three
 * (`users`, `settings`, and `item_pesanan`/`pesanan`) and run two of them
 * concurrently. `from()` hands back a builder bound to its own table so the
 * interleaving of the concurrent lookups can't cross-wire the results.
 */
function mockTables(
  tables: Record<string, TableResult>,
  authUserId: string | null = 'user-1'
) {
  const from = vi.fn((table: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const builder: any = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      single: vi.fn(async () => tables[table] ?? { data: null }),
    }
    return builder
  })
  return {
    from,
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: authUserId ? { id: authUserId } : null },
      })),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

const helper = { data: { role: 'helper' } }
const owner = { data: { role: 'owner' } }
const unlocked = { data: { value: 'false' } }
const locked = { data: { value: 'true' } }
const activeItem = {
  data: { pesanan_id: 'pesanan-9', qty: 5, pesanan: { status: 'diproses' } },
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

describe('requireUnlocked', () => {
  it('lets an owner straight through without reading the setting', async () => {
    const supabase = mockTables({ settings: locked })

    expect(await requireUnlocked(supabase, 'owner')).toBeNull()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('lets a helper through when the lock is off', async () => {
    expect(await requireUnlocked(mockTables({ settings: unlocked }), 'helper')).toBeNull()
  })

  it('blocks a helper when the lock is on', async () => {
    expect(await requireUnlocked(mockTables({ settings: locked }), 'helper')).toEqual({
      error: PESANAN_LOCKED,
    })
  })

  it('accepts a caller-supplied locked message', async () => {
    expect(
      await requireUnlocked(mockTables({ settings: locked }), 'helper', 'Dikunci khusus.')
    ).toEqual({ error: 'Dikunci khusus.' })
  })

  it('fails closed when the settings row is missing', async () => {
    expect(await requireUnlocked(mockTables({ settings: { data: null } }), 'helper')).toEqual({
      error: LOCK_UNVERIFIABLE,
    })
  })

  it('fails closed when the settings read errors', async () => {
    const supabase = mockTables({ settings: { data: null, error: { message: 'boom' } } })

    expect(await requireUnlocked(supabase, 'helper')).toEqual({ error: LOCK_UNVERIFIABLE })
  })
})

describe('requireHelperCanMutateItem', () => {
  it('resolves the item for an unlocked helper on an active order', async () => {
    const supabase = mockTables({ users: helper, settings: unlocked, item_pesanan: activeItem })

    expect(await requireHelperCanMutateItem(supabase, 'item-1')).toEqual({
      pesanan_id: 'pesanan-9',
      qty: 5,
      status: 'diproses',
    })
  })

  it('lets the owner through even while helpers are locked', async () => {
    const supabase = mockTables({ users: owner, settings: locked, item_pesanan: activeItem })

    expect(await requireHelperCanMutateItem(supabase, 'item-1')).toMatchObject({
      pesanan_id: 'pesanan-9',
    })
  })

  it('rejects an unauthenticated caller', async () => {
    const supabase = mockTables(
      { users: helper, settings: unlocked, item_pesanan: activeItem },
      null
    )

    expect(await requireHelperCanMutateItem(supabase, 'item-1')).toEqual({
      error: NOT_AUTHENTICATED,
    })
  })

  it('rejects a signed-in caller with no users row', async () => {
    const supabase = mockTables({
      users: { data: null },
      settings: unlocked,
      item_pesanan: activeItem,
    })

    expect(await requireHelperCanMutateItem(supabase, 'item-1')).toEqual({
      error: NOT_AUTHENTICATED,
    })
  })

  it('blocks a locked helper', async () => {
    const supabase = mockTables({ users: helper, settings: locked, item_pesanan: activeItem })

    expect(await requireHelperCanMutateItem(supabase, 'item-1')).toEqual({
      error: PESANAN_LOCKED,
    })
  })

  it('propagates the closed-order rejection', async () => {
    const supabase = mockTables({
      users: helper,
      settings: unlocked,
      item_pesanan: { data: { pesanan_id: 'p', qty: 1, pesanan: { status: 'selesai' } } },
    })

    expect(await requireHelperCanMutateItem(supabase, 'item-1')).toEqual({
      error: PESANAN_NOT_MODIFIABLE,
    })
  })

  it('propagates the missing-item rejection', async () => {
    const supabase = mockTables({
      users: helper,
      settings: unlocked,
      item_pesanan: { data: null },
    })

    expect(await requireHelperCanMutateItem(supabase, 'nope')).toEqual({ error: ITEM_NOT_FOUND })
  })

  it('reports the lock before the order status, as the call sites did by hand', async () => {
    const supabase = mockTables({
      users: helper,
      settings: locked,
      item_pesanan: { data: { pesanan_id: 'p', qty: 1, pesanan: { status: 'selesai' } } },
    })

    expect(await requireHelperCanMutateItem(supabase, 'item-1')).toEqual({
      error: PESANAN_LOCKED,
    })
  })
})

describe('requireHelperCanMutatePesanan', () => {
  it('resolves an active order for an unlocked helper', async () => {
    const supabase = mockTables({
      users: helper,
      settings: unlocked,
      pesanan: { data: { status: 'diproses' } },
    })

    expect(await requireHelperCanMutatePesanan(supabase, 'pesanan-1')).toEqual({
      pesanan_id: 'pesanan-1',
      status: 'diproses',
    })
  })

  it('lets the owner through even while helpers are locked', async () => {
    const supabase = mockTables({
      users: owner,
      settings: locked,
      pesanan: { data: { status: 'diproses' } },
    })

    expect(await requireHelperCanMutatePesanan(supabase, 'pesanan-1')).toMatchObject({
      pesanan_id: 'pesanan-1',
    })
  })

  it('rejects an unauthenticated caller', async () => {
    const supabase = mockTables(
      { users: helper, settings: unlocked, pesanan: { data: { status: 'diproses' } } },
      null
    )

    expect(await requireHelperCanMutatePesanan(supabase, 'pesanan-1')).toEqual({
      error: NOT_AUTHENTICATED,
    })
  })

  it('blocks a locked helper', async () => {
    const supabase = mockTables({
      users: helper,
      settings: locked,
      pesanan: { data: { status: 'diproses' } },
    })

    expect(await requireHelperCanMutatePesanan(supabase, 'pesanan-1')).toEqual({
      error: PESANAN_LOCKED,
    })
  })

  it('propagates the closed-order rejection', async () => {
    const supabase = mockTables({
      users: helper,
      settings: unlocked,
      pesanan: { data: { status: 'dibatalkan' } },
    })

    expect(await requireHelperCanMutatePesanan(supabase, 'pesanan-1')).toEqual({
      error: PESANAN_NOT_MODIFIABLE,
    })
  })
})

describe('isGuardError', () => {
  it('narrows error results only', () => {
    expect(isGuardError({ error: 'boom' })).toBe(true)
    expect(isGuardError({ pesanan_id: 'x', status: 'diproses' })).toBe(false)
  })
})
