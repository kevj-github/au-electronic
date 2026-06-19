import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProdukForm } from '@/components/produk/ProdukForm'
import type { User } from '@/lib/types'

export default async function ProdukBaruPage() {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: user } = await supabase
    .from('users').select('role').eq('id', authUser.id).single<Pick<User, 'role'>>()
  if (user?.role !== 'owner') redirect('/pesanan')

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Tambah Produk Baru</h2>
      <ProdukForm />
    </div>
  )
}
