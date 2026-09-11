'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { NewOrderFab } from './NewOrderFab'
import { getSectionTitle } from '@/lib/nav-items'
import type { UserRole } from '@/lib/types'

interface AppShellProps {
  role: UserRole
  nama: string
  pesananLocked: boolean
  children: React.ReactNode
}

export function AppShell({ role, nama, pesananLocked, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  return (
    <div className="flex min-h-screen bg-muted">
      <Sidebar role={role} nama={nama} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar title={getSectionTitle(pathname)} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 pb-24 sm:pb-6">{children}</main>
      </div>
      <NewOrderFab role={role} pesananLocked={pesananLocked} />
    </div>
  )
}
