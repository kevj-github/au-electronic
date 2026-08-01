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

  it('prints the columns as NO CHECK QTY NAMA HARGA JUMLAH', () => {
    const head = visible(buildEscP(base))
      .split('\n')
      .find((l) => l.includes('NAMA BARANG'))!
    expect(head.replace(/\s+/g, ' ').trim()).toBe(
      'NO CHECK QTY NAMA BARANG HARGA(Rp) JUMLAH(Rp)'
    )
    // CHECK is a hand-ticked box between NO and QTY, so the qty of the first
    // item must sit to the right of where the CHECK header starts.
    const firstItem = visible(buildEscP(base))
      .split('\n')
      .find((l) => l.includes('RELAY PTC'))!
    expect(firstItem.indexOf('10')).toBeGreaterThan(head.indexOf('CHECK'))
    expect(firstItem.indexOf('RELAY PTC')).toBe(head.indexOf('NAMA BARANG'))
  })

  it('right-aligns SUBTOTAL and TOTAL under the JUMLAH column', () => {
    const lines = visible(buildEscP(base)).split('\n')
    const head = lines.find((l) => l.includes('JUMLAH(Rp)'))!
    const jumlahEnd = head.indexOf('JUMLAH(Rp)') + 'JUMLAH(Rp)'.length
    for (const label of ['SUBTOTAL :', 'TOTAL :']) {
      expect(lines.find((l) => l.includes(label))!.trimEnd().length).toBe(jumlahEnd)
    }
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

    // --- Page number, centred on the Kepada line ---

    it('prints no page label on a single-page receipt', () => {
      expect(visible(buildEscP(base))).not.toContain('Hal.')
    })

    it('numbers each page on the Kepada line, centred', () => {
      const all = pages(buildEscP({ ...base, items: items(30, (i) => `Barang ${i + 1}`) }))
      expect(all.length).toBeGreaterThan(1)

      all.forEach((page, i) => {
        const line = page.find((l) => l.includes('Hal.'))!
        expect(line).toBeDefined()
        // Same line as the customer.
        expect(line).toContain('Kepada Yth:')
        expect(line).toContain(`Hal. ${i + 1}/${all.length}`)
        // Centred: the gap before the label matches the gap after it, within the
        // one column that an odd remainder can leave.
        const label = `Hal. ${i + 1}/${all.length}`
        const start = line.indexOf(label)
        const end = start + label.length
        expect(Math.abs(start - (79 - end))).toBeLessThanOrEqual(1)
      })
    })

    it('keeps the page label clear of a long customer name that has to wrap', () => {
      const out = buildEscP({
        ...base,
        namaPelanggan: 'Toko Sumber Rejeki Makmur Sentosa Abadi',
        alamatPelanggan: 'Jl. Raya Darmo Permai Selatan No. 88 Blok B2 Surabaya',
        items: items(30, (i) => `Barang ${i + 1}`),
      })
      for (const page of pages(out)) {
        const line = page.find((l) => l.includes('Hal.'))!
        // The label is intact — the customer text wrapped around it rather than
        // overwriting it — and nothing spills past the tractor margin.
        expect(line).toMatch(/Hal\. \d+\/\d+/)
        expect(line).toContain('Kepada Yth:')
        for (const l of page) expect(l.length).toBeLessThanOrEqual(79)
      }
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
    // The Kepada line wraps full-width; joining the wrapped lines reconstructs
    // the full name so nothing is truncated.
    const joined = visible(out).replace(/\n/g, '')
    expect(joined).toContain(`Kepada Yth: ${longName}`)
  })

  it('prints the customer address dash-joined after the name', () => {
    const alamat = 'Jl. Raya Darmo Permai Selatan No. 88 Blok C, Surabaya'
    const out = buildEscP({ ...base, namaPelanggan: 'Budi', alamatPelanggan: alamat })
    // The kepada sits on its own line(s) below the header and wraps full-width
    // when long; joining the wrapped lines reconstructs the full name+address so
    // nothing is truncated.
    const joined = visible(out).replace(/\n/g, '')
    expect(joined).toContain(`Kepada Yth: Budi - ${alamat}`)
  })

  it('puts "Kepada Yth" on its own line, aligned under Tgl. Pengiriman', () => {
    const out = buildEscP({ ...base, namaPelanggan: 'Budi', alamatPelanggan: undefined })
    const printed = visible(out).split('\n')
    const kepadaLine = printed.find((l) => l.includes('Kepada Yth:'))!
    const pengirimanLine = printed.find((l) => l.includes('Tgl. Pengiriman:'))!
    // Not riding the No. HP/WA row any more.
    const hpLine = printed.find((l) => l.includes('No. HP/WA'))!
    expect(hpLine).not.toContain('Kepada Yth:')
    // "Kepada Yth:" begins in the same column as "Tgl. Pengiriman:" above it.
    expect(kepadaLine.indexOf('Kepada Yth:')).toBe(pengirimanLine.indexOf('Tgl. Pengiriman:'))
  })

  it('right-aligns the Kepada line to the far margin when it overflows', () => {
    const alamat = 'Jl. Raya Darmo Permai Selatan Nomor 88 Blok C, Surabaya Jawa Timur'
    const out = buildEscP({ ...base, namaPelanggan: 'Budi', alamatPelanggan: alamat })
    const printed = visible(out).split('\n')
    // The Kepada block spills onto a continuation line whose leftmost characters
    // are the address tail (not "Kepada Yth:"). That line must be right-flush:
    // padded on the left so it ends at the far margin (length === WIDTH), never
    // dropped to the left margin.
    const kepadaStart = printed.findIndex((l) => l.includes('Kepada Yth:'))
    expect(kepadaStart).toBeGreaterThanOrEqual(0)
    const continuation = printed[kepadaStart + 1]
    expect(continuation).toMatch(/^ +\S/) // leading spaces then text
    expect(continuation.length).toBe(79)
    // Nothing truncated: the right-align padding is a run of spaces, so
    // collapsing whitespace runs stitches the wrapped lines back into the full
    // "Kepada Yth: name - address" (which has only single spaces).
    const joined = printed.join('\n').replace(/\s+/g, ' ')
    expect(joined).toContain(`Kepada Yth: Budi - ${alamat}`)
  })

  it('does not print an address line when there is no address', () => {
    const out = buildEscP({ ...base, alamatPelanggan: undefined })
    expect(out).toContain('Kepada Yth: Budi')
    expect(out).not.toContain(base.alamatPelanggan!)
  })

  // --- Pengiriman (courier) written on the Penerima signature line ---

  it('leaves the signature line blank when there is no pengiriman', () => {
    const out = buildEscP({ ...base, pengiriman: undefined })
    expect(out).toContain('_______________________')
  })

  it('writes the pengiriman name centred on the signature line', () => {
    const out = buildEscP({ ...base, pengiriman: 'Expedisi Jaya' })
    const sigLine = visible(out)
      .split('\n')
      .find((l) => l.includes('Expedisi Jaya') && l.includes('_'))!
    expect(sigLine).toBeDefined()
    // Underscores on both sides -> the name sits on the rule.
    expect(sigLine).toMatch(/^_+Exp\. Expedisi Jaya_+$/)
    // The rule keeps its width so the layout doesn't shift.
    expect(sigLine.length).toBe('_______________________'.length)
  })

  // --- Colly (package count) on the signature line ---

  it('prints "Exp. <pengiriman> ( N colly )" when both are set', () => {
    const out = buildEscP({ ...base, pengiriman: 'Expedisi Jaya', colly: 3 })
    expect(visible(out)).toContain('Exp. Expedisi Jaya ( 3 colly )')
  })

  it('prints only the colly when there is no pengiriman', () => {
    const out = buildEscP({ ...base, pengiriman: undefined, colly: 3 })
    const sigLine = visible(out)
      .split('\n')
      .find((l) => l.includes('colly'))!
    expect(sigLine).toMatch(/^_+\( 3 colly \)_+$/)
  })

  it('prints only the pengiriman when there is no colly', () => {
    const out = buildEscP({ ...base, pengiriman: 'Expedisi Jaya', colly: undefined })
    expect(visible(out)).toContain('Exp. Expedisi Jaya')
    expect(visible(out)).not.toContain('colly')
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
