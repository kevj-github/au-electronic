import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, getPesananLocked } from '@/lib/supabase/request-cache'
import { RealtimeRefresh } from '@/components/realtime/RealtimeRefresh'
import { TanggalPengirimanEditor } from '@/components/pesanan/TanggalPengirimanEditor'
import { PengirimanEditor } from '@/components/pesanan/PengirimanEditor'
import { StatusBadge } from '@/components/pesanan/StatusBadge'
import { StatusTransitionButtons } from '@/components/pesanan/StatusTransitionButtons'
import { DocumentButtons } from '@/components/pesanan/DocumentButtons'
import { PaymentModal } from '@/components/pesanan/PaymentModal'
import { DeletePaymentButton } from '@/components/pesanan/DeletePaymentButton'
import { ItemsSection } from '@/components/pesanan/ItemsSection'
import { ResetChecklistButton } from '@/components/pesanan/ResetChecklistButton'
import { buildInvoiceData, type InvoiceData } from '@/lib/invoice-data'
import { formatRupiah, hitungSaldo } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import type { Pesanan, ItemPesanan, Pembayaran, Pelanggan, StatusPesanan } from '@/lib/types'
import Link from 'next/link'

type HelperItem = Pick<ItemPesanan, 'id' | 'nama_barang' | 'qty' | 'diambil_oleh_helper' | 'jumlah_diambil'>
type OwnerItem = ItemPesanan

type PesananDetail = Omit<Pesanan, 'pelanggan' | 'items' | 'pembayaran'> & {
  pelanggan: Pelanggan | null
  items: HelperItem[] | OwnerItem[]
  pembayaran: Pembayaran[]
}

const statusTransitions: Record<StatusPesanan, StatusPesanan[]> = {
  diproses: ['selesai', 'dibatalkan'],
  // Owner can reopen a completed order back to "diproses" (e.g. to edit items).
  selesai: ['diproses'],
  dibatalkan: [],
}

// These label the status-transition buttons, so each is phrased as the action
// that will happen. "diproses" is only ever a transition target when reopening
// a completed order, so it reads "Buka Kembali" rather than the status name.
const statusLabel: Record<StatusPesanan, string> = {
  diproses: 'Buka Kembali',
  selesai: 'Selesai',
  dibatalkan: 'Batalkan',
}

export default async function PesananDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const isOwner = user.role === 'owner'

  const supabase = await createClient()

  // Helpers never get price/payment data fetched into the RSC payload at all —
  // not just hidden in the UI. requireOwner/RLS still back this up server-side.
  const itemsSelect = isOwner
    ? 'id, nama_barang, qty, harga_satuan, subtotal, diambil_oleh_helper, dicek_oleh_owner, jumlah_diambil'
    : 'id, nama_barang, qty, diambil_oleh_helper, jumlah_diambil'
  // Helpers see nama + alamat but not telepon (owner-only); don't fetch the
  // columns they can't see (defense-in-depth — same rule as the price columns).
  const pesananSelect = isOwner
    ? `*, pelanggan(*), items:item_pesanan(${itemsSelect}), pembayaran(*)`
    : `*, pelanggan(nama, alamat), items:item_pesanan(${itemsSelect})`

  // Fetch pesanan and lock setting in parallel.
  const [{ data: pesanan }, pesananLocked] = await Promise.all([
    supabase
      .from('pesanan')
      .select(pesananSelect)
      .eq('id', id)
      .single<PesananDetail>(),
    getPesananLocked(),
  ])

  if (!pesanan) notFound()

  // Without an explicit order, Postgres row order is not guaranteed to stay
  // put across queries — an UPDATE (e.g. toggling a checklist) can shift a
  // row's physical position, making items appear to reorder in the list on
  // every checkbox tick. Sort alphabetically by item name (ascending) for a
  // predictable order; fall back to id as a tiebreaker so duplicate names stay
  // stable and only reorder when items are actually added/removed. This mirrors
  // the ordering used in the PDF/Epson documents (see buildInvoiceData).
  pesanan.items = [...pesanan.items].sort(
    (a, b) =>
      a.nama_barang.localeCompare(b.nama_barang, 'id', { sensitivity: 'base' }) ||
      a.id.localeCompare(b.id),
  )

  const statusLocked = pesanan.status !== 'diproses'
  const isLocked = statusLocked || (!isOwner && pesananLocked)
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
    ? buildInvoiceData({
        kode_pesanan: pesanan.kode_pesanan,
        created_at: pesanan.created_at,
        tanggal_pengiriman: pesanan.tanggal_pengiriman,
        pengiriman: pesanan.pengiriman,
        nama_pelanggan: pesanan.nama_pelanggan,
        pelanggan: pesanan.pelanggan,
        items: ownerItems,
        pembayaran: pembayaranList,
        catatan: pesanan.catatan,
      })
    : null

  // Items passed to client components — no price data for helpers
  const sectionItems = pesanan.items.map((item) => {
    if (isOwner) {
      const o = item as OwnerItem
      return {
        id: o.id,
        nama_barang: o.nama_barang,
        qty: o.qty,
        jumlah_diambil: o.jumlah_diambil,
        dicek_oleh_owner: o.dicek_oleh_owner,
        harga_satuan: o.harga_satuan,
        subtotal: o.subtotal,
      }
    }
    return {
      id: item.id,
      nama_barang: item.nama_barang,
      qty: item.qty,
      jumlah_diambil: item.jumlah_diambil,
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
          {isOwner && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Tgl. Pengiriman:</span>
                <TanggalPengirimanEditor
                  pesananId={pesanan.id}
                  initialValue={pesanan.tanggal_pengiriman}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Pengiriman:</span>
                <PengirimanEditor
                  pesananId={pesanan.id}
                  initialValue={pesanan.pengiriman}
                />
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {isOwner && invoiceData && <DocumentButtons pesananId={pesanan.id} data={invoiceData} />}
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
        {isOwner && pesanan.pelanggan?.telepon && (
          <p className="text-sm text-muted-foreground">{pesanan.pelanggan.telepon}</p>
        )}
        {pesanan.pelanggan?.alamat && (
          <p className="text-sm text-muted-foreground">{pesanan.pelanggan.alamat}</p>
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
              {!statusLocked && (
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
          priceEditable={isOwner && !statusLocked}
        />
      </div>

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
            <span className={
              totalPesanan === 0 && pembayaranList.length === 0
                ? 'text-muted-foreground text-sm font-normal'
                : sisaTagihan === 0
                  ? 'text-green-600 inline-flex items-center gap-1'
                  : 'font-mono'
            }>
              {totalPesanan === 0 && pembayaranList.length === 0 ? (
                'Belum ada harga'
              ) : sisaTagihan === 0 ? (
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
