import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, getPesananLocked } from '@/lib/supabase/request-cache'
import { RealtimeRefresh } from '@/components/realtime/RealtimeRefresh'
import { PesananDetailHeader } from '@/components/pesanan/PesananDetailHeader'
import { PembayaranSection } from '@/components/pesanan/PembayaranSection'
import { ItemsSection } from '@/components/pesanan/ItemsSection'
import { ResetChecklistButton } from '@/components/pesanan/ResetChecklistButton'
import { fetchPesananDetail, derivePesananDetailView } from '@/components/pesanan/pesanan-detail'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

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

  // Fetch pesanan and lock setting in parallel.
  const [pesanan, pesananLocked] = await Promise.all([
    fetchPesananDetail(supabase, id, isOwner),
    getPesananLocked(),
  ])

  if (!pesanan) notFound()

  const {
    statusLocked,
    isLocked,
    pembayaranList,
    totalPesanan,
    sisaTagihan,
    nextStatuses,
    dicekCount,
    totalItems,
    diambilCount,
    invoiceData,
    sectionItems,
  } = derivePesananDetailView(pesanan, isOwner, pesananLocked)

  return (
    <div className="space-y-6 max-w-3xl">
      <RealtimeRefresh table="pesanan" filter={{ column: 'id', value: pesanan.id }} />

      <PesananDetailHeader
        pesananId={pesanan.id}
        kodePesanan={pesanan.kode_pesanan}
        status={pesanan.status}
        createdAt={pesanan.created_at}
        tanggalPengiriman={pesanan.tanggal_pengiriman}
        pengiriman={pesanan.pengiriman}
        colly={pesanan.colly}
        isOwner={isOwner}
        statusLocked={statusLocked}
        invoiceData={invoiceData}
        belumDicekCount={totalItems - dicekCount}
        nextStatuses={nextStatuses}
      />

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
        <PembayaranSection
          pesananId={pesanan.id}
          totalPesanan={totalPesanan}
          sisaTagihan={sisaTagihan}
          pembayaranList={pembayaranList}
        />
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
