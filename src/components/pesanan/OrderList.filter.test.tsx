import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrderList, type OrderRow } from './OrderList'

/**
 * The search precomputes a lowercased haystack per order instead of calling
 * `toLowerCase()` per field per keystroke, and hoists the date bounds out of the
 * row predicate (they used to be re-parsed once per order, per keystroke).
 *
 * Both are pure speedups, so what needs pinning is that the *semantics* did not
 * move — in particular that concatenating kode and nama into one haystack did
 * not widen matching across the boundary between them.
 */

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('./DeletePesananButton', () => ({ DeletePesananButton: () => null }))

function row(
  kode: string,
  nama: string | null,
  created = '2026-08-01T00:00:00.000Z',
  status: 'diproses' | 'selesai' | 'dibatalkan' = 'diproses'
): OrderRow {
  return {
    p: {
      id: kode,
      kode_pesanan: kode,
      status,
      created_at: created,
      nama_pelanggan: nama,
      pelanggan: null,
      tanggal_pengiriman: null,
    },
    view: {
      diambilCount: 0,
      totalItems: 1,
      totalPesanan: 1000,
      totalDibayar: 0,
      sisaTagihan: 1000,
      tagihan: { kind: 'sisa', amount: 1000 },
    },
  }
}

/**
 * Order codes currently rendered in the desktop table. When nothing matches the
 * component swaps the table for an empty-state message, so a missing table
 * means zero results rather than a broken query.
 */
function visibleCodes() {
  const table = document.querySelector('table')
  if (!table) return []
  return within(table)
    .queryAllByRole('link')
    .map((a) => a.textContent)
    .filter(Boolean)
}

async function search(text: string) {
  const user = userEvent.setup()
  const input = screen.getByPlaceholderText(/Cari kode pesanan/)
  await user.clear(input)
  if (text) await user.type(input, text)
}

const ROWS = [
  row('AU.2026.08.00001', 'Toko Sumber Rejeki'),
  row('AU.2026.08.00002', 'UD Makmur Jaya'),
  row('AU.2026.08.00003', null),
]

describe('OrderList search', () => {
  it('matches on order code', async () => {
    render(<OrderList rows={ROWS} isOwner />)

    await search('00002')

    expect(visibleCodes()).toEqual(['AU.2026.08.00002'])
  })

  it('matches on customer name, case-insensitively', async () => {
    render(<OrderList rows={ROWS} isOwner />)

    await search('SUMBER')

    expect(visibleCodes()).toEqual(['AU.2026.08.00001'])
  })

  it('does not match across the kode/nama boundary', async () => {
    render(<OrderList rows={ROWS} isOwner />)

    // "00001 Toko" is a substring of a naive `kode + ' ' + nama` haystack but
    // matches neither field on its own, so it must find nothing.
    await search('00001 Toko')

    expect(visibleCodes()).toEqual([])
  })

  it('shows everything when the query is cleared', async () => {
    render(<OrderList rows={ROWS} isOwner />)

    await search('00002')
    await search('')

    expect(visibleCodes()).toHaveLength(3)
  })

  it('finds nothing for a non-matching query', async () => {
    render(<OrderList rows={ROWS} isOwner />)

    await search('zzzz')

    expect(screen.getByText(/Tidak ada pesanan yang cocok/)).toBeInTheDocument()
  })

  it('handles an order with no linked customer and no typed name', async () => {
    render(<OrderList rows={ROWS} isOwner />)

    await search('00003')

    expect(visibleCodes()).toEqual(['AU.2026.08.00003'])
  })
})

describe('OrderList date filtering', () => {
  const dated = [
    row('AU.2026.07.00001', 'A', '2026-07-15T10:00:00.000Z'),
    row('AU.2026.08.00002', 'B', '2026-08-10T10:00:00.000Z'),
    row('AU.2026.09.00003', 'C', '2026-09-05T10:00:00.000Z'),
  ]

  async function setDates(from: string, to: string) {
    const user = userEvent.setup()
    if (from) await user.type(screen.getByLabelText('Dari tanggal'), from)
    if (to) await user.type(screen.getByLabelText('Sampai tanggal'), to)
  }

  it('keeps only orders inside the range', async () => {
    render(<OrderList rows={dated} isOwner />)

    await setDates('2026-08-01', '2026-08-31')

    expect(visibleCodes()).toEqual(['AU.2026.08.00002'])
  })

  it('treats the end date as inclusive to the end of that day', async () => {
    render(<OrderList rows={dated} isOwner />)

    // The order is at 10:00 on the 10th; an exclusive bound would drop it.
    await setDates('2026-08-10', '2026-08-10')

    expect(visibleCodes()).toEqual(['AU.2026.08.00002'])
  })

  it('applies a from-only bound', async () => {
    render(<OrderList rows={dated} isOwner />)

    await setDates('2026-08-01', '')

    expect(visibleCodes()).toEqual(['AU.2026.08.00002', 'AU.2026.09.00003'])
  })

  it('combines the date range with the text query', async () => {
    render(<OrderList rows={dated} isOwner />)

    await setDates('2026-07-01', '2026-09-30')
    await search('00003')

    expect(visibleCodes()).toEqual(['AU.2026.09.00003'])
  })
})
