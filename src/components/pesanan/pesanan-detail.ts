/**
 * Data-fetch and derivation layer for the /pesanan/[id] detail page.
 *
 * Deliberately carries no `'use client'` directive (same reason as
 * order-row.ts): `fetchPesananDetail` runs a Supabase query during server
 * render and must stay a plain function a Server Component can call directly.
 *
 * This is where the helper-safe-column boundary lives: `fetchPesananDetail`
 * is the one place that decides which columns each role's query asks for.
 * Keeping it out of page.tsx's ~180 lines of JSX makes that boundary the
 * whole point of a short, named function instead of one branch buried in a
 * much longer file.
 */

import { buildInvoiceData, type InvoiceData } from '@/lib/invoice-data'
import { DETAIL_ITEM_COLUMNS, itemsEmbed, pembayaranEmbed } from '@/lib/pesanan-select'
import { hitungSaldo } from '@/lib/utils'
import type {
  Pesanan,
  ItemPesananHelper,
  ItemPesananOwner,
  PembayaranOwner,
  Pelanggan,
  StatusPesanan,
} from '@/lib/types'
import type { SectionItem } from './itemsSectionShared'
import type { createClient } from '@/lib/supabase/server'

type ServerClient = Awaited<ReturnType<typeof createClient>>

export type HelperItem = Pick<
  ItemPesananHelper,
  'id' | 'nama_barang' | 'qty' | 'diambil_oleh_helper' | 'jumlah_diambil'
>
export type OwnerItem = ItemPesananOwner

export type PesananDetailRow = Omit<Pesanan, 'pelanggan' | 'items' | 'pembayaran'> & {
  pelanggan: Pelanggan | null
  items: HelperItem[] | OwnerItem[]
  pembayaran: PembayaranOwner[]
}

export const statusTransitions: Record<StatusPesanan, StatusPesanan[]> = {
  diproses: ['selesai', 'dibatalkan'],
  // Owner can reopen a completed order back to "diproses" (e.g. to edit items).
  selesai: ['diproses'],
  dibatalkan: [],
}

// These label the status-transition buttons, so each is phrased as the action
// that will happen. "diproses" is only ever a transition target when reopening
// a completed order, so it reads "Buka Kembali" rather than the status name.
export const statusLabel: Record<StatusPesanan, string> = {
  diproses: 'Buka Kembali',
  selesai: 'Selesai',
  dibatalkan: 'Batalkan',
}

/**
 * Fetch one pesanan with its embedded relations, using per-role column
 * selection so helpers never receive price/payment data in the RSC payload.
 * Owners read priced data through the owner-gated views; helpers see nama +
 * alamat but not telepon (owner-only) and no priced item columns at all —
 * see lib/pesanan-select.ts for the rules this delegates to and pins in tests.
 */
export async function fetchPesananDetail(
  supabase: ServerClient,
  id: string,
  isOwner: boolean
): Promise<PesananDetailRow | null> {
  const pesananSelect = isOwner
    ? `*, pelanggan(*), ${itemsEmbed(true, DETAIL_ITEM_COLUMNS.owner)}, ${pembayaranEmbed('*')}`
    : `*, pelanggan(nama, alamat), ${itemsEmbed(false, DETAIL_ITEM_COLUMNS.helper)}`

  const { data } = await supabase
    .from('pesanan')
    .select(pesananSelect)
    .eq('id', id)
    .single<PesananDetailRow>()

  return data
}

export interface PesananDetailView {
  items: HelperItem[] | OwnerItem[]
  ownerItems: OwnerItem[]
  pembayaranList: PembayaranOwner[]
  statusLocked: boolean
  isLocked: boolean
  totalPesanan: number
  totalDibayar: number
  sisaTagihan: number
  nextStatuses: StatusPesanan[]
  diambilCount: number
  dicekCount: number
  totalItems: number
  invoiceData: InvoiceData | null
  sectionItems: SectionItem[]
}

/**
 * Every value the page's render sections need, derived once from the fetched
 * row. Pure aside from reading `isOwner`/`pesananLocked` — no I/O — so it's
 * unit-testable without a Supabase client.
 */
export function derivePesananDetailView(
  pesanan: PesananDetailRow,
  isOwner: boolean,
  pesananLocked: boolean
): PesananDetailView {
  // Without an explicit order, Postgres row order is not guaranteed to stay
  // put across queries — an UPDATE (e.g. toggling a checklist) can shift a
  // row's physical position, making items appear to reorder in the list on
  // every checkbox tick. Sort alphabetically by item name (ascending) for a
  // predictable order; fall back to id as a tiebreaker so duplicate names
  // stay stable and only reorder when items are actually added/removed. This
  // mirrors the ordering used in the PDF/Epson documents (see buildInvoiceData).
  const items = [...pesanan.items].sort(
    (a, b) =>
      a.nama_barang.localeCompare(b.nama_barang, 'id', { sensitivity: 'base' }) ||
      a.id.localeCompare(b.id)
  ) as HelperItem[] | OwnerItem[]

  const statusLocked = pesanan.status !== 'diproses'
  const isLocked = statusLocked || (!isOwner && pesananLocked)
  const ownerItems = isOwner ? (items as OwnerItem[]) : []
  const pembayaranList = pesanan.pembayaran ?? []
  const totalPesanan = ownerItems.reduce((s, i) => s + i.subtotal, 0)
  const totalDibayar = pembayaranList.reduce((s, p) => s + p.jumlah, 0)
  const { sisaTagihan } = hitungSaldo(totalPesanan, totalDibayar)
  const nextStatuses = statusTransitions[pesanan.status] ?? []

  const diambilCount = items.filter((i) => i.diambil_oleh_helper).length
  const dicekCount = ownerItems.filter((i) => i.dicek_oleh_owner).length
  const totalItems = items.length

  const invoiceData: InvoiceData | null = isOwner
    ? buildInvoiceData({
        kode_pesanan: pesanan.kode_pesanan,
        created_at: pesanan.created_at,
        tanggal_pengiriman: pesanan.tanggal_pengiriman,
        pengiriman: pesanan.pengiriman,
        colly: pesanan.colly,
        nama_pelanggan: pesanan.nama_pelanggan,
        pelanggan: pesanan.pelanggan,
        items: ownerItems,
        pembayaran: pembayaranList,
        catatan: pesanan.catatan,
      })
    : null

  // Items passed to client components — no price data for helpers.
  const sectionItems: SectionItem[] = items.map((item) => {
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

  return {
    items,
    ownerItems,
    pembayaranList,
    statusLocked,
    isLocked,
    totalPesanan,
    totalDibayar,
    sisaTagihan,
    nextStatuses,
    diambilCount,
    dicekCount,
    totalItems,
    invoiceData,
    sectionItems,
  }
}
