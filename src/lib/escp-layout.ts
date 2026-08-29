/**
 * Pure text layout for the Epson LX-310 receipt: column geometry, ASCII
 * folding, name wrapping, header/footer block assembly and pagination — none
 * of it touches an ESC/P control code or emits a byte the printer wouldn't
 * treat as plain text. `escp.ts` owns the printer-protocol bytes (INIT, page
 * length, bold, form feed) and calls into this module to build the text that
 * goes between them.
 *
 * The one place a printer concern would otherwise leak in is `headerBlock`'s
 * shop-name bolding: rather than importing an ESC/P constant here, the caller
 * passes a `bold` wrapper function, so this file has zero knowledge of what
 * "bold" means on the wire.
 */

import { formatNumberID } from '@/lib/utils'
import { shipmentText, type InvoiceData } from '@/lib/invoice-data'

export const LF = '\n'

// Keep everything inside 79 columns so nothing lands in the tractor-hole strip.
export const WIDTH = 79

// Column character widths, in print order: NO CHECK QTY NAMA HARGA JUMLAH.
// Fields are joined with single spaces (5 separators).
// 3 + 6 + 5 + 34 + 13 + 13 = 74, + 5 separators = 79 <= 79.
// QTY holds 5 digits and the amount columns 13 characters ("1.234.567.890"), so
// realistic values never reach the overflow marker in `padStart`.
const COL = { no: 3, check: 6, qty: 5, nama: 34, harga: 13, jumlah: 13 } as const

// Column at which the JUMLAH field ends; SUBTOTAL/TOTAL are right-aligned here
// so the amounts line up under the column they total. JUMLAH is the last column,
// so this is the full line width.
export const AMOUNT_END =
  COL.no + 1 + COL.check + 1 + COL.qty + 1 + COL.nama + 1 + COL.harga + 1 + COL.jumlah

// Fixed line costs per page, used by the pagination budget in escp.ts.
export const TABLE_HEAD_LINES = 3 // '=' rule + column header row + '-' rule
export const SUBTOTAL_LINES = 2 // blank + per-page SUBTOTAL row
export const FOOTER_LINES = 10 // blank + Perhatian (3) + 1 blank + Penerima,(+TOTAL) + 2 blank + rule + trailing blank
export const TOTAL_LINES = 0 // TOTAL shares the Penerima row on the last page — no extra line

// Hard cap on items per printed form, on top of the line budget below: keeps
// each receipt to at most 10 rows even when short names would let more fit.
const MAX_ITEMS_PER_PAGE = 10

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
  ' ': ' ', // non-breaking space
}

/** Fold a text field to printable ASCII. Applied before layout so the folded
 *  length (not the original) is what the column arithmetic sees. */
export function toAscii(s: string): string {
  return s.replace(/[^\x20-\x7E]/g, (ch) => ASCII_FOLD[ch] ?? '?')
}

function padEnd(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length)
}

/** Right-align `s` in `n` columns. On overflow keep the *rightmost* characters
 *  and prefix a '#' so a clipped number reads as obviously wrong rather than as
 *  a plausible smaller number (leading-character truncation silently divides a
 *  price by an order of magnitude). */
export function padStart(s: string, n: number): string {
  if (s.length <= n) return ' '.repeat(n - s.length) + s
  return '#' + s.slice(s.length - (n - 1))
}

// One fixed-width table row (used for both the header row and item rows).
// Argument order mirrors the printed column order.
export function row(no: string, check: string, qty: string, nama: string, harga: string, jumlah: string): string {
  return [
    padEnd(no, COL.no),
    padEnd(check, COL.check),
    padStart(qty, COL.qty),
    padEnd(nama, COL.nama),
    padStart(harga, COL.harga),
    padStart(jumlah, COL.jumlah),
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

export function itemLines(item: InvoiceData['items'][number], index: number): string {
  const chunks = wrapName(item.namaBarang.toUpperCase())
  const lines: string[] = [
    row(
      String(index + 1),
      '', // CHECK stays blank — it's ticked by hand on the printed form
      String(item.qty),
      chunks[0],
      formatNumberID(item.hargaSatuan),
      formatNumberID(item.subtotal),
    ),
  ]
  for (let i = 1; i < chunks.length; i++) lines.push(row('', '', '', chunks[i], '', ''))
  return lines.join(LF)
}

const KEPADA_LABEL = 'Kepada Yth: '

/**
 * "Hal. 2/3", printed centred on the Kepada line when a receipt runs to more
 * than one form. The index is padded to the width of the total so every page's
 * label is the same length — the pagination budget below depends on the header
 * having a stable height whichever page it is rendered for.
 */
export function pageLabelText(index: number, total: number): string {
  return `Hal. ${String(index).padStart(String(total).length)}/${total}`
}

/**
 * Shop block on the left, order dates on the right, then the customer on its
 * own line below the header: "Kepada Yth: name - address" starts in the same
 * column as "Tgl. Pengiriman:" above it, then flows across the full width so a
 * long name+address wraps onto continuation lines rather than being truncated.
 *
 * `bold` wraps a substring in the caller's printer-protocol bold markers — see
 * the module doc comment above for why this isn't an ESC/P constant here.
 */
export function headerBlock(
  data: InvoiceData,
  tanggal: string,
  tanggalPengiriman: string,
  bold: (s: string) => string,
  pageLabel?: string,
): string {
  const shopName = 'AU ELECTRONIC  spare parts'
  const left = [
    shopName,
    'Genteng Electronic Center',
    'Jl. Genteng Besar 43 Lt. 1 No. 109-111 Surabaya',
    'No. HP/WA: 081 2351 7994',
  ]
  const pengirimanLine = `Tgl. Pengiriman: ${tanggalPengiriman}`
  const right = [`Tgl. Pesanan: ${tanggal}`, pengirimanLine, '', '']
  const lines = left.map((l, i) => {
    const r = right[i]
    const gap = Math.max(1, WIDTH - l.length - r.length)
    // Clamp every line to WIDTH so nothing reaches the tractor-hole strip.
    const line = (l + ' '.repeat(gap) + r).slice(0, WIDTH).trimEnd()
    // Bold only the shop-name portion of the first line (blur mitigation).
    if (i === 0) {
      return bold(line.slice(0, shopName.length)) + line.slice(shopName.length)
    }
    return line
  })

  // "Kepada Yth: name - address" on its own line(s) beneath the header. When
  // the whole thing fits on one line it is indented so its first character sits
  // under the "Tgl." of the "Tgl. Pengiriman:" line above it (right-aligned to
  // WIDTH, so the start column tracks the date length). When it would overflow
  // that column, it wraps full-width but each wrapped line is right-aligned to
  // the far margin, so the block stays over on the right instead of dropping to
  // the left margin — and a long name+address is still never truncated.
  const kepada = data.alamatPelanggan
    ? `${data.namaPelanggan} - ${data.alamatPelanggan}`
    : data.namaPelanggan
  const anchorCol = Math.max(0, WIDTH - pengirimanLine.length)
  const full = KEPADA_LABEL + kepada

  if (!pageLabel) {
    if (anchorCol + full.length <= WIDTH) {
      lines.push(' '.repeat(anchorCol) + full)
    } else {
      for (let i = 0; i < full.length; i += WIDTH) {
        const chunk = full.slice(i, i + WIDTH)
        lines.push(' '.repeat(WIDTH - chunk.length) + chunk)
      }
    }
    return lines.join(LF)
  }

  // Multi-page: the page label sits centred on the same line as "Kepada Yth:".
  // Rather than overwriting whatever is under it, the label gets a reserved slot
  // and the customer text on that first line starts after it — so a long
  // name+address wraps around the label instead of colliding with it.
  const slotStart = Math.floor((WIDTH - pageLabel.length) / 2)
  const slotEnd = slotStart + pageLabel.length
  const textStart = Math.max(anchorCol, slotEnd + 1)
  const withLabel = (chunk: string) =>
    ' '.repeat(slotStart) + pageLabel + ' '.repeat(textStart - slotEnd) + chunk

  // The label leaves only ~30 columns for the customer on the first line, so
  // break on the last space that fits rather than mid-word (the full-width
  // continuation lines below have room to spare and keep the plain slice).
  const capacity = WIDTH - textStart
  let firstCapacity = capacity
  if (full.length > capacity) {
    const lastSpace = full.lastIndexOf(' ', capacity)
    if (lastSpace > KEPADA_LABEL.length) firstCapacity = lastSpace + 1
  }
  lines.push(withLabel(full.slice(0, firstCapacity).trimEnd()))
  // Remainder wraps full-width, right-aligned to the far margin as above.
  for (let i = firstCapacity; i < full.length; i += WIDTH) {
    const chunk = full.slice(i, i + WIDTH)
    lines.push(' '.repeat(WIDTH - chunk.length) + chunk)
  }

  return lines.join(LF)
}

// The signature rule under "Penerima,". When the owner has filled in a
// pengiriman (courier/ekspedisi) name it is written centred on the rule; an
// empty pengiriman leaves the rule blank for a handwritten signature. A name
// wider than the rule widens the rule to fit rather than clip.
const SIGNATURE_RULE = '_______________________' // 23 underscores
function signatureLine(data: InvoiceData): string {
  const text = shipmentText(data)
  if (!text) return SIGNATURE_RULE
  if (text.length >= SIGNATURE_RULE.length) return text
  const left = Math.floor((SIGNATURE_RULE.length - text.length) / 2)
  const right = SIGNATURE_RULE.length - text.length - left
  return '_'.repeat(left) + text + '_'.repeat(right)
}

export function footerBlock(data: InvoiceData, isLastPage: boolean): string {
  // On the last page the grand TOTAL rides on the right of the "Penerima," row.
  let penerima = 'Penerima,'
  if (isLastPage) {
    const totalText = `TOTAL : ${formatNumberID(data.totalPesanan)}`
    penerima += padStart(totalText, AMOUNT_END).slice(penerima.length)
  }
  const lines = [
    '',
    'Perhatian:',
    'Barang yang sudah dibeli, tidak bisa ditukar / dikembalikan,',
    'kecuali sesuai perjanjian.',
    '',
    penerima,
    '',
    '',
    signatureLine(data),
    // Trailing blank so the signature rule is line-feed-terminated before the
    // page's form-feed. The LX-310 double-strikes a line ended by FF instead of
    // LF, which printed the rule as two lines. Do not remove.
    '',
  ]
  return lines.join(LF)
}

/**
 * Split items into pages against a *line* budget (not just an item count): a
 * long product name wraps onto continuation lines, so ten items can be anything
 * from 10 to 30+ printed lines. Overflowing the 33-line form would push every
 * later page off its top-of-form registration. A page also breaks once it holds
 * MAX_ITEMS_PER_PAGE rows, even when short names would let the line budget fit
 * more.
 *
 * The page containing the final item also has to fit the TOTAL rows, so that
 * item is measured against the smaller `lastBudget`.
 */
export function paginate(items: InvoiceData['items'], bodyBudget: number, lastBudget: number): InvoiceData['items'][] {
  const pages: InvoiceData['items'][] = []
  let current: InvoiceData['items'] = []
  let used = 0

  items.forEach((item, i) => {
    const cost = itemLineCost(item)
    const budget = i === items.length - 1 ? lastBudget : bodyBudget
    const full = current.length >= MAX_ITEMS_PER_PAGE || used + cost > budget
    if (current.length > 0 && full) {
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
