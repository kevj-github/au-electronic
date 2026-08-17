import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { SaldoPesanan } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
