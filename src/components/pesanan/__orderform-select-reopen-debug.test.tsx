import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrderForm } from './OrderForm'
import type { Pelanggan } from '@/lib/types'

vi.mock('@/app/(app)/pesanan/actions', () => ({
  createPesanan: vi.fn(async () => ({ pesananId: 'p1' })),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))

const pelangganList: Pelanggan[] = [
  {
    id: 'c1',
    nama: 'Toko Sumber Rejeki',
    telepon: null,
    alamat: 'Jl. Merdeka 1',
    tipe: 'retail',
    created_at: '2026-01-01T00:00:00.000Z',
  },
]

describe('OrderForm pelanggan select reopen (debug)', () => {
  it('reopens after a pick, with waitFor on close first', async () => {
    const user = userEvent.setup()
    render(<OrderForm pelangganList={pelangganList} isOwner />)
    const trigger = screen.getByRole('combobox', { name: 'Pilih dari daftar' })

    await user.click(trigger)
    await user.click(screen.getByRole('option', { name: /Toko Sumber Rejeki/ }))
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'))

    await user.click(trigger)
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'true'))
  })

  it('reopens after a pick, immediate click with no waitFor on close', async () => {
    const user = userEvent.setup()
    render(<OrderForm pelangganList={pelangganList} isOwner />)
    const trigger = screen.getByRole('combobox', { name: 'Pilih dari daftar' })

    await user.click(trigger)
    await user.click(screen.getByRole('option', { name: /Toko Sumber Rejeki/ }))
    await user.click(trigger)
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'true'))
  })
})
