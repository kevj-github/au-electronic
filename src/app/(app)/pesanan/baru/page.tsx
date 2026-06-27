import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OrderForm } from '@/components/pesanan/OrderForm'
import type { Pelanggan, User } from '@/lib/types'

export default async function PesananBaruPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [{ data: user }, { data: pelangganList }, { data: lockSetting }] = await Promise.all([
    supabase.from('users').select('role').eq('id', authUser.id).single<Pick<User, 'role'>>(),
    supabase.from('pelanggan').select('*').order('nama').returns<Pelanggan[]>(),
    supabase.from('settings').select('value').eq('key', 'pesanan_locked').single<{ value: string }>(),
  ])

  if (user?.role === 'helper' && lockSetting?.value === 'true') {
    redirect('/pesanan')
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Pesanan Baru</h2>
      <OrderForm
        pelangganList={pelangganList ?? []}
        isOwner={user?.role === 'owner'}
      />
    </div>
  )
}
