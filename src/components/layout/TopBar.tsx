'use client'

import { useRouter } from 'next/navigation'
import { Menu } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

interface TopBarProps {
  title: string
  onMenuClick: () => void
}

export function TopBar({ title, onMenuClick }: TopBarProps) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-4 gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onMenuClick}
          className="md:hidden p-1.5 -ml-1.5 text-slate-600 hover:text-slate-900"
          aria-label="Buka menu"
        >
          <Menu className="size-5" />
        </button>
        <h1 className="text-sm font-medium text-slate-700">{title}</h1>
      </div>
      <Button variant="ghost" size="sm" onClick={handleLogout}>
        Keluar
      </Button>
    </header>
  )
}
