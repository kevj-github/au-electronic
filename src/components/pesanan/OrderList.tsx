import Link from 'next/link'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { formatRupiah, hitungSaldo } from '@/lib/utils'
import { StatusBadge } from './StatusBadge'
import type { Pesanan, ItemPesanan, Pembayaran } from '@/lib/types'

type PesananWithRelations = Pesanan & {
  items: Pick<ItemPesanan, 'subtotal'>[]
  pembayaran: Pick<Pembayaran, 'jumlah'>[]
}

interface OrderListProps {
  pesananList: PesananWithRelations[]
}

export function OrderList({ pesananList }: OrderListProps) {
  if (pesananList.length === 0) {
    return <p className="text-muted-foreground text-sm">Belum ada pesanan.</p>
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Kode</th>
            <th className="text-left px-4 py-3 font-medium">Pelanggan</th>
            <th className="text-left px-4 py-3 font-medium">Tanggal</th>
            <th className="text-right px-4 py-3 font-medium">Total</th>
            <th className="text-right px-4 py-3 font-medium">Sisa</th>
            <th className="text-left px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {pesananList.map((p) => {
            const totalPesanan = p.items.reduce((s, i) => s + i.subtotal, 0)
            const totalDibayar = p.pembayaran.reduce((s, pm) => s + pm.jumlah, 0)
            const { sisaTagihan } = hitungSaldo(totalPesanan, totalDibayar)

            return (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/pesanan/${p.id}`}
                    className="font-mono text-blue-600 hover:underline"
                  >
                    {p.kode_pesanan}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {p.pelanggan?.nama ?? p.nama_pelanggan ?? '—'}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {format(new Date(p.created_at), 'd MMM yyyy', { locale: idLocale })}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {formatRupiah(totalPesanan)}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {sisaTagihan > 0 ? (
                    formatRupiah(sisaTagihan)
                  ) : (
                    <span className="text-green-600 font-medium">Lunas</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={p.status} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
