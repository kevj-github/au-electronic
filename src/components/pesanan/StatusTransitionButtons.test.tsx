import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StatusTransitionButtons } from './StatusTransitionButtons'
import { updateStatusPesanan } from '@/app/(app)/pesanan/order-lifecycle-actions'

vi.mock('@/app/(app)/pesanan/order-lifecycle-actions', () => ({
  updateStatusPesanan: vi.fn(),
}))

const mockUpdateStatusPesanan = vi.mocked(updateStatusPesanan)

const statusLabel = {
  diproses: 'Buka Kembali',
  selesai: 'Selesai',
  dibatalkan: 'Batalkan',
}

beforeEach(() => {
  mockUpdateStatusPesanan.mockReset()
})

describe('StatusTransitionButtons', () => {
  it('renders one button per next status, labelled as the action', () => {
    render(
      <StatusTransitionButtons
        pesananId="p1"
        nextStatuses={['selesai', 'dibatalkan']}
        statusLabel={statusLabel}
      />
    )

    expect(screen.getByRole('button', { name: 'Selesai' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Batalkan' })).toBeInTheDocument()
  })

  it('renders nothing when there are no next statuses', () => {
    const { container } = render(
      <StatusTransitionButtons pesananId="p1" nextStatuses={[]} statusLabel={statusLabel} />
    )
    expect(container.querySelectorAll('button')).toHaveLength(0)
  })

  it('does not call the action until the confirmation dialog is confirmed', async () => {
    const user = userEvent.setup()
    mockUpdateStatusPesanan.mockResolvedValue({})

    render(
      <StatusTransitionButtons pesananId="p1" nextStatuses={['selesai']} statusLabel={statusLabel} />
    )

    await user.click(screen.getByRole('button', { name: 'Selesai' }))
    expect(mockUpdateStatusPesanan).not.toHaveBeenCalled()
    expect(await screen.findByText('Tandai pesanan sebagai selesai?')).toBeInTheDocument()
  })

  it('confirming calls updateStatusPesanan with the pesanan id and target status', async () => {
    const user = userEvent.setup()
    mockUpdateStatusPesanan.mockResolvedValue({})

    render(
      <StatusTransitionButtons pesananId="p42" nextStatuses={['selesai']} statusLabel={statusLabel} />
    )

    await user.click(screen.getByRole('button', { name: 'Selesai' }))
    await screen.findByText('Tandai pesanan sebagai selesai?')

    const confirmButtons = screen.getAllByRole('button', { name: 'Selesai' })
    await user.click(confirmButtons[confirmButtons.length - 1])

    await waitFor(() => expect(mockUpdateStatusPesanan).toHaveBeenCalledTimes(1))
    expect(mockUpdateStatusPesanan).toHaveBeenCalledWith('p42', 'selesai')
  })

  it('closes the dialog after a successful transition', async () => {
    const user = userEvent.setup()
    mockUpdateStatusPesanan.mockResolvedValue({})

    render(
      <StatusTransitionButtons pesananId="p1" nextStatuses={['selesai']} statusLabel={statusLabel} />
    )

    await user.click(screen.getByRole('button', { name: 'Selesai' }))
    await screen.findByText('Tandai pesanan sebagai selesai?')
    const confirmButtons = screen.getAllByRole('button', { name: 'Selesai' })
    await user.click(confirmButtons[confirmButtons.length - 1])

    await waitFor(() =>
      expect(screen.queryByText('Tandai pesanan sebagai selesai?')).not.toBeInTheDocument()
    )
  })

  it('cancelling the dialog does not call the action', async () => {
    const user = userEvent.setup()
    mockUpdateStatusPesanan.mockResolvedValue({})

    render(
      <StatusTransitionButtons pesananId="p1" nextStatuses={['dibatalkan']} statusLabel={statusLabel} />
    )

    await user.click(screen.getByRole('button', { name: 'Batalkan' }))
    await screen.findByText('Batalkan pesanan ini?')

    await user.click(screen.getByRole('button', { name: 'Batal' }))

    await waitFor(() => expect(screen.queryByText('Batalkan pesanan ini?')).not.toBeInTheDocument())
    expect(mockUpdateStatusPesanan).not.toHaveBeenCalled()
  })

  it('shows the error and keeps the dialog open when the action fails', async () => {
    const user = userEvent.setup()
    mockUpdateStatusPesanan.mockResolvedValue({ error: 'Gagal mengubah status.' })

    render(
      <StatusTransitionButtons pesananId="p1" nextStatuses={['selesai']} statusLabel={statusLabel} />
    )

    await user.click(screen.getByRole('button', { name: 'Selesai' }))
    await screen.findByText('Tandai pesanan sebagai selesai?')
    const confirmButtons = screen.getAllByRole('button', { name: 'Selesai' })
    await user.click(confirmButtons[confirmButtons.length - 1])

    expect(await screen.findByText('Gagal mengubah status.')).toBeInTheDocument()
    expect(screen.getByText('Tandai pesanan sebagai selesai?')).toBeInTheDocument()
  })

  it('clears a previous error when the dialog is reopened', async () => {
    const user = userEvent.setup()
    mockUpdateStatusPesanan.mockResolvedValue({ error: 'Gagal mengubah status.' })

    render(
      <StatusTransitionButtons pesananId="p1" nextStatuses={['selesai']} statusLabel={statusLabel} />
    )

    await user.click(screen.getByRole('button', { name: 'Selesai' }))
    await screen.findByText('Tandai pesanan sebagai selesai?')
    const confirmButtons = screen.getAllByRole('button', { name: 'Selesai' })
    await user.click(confirmButtons[confirmButtons.length - 1])
    expect(await screen.findByText('Gagal mengubah status.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Batal' }))
    await waitFor(() =>
      expect(screen.queryByText('Tandai pesanan sebagai selesai?')).not.toBeInTheDocument()
    )

    await user.click(screen.getByRole('button', { name: 'Selesai' }))
    await screen.findByText('Tandai pesanan sebagai selesai?')
    expect(screen.queryByText('Gagal mengubah status.')).not.toBeInTheDocument()
  })

  it('shows the reopen copy for transitioning back to diproses', async () => {
    const user = userEvent.setup()
    render(
      <StatusTransitionButtons pesananId="p1" nextStatuses={['diproses']} statusLabel={statusLabel} />
    )

    await user.click(screen.getByRole('button', { name: 'Buka Kembali' }))
    expect(await screen.findByText('Buka kembali pesanan ini?')).toBeInTheDocument()
    expect(screen.getByText('Status kembali ke "diproses" dan pesanan bisa diedit lagi.')).toBeInTheDocument()
  })

  it('styles the "dibatalkan" transition as destructive, and others as default', () => {
    render(
      <StatusTransitionButtons
        pesananId="p1"
        nextStatuses={['selesai', 'dibatalkan']}
        statusLabel={statusLabel}
      />
    )

    expect(screen.getByRole('button', { name: 'Batalkan' }).className).toContain('bg-destructive')
    expect(screen.getByRole('button', { name: 'Selesai' }).className).not.toContain('bg-destructive')
  })
})
