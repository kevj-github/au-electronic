import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/request-cache'

export const metadata: Metadata = { title: 'Dashboard' }
import { RealtimeRefresh } from '@/components/realtime/RealtimeRefresh'
import { DashboardDateFilter } from '@/components/pesanan/DashboardDateFilter'
import { formatRupiah, hitungSaldo } from '@/lib/utils'
import { OrderList, type PesananWithRelations } from '@/components/pesanan/OrderList'

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

  const select = 'id, kode_pesanan, status, created_at, nama_pelanggan, catatan, pelanggan(nama), items:item_pesanan(subtotal, diambil_oleh_helper), pembayaran(jumlah)'

  // Both queries are independent — run them in parallel.
  const [{ data: allPesanan }, { data: periodPesanan }] = await Promise.all([
    supabase
      .from('pesanan')
      .select(select)
      .neq('status', 'dibatalkan')
      .order('created_at', { ascending: true })
      .returns<PesananWithRelations[]>(),
    supabase
      .from('pesanan')
      .select(select)
      .neq('status', 'dibatalkan')
      .gte('created_at', `${filterFrom}T00:00:00`)
      .lte('created_at', `${filterTo}T23:59:59`)
      .order('created_at', { ascending: false })
      .returns<PesananWithRelations[]>(),
  ])

  const periodList = periodPesanan ?? []
  const allList = allPesanan ?? []

  const periodCount = periodList.length
  const periodRevenue = periodList.reduce(
    (sum, p) => sum + p.items.reduce((s, i) => s + (i.subtotal ?? 0), 0),
    0
  )

  const piutangList = allList.filter((p) => {
    const totalPesanan = p.items.reduce((s, i) => s + (i.subtotal ?? 0), 0)
    const totalDibayar = (p.pembayaran ?? []).reduce((s, pm) => s + pm.jumlah, 0)
    return hitungSaldo(totalPesanan, totalDibayar).sisaTagihan > 0
  })

  const totalPiutang = piutangList.reduce((sum, p) => {
    const totalPesanan = p.items.reduce((s, i) => s + (i.subtotal ?? 0), 0)
    const totalDibayar = (p.pembayaran ?? []).reduce((s, pm) => s + pm.jumlah, 0)
    return sum + hitungSaldo(totalPesanan, totalDibayar).sisaTagihan
  }, 0)

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
          <p className="text-2xl font-semibold mt-1">{piutangList.length} pesanan</p>
        </div>
      </div>

      {/* Piutang list */}
      <div>
        <h3 className="font-medium mb-3">Tagihan Belum Lunas (terlama dulu)</h3>
        {piutangList.length === 0 ? (
          <p className="text-sm text-muted-foreground">Semua pesanan sudah lunas.</p>
        ) : (
          <OrderList pesananList={piutangList} isOwner />
        )}
      </div>
    </div>
  )
}
