export interface InvoiceItem {
  namaBarang: string
  qty: number
  hargaSatuan: number
  subtotal: number
}

export interface InvoiceData {
  kodePesanan: string
  tanggal: string              // ISO date string
  namaPelanggan: string
  alamatPelanggan?: string
  items: InvoiceItem[]
  totalPesanan: number
  totalDibayar: number
  sisaTagihan: number
  catatan: string | null
}
