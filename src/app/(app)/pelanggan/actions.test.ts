import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * `deletePelanggan` has to copy the customer's name onto every linked pesanan
 * *before* breaking the foreign key, or historic orders lose the name entirely
 * — there is nothing to recover it from afterwards. The ordering is the whole
 * point of the function and had no coverage.
 */

interface Op {
  table: string
  op: 'update' | 'delete'
  payload?: Record<string, unknown>
  eqCalls?: Array<[string, unknown]>
}

const ops: Op[] = []
const revalidatePath = vi.fn()
const redirect = vi.fn((url: string): never => {
  // Next's redirect() signals by throwing; mirror that so the action's
  // control flow matches production. The target rides along in the message.
  throw new Error(`NEXT_REDIRECT:${url}`)
})
const requireOwner = vi.fn()

let singleData: unknown = null
/** Error returned by the Nth write, keyed by order of execution. */
let writeErrors: Array<{ message: string } | null> = []
let writeIndex = 0

function makeClient() {
  function from(table: string) {
    const ctx: Op = { table, op: 'update' }
    const settle = () => {
      const error = writeErrors[writeIndex] ?? null
      writeIndex += 1
      return Promise.resolve({ data: singleData, error })
    }
    const builder = {
      update: (payload: Record<string, unknown>) => {
        Object.assign(ctx, { op: 'update', payload })
        ops.push(ctx)
        return builder
      },
      insert: (payload: Record<string, unknown>) => {
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
        ;(ctx.eqCalls ??= []).push([col, val])
        return builder
      },
      // The name lookup must not consume a write-error slot.
      single: () => Promise.resolve({ data: singleData, error: null }),
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        settle().then(res, rej),
    }
    return builder
  }
  return { from }
}

vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }))
vi.mock('next/navigation', () => ({ redirect: (url: string) => redirect(url) }))
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
  return import('./actions')
}

beforeEach(() => {
  ops.length = 0
  singleData = null
  writeErrors = []
  writeIndex = 0
  revalidatePath.mockReset()
  redirect.mockClear()
  requireOwner.mockReset().mockResolvedValue(null)
})

describe('deletePelanggan', () => {
  it('preserves the name on linked orders BEFORE deleting the customer', async () => {
    singleData = { nama: 'Toko Sumber Rejeki' }
    const { deletePelanggan } = await actions()

    expect(await deletePelanggan('c1')).toEqual({})

    // Order matters: unlink first, delete second.
    expect(ops.map((o) => `${o.table}:${o.op}`)).toEqual(['pesanan:update', 'pelanggan:delete'])
    expect(ops[0].payload).toEqual({
      pelanggan_id: null,
      nama_pelanggan: 'Toko Sumber Rejeki',
    })
  })

  it('refuses when the customer does not exist', async () => {
    singleData = null
    const { deletePelanggan } = await actions()

    expect(await deletePelanggan('ghost')).toEqual({ error: 'Pelanggan tidak ditemukan.' })
    expect(ops).toHaveLength(0)
  })

  it('does not delete the customer when the unlink fails', async () => {
    singleData = { nama: 'Toko A' }
    writeErrors = [{ message: 'update failed' }]
    const { deletePelanggan } = await actions()

    expect(await deletePelanggan('c1')).toEqual({ error: 'update failed' })
    // The name would be unrecoverable if the delete ran anyway.
    expect(ops.some((o) => o.op === 'delete')).toBe(false)
  })

  it('refuses a non-owner', async () => {
    requireOwner.mockResolvedValue(OWNER_ERROR)
    const { deletePelanggan } = await actions()

    expect(await deletePelanggan('c1')).toEqual(OWNER_ERROR)
    expect(ops).toHaveLength(0)
  })

  it('revalidates both the customer list and the order list', async () => {
    singleData = { nama: 'Toko A' }
    const { deletePelanggan } = await actions()

    await deletePelanggan('c1')

    expect(revalidatePath).toHaveBeenCalledWith('/pelanggan')
    // Orders now carry the denormalised name, so that list is stale too.
    expect(revalidatePath).toHaveBeenCalledWith('/pesanan')
  })
})

describe('upsertPelanggan', () => {
  it('requires a name', async () => {
    const { upsertPelanggan } = await actions()

    expect(await upsertPelanggan(form({ nama: '' }))).toEqual({
      error: 'Nama pelanggan wajib diisi.',
    })
    expect(ops).toHaveLength(0)
  })

  it('inserts when no id is supplied', async () => {
    const { upsertPelanggan } = await actions()

    await expect(
      upsertPelanggan(form({ nama: 'Toko Baru', telepon: '0812', alamat: 'Jl. 1', tipe: 'retail' }))
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(ops[0]).toMatchObject({
      table: 'pelanggan',
      payload: { nama: 'Toko Baru', telepon: '0812', alamat: 'Jl. 1', tipe: 'retail' },
    })
  })

  it('stores blank telepon and alamat as null, not empty strings', async () => {
    const { upsertPelanggan } = await actions()

    await expect(
      upsertPelanggan(form({ nama: 'Toko Baru', telepon: '', alamat: '', tipe: 'grosir' }))
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(ops[0].payload).toMatchObject({ telepon: null, alamat: null })
  })

  it('returns the write error instead of redirecting', async () => {
    writeErrors = [{ message: 'duplicate key' }]
    const { upsertPelanggan } = await actions()

    expect(await upsertPelanggan(form({ nama: 'Toko Baru', tipe: 'retail' }))).toEqual({
      error: 'duplicate key',
    })
    expect(redirect).not.toHaveBeenCalled()
  })

  it('refuses a non-owner', async () => {
    requireOwner.mockResolvedValue(OWNER_ERROR)
    const { upsertPelanggan } = await actions()

    expect(await upsertPelanggan(form({ nama: 'Toko Baru' }))).toEqual(OWNER_ERROR)
    expect(ops).toHaveLength(0)
  })

  it('updates the existing row instead of inserting when an id is supplied', async () => {
    const { upsertPelanggan } = await actions()

    await expect(
      upsertPelanggan(
        form({ id: 'c1', nama: 'Toko Lama', telepon: '0899', alamat: 'Jl. 2', tipe: 'grosir' })
      )
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(ops).toHaveLength(1)
    expect(ops[0]).toMatchObject({
      table: 'pelanggan',
      payload: { nama: 'Toko Lama', telepon: '0899', alamat: 'Jl. 2', tipe: 'grosir' },
    })
    // Targets the row being edited, not every pelanggan row.
    expect(ops[0].eqCalls).toEqual([['id', 'c1']])
    expect(revalidatePath).toHaveBeenCalledWith('/pelanggan')
  })

  it('stores blank telepon and alamat as null on update too', async () => {
    const { upsertPelanggan } = await actions()

    await expect(
      upsertPelanggan(form({ id: 'c1', nama: 'Toko Lama', telepon: '', alamat: '', tipe: 'retail' }))
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(ops[0].payload).toMatchObject({ telepon: null, alamat: null })
  })

  it('returns the write error instead of redirecting on a failed update', async () => {
    writeErrors = [{ message: 'row locked' }]
    const { upsertPelanggan } = await actions()

    expect(
      await upsertPelanggan(form({ id: 'c1', nama: 'Toko Lama', tipe: 'retail' }))
    ).toEqual({ error: 'row locked' })
    expect(redirect).not.toHaveBeenCalled()
  })
})
