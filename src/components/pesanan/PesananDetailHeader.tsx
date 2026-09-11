import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { TanggalPengirimanEditor } from './TanggalPengirimanEditor'
import { PengirimanEditor } from './PengirimanEditor'
import { CollyEditor } from './CollyEditor'
import { StatusBadge } from './StatusBadge'
import { StatusTransitionButtons } from './StatusTransitionButtons'
import { DocumentButtons } from './DocumentButtons'
import { statusLabel } from './pesanan-detail'
import type { InvoiceData } from '@/lib/invoice-data'
import type { StatusPesanan } from '@/lib/types'

interface PesananDetailHeaderProps {
  pesananId: string
  kodePesanan: string
  status: StatusPesanan
  createdAt: string
  tanggalPengiriman: string | null
  pengiriman: string | null
  colly: number | null
  isOwner: boolean
  statusLocked: boolean
  invoiceData: InvoiceData | null
  belumDicekCount: number
  nextStatuses: StatusPesanan[]
}

export function PesananDetailHeader({
  pesananId,
  kodePesanan,
  status,
  createdAt,
  tanggalPengiriman,
  pengiriman,
  colly,
  isOwner,
  statusLocked,
  invoiceData,
  belumDicekCount,
  nextStatuses,
}: PesananDetailHeaderProps) {
  return (
    <div className="flex items-start justify-between flex-wrap gap-3">
      <div>
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold font-mono">{kodePesanan}</h2>
          <StatusBadge status={status} />
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {format(new Date(createdAt), 'd MMMM yyyy', { locale: idLocale })}
        </p>
        {isOwner && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Tgl. Pengiriman:</span>
              <TanggalPengirimanEditor
                pesananId={pesananId}
                initialValue={tanggalPengiriman}
                locked={statusLocked}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Pengiriman:</span>
              <PengirimanEditor pesananId={pesananId} initialValue={pengiriman} locked={statusLocked} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Colly:</span>
              <CollyEditor pesananId={pesananId} initialValue={colly} locked={statusLocked} />
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-2 flex-wrap">
        {isOwner && invoiceData && (
          <DocumentButtons pesananId={pesananId} data={invoiceData} belumDicekCount={belumDicekCount} />
        )}
        {isOwner && (
          <StatusTransitionButtons
            pesananId={pesananId}
            nextStatuses={nextStatuses}
            statusLabel={statusLabel}
          />
        )}
      </div>
    </div>
  )
}
