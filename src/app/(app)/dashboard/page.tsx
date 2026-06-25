import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RealtimeRefresh } from '@/components/realtime/RealtimeRefresh'
import { formatRupiah, hitungSaldo } from '@/lib/utils'
import { OrderList, type PesananWithRelations } from '@/components/pesanan/OrderList'
import type { User } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: user } = await supabase
    .from('users').select('role').eq('id', authUser.id).single<Pick<User, 'role'>>()
  if (user?.role !== 'owner') redirect('/pesanan')

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStart = today.toISOString()

  const { data: allPesanan } = await supabase
    .from('pesanan')
    .select(`*, pelanggan(nama), items:item_pesanan(subtotal, diambil_oleh_helper), pembayaran(jumlah)`)
    .neq('status', 'dibatalkan')
    .order('created_at', { ascending: true })
    .returns<PesananWithRelations[]>()

  const todayCount = (allPesanan ?? []).filter((p) => p.created_at >= todayStart).length

  const piutangList = (allPesanan ?? []).filter((p) => {
    const totalPesanan = p.items.reduce((s, i) => s + (i.subtotal ?? 0), 0)
    const totalDibayar = (p.pembayaran ?? []).reduce((s, pm) => s + pm.jumlah, 0)
    return hitungSaldo(totalPesanan, totalDibayar).sisaTagihan > 0
  })

  const totalPiutang = piutangList.reduce((sum, p) => {
    const totalPesanan = p.items.reduce((s, i) => s + (i.subtotal ?? 0), 0)
    const totalDibayar = (p.pembayaran ?? []).reduce((s, pm) => s + pm.jumlah, 0)
    return sum + hitungSaldo(totalPesanan, totalDibayar).sisaTagihan
  }, 0)

  return (
    <div className="space-y-6">
      <RealtimeRefresh table="pesanan" />
      <h2 className="text-lg font-semibold">Dashboard</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Pesanan Hari Ini</p>
          <p className="text-2xl font-semibold mt-1">{todayCount}</p>
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
