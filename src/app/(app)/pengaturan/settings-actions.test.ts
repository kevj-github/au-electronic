import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The settings writers exist in their current shape because of one Postgres
 * detail: `.update().eq()` matching *zero* rows is not an error. A missing
 * `settings` row would therefore report success while saving nothing — the lock
 * would silently stay off. Both writers ask for the affected rows back and fail
 * closed when there are none; these tests pin that.
 *
 * `clearAllPelanggan` is covered for the opposite reason: it must stay a single
 * RPC. It used to be a select-then-update-per-row-then-delete sequence that
 * could half-complete past PostgREST's 1000-row cap.
 */

const revalidatePath = vi.fn()
const requireOwner = vi.fn()
const rpc = vi.fn()

/** Rows returned by a terminal `.select()`, and the error to pair with them. */
let selectRows: unknown[] | null = [{ key: 'pesanan_locked' }]
let opError: { message: string } | null = null
let singleData: unknown = null
const writes: Array<{ table: string; payload?: unknown; key?: unknown; op: string }> = []

function makeClient() {
  function from(table: string) {
    const ctx = { table, op: 'update' } as (typeof writes)[number]
    const builder = {
      update: (payload: unknown) => {
        Object.assign(ctx, { op: 'update', payload })
        writes.push(ctx)
        return builder
      },
      delete: () => {
        Object.assign(ctx, { op: 'delete' })
        writes.push(ctx)
        return builder
      },
      not: () => builder,
      eq: (_col: string, val: unknown) => {
        ctx.key = val
        return builder
      },
      // Chainable, not terminal: the writers end on `.select('key')` and await
      // the builder, while the reader continues `.select().eq().single()`.
      select: () => builder,
      single: () => Promise.resolve({ data: singleData, error: opError }),
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve({ data: selectRows, error: opError }).then(res, rej),
    }
    return builder
  }
  return { from, rpc }
}

vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => makeClient() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ auth: { admin: {} } }) }))
vi.mock('@/lib/supabase/require-owner', () => ({
  requireOwner: (...a: unknown[]) => requireOwner(...a),
}))

const OWNER_ERROR = { error: 'Hanya owner yang dapat melakukan aksi ini.' }

async function actions() {
  vi.resetModules()
  return import('./actions')
}

beforeEach(() => {
  writes.length = 0
  selectRows = [{ key: 'pesanan_locked' }]
  opError = null
  singleData = null
  revalidatePath.mockReset()
  requireOwner.mockReset().mockResolvedValue(null)
  rpc.mockReset().mockResolvedValue({ error: null })
})

describe('setPesananLocked', () => {
  it.each([
    [true, 'true'],
    [false, 'false'],
  ])('writes %s as the string %j', async (locked, stored) => {
    const { setPesananLocked } = await actions()

    expect(await setPesananLocked(locked)).toEqual({})
    expect(writes[0]).toMatchObject({
      table: 'settings',
      payload: { value: stored },
      key: 'pesanan_locked',
    })
  })

  it('fails closed when the settings row is missing — zero rows is not success', async () => {
    selectRows = []
    const { setPesananLocked } = await actions()

    const result = await setPesananLocked(true)

    expect(result.error).toContain('belum tersedia di database')
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('fails closed when the update returns no rows at all', async () => {
    selectRows = null
    const { setPesananLocked } = await actions()

    expect((await setPesananLocked(true)).error).toBeTruthy()
  })

  it('surfaces a write error', async () => {
    opError = { message: 'permission denied for table settings' }
    const { setPesananLocked } = await actions()

    expect(await setPesananLocked(true)).toEqual({
      error: 'permission denied for table settings',
    })
  })

  it('refuses a non-owner', async () => {
    requireOwner.mockResolvedValue(OWNER_ERROR)
    const { setPesananLocked } = await actions()

    expect(await setPesananLocked(true)).toEqual(OWNER_ERROR)
    expect(writes).toHaveLength(0)
  })
})

describe('updateEpsonPrinterName', () => {
  it('saves the name', async () => {
    const { updateEpsonPrinterName } = await actions()

    expect(await updateEpsonPrinterName('EPSON LX-310')).toEqual({})
    expect(writes[0]).toMatchObject({
      payload: { value: 'EPSON LX-310' },
      key: 'epson_printer_name',
    })
  })

  it('fails closed when the settings row is missing', async () => {
    selectRows = []
    const { updateEpsonPrinterName } = await actions()

    expect((await updateEpsonPrinterName('X')).error).toContain('belum tersedia di database')
  })

  it('refuses a non-owner', async () => {
    requireOwner.mockResolvedValue(OWNER_ERROR)
    const { updateEpsonPrinterName } = await actions()

    expect(await updateEpsonPrinterName('X')).toEqual(OWNER_ERROR)
    expect(writes).toHaveLength(0)
  })
})

describe('getEpsonPrinterName', () => {
  it('returns the saved name', async () => {
    singleData = { value: 'EPSON LX-310' }
    const { getEpsonPrinterName } = await actions()

    expect(await getEpsonPrinterName()).toEqual({ name: 'EPSON LX-310' })
  })

  it('returns an empty name when the row has no value', async () => {
    singleData = null
    const { getEpsonPrinterName } = await actions()

    expect(await getEpsonPrinterName()).toEqual({ name: '' })
  })

  it('returns an empty name alongside the error for a non-owner', async () => {
    requireOwner.mockResolvedValue(OWNER_ERROR)
    const { getEpsonPrinterName } = await actions()

    // The caller renders `name` directly, so it must never come back undefined.
    expect(await getEpsonPrinterName()).toEqual({ name: '', error: OWNER_ERROR.error })
  })

  it('returns an empty name when the read fails', async () => {
    opError = { message: 'timeout' }
    const { getEpsonPrinterName } = await actions()

    expect(await getEpsonPrinterName()).toEqual({ name: '', error: 'timeout' })
  })
})

describe('clear-all actions', () => {
  it('clearAllPelanggan delegates to the atomic RPC, not a read-modify-write', async () => {
    const { clearAllPelanggan } = await actions()

    expect(await clearAllPelanggan()).toEqual({})
    expect(rpc).toHaveBeenCalledWith('clear_all_pelanggan')
    // Any direct write here would mean the half-completion bug is back.
    expect(writes).toHaveLength(0)
  })

  it('clearAllPelanggan surfaces the RPC error and revalidates nothing', async () => {
    rpc.mockResolvedValue({ error: { message: 'deadlock detected' } })
    const { clearAllPelanggan } = await actions()

    expect(await clearAllPelanggan()).toEqual({ error: 'deadlock detected' })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('clearAllPelanggan refreshes both lists on success', async () => {
    const { clearAllPelanggan } = await actions()

    await clearAllPelanggan()

    expect(revalidatePath).toHaveBeenCalledWith('/pelanggan')
    expect(revalidatePath).toHaveBeenCalledWith('/pesanan')
  })

  it('clearAllPesanan deletes every order', async () => {
    const { clearAllPesanan } = await actions()

    expect(await clearAllPesanan()).toEqual({})
    expect(writes[0]).toMatchObject({ table: 'pesanan', op: 'delete' })
  })

  it.each([
    ['clearAllPesanan', (a: Awaited<ReturnType<typeof actions>>) => a.clearAllPesanan()],
    ['clearAllPelanggan', (a: Awaited<ReturnType<typeof actions>>) => a.clearAllPelanggan()],
  ])('%s refuses a non-owner', async (_n, call) => {
    requireOwner.mockResolvedValue(OWNER_ERROR)

    expect(await call(await actions())).toEqual(OWNER_ERROR)
    expect(writes).toHaveLength(0)
    expect(rpc).not.toHaveBeenCalled()
  })
})
