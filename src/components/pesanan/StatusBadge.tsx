import { Badge } from '@/components/ui/badge'
import type { StatusPesanan } from '@/lib/types'

const labelMap: Record<StatusPesanan, string> = {
  draft: 'Draft',
  konfirmasi: 'Dikonfirmasi',
  diproses: 'Diproses',
  selesai: 'Selesai',
  dibatalkan: 'Dibatalkan',
}

const variantMap: Record<StatusPesanan, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  konfirmasi: 'default',
  diproses: 'default',
  selesai: 'secondary',
  dibatalkan: 'destructive',
}

export function StatusBadge({ status }: { status: StatusPesanan }) {
  return (
    <Badge variant={variantMap[status]}>
      {labelMap[status]}
    </Badge>
  )
}
