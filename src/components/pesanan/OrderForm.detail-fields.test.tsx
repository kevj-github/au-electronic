// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrderForm } from './OrderForm'
import type { Pelanggan } from '@/lib/types'

/**
 * Covers three OrderForm branches that were only ever exercised indirectly
 * (or not at all): the free-text pelanggan autocomplete's suggestion list
 * (rendering + clicking a suggestion), the "Catatan" field, and the
 * owner-only "Tanggal Pengiriman" field. `usePelangganAutocomplete` itself is
 * unit-tested in `use-pelanggan-autocomplete.test.ts`; this pins the JSX
 * wiring in OrderForm that renders and clicks the suggestion `<li>`.
 */

vi.mock('@/app/(app)/pesanan/order-lifecycle-actions', () => ({
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
  {
    id: 'c2',
    nama: 'Toko Sumber Makmur',
    telepon: null,
    alamat: null,
    tipe: 'grosir',
    created_at: '2026-01-01T00:00:00.000Z',
  },
]

describe('OrderForm free-text pelanggan suggestions', () => {
  it('shows matching suggestions and selecting one fills the field and closes the dropdown', async () => {
    const user = userEvent.setup()
    render(<OrderForm pelangganList={pelangganList} isOwner />)

    const namaField = screen.getByPlaceholderText('Nama pelanggan baru...')
    await user.type(namaField, 'Sumber')

    expect(screen.getByText('Toko Sumber Rejeki')).toBeInTheDocument()
    expect(screen.getByText('Toko Sumber Makmur')).toBeInTheDocument()
    expect(screen.getByText('Jl. Merdeka 1')).toBeInTheDocument()

    await user.click(screen.getByText('Toko Sumber Makmur'))

    expect(namaField).toHaveValue('')
    expect(namaField).toBeDisabled()
    expect(screen.queryByText('Toko Sumber Rejeki')).not.toBeInTheDocument()
  })
})

describe('OrderForm catatan field', () => {
  it('updates the catatan value as the user types', async () => {
    const user = userEvent.setup()
    render(<OrderForm pelangganList={[]} isOwner />)

    const catatanField = screen.getByLabelText('Catatan (opsional)')
    await user.type(catatanField, 'Bungkus rapi ya')

    expect(catatanField).toHaveValue('Bungkus rapi ya')
  })
})

describe('OrderForm tanggal pengiriman field', () => {
  it('is shown for owners and updates as the user picks a date', async () => {
    const user = userEvent.setup()
    render(<OrderForm pelangganList={[]} isOwner />)

    const tanggalField = screen.getByLabelText('Tanggal Pengiriman (opsional)')
    await user.type(tanggalField, '2026-09-15')

    expect(tanggalField).toHaveValue('2026-09-15')
  })

  it('is hidden for non-owners (helpers)', () => {
    render(<OrderForm pelangganList={[]} isOwner={false} />)

    expect(screen.queryByLabelText('Tanggal Pengiriman (opsional)')).not.toBeInTheDocument()
  })
})
