'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/lib/types'

interface NavItem {
  href: string
  label: string
  roles: UserRole[]
}

const navItems: NavItem[] = [
  { href: '/pesanan', label: 'Pesanan', roles: ['owner', 'helper'] },
  { href: '/pelanggan', label: 'Pelanggan', roles: ['owner', 'helper'] },
  { href: '/produk', label: 'Produk', roles: ['owner'] },
  { href: '/dashboard', label: 'Dashboard', roles: ['owner'] },
  { href: '/pengaturan', label: 'Pengaturan', roles: ['owner'] },
]

interface SidebarProps {
  role: UserRole
  nama: string
}

export function Sidebar({ role, nama }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="w-56 min-h-screen bg-white border-r flex flex-col">
      <div className="p-4 border-b">
        <p className="font-semibold text-sm">AU Electronic</p>
        <p className="text-xs text-muted-foreground">{nama}</p>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems
          .filter((item) => item.roles.includes(role))
          .map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'block px-3 py-2 rounded-md text-sm font-medium transition-colors',
                pathname === item.href || pathname.startsWith(item.href + '/')
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-600 hover:bg-slate-50'
              )}
            >
              {item.label}
            </Link>
          ))}
      </nav>
    </aside>
  )
}
