import { Badge } from '@/components/ui/badge'
import type { StatusPesanan } from '@/lib/types'

const labelMap: Record<StatusPesanan, string> = {
  diproses: 'Diproses',
  selesai: 'Selesai',
  dibatalkan: 'Dibatalkan',
}

const variantMap: Record<StatusPesanan, 'default' | 'secondary' | 'destructive' | 'outline'> = {
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
