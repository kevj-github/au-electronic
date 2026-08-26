import { Skeleton } from '@/components/ui/skeleton'

export default function PesananBaruLoading() {
  return (
    <div className="space-y-4 max-w-3xl">
      <Skeleton className="h-6 w-32" />

      {/* Pelanggan */}
      <div className="border rounded-lg p-4 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-full" />
      </div>

      {/* Items */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-8 w-28" />
        </div>
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Catatan */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-20 w-full" />
      </div>

      {/* Tanggal pengiriman */}
      <div className="space-y-2 max-w-xs">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-full" />
      </div>

      <div className="flex gap-2">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-20" />
      </div>
    </div>
  )
}
