import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * `searchPelangganGlobal` is the /pelanggan "cari di semua pelanggan"
 * fallback, offered when a local search misses because the match lives past
 * the 500-row PELANGGAN_LIST_LIMIT. Covers: the owner gate (via
 * `requireOwner`, per this codebase's convention rather than a hand-rolled
 * check), the empty-query short-circuit, and merge+dedupe+sort across the
 * three `.ilike()` queries (nama/telepon/alamat).
 */

type Row = {
  id: string
  nama: string
  telepon: string | null
  alamat: string | null
  tipe: string
  created_at: string
}

const requireOwner = vi.fn()
vi.mock('@/lib/supabase/require-owner', () => ({
  requireOwner: (...a: unknown[]) => requireOwner(...a),
}))

let byNamaRows: Row[] = []
let byTeleponRows: Row[] = []
let byAlamatRows: Row[] = []
let queryError: { message: string } | null = null
const eqCalls: Array<{ col: string; val: unknown }> = []

function makeRow(id: string, nama: string): Row {
  return {
    id,
    nama,
    telepon: null,
    alamat: null,
    tipe: 'retail',
    created_at: '2026-08-01T00:00:00Z',
  }
}

function makeClient() {
  function from() {
    const state: { ilikeCol?: string } = {}
    const builder = {
      select: () => builder,
      eq: (col: string, val: unknown) => {
        eqCalls.push({ col, val })
        return builder
      },
      ilike: (col: string) => {
        state.ilikeCol = col
        return builder
      },
      order: () => builder,
      limit: () => builder,
      returns: () => builder,
      then: (
        resolve: (v: { data: Row[] | null; error: unknown }) => unknown,
        reject?: (e: unknown) => unknown,
      ) => {
        const data = queryError
          ? null
          : state.ilikeCol === 'nama'
            ? byNamaRows
            : state.ilikeCol === 'telepon'
              ? byTeleponRows
              : byAlamatRows
        return Promise.resolve({ data, error: queryError }).then(resolve, reject)
      },
    }
    return builder
  }
  return { from }
}

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => makeClient() }))

async function action() {
  const { searchPelangganGlobal } = await import('./search-actions')
  return searchPelangganGlobal
}

beforeEach(() => {
  requireOwner.mockReset().mockResolvedValue(null)
  byNamaRows = []
  byTeleponRows = []
  byAlamatRows = []
  queryError = null
  eqCalls.length = 0
})

describe('searchPelangganGlobal', () => {
  it('defers to requireOwner and returns its error for a non-owner', async () => {
    requireOwner.mockResolvedValue({ error: 'Hanya owner yang dapat melakukan aksi ini.' })
    const search = await action()
    expect(await search('toko', 'semua')).toEqual({
      error: 'Hanya owner yang dapat melakukan aksi ini.',
    })
  })

  it('short-circuits on a blank query without hitting the database', async () => {
    const search = await action()
    expect(await search('  ', 'semua')).toEqual({ pelangganList: [] })
    expect(eqCalls).toEqual([])
  })

  it('merges and dedupes matches from all three columns, sorted by nama', async () => {
    byNamaRows = [makeRow('a', 'Zebra'), makeRow('b', 'Amir')]
    byTeleponRows = [makeRow('b', 'Amir')] // duplicate of byNama's 'b'
    byAlamatRows = [makeRow('c', 'Midori')]
    const search = await action()
    const result = await search('a', 'semua')
    expect(result.pelangganList?.map((p) => p.id)).toEqual(['b', 'c', 'a'])
  })

  it('applies the tipe filter when not "semua"', async () => {
    byNamaRows = [makeRow('a', 'Toko A')]
    const search = await action()
    await search('toko', 'grosir')
    expect(eqCalls).toContainEqual({ col: 'tipe', val: 'grosir' })
  })

  it('applies no tipe filter for "semua"', async () => {
    byNamaRows = [makeRow('a', 'Toko A')]
    const search = await action()
    await search('toko', 'semua')
    expect(eqCalls).toEqual([])
  })

  it('surfaces a query failure as an error', async () => {
    queryError = { message: 'boom' }
    const search = await action()
    expect(await search('toko', 'semua')).toEqual({ error: 'Gagal mencari pelanggan.' })
  })
})
