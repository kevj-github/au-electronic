import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Pelanggan' }
import { RealtimeRefresh } from '@/components/realtime/RealtimeRefresh'
import { PelangganList } from '@/components/pelanggan/PelangganList'
import { Button } from '@/components/ui/button'
import type { Pelanggan, User } from '@/lib/types'

export default async function PelangganPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: user } = await supabase
    .from('users').select('role').eq('id', authUser.id).single<Pick<User, 'role'>>()

  const { data: pelangganList } = await supabase
    .from('pelanggan')
    .select('*')
    .order('nama')
    .returns<Pelanggan[]>()

  const isOwner = user?.role === 'owner'

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
