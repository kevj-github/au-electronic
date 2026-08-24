import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrderForm } from './OrderForm'

/**
 * Mirrors `ItemsSection.render.test.tsx`: `OrderForm`'s mobile card list used to
 * inline each line item's markup directly in `.map()` instead of routing through
 * a memoised component (the desktop `hidden sm:block` table already used the
 * memoised `OrderLineItem`). Both layouts are always mounted, so one keystroke
 * in a mobile row re-rendered every other mobile row too. `OrderLineItemCard`
 * fixes this; this test counts `Input` renders per row (via its item-scoped
 * `aria-label`) to catch a regression back to the inline, unmemoised shape.
 * Queries are scoped to the mobile (`sm:hidden`) container since the desktop
 * table renders the same item data with overlapping labels alongside it.
 */

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
        onChange={props.onChange as React.ChangeEventHandler<HTMLInputElement>}
      />
    )
  },
}))

vi.mock('@/app/(app)/pesanan/actions', () => ({
  createPesanan: vi.fn(async () => ({ pesananId: 'p1' })),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))

beforeEach(() => {
  for (const key of Object.keys(inputRenders)) delete inputRenders[key]
})

describe('OrderForm mobile card re-render cost', () => {
  it('typing in one row does not re-render another row on mobile', async () => {
    const user = userEvent.setup()
    const { container } = render(<OrderForm pelangganList={[]} isOwner />)

    const addBtn = screen.getByRole('button', { name: /tambah barang/i })
    await user.click(addBtn)
    await user.click(addBtn)

    const mobile = within(container.querySelector('.sm\\:hidden.space-y-2') as HTMLElement)

    const [firstNama, secondNama] = mobile.getAllByPlaceholderText('Nama barang...')
    await user.type(firstNama, 'A')
    await user.type(secondNama, 'B')

    const label = 'Qty B'
    expect(inputRenders[label]).toBeGreaterThan(0)
    const rendersBefore = inputRenders[label]

    const firstQty = mobile.getByLabelText('Qty A')
    await user.type(firstQty, '5')

    expect(inputRenders[label]).toBe(rendersBefore)
  })
})
