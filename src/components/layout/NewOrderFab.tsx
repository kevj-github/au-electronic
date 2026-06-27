'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus, Lock } from 'lucide-react'
import type { UserRole } from '@/lib/types'

interface NewOrderFabProps {
  role: UserRole
  pesananLocked: boolean
}

export function NewOrderFab({ role, pesananLocked }: NewOrderFabProps) {
  const pathname = usePathname()
  if (pathname === '/pesanan/baru') return null

  const isLockedForHelper = role === 'helper' && pesananLocked

  if (isLockedForHelper) {
    return (
      <div
        title="Pembuatan pesanan baru sedang dikunci oleh pemilik"
        className="fixed bottom-6 right-6 z-20 flex items-center gap-2 rounded-full bg-muted text-muted-foreground pl-4 pr-5 py-3 shadow-lg cursor-not-allowed select-none"
      >
        <Lock className="size-5" />
        <span className="text-sm font-medium">Pesanan Baru</span>
      </div>
    )
  }

  return (
    <Link
      href="/pesanan/baru"
      className="fixed bottom-6 right-6 z-20 flex items-center gap-2 rounded-full bg-primary text-primary-foreground pl-4 pr-5 py-3 shadow-lg hover:opacity-90 transition-opacity"
    >
      <Plus className="size-5" />
      <span className="text-sm font-medium">Pesanan Baru</span>
    </Link>
  )
}
