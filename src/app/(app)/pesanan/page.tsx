import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, getPesananLocked } from '@/lib/supabase/request-cache'

export const metadata: Metadata = { title: 'Pesanan' }
import { RealtimeRefresh } from '@/components/realtime/RealtimeRefresh'
import { OrderList, type PesananWithRelations } from '@/components/pesanan/OrderList'
import { HelperPesananFilter } from '@/components/pesanan/HelperPesananFilter'
import { Button } from '@/components/ui/button'

export default async function PesananPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const [user, pesananLocked, { from, to }] = await Promise.all([
    getCurrentUser(),
    getPesananLocked(),
    searchParams,
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
    // Helpers always see only Diproses orders; optionally filtered by date range.
    pesananQuery = pesananQuery.eq('status', 'diproses')
    if (from) pesananQuery = pesananQuery.gte('created_at', `${from}T00:00:00+07:00`)
    if (to) pesananQuery = pesananQuery.lte('created_at', `${to}T23:59:59+07:00`)
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
      {!isOwner && <HelperPesananFilter />}
      <OrderList pesananList={pesananList ?? []} isOwner={isOwner} />
    </div>
  )
}
