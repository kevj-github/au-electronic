import { describe, it, expect } from 'vitest'
import type { InvoiceData } from '@/lib/invoice-data'
import {
  WIDTH,
  toAscii,
  row,
  padStart,
  itemLines,
  pageLabelText,
  headerBlock,
  footerBlock,
  paginate,
} from './escp-layout'

const item = (over: Partial<InvoiceData['items'][number]> = {}): InvoiceData['items'][number] => ({
  namaBarang: 'Barang',
  qty: 1,
  hargaSatuan: 1000,
  subtotal: 1000,
  ...over,
})

const baseData: InvoiceData = {
  kodePesanan: 'AU.2026.07.00042',
  tanggal: '2026-07-16',
  tanggalPengiriman: '2026-07-20',
  namaPelanggan: 'Budi',
  alamatPelanggan: 'Jl. Mawar 10',
  items: [],
  totalPesanan: 0,
  totalDibayar: 0,
  sisaTagihan: 0,
  catatan: null,
}

describe('toAscii', () => {
  it('passes plain ASCII through unchanged', () => {
    expect(toAscii('Relay PTC 3 Pin')).toBe('Relay PTC 3 Pin')
  })

  it('folds em/en dashes and curly punctuation to ASCII equivalents', () => {
    expect(toAscii('Kabel “NYA” – 2.5mm — cadangan')).toBe('Kabel "NYA" - 2.5mm - cadangan')
  })

  it('folds an ellipsis to three dots and a non-breaking space to a plain space', () => {
    expect(toAscii('dst…')).toBe('dst...')
    expect(toAscii('a b')).toBe('a b')
  })

  it('replaces unrecognized non-ASCII characters with "?"', () => {
    expect(toAscii('日本語')).toBe('???')
  })
})

describe('padStart', () => {
  it('right-aligns a short string, padding with leading spaces', () => {
    expect(padStart('42', 5)).toBe('   42')
  })

  it('returns the string unchanged when it exactly fills the width', () => {
    expect(padStart('12345', 5)).toBe('12345')
  })

  it('clips an overflowing string to its rightmost characters and marks it with "#"', () => {
    // 14-digit number into a 13-wide column: keep the rightmost 12 digits, prefix '#'.
    expect(padStart('12345678901234', 13)).toBe('#345678901234'.slice(0, 13))
    expect(padStart('12345678901234', 13)).toHaveLength(13)
    expect(padStart('12345678901234', 13).startsWith('#')).toBe(true)
  })
})

describe('row', () => {
  it('lays out all six columns space-joined at their fixed widths', () => {
    const line = row('1', '', '10', 'Relay', '8.500', '85.000')
    // no(3) check(6) qty(5, right) nama(34, left) harga(13, right) jumlah(13, right), single-space joins
    expect(line).toBe(
      ['1  ', '      ', '   10', 'Relay' + ' '.repeat(29), '        8.500', '       85.000'].join(' '),
    )
    expect(line.length).toBe(WIDTH)
  })

  it('truncates a NAMA field wider than its column instead of overflowing it', () => {
    const longName = 'A'.repeat(50)
    const line = row('1', '', '1', longName, '1.000', '1.000')
    expect(line.length).toBe(WIDTH)
    expect(line).toContain('A'.repeat(34))
    expect(line).not.toContain('A'.repeat(35))
  })
})

describe('itemLines', () => {
  it('renders a single line for a name that fits the NAMA column', () => {
    const out = itemLines(item({ namaBarang: 'relay ptc', qty: 3, hargaSatuan: 8500, subtotal: 25500 }), 0)
    expect(out.split('\n')).toHaveLength(1)
    // Uppercased, 1-indexed.
    expect(out).toContain('RELAY PTC')
    expect(out.trimStart().startsWith('1')).toBe(true)
  })

  it('renders a single blank-name row when namaBarang is empty', () => {
    const out = itemLines(item({ namaBarang: '' }), 0)
    expect(out.split('\n')).toHaveLength(1)
  })

  it('wraps a long name onto continuation rows with blank NO/CHECK/QTY/amount columns', () => {
    const longName = 'KOMPRESOR KULKAS SERI PANJANG SEKALI UNTUK MENGUJI PEMBUNGKUSAN NAMA'
    const out = itemLines(item({ namaBarang: longName, qty: 2, hargaSatuan: 1000, subtotal: 2000 }), 4)
    const lines = out.split('\n')
    expect(lines.length).toBeGreaterThan(1)
    // First line carries the item number and quantity.
    expect(lines[0].trimStart().startsWith('5')).toBe(true)
    expect(lines[0]).toContain(longName.toUpperCase().slice(0, 34))
    // Continuation line(s) carry the name remainder but no number/qty/amounts.
    for (const cont of lines.slice(1)) {
      expect(cont.trimStart()).not.toMatch(/^\d/)
    }
    // Every wrapped chunk of the name is present somewhere in the output.
    const joined = lines.map((l) => l.trimEnd()).join('')
    for (let i = 0; i < longName.length; i += 34) {
      expect(joined).toContain(longName.toUpperCase().slice(i, i + 34))
    }
  })
})

describe('pageLabelText', () => {
  it('formats "Hal. i/total"', () => {
    expect(pageLabelText(1, 3)).toBe('Hal. 1/3')
  })

  it('pads the index to the width of the total so every label is the same length', () => {
    expect(pageLabelText(2, 10)).toBe('Hal.  2/10')
    expect(pageLabelText(2, 10).length).toBe(pageLabelText(10, 10).length)
  })
})

describe('headerBlock', () => {
  const bold = (s: string) => `<b>${s}</b>`

  it('bolds only the shop-name portion of the first line', () => {
    const out = headerBlock(baseData, '16 Jul 2026', '20 Jul 2026', bold)
    const first = out.split('\n')[0]
    expect(first.startsWith('<b>AU ELECTRONIC')).toBe(true)
    expect(first).toContain('</b>')
  })

  it('includes both dates on the right of the shop block', () => {
    const out = headerBlock(baseData, '16 Jul 2026', '20 Jul 2026', bold)
    expect(out).toContain('Tgl. Pesanan: 16 Jul 2026')
    expect(out).toContain('Tgl. Pengiriman: 20 Jul 2026')
  })

  it('writes "Kepada Yth: name - address" when there is an address', () => {
    const out = headerBlock(baseData, '16 Jul 2026', '20 Jul 2026', bold)
    expect(out.replace(/\n/g, '')).toContain('Kepada Yth: Budi - Jl. Mawar 10')
  })

  it('omits the " - address" suffix when there is no address', () => {
    const out = headerBlock({ ...baseData, alamatPelanggan: undefined }, '16 Jul 2026', '20 Jul 2026', bold)
    expect(out).toContain('Kepada Yth: Budi')
    expect(out).not.toContain(' - ')
  })

  it('reserves a slot for the page label on the Kepada line and does not clobber it', () => {
    const label = 'Hal. 1/2'
    const out = headerBlock(baseData, '16 Jul 2026', '20 Jul 2026', bold, label)
    const kepadaLine = out.split('\n').find((l) => l.includes('Kepada Yth:'))!
    expect(kepadaLine).toContain(label)
  })

  it('keeps a short customer line whole on the label row when it already fits the capacity', () => {
    const label = 'Hal. 1/2'
    const shortData = { ...baseData, namaPelanggan: 'Budi', alamatPelanggan: undefined }
    const out = headerBlock(shortData, '16 Jul 2026', '20 Jul 2026', bold, label)
    const kepadaLine = out.split('\n').find((l) => l.includes(label))!
    expect(kepadaLine).toContain('Kepada Yth: Budi')
  })

  it('breaks the first line at the last word boundary that fits before the label slot', () => {
    const label = 'Hal. 1/2'
    const longAddressData = {
      ...baseData,
      namaPelanggan: 'Yustinus Setiawan',
      alamatPelanggan: 'Jl. Panjang Sekali No 99',
    }
    const out = headerBlock(longAddressData, '16 Jul 2026', '20 Jul 2026', bold, label)
    const lines = out.split('\n')
    const kepadaLine = lines.find((l) => l.includes(label))!
    // Breaks after "Yustinus" (whole word), not mid-word.
    expect(kepadaLine.trimEnd().endsWith('Yustinus')).toBe(true)
    // The rest of the customer text still appears on the continuation lines.
    expect(lines.join('')).toContain('Setiawan - Jl. Panjang Sekali No 99')
  })

  it('falls back to a hard break at the capacity when no word boundary fits before it', () => {
    const label = 'Hal. 1/2'
    const noSpaceData = { ...baseData, namaPelanggan: 'A'.repeat(40), alamatPelanggan: undefined }
    const out = headerBlock(noSpaceData, '16 Jul 2026', '20 Jul 2026', bold, label)
    const lines = out.split('\n')
    const kepadaLine = lines.find((l) => l.includes(label))!
    // No space anywhere in "Kepada Yth: AAAA...", so the break lands mid-run of 'A's
    // rather than at a word boundary, and no 'A' is dropped across the wrap.
    expect(kepadaLine.trimEnd().endsWith('A')).toBe(true)
    const kepadaAndAfter = lines.slice(lines.indexOf(kepadaLine)).join('')
    expect((kepadaAndAfter.match(/A/g) ?? []).length).toBe(40)
  })
})

describe('footerBlock', () => {
  it('leaves "Penerima," bare on a non-last page', () => {
    const out = footerBlock({ ...baseData, totalPesanan: 50000 }, false)
    expect(out).toContain('Penerima,')
    expect(out).not.toContain('TOTAL')
  })

  it('appends the right-aligned TOTAL to the Penerima row on the last page', () => {
    const out = footerBlock({ ...baseData, totalPesanan: 1325000 }, true)
    const line = out.split('\n').find((l) => l.includes('Penerima,'))!
    expect(line).toContain('TOTAL : 1.325.000')
    expect(line.length).toBe(WIDTH) // AMOUNT_END equals WIDTH: JUMLAH is the last column
  })

  it('leaves the signature rule blank with no pengiriman/colly', () => {
    const out = footerBlock(baseData, true)
    expect(out).toContain('_______________________')
  })

  it('centres the shipment text on the signature rule when it fits within it', () => {
    const out = footerBlock({ ...baseData, pengiriman: 'Expedisi Jaya' }, true)
    expect(out).toContain('Exp. Expedisi Jaya')
    const sigLine = out.split('\n').find((l) => l.includes('Expedisi Jaya'))!
    expect(sigLine.startsWith('_')).toBe(true)
    expect(sigLine.endsWith('_')).toBe(true)
    expect(sigLine.length).toBe('_______________________'.length)
  })

  it('widens the rule instead of clipping when the shipment text is longer than it', () => {
    const longText = 'Exp. ' + 'X'.repeat(40)
    const out = footerBlock({ ...baseData, pengiriman: 'X'.repeat(40) }, true)
    expect(out).toContain(longText)
  })

  it('ends with a trailing blank line so the LX-310 does not double-strike the rule', () => {
    const out = footerBlock(baseData, true)
    expect(out.endsWith('\n')).toBe(true)
  })
})

describe('paginate', () => {
  it('keeps all items on one page when the budget comfortably fits them', () => {
    const items = [item(), item(), item()]
    const pages = paginate(items, 20, 20)
    expect(pages).toEqual([items])
  })

  it('starts a new page once the running line cost would exceed the budget', () => {
    const items = [item({ namaBarang: 'a' }), item({ namaBarang: 'b' }), item({ namaBarang: 'c' })]
    // Each item costs 1 line; a budget of 2 must break after every 2nd item.
    const pages = paginate(items, 2, 2)
    expect(pages.map((p) => p.length)).toEqual([2, 1])
  })

  it('measures the final item against the smaller lastBudget', () => {
    const items = [item({ namaBarang: 'a' }), item({ namaBarang: 'b' })]
    // bodyBudget fits both by line cost, but lastBudget is too small for the 2nd.
    const pages = paginate(items, 2, 1)
    expect(pages.map((p) => p.length)).toEqual([1, 1])
  })

  it('caps a page at 10 items even when the line budget has room for more', () => {
    const items = Array.from({ length: 11 }, () => item())
    const pages = paginate(items, 1000, 1000)
    expect(pages[0]).toHaveLength(10)
    expect(pages[1]).toHaveLength(1)
  })

  it('returns a single empty page for an empty item list', () => {
    expect(paginate([], 20, 20)).toEqual([[]])
  })

  it('never splits or drops items across pages', () => {
    const items = Array.from({ length: 25 }, (_, i) => item({ namaBarang: `Barang ${i}` }))
    const pages = paginate(items, 5, 4)
    expect(pages.flat()).toEqual(items)
  })
})
