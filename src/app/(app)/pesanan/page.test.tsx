import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { PesananWithRelations } from '@/components/pesanan/order-row'

/**
 * Pins the /pesanan list-header notice end-to-end: given a Supabase
 * `count: 'exact'` result and the rows actually fetched, does the page show
 * "N pesanan" alone, or append the "— menampilkan {LIMIT} terbaru" notice.
 * `listCountNotice` (utils.test.ts) already covers the string-building logic
 * in isolation; this guards the wiring — that the page passes `count` and
 * `rows.length` to it in the right order and only when the 500-row
 * `PESANAN_LIST_LIMIT` cap actually truncated the result.
 */

vi.mock('@/lib/supabase/request-cache', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'u1', role: 'owner', nama: 'Owner', email: 'o@x.test' })),
  getPesananLocked: vi.fn(async () => false),
}))

vi.mock('@/components/realtime/RealtimeRefresh', () => ({
  RealtimeRefresh: () => null,
}))

vi.mock('@/components/pesanan/OrderList', () => ({
  OrderList: () => null,
}))

let queryResult: { data: PesananWithRelations[]; count: number } = { data: [], count: 0 }

function makeRow(i: number): PesananWithRelations {
  return {
    id: `p${i}`,
    kode_pesanan: `KODE-${i}`,
    status: 'diproses',
    created_at: '2026-08-01T00:00:00Z',
    nama_pelanggan: null,
    items: [],
    pembayaran: [],
    pelanggan: null,
    tanggal_pengiriman: null,
  } as unknown as PesananWithRelations
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      limit: () => builder,
      returns: () => builder,
      then: (
        resolve: (v: { data: PesananWithRelations[]; count: number }) => unknown,
        reject?: (e: unknown) => unknown,
      ) => Promise.resolve(queryResult).then(resolve, reject),
    }
    return { from: () => builder }
  },
}))

async function pesananPage() {
  const { default: PesananPage } = await import('./page')
  return PesananPage()
}

describe('PesananPage list-count notice', () => {
  it('shows just the count when under the 500-row cap', async () => {
    queryResult = { data: Array.from({ length: 12 }, (_, i) => makeRow(i)), count: 12 }
    render(await pesananPage())
    expect(screen.getByText('12 pesanan')).toBeInTheDocument()
  })

  it('appends the truncation notice when the fetched count is capped at 500', async () => {
    queryResult = { data: Array.from({ length: 500 }, (_, i) => makeRow(i)), count: 612 }
    render(await pesananPage())
    expect(screen.getByText('612 pesanan — menampilkan 500 terbaru')).toBeInTheDocument()
  })

  it('does not show a truncation notice when count exactly equals the cap', async () => {
    queryResult = { data: Array.from({ length: 500 }, (_, i) => makeRow(i)), count: 500 }
    render(await pesananPage())
    expect(screen.getByText('500 pesanan')).toBeInTheDocument()
  })
})
