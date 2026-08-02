import { describe, it, expect } from 'vitest'
import { buildInvoiceData, shipmentText, type InvoiceSource } from './invoice-data'

/**
 * `buildInvoiceData` is the single source of every customer-facing financial
 * document — the PDF invoice, the Epson/ESC-P receipt and the WhatsApp summary
 * all render whatever it returns. Its consumers were already well covered
 * (escp.test.ts, whatsapp.test.ts) but they hand-build `InvoiceData` fixtures,
 * so the derivation itself — sorting, the money totals and the name fallbacks —
 * had no tests at all. A regression here bills a customer the wrong amount.
 */

const base: InvoiceSource = {
  kode_pesanan: 'AU.2026.07.00042',
  created_at: '2026-07-16T02:00:00.000Z',
  tanggal_pengiriman: '2026-07-20',
  nama_pelanggan: null,
  pengiriman: null,
  colly: null,
  pelanggan: { nama: 'Budi', alamat: 'Jl. Mawar 10' },
  items: [
    { nama_barang: 'Relay PTC 3 Pin', qty: 10, harga_satuan: 8500, subtotal: 85000 },
    { nama_barang: 'Kit Tunersys 504', qty: 4, harga_satuan: 620000, subtotal: 1240000 },
  ],
  pembayaran: [],
  catatan: null,
}

const src = (overrides: Partial<InvoiceSource> = {}): InvoiceSource => ({
  ...base,
  ...overrides,
})

describe('buildInvoiceData — money', () => {
  it('sums item subtotals into totalPesanan', () => {
    expect(buildInvoiceData(base).totalPesanan).toBe(1325000)
  })

  it('sums every payment into totalDibayar and leaves the remainder owing', () => {
    const data = buildInvoiceData(
      src({ pembayaran: [{ jumlah: 300000 }, { jumlah: 200000 }] }),
    )
    expect(data.totalDibayar).toBe(500000)
    expect(data.sisaTagihan).toBe(825000)
  })

  it('reports a negative sisaTagihan when the customer overpays', () => {
    // Deliberate: the document should show the real difference rather than
    // clamping to zero, so an overpayment is visible instead of silently hidden.
    const data = buildInvoiceData(src({ pembayaran: [{ jumlah: 1400000 }] }))
    expect(data.sisaTagihan).toBe(-75000)
  })

  it('is fully paid when payments exactly match the order', () => {
    const data = buildInvoiceData(src({ pembayaran: [{ jumlah: 1325000 }] }))
    expect(data.sisaTagihan).toBe(0)
  })

  it('returns zero totals for an order with no items yet', () => {
    const data = buildInvoiceData(src({ items: [] }))
    expect(data).toMatchObject({ totalPesanan: 0, totalDibayar: 0, sisaTagihan: 0 })
    expect(data.items).toEqual([])
  })
})

describe('buildInvoiceData — item ordering', () => {
  it('sorts items alphabetically so every document agrees on order', () => {
    const data = buildInvoiceData(base)
    expect(data.items.map((i) => i.namaBarang)).toEqual([
      'Kit Tunersys 504',
      'Relay PTC 3 Pin',
    ])
  })

  it('sorts case-insensitively rather than putting lowercase last', () => {
    const data = buildInvoiceData(
      src({
        items: [
          { nama_barang: 'zener diode', qty: 1, harga_satuan: 1000, subtotal: 1000 },
          { nama_barang: 'Adaptor 12V', qty: 1, harga_satuan: 1000, subtotal: 1000 },
          { nama_barang: 'baterai CMOS', qty: 1, harga_satuan: 1000, subtotal: 1000 },
        ],
      }),
    )
    expect(data.items.map((i) => i.namaBarang)).toEqual([
      'Adaptor 12V',
      'baterai CMOS',
      'zener diode',
    ])
  })

  it('does not mutate the caller’s items array', () => {
    const items = [
      { nama_barang: 'Zener', qty: 1, harga_satuan: 1000, subtotal: 1000 },
      { nama_barang: 'Adaptor', qty: 1, harga_satuan: 1000, subtotal: 1000 },
    ]
    buildInvoiceData(src({ items }))
    expect(items.map((i) => i.nama_barang)).toEqual(['Zener', 'Adaptor'])
  })

  it('carries qty and harga_satuan through unchanged', () => {
    const [first] = buildInvoiceData(base).items
    expect(first).toEqual({
      namaBarang: 'Kit Tunersys 504',
      qty: 4,
      hargaSatuan: 620000,
      subtotal: 1240000,
    })
  })
})

describe('buildInvoiceData — customer name fallback', () => {
  it('prefers the linked pelanggan record', () => {
    const data = buildInvoiceData(
      src({ nama_pelanggan: 'Ketikan Manual', pelanggan: { nama: 'Budi', alamat: null } }),
    )
    expect(data.namaPelanggan).toBe('Budi')
  })

  it('falls back to the free-text name when no pelanggan is linked', () => {
    const data = buildInvoiceData(src({ pelanggan: null, nama_pelanggan: 'Ketikan Manual' }))
    expect(data.namaPelanggan).toBe('Ketikan Manual')
  })

  it('falls back to a dash when neither is present', () => {
    const data = buildInvoiceData(src({ pelanggan: null, nama_pelanggan: null }))
    expect(data.namaPelanggan).toBe('—')
  })

  it('maps absent optional fields to undefined, not null', () => {
    // The PDF and ESC/P renderers branch on `undefined`; a null would render.
    const data = buildInvoiceData(
      src({ pelanggan: null, tanggal_pengiriman: null, pengiriman: null, colly: null }),
    )
    expect(data.alamatPelanggan).toBeUndefined()
    expect(data.tanggalPengiriman).toBeUndefined()
    expect(data.pengiriman).toBeUndefined()
    expect(data.colly).toBeUndefined()
  })
})

describe('shipmentText', () => {
  it('combines courier and colly on the signature line', () => {
    expect(shipmentText({ pengiriman: 'Expedisi Jaya', colly: 3 })).toBe(
      'Exp. Expedisi Jaya ( 3 colly )',
    )
  })

  it('prints the courier alone when colly is unset', () => {
    expect(shipmentText({ pengiriman: 'Expedisi Jaya', colly: undefined })).toBe(
      'Exp. Expedisi Jaya',
    )
  })

  it('prints colly alone when there is no courier name', () => {
    expect(shipmentText({ pengiriman: undefined, colly: 2 })).toBe('( 2 colly )')
  })

  it('is empty for a pickup order so the line stays blank for a signature', () => {
    expect(shipmentText({ pengiriman: undefined, colly: undefined })).toBe('')
  })

  it('treats a whitespace-only courier as absent', () => {
    expect(shipmentText({ pengiriman: '   ', colly: undefined })).toBe('')
  })

  it('trims surrounding whitespace from the courier name', () => {
    expect(shipmentText({ pengiriman: '  Expedisi Jaya  ', colly: undefined })).toBe(
      'Exp. Expedisi Jaya',
    )
  })

  it('omits a zero colly, matching the DB check constraint', () => {
    // pesanan_colly_positive allows only NULL or > 0, so 0 should never print.
    expect(shipmentText({ pengiriman: 'Expedisi Jaya', colly: 0 })).toBe('Exp. Expedisi Jaya')
  })
})
