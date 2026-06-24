'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus } from 'lucide-react'

export function NewOrderFab() {
  const pathname = usePathname()
  if (pathname === '/pesanan/baru') return null

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
