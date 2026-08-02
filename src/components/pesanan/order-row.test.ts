import { describe, it, expect } from 'vitest'
import { deriveOrderRow, type PesananWithRelations } from './OrderList'

/**
 * `deriveOrderRow` was extracted because the mobile card list and the desktop
 * table both computed it inline — including the three-state Tagihan rule, which
 * is subtle enough to have been a bug before. Testing it here means the rule is
 * verified once for both layouts.
 */

const order = (overrides: Partial<PesananWithRelations> = {}): PesananWithRelations =>
  ({
    id: 'p1',
    kode_pesanan: 'AU.2026.08.00001',
    status: 'diproses',
    created_at: '2026-08-01T00:00:00.000Z',
    nama_pelanggan: 'Budi',
    pelanggan: null,
    tanggal_pengiriman: null,
    items: [],
    pembayaran: [],
    ...overrides,
  }) as PesananWithRelations

const item = (subtotal: number | undefined, diambil = false) => ({
  subtotal,
  diambil_oleh_helper: diambil,
})

describe('deriveOrderRow — checklist counts', () => {
  it('counts picked items against the total', () => {
    const view = deriveOrderRow(
      order({ items: [item(1000, true), item(1000, false), item(1000, true)] }),
      true,
    )
    expect(view.diambilCount).toBe(2)
    expect(view.totalItems).toBe(3)
  })

  it('reports zero of zero for an empty order', () => {
    const view = deriveOrderRow(order(), true)
    expect(view.diambilCount).toBe(0)
    expect(view.totalItems).toBe(0)
  })
})

describe('deriveOrderRow — money is owner-only', () => {
  it('sums totals for an owner', () => {
    const view = deriveOrderRow(
      order({ items: [item(100000), item(250000)], pembayaran: [{ jumlah: 50000 }] }),
      true,
    )
    expect(view.totalPesanan).toBe(350000)
    expect(view.totalDibayar).toBe(50000)
    expect(view.sisaTagihan).toBe(300000)
  })

  it('zeroes every money field for a helper', () => {
    // Helpers never receive priced columns, so the derivation must not invent
    // numbers from whatever partial data is present.
    const view = deriveOrderRow(
      order({ items: [item(100000), item(250000)], pembayaran: [{ jumlah: 50000 }] }),
      false,
    )
    expect(view.totalPesanan).toBe(0)
    expect(view.totalDibayar).toBe(0)
    expect(view.sisaTagihan).toBe(0)
  })
})

describe('deriveOrderRow — the three-state Tagihan rule', () => {
  it('says "belum ada harga" when nothing is priced and nothing is paid', () => {
    // The bug this guards: sisaTagihan is 0 here, which would otherwise render
    // as "Lunas" and tell the owner the customer owes nothing.
    const view = deriveOrderRow(order({ items: [item(undefined), item(undefined)] }), true)
    expect(view.sisaTagihan).toBe(0)
    expect(view.tagihan).toEqual({ kind: 'belum-ada-harga' })
  })

  it('does NOT say "belum ada harga" once a payment exists, even at zero price', () => {
    // A recorded payment means the order is real, so fall through to the money
    // states rather than claiming it has no price yet.
    const view = deriveOrderRow(
      order({ items: [item(undefined)], pembayaran: [{ jumlah: 25000 }] }),
      true,
    )
    expect(view.tagihan).not.toEqual({ kind: 'belum-ada-harga' })
  })

  it('reports the outstanding amount when partly paid', () => {
    const view = deriveOrderRow(
      order({ items: [item(300000)], pembayaran: [{ jumlah: 100000 }] }),
      true,
    )
    expect(view.tagihan).toEqual({ kind: 'sisa', amount: 200000 })
  })

  it('is lunas when paid exactly', () => {
    const view = deriveOrderRow(
      order({ items: [item(300000)], pembayaran: [{ jumlah: 300000 }] }),
      true,
    )
    expect(view.tagihan).toEqual({ kind: 'lunas' })
  })

  it('is lunas when overpaid', () => {
    const view = deriveOrderRow(
      order({ items: [item(300000)], pembayaran: [{ jumlah: 400000 }] }),
      true,
    )
    expect(view.sisaTagihan).toBe(-100000)
    expect(view.tagihan).toEqual({ kind: 'lunas' })
  })

  it('treats a missing pembayaran array as no payments', () => {
    const view = deriveOrderRow(order({ items: [item(undefined)], pembayaran: undefined }), true)
    expect(view.tagihan).toEqual({ kind: 'belum-ada-harga' })
  })
})
