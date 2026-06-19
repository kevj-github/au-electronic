import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PelangganForm } from '@/components/pelanggan/PelangganForm'
import type { Pelanggan, User } from '@/lib/types'

export default async function EditPelangganPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')
  const { data: user } = await supabase
    .from('users').select('role').eq('id', authUser.id).single<Pick<User, 'role'>>()
  if (user?.role !== 'owner') redirect('/pelanggan')

  const { data: pelanggan } = await supabase
    .from('pelanggan').select('*').eq('id', id).single<Pelanggan>()
  if (!pelanggan) notFound()

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Edit Pelanggan</h2>
      <PelangganForm pelanggan={pelanggan} />
    </div>
  )
}
