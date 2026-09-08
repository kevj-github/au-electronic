// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DeleteHelperButton } from './DeleteHelperButton'
import { deleteHelper } from '@/app/(app)/pengaturan/actions'

vi.mock('@/app/(app)/pengaturan/actions', () => ({
  deleteHelper: vi.fn(),
}))

const mockDeleteHelper = vi.mocked(deleteHelper)

beforeEach(() => {
  mockDeleteHelper.mockReset()
})

describe('DeleteHelperButton', () => {
  it('renders the trigger without calling deleteHelper', () => {
    render(<DeleteHelperButton userId="u1" />)
    expect(screen.getByRole('button', { name: 'Hapus' })).toBeInTheDocument()
    expect(mockDeleteHelper).not.toHaveBeenCalled()
  })

  it('shows the confirmation dialog on click, without calling deleteHelper yet', async () => {
    const user = userEvent.setup()
    render(<DeleteHelperButton userId="u1" />)

    await user.click(screen.getByRole('button', { name: 'Hapus' }))

    expect(await screen.findByText('Hapus akun helper ini?')).toBeInTheDocument()
    expect(screen.getByText('Tindakan ini tidak dapat dibatalkan.')).toBeInTheDocument()
    expect(mockDeleteHelper).not.toHaveBeenCalled()
  })

  it('calls deleteHelper with the given userId only after confirming', async () => {
    mockDeleteHelper.mockResolvedValue({})
    const user = userEvent.setup()
    render(<DeleteHelperButton userId="u42" />)

    await user.click(screen.getByRole('button', { name: 'Hapus' }))
    await screen.findByText('Hapus akun helper ini?')
    // The trigger button stays mounted behind the dialog, so both it and the
    // dialog's confirm button share the "Hapus" name — the confirm button is
    // the one rendered last.
    const buttons = screen.getAllByRole('button', { name: 'Hapus' })
    await user.click(buttons[buttons.length - 1])

    await waitFor(() => expect(mockDeleteHelper).toHaveBeenCalledWith('u42'))
  })

  it('shows the returned error and keeps the dialog open on failure', async () => {
    mockDeleteHelper.mockResolvedValue({ error: 'Tidak dapat memverifikasi akun yang akan dihapus.' })
    const user = userEvent.setup()
    render(<DeleteHelperButton userId="u1" />)

    await user.click(screen.getByRole('button', { name: 'Hapus' }))
    await screen.findByText('Hapus akun helper ini?')
    const buttons = screen.getAllByRole('button', { name: 'Hapus' })
    await user.click(buttons[buttons.length - 1])

    expect(await screen.findByText('Tidak dapat memverifikasi akun yang akan dihapus.')).toBeInTheDocument()
    expect(screen.getByText('Hapus akun helper ini?')).toBeInTheDocument()
  })
})
