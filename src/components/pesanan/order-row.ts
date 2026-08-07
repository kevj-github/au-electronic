/**
 * Server-side row projection for the order lists.
 *
 * This file deliberately carries NO `'use client'` directive, and that is the
 * whole point of its existing separately from `OrderList.tsx`.
 *
 * `toOrderRows` is called during server render by /pesanan and /dashboard. When
 * it lived in `OrderList.tsx` — a `'use client'` module — Next resolved the
 * import to a client reference rather than the function itself, and calling it
 * threw:
 *
 *     Attempted to call toOrderRows() from the server but toOrderRows is on the
 *     client. It's not possible to invoke a client function from the server.
 *
 * Both list pages rendered the error boundary instead of any orders. It did not
 * reproduce under Node 20 locally, only under the Node 22 that Vercel builds
 * with, so nothing caught it before it shipped.
 *
 * A plain function that a Server Component calls belongs in a module the server
 * is allowed to load. Types are erased at compile time, so `OrderList.tsx` can
 * keep importing them from here with `import type`.
 */

import { hitungSaldo, orderTotals } from '@/lib/utils'
import type { Pelanggan, Pesanan, ItemPesananOwner, PembayaranOwner } from '@/lib/types'

/**
 * The server-side shape: a fetched order with its embedded rows still attached.
 *
 * `Omit` first, then re-add — an intersection (`Pesanan & { items: ... }`) does
 * not override, it *adds*, so `items` resolved to `ItemPesanan & Pick<...>` and
 * the type demanded every column while the query selects two. Both list pages
 * select `items(subtotal, diambil_oleh_helper)` and `pembayaran(jumlah)`, and
 * `alamat` is optional because the dashboard asks for `pelanggan(nama)` alone.
 */
export type PesananWithRelations = Omit<
  Pesanan,
  'items' | 'pembayaran' | 'pelanggan'
> & {
  items: Array<Partial<Pick<ItemPesananOwner, 'subtotal'>> & Pick<ItemPesananOwner, 'diambil_oleh_helper'>>
  pembayaran?: Pick<PembayaranOwner, 'jumlah'>[]
  pelanggan?: (Pick<Pelanggan, 'nama'> & Partial<Pick<Pelanggan, 'alamat'>>) | null
  tanggal_pengiriman: string | null
}

/**
 * Exactly the per-order fields the list markup reads — no `items`, no
 * `pembayaran`. Those two are only ever reduced to the four numbers in
 * `OrderRowView`, so shipping the rows themselves to the browser sent hundreds
 * of objects across the RSC boundary to render a couple of totals.
 *
 * Rebuilding the `pelanggan` object field-by-field also drops anything the
 * select didn't ask for, the same defense-in-depth rule the page's column
 * allowlist follows: an omitted field can't leak through the payload.
 */
export type PesananListItem = Pick<
  Pesanan,
  'id' | 'kode_pesanan' | 'status' | 'created_at' | 'nama_pelanggan'
> & {
  pelanggan: (Pick<Pelanggan, 'nama'> & { alamat: string | null }) | null
  tanggal_pengiriman: string | null
}

export interface OrderRow {
  p: PesananListItem
  view: OrderRowView
}

/**
 * What the Tagihan column should say. Three states, not two: an order whose
 * items have no price yet has sisaTagihan === 0, which would otherwise read as
 * "Lunas" — a false signal that the customer owes nothing. See the same rule on
 * the detail page.
 */
export type TagihanState =
  | { kind: 'belum-ada-harga' }
  | { kind: 'sisa'; amount: number }
  | { kind: 'lunas' }

export interface OrderRowView {
  diambilCount: number
  totalItems: number
  totalPesanan: number
  totalDibayar: number
  sisaTagihan: number
  tagihan: TagihanState
}

/**
 * Everything the row markup needs, derived once per order.
 *
 * The mobile card list and the desktop table render the same orders with
 * different markup, and both are always mounted (one is `sm:hidden`, the other
 * `hidden sm:block`) — so this used to be computed twice per render and, more
 * importantly, maintained twice. The Tagihan three-state rule in particular was
 * copy-pasted into both branches, which is exactly how mobile and desktop drift
 * apart. Deriving it here means a change lands in both by construction.
 */
export function deriveOrderRow(p: PesananWithRelations, isOwner: boolean): OrderRowView {
  const { totalPesanan, totalDibayar } = isOwner
    ? orderTotals(p)
    : { totalPesanan: 0, totalDibayar: 0 }
  const { sisaTagihan } = hitungSaldo(totalPesanan, totalDibayar)

  const tagihan: TagihanState =
    totalPesanan === 0 && (p.pembayaran ?? []).length === 0
      ? { kind: 'belum-ada-harga' }
      : sisaTagihan > 0
        ? { kind: 'sisa', amount: sisaTagihan }
        : { kind: 'lunas' }

  return {
    diambilCount: p.items.filter((i) => i.diambil_oleh_helper).length,
    totalItems: p.items.length,
    totalPesanan,
    totalDibayar,
    sisaTagihan,
    tagihan,
  }
}

/**
 * Server-side projection: derive every order's row view and keep only the
 * fields the markup renders. Call this in the Server Component, never in the
 * browser — the whole point is that the embedded `items`/`pembayaran` arrays
 * stay on the server.
 */
export function toOrderRows(
  list: PesananWithRelations[],
  isOwner: boolean
): OrderRow[] {
  return list.map((p) => ({
    p: {
      id: p.id,
      kode_pesanan: p.kode_pesanan,
      status: p.status,
      created_at: p.created_at,
      nama_pelanggan: p.nama_pelanggan,
      // `?? null` because the dashboard's select omits alamat entirely.
      pelanggan: p.pelanggan
        ? { nama: p.pelanggan.nama, alamat: p.pelanggan.alamat ?? null }
        : null,
      tanggal_pengiriman: p.tanggal_pengiriman,
    },
    view: deriveOrderRow(p, isOwner),
  }))
}
