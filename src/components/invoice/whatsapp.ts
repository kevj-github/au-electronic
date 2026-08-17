import { formatRupiah, formatTanggalNumerik } from '@/lib/format'
import type { InvoiceData } from '@/lib/invoice-data'

export function formatWhatsapp(data: InvoiceData): string {
  const tanggal = formatTanggalNumerik(data.tanggal)
  const tanggalPengiriman = data.tanggalPengiriman
    ? formatTanggalNumerik(data.tanggalPengiriman)
    : 'Belum ditentukan'

  const itemLines = data.items
    .map(
      (i) =>
        `• ${i.qty}x ${i.namaBarang} – ${formatRupiah(i.hargaSatuan)} = *${formatRupiah(i.subtotal)}*`
    )
    .join('\n')

  const pembayaranLine =
    data.sisaTagihan <= 0
      ? '*Lunas*'
      : `Dibayar: ${formatRupiah(data.totalDibayar)}\n*Sisa: ${formatRupiah(data.sisaTagihan)}*`

  const catatanLine = data.catatan ? `\nCatatan: ${data.catatan}` : ''

  return `*AU Electronic*
Tgl. Pesanan: ${tanggal}
Tgl. Pengiriman: ${tanggalPengiriman}
Pelanggan: ${data.namaPelanggan}

${itemLines}

*Total: ${formatRupiah(data.totalPesanan)}*
${pembayaranLine}${catatanLine}

Terima kasih!`
}
