// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DeletePesananButton } from './DeletePesananButton'
import { deletePesanan } from '@/app/(app)/pesanan/order-lifecycle-actions'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

vi.mock('@/app/(app)/pesanan/order-lifecycle-actions', () => ({
  deletePesanan: vi.fn(),
}))

const mockDeletePesanan = vi.mocked(deletePesanan)

beforeEach(() => {
  refresh.mockClear()
  mockDeletePesanan.mockReset()
})

describe('DeletePesananButton', () => {
  it('renders the trigger without calling deletePesanan', () => {
    render(<DeletePesananButton pesananId="p1" />)
    expect(screen.getByRole('button', { name: 'Hapus pesanan' })).toBeInTheDocument()
    expect(mockDeletePesanan).not.toHaveBeenCalled()
  })

  it('shows the confirmation dialog on click, without calling deletePesanan yet', async () => {
    const user = userEvent.setup()
    render(<DeletePesananButton pesananId="p1" />)

    await user.click(screen.getByRole('button', { name: 'Hapus pesanan' }))

    expect(await screen.findByText('Hapus pesanan?')).toBeInTheDocument()
    expect(
      screen.getByText('Semua barang dan pembayaran terkait akan ikut terhapus. Tindakan ini tidak dapat dibatalkan.')
    ).toBeInTheDocument()
    expect(mockDeletePesanan).not.toHaveBeenCalled()
  })

  it('calls deletePesanan with the given pesananId and refreshes only after confirming', async () => {
    mockDeletePesanan.mockResolvedValue({})
    const user = userEvent.setup()
    render(<DeletePesananButton pesananId="p42" />)

    await user.click(screen.getByRole('button', { name: 'Hapus pesanan' }))
    await screen.findByText('Hapus pesanan?')
    await user.click(screen.getByRole('button', { name: 'Hapus' }))

    await waitFor(() => expect(mockDeletePesanan).toHaveBeenCalledWith('p42'))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('shows the returned error, does not refresh, and keeps the dialog open on failure', async () => {
    mockDeletePesanan.mockResolvedValue({ error: 'Gagal menghapus pesanan.' })
    const user = userEvent.setup()
    render(<DeletePesananButton pesananId="p1" />)

    await user.click(screen.getByRole('button', { name: 'Hapus pesanan' }))
    await screen.findByText('Hapus pesanan?')
    await user.click(screen.getByRole('button', { name: 'Hapus' }))

    expect(await screen.findByText('Gagal menghapus pesanan.')).toBeInTheDocument()
    expect(screen.getByText('Hapus pesanan?')).toBeInTheDocument()
    expect(refresh).not.toHaveBeenCalled()
  })
})
