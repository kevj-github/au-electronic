import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Split from the former actions.test.ts alongside the order-lifecycle /
 * item-mutation module split. Covers the item_pesanan mutation surface
 * (checklist toggles, price, add/edit/delete lines). The guards these
 * delegate to are tested separately in lib/pesanan-guards.test.ts, so they're
 * mocked here — the point is to pin what the *actions* add on top:
 *
 *  - a rejected guard short-circuits before anything reaches the database
 *  - the payload actually written is normalised/clamped correctly
 *  - the right paths get revalidated
 */

// ---- database double -------------------------------------------------------

interface Op {
  table: string
  op: 'insert' | 'update' | 'delete'
  payload?: unknown
  eq?: [string, unknown]
}

const ops: Op[] = []
const revalidatePath = vi.fn()
const requireOwner = vi.fn()
const requireHelperCanMutateItem = vi.fn()
const requireHelperCanMutatePesanan = vi.fn()
const requireActivePesanan = vi.fn()
const requireActivePesananByItem = vi.fn()

/** Row returned by `.single()`, and error returned by a write, per test. */
let singleData: unknown = null
let writeError: { message: string } | null = null

function makeClient() {
  function from(table: string) {
    const ctx: Op = { table, op: 'update' }
    const settle = () =>
      Promise.resolve({ data: singleData, error: writeError })
    const builder = {
      insert: (payload: unknown) => {
        Object.assign(ctx, { op: 'insert', payload })
        ops.push(ctx)
        return builder
      },
      update: (payload: unknown) => {
        Object.assign(ctx, { op: 'update', payload })
        ops.push(ctx)
        return builder
      },
      delete: () => {
        Object.assign(ctx, { op: 'delete' })
        ops.push(ctx)
        return builder
      },
      select: () => builder,
      eq: (col: string, val: unknown) => {
        ctx.eq = [col, val]
        return builder
      },
      single: () => settle(),
      // Makes `await supabase.from(..).update(..).eq(..)` resolve.
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        settle().then(res, rej),
    }
    return builder
  }
  return { from, auth: { getUser: async () => ({ data: { user: { id: 'auth-1' } } }) } }
}

vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => makeClient() }))
vi.mock('@/lib/supabase/require-owner', () => ({
  requireOwner: (...a: unknown[]) => requireOwner(...a),
}))
vi.mock('@/lib/pesanan-guards', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/pesanan-guards')>()
  return {
    ...actual,
    requireHelperCanMutateItem: (...a: unknown[]) => requireHelperCanMutateItem(...a),
    requireHelperCanMutatePesanan: (...a: unknown[]) => requireHelperCanMutatePesanan(...a),
    requireActivePesanan: (...a: unknown[]) => requireActivePesanan(...a),
    requireActivePesananByItem: (...a: unknown[]) => requireActivePesananByItem(...a),
  }
})

const ACTIVE_ITEM = { pesanan_id: 'pesanan-9', qty: 5, status: 'diproses' }
const GUARD_ERROR = { error: 'Pesanan tidak dapat diubah.' }
const OWNER_ERROR = { error: 'Hanya owner yang dapat melakukan aksi ini.' }

async function actions() {
  return import('./item-mutation-actions')
}

beforeEach(() => {
  ops.length = 0
  singleData = null
  writeError = null
  revalidatePath.mockReset()
  requireOwner.mockReset().mockResolvedValue(null)
  requireHelperCanMutateItem.mockReset().mockResolvedValue(ACTIVE_ITEM)
  requireHelperCanMutatePesanan.mockReset().mockResolvedValue({
    pesanan_id: 'pesanan-9',
    status: 'diproses',
  })
  requireActivePesanan.mockReset().mockResolvedValue({
    pesanan_id: 'pesanan-9',
    status: 'diproses',
  })
  requireActivePesananByItem.mockReset().mockResolvedValue(ACTIVE_ITEM)
})

// ---- owner gating ----------------------------------------------------------

describe('owner-gated actions refuse non-owners before touching the database', () => {
  it.each([
    ['updateItemHarga', (a: Awaited<ReturnType<typeof actions>>) => a.updateItemHarga('i1', 5000)],
    ['toggleItemDicekOwner', (a: Awaited<ReturnType<typeof actions>>) => a.toggleItemDicekOwner('i1', true)],
  ])('%s', async (_name, call) => {
    requireOwner.mockResolvedValue(OWNER_ERROR)

    expect(await call(await actions())).toEqual(OWNER_ERROR)
    expect(ops).toHaveLength(0)
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

// ---- value normalisation ---------------------------------------------------

describe('setItemJumlahDiambil clamps against the DB-fetched qty', () => {
  it.each([
    [3, 3],
    [0, 0],
    [-1, 0],
    [99, 5], // qty is 5
    [2.7, 2], // truncated, not rounded
  ])('%s -> %s', async (input, stored) => {
    const { setItemJumlahDiambil } = await actions()

    await setItemJumlahDiambil('i1', input)

    expect(ops[0]).toMatchObject({ payload: { jumlah_diambil: stored } })
  })

  it('returns the guard error and writes nothing when the item is not mutable', async () => {
    requireHelperCanMutateItem.mockResolvedValue(GUARD_ERROR)
    const { setItemJumlahDiambil } = await actions()

    expect(await setItemJumlahDiambil('i1', 2)).toEqual(GUARD_ERROR)
    expect(ops).toHaveLength(0)
  })
})

// ---- helper-gated actions --------------------------------------------------

describe('helper-gated actions short-circuit on a rejected guard', () => {
  it('updateItemDetails', async () => {
    requireHelperCanMutateItem.mockResolvedValue(GUARD_ERROR)
    const { updateItemDetails } = await actions()

    expect(await updateItemDetails('i1', { nama_barang: 'X', qty: 2 })).toEqual(GUARD_ERROR)
    expect(ops).toHaveLength(0)
  })

  it('deleteItemFromPesanan', async () => {
    requireHelperCanMutateItem.mockResolvedValue(GUARD_ERROR)
    const { deleteItemFromPesanan } = await actions()

    expect(await deleteItemFromPesanan('i1')).toEqual(GUARD_ERROR)
    expect(ops).toHaveLength(0)
  })

  it('addItemToPesanan', async () => {
    requireHelperCanMutatePesanan.mockResolvedValue(GUARD_ERROR)
    const { addItemToPesanan } = await actions()

    expect(await addItemToPesanan('p1', { nama_barang: 'X', qty: 1 })).toEqual(GUARD_ERROR)
    expect(ops).toHaveLength(0)
  })

  it('addItemToPesanan always inserts harga_satuan 0 — helpers never set a price', async () => {
    const { addItemToPesanan } = await actions()

    await addItemToPesanan('p1', { nama_barang: 'Kabel', qty: 4 })

    expect(ops[0]).toMatchObject({
      table: 'item_pesanan',
      op: 'insert',
      payload: { pesanan_id: 'p1', nama_barang: 'Kabel', qty: 4, harga_satuan: 0 },
    })
  })
})

describe('resetChecklist routes through the right gate for each target', () => {
  it('owner target uses requireOwner and zeroes dicek_oleh_owner', async () => {
    const { resetChecklist } = await actions()

    await resetChecklist('p1', 'owner')

    expect(requireOwner).toHaveBeenCalled()
    expect(requireHelperCanMutatePesanan).not.toHaveBeenCalled()
    expect(ops[0]).toMatchObject({ payload: { dicek_oleh_owner: false }, eq: ['pesanan_id', 'p1'] })
  })

  it('helper target uses the helper gate and zeroes jumlah_diambil', async () => {
    const { resetChecklist } = await actions()

    await resetChecklist('p1', 'helper')

    expect(requireHelperCanMutatePesanan).toHaveBeenCalled()
    expect(requireOwner).not.toHaveBeenCalled()
    expect(ops[0]).toMatchObject({ payload: { jumlah_diambil: 0 } })
  })

  it('owner target still refuses a closed order', async () => {
    requireActivePesanan.mockResolvedValue(GUARD_ERROR)
    const { resetChecklist } = await actions()

    expect(await resetChecklist('p1', 'owner')).toEqual(GUARD_ERROR)
    expect(ops).toHaveLength(0)
  })
})

// ---- revalidation ----------------------------------------------------------

describe('revalidation targets', () => {
  it('updateItemHarga refreshes both the detail page and the list', async () => {
    const { updateItemHarga } = await actions()

    await updateItemHarga('i1', 25000)

    expect(revalidatePath).toHaveBeenCalledWith('/pesanan/pesanan-9')
    expect(revalidatePath).toHaveBeenCalledWith('/pesanan')
  })

  it('uses the pesanan id resolved from the item, not one supplied by the caller', async () => {
    requireHelperCanMutateItem.mockResolvedValue({
      pesanan_id: 'real-parent',
      qty: 1,
      status: 'diproses',
    })

    const { deleteItemFromPesanan } = await actions()

    await deleteItemFromPesanan('i1')

    expect(revalidatePath).toHaveBeenCalledWith('/pesanan/real-parent')
  })

  it('does not revalidate when the write itself fails', async () => {
    writeError = { message: 'permission denied' }
    const { updateItemHarga } = await actions()

    expect(await updateItemHarga('i1', 1)).toEqual({ error: 'permission denied' })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
