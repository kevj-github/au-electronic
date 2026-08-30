import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Pelanggan } from '@/lib/types'

/**
 * Mirrors pesanan/page.test.tsx: pins the /pelanggan list-header notice
 * end-to-end against the 500-row `PELANGGAN_LIST_LIMIT` cap. `listCountNotice`
 * (utils.test.ts) covers the string logic in isolation; this guards the
 * wiring between the Supabase `count: 'exact'` result and that helper.
 */

vi.mock('@/lib/supabase/request-cache', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'u1', role: 'owner', nama: 'Owner', email: 'o@x.test' })),
}))

vi.mock('@/components/realtime/RealtimeRefresh', () => ({
  RealtimeRefresh: () => null,
}))

vi.mock('@/components/pelanggan/PelangganList', () => ({
  PelangganList: () => null,
}))

let queryResult: { data: Pelanggan[]; count: number } = { data: [], count: 0 }

function makeRow(i: number): Pelanggan {
  return {
    id: `c${i}`,
    nama: `Pelanggan ${i}`,
    telepon: null,
    alamat: null,
    tipe: 'reguler',
    created_at: '2026-08-01T00:00:00Z',
  } as unknown as Pelanggan
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    const builder = {
      select: () => builder,
      order: () => builder,
      limit: () => builder,
      returns: () => builder,
      then: (
        resolve: (v: { data: Pelanggan[]; count: number }) => unknown,
        reject?: (e: unknown) => unknown,
      ) => Promise.resolve(queryResult).then(resolve, reject),
    }
    return { from: () => builder }
  },
}))

async function pelangganPage() {
  const { default: PelangganPage } = await import('./page')
  return PelangganPage()
}

describe('PelangganPage list-count notice', () => {
  it('shows just the count when under the 500-row cap', async () => {
    queryResult = { data: Array.from({ length: 8 }, (_, i) => makeRow(i)), count: 8 }
    render(await pelangganPage())
    expect(screen.getByText('8 pelanggan terdaftar')).toBeInTheDocument()
  })

  it('appends the truncation notice when the fetched count is capped at 500', async () => {
    queryResult = { data: Array.from({ length: 500 }, (_, i) => makeRow(i)), count: 733 }
    render(await pelangganPage())
    expect(screen.getByText('733 pelanggan terdaftar — menampilkan 500')).toBeInTheDocument()
  })

  it('does not show a truncation notice when count exactly equals the cap', async () => {
    queryResult = { data: Array.from({ length: 500 }, (_, i) => makeRow(i)), count: 500 }
    render(await pelangganPage())
    expect(screen.getByText('500 pelanggan terdaftar')).toBeInTheDocument()
  })
})
