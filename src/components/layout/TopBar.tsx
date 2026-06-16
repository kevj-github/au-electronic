'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

interface TopBarProps {
  title: string
}

export function TopBar({ title }: TopBarProps) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-4">
      <h1 className="text-sm font-medium text-slate-700">{title}</h1>
      <Button variant="ghost" size="sm" onClick={handleLogout}>
        Keluar
      </Button>
    </header>
  )
}
