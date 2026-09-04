'use client'

import { useState } from 'react'
import { Lock, Unlock } from 'lucide-react'
import { setPesananLocked } from '@/app/(app)/pengaturan/actions'
import { Button } from '@/components/ui/button'
import { setErrorFromResult } from '@/lib/action-result'
import { useOptimisticAction } from '@/hooks/use-optimistic-action'

interface PesananLockToggleProps {
  locked: boolean
}

export function PesananLockToggle({ locked: initialLocked }: PesananLockToggleProps) {
  // useOptimisticAction's render-phase prev-value compare also covers the
  // RealtimeRefresh resync usePropSyncedState used to handle here (mounted on
  // this page for the `users` table, pushing a fresh `locked` prop from
  // another device's toggle).
  const { value: locked, commit, loading } = useOptimisticAction(initialLocked, setPesananLocked)
  const [error, setError] = useState<string | null>(null)

  async function handleToggle() {
    setError(null)
    const result = await commit(!locked)
    setErrorFromResult(result, setError)
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
