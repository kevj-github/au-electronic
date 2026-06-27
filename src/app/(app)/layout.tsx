import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/layout/AppShell'
import type { User } from '@/lib/types'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) redirect('/login')

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single<User>()

  if (!user) redirect('/login')

  const { data: lockSetting } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'pesanan_locked')
    .single<{ value: string }>()
  const pesananLocked = lockSetting?.value === 'true'

  return (
    <AppShell role={user.role} nama={user.nama} pesananLocked={pesananLocked}>
      {children}
    </AppShell>
  )
}
