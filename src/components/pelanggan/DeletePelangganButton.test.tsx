// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DeletePelangganButton } from './DeletePelangganButton'
import { deletePelanggan } from '@/app/(app)/pelanggan/actions'

/**
 * Mirrors DeletePesananButton.test.tsx / DeletePaymentButton.test.tsx — the
 * other two ConfirmDeleteButton wrappers already had this coverage, leaving
 * this one as the only row-level delete button with none.
 */

const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

vi.mock('@/app/(app)/pelanggan/actions', () => ({
  deletePelanggan: vi.fn(),
}))

const mockDeletePelanggan = vi.mocked(deletePelanggan)

beforeEach(() => {
  refresh.mockClear()
  mockDeletePelanggan.mockReset()
})

describe('DeletePelangganButton', () => {
  it('renders the trigger without calling deletePelanggan', () => {
    render(<DeletePelangganButton pelangganId="c1" />)
    expect(screen.getByRole('button', { name: 'Hapus pelanggan' })).toBeInTheDocument()
    expect(mockDeletePelanggan).not.toHaveBeenCalled()
  })

  it('shows the confirmation dialog on click, without calling deletePelanggan yet', async () => {
    const user = userEvent.setup()
    render(<DeletePelangganButton pelangganId="c1" />)

    await user.click(screen.getByRole('button', { name: 'Hapus pelanggan' }))

    expect(await screen.findByText('Hapus pelanggan?')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Data pelanggan akan dihapus. Pesanan yang terkait akan tetap ada dengan nama pelanggan tersimpan.'
      )
    ).toBeInTheDocument()
    expect(mockDeletePelanggan).not.toHaveBeenCalled()
  })

  it('calls deletePelanggan with the given pelangganId and refreshes only after confirming', async () => {
    mockDeletePelanggan.mockResolvedValue({})
    const user = userEvent.setup()
    render(<DeletePelangganButton pelangganId="c42" />)

    await user.click(screen.getByRole('button', { name: 'Hapus pelanggan' }))
    await screen.findByText('Hapus pelanggan?')
    await user.click(screen.getByRole('button', { name: 'Hapus' }))

    await waitFor(() => expect(mockDeletePelanggan).toHaveBeenCalledWith('c42'))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('shows the returned error, does not refresh, and keeps the dialog open on failure', async () => {
    mockDeletePelanggan.mockResolvedValue({ error: 'Pelanggan tidak ditemukan.' })
    const user = userEvent.setup()
    render(<DeletePelangganButton pelangganId="c1" />)

    await user.click(screen.getByRole('button', { name: 'Hapus pelanggan' }))
    await screen.findByText('Hapus pelanggan?')
    await user.click(screen.getByRole('button', { name: 'Hapus' }))

    expect(await screen.findByText('Pelanggan tidak ditemukan.')).toBeInTheDocument()
    expect(screen.getByText('Hapus pelanggan?')).toBeInTheDocument()
    expect(refresh).not.toHaveBeenCalled()
  })
})
