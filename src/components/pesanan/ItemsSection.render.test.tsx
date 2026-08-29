import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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
 *
 * That checkbox count alone doesn't prove `ItemRowMobile`/`ItemRowDesktop`
 * themselves bail out, though: those two are `ItemChecklistCheckbox`'s parent,
 * not the thing under test there, and since `ItemChecklistCheckbox` is *already*
 * independently memoised with primitive props, its render count stays flat even
 * if the un-memoised row above it re-runs its whole body every keystroke — which
 * is exactly what shipped before this file's row-render test was added (see
 * `ItemRowMobile`/`ItemRowDesktop`, and CLAUDE.md's note on the fix). The
 * `describe('ItemsSection row component re-render cost', ...)` block below
 * closes that gap the same way `OrderForm.render.test.tsx` does: it counts
 * `Input` renders by their item-scoped `aria-label`, which only stays flat if
 * the row component containing that Input actually skips re-rendering.
 */

let checkboxRenders = 0

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: (props: Record<string, unknown>) => {
    checkboxRenders += 1
    return <input type="checkbox" readOnly aria-label={props['aria-label'] as string} />
  },
}))

const inputRenders: Record<string, number> = {}

vi.mock('@/components/ui/input', () => ({
  Input: (props: Record<string, unknown>) => {
    const label = (props['aria-label'] as string) ?? (props.placeholder as string) ?? ''
    inputRenders[label] = (inputRenders[label] ?? 0) + 1
    return (
      <input
        aria-label={label || undefined}
        placeholder={props.placeholder as string}
        value={props.value as string}
        disabled={props.disabled as boolean}
        onChange={props.onChange as React.ChangeEventHandler<HTMLInputElement>}
        onBlur={props.onBlur as React.FocusEventHandler<HTMLInputElement>}
      />
    )
  },
}))

vi.mock('@/app/(app)/pesanan/item-mutation-actions', () => ({
  addItemToPesanan: vi.fn(async () => ({})),
  updateItemDetails: vi.fn(async () => ({})),
  deleteItemFromPesanan: vi.fn(async () => ({})),
  updateItemHarga: vi.fn(async () => ({})),
  toggleItemDicekOwner: vi.fn(async () => ({})),
  setItemJumlahDiambil: vi.fn(async () => ({})),
}))

// A stable object, not a fresh one per call: real Next.js `useRouter()` returns
// a referentially stable router, which `savePrice`/`saveEdit`/`confirmDelete`
// rely on (they list `router` in their `useCallback` deps). A mock that
// returns a new object on every call would falsely fail the tests below by
// giving every row a new callback identity on every keystroke.
const mockRouter = { refresh: vi.fn() }
vi.mock('next/navigation', () => ({ useRouter: () => mockRouter }))

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
  for (const key of Object.keys(inputRenders)) delete inputRenders[key]
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

describe('ItemsSection row component re-render cost', () => {
  // Both layouts render an Input with the same aria-label per item (mobile card
  // + desktop table), so queries are scoped to the mobile (`sm:hidden`)
  // container the same way OrderForm.render.test.tsx scopes to its mobile list.
  function mobileScope(container: HTMLElement) {
    return within(container.querySelector('.space-y-2.sm\\:hidden') as HTMLElement)
  }

  it('typing in one row does not re-render another row', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <ItemsSection pesananId="p1" items={items(10)} isOwner isLocked={false} priceEditable />
    )
    const mobile = mobileScope(container)

    const label = 'Harga satuan Barang 1'
    expect(inputRenders[label]).toBeGreaterThan(0)
    const rendersBefore = inputRenders[label]

    const target = mobile.getByLabelText('Harga satuan Barang 0')
    await user.type(target, '5')

    // Only item 0's own row should re-render; item 1's row (and its Input)
    // must not. Regresses if ItemRowMobile/ItemRowDesktop lose their memo() or
    // ItemsSection goes back to passing them fresh inline callbacks each render.
    expect(inputRenders[label]).toBe(rendersBefore)
  })

  it('scales flat: a bigger order costs no more re-renders per keystroke', async () => {
    const user = userEvent.setup()
    const { container, unmount } = render(
      <ItemsSection pesananId="p1" items={items(40)} isOwner isLocked={false} priceEditable />
    )
    const mobile = mobileScope(container)

    const label = 'Harga satuan Barang 39'
    const rendersBefore = inputRenders[label]

    const target = mobile.getByLabelText('Harga satuan Barang 0')
    await user.type(target, '5')

    expect(inputRenders[label]).toBe(rendersBefore)
    unmount()
  })
})
