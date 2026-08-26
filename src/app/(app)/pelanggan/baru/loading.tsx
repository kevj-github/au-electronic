import { Skeleton } from '@/components/ui/skeleton'

export default function PelangganBaruLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-48" />

      <div className="space-y-4 max-w-md">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
    </div>
  )
}
