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
  // Helpers get an explicit column allowlist rather than `*`: an unfetched
  // column can never reach the RSC payload, whereas `*` would ship catatan,
  // pengiriman, dibuat_oleh and tanggal_pengiriman to the browser even when the
  // UI hides them. Same defense-in-depth rule as the price columns — see the
  // per-role selects in `[id]/page.tsx`.
  const select = isOwner
    ? `*, pelanggan(nama, alamat), items:item_pesanan(subtotal, diambil_oleh_helper), pembayaran(jumlah)`
    : `id, kode_pesanan, nama_pelanggan, status, created_at, pelanggan(nama, alamat), items:item_pesanan(diambil_oleh_helper)`

  let pesananQuery = supabase.from('pesanan').select(select)

  if (!isOwner) {
    // Helpers always see all Diproses orders, across all dates — no date filter.
    pesananQuery = pesananQuery.eq('status', 'diproses')
  }

  const { data: pesananList } = await pesananQuery
    .order('created_at', { ascending: false })
    .returns<PesananWithRelations[]>()

  // The helper select above already omits tanggal_pengiriman, so nothing is
  // stripped here — this only fills the field the shared type requires.
  const visiblePesananList = isOwner
    ? (pesananList ?? [])
    : (pesananList ?? []).map((p) => ({ ...p, tanggal_pengiriman: null }))

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
      <OrderList pesananList={visiblePesananList} isOwner={isOwner} />
    </div>
  )
}
