import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatRupiah, hitungSaldo } from '@/lib/utils'
import { StatusBadge } from '@/components/pesanan/StatusBadge'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import type { User, Pesanan, ItemPesanan, Pembayaran } from '@/lib/types'

type PesananWithRelations = Pesanan & {
  items: Pick<ItemPesanan, 'subtotal'>[]
  pembayaran: Pick<Pembayaran, 'jumlah'>[]
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: user } = await supabase
    .from('users').select('role').eq('id', authUser.id).single<Pick<User, 'role'>>()
  if (user?.role !== 'owner') redirect('/pesanan')

  const today = new Date()
  const todayStart = new Date(today.setHours(0, 0, 0, 0)).toISOString()

  const [{ data: allPesanan }, { data: todayPesanan }] = await Promise.all([
    supabase
      .from('pesanan')
      .select(`*, pelanggan(nama), items:item_pesanan(subtotal), pembayaran(jumlah)`)
      .not('status', 'eq', 'dibatalkan')
      .order('created_at', { ascending: true })
      .returns<PesananWithRelations[]>(),
    supabase
      .from('pesanan')
      .select(`id`)
      .gte('created_at', todayStart)
      .not('status', 'eq', 'dibatalkan'),
  ])

  // Calculate piutang (outstanding)
  const piutangList = (allPesanan ?? [])
    .map((p) => {
      const totalPesanan = p.items.reduce((s, i) => s + i.subtotal, 0)
      const totalDibayar = p.pembayaran.reduce((s, pm) => s + pm.jumlah, 0)
      const { sisaTagihan } = hitungSaldo(totalPesanan, totalDibayar)
      return { ...p, totalPesanan, totalDibayar, sisaTagihan }
    })
    .filter((p) => p.sisaTagihan > 0)

  const totalPiutang = piutangList.reduce((s, p) => s + p.sisaTagihan, 0)

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Dashboard</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Pesanan Hari Ini</p>
          <p className="text-2xl font-semibold mt-1">{todayPesanan?.length ?? 0}</p>
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
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Kode</th>
                  <th className="text-left px-4 py-3 font-medium">Pelanggan</th>
                  <th className="text-left px-4 py-3 font-medium">Tanggal</th>
                  <th className="text-right px-4 py-3 font-medium">Total</th>
                  <th className="text-right px-4 py-3 font-medium">Sisa</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {piutangList.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/pesanan/${p.id}`}
                        className="font-mono text-blue-600 hover:underline"
                      >
                        {p.kode_pesanan}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {p.pelanggan?.nama ?? p.nama_pelanggan ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {format(new Date(p.created_at), 'd MMM yyyy', { locale: idLocale })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatRupiah(p.totalPesanan)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-red-600 font-medium">
                      {formatRupiah(p.sisaTagihan)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
