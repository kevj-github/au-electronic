import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ItemChecklistCheckbox } from './ItemChecklistCheckbox'
import { toggleItemDicekOwner } from '@/app/(app)/pesanan/item-mutation-actions'

vi.mock('@/app/(app)/pesanan/item-mutation-actions', () => ({
  toggleItemDicekOwner: vi.fn(),
}))

const mockToggle = vi.mocked(toggleItemDicekOwner)

beforeEach(() => {
  mockToggle.mockReset()
})

describe('ItemChecklistCheckbox', () => {
  it('renders checked/unchecked from the checked prop', () => {
    const { rerender } = render(
      <ItemChecklistCheckbox itemId="i1" checked={false} kind="owner" label="Dicek" />
    )
    expect(screen.getByRole('checkbox', { name: /Dicek/ })).not.toBeChecked()

    rerender(<ItemChecklistCheckbox itemId="i1" checked={true} kind="owner" label="Dicek" />)
    expect(screen.getByRole('checkbox', { name: /Dicek/ })).toBeChecked()
  })

  it('flips immediately on click, before the action resolves', async () => {
    let resolveToggle: (v: { error?: string }) => void = () => {}
    mockToggle.mockImplementation(() => new Promise((resolve) => { resolveToggle = resolve }))
    const user = userEvent.setup()

    render(<ItemChecklistCheckbox itemId="i1" checked={false} kind="owner" label="Dicek" />)
    await user.click(screen.getByRole('checkbox', { name: /Dicek/ }))

    expect(screen.getByRole('checkbox', { name: /Dicek/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Dicek/ })).toHaveAttribute('aria-disabled', 'true')
    expect(mockToggle).toHaveBeenCalledWith('i1', true)

    resolveToggle({})
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: /Dicek/ })).not.toHaveAttribute('aria-disabled', 'true')
    )
  })

  it('reverts to unchecked when the toggle action fails', async () => {
    mockToggle.mockResolvedValue({ error: 'Gagal.' })
    const user = userEvent.setup()

    render(<ItemChecklistCheckbox itemId="i1" checked={false} kind="owner" label="Dicek" />)
    await user.click(screen.getByRole('checkbox', { name: /Dicek/ }))

    await waitFor(() => expect(screen.getByRole('checkbox', { name: /Dicek/ })).not.toBeChecked())
  })

  it('a fresher checked prop wins over our own still-in-flight commit, even if that commit later fails', async () => {
    // Regression for the render-phase resync: if a server-revalidated prop
    // arrives (any reason — our own action completing via a full
    // revalidation, or someone else's independent change) while our commit
    // is still pending, it must not be spuriously reverted by our commit's
    // own error handling once that later resolves.
    let resolveToggle: (v: { error?: string }) => void = () => {}
    mockToggle.mockImplementation(() => new Promise((resolve) => { resolveToggle = resolve }))
    const user = userEvent.setup()

    const { rerender } = render(
      <ItemChecklistCheckbox itemId="i1" checked={false} kind="owner" label="Dicek" />
    )
    await user.click(screen.getByRole('checkbox', { name: /Dicek/ }))
    expect(screen.getByRole('checkbox', { name: /Dicek/ })).toBeChecked()

    rerender(<ItemChecklistCheckbox itemId="i1" checked={true} kind="owner" label="Dicek" />)
    expect(screen.getByRole('checkbox', { name: /Dicek/ })).toBeChecked()

    resolveToggle({ error: 'Gagal.' })
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: /Dicek/ })).not.toHaveAttribute('aria-disabled', 'true')
    )
    expect(screen.getByRole('checkbox', { name: /Dicek/ })).toBeChecked()
  })

  it('respects the disabled prop regardless of loading', () => {
    render(<ItemChecklistCheckbox itemId="i1" checked={false} kind="owner" label="Dicek" disabled />)
    expect(screen.getByRole('checkbox', { name: /Dicek/ })).toHaveAttribute('aria-disabled', 'true')
  })

  it('hides the label when showLabel is false', () => {
    render(
      <ItemChecklistCheckbox itemId="i1" checked={false} kind="owner" label="Dicek" showLabel={false} />
    )
    expect(screen.queryByText('Dicek')).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Dicek/ })).toBeInTheDocument()
  })
})
