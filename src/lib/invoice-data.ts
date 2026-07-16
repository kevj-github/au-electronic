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

/** Shape of the owner-visible pesanan row used to build an invoice. */
export interface InvoiceSource {
  kode_pesanan: string
  created_at: string
  tanggal_pengiriman: string | null
  nama_pelanggan: string | null
  pelanggan: { nama: string | null; alamat: string | null } | null
  items: Array<{ nama_barang: string; qty: number; harga_satuan: number; subtotal: number }>
  pembayaran: Array<{ jumlah: number }>
  catatan: string | null
}

/**
 * Build `InvoiceData` from a raw owner-visible pesanan row. Shared by the detail
 * page (render-time) and the `getInvoiceData` Server Action (click-time refetch)
 * so both produce byte-identical documents.
 */
export function buildInvoiceData(pesanan: InvoiceSource): InvoiceData {
  const items = pesanan.items ?? []
  const pembayaran = pesanan.pembayaran ?? []
  const totalPesanan = items.reduce((s, i) => s + i.subtotal, 0)
  const totalDibayar = pembayaran.reduce((s, p) => s + p.jumlah, 0)
  return {
    kodePesanan: pesanan.kode_pesanan,
    tanggal: pesanan.created_at,
    tanggalPengiriman: pesanan.tanggal_pengiriman ?? undefined,
    namaPelanggan: pesanan.pelanggan?.nama ?? pesanan.nama_pelanggan ?? '—',
    alamatPelanggan: pesanan.pelanggan?.alamat ?? undefined,
    items: items.map((i) => ({
      namaBarang: i.nama_barang,
      qty: i.qty,
      hargaSatuan: i.harga_satuan,
      subtotal: i.subtotal,
    })),
    totalPesanan,
    totalDibayar,
    sisaTagihan: totalPesanan - totalDibayar,
    catatan: pesanan.catatan,
  }
}
