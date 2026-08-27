import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ItemsSection } from './ItemsSection'

/**
 * The owner's inline price editor is the only place a price is entered, so a
 * defect here is money-visible.
 *
 * `prices` is local state keyed by item id, and `rawPrice` prefers it over the
 * server value whenever the key exists. The detail page mounts
 * `RealtimeRefresh` on the pesanan row, so `items` genuinely changes underneath
 * a mounted editor — which is why the local override has to be dropped when the
 * server value for that row moves, the same render-phase resync
 * `ItemChecklistCheckbox` and `HelperItemChecklist` already do.
 */

const updateItemHarga = vi.fn(async () => ({}) as { error?: string })

vi.mock('@/app/(app)/pesanan/actions', () => ({
  addItemToPesanan: vi.fn(async () => ({})),
  updateItemDetails: vi.fn(async () => ({})),
  deleteItemFromPesanan: vi.fn(async () => ({})),
  updateItemHarga: (...a: unknown[]) => updateItemHarga(...(a as [])),
  toggleItemDicekOwner: vi.fn(async () => ({})),
  setItemJumlahDiambil: vi.fn(async () => ({})),
}))

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

function item(overrides: Partial<{ id: string; harga_satuan: number; qty: number }> = {}) {
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

function priceField(nama = 'Kabel') {
  return screen.getAllByLabelText(`Harga satuan ${nama}`)[0] as HTMLInputElement
}

beforeEach(() => {
  updateItemHarga.mockReset().mockResolvedValue({})
  refresh.mockReset()
})

describe('price entry', () => {
  it('shows the saved price with thousands separators', () => {
    render(
      <ItemsSection
        pesananId="p1"
        items={[item({ harga_satuan: 1500000 })]}
        isOwner
        isLocked={false}
        priceEditable
      />
    )

    expect(priceField().value).toBe('1.500.000')
  })

  it('keeps only digits as the user types', async () => {
    const user = userEvent.setup()
    render(<ItemsSection pesananId="p1" items={[item()]} isOwner isLocked={false} priceEditable />)

    await user.type(priceField(), 'abc12x34')

    expect(priceField().value).toBe('1.234')
  })

  it('saves the parsed number on blur', async () => {
    const user = userEvent.setup()
    render(<ItemsSection pesananId="p1" items={[item()]} isOwner isLocked={false} priceEditable />)

    await user.type(priceField(), '25000')
    await user.tab()

    expect(updateItemHarga).toHaveBeenCalledWith('item-1', 25000)
  })

  it('does not save when the value is unchanged — no redundant round-trip', async () => {
    const user = userEvent.setup()
    render(
      <ItemsSection
        pesananId="p1"
        items={[item({ harga_satuan: 25000 })]}
        isOwner
        isLocked={false}
        priceEditable
      />
    )

    await user.click(priceField())
    await user.tab()

    expect(updateItemHarga).not.toHaveBeenCalled()
  })

  it('treats clearing the field as a price of zero', async () => {
    const user = userEvent.setup()
    render(
      <ItemsSection
        pesananId="p1"
        items={[item({ harga_satuan: 25000 })]}
        isOwner
        isLocked={false}
        priceEditable
      />
    )

    await user.clear(priceField())
    await user.tab()

    expect(updateItemHarga).toHaveBeenCalledWith('item-1', 0)
  })

  it('surfaces a save failure and keeps what the user typed', async () => {
    const user = userEvent.setup()
    updateItemHarga.mockResolvedValue({ error: 'Pesanan tidak dapat diubah.' })
    render(<ItemsSection pesananId="p1" items={[item()]} isOwner isLocked={false} priceEditable />)

    await user.type(priceField(), '25000')
    await user.tab()

    expect(await screen.findByText('Pesanan tidak dapat diubah.')).toBeInTheDocument()
    expect(priceField().value).toBe('25.000')
    expect(refresh).not.toHaveBeenCalled()
  })

  it('updates the order total live as a price is typed', async () => {
    const user = userEvent.setup()
    render(
      <ItemsSection
        pesananId="p1"
        items={[item({ qty: 3 })]}
        isOwner
        isLocked={false}
        priceEditable
      />
    )

    await user.type(priceField(), '1000')

    // qty 3 x 1000
    expect(screen.getAllByText('Rp 3.000').length).toBeGreaterThan(0)
  })
})

describe('concurrent saves on different rows', () => {
  it('keeps a slow row disabled while a second row saves and finishes first', async () => {
    const user = userEvent.setup()
    let resolveA: (value: { error?: string }) => void = () => {}
    updateItemHarga.mockImplementation((id: unknown) => {
      if (id === 'a') return new Promise((resolve) => { resolveA = resolve })
      return Promise.resolve({})
    })

    render(
      <ItemsSection
        pesananId="p1"
        items={[
          item({ id: 'a', harga_satuan: 1000 }),
          { ...item({ id: 'b', harga_satuan: 2000 }), nama_barang: 'Saklar' },
        ]}
        isOwner
        isLocked={false}
        priceEditable
      />
    )

    // Row a's save starts and hangs (server hasn't responded yet).
    await user.clear(priceField('Kabel'))
    await user.type(priceField('Kabel'), '1500')
    await user.tab()
    expect(priceField('Kabel')).toBeDisabled()

    // Row b's save starts and completes while row a is still in flight.
    await user.clear(priceField('Saklar'))
    await user.type(priceField('Saklar'), '2500')
    await user.tab()
    expect(priceField('Saklar')).not.toBeDisabled()

    // Row a's own request hasn't resolved yet, so it must still be disabled —
    // a single shared "which row is saving" id would have wrongly cleared this
    // the moment row b's save started, since starting b overwrote it.
    expect(priceField('Kabel')).toBeDisabled()

    resolveA({})
    await waitFor(() => expect(priceField('Kabel')).not.toBeDisabled())
  })
})

describe('resync when the server price changes underneath the editor', () => {
  const rerenderWith = (harga: number) => (
    <ItemsSection
      pesananId="p1"
      items={[item({ harga_satuan: harga })]}
      isOwner
      isLocked={false}
      priceEditable
    />
  )

  it('shows the new server price after a realtime refresh, not the stale local one', async () => {
    const user = userEvent.setup()
    const { rerender } = render(rerenderWith(5000))

    // Owner edits and saves 5000 here...
    await user.clear(priceField())
    await user.type(priceField(), '5000')
    await user.tab()

    // ...meanwhile another device saves 7000 and realtime pushes it down.
    rerender(rerenderWith(7000))

    expect(priceField().value).toBe('7.000')
  })

  it('does not write the stale value back when the field is blurred again', async () => {
    const user = userEvent.setup()
    const { rerender } = render(rerenderWith(5000))

    await user.clear(priceField())
    await user.type(priceField(), '5000')
    await user.tab()
    updateItemHarga.mockClear()

    rerender(rerenderWith(7000))

    // Blurring again must not silently revert the other device's save.
    await user.click(priceField())
    await user.tab()

    expect(updateItemHarga).not.toHaveBeenCalled()
  })

  it('reflects the new server price in the order total', async () => {
    const user = userEvent.setup()
    const { rerender } = render(rerenderWith(5000))

    await user.clear(priceField())
    await user.type(priceField(), '5000')
    await user.tab()

    rerender(rerenderWith(7000))

    // qty 2 x 7000
    expect(screen.getAllByText('Rp 14.000').length).toBeGreaterThan(0)
  })

  it('leaves an untouched row alone when a different row changes', async () => {
    const user = userEvent.setup()
    const two = (bHarga: number) => (
      <ItemsSection
        pesananId="p1"
        items={[
          item({ id: 'a', harga_satuan: 1000 }),
          { ...item({ id: 'b', harga_satuan: bHarga }), nama_barang: 'Saklar' },
        ]}
        isOwner
        isLocked={false}
        priceEditable
      />
    )
    const { rerender } = render(two(2000))

    // Mid-edit on row A, not yet blurred.
    await user.clear(priceField('Kabel'))
    await user.type(priceField('Kabel'), '9999')

    rerender(two(3000))

    // Row B picks up the server change; row A keeps the in-progress edit.
    expect(priceField('Saklar').value).toBe('3.000')
    expect(priceField('Kabel').value).toBe('9.999')
  })
})
