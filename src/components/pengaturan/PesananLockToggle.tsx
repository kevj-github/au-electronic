'use client'

import { useState } from 'react'
import { Lock, Unlock } from 'lucide-react'
import { setPesananLocked } from '@/app/(app)/pengaturan/actions'
import { Button } from '@/components/ui/button'
import { setErrorFromResult } from '@/lib/action-result'
import { usePropSyncedState } from '@/hooks/use-prop-synced-state'

interface PesananLockToggleProps {
  locked: boolean
}

export function PesananLockToggle({ locked: initialLocked }: PesananLockToggleProps) {
  // RealtimeRefresh (mounted on this page for the `users` table) can push a
  // fresh `locked` prop from another device's toggle — resync to it.
  const [locked, setLocked] = usePropSyncedState(initialLocked, (v) => v)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleToggle() {
    setLoading(true)
    setError(null)
    const next = !locked
    const result = await setPesananLocked(next)
    if (!setErrorFromResult(result, setError)) setLocked(next)
    setLoading(false)
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">Kunci Pembuatan Pesanan Baru</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {locked
            ? 'Helper tidak dapat membuat pesanan baru saat ini.'
            : 'Helper dapat membuat pesanan baru.'}
        </p>
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </div>
      <Button
        type="button"
        variant={locked ? 'outline' : 'destructive'}
        size="sm"
        onClick={handleToggle}
        disabled={loading}
        className="shrink-0"
      >
        {locked ? (
          <>
            <Unlock className="size-4 mr-1.5" />
            Buka Kunci
          </>
        ) : (
          <>
            <Lock className="size-4 mr-1.5" />
            Kunci
          </>
        )}
      </Button>
    </div>
  )
}
