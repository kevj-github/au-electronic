'use client'

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { NewOrderFab } from './NewOrderFab'
import type { UserRole } from '@/lib/types'

interface AppShellProps {
  role: UserRole
  nama: string
  pesananLocked: boolean
  children: React.ReactNode
}

export function AppShell({ role, nama, pesananLocked, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar role={role} nama={nama} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar title="AU Electronic" onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 pb-24 sm:pb-6">{children}</main>
      </div>
      <NewOrderFab role={role} pesananLocked={pesananLocked} />
    </div>
  )
}
