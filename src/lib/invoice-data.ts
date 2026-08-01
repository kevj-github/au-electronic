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
  pengiriman?: string          // courier/ekspedisi name written on the signature line
  colly?: number               // package count printed beside pengiriman
  items: InvoiceItem[]
  totalPesanan: number
  totalDibayar: number
  sisaTagihan: number
  catatan: string | null
}

/**
 * The shipment text written on the "Penerima," signature line of both documents:
 * "Exp. Expedisi Jaya ( 3 colly )". Either half may be missing — a pickup order
 * has neither, in which case the line is left blank for a handwritten signature.
 * Shared by the PDF and the ESC/P receipt so they never drift apart.
 */
export function shipmentText(data: Pick<InvoiceData, 'pengiriman' | 'colly'>): string {
  const pengiriman = data.pengiriman?.trim()
  const parts: string[] = []
  if (pengiriman) parts.push(`Exp. ${pengiriman}`)
  // Spacing inside the parentheses is deliberate — it is how the shop writes it.
  if (data.colly && data.colly > 0) parts.push(`( ${data.colly} colly )`)
  return parts.join(' ')
}

/** Shape of the owner-visible pesanan row used to build an invoice. */
export interface InvoiceSource {
  kode_pesanan: string
  created_at: string
  tanggal_pengiriman: string | null
  nama_pelanggan: string | null
  pengiriman: string | null
  colly: number | null
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
  // Order items alphabetically by name (ascending), with the untouched input
  // as the tiebreaker for duplicate names. Sorting here means every consumer of
  // InvoiceData — the PDF, the Epson/ESC-P receipt, and the click-time refetch
  // in the getInvoiceData action — shares one consistent order, matching the
  // website item list in [id]/page.tsx.
  const items = [...(pesanan.items ?? [])].sort((a, b) =>
    a.nama_barang.localeCompare(b.nama_barang, 'id', { sensitivity: 'base' }),
  )
  const pembayaran = pesanan.pembayaran ?? []
  const totalPesanan = items.reduce((s, i) => s + i.subtotal, 0)
  const totalDibayar = pembayaran.reduce((s, p) => s + p.jumlah, 0)
  return {
    kodePesanan: pesanan.kode_pesanan,
    tanggal: pesanan.created_at,
    tanggalPengiriman: pesanan.tanggal_pengiriman ?? undefined,
    namaPelanggan: pesanan.pelanggan?.nama ?? pesanan.nama_pelanggan ?? '—',
    alamatPelanggan: pesanan.pelanggan?.alamat ?? undefined,
    pengiriman: pesanan.pengiriman ?? undefined,
    colly: pesanan.colly ?? undefined,
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
