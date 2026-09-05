import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrderList, type OrderRow } from './OrderList'

/**
 * Mirrors OrderForm.render.test.tsx / ItemsSection.render.test.tsx.
 * `OrderRowCard`/`OrderRowTableRow` (OrderListRow.tsx) are already
 * `memo()`-wrapped, and their `row` prop is a stable object reference across
 * a filter recompute — `.filter()`/`.slice()` never rebuild the row objects
 * themselves (see order-row.ts / use-paged-list.ts) — so a keystroke in the
 * search box that does not remove a row from the filtered/paged results
 * should not re-render that row. This pins that guarantee rather than
 * asserting the memo boundary exists structurally, since a prop that changes
 * reference on every recompute would defeat `memo()` silently.
 *
 * Counts `DeletePesananButton` renders, keyed by `pesananId`: it sits inside
 * both memo boundaries and its id is unique per row (unlike `StatusBadge`'s
 * `status`, which rows can share). Mocking it also keeps this test from
 * depending on `ConfirmDeleteButton`'s own render behaviour.
 */

const deleteButtonRenders: Record<string, number> = {}

vi.mock('./DeletePesananButton', () => ({
  DeletePesananButton: ({ pesananId }: { pesananId: string }) => {
    deleteButtonRenders[pesananId] = (deleteButtonRenders[pesananId] ?? 0) + 1
    return null
  },
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

beforeEach(() => {
  for (const key of Object.keys(deleteButtonRenders)) delete deleteButtonRenders[key]
})

function row(kode: string, nama: string): OrderRow {
  return {
    p: {
      id: kode,
      kode_pesanan: kode,
      status: 'diproses',
      created_at: '2026-08-01T00:00:00.000Z',
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

const ROWS = [
  row('AU.2026.08.00001', 'Toko Satu'),
  row('AU.2026.08.00002', 'Toko Dua'),
]

describe('OrderList re-render cost', () => {
  it('typing a query that keeps every row in the results does not re-render other rows', async () => {
    const user = userEvent.setup()
    render(<OrderList rows={ROWS} isOwner truncated={false} />)

    expect(deleteButtonRenders['AU.2026.08.00002']).toBeGreaterThan(0)
    const rendersBefore = deleteButtonRenders['AU.2026.08.00002']

    // "AU" matches both order codes, so neither row is filtered out — only
    // OrderList's own search state changes, not any row's data.
    const input = screen.getByPlaceholderText(/Cari kode pesanan/)
    await user.type(input, 'AU')

    expect(deleteButtonRenders['AU.2026.08.00002']).toBe(rendersBefore)
  })
})
