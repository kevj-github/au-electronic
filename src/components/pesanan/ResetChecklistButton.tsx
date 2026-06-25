'use client'

import { useState } from 'react'
import { resetChecklist } from '@/app/(app)/pesanan/actions'
import { Button } from '@/components/ui/button'

interface ResetChecklistButtonProps {
  pesananId: string
  target: 'helper' | 'owner'
  confirmLabel: string
}

export function ResetChecklistButton({ pesananId, target, confirmLabel }: ResetChecklistButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleReset() {
    if (!window.confirm(confirmLabel)) return
    setLoading(true)
    setError(null)
    const result = await resetChecklist(pesananId, target)
    if (result?.error) setError(result.error)
    setLoading(false)
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button type="button" variant="ghost" size="sm" onClick={handleReset} disabled={loading}>
        Reset
      </Button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </span>
  )
}
