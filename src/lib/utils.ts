import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { SaldoPesanan } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`
}

export function hitungSaldo(
  totalPesanan: number,
  totalDibayar: number
): SaldoPesanan {
  const sisaTagihan = totalPesanan - totalDibayar
  let statusPembayaran: SaldoPesanan['statusPembayaran']
  if (sisaTagihan <= 0) {
    statusPembayaran = 'lunas'
  } else if (totalDibayar > 0) {
    statusPembayaran = 'bayar_sebagian'
  } else {
    statusPembayaran = 'belum_dibayar'
  }
  return { totalPesanan, totalDibayar, sisaTagihan, statusPembayaran }
}

/** Dot-grouped Indonesian number, no currency prefix (e.g. 1000000 -> "1.000.000"). */
export function formatNumberID(amount: number): string {
  return amount.toLocaleString('id-ID')
}

/** Parse a raw qty/harga input string to an integer, defaulting to 0 for blank/invalid input. */
export function parseIntOrZero(raw: string): number {
  return parseInt(raw, 10) || 0
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

/** True if `pathname` is `href` or a sub-path of it (e.g. "/pesanan/123" matches "/pesanan"). */
export function isActiveRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/')
}

/**
 * Order money totals derived from its nested items and payments. The same pair
 * of reduces was previously copy-pasted across the dashboard and OrderList;
 * `subtotal` is optional because helper-facing queries deliberately omit it.
 */
export function orderTotals(p: {
  items: Array<{ subtotal?: number }>
  pembayaran?: Array<{ jumlah: number }>
}): { totalPesanan: number; totalDibayar: number } {
  return {
    totalPesanan: p.items.reduce((s, i) => s + (i.subtotal ?? 0), 0),
    totalDibayar: (p.pembayaran ?? []).reduce((s, pm) => s + pm.jumlah, 0),
  }
}
