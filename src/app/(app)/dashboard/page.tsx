import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/request-cache'

export const metadata: Metadata = { title: 'Dashboard' }
import { RealtimeRefresh } from '@/components/realtime/RealtimeRefresh'
import { DashboardDateFilter } from '@/components/pesanan/DashboardDateFilter'
import { formatRupiah } from '@/lib/format'
import { OrderList } from '@/components/pesanan/OrderList'
// Server-render call site — see the note in components/pesanan/order-row.ts.
import { toOrderRows, type PesananWithRelations } from '@/components/pesanan/order-row'
import { itemsEmbed, pembayaranEmbed } from '@/lib/pesanan-select'

/**
 * Upper bound on how many unpaid orders the "Tagihan Belum Lunas" list hydrates.
 * Comfortably above the current count (~72) so nothing is hidden today, and far
 * below PostgREST's 1000-row cap so the query can never silently truncate. The
 * Belum Lunas tile always shows the true total, which is counted in SQL.
 */
const PIUTANG_LIST_LIMIT = 200

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'owner') redirect('/pesanan')

  const supabase = await createClient()
  const { from, to } = await searchParams

  const now = new Date()
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
  const filterFrom = from ?? defaultFrom
  const filterTo = to ?? defaultTo

  // This page is owner-only (redirect above), so the priced columns are read
  // through the owner-gated views — see lib/pesanan-select.
  const select = `id, kode_pesanan, status, created_at, nama_pelanggan, catatan, pelanggan(nama), ${itemsEmbed(true, 'subtotal, diambil_oleh_helper')}, ${pembayaranEmbed('jumlah')}`

  // The four stat tiles are aggregated in SQL rather than by fetching every
  // order and summing in JS. That fetch was unbounded, and PostgREST silently
  // caps a result set at 1000 rows — so past 1000 non-cancelled orders it would
  // have truncated without error and under-reported Total Piutang. A scalar sum
  // is immune to the row cap, and the payload no longer grows with the shop.
  const fromTs = `${filterFrom}T00:00:00`
  const toTs = `${filterTo}T23:59:59`

  const [{ data: summaryRows }, { data: unpaidRefs }] = await Promise.all([
    supabase.rpc('dashboard_summary', { p_from: fromTs, p_to: toTs }),
    supabase
      .from('pesanan_unpaid_owner')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(PIUTANG_LIST_LIMIT)
      .returns<{ id: string }[]>(),
  ])

  // Postgres numeric/bigint arrive as strings over PostgREST — coerce, don't
  // concatenate. Falling back to 0 keeps the tiles rendering if the RPC errors.
  const summary = summaryRows?.[0]
  const periodCount = Number(summary?.period_count ?? 0)
  const periodRevenue = Number(summary?.period_revenue ?? 0)
  const totalPiutang = Number(summary?.total_piutang ?? 0)
  const unpaidCount = Number(summary?.unpaid_count ?? 0)

  // Only the bounded slice of unpaid orders is hydrated with nested items, which
  // OrderList needs for the "n/m diambil" checklist badge.
  const unpaidIds = (unpaidRefs ?? []).map((r) => r.id)
  const { data: piutangPesanan } = unpaidIds.length
    ? await supabase
        .from('pesanan')
        .select(select)
        .in('id', unpaidIds)
        .order('created_at', { ascending: true })
        .returns<PesananWithRelations[]>()
    : { data: [] as PesananWithRelations[] }

  // Same server-side projection as /pesanan: the embedded items/pembayaran
  // collapse into row views here and never reach the browser.
  const piutangRows = toOrderRows(piutangPesanan ?? [], true)
  const piutangTruncated = unpaidCount > piutangRows.length

  const isDefaultPeriod = !from && !to

  return (
    <div className="space-y-6">
      <RealtimeRefresh table="pesanan" />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold">Dashboard</h2>
        <DashboardDateFilter />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">
            Pesanan {isDefaultPeriod ? 'Bulan Ini' : 'Periode'}
          </p>
          <p className="text-2xl font-semibold mt-1">{periodCount}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">
            Omzet {isDefaultPeriod ? 'Bulan Ini' : 'Periode'}
          </p>
          <p className="text-2xl font-semibold mt-1 text-blue-600">
            {formatRupiah(periodRevenue)}
          </p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Total Piutang</p>
          <p className="text-2xl font-semibold mt-1 text-red-600">
            {formatRupiah(totalPiutang)}
          </p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Belum Lunas</p>
          <p className="text-2xl font-semibold mt-1">{unpaidCount} pesanan</p>
        </div>
      </div>

      {/* Piutang list */}
      <div>
        <h3 className="font-medium mb-3">Tagihan Belum Lunas (terlama dulu)</h3>
        {piutangRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Semua pesanan sudah lunas.</p>
        ) : (
          <>
            {piutangTruncated && (
              <p className="text-sm text-muted-foreground mb-2">
                Menampilkan {piutangRows.length} tagihan terlama dari {unpaidCount}.
              </p>
            )}
            <OrderList rows={piutangRows} isOwner />
          </>
        )}
      </div>
    </div>
  )
}
