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
  diskon: number
}

export function calcOrderTotal(items: LineItemInput[]): number {
  return items.reduce((sum, item) => sum + item.qty * item.harga_satuan - item.diskon, 0)
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
