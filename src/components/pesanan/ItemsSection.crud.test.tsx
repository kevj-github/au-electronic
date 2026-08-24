import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ItemsSection } from './ItemsSection'

/**
 * Edit/delete/add-item wiring wasn't covered by ItemsSection.render.test.tsx
 * (re-render cost) or ItemsSection.price.test.tsx (price field only) before
 * the row/add-form components were extracted out of ItemsSection.tsx. Both
 * mobile and desktop layouts are always mounted (only CSS-hidden), so every
 * query below takes the first (mobile) match, mirroring the existing
 * `priceField()` convention in ItemsSection.price.test.tsx.
 */

const updateItemDetails = vi.fn(async () => ({}) as { error?: string })
const deleteItemFromPesanan = vi.fn(async () => ({}) as { error?: string })
const addItemToPesanan = vi.fn(async () => ({}) as { error?: string })

vi.mock('@/app/(app)/pesanan/actions', () => ({
  addItemToPesanan: (...a: unknown[]) => addItemToPesanan(...(a as [])),
  updateItemDetails: (...a: unknown[]) => updateItemDetails(...(a as [])),
  deleteItemFromPesanan: (...a: unknown[]) => deleteItemFromPesanan(...(a as [])),
  updateItemHarga: vi.fn(async () => ({})),
  toggleItemDicekOwner: vi.fn(async () => ({})),
  setItemJumlahDiambil: vi.fn(async () => ({})),
}))

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

function item(overrides: Partial<{ id: string; nama_barang: string; qty: number }> = {}) {
  return {
    id: 'item-1',
    nama_barang: 'Kabel',
    qty: 2,
    jumlah_diambil: 0,
    dicek_oleh_owner: false,
    harga_satuan: 0,
    subtotal: 0,
    ...overrides,
  }
}

beforeEach(() => {
  updateItemDetails.mockReset().mockResolvedValue({})
  deleteItemFromPesanan.mockReset().mockResolvedValue({})
  addItemToPesanan.mockReset().mockResolvedValue({})
  refresh.mockReset()
})

describe('ItemsSection edit/delete/add flows', () => {
  it('edits an item name and qty', async () => {
    const user = userEvent.setup()
    render(<ItemsSection pesananId="p1" items={[item()]} isOwner isLocked={false} priceEditable />)

    await user.click(screen.getAllByRole('button', { name: 'Edit item' })[0])

    const qtyInput = screen.getAllByLabelText('Qty')[0]
    await user.clear(qtyInput)
    await user.type(qtyInput, '5')

    const namaInput = screen.getAllByPlaceholderText('Nama barang')[0]
    await user.clear(namaInput)
    await user.type(namaInput, 'Kabel Baru')

    await user.click(screen.getAllByRole('button', { name: /simpan/i })[0])

    expect(updateItemDetails).toHaveBeenCalledWith('item-1', { nama_barang: 'Kabel Baru', qty: 5 })
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('cancels an edit without saving', async () => {
    const user = userEvent.setup()
    render(<ItemsSection pesananId="p1" items={[item()]} isOwner isLocked={false} priceEditable />)

    await user.click(screen.getAllByRole('button', { name: 'Edit item' })[0])
    await user.click(screen.getAllByRole('button', { name: /^batal$/i })[0])

    expect(updateItemDetails).not.toHaveBeenCalled()
    expect(screen.getAllByText(/Kabel/).length).toBeGreaterThan(0)
  })

  it('deletes an item after confirming', async () => {
    const user = userEvent.setup()
    render(<ItemsSection pesananId="p1" items={[item()]} isOwner isLocked={false} priceEditable />)

    await user.click(screen.getAllByRole('button', { name: 'Hapus item' })[0])
    await user.click(screen.getByRole('button', { name: 'Hapus' }))

    expect(deleteItemFromPesanan).toHaveBeenCalledWith('item-1')
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('does not delete when the delete is cancelled', async () => {
    const user = userEvent.setup()
    render(<ItemsSection pesananId="p1" items={[item()]} isOwner isLocked={false} priceEditable />)

    await user.click(screen.getAllByRole('button', { name: 'Hapus item' })[0])
    await user.click(screen.getAllByRole('button', { name: 'Batal hapus' })[0])

    expect(deleteItemFromPesanan).not.toHaveBeenCalled()
    expect(screen.getAllByRole('button', { name: 'Hapus item' }).length).toBeGreaterThan(0)
  })

  it('adds a new item', async () => {
    const user = userEvent.setup()
    render(<ItemsSection pesananId="p1" items={[]} isOwner isLocked={false} priceEditable />)

    await user.click(screen.getAllByRole('button', { name: /tambah barang/i })[0])

    const qtyInput = screen.getAllByLabelText('Qty')[0]
    await user.type(qtyInput, '3')

    const namaInput = screen.getAllByPlaceholderText(/^nama barang$/i)[0]
    await user.type(namaInput, 'Saklar')

    await user.click(screen.getAllByRole('button', { name: /^tambah$/i })[0])

    expect(addItemToPesanan).toHaveBeenCalledWith('p1', { nama_barang: 'Saklar', qty: 3 })
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('surfaces an error and keeps the row in place when delete fails', async () => {
    const user = userEvent.setup()
    deleteItemFromPesanan.mockResolvedValue({ error: 'Pesanan tidak dapat diubah.' })
    render(<ItemsSection pesananId="p1" items={[item()]} isOwner isLocked={false} priceEditable />)

    await user.click(screen.getAllByRole('button', { name: 'Hapus item' })[0])
    await user.click(screen.getByRole('button', { name: 'Hapus' }))

    expect(await screen.findByText('Pesanan tidak dapat diubah.')).toBeInTheDocument()
    expect(refresh).not.toHaveBeenCalled()
  })
})
