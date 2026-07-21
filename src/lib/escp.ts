import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { formatNumberID } from '@/lib/utils'
import type { InvoiceData } from '@/lib/invoice-data'

// ESC/P control codes for the 9-pin Epson LX-310.
const ESC = '\x1B'
const INIT = ESC + '@' // reset printer to power-on defaults
const PAGE_LENGTH_33 = ESC + 'C' + '\x21' // ESC C n -> page length = 33 lines (5.5" @ 6 LPI)
const BOLD_ON = ESC + 'E'
const BOLD_OFF = ESC + 'F'
const FF = '\x0C' // form feed -> advance to next form's top edge
const LF = '\n'

// Keep everything inside 79 columns so nothing lands in the tractor-hole strip.
const WIDTH = 79
// Matches DocumentPDF's ITEMS_PER_PAGE so Epson and PDF page breaks align.
const ITEMS_PER_PAGE = 12

// Column character widths; fields are joined with single spaces (5 separators).
// 3 + 4 + 34 + 12 + 12 + 8 + 5 = 78 <= 79.
const COL = { no: 3, qty: 4, nama: 34, harga: 12, jumlah: 12, check: 8 } as const

function padEnd(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length)
}
function padStart(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : ' '.repeat(n - s.length) + s
}

// One fixed-width table row (used for both the header row and item rows).
function row(no: string, qty: string, nama: string, harga: string, jumlah: string, check: string): string {
  return [
    padEnd(no, COL.no),
    padStart(qty, COL.qty),
    padEnd(nama, COL.nama),
    padStart(harga, COL.harga),
    padStart(jumlah, COL.jumlah),
    padEnd(check, COL.check),
  ].join(' ')
}

// Split a name into chunks that each fit the NAMA column.
function wrapName(name: string): string[] {
  const chunks: string[] = []
  for (let i = 0; i < name.length; i += COL.nama) chunks.push(name.slice(i, i + COL.nama))
  return chunks.length ? chunks : ['']
}

function itemLines(item: InvoiceData['items'][number], index: number): string {
  const chunks = wrapName(item.namaBarang.toUpperCase())
  const lines: string[] = [
    row(
      String(index + 1),
      String(item.qty),
      chunks[0],
      formatNumberID(item.hargaSatuan),
      formatNumberID(item.subtotal),
      '',
    ),
  ]
  for (let i = 1; i < chunks.length; i++) lines.push(row('', '', chunks[i], '', '', ''))
  return lines.join(LF)
}

function headerBlock(data: InvoiceData, tanggal: string, tanggalPengiriman: string): string {
  const shopName = 'AU ELECTRONIC  spare parts'
  const left = [
    shopName,
    'Genteng Electronic Center',
    'Jl. Genteng Besar 43 Lt. 1 No. 109-111 Surabaya',
    'No. HP/WA: 081 2351 7994',
  ]
  const right = [
    `Tgl. Pesanan: ${tanggal}`,
    `Tgl. Pengiriman: ${tanggalPengiriman}`,
    `Kepada Yth: ${data.namaPelanggan}`,
    data.alamatPelanggan ?? '',
  ]
  return left
    .map((l, i) => {
      const r = right[i]
      const gap = Math.max(1, WIDTH - l.length - r.length)
      const line = l + ' '.repeat(gap) + r
      // Bold only the shop-name portion of the first line (blur mitigation).
      return i === 0 ? BOLD_ON + shopName + BOLD_OFF + line.slice(shopName.length) : line
    })
    .join(LF)
}

function footerBlock(data: InvoiceData, isLastPage: boolean): string {
  const lines = [
    '',
    'Perhatian:',
    'Barang yang sudah dibeli, tidak bisa ditukar / dikembalikan,',
    'kecuali sesuai perjanjian.',
    '',
    'Penerima,',
    '',
    '_______________________',
  ]
  if (isLastPage) {
    const totalText = `TOTAL : ${formatNumberID(data.totalPesanan)}`
    lines.push('', BOLD_ON + padStart(totalText, WIDTH) + BOLD_OFF)
  }
  return lines.join(LF)
}

/**
 * Build a raw ESC/P command stream for the Epson LX-310. Pure function of its
 * input: no browser or printer dependency, so it is fully unit-testable. The
 * stream resets the printer, sets a 33-line page length, then emits one form per
 * chunk of 12 items (header + rows + per-page subtotal + footer), form-feeding
 * between forms and at the end so each receipt lands on a fresh form's top edge.
 */
export function buildEscP(data: InvoiceData): string {
  const tanggal = format(new Date(data.tanggal), 'd MMM yyyy', { locale: idLocale })
  const tanggalPengiriman = data.tanggalPengiriman
    ? format(new Date(data.tanggalPengiriman), 'd MMM yyyy', { locale: idLocale })
    : 'Belum ditentukan'

  const chunks: InvoiceData['items'][] = []
  for (let i = 0; i < data.items.length; i += ITEMS_PER_PAGE) {
    chunks.push(data.items.slice(i, i + ITEMS_PER_PAGE))
  }
  if (chunks.length === 0) chunks.push([])

  let out = INIT + PAGE_LENGTH_33

  chunks.forEach((pageItems, pageIndex) => {
    const isLast = pageIndex === chunks.length - 1
    const startIndex = pageIndex * ITEMS_PER_PAGE

    const parts = [
      headerBlock(data, tanggal, tanggalPengiriman),
      '='.repeat(WIDTH),
      row('NO', 'QTY', 'NAMA BARANG', 'HARGA(Rp)', 'JUMLAH(Rp)', 'CHECK'),
      '-'.repeat(WIDTH),
      ...pageItems.map((item, i) => itemLines(item, startIndex + i)),
      footerBlock(data, isLast),
    ]
    out += parts.join(LF) + FF
  })

  return out
}
