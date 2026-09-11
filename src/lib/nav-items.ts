import { ClipboardList, Users, LayoutDashboard, Settings } from 'lucide-react'
import { isActiveRoute } from '@/lib/utils'
import type { UserRole } from '@/lib/types'

export interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  roles: UserRole[]
}

export const navItems: NavItem[] = [
  { href: '/pesanan', label: 'Pesanan', icon: ClipboardList, roles: ['owner', 'helper'] },
  { href: '/pelanggan', label: 'Pelanggan', icon: Users, roles: ['owner'] },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['owner'] },
  { href: '/pengaturan', label: 'Pengaturan', icon: Settings, roles: ['owner'] },
]

/** Label of the nav item whose href matches `pathname`, or `fallback` if none does. */
export function getSectionTitle(pathname: string, fallback = 'AU Electronic'): string {
  return navItems.find((item) => isActiveRoute(pathname, item.href))?.label ?? fallback
}
