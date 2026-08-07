import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { SaldoPesanan } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`
}

export interface LineItemInput {
  qty: number
  harga_satuan: number
}

export function calcOrderTotal(items: LineItemInput[]): number {
  return items.reduce((sum, item) => sum + item.qty * item.harga_satuan, 0)
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
