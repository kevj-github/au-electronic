import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RealtimeRefresh } from '@/components/realtime/RealtimeRefresh'
import { StatusBadge } from '@/components/pesanan/StatusBadge'
import { StatusTransitionButtons } from '@/components/pesanan/StatusTransitionButtons'
import { DocumentButtons } from '@/components/pesanan/DocumentButtons'
import { PaymentModal } from '@/components/pesanan/PaymentModal'
import { DeletePaymentButton } from '@/components/pesanan/DeletePaymentButton'
import { ItemsSection } from '@/components/pesanan/ItemsSection'
import { BulkPriceForm } from '@/components/pesanan/BulkPriceForm'
import { ResetChecklistButton } from '@/components/pesanan/ResetChecklistButton'
import type { InvoiceData } from '@/lib/invoice-data'
import { formatRupiah, hitungSaldo } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import type { Pesanan, ItemPesanan, Pembayaran, Pelanggan, User, StatusPesanan } from '@/lib/types'
import Link from 'next/link'

type HelperItem = Pick<ItemPesanan, 'id' | 'nama_barang' | 'qty' | 'catatan_item' | 'diambil_oleh_helper'>
type OwnerItem = ItemPesanan

type PesananDetail = Omit<Pesanan, 'pelanggan' | 'items' | 'pembayaran'> & {
  pelanggan: Pelanggan | null
  items: HelperItem[] | OwnerItem[]
  pembayaran: Pembayaran[]
}

const statusTransitions: Record<StatusPesanan, StatusPesanan[]> = {
  diproses: ['selesai', 'dibatalkan'],
  selesai: [],
  dibatalkan: [],
}

const statusLabel: Record<StatusPesanan, string> = {
  diproses: 'Diproses',
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

  const { data: user } = await supabase
    .from('users').select('role').eq('id', authUser.id).single<Pick<User, 'role'>>()
  const isOwner = user?.role === 'owner'

  // Helpers never get price/payment data fetched into the RSC payload at all —
  // not just hidden in the UI. requireOwner/RLS still back this up server-side.
  const itemsSelect = isOwner
    ? 'id, nama_barang, qty, harga_satuan, diskon, subtotal, catatan_item, diambil_oleh_helper, dicek_oleh_owner'
    : 'id, nama_barang, qty, catatan_item, diambil_oleh_helper'
  const pesananSelect = isOwner
    ? `*, pelanggan(*), items:item_pesanan(${itemsSelect}), pembayaran(*)`
    : `*, pelanggan(*), items:item_pesanan(${itemsSelect})`

  const { data: pesanan } = await supabase
    .from('pesanan')
    .select(pesananSelect)
    .eq('id', id)
    .single<PesananDetail>()

  if (!pesanan) notFound()

  const isLocked = pesanan.status !== 'diproses'
  const ownerItems = isOwner ? (pesanan.items as OwnerItem[]) : []
  const pembayaranList = pesanan.pembayaran ?? []
  const totalPesanan = ownerItems.reduce((s, i) => s + i.subtotal, 0)
  const totalDibayar = pembayaranList.reduce((s, p) => s + p.jumlah, 0)
  const { sisaTagihan } = hitungSaldo(totalPesanan, totalDibayar)
  const nextStatuses = statusTransitions[pesanan.status] ?? []

  const diambilCount = pesanan.items.filter((i) => i.diambil_oleh_helper).length
  const dicekCount = ownerItems.filter((i) => i.dicek_oleh_owner).length
  const totalItems = pesanan.items.length

  const invoiceData: InvoiceData | null = isOwner
    ? {
        kodePesanan: pesanan.kode_pesanan,
        tanggal: pesanan.created_at,
        namaPelanggan: pesanan.pelanggan?.nama ?? pesanan.nama_pelanggan ?? '—',
        alamatPelanggan: pesanan.pelanggan?.alamat ?? undefined,
        items: ownerItems.map((i) => ({
          namaBarang: i.nama_barang,
          qty: i.qty,
          hargaSatuan: i.harga_satuan,
          subtotal: i.subtotal,
        })),
        totalPesanan,
        totalDibayar,
        sisaTagihan,
        catatan: pesanan.catatan,
      }
    : null

  // Items passed to client components — no price data for helpers
  const sectionItems = pesanan.items.map((item) => {
    if (isOwner) {
      const o = item as OwnerItem
      return {
        id: o.id,
        nama_barang: o.nama_barang,
        qty: o.qty,
        catatan_item: o.catatan_item,
        diambil_oleh_helper: o.diambil_oleh_helper,
        dicek_oleh_owner: o.dicek_oleh_owner,
      }
    }
    return {
      id: item.id,
      nama_barang: item.nama_barang,
      qty: item.qty,
      catatan_item: item.catatan_item,
      diambil_oleh_helper: item.diambil_oleh_helper,
    }
  })

  return (
    <div className="space-y-6 max-w-3xl">
      <RealtimeRefresh table="pesanan" filter={{ column: 'id', value: pesanan.id }} />

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
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
          {isOwner && invoiceData && <DocumentButtons data={invoiceData} />}
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
      </div>

      {/* Line items */}
      <div className="space-y-3">
        <h3 className="font-medium">Item Pesanan</h3>

        <div className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">
              {diambilCount}/{totalItems} diambil dari etalase
            </span>
            {!isLocked && (
              <ResetChecklistButton
                pesananId={pesanan.id}
                target="helper"
                label="Reset Diambil"
                confirmTitle="Reset checklist pengambilan?"
                confirmDescription="Semua tanda centang pengambilan dari etalase akan dihapus."
              />
            )}
          </div>
          {isOwner && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">
                {dicekCount}/{totalItems} dicek pemilik
              </span>
              {!isLocked && (
                <ResetChecklistButton
                  pesananId={pesanan.id}
                  target="owner"
                  label="Reset Dicek"
                  confirmTitle="Reset checklist pemeriksaan pemilik?"
                  confirmDescription="Semua tanda centang pemeriksaan pemilik akan dihapus."
                />
              )}
            </div>
          )}
        </div>

        <ItemsSection
          pesananId={pesanan.id}
          items={sectionItems}
          isOwner={isOwner}
          isLocked={isLocked}
        />
      </div>

      {/* Bulk price editor — owner only, active orders only */}
      {isOwner && !isLocked && (
        <BulkPriceForm
          pesananId={pesanan.id}
          items={ownerItems.map((i) => ({
            id: i.id,
            nama_barang: i.nama_barang,
            qty: i.qty,
            harga_satuan: i.harga_satuan,
            diskon: i.diskon,
          }))}
        />
      )}

      {/* Price summary for owner on locked orders */}
      {isOwner && isLocked && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Barang</th>
                <th className="text-right px-4 py-2 font-medium">Qty</th>
                <th className="text-right px-4 py-2 font-medium">Harga</th>
                <th className="text-right px-4 py-2 font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {ownerItems.map((i) => (
                <tr key={i.id}>
                  <td className="px-4 py-2">{i.nama_barang}</td>
                  <td className="px-4 py-2 text-right">{i.qty}</td>
                  <td className="px-4 py-2 text-right font-mono">{formatRupiah(i.harga_satuan)}</td>
                  <td className="px-4 py-2 text-right font-mono">{formatRupiah(i.subtotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t bg-gray-50">
              <tr>
                <td colSpan={3} className="px-4 py-2 text-right font-medium">Total</td>
                <td className="px-4 py-2 text-right font-mono font-semibold">{formatRupiah(totalPesanan)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Payment recording — owner only */}
      {isOwner && (
        <div className="border rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Pembayaran</h3>
            {sisaTagihan > 0 && (
              <PaymentModal pesananId={pesanan.id} sisaTagihan={sisaTagihan} />
            )}
          </div>
          {pembayaranList.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada pembayaran.</p>
          ) : (
            <div className="space-y-1">
              {pembayaranList.map((p) => (
                <div key={p.id} className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">
                    {format(new Date(p.dibayar_pada), 'd MMM yyyy', { locale: idLocale })} ·{' '}
                    {p.metode}
                    {p.catatan ? ` · ${p.catatan}` : ''}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono">{formatRupiah(p.jumlah)}</span>
                    <DeletePaymentButton pembayaranId={p.id} pesananId={pesanan.id} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="border-t pt-2 flex justify-between font-medium">
            <span>Sisa Tagihan</span>
            <span className={sisaTagihan === 0 ? 'text-green-600 inline-flex items-center gap-1' : 'font-mono'}>
              {sisaTagihan === 0 ? (
                <>
                  <Check className="size-4" /> Lunas
                </>
              ) : (
                formatRupiah(sisaTagihan)
              )}
            </span>
          </div>
        </div>
      )}

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
