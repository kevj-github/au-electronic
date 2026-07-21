import { describe, it, expect } from 'vitest'
import { buildEscP } from './escp'
import type { InvoiceData } from '@/lib/invoice-data'

const base: InvoiceData = {
  kodePesanan: 'AU.2026.07.00042',
  tanggal: '2026-07-16',
  tanggalPengiriman: '2026-07-20',
  namaPelanggan: 'Budi',
  alamatPelanggan: 'Jl. Mawar 10',
  items: [
    { namaBarang: 'Relay PTC 3 Pin', qty: 10, hargaSatuan: 8500, subtotal: 85000 },
    { namaBarang: 'Kit Tunersys 504', qty: 4, hargaSatuan: 620000, subtotal: 1240000 },
  ],
  totalPesanan: 1325000,
  totalDibayar: 0,
  sisaTagihan: 1325000,
  catatan: null,
}

// 13 items force a second page (ITEMS_PER_PAGE = 12).
const manyItems: InvoiceData = {
  ...base,
  items: Array.from({ length: 13 }, (_, i) => ({
    namaBarang: `Barang ${i + 1}`,
    qty: 1,
    hargaSatuan: 1000,
    subtotal: 1000,
  })),
  totalPesanan: 13000,
  sisaTagihan: 13000,
}

describe('buildEscP', () => {
  it('starts with the printer reset and page-length commands', () => {
    const out = buildEscP(base)
    expect(out.startsWith('\x1B@')).toBe(true)   // ESC @ reset
    expect(out).toContain('\x1B\x43\x21')          // ESC C 33 (page length)
  })

  it('includes the shop name and both dates in the header', () => {
    const out = buildEscP(base)
    expect(out).toContain('AU ELECTRONIC')
    expect(out).toContain('Tgl. Pesanan: 16 Jul 2026')
    expect(out).toContain('Tgl. Pengiriman: 20 Jul 2026')
    expect(out).toContain('Kepada Yth: Budi')
  })

  it('formats numbers with Indonesian dot grouping', () => {
    const out = buildEscP(base)
    expect(out).toContain('1.240.000')
    expect(out).toContain('TOTAL')
    expect(out).toContain('1.325.000')
  })

  it('keeps every printed line within 79 columns', () => {
    // Strip ESC/P control codes, then check visible line widths.
    const visible = buildEscP(base)
      .replace(/\x1B[@EFP]/g, '')
      .replace(/\x1B\x43\x21/g, '')
    for (const line of visible.split('\n')) {
      const clean = line.replace(/\x0C/g, '')
      expect(clean.length).toBeLessThanOrEqual(79)
    }
  })

  it('shows "Belum ditentukan" when there is no delivery date', () => {
    const out = buildEscP({ ...base, tanggalPengiriman: undefined })
    expect(out).toContain('Tgl. Pengiriman: Belum ditentukan')
  })

  it('paginates at 12 items with a form-feed per page and TOTAL only on the last', () => {
    const out = buildEscP(manyItems)
    const formFeeds = (out.match(/\x0C/g) ?? []).length
    expect(formFeeds).toBe(2)                         // two pages -> two FFs
    expect((out.match(/TOTAL/g) ?? []).length).toBe(1) // TOTAL once, last page
  })

  it('ends with a form-feed so the next receipt aligns to the next form', () => {
    expect(buildEscP(base).endsWith('\x0C')).toBe(true)
  })

  it('wraps item names longer than the name column onto a continuation line', () => {
    const longName = 'RELAY PTC 3 PIN PANJANG SEKALI UNTUK MENGUJI PEMBUNGKUSAN'
    const out = buildEscP({
      ...base,
      items: [{ namaBarang: longName, qty: 1, hargaSatuan: 1000, subtotal: 1000 }],
    })
    // Remainder past 34 chars appears on its own line.
    expect(out).toContain(longName.slice(34))
  })
})
