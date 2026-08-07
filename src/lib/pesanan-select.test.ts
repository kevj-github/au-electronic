import { describe, it, expect } from 'vitest'
import {
  DETAIL_ITEM_COLUMNS,
  ITEMS_SOURCE,
  PEMBAYARAN_SOURCE,
  PRICED_COLUMNS,
  itemsEmbed,
  pembayaranEmbed,
} from './pesanan-select'

describe('pesanan-select — security invariants', () => {
  it('never lets a helper select a priced column', () => {
    // RLS restricts rows, not columns. The guarantee that a price never reaches
    // a helper's RSC payload is simply that we do not ask for it — so this is
    // the assertion that actually enforces it.
    //
    // Compare whole column names, not substrings: `jumlah_diambil` is a
    // quantity (how many of an item the helper has picked) and legitimately
    // contains "jumlah", so a substring check would flag a safe column.
    const helperColumns = DETAIL_ITEM_COLUMNS.helper.split(',').map((c) => c.trim())
    for (const column of PRICED_COLUMNS) {
      expect(helperColumns).not.toContain(column)
    }
    // Guard the guard: the split must actually be producing column names.
    expect(helperColumns).toContain('nama_barang')
    expect(helperColumns).toContain('jumlah_diambil')
  })

  it('routes helper item reads at the base table, never the owner view', () => {
    expect(itemsEmbed(false, 'qty')).toContain(ITEMS_SOURCE.helper)
    expect(itemsEmbed(false, 'qty')).not.toContain(ITEMS_SOURCE.owner)
  })

  it('routes owner item reads through the owner-gated view', () => {
    // The phase 3 revoke removed column SELECT on the priced columns from
    // `authenticated`, and the owner is also just `authenticated` — so reading
    // them from the base table would now fail outright.
    expect(itemsEmbed(true, 'harga_satuan')).toContain(ITEMS_SOURCE.owner)
  })

  it('always reads payments through the owner view', () => {
    // There is no helper variant by construction: payments are owner-only.
    expect(pembayaranEmbed('jumlah')).toBe('pembayaran:pembayaran_owner(jumlah)')
    expect(PEMBAYARAN_SOURCE).toBe('pembayaran_owner')
  })

  it('aliases both embeds to a stable property name', () => {
    // Consumers destructure `items` / `pembayaran` regardless of the source.
    expect(itemsEmbed(true, 'qty').startsWith('items:')).toBe(true)
    expect(itemsEmbed(false, 'qty').startsWith('items:')).toBe(true)
    expect(pembayaranEmbed('jumlah').startsWith('pembayaran:')).toBe(true)
  })

  it('gives the owner the priced columns the detail page needs', () => {
    expect(DETAIL_ITEM_COLUMNS.owner).toContain('harga_satuan')
    expect(DETAIL_ITEM_COLUMNS.owner).toContain('subtotal')
  })
})

/**
 * Locks the four composed selects to their exact pre-refactor text. These moved
 * from inline literals into builders; if a builder change ever alters one of
 * these strings the query shape has changed, and that must be a deliberate edit
 * to this file rather than a silent side effect.
 */
describe('pesanan-select — composed selects are unchanged by the refactor', () => {
  it('order detail, owner', () => {
    expect(
      `*, pelanggan(*), ${itemsEmbed(true, DETAIL_ITEM_COLUMNS.owner)}, ${pembayaranEmbed('*')}`,
    ).toBe(
      '*, pelanggan(*), items:item_pesanan_owner(id, nama_barang, qty, harga_satuan, subtotal, diambil_oleh_helper, dicek_oleh_owner, jumlah_diambil), pembayaran:pembayaran_owner(*)',
    )
  })

  it('order detail, helper', () => {
    expect(
      `*, pelanggan(nama, alamat), ${itemsEmbed(false, DETAIL_ITEM_COLUMNS.helper)}`,
    ).toBe(
      '*, pelanggan(nama, alamat), items:item_pesanan(id, nama_barang, qty, diambil_oleh_helper, jumlah_diambil)',
    )
  })

  it('order list, owner', () => {
    expect(
      `*, pelanggan(nama, alamat), ${itemsEmbed(true, 'subtotal, diambil_oleh_helper')}, ${pembayaranEmbed('jumlah')}`,
    ).toBe(
      '*, pelanggan(nama, alamat), items:item_pesanan_owner(subtotal, diambil_oleh_helper), pembayaran:pembayaran_owner(jumlah)',
    )
  })

  it('order list, helper', () => {
    expect(
      `id, kode_pesanan, nama_pelanggan, status, created_at, pelanggan(nama, alamat), ${itemsEmbed(false, 'diambil_oleh_helper')}`,
    ).toBe(
      'id, kode_pesanan, nama_pelanggan, status, created_at, pelanggan(nama, alamat), items:item_pesanan(diambil_oleh_helper)',
    )
  })

  it('dashboard', () => {
    expect(
      `id, kode_pesanan, status, created_at, nama_pelanggan, catatan, pelanggan(nama), ${itemsEmbed(true, 'subtotal, diambil_oleh_helper')}, ${pembayaranEmbed('jumlah')}`,
    ).toBe(
      'id, kode_pesanan, status, created_at, nama_pelanggan, catatan, pelanggan(nama), items:item_pesanan_owner(subtotal, diambil_oleh_helper), pembayaran:pembayaran_owner(jumlah)',
    )
  })

  it('getInvoiceData', () => {
    expect(
      `kode_pesanan, created_at, tanggal_pengiriman, pengiriman, colly, nama_pelanggan, catatan, pelanggan(nama, alamat), ${itemsEmbed(true, 'nama_barang, qty, harga_satuan, subtotal')}, ${pembayaranEmbed('jumlah')}`,
    ).toBe(
      'kode_pesanan, created_at, tanggal_pengiriman, pengiriman, colly, nama_pelanggan, catatan, pelanggan(nama, alamat), items:item_pesanan_owner(nama_barang, qty, harga_satuan, subtotal), pembayaran:pembayaran_owner(jumlah)',
    )
  })
})
