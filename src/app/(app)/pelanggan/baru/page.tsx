import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/request-cache'
import { PelangganForm } from '@/components/pelanggan/PelangganForm'

export default async function PelangganBaruPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'owner') redirect('/pelanggan')

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Tambah Pelanggan Baru</h2>
      <PelangganForm />
    </div>
  )
}
