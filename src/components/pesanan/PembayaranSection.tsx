import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { Check } from 'lucide-react'
import { PaymentModal } from './PaymentModal'
import { DeletePaymentButton } from './DeletePaymentButton'
import { formatRupiah } from '@/lib/utils'
import type { PembayaranOwner } from '@/lib/types'

interface PembayaranSectionProps {
  pesananId: string
  totalPesanan: number
  sisaTagihan: number
  pembayaranList: PembayaranOwner[]
}

// Owner-only — page.tsx guards the render with `isOwner`.
export function PembayaranSection({
  pesananId,
  totalPesanan,
  sisaTagihan,
  pembayaranList,
}: PembayaranSectionProps) {
  // `sisaTagihan === 0` does not mean "Lunas" when totalPesanan is also 0: an
  // order whose items have no price yet would otherwise show a false "Lunas".
  const belumAdaHarga = totalPesanan === 0 && pembayaranList.length === 0

  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Pembayaran</h3>
        {sisaTagihan > 0 && <PaymentModal pesananId={pesananId} sisaTagihan={sisaTagihan} />}
      </div>
      {pembayaranList.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada pembayaran.</p>
      ) : (
        <div className="space-y-1">
          {pembayaranList.map((p) => (
            <div key={p.id} className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">
                {format(new Date(p.dibayar_pada), 'd MMM yyyy', { locale: idLocale })} · {p.metode}
                {p.catatan ? ` · ${p.catatan}` : ''}
              </span>
              <div className="flex items-center gap-3">
                <span className="font-mono">{formatRupiah(p.jumlah)}</span>
                <DeletePaymentButton pembayaranId={p.id} />
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="border-t pt-2 flex justify-between font-medium">
        <span>Sisa Tagihan</span>
        <span
          className={
            belumAdaHarga
              ? 'text-muted-foreground text-sm font-normal'
              : sisaTagihan === 0
                ? 'text-success inline-flex items-center gap-1'
                : 'font-mono'
          }
        >
          {belumAdaHarga ? (
            'Belum ada harga'
          ) : sisaTagihan === 0 ? (
            <>
              <Check className="size-4" /> Lunas
            </>
          ) : (
            formatRupiah(sisaTagihan)
          )}
        </span>
      </div>
    </div>
  )
}
