// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DeletePaymentButton } from './DeletePaymentButton'
import { deletePembayaran } from '@/app/(app)/pesanan/[id]/payment-actions'

vi.mock('@/app/(app)/pesanan/[id]/payment-actions', () => ({
  deletePembayaran: vi.fn(),
}))

const mockDeletePembayaran = vi.mocked(deletePembayaran)

beforeEach(() => {
  mockDeletePembayaran.mockReset()
})

describe('DeletePaymentButton', () => {
  it('renders the trigger without calling deletePembayaran', () => {
    render(<DeletePaymentButton pembayaranId="pay1" />)
    expect(screen.getByRole('button', { name: 'Hapus' })).toBeInTheDocument()
    expect(mockDeletePembayaran).not.toHaveBeenCalled()
  })

  it('shows the confirmation dialog on click, without calling deletePembayaran yet', async () => {
    const user = userEvent.setup()
    render(<DeletePaymentButton pembayaranId="pay1" />)

    await user.click(screen.getByRole('button', { name: 'Hapus' }))

    expect(await screen.findByText('Hapus pembayaran ini?')).toBeInTheDocument()
    expect(screen.getByText('Tindakan ini tidak dapat dibatalkan.')).toBeInTheDocument()
    expect(mockDeletePembayaran).not.toHaveBeenCalled()
  })

  it('calls deletePembayaran with the given pembayaranId only after confirming', async () => {
    mockDeletePembayaran.mockResolvedValue({})
    const user = userEvent.setup()
    render(<DeletePaymentButton pembayaranId="pay42" />)

    await user.click(screen.getByRole('button', { name: 'Hapus' }))
    await screen.findByText('Hapus pembayaran ini?')
    const buttons = screen.getAllByRole('button', { name: 'Hapus' })
    await user.click(buttons[buttons.length - 1])

    await waitFor(() => expect(mockDeletePembayaran).toHaveBeenCalledWith('pay42'))
  })

  it('shows the returned error and keeps the dialog open on failure', async () => {
    mockDeletePembayaran.mockResolvedValue({ error: 'Gagal menghapus pembayaran.' })
    const user = userEvent.setup()
    render(<DeletePaymentButton pembayaranId="pay1" />)

    await user.click(screen.getByRole('button', { name: 'Hapus' }))
    await screen.findByText('Hapus pembayaran ini?')
    const buttons = screen.getAllByRole('button', { name: 'Hapus' })
    await user.click(buttons[buttons.length - 1])

    expect(await screen.findByText('Gagal menghapus pembayaran.')).toBeInTheDocument()
    expect(screen.getByText('Hapus pembayaran ini?')).toBeInTheDocument()
  })
})
