'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

/**
 * Error boundary for the authenticated app routes. Server Components here
 * query Supabase directly, so a network blip or a DB error would otherwise
 * render Next's default unstyled error screen with no way back — bad on a
 * shop-floor tablet. This gives a readable message and a retry.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
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
      <Button onClick={reset}>Coba Lagi</Button>
    </div>
  )
}
