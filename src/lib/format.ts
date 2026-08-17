import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

/**
 * Presentation-only formatting for money and dates. Every user-visible Rupiah
 * amount and every tanggal in the app goes through here, so the Indonesian
 * locale is applied in exactly one place instead of being restated at each
 * call site (`format(new Date(x), 'd MMM yyyy', { locale: idLocale })` used to
 * be copy-pasted across the order list, the detail page, the PDF, the ESC/POS
 * receipt and the WhatsApp message).
 *
 * Anything that *computes* a number (totals, saldo) lives in `utils.ts`.
 */

export function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`
}

/** Dot-grouped Indonesian number, no currency prefix (e.g. 1000000 -> "1.000.000"). */
export function formatNumberID(amount: number): string {
  return amount.toLocaleString('id-ID')
}

/** Strip everything but digits (e.g. "Rp 1.000a" -> "1000", "" -> ""). */
export function parseThousandsInput(display: string): string {
  return display.replace(/\D/g, '')
}

/** Format raw user input as dot-grouped digits for display (e.g. "1000000" -> "1.000.000"). */
export function formatThousandsInput(raw: string): string {
  const digits = parseThousandsInput(raw)
  if (digits === '') return ''
  return Number(digits).toLocaleString('id-ID')
}

/** Accepts either an ISO string straight from Supabase or an already-parsed Date. */
export type DateInput = string | Date

/** `YYYY-MM-DD` with no time part — what a Postgres `date` column serialises to. */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * `new Date('2026-07-16')` is specified to parse a date-only string as UTC
 * midnight, so anywhere behind UTC it renders as the *previous* day: a
 * `tanggal_pengiriman` of 2026-07-16 printed "15 Jul 2026" on the invoice and
 * the ESC/P receipt. A date column carries no time or zone — it means that
 * calendar day everywhere — so parse it as local midnight and let it survive
 * formatting unshifted. Strings that do carry a time (`dibayar_pada`,
 * `created_at`, both timestamptz) are real instants and keep the standard
 * zone-aware parse.
 */
function toDate(value: DateInput): Date {
  if (typeof value !== 'string') return value
  const dateOnly = DATE_ONLY.exec(value)
  if (!dateOnly) return new Date(value)
  const [, year, month, day] = dateOnly
  return new Date(Number(year), Number(month) - 1, Number(day))
}

/** Compact Indonesian date, the default for lists and documents (e.g. "5 Agu 2026"). */
export function formatTanggal(value: DateInput): string {
  return format(toDate(value), 'd MMM yyyy', { locale: idLocale })
}

/** Spelled-out month, used where there is room for it (e.g. "5 Agustus 2026"). */
export function formatTanggalPanjang(value: DateInput): string {
  return format(toDate(value), 'd MMMM yyyy', { locale: idLocale })
}

/** Numeric date for the WhatsApp message (e.g. "5/08/2026"). */
export function formatTanggalNumerik(value: DateInput): string {
  return format(toDate(value), 'd/MM/yyyy', { locale: idLocale })
}

/** `yyyy-MM-dd`, the value shape an `<input type="date">` expects. */
export function formatDateInputValue(value: DateInput): string {
  return format(toDate(value), 'yyyy-MM-dd')
}
