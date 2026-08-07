'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface RealtimeRefreshFilter {
  column: string
  value: string
}

export function useRealtimeRefresh(table: string, filter?: RealtimeRefreshFilter) {
  const router = useRouter()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    const channelName = filter ? `${table}-${filter.column}-${filter.value}` : `${table}-all`
    let channel: ReturnType<typeof supabase.channel> | null = null

    // The browser client stores the session in cookies (@supabase/ssr), which
    // does not automatically forward the JWT to the Realtime socket. Without
    // this, the socket joins as `anon`, and RLS silently drops every change
    // event for tables whose SELECT policy requires an authenticated role.
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) supabase.realtime.setAuth(session.access_token)
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      if (session?.access_token) supabase.realtime.setAuth(session.access_token)

      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table,
            ...(filter ? { filter: `${filter.column}=eq.${filter.value}` } : {}),
          },
          () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
            timeoutRef.current = setTimeout(() => router.refresh(), 300)
          }
        )
        .subscribe()
    }).catch((error) => {
      console.error(`[useRealtimeRefresh] failed to start session for ${channelName}:`, error)
    })

    return () => {
      cancelled = true
      authListener.subscription.unsubscribe()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (channel) supabase.removeChannel(channel)
    }
    // Depend on filter's *fields*, not the object. Callers pass an inline
    // literal (`filter={{ column: 'id', value: pesanan.id }}`), which is a new
    // identity every render — listing `filter` itself would tear down and
    // resubscribe the Realtime channel on every render. The fields are the only
    // parts read above, so this covers every real change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filter?.column, filter?.value, router])
}
