import type { TipeDokumen } from '@/lib/types'

export interface InvoiceItem {
  namaProduk: string
  qty: number
  satuan: string
  hargaSatuan: number
  subtotal: number
}

export interface InvoiceData {
  kodePesanan: string
  tanggal: string              // ISO date string
  namaPelanggan: string
  alamatPelanggan?: string
  tipeDokumen: TipeDokumen
  items: InvoiceItem[]
  totalPesanan: number
  totalDibayar: number
  sisaTagihan: number
  catatan: string | null
}
