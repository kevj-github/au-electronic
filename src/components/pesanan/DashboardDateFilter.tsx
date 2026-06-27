'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function DashboardDateFilter() {
  const router = useRouter()
  const params = useSearchParams()
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''

  function apply(nextFrom: string, nextTo: string) {
    const p = new URLSearchParams()
    if (nextFrom) p.set('from', nextFrom)
    if (nextTo) p.set('to', nextTo)
    router.push(`/dashboard${p.size ? `?${p}` : ''}`)
  }

  function reset() {
    router.push('/dashboard')
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-muted-foreground">Periode:</span>
      <Input
        type="date"
        value={from}
        onChange={(e) => apply(e.target.value, to)}
        className="h-8 w-36 text-sm"
        aria-label="Dari tanggal"
      />
      <span className="text-sm text-muted-foreground">—</span>
      <Input
        type="date"
        value={to}
        onChange={(e) => apply(from, e.target.value)}
        className="h-8 w-36 text-sm"
        aria-label="Sampai tanggal"
      />
      {(from || to) && (
        <Button variant="ghost" size="sm" onClick={reset} className="h-8 text-xs">
          Reset
        </Button>
      )}
    </div>
  )
}
