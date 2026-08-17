import { Skeleton } from '@/components/ui/skeleton'

const PLACEHOLDER_ROWS = 5

/**
 * Route-level fallback for /pesanan, shown while the Server Component awaits
 * Supabase. It replaces the generic app-wide spinner in `(app)/loading.tsx`
 * with the shape of the list that is about to arrive, so the page does not
 * reflow from "centred spinner" to "table" once the data lands.
 *
 * Deliberately role-neutral. `loading.tsx` renders before any query resolves,
 * so it cannot know whether the viewer is an owner or a helper — it draws only
 * the chrome both roles get (heading + list), never the owner-only filter bar.
 * Sketching controls a helper will never see would be a worse lie than the
 * small upward shift an owner gets when the real filters mount.
 *
 * Mirrors OrderList's two layouts: a card list under `sm`, a table above it.
 */
export default function PesananLoading() {
  return (
    <div className="space-y-4" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Memuat daftar pesanan…</span>

      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Mobile: card list */}
      <div className="space-y-2 sm:hidden">
        {Array.from({ length: PLACEHOLDER_ROWS }, (_, i) => (
          <div key={i} className="border rounded-lg p-3 space-y-2">
            <div className="flex justify-between items-start gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-40" />
            <div className="flex justify-between items-center pt-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block border rounded-lg overflow-hidden">
        <div className="bg-gray-50 border-b px-4 py-3">
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="divide-y">
          {Array.from({ length: PLACEHOLDER_ROWS }, (_, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-4">
              <Skeleton className="h-4 w-36 shrink-0" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-24 shrink-0" />
              <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
