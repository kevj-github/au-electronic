import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OrderForm } from '@/components/pesanan/OrderForm'
import type { Pelanggan, Produk, User } from '@/lib/types'

export default async function PesananBaruPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [{ data: user }, { data: pelangganList }, { data: produkList }] =
    await Promise.all([
      supabase.from('users').select('role').eq('id', authUser.id).single<Pick<User, 'role'>>(),
      supabase.from('pelanggan').select('*').order('nama').returns<Pelanggan[]>(),
      supabase.from('produk').select('*').eq('aktif', true).order('nama').returns<Produk[]>(),
    ])

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Pesanan Baru</h2>
      <OrderForm
        pelangganList={pelangganList ?? []}
        produkList={produkList ?? []}
        isOwner={user?.role === 'owner'}
      />
    </div>
  )
}
