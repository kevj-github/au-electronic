import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { SaldoPesanan, TipeDokumen } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`
}

export function generateKodePesanan(
  tipe: TipeDokumen,
  year: number,
  seq: number
): string {
  const prefix = tipe === 'invoice' ? 'INV' : 'NOT'
  const padded = String(seq).padStart(4, '0')
  return `${prefix}-${year}-${padded}`
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
