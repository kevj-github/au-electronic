import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Payments are the only place money is written, and the file had no coverage.
 * The amount parser is the sharp edge: `jumlah` arrives as a FormData string,
 * and `Number('')` is 0 while `Number('abc')` is NaN — both of which would slip
 * past a naive `!jumlah` or `jumlah < 0` check and record a bogus payment.
 */

interface Op {
  table: string
  op: 'insert' | 'delete'
  payload?: Record<string, unknown>
}

const ops: Op[] = []
const revalidatePath = vi.fn()
const requireOwner = vi.fn()

let singleData: unknown = null
let writeError: { message: string } | null = null

function makeClient() {
  function from(table: string) {
    const ctx: Op = { table, op: 'insert' }
    const settle = () => Promise.resolve({ data: singleData, error: writeError })
    const builder = {
      insert: (payload: Record<string, unknown>) => {
        Object.assign(ctx, { op: 'insert', payload })
        ops.push(ctx)
        return builder
      },
      delete: () => {
        Object.assign(ctx, { op: 'delete' })
        ops.push(ctx)
        return builder
      },
      select: () => builder,
      eq: () => builder,
      single: () => settle(),
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        settle().then(res, rej),
    }
    return builder
  }
  return {
    from,
    auth: { getUser: async () => ({ data: { user: { id: 'owner-1' } } }) },
  }
}

vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => makeClient() }))
vi.mock('@/lib/supabase/require-owner', () => ({
  requireOwner: (...a: unknown[]) => requireOwner(...a),
}))

const OWNER_ERROR = { error: 'Hanya owner yang dapat melakukan aksi ini.' }

function form(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

async function actions() {
  return import('./payment-actions')
}

beforeEach(() => {
  ops.length = 0
  singleData = null
  writeError = null
  revalidatePath.mockReset()
  requireOwner.mockReset().mockResolvedValue(null)
})

describe('createPembayaran amount validation', () => {
  it.each([
    ['', 'empty string parses to 0'],
    ['abc', 'non-numeric parses to NaN'],
    ['0', 'zero is not a payment'],
    ['-5000', 'negative'],
    ['NaN', 'literal NaN'],
  ])('rejects %j (%s) without writing', async (jumlah) => {
    const { createPembayaran } = await actions()

    const result = await createPembayaran('p1', form({ jumlah, metode: 'tunai' }))

    expect(result.error).toBe('Jumlah pembayaran tidak valid.')
    expect(ops).toHaveLength(0)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('accepts a positive amount', async () => {
    const { createPembayaran } = await actions()

    expect(await createPembayaran('p1', form({ jumlah: '250000', metode: 'tunai' }))).toEqual({})
    expect(ops[0].payload).toMatchObject({ pesanan_id: 'p1', jumlah: 250000, metode: 'tunai' })
  })

  it('requires a payment method', async () => {
    const { createPembayaran } = await actions()

    const result = await createPembayaran('p1', form({ jumlah: '1000' }))

    expect(result.error).toBe('Pilih metode pembayaran.')
    expect(ops).toHaveLength(0)
  })
})

describe('createPembayaran field handling', () => {
  it('stores an empty catatan as null rather than an empty string', async () => {
    const { createPembayaran } = await actions()

    await createPembayaran('p1', form({ jumlah: '1000', metode: 'transfer', catatan: '' }))

    expect(ops[0].payload).toMatchObject({ catatan: null })
  })

  it('keeps a provided catatan', async () => {
    const { createPembayaran } = await actions()

    await createPembayaran('p1', form({ jumlah: '1000', metode: 'transfer', catatan: 'DP' }))

    expect(ops[0].payload).toMatchObject({ catatan: 'DP' })
  })

  it('defaults dibayar_pada to now when the field is blank', async () => {
    const { createPembayaran } = await actions()

    await createPembayaran('p1', form({ jumlah: '1000', metode: 'tunai', dibayar_pada: '' }))

    const stored = ops[0].payload?.dibayar_pada as string
    expect(Number.isNaN(Date.parse(stored))).toBe(false)
  })

  it('honours an explicit dibayar_pada', async () => {
    const { createPembayaran } = await actions()

    await createPembayaran(
      'p1',
      form({ jumlah: '1000', metode: 'tunai', dibayar_pada: '2026-08-01T00:00:00.000Z' })
    )

    expect(ops[0].payload).toMatchObject({ dibayar_pada: '2026-08-01T00:00:00.000Z' })
  })

  it('records the authenticated user as dicatat_oleh', async () => {
    const { createPembayaran } = await actions()

    await createPembayaran('p1', form({ jumlah: '1000', metode: 'tunai' }))

    expect(ops[0].payload).toMatchObject({ dicatat_oleh: 'owner-1' })
  })

  it('refuses a non-owner before parsing anything', async () => {
    requireOwner.mockResolvedValue(OWNER_ERROR)
    const { createPembayaran } = await actions()

    expect(await createPembayaran('p1', form({ jumlah: '1000', metode: 'tunai' }))).toEqual(
      OWNER_ERROR
    )
    expect(ops).toHaveLength(0)
  })

  it('surfaces a write error and does not revalidate', async () => {
    writeError = { message: 'insert violates check constraint' }
    const { createPembayaran } = await actions()

    expect(await createPembayaran('p1', form({ jumlah: '1000', metode: 'tunai' }))).toEqual({
      error: 'insert violates check constraint',
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('deletePembayaran', () => {
  it('refuses a non-owner', async () => {
    requireOwner.mockResolvedValue(OWNER_ERROR)
    const { deletePembayaran } = await actions()

    expect(await deletePembayaran('pay-1')).toEqual(OWNER_ERROR)
    expect(ops).toHaveLength(0)
  })

  it('reports a missing payment rather than deleting blindly', async () => {
    singleData = null
    const { deletePembayaran } = await actions()

    expect(await deletePembayaran('ghost')).toEqual({ error: 'Pembayaran tidak ditemukan.' })
    expect(ops.filter((o) => o.op === 'delete')).toHaveLength(0)
  })

  it('revalidates the parent path resolved from the payment row, not a caller-supplied id', async () => {
    singleData = { pesanan_id: 'real-parent' }
    const { deletePembayaran } = await actions()

    expect(await deletePembayaran('pay-1')).toEqual({})
    expect(revalidatePath).toHaveBeenCalledWith('/pesanan/real-parent')
  })
})
