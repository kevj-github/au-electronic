// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ItemsSection } from './ItemsSection'

/**
 * `ItemsSection.crud.test.tsx`/`.price.test.tsx`/`.render.test.tsx` all render
 * with `isOwner` and `isLocked={false}`. Nothing exercised the helper
 * (`isOwner={false}`) or locked (`isLocked={true}`) views, which change
 * `totalCols`/the tfoot colSpan and hide the add-item forms entirely.
 */

vi.mock('@/app/(app)/pesanan/item-mutation-actions', () => ({
  addItemToPesanan: vi.fn(async () => ({})),
  updateItemDetails: vi.fn(async () => ({})),
  deleteItemFromPesanan: vi.fn(async () => ({})),
  updateItemHarga: vi.fn(async () => ({})),
  toggleItemDicekOwner: vi.fn(async () => ({})),
  setItemJumlahDiambil: vi.fn(async () => ({})),
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

function item(overrides: Partial<{ id: string; harga_satuan: number; qty: number }> = {}) {
  return {
    id: 'item-1',
    nama_barang: 'Kabel',
    qty: 2,
    jumlah_diambil: 0,
    dicek_oleh_owner: false,
    harga_satuan: 1000,
    subtotal: 2000,
    ...overrides,
  }
}

describe('helper (non-owner) view', () => {
  it('hides the price editor and order total from a helper', () => {
    render(<ItemsSection pesananId="p1" items={[item()]} isOwner={false} isLocked={false} priceEditable={false} />)

    expect(screen.queryByLabelText(/Harga satuan/)).not.toBeInTheDocument()
    expect(screen.queryByText('Total')).not.toBeInTheDocument()
  })
})

describe('locked pesanan view', () => {
  it('hides the add-item forms but still shows the owner total', () => {
    render(<ItemsSection pesananId="p1" items={[item()]} isOwner isLocked={true} priceEditable={false} />)

    expect(screen.queryAllByRole('button', { name: /tambah barang/i })).toHaveLength(0)
    expect(screen.getAllByText('Total').length).toBeGreaterThan(0)
  })
})
