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

  if (user.role !== 'owner' && pesananLocked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold">Sistem Terkunci</h1>
          <p className="text-muted-foreground text-sm">
            Pemilik telah mengunci akses. Hubungi pemilik untuk membuka kunci.
          </p>
        </div>
      </div>
    )
  }

  return (
    <AppShell role={user.role} nama={user.nama} pesananLocked={pesananLocked}>
      {children}
    </AppShell>
  )
}
