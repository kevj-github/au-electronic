import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * `searchPesananGlobal` is the /pesanan "cari di semua pesanan" fallback,
 * offered when a local search misses because the match lives past the
 * 500-row PESANAN_LIST_LIMIT. Covers: auth/role gating, the empty-query
 * short-circuit, merge+dedupe+sort across the two `.ilike()` queries, the
 * helper role's forced `status=diproses` scoping (regardless of the `status`
 * argument passed in) and its tanggal_pengiriman masking, and the owner's
 * status-filter passthrough.
 */

type Row = {
  id: string
  kode_pesanan: string
  nama_pelanggan: string | null
  status: string
  created_at: string
  tanggal_pengiriman: string | null
}

let userRole: string | null = 'owner'
let authed = true
let byKodeRows: Row[] = []
let byNamaRows: Row[] = []
let queryError: { message: string } | null = null
const eqCalls: Array<{ col: string; val: unknown }> = []

function makeRow(id: string, overrides: Partial<Row> = {}): Row {
  return {
    id,
    kode_pesanan: id,
    nama_pelanggan: null,
    status: 'diproses',
    created_at: '2026-08-01T00:00:00Z',
    tanggal_pengiriman: '2026-08-10',
    items: [],
    pelanggan: null,
    ...overrides,
  } as unknown as Row
}

function makeClient() {
  function from(table: string) {
    if (table === 'users') {
      return {
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({ data: userRole ? { role: userRole } : null }),
          }),
        }),
      }
    }
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
          : state.ilikeCol === 'kode_pesanan'
            ? byKodeRows
            : byNamaRows
        return Promise.resolve({ data, error: queryError }).then(resolve, reject)
      },
    }
    return builder
  }
  return {
    from,
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: authed ? { id: 'u1' } : null } }),
    },
  }
}

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => makeClient() }))

async function action() {
  const { searchPesananGlobal } = await import('./search-actions')
  return searchPesananGlobal
}

beforeEach(() => {
  userRole = 'owner'
  authed = true
  byKodeRows = []
  byNamaRows = []
  queryError = null
  eqCalls.length = 0
})

describe('searchPesananGlobal', () => {
  it('rejects when not authenticated', async () => {
    authed = false
    const search = await action()
    expect(await search('AU', 'semua')).toEqual({ error: 'Tidak terautentikasi.' })
  })

  it('rejects when the user has no role row', async () => {
    userRole = null
    const search = await action()
    expect(await search('AU', 'semua')).toEqual({ error: 'Tidak terautentikasi.' })
  })

  it('short-circuits on a blank query without hitting the database', async () => {
    const search = await action()
    expect(await search('   ', 'semua')).toEqual({ rows: [] })
    expect(eqCalls).toEqual([])
  })

  it('merges and dedupes matches from both columns, newest first', async () => {
    byKodeRows = [
      makeRow('a', { created_at: '2026-08-01T00:00:00Z' }),
      makeRow('b', { created_at: '2026-08-03T00:00:00Z' }),
    ]
    byNamaRows = [
      makeRow('b', { created_at: '2026-08-03T00:00:00Z' }), // duplicate of byKode's 'b'
      makeRow('c', { created_at: '2026-08-02T00:00:00Z' }),
    ]
    const search = await action()
    const result = await search('toko', 'semua')
    expect(result.rows?.map((r) => r.p.id)).toEqual(['b', 'c', 'a'])
  })

  it('forces status=diproses for a helper regardless of the requested status', async () => {
    userRole = 'helper'
    byKodeRows = [makeRow('x', { tanggal_pengiriman: '2026-08-10' })]
    const search = await action()
    const result = await search('x', 'selesai')
    expect(eqCalls).toContainEqual({ col: 'status', val: 'diproses' })
    expect(eqCalls).not.toContainEqual({ col: 'status', val: 'selesai' })
    // Masked the same way the page's helper select does.
    expect(result.rows?.[0].p.tanggal_pengiriman).toBeNull()
  })

  it('applies the owner status filter when not "semua"', async () => {
    byKodeRows = [makeRow('y')]
    const search = await action()
    await search('y', 'selesai')
    expect(eqCalls).toContainEqual({ col: 'status', val: 'selesai' })
  })

  it('applies no status filter for an owner searching "semua"', async () => {
    byKodeRows = [makeRow('z')]
    const search = await action()
    await search('z', 'semua')
    expect(eqCalls).toEqual([])
  })

  it('surfaces a query failure as an error', async () => {
    queryError = { message: 'boom' }
    const search = await action()
    expect(await search('AU', 'semua')).toEqual({ error: 'Gagal mencari pesanan.' })
  })
})
