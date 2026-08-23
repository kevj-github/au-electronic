import { Skeleton } from '@/components/ui/skeleton'

export default function PengaturanLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-56" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-5 w-24" />
        <div className="border rounded-lg divide-y">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          ))}
        </div>
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-9 w-full sm:w-40" />
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-9 w-full sm:w-64" />
      </div>

      <div className="border rounded-lg p-4 space-y-4">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-9 w-44" />
        </div>
      </div>

      <div className="space-y-3">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    </div>
  )
}
