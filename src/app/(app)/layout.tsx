import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { getCurrentUser, getPesananLocked } from '@/lib/supabase/request-cache'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, pesananLocked] = await Promise.all([
    getCurrentUser(),
    getPesananLocked(),
  ])

  if (!user) redirect('/login')

  return (
    <AppShell role={user.role} nama={user.nama} pesananLocked={pesananLocked}>
      {children}
    </AppShell>
  )
}
