import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, getPesananLocked } from '@/lib/supabase/request-cache'

export const metadata: Metadata = { title: 'Pesanan' }
import { RealtimeRefresh } from '@/components/realtime/RealtimeRefresh'
import { OrderList, type PesananWithRelations } from '@/components/pesanan/OrderList'
import { Button } from '@/components/ui/button'
import { itemsEmbed, pembayaranEmbed } from '@/lib/pesanan-select'

/**
 * Upper bound on how many orders this page hydrates. PostgREST silently caps a
 * result set at 1000 rows, so an unbounded fetch would one day start dropping
 * the oldest orders with no error at all — at the current ~25 orders/week that
 * is roughly 9 months out. An explicit limit well under the cap, paired with the
 * exact count below, turns that silent loss into a visible "N dari M" notice.
 *
 * OrderList filters, searches and paginates client-side over whatever it is
 * given, so this is deliberately generous rather than a page size.
 */
const PESANAN_LIST_LIMIT = 500

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
  // Embed sources come from lib/pesanan-select — see the rules encoded there.
  const select = isOwner
    ? `*, pelanggan(nama, alamat), ${itemsEmbed(true, 'subtotal, diambil_oleh_helper')}, ${pembayaranEmbed('jumlah')}`
    : `id, kode_pesanan, nama_pelanggan, status, created_at, pelanggan(nama, alamat), ${itemsEmbed(false, 'diambil_oleh_helper')}`

  // `count: 'exact'` returns the true number of matching rows regardless of the
  // limit, so the header stays accurate even when the list is capped.
  let pesananQuery = supabase.from('pesanan').select(select, { count: 'exact' })

  if (!isOwner) {
    // Helpers always see all Diproses orders, across all dates — no date filter.
    pesananQuery = pesananQuery.eq('status', 'diproses')
  }

  const { data: pesananList, count: pesananCount } = await pesananQuery
    .order('created_at', { ascending: false })
    .limit(PESANAN_LIST_LIMIT)
    .returns<PesananWithRelations[]>()

  // The helper select above already omits tanggal_pengiriman, so nothing is
  // stripped here — this only fills the field the shared type requires.
  const visiblePesananList = isOwner
    ? (pesananList ?? [])
    : (pesananList ?? []).map((p) => ({ ...p, tanggal_pengiriman: null }))

  const totalPesanan = pesananCount ?? visiblePesananList.length
  const listTruncated = totalPesanan > visiblePesananList.length

  return (
    <div className="space-y-4">
      <RealtimeRefresh table="pesanan" />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Pesanan</h2>
          <p className="text-sm text-muted-foreground">
            {totalPesanan} pesanan
            {listTruncated &&
              ` — menampilkan ${visiblePesananList.length} terbaru`}
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
