import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OrderForm } from '@/components/pesanan/OrderForm'
import { getCurrentUser, getPesananLocked } from '@/lib/supabase/request-cache'
import type { Pelanggan } from '@/lib/types'

export default async function PesananBaruPage() {
  const [user, pesananLocked] = await Promise.all([
    getCurrentUser(),
    getPesananLocked(),
  ])
  if (!user) redirect('/login')
  if (user.role === 'helper' && pesananLocked) redirect('/pesanan')

  const supabase = await createClient()
  const { data: pelangganList } = await supabase
    .from('pelanggan')
    .select('*')
    .order('nama')
    .returns<Pelanggan[]>()

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Pesanan Baru</h2>
      <OrderForm
        pelangganList={pelangganList ?? []}
        isOwner={user.role === 'owner'}
      />
    </div>
  )
}
