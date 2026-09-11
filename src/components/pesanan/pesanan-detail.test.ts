import { describe, it, expect } from 'vitest'
import { derivePesananDetailView, type OwnerItem, type PesananDetailRow } from './pesanan-detail'

/**
 * `derivePesananDetailView` used to be inline logic in the /pesanan/[id]
 * Server Component page, with no unit coverage of its own — see the
 * order-lifecycle/item-mutation split's CLAUDE.md notes for the same shape of
 * gap. Split out alongside the page.tsx section split so it can be tested
 * without a Supabase client or mounting the page.
 */

function ownerItem(overrides: Partial<OwnerItem> = {}): OwnerItem {
  return {
    id: 'item-1',
    pesanan_id: 'p1',
    nama_barang: 'Kabel',
    qty: 2,
    catatan_item: null,
    jumlah_diambil: 0,
    diambil_oleh_helper: false,
    dicek_oleh_owner: false,
    harga_satuan: 10000,
    subtotal: 20000,
    ...overrides,
  }
}

function row(overrides: Partial<PesananDetailRow> = {}): PesananDetailRow {
  return {
    id: 'p1',
    kode_pesanan: 'AU.2026.08.00001',
    pelanggan_id: null,
    nama_pelanggan: 'Budi',
    status: 'diproses',
    catatan: null,
    tanggal_pengiriman: null,
    pengiriman: null,
    colly: null,
    dibuat_oleh: 'user-1',
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    pelanggan: null,
    items: [ownerItem()],
    pembayaran: [],
    ...overrides,
  }
}

describe('derivePesananDetailView — status locking', () => {
  it('statusLocked is false while diproses, true once selesai/dibatalkan', () => {
    expect(derivePesananDetailView(row({ status: 'diproses' }), true, false).statusLocked).toBe(false)
    expect(derivePesananDetailView(row({ status: 'selesai' }), true, false).statusLocked).toBe(true)
    expect(derivePesananDetailView(row({ status: 'dibatalkan' }), true, false).statusLocked).toBe(true)
  })

  it('isLocked ignores the settings lock for owners', () => {
    const view = derivePesananDetailView(row({ status: 'diproses' }), true, true)
    expect(view.isLocked).toBe(false)
  })

  it('isLocked applies the settings lock for helpers on an open order', () => {
    const unlocked = derivePesananDetailView(row({ status: 'diproses' }), false, false)
    const locked = derivePesananDetailView(row({ status: 'diproses' }), false, true)
    expect(unlocked.isLocked).toBe(false)
    expect(locked.isLocked).toBe(true)
  })

  it('a closed order locks helpers regardless of the settings lock', () => {
    const view = derivePesananDetailView(row({ status: 'selesai' }), false, false)
    expect(view.isLocked).toBe(true)
  })

  it('nextStatuses reflects the status-transition table', () => {
    expect(derivePesananDetailView(row({ status: 'diproses' }), true, false).nextStatuses).toEqual([
      'selesai',
      'dibatalkan',
    ])
    expect(derivePesananDetailView(row({ status: 'selesai' }), true, false).nextStatuses).toEqual(['diproses'])
    expect(derivePesananDetailView(row({ status: 'dibatalkan' }), true, false).nextStatuses).toEqual([])
  })
})

describe('derivePesananDetailView — item ordering', () => {
  it('sorts items alphabetically by nama_barang, case/diacritic-insensitive', () => {
    const view = derivePesananDetailView(
      row({
        items: [
          ownerItem({ id: 'a', nama_barang: 'Zebra' }),
          ownerItem({ id: 'b', nama_barang: 'apel' }),
          ownerItem({ id: 'c', nama_barang: 'Mangga' }),
        ],
      }),
      true,
      false
    )

    expect(view.items.map((i) => i.id)).toEqual(['b', 'c', 'a'])
  })

  it('breaks ties on identical names by id, so order stays stable', () => {
    const view = derivePesananDetailView(
      row({
        items: [
          ownerItem({ id: 'z', nama_barang: 'Kabel' }),
          ownerItem({ id: 'a', nama_barang: 'Kabel' }),
        ],
      }),
      true,
      false
    )

    expect(view.items.map((i) => i.id)).toEqual(['a', 'z'])
  })
})

describe('derivePesananDetailView — money', () => {
  it('sums owner item subtotals into totalPesanan and payments into totalDibayar', () => {
    const view = derivePesananDetailView(
      row({
        items: [ownerItem({ id: 'a', subtotal: 20000 }), ownerItem({ id: 'b', subtotal: 15000 })],
        pembayaran: [
          { id: 'pay-1', pesanan_id: 'p1', jumlah: 10000, metode: 'tunai', catatan: null, dibayar_pada: '2026-08-02', dicatat_oleh: 'u1' },
        ],
      }),
      true,
      false
    )

    expect(view.totalPesanan).toBe(35000)
    expect(view.totalDibayar).toBe(10000)
    expect(view.sisaTagihan).toBe(25000)
  })

  it('helpers never see totals derived from price data', () => {
    const view = derivePesananDetailView(row({ items: [ownerItem()] }), false, false)
    expect(view.totalPesanan).toBe(0)
    expect(view.ownerItems).toEqual([])
  })
})

describe('derivePesananDetailView — checklist counts', () => {
  it('counts diambil across all items and dicek across owner items only', () => {
    const view = derivePesananDetailView(
      row({
        items: [
          ownerItem({ id: 'a', diambil_oleh_helper: true, dicek_oleh_owner: true }),
          ownerItem({ id: 'b', diambil_oleh_helper: false, dicek_oleh_owner: false }),
        ],
      }),
      true,
      false
    )

    expect(view.diambilCount).toBe(1)
    expect(view.dicekCount).toBe(1)
    expect(view.totalItems).toBe(2)
  })
})

describe('derivePesananDetailView — invoiceData and sectionItems', () => {
  it('builds invoiceData for owners and withholds it for helpers', () => {
    const ownerView = derivePesananDetailView(row(), true, false)
    const helperView = derivePesananDetailView(row(), false, false)

    expect(ownerView.invoiceData).not.toBeNull()
    expect(helperView.invoiceData).toBeNull()
  })

  it("sectionItems carries price fields for owners, and omits them for helpers", () => {
    const ownerView = derivePesananDetailView(row({ items: [ownerItem({ harga_satuan: 5000, subtotal: 10000 })] }), true, false)
    const helperView = derivePesananDetailView(row({ items: [ownerItem({ harga_satuan: 5000, subtotal: 10000 })] }), false, false)

    expect(ownerView.sectionItems[0]).toMatchObject({ harga_satuan: 5000, subtotal: 10000 })
    expect(helperView.sectionItems[0]).not.toHaveProperty('harga_satuan')
    expect(helperView.sectionItems[0]).not.toHaveProperty('subtotal')
  })
})
