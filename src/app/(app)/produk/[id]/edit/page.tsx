import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProdukForm } from '@/components/produk/ProdukForm'
import type { Produk, User } from '@/lib/types'

export default async function EditProdukPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: user } = await supabase
    .from('users').select('role').eq('id', authUser.id).single<Pick<User, 'role'>>()
  if (user?.role !== 'owner') redirect('/pesanan')

  const { data: produk } = await supabase
    .from('produk').select('*').eq('id', id).single<Produk>()
  if (!produk) notFound()

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Edit Produk</h2>
      <ProdukForm produk={produk} />
    </div>
  )
}
