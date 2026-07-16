export interface InvoiceItem {
  namaBarang: string
  qty: number
  hargaSatuan: number
  subtotal: number
}

export interface InvoiceData {
  kodePesanan: string
  tanggal: string              // ISO date string
  tanggalPengiriman?: string   // ISO date string, null if not yet set
  namaPelanggan: string
  alamatPelanggan?: string
  items: InvoiceItem[]
  totalPesanan: number
  totalDibayar: number
  sisaTagihan: number
  catatan: string | null
}
