'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ClipboardList, Users, LayoutDashboard, Settings, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/lib/types'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  roles: UserRole[]
}

const navItems: NavItem[] = [
  { href: '/pesanan', label: 'Pesanan', icon: ClipboardList, roles: ['owner', 'helper'] },
  { href: '/pelanggan', label: 'Pelanggan', icon: Users, roles: ['owner', 'helper'] },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['owner'] },
  { href: '/pengaturan', label: 'Pengaturan', icon: Settings, roles: ['owner'] },
]

interface SidebarProps {
  role: UserRole
  nama: string
  open: boolean
  onClose: () => void
}

export function Sidebar({ role, nama, open, onClose }: SidebarProps) {
  const pathname = usePathname()

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 bg-white border-r flex flex-col transition-transform duration-200 md:static md:translate-x-0 md:w-56',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm text-primary">AU Electronic</p>
            <p className="text-xs text-muted-foreground">{nama}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="md:hidden p-1 text-slate-500 hover:text-slate-900"
            aria-label="Tutup menu"
          >
            <X className="size-5" />
          </button>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems
            .filter((item) => item.roles.includes(role))
            .map((item) => {
              const Icon = item.icon
              const active = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-slate-600 hover:bg-slate-50'
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              )
            })}
        </nav>
      </aside>
    </>
  )
}
