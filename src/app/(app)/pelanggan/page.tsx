import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/request-cache'

export const metadata: Metadata = { title: 'Pelanggan' }
import { RealtimeRefresh } from '@/components/realtime/RealtimeRefresh'
import { PelangganList } from '@/components/pelanggan/PelangganList'
import { Button } from '@/components/ui/button'
import type { Pelanggan } from '@/lib/types'

export default async function PelangganPage() {
  const supabase = await createClient()

  // User check and pelanggan list are independent — run in parallel.
  const [user, { data: pelangganList }] = await Promise.all([
    getCurrentUser(),
    supabase.from('pelanggan').select('*').order('nama').returns<Pelanggan[]>(),
  ])
  if (!user) redirect('/login')
  if (user.role !== 'owner') redirect('/pesanan')

  const isOwner = user.role === 'owner'

  return (
    <div className="space-y-4">
      <RealtimeRefresh table="pelanggan" />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Pelanggan</h2>
          <p className="text-sm text-muted-foreground">
            {pelangganList?.length ?? 0} pelanggan terdaftar
          </p>
        </div>
        {isOwner && (
          <Link href="/pelanggan/baru">
            <Button>+ Tambah Pelanggan</Button>
          </Link>
        )}
      </div>
      <PelangganList pelangganList={pelangganList ?? []} isOwner={isOwner} />
    </div>
  )
}
