// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ResetChecklistButton } from './ResetChecklistButton'
import { resetChecklist } from '@/app/(app)/pesanan/item-mutation-actions'

vi.mock('@/app/(app)/pesanan/item-mutation-actions', () => ({
  resetChecklist: vi.fn(),
}))

const mockResetChecklist = vi.mocked(resetChecklist)

beforeEach(() => {
  mockResetChecklist.mockReset()
})

function setup(overrides: Partial<{ target: 'helper' | 'owner' }> = {}) {
  return render(
    <ResetChecklistButton
      pesananId="p1"
      target={overrides.target ?? 'helper'}
      label="Reset Checklist Helper"
      confirmTitle="Reset checklist helper?"
      confirmDescription="Semua status pengambilan barang akan direset."
    />
  )
}

describe('ResetChecklistButton', () => {
  it('renders the trigger without calling resetChecklist', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Reset Checklist Helper' })).toBeInTheDocument()
    expect(mockResetChecklist).not.toHaveBeenCalled()
  })

  it('shows the confirmation dialog on click, without calling resetChecklist yet', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: 'Reset Checklist Helper' }))

    expect(await screen.findByText('Reset checklist helper?')).toBeInTheDocument()
    expect(screen.getByText('Semua status pengambilan barang akan direset.')).toBeInTheDocument()
    expect(mockResetChecklist).not.toHaveBeenCalled()
  })

  it('calls resetChecklist with the pesananId and target only after confirming', async () => {
    mockResetChecklist.mockResolvedValue({})
    const user = userEvent.setup()
    setup({ target: 'owner' })

    await user.click(screen.getByRole('button', { name: 'Reset Checklist Helper' }))
    await screen.findByText('Reset checklist helper?')
    await user.click(screen.getByRole('button', { name: 'Reset' }))

    await waitFor(() => expect(mockResetChecklist).toHaveBeenCalledWith('p1', 'owner'))
  })

  it('closes the dialog after a successful reset', async () => {
    mockResetChecklist.mockResolvedValue({})
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: 'Reset Checklist Helper' }))
    await screen.findByText('Reset checklist helper?')
    await user.click(screen.getByRole('button', { name: 'Reset' }))

    await waitFor(() => expect(screen.queryByText('Reset checklist helper?')).not.toBeInTheDocument())
  })

  it('shows the returned error and keeps the dialog open on failure', async () => {
    mockResetChecklist.mockResolvedValue({ error: 'Pesanan sudah selesai.' })
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: 'Reset Checklist Helper' }))
    await screen.findByText('Reset checklist helper?')
    await user.click(screen.getByRole('button', { name: 'Reset' }))

    expect(await screen.findByText('Pesanan sudah selesai.')).toBeInTheDocument()
    expect(screen.getByText('Reset checklist helper?')).toBeInTheDocument()
  })

  it('disables the confirm and cancel buttons while the action is in flight', async () => {
    let resolve: (v: { error?: string }) => void = () => {}
    mockResetChecklist.mockImplementation(() => new Promise((r) => { resolve = r }))
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: 'Reset Checklist Helper' }))
    await screen.findByText('Reset checklist helper?')
    await user.click(screen.getByRole('button', { name: 'Reset' }))

    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Batal' })).toBeDisabled()

    resolve({})
    await waitFor(() => expect(screen.queryByText('Reset checklist helper?')).not.toBeInTheDocument())
  })
})
