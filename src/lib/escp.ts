import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { formatNumberID } from '@/lib/utils'
import type { InvoiceData } from '@/lib/invoice-data'
import {
  LF,
  WIDTH,
  AMOUNT_END,
  TABLE_HEAD_LINES,
  SUBTOTAL_LINES,
  FOOTER_LINES,
  TOTAL_LINES,
  toAscii,
  row,
  padStart,
  itemLines,
  headerBlock,
  footerBlock,
  paginate,
  pageLabelText,
} from './escp-layout'

// ESC/P control codes for the 9-pin Epson LX-310.
const ESC = '\x1B'
const INIT = ESC + '@' // reset printer to power-on defaults
// Page length in lines, at 6 LPI -> 33 lines = 5.5". This is the form geometry
// every layout calculation in escp-layout.ts is measured against, so keep them
// in sync.
const LINES_PER_PAGE = 33
const PAGE_LENGTH = ESC + 'C' + String.fromCharCode(LINES_PER_PAGE) // ESC C n
const BOLD_ON = ESC + 'E'
const BOLD_OFF = ESC + 'F'
const FF = '\x0C' // form feed -> advance to next form's top edge

/**
 * Build a raw ESC/P command stream for the Epson LX-310. Pure function of its
 * input: no browser or printer dependency, so it is fully unit-testable. The
 * stream resets the printer, sets a 33-line page length, then emits one form per
 * page of items (header + rows + per-page subtotal + footer), form-feeding
 * between forms and at the end so each receipt lands on a fresh form's top edge.
 *
 * The receipt's text layout (column geometry, wrapping, pagination) lives in
 * escp-layout.ts, which has no knowledge of ESC/P — this file owns the
 * printer-protocol bytes around that text.
 *
 * Page arithmetic (all in printed lines, budget = LINES_PER_PAGE = 33):
 *   header (5; +1 or more when a customer address wraps the Kepada line)
 * + table head (3) + item lines (variable) + SUBTOTAL (2) + footer (10).
 * TOTAL rides the Penerima row on the last page, so it costs no extra lines.
 * headerLines is measured from the built header below, so a wrapped Kepada line
 * shrinks the item budget automatically. Item count is additionally capped at
 * MAX_ITEMS_PER_PAGE regardless of how few lines the names occupy.
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

  const bold = (s: string) => BOLD_ON + s + BOLD_OFF
  const buildHeader = (pageLabel?: string) =>
    headerBlock(data, tanggal, tanggalPengiriman, bold, pageLabel)

  // The header is the same height on every page, so measuring one is enough.
  const splitPages = (header: string) => {
    const headerLines = header.split(LF).length
    const bodyBudget =
      LINES_PER_PAGE - headerLines - TABLE_HEAD_LINES - SUBTOTAL_LINES - FOOTER_LINES
    return paginate(data.items, bodyBudget, bodyBudget - TOTAL_LINES)
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
  let startIndex = 0

  chunks.forEach((pageItems, pageIndex) => {
    const isLast = pageIndex === totalPages - 1
    const pageSubtotal = pageItems.reduce((s, it) => s + it.subtotal, 0)

    const parts = [
      buildHeader(
        totalPages > 1 ? pageLabelText(pageIndex + 1, totalPages) : undefined,
      ),
      '='.repeat(WIDTH),
      row('NO', 'CHECK', 'QTY', 'NAMA BARANG', 'HARGA(Rp)', 'JUMLAH(Rp)'),
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
