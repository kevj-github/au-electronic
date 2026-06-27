import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { RealtimeRefresh } from '@/components/realtime/RealtimeRefresh'
import { OrderList, type PesananWithRelations } from '@/components/pesanan/OrderList'
import { Button } from '@/components/ui/button'
import type { User } from '@/lib/types'

export default async function PesananPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [{ data: user }, { data: lockSetting }] = await Promise.all([
    supabase.from('users').select('role').eq('id', authUser.id).single<Pick<User, 'role'>>(),
    supabase.from('settings').select('value').eq('key', 'pesanan_locked').single<{ value: string }>(),
  ])
  const isOwner = user?.role === 'owner'
  const pesananLocked = !isOwner && lockSetting?.value === 'true'

  // Helpers never get price/payment data fetched into the RSC payload at all.
  const select = isOwner
    ? `*, pelanggan(nama), items:item_pesanan(subtotal, diambil_oleh_helper), pembayaran(jumlah)`
    : `*, pelanggan(nama), items:item_pesanan(diambil_oleh_helper)`

  const { data: pesananList } = await supabase
    .from('pesanan')
    .select(select)
    .order('created_at', { ascending: false })
    .returns<PesananWithRelations[]>()

  return (
    <div className="space-y-4">
      <RealtimeRefresh table="pesanan" />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Pesanan</h2>
          <p className="text-sm text-muted-foreground">
            {pesananList?.length ?? 0} pesanan
          </p>
        </div>
        {!pesananLocked && (
          <Link href="/pesanan/baru">
            <Button>+ Pesanan Baru</Button>
          </Link>
        )}
      </div>
      <OrderList pesananList={pesananList ?? []} isOwner={isOwner} />
    </div>
  )
}
