import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { formatNumberID } from '@/lib/utils'
import type { InvoiceData } from '@/lib/invoice-data'

// ESC/P control codes for the 9-pin Epson LX-310.
const ESC = '\x1B'
const INIT = ESC + '@' // reset printer to power-on defaults
// Page length in lines, at 6 LPI -> 33 lines = 5.5". This is the form geometry
// every layout calculation below is measured against, so keep them in sync.
const LINES_PER_PAGE = 33
const PAGE_LENGTH = ESC + 'C' + String.fromCharCode(LINES_PER_PAGE) // ESC C n
const BOLD_ON = ESC + 'E'
const BOLD_OFF = ESC + 'F'
const FF = '\x0C' // form feed -> advance to next form's top edge
const LF = '\n'

// Keep everything inside 79 columns so nothing lands in the tractor-hole strip.
const WIDTH = 79

// Column character widths; fields are joined with single spaces (5 separators).
// 3 + 5 + 34 + 13 + 13 + 6 = 74, + 5 separators = 79 <= 79.
// QTY holds 5 digits and the amount columns 13 characters ("1.234.567.890"), so
// realistic values never reach the overflow marker in `padStart`.
const COL = { no: 3, qty: 5, nama: 34, harga: 13, jumlah: 13, check: 6 } as const

// Column at which the JUMLAH field ends; SUBTOTAL/TOTAL are right-aligned here
// so the amounts line up under the column they total.
const AMOUNT_END = COL.no + 1 + COL.qty + 1 + COL.nama + 1 + COL.harga + 1 + COL.jumlah

// Fixed line costs per page, used by the pagination budget below.
const TABLE_HEAD_LINES = 3 // '=' rule + column header row + '-' rule
const SUBTOTAL_LINES = 2 // blank + per-page SUBTOTAL row
const FOOTER_LINES = 13 // blank + Perhatian (3) + 3 blank + Penerima, + 4 blank + rule
const TOTAL_LINES = 2 // blank + TOTAL row, last page only

// The LX-310's built-in character set is ASCII; anything outside it prints as
// garbage. Fold the few non-ASCII characters that realistically reach us (the
// em dash `invoice-data` uses for "no customer", plus typographic punctuation
// pasted from other apps) and replace anything else with '?'. Deliberately not
// a general transliterator.
const ASCII_FOLD: Record<string, string> = {
  '—': '-', // em dash
  '–': '-', // en dash
  '‒': '-',
  '‑': '-',
  '‐': '-',
  '‘': "'", // curly quotes
  '’': "'",
  '“': '"',
  '”': '"',
  '…': '...', // ellipsis
  ' ': ' ', // non-breaking space
}

/** Fold a text field to printable ASCII. Applied before layout so the folded
 *  length (not the original) is what the column arithmetic sees. */
function toAscii(s: string): string {
  return s.replace(/[^\x20-\x7E]/g, (ch) => ASCII_FOLD[ch] ?? '?')
}

function padEnd(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length)
}

/** Right-align `s` in `n` columns. On overflow keep the *rightmost* characters
 *  and prefix a '#' so a clipped number reads as obviously wrong rather than as
 *  a plausible smaller number (leading-character truncation silently divides a
 *  price by an order of magnitude). */
function padStart(s: string, n: number): string {
  if (s.length <= n) return ' '.repeat(n - s.length) + s
  return '#' + s.slice(s.length - (n - 1))
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

/** How many printed lines an item occupies (1 + its name's continuation lines). */
function itemLineCost(item: InvoiceData['items'][number]): number {
  return wrapName(item.namaBarang.toUpperCase()).length
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

const KEPADA_LABEL = 'Kepada Yth: '

/**
 * Shop block on the left, order dates on the right, then the customer on its
 * own full-width lines below (mirrors DocumentPDF, which never truncates the
 * customer name or address).
 */
function headerBlock(data: InvoiceData, tanggal: string, tanggalPengiriman: string): string {
  const shopName = 'AU ELECTRONIC  spare parts'
  const left = [
    shopName,
    'Genteng Electronic Center',
    'Jl. Genteng Besar 43 Lt. 1 No. 109-111 Surabaya',
    'No. HP/WA: 081 2351 7994',
  ]
  const right = [`Tgl. Pesanan: ${tanggal}`, `Tgl. Pengiriman: ${tanggalPengiriman}`, '', '']
  const lines = left.map((l, i) => {
    const r = right[i]
    const gap = Math.max(1, WIDTH - l.length - r.length)
    // Clamp every line to WIDTH so nothing reaches the tractor-hole strip.
    const line = (l + ' '.repeat(gap) + r).slice(0, WIDTH).trimEnd()
    // Bold only the shop-name portion of the first line (blur mitigation).
    if (i === 0) {
      return BOLD_ON + line.slice(0, shopName.length) + BOLD_OFF + line.slice(shopName.length)
    }
    return line
  })

  lines.push((KEPADA_LABEL + data.namaPelanggan).slice(0, WIDTH))
  if (data.alamatPelanggan) {
    lines.push((' '.repeat(KEPADA_LABEL.length) + data.alamatPelanggan).slice(0, WIDTH))
  }
  return lines.join(LF)
}

function footerBlock(data: InvoiceData, isLastPage: boolean): string {
  const lines = [
    '',
    'Perhatian:',
    'Barang yang sudah dibeli, tidak bisa ditukar / dikembalikan,',
    'kecuali sesuai perjanjian.',
    '',
    '',
    '',
    'Penerima,',
    '',
    '',
    '',
    '',
    '_______________________',
  ]
  if (isLastPage) {
    const totalText = `TOTAL : ${formatNumberID(data.totalPesanan)}`
    lines.push('', padStart(totalText, AMOUNT_END))
  }
  return lines.join(LF)
}

/**
 * Split items into pages against a *line* budget, not an item count: a long
 * product name wraps onto continuation lines, so twelve items can be anything
 * from 12 to 40+ printed lines. Overflowing the 33-line form would push every
 * later page off its top-of-form registration.
 *
 * The page containing the final item also has to fit the TOTAL rows, so that
 * item is measured against the smaller `lastBudget`.
 */
function paginate(items: InvoiceData['items'], bodyBudget: number, lastBudget: number): InvoiceData['items'][] {
  const pages: InvoiceData['items'][] = []
  let current: InvoiceData['items'] = []
  let used = 0

  items.forEach((item, i) => {
    const cost = itemLineCost(item)
    const budget = i === items.length - 1 ? lastBudget : bodyBudget
    if (current.length > 0 && used + cost > budget) {
      pages.push(current)
      current = []
      used = 0
    }
    current.push(item)
    used += cost
  })
  pages.push(current)
  return pages
}

/**
 * Build a raw ESC/P command stream for the Epson LX-310. Pure function of its
 * input: no browser or printer dependency, so it is fully unit-testable. The
 * stream resets the printer, sets a 33-line page length, then emits one form per
 * page of items (header + rows + per-page subtotal + footer), form-feeding
 * between forms and at the end so each receipt lands on a fresh form's top edge.
 *
 * Page arithmetic (all in printed lines, budget = LINES_PER_PAGE = 33):
 *   header (5, or 6 with a customer address)
 * + table head (3) + item lines (variable) + SUBTOTAL (1) + footer (8)
 * + TOTAL (2, last page only)
 * so the item budget is 33 - header - 12, minus 2 more on the last page
 * (16 / 14 lines without an address, 15 / 13 with one).
 */
export function buildEscP(input: InvoiceData): string {
  // Fold to printer-safe ASCII first, so every length below is the printed one.
  const data: InvoiceData = {
    ...input,
    namaPelanggan: toAscii(input.namaPelanggan),
    alamatPelanggan: input.alamatPelanggan ? toAscii(input.alamatPelanggan) : undefined,
    items: input.items.map((i) => ({ ...i, namaBarang: toAscii(i.namaBarang) })),
  }

  const tanggal = format(new Date(data.tanggal), 'd MMM yyyy', { locale: idLocale })
  const tanggalPengiriman = data.tanggalPengiriman
    ? format(new Date(data.tanggalPengiriman), 'd MMM yyyy', { locale: idLocale })
    : 'Belum ditentukan'

  // The header is identical on every page, so measure it once.
  const header = headerBlock(data, tanggal, tanggalPengiriman)
  const headerLines = header.split(LF).length
  const bodyBudget = LINES_PER_PAGE - headerLines - TABLE_HEAD_LINES - SUBTOTAL_LINES - FOOTER_LINES
  const lastBudget = bodyBudget - TOTAL_LINES

  const chunks = paginate(data.items, bodyBudget, lastBudget)

  let out = INIT + PAGE_LENGTH
  let startIndex = 0

  chunks.forEach((pageItems, pageIndex) => {
    const isLast = pageIndex === chunks.length - 1
    const pageSubtotal = pageItems.reduce((s, it) => s + it.subtotal, 0)

    const parts = [
      header,
      '='.repeat(WIDTH),
      row('NO', 'QTY', 'NAMA BARANG', 'HARGA(Rp)', 'JUMLAH(Rp)', 'CHECK'),
      '-'.repeat(WIDTH),
      ...pageItems.map((item, i) => itemLines(item, startIndex + i)),
      '',
      padStart(`SUBTOTAL : ${formatNumberID(pageSubtotal)}`, AMOUNT_END),
      footerBlock(data, isLast),
    ]
    out += parts.join(LF) + FF
    startIndex += pageItems.length
  })

  return out
}
