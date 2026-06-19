import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PelangganForm } from '@/components/pelanggan/PelangganForm'
import type { User } from '@/lib/types'

export default async function PelangganBaruPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')
  const { data: user } = await supabase
    .from('users').select('role').eq('id', authUser.id).single<Pick<User, 'role'>>()
  if (user?.role !== 'owner') redirect('/pelanggan')

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Tambah Pelanggan Baru</h2>
      <PelangganForm />
    </div>
  )
}
