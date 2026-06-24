import { formatRupiah } from '@/lib/utils'
import type { InvoiceData } from '@/lib/invoice-data'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

export function formatWhatsapp(data: InvoiceData): string {
  const tanggal = format(new Date(data.tanggal), 'd/MM/yyyy', { locale: idLocale })

  const itemLines = data.items
    .map(
      (i) =>
        `• ${i.namaBarang} – ${i.qty}x ${formatRupiah(i.hargaSatuan)} = *${formatRupiah(i.subtotal)}*`
    )
    .join('\n')

  const pembayaranLine =
    data.sisaTagihan <= 0
      ? '*Lunas*'
      : `Dibayar: ${formatRupiah(data.totalDibayar)}\n*Sisa: ${formatRupiah(data.sisaTagihan)}*`

  const catatanLine = data.catatan ? `\nCatatan: ${data.catatan}` : ''

  return `*AU Electronic*
Pesanan #${data.kodePesanan} | ${tanggal}
Pelanggan: ${data.namaPelanggan}

${itemLines}

*Total: ${formatRupiah(data.totalPesanan)}*
${pembayaranLine}${catatanLine}

Terima kasih!`
}
