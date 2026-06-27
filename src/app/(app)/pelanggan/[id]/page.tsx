import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/request-cache'
import { PelangganForm } from '@/components/pelanggan/PelangganForm'
import type { Pelanggan } from '@/lib/types'

export default async function EditPelangganPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // Auth check and pelanggan fetch are independent — run in parallel.
  const [user, { data: pelanggan }] = await Promise.all([
    getCurrentUser(),
    supabase.from('pelanggan').select('*').eq('id', id).single<Pelanggan>(),
  ])
  if (!user) redirect('/login')
  if (user.role !== 'owner') redirect('/pelanggan')
  if (!pelanggan) notFound()

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Edit Pelanggan</h2>
      <PelangganForm pelanggan={pelanggan} />
    </div>
  )
}
