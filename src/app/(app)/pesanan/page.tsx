import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, getPesananLocked } from '@/lib/supabase/request-cache'

export const metadata: Metadata = { title: 'Pesanan' }
import { RealtimeRefresh } from '@/components/realtime/RealtimeRefresh'
import { OrderList, type PesananWithRelations } from '@/components/pesanan/OrderList'
import { Button } from '@/components/ui/button'

export default async function PesananPage() {
  const [user, pesananLocked] = await Promise.all([
    getCurrentUser(),
    getPesananLocked(),
  ])
  if (!user) redirect('/login')

  const isOwner = user.role === 'owner'
  const isLocked = !isOwner && pesananLocked

  const supabase = await createClient()
  const select = isOwner
    ? `*, pelanggan(nama), items:item_pesanan(subtotal, diambil_oleh_helper), pembayaran(jumlah)`
    : `*, pelanggan(nama), items:item_pesanan(diambil_oleh_helper)`

  let pesananQuery = supabase.from('pesanan').select(select)

  if (!isOwner) {
    // Helpers only see today's orders (WIB = UTC+7)
    const nowUtc = new Date()
    const wibNow = new Date(nowUtc.getTime() + 7 * 60 * 60 * 1000)
    const todayWib = wibNow.toISOString().slice(0, 10) // YYYY-MM-DD
    pesananQuery = pesananQuery.gte('created_at', `${todayWib}T00:00:00+07:00`)
  }

  const { data: pesananList } = await pesananQuery
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
        {!isLocked && (
          <Link href="/pesanan/baru">
            <Button>+ Pesanan Baru</Button>
          </Link>
        )}
      </div>
      <OrderList pesananList={pesananList ?? []} isOwner={isOwner} />
    </div>
  )
}
