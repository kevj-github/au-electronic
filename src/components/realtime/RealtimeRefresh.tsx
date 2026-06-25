'use client'

import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh'

interface RealtimeRefreshProps {
  table: string
  filter?: { column: string; value: string }
}

export function RealtimeRefresh({ table, filter }: RealtimeRefreshProps) {
  useRealtimeRefresh(table, filter)
  return null
}
