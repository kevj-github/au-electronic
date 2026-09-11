'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Menu } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from './ThemeToggle'

interface TopBarProps {
  title: string
  onMenuClick: () => void
}

export function TopBar({ title, onMenuClick }: TopBarProps) {
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('[TopBar] failed to sign out:', error)
      setLoggingOut(false)
    }
  }

  return (
    <header className="h-14 border-b bg-sidebar flex items-center justify-between px-4 gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onMenuClick}
          className="md:hidden p-1.5 -ml-1.5 rounded-md border border-transparent text-muted-foreground outline-none hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label="Buka menu"
        >
          <Menu className="size-5" />
        </button>
        <h1 className="text-sm font-medium text-foreground">{title}</h1>
      </div>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <Button variant="ghost" size="sm" onClick={handleLogout} disabled={loggingOut}>
          {loggingOut ? 'Keluar...' : 'Keluar'}
        </Button>
      </div>
    </header>
  )
}
