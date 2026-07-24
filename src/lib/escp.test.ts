import { describe, it, expect } from 'vitest'
import { buildEscP } from './escp'
import type { InvoiceData } from '@/lib/invoice-data'

// Must match LINES_PER_PAGE in escp.ts (the ESC C page length).
const LINES_PER_PAGE = 33

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

function items(count: number, namaBarang: (i: number) => string): InvoiceData['items'] {
  return Array.from({ length: count }, (_, i) => ({
    namaBarang: namaBarang(i),
    qty: 1,
    hargaSatuan: 1000,
    subtotal: 1000,
  }))
}

// A name long enough to need exactly one continuation line (> 34 chars).
const wrappingName = (i: number) => `KOMPRESOR KULKAS 1/4 PK MERK PANASONIC UNIT ${i + 1}`

/** Strip ESC/P control codes so only printable characters remain. */
function visible(out: string): string {
  return out.replace(/\x1B\x43[\s\S]/g, '').replace(/\x1B[@EF]/g, '')
}

/** Split the stream into pages (on form-feed), each as an array of lines. */
function pages(out: string): string[][] {
  return visible(out)
    .split('\x0C')
    .filter((page) => page.length > 0)
    .map((page) => page.split('\n'))
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
    for (const page of pages(buildEscP(base))) {
      for (const line of page) expect(line.length).toBeLessThanOrEqual(79)
    }
  })

  it('shows "Belum ditentukan" when there is no delivery date', () => {
    const out = buildEscP({ ...base, tanggalPengiriman: undefined })
    expect(out).toContain('Tgl. Pengiriman: Belum ditentukan')
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
    // Remainder past the name column appears on its own line.
    expect(out).toContain(longName.slice(34))
  })

  it('prints a per-page SUBTOTAL line', () => {
    const out = buildEscP(base)
    expect(out).toContain('SUBTOTAL :')
    expect(out).toContain('1.325.000') // single-page subtotal == order total here
  })

  it('clamps a long customer address to 79 columns', () => {
    const out = buildEscP({ ...base, alamatPelanggan: 'X'.repeat(120) })
    for (const page of pages(out)) {
      for (const line of page) expect(line.length).toBeLessThanOrEqual(79)
    }
  })

  // --- Page geometry (the contract that matters most) ---

  describe('page geometry', () => {
    const shapes: Array<[string, InvoiceData['items']]> = [
      ['12 short-named items', items(12, (i) => `Barang ${i + 1}`)],
      ['12 wrapping-named items', items(12, wrappingName)],
      ['13 short-named items', items(13, (i) => `Barang ${i + 1}`)],
      ['30 short-named items', items(30, (i) => `Barang ${i + 1}`)],
      [
        'a mix of short and wrapping names',
        items(20, (i) => (i % 3 === 0 ? wrappingName(i) : `Barang ${i + 1}`)),
      ],
      ['no items', []],
      [
        'one item whose name wraps three times',
        items(1, () => 'A'.repeat(34 * 3 + 5)),
      ],
    ]

    for (const [label, pageItems] of shapes) {
      it(`never exceeds ${LINES_PER_PAGE} lines per page: ${label}`, () => {
        const out = buildEscP({
          ...base,
          items: pageItems,
          totalPesanan: pageItems.reduce((s, i) => s + i.subtotal, 0),
        })
        for (const page of pages(out)) {
          expect(page.length).toBeLessThanOrEqual(LINES_PER_PAGE)
        }
      })
    }

    it('prints every item exactly once across all pages', () => {
      const pageItems = items(20, (i) => (i % 3 === 0 ? wrappingName(i) : `Barang ${i + 1}`))
      const out = buildEscP({ ...base, items: pageItems })
      for (let i = 0; i < pageItems.length; i++) {
        const numbered = new RegExp(`^${i + 1}\\s`, 'gm')
        expect((visible(out).match(numbered) ?? []).length).toBe(1)
      }
    })

    it('prints TOTAL only on the last page', () => {
      const out = buildEscP({ ...base, items: items(30, (i) => `Barang ${i + 1}`) })
      const all = pages(out)
      expect(all.length).toBeGreaterThan(1)
      expect((visible(out).match(/\bTOTAL\b/g) ?? []).length).toBe(1)
      expect(all[all.length - 1].join('\n')).toContain('TOTAL')
    })

    it('emits one form-feed per page', () => {
      const out = buildEscP({ ...base, items: items(30, (i) => `Barang ${i + 1}`) })
      expect((out.match(/\x0C/g) ?? []).length).toBe(pages(out).length)
    })
  })

  // --- Number columns must not lose digits ---

  it('prints large amounts without dropping digits', () => {
    const out = buildEscP({
      ...base,
      items: [{ namaBarang: 'Mesin Cuci', qty: 1, hargaSatuan: 1234567890, subtotal: 1234567890 }],
      totalPesanan: 1234567890,
      sisaTagihan: 1234567890,
    })
    expect(out).toContain('1.234.567.890')
    expect(out).not.toContain('1.234.567.89 ')
  })

  it('prints a large qty without dropping digits', () => {
    const out = buildEscP({
      ...base,
      items: [{ namaBarang: 'Baut', qty: 12345, hargaSatuan: 100, subtotal: 1234500 }],
      totalPesanan: 1234500,
    })
    expect(out).toMatch(/\b12345\b/)
  })

  it('marks a number too wide for its column instead of silently truncating', () => {
    const huge = 12345678901234 // 14 digits -> wider than the amount column
    const out = buildEscP({
      ...base,
      items: [{ namaBarang: 'Trafo', qty: 1, hargaSatuan: huge, subtotal: huge }],
      totalPesanan: huge,
    })
    // The clipped value keeps its rightmost digits and carries a visible marker.
    const itemRow = visible(out)
      .split('\n')
      .find((l) => l.includes('TRAFO'))!
    expect(itemRow).toContain('#')
    // Leading-character truncation (the silent-wrong-value bug) must not happen.
    expect(itemRow).not.toContain('12.345.678.90')
    expect(itemRow).toContain('678.901.234')
  })

  // --- Customer name / address parity with the PDF ---

  it('prints a long customer name in full', () => {
    const longName = 'Bapak Muhammad Abdurrahman Wijaya Kusuma'
    const out = buildEscP({ ...base, namaPelanggan: longName })
    expect(out).toContain(`Kepada Yth: ${longName}`)
  })

  it('prints the customer address in full on its own line', () => {
    const alamat = 'Jl. Raya Darmo Permai Selatan No. 88 Blok C, Surabaya'
    const out = buildEscP({ ...base, alamatPelanggan: alamat })
    expect(out).toContain(alamat)
  })

  it('does not print an address line when there is no address', () => {
    const out = buildEscP({ ...base, alamatPelanggan: undefined })
    expect(out).toContain('Kepada Yth: Budi')
    expect(out).not.toContain(base.alamatPelanggan!)
  })

  // --- ESC/P has no glyph for non-ASCII characters ---

  it('folds non-ASCII characters to ASCII the 9-pin printer can render', () => {
    const out = buildEscP({
      ...base,
      namaPelanggan: '—',
      items: [{ namaBarang: 'Kabel “NYA” – 2.5mm', qty: 1, hargaSatuan: 1000, subtotal: 1000 }],
    })
    expect(out).not.toMatch(/[^\x00-\x7F]/)
    expect(out).toContain('Kepada Yth: -')
    expect(out).toContain('KABEL "NYA" - 2.5MM')
  })
})
