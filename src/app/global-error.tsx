'use client'

import { useEffect } from 'react'

/**
 * Last-resort boundary: catches errors thrown by the root layout itself.
 * It replaces the whole document, so it must render its own <html>/<body>
 * and cannot rely on the app's providers or global styles being mounted.
 */
export default function GlobalError({
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
    <html lang="id">
      <body
        style={{
          minHeight: '100vh',
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '1rem',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>
          Terjadi kesalahan
        </h2>
        <p style={{ maxWidth: '28rem', fontSize: '0.875rem', color: '#666' }}>
          Aplikasi gagal dimuat. Coba muat ulang halaman.
        </p>
        {error.digest && (
          <p style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#666' }}>
            Kode: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.375rem',
            border: '1px solid #ccc',
            background: '#111',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Coba Lagi
        </button>
      </body>
    </html>
  )
}
