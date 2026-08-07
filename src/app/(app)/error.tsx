'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

/**
 * Error boundary for the authenticated app routes. Server Components here
 * query Supabase directly, so a network blip or a DB error would otherwise
 * render Next's default unstyled error screen with no way back — bad on a
 * shop-floor tablet. This gives a readable message and a retry.
 *
 * `unstable_retry` (Next 16.2+), not `reset`: the failure we recover from is a
 * failed Supabase query in a Server Component, and only `unstable_retry`
 * refetches. `reset` just clears the boundary's error state and re-renders the
 * same already-failed RSC payload, so the button would appear to do nothing.
 */
export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 px-4 text-center">
      <h2 className="text-lg font-semibold">Terjadi kesalahan</h2>
      <p className="text-muted-foreground max-w-md text-sm">
        Data gagal dimuat. Periksa koneksi internet Anda, lalu coba lagi.
      </p>
      {error.digest && (
        <p className="text-muted-foreground font-mono text-xs">
          Kode: {error.digest}
        </p>
      )}
      <Button onClick={() => unstable_retry()}>Coba Lagi</Button>
    </div>
  )
}
