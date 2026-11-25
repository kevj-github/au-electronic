import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { formatNumberID } from '@/lib/utils'
import { shipmentText, type InvoiceData } from '@/lib/invoice-data'

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

// Column character widths, in print order: NO CHECK QTY NAMA HARGA JUMLAH.
// Fields are joined with single spaces (5 separators).
// 3 + 6 + 5 + 34 + 13 + 13 = 74, + 5 separators = 79 <= 79.
// QTY holds 5 digits and the amount columns 13 characters ("1.234.567.890"), so
// realistic values never reach the overflow marker in `padStart`.
const COL = { no: 3, check: 6, qty: 5, nama: 34, harga: 13, jumlah: 13 } as const

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
// Argument order mirrors the printed column order.
function row(no: string, check: string, qty: string, nama: string, harga: string, jumlah: string): string {
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

function itemLines(item: InvoiceData['items'][number], index: number): string {
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
function pageLabelText(index: number, total: number): string {
  return `Hal. ${String(index).padStart(String(total).length)}/${total}`
}

/**
 * Shop block on the left, order dates on the right, then the customer on its
 * own line below the header: "Kepada Yth: name - address" starts in the same
 * column as "Tgl. Pengiriman:" above it, then flows across the full width so a
 * long name+address wraps onto continuation lines rather than being truncated.
 */
function headerBlock(
  data: InvoiceData,
  tanggal: string,
  tanggalPengiriman: string,
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
      return BOLD_ON + line.slice(0, shopName.length) + BOLD_OFF + line.slice(shopName.length)
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

function footerBlock(data: InvoiceData): string {
  const lines = [
    '',
    padStart(`TOTAL : ${formatNumberID(data.totalPesanan)}`, WIDTH),
    '',
    'Perhatian:',
    'Barang yang sudah dibeli, tidak bisa ditukar / dikembalikan,',
    'kecuali sesuai perjanjian.',
    '',
    'Penerima,',
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
 * Fill each form with printed rows. Keep each item together when it fits on a
 * form, and keep its number and prices on the first row when a name spans forms.
 */
function paginate(itemRows: string[][], bodyBudget: number, lastBudget: number): string[][] {
  if (lastBudget < 1 || bodyBudget < 1) {
    throw new Error('Header atau footer terlalu panjang untuk kertas Epson.')
  }
  const pages: string[][] = []
  let current: string[] = []

  for (const [index, rows] of itemRows.entries()) {
    const isLast = index === itemRows.length - 1
    const budget = isLast ? lastBudget : bodyBudget
    let offset = 0

    // Only split an item if it cannot fit even on a fresh form. On the last
    // item leave enough continuation lines to share a form with the footer.
    while (rows.length - offset > budget) {
      const available = bodyBudget - current.length
      const beforeFooter = rows.length - offset - (isLast ? lastBudget : 0)
      const take = Math.min(available, beforeFooter)
      current.push(...rows.slice(offset, offset + take))
      pages.push(current)
      current = []
      offset += take
    }

    if (current.length + rows.length - offset > budget) {
      pages.push(current)
      current = []
    }
    current.push(...rows.slice(offset))
  }
  pages.push(current)
  return pages
}

/**
 * Build a raw ESC/P command stream for the Epson LX-310. Pure function of its
 * input: no browser or printer dependency, so it is fully unit-testable. The
 * stream resets the printer, sets a 33-line page length, then emits one form per
 * page of items. Only the final form includes the order total and signature.
 * Each form ends with a line feed before the form feed to avoid double-striking
 * its last printed line on the LX-310.
 */
export function buildEscP(input: InvoiceData): string {
  // Fold to printer-safe ASCII first, so every length below is the printed one.
  const data: InvoiceData = {
    ...input,
    namaPelanggan: toAscii(input.namaPelanggan),
    alamatPelanggan: input.alamatPelanggan ? toAscii(input.alamatPelanggan) : undefined,
    pengiriman: input.pengiriman ? toAscii(input.pengiriman) : undefined,
    items: input.items.map((i) => ({ ...i, namaBarang: toAscii(i.namaBarang) })),
  }

  const tanggal = format(new Date(data.tanggal), 'd MMM yyyy', { locale: idLocale })
  const tanggalPengiriman = data.tanggalPengiriman
    ? format(new Date(data.tanggalPengiriman), 'd MMM yyyy', { locale: idLocale })
    : 'Belum ditentukan'

  const buildHeader = (pageLabel?: string) =>
    headerBlock(data, tanggal, tanggalPengiriman, pageLabel)

  const tableHead = [
    '='.repeat(WIDTH),
    row('NO', 'CHECK', 'QTY', 'NAMA BARANG', 'HARGA(Rp)', 'JUMLAH(Rp)'),
    '-'.repeat(WIDTH),
  ]
  const itemRows = data.items.map((item, i) => itemLines(item, i).split(LF))
  const footer = footerBlock(data)
  const splitPages = (header: string) => {
    const available = LINES_PER_PAGE - header.split(LF).length - tableHead.length
    // The footer already includes its trailing LF. Earlier pages need one too.
    return paginate(itemRows, available - 1, available - footer.split(LF).length)
  }

  // Whether a page label is printed depends on the page count, and the label can
  // itself cost a header line (only when a long name+address has to wrap around
  // it), which can change the page count. Settle it: paginate unlabelled to see
  // if this is even a multi-page receipt, then re-paginate with a label of the
  // resulting width. Every page's label is the same width, so the only thing
  // that can shift it again is the total gaining a digit — one more pass.
  let chunks = splitPages(buildHeader())
  if (chunks.length > 1) {
    let label = pageLabelText(chunks.length, chunks.length)
    chunks = splitPages(buildHeader(label))
    const settled = pageLabelText(chunks.length, chunks.length)
    if (chunks.length > 1 && settled.length !== label.length) {
      label = settled
      chunks = splitPages(buildHeader(label))
    }
  }
  const totalPages = chunks.length

  let out = INIT + PAGE_LENGTH

  chunks.forEach((rows, pageIndex) => {
    const parts = [
      buildHeader(totalPages > 1 ? pageLabelText(pageIndex + 1, totalPages) : undefined),
      ...tableHead,
      ...rows,
      pageIndex === totalPages - 1 ? footer : '',
    ]
    out += parts.join(LF) + FF
  })

  return out
}
