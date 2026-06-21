import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StatusBadge } from '@/components/pesanan/StatusBadge'
import { StatusTransitionButtons } from '@/components/pesanan/StatusTransitionButtons'
import { DocumentButtons } from '@/components/pesanan/DocumentButtons'
import type { InvoiceData } from '@/lib/invoice-data'
import { formatRupiah, hitungSaldo } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import type { Pesanan, ItemPesanan, Pembayaran, Produk, Pelanggan, User, StatusPesanan } from '@/lib/types'
import Link from 'next/link'

type PesananDetail = Omit<Pesanan, 'pelanggan' | 'items' | 'pembayaran'> & {
  pelanggan: Pelanggan | null
  items: (Omit<ItemPesanan, 'produk'> & { produk: Produk })[]
  pembayaran: Pembayaran[]
}

const statusTransitions: Record<StatusPesanan, StatusPesanan[]> = {
  draft: ['konfirmasi', 'dibatalkan'],
  konfirmasi: ['diproses', 'dibatalkan'],
  diproses: ['selesai', 'dibatalkan'],
  selesai: [],
  dibatalkan: [],
}

const statusLabel: Record<StatusPesanan, string> = {
  draft: 'Draft',
  konfirmasi: 'Konfirmasi',
  diproses: 'Proses',
  selesai: 'Selesai',
  dibatalkan: 'Batalkan',
}

export default async function PesananDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [{ data: user }, { data: pesanan }] = await Promise.all([
    supabase.from('users').select('role').eq('id', authUser.id).single<Pick<User, 'role'>>(),
    supabase
      .from('pesanan')
      .select(`*, pelanggan(*), items:item_pesanan(*, produk(*)), pembayaran(*)`)
      .eq('id', id)
      .single<PesananDetail>(),
  ])

  if (!pesanan) notFound()

  const isOwner = user?.role === 'owner'
  const totalPesanan = pesanan.items.reduce((s, i) => s + i.subtotal, 0)
  const totalDibayar = pesanan.pembayaran.reduce((s, p) => s + p.jumlah, 0)
  const { sisaTagihan } = hitungSaldo(totalPesanan, totalDibayar)
  const nextStatuses = statusTransitions[pesanan.status] ?? []

  const invoiceData: InvoiceData = {
    kodePesanan: pesanan.kode_pesanan,
    tanggal: pesanan.created_at,
    namaPelanggan: pesanan.pelanggan?.nama ?? pesanan.nama_pelanggan ?? '—',
    alamatPelanggan: pesanan.pelanggan?.alamat ?? undefined,
    tipeDokumen: pesanan.tipe_dokumen,
    items: pesanan.items.map((i) => ({
      namaProduk: i.produk.nama,
      qty: i.qty,
      satuan: i.produk.satuan,
      hargaSatuan: i.harga_satuan,
      subtotal: i.subtotal,
    })),
    totalPesanan,
    totalDibayar,
    sisaTagihan,
    catatan: pesanan.catatan,
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold font-mono">{pesanan.kode_pesanan}</h2>
            <StatusBadge status={pesanan.status} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {format(new Date(pesanan.created_at), 'd MMMM yyyy', { locale: idLocale })}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <DocumentButtons data={invoiceData} />
          {/* Status transitions — owner only */}
          {isOwner && (
            <StatusTransitionButtons
              pesananId={pesanan.id}
              nextStatuses={nextStatuses}
              statusLabel={statusLabel}
            />
          )}
        </div>
      </div>

      {/* Pelanggan */}
      <div className="border rounded-lg p-4 space-y-1">
        <p className="text-sm font-medium text-muted-foreground">Pelanggan</p>
        <p className="font-medium">
          {pesanan.pelanggan?.nama ?? pesanan.nama_pelanggan ?? '—'}
        </p>
        {pesanan.pelanggan?.telepon && (
          <p className="text-sm text-muted-foreground">{pesanan.pelanggan.telepon}</p>
        )}
        <Badge variant="outline">
          {pesanan.tipe_dokumen === 'invoice' ? 'Invoice (B2B)' : 'Nota (B2C)'}
        </Badge>
      </div>

      {/* Line items */}
      <div>
        <h3 className="font-medium mb-3">Item Pesanan</h3>
        <table className="w-full text-sm border rounded-lg overflow-hidden">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Produk</th>
              <th className="text-right px-4 py-2 font-medium">Qty</th>
              <th className="text-right px-4 py-2 font-medium">Harga</th>
              <th className="text-right px-4 py-2 font-medium">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pesanan.items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-2">{item.produk.nama}</td>
                <td className="px-4 py-2 text-right">
                  {item.qty} {item.produk.satuan}
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  {formatRupiah(item.harga_satuan)}
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  {formatRupiah(item.subtotal)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t bg-gray-50">
            <tr>
              <td colSpan={3} className="px-4 py-2 text-right font-medium">Total</td>
              <td className="px-4 py-2 text-right font-mono font-semibold">
                {formatRupiah(totalPesanan)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Payment summary */}
      <div className="border rounded-lg p-4 space-y-2">
        <h3 className="font-medium">Pembayaran</h3>
        {pesanan.pembayaran.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada pembayaran.</p>
        ) : (
          <div className="space-y-1">
            {pesanan.pembayaran.map((p) => (
              <div key={p.id} className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {format(new Date(p.dibayar_pada), 'd MMM yyyy', { locale: idLocale })} ·{' '}
                  {p.metode}
                </span>
                <span className="font-mono">{formatRupiah(p.jumlah)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="border-t pt-2 flex justify-between font-medium">
          <span>Sisa Tagihan</span>
          <span className={sisaTagihan === 0 ? 'text-green-600' : 'font-mono'}>
            {sisaTagihan === 0 ? 'Lunas' : formatRupiah(sisaTagihan)}
          </span>
        </div>
        {/* Payment recording — Plan 4. Placeholder note. */}
        {isOwner && sisaTagihan > 0 && (
          <p className="text-xs text-muted-foreground">
            Pencatatan pembayaran tersedia di Plan 4.
          </p>
        )}
      </div>

      {/* Notes */}
      {pesanan.catatan && (
        <div className="border rounded-lg p-4">
          <p className="text-sm font-medium text-muted-foreground mb-1">Catatan</p>
          <p className="text-sm">{pesanan.catatan}</p>
        </div>
      )}

      <div className="flex gap-2">
        <Link href="/pesanan">
          <Button variant="outline">← Kembali</Button>
        </Link>
      </div>
    </div>
  )
}
