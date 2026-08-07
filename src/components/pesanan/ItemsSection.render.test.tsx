import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ItemsSection } from './ItemsSection'

/**
 * `ItemsSection` owns the price-input state for every row, and renders the item
 * list twice over — a `sm:hidden` card list and a `hidden sm:block` table, both
 * always mounted. So one keystroke in one price field re-renders every row of
 * both layouts.
 *
 * Measuring that needs care: wrapping the child components in a counting
 * function component puts the counter *outside* their memo boundary, which
 * counts the wrapper and reports nothing useful. Instead this counts renders of
 * the `Checkbox` primitive. `ItemsSection` never renders one directly — every
 * Checkbox in the tree comes from `ItemChecklistCheckbox` or
 * `HelperItemChecklist` — so it rises if and only if a memoised child's body
 * actually re-runs. Removing `memo` from either component fails this test.
 */

let checkboxRenders = 0

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: (props: Record<string, unknown>) => {
    checkboxRenders += 1
    return <input type="checkbox" readOnly aria-label={props['aria-label'] as string} />
  },
}))

vi.mock('@/app/(app)/pesanan/actions', () => ({
  addItemToPesanan: vi.fn(async () => ({})),
  updateItemDetails: vi.fn(async () => ({})),
  deleteItemFromPesanan: vi.fn(async () => ({})),
  updateItemHarga: vi.fn(async () => ({})),
  toggleItemDicekOwner: vi.fn(async () => ({})),
  setItemJumlahDiambil: vi.fn(async () => ({})),
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

function items(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `item-${i}`,
    nama_barang: `Barang ${i}`,
    qty: 2,
    jumlah_diambil: 0,
    dicek_oleh_owner: false,
    harga_satuan: 0,
    subtotal: 0,
  }))
}

beforeEach(() => {
  checkboxRenders = 0
})

describe('ItemsSection re-render cost', () => {
  it('typing a price re-renders no checklist control on the order', async () => {
    const user = userEvent.setup()
    render(
      <ItemsSection pesananId="p1" items={items(10)} isOwner isLocked={false} priceEditable />
    )

    const afterMount = checkboxRenders
    expect(afterMount).toBeGreaterThan(0)

    const [priceInput] = screen.getAllByLabelText('Harga satuan Barang 0')
    await user.type(priceInput, '12345')

    // Five keystrokes x 10 items x 2 layouts x 2 controls is what this would
    // cost unmemoised. None of those props changed, so the correct count is 0.
    expect(checkboxRenders - afterMount).toBe(0)
  })

  it('scales flat: a bigger order costs no more per keystroke', async () => {
    const user = userEvent.setup()
    const { unmount } = render(
      <ItemsSection pesananId="p1" items={items(40)} isOwner isLocked={false} priceEditable />
    )
    const afterMount = checkboxRenders

    const [priceInput] = screen.getAllByLabelText('Harga satuan Barang 0')
    await user.type(priceInput, '12345')

    expect(checkboxRenders - afterMount).toBe(0)
    unmount()
  })

  it('still re-renders a control whose own props change', async () => {
    const base = items(3)
    const { rerender } = render(
      <ItemsSection pesananId="p1" items={base} isOwner isLocked={false} priceEditable />
    )
    const afterMount = checkboxRenders

    const changed = items(3)
    changed[1].jumlah_diambil = 2
    rerender(
      <ItemsSection pesananId="p1" items={changed} isOwner isLocked={false} priceEditable />
    )

    // Memoisation must not swallow a real server-revalidated update.
    expect(checkboxRenders).toBeGreaterThan(afterMount)
  })
})
