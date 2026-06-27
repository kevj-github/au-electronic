'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function DashboardDateFilter() {
  const router = useRouter()
  const params = useSearchParams()

  // Local state avoids the race where each onChange pushes immediately and the
  // next push reads stale URL params for the other field.
  const [from, setFrom] = useState(params.get('from') ?? '')
  const [to, setTo] = useState(params.get('to') ?? '')

  function apply(nextFrom: string, nextTo: string) {
    const p = new URLSearchParams()
    if (nextFrom) p.set('from', nextFrom)
    if (nextTo) p.set('to', nextTo)
    router.push(`/dashboard${p.size ? `?${p}` : ''}`)
  }

  function reset() {
    setFrom('')
    setTo('')
    router.push('/dashboard')
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-muted-foreground">Periode:</span>
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          onBlur={(e) => apply(e.target.value, to)}
          className="h-8 w-36 text-sm"
          aria-label="Dari tanggal"
        />
        <span className="text-sm text-muted-foreground">—</span>
        <Input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          onBlur={(e) => apply(from, e.target.value)}
          className="h-8 w-36 text-sm"
          aria-label="Sampai tanggal"
        />
      </div>
      {(from || to) && (
        <Button variant="ghost" size="sm" onClick={reset} className="h-8 text-xs">
          Reset
        </Button>
      )}
    </div>
  )
}
