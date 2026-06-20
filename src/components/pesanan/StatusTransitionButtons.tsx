'use client'

import { useState } from 'react'
import { updateStatusPesanan } from '@/app/(app)/pesanan/actions'
import { Button } from '@/components/ui/button'
import type { StatusPesanan } from '@/lib/types'

interface StatusTransitionButtonsProps {
  pesananId: string
  nextStatuses: StatusPesanan[]
  statusLabel: Record<StatusPesanan, string>
}

export function StatusTransitionButtons({
  pesananId,
  nextStatuses,
  statusLabel,
}: StatusTransitionButtonsProps) {
  const [error, setError] = useState<string | null>(null)

  async function handleUpdateStatus(status: StatusPesanan) {
    setError(null)
    const result = await updateStatusPesanan(pesananId, status)
    if (result?.error) {
      setError(result.error)
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        {nextStatuses.map((next) => (
          <Button
            key={next}
            type="button"
            variant={next === 'dibatalkan' ? 'destructive' : 'default'}
            size="sm"
            onClick={() => handleUpdateStatus(next)}
          >
            {statusLabel[next]}
          </Button>
        ))}
      </div>
      {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
    </div>
  )
}
