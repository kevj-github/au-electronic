'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { format, parseISO, startOfDay, endOfDay } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { formatRupiah, hitungSaldo, orderTotals } from '@/lib/utils'
import { StatusBadge } from './StatusBadge'
import { DeletePesananButton } from './DeletePesananButton'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import type { Pelanggan, Pesanan, ItemPesanan, Pembayaran, StatusPesanan } from '@/lib/types'

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
  items: Array<Partial<Pick<ItemPesanan, 'subtotal'>> & Pick<ItemPesanan, 'diambil_oleh_helper'>>
  pembayaran?: Pick<Pembayaran, 'jumlah'>[]
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

interface OrderListProps {
  rows: OrderRow[]
  isOwner: boolean
}

const statusOptions: Array<{ value: StatusPesanan | 'semua'; label: string }> = [
  { value: 'semua', label: 'Semua status' },
  { value: 'diproses', label: 'Diproses' },
  { value: 'selesai', label: 'Selesai' },
  { value: 'dibatalkan', label: 'Dibatalkan' },
]

const PAGE_SIZE = 10

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

/**
 * Renders a TagihanState. Shared so the two layouts cannot disagree — they
 * previously differed by a stray `font-medium`, which only looked the same
 * because the mobile wrapper was already bold.
 */
function TagihanText({ tagihan }: { tagihan: TagihanState }) {
  if (tagihan.kind === 'belum-ada-harga') {
    return <span className="text-muted-foreground font-normal text-xs">Belum ada harga</span>
  }
  if (tagihan.kind === 'sisa') return <>{formatRupiah(tagihan.amount)}</>
  return <span className="text-green-600 font-medium">Lunas</span>
}

export function OrderList({ rows, isOwner }: OrderListProps) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusPesanan | 'semua'>(
    isOwner ? 'diproses' : 'semua'
  )
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  /**
   * Search text and timestamp, lowercased and parsed once per order rather than
   * once per order *per keystroke*. Keyed on `rows` alone, so typing reuses it.
   */
  const searchable = useMemo(
    () =>
      rows.map((row) => ({
        row,
        // Joined with NUL, which cannot appear in a typed query, so a match can
        // never span the boundary. That keeps the original "kode matches OR
        // nama matches" semantics rather than quietly widening them.
        haystack: `${row.p.kode_pesanan}\u0000${
          row.p.pelanggan?.nama ?? row.p.nama_pelanggan ?? ''
        }`.toLowerCase(),
        createdAt: parseISO(row.p.created_at).getTime(),
      })),
    [rows],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    // Hoisted out of the row loop: these depend only on the filter inputs, but
    // sat inside the predicate, so each keystroke re-parsed the same two dates
    // once per order — 1000 extra parses on a full 500-order list.
    const fromMs = dateFrom ? startOfDay(parseISO(dateFrom)).getTime() : null
    const toMs = dateTo ? endOfDay(parseISO(dateTo)).getTime() : null

    return searchable
      .filter(({ row: { p }, haystack, createdAt }) => {
        if (status !== 'semua' && p.status !== status) return false
        if (fromMs !== null && createdAt < fromMs) return false
        if (toMs !== null && createdAt > toMs) return false
        // The NUL separator keeps a match from spanning kode and nama.
        return !q || haystack.includes(q)
      })
      .map(({ row }) => row)
  }, [searchable, query, status, dateFrom, dateTo])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  // Reset to the first page whenever the filters change. This adjusts state
  // during render (React's recommended pattern) rather than in an effect —
  // an effect would commit the stale page first, then cascade a second render.
  const filterKey = JSON.stringify([query, status, dateFrom, dateTo])
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey)
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey)
    setPage(1)
  }

  // The row views are already derived (server-side, in `toOrderRows`), so this
  // is just the page slice. Memoized so both layouts read the same array
  // identity rather than a fresh one per render.
  const pageRows = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  )

  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">Belum ada pesanan.</p>
  }

  return (
    <div className="space-y-3">
      {isOwner && (
        <>
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari kode pesanan atau nama pelanggan..."
                className="pl-9"
              />
            </div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusPesanan | 'semua')}
              className="border rounded-md px-3 py-2 text-sm"
            >
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Tanggal:</span>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 w-36 text-sm"
              aria-label="Dari tanggal"
            />
            <span className="text-xs text-muted-foreground">—</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 w-36 text-sm"
              aria-label="Sampai tanggal"
            />
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => { setDateFrom(''); setDateTo('') }}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Reset
              </button>
            )}
          </div>
        </>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground border rounded-lg p-4">
          Tidak ada pesanan yang cocok. Coba kata kunci lain atau ubah filter.
        </p>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="space-y-2 sm:hidden">
            {pageRows.map(({ p, view: { diambilCount, totalItems, tagihan } }) => {
              return (
                <div key={p.id} className="border rounded-lg p-3 flex gap-2 items-start hover:bg-gray-50">
                  <Link href={`/pesanan/${p.id}`} className="flex-1 min-w-0 block">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-mono text-sm text-primary">{p.kode_pesanan}</span>
                      <StatusBadge status={p.status} />
                    </div>
                    <p className="text-sm mt-1">{p.pelanggan?.nama ?? p.nama_pelanggan ?? '—'}</p>
                    {p.pelanggan?.alamat && (
                      <p className="text-xs text-muted-foreground mt-0.5">{p.pelanggan.alamat}</p>
                    )}
                    <div className="flex justify-between items-center mt-2 text-sm">
                      <span className="text-muted-foreground">
                        {format(new Date(p.created_at), 'd MMM yyyy', { locale: idLocale })}
                      </span>
                      {isOwner ? (
                        <span className="font-mono font-medium">
                          <TagihanText tagihan={tagihan} />
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          {diambilCount}/{totalItems} diambil
                        </span>
                      )}
                    </div>
                    {isOwner && (
                      <p className="text-xs text-muted-foreground mt-1">
                        <span className="font-medium">Pengiriman:</span>{' '}
                        {p.tanggal_pengiriman
                          ? format(new Date(p.tanggal_pengiriman), 'd MMM yyyy', { locale: idLocale })
                          : 'Belum ditentukan'}
                      </p>
                    )}
                  </Link>
                  {isOwner && <DeletePesananButton pesananId={p.id} />}
                </div>
              )
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block border rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Kode</th>
                  <th className="text-left px-4 py-3 font-medium">Pelanggan</th>
                  <th className="text-left px-4 py-3 font-medium">Tgl. Pesanan</th>
                  {isOwner && <th className="text-left px-4 py-3 font-medium">Tgl. Pengiriman</th>}
                  {isOwner ? (
                    <>
                      <th className="text-right px-4 py-3 font-medium">Total</th>
                      <th className="text-right px-4 py-3 font-medium">Sisa</th>
                    </>
                  ) : (
                    <th className="text-right px-4 py-3 font-medium">Diambil</th>
                  )}
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  {isOwner && <th className="px-4 py-3 w-12" />}
                </tr>
              </thead>
              <tbody className="divide-y">
                {pageRows.map(({ p, view: { diambilCount, totalItems, totalPesanan, tagihan } }) => {
                  return (
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
                        <span>{p.pelanggan?.nama ?? p.nama_pelanggan ?? '—'}</span>
                        {p.pelanggan?.alamat && (
                          <span className="block text-xs text-muted-foreground">{p.pelanggan.alamat}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {format(new Date(p.created_at), 'd MMM yyyy', { locale: idLocale })}
                      </td>
                      {isOwner && (
                        <td className="px-4 py-3 text-muted-foreground">
                          {p.tanggal_pengiriman
                            ? format(new Date(p.tanggal_pengiriman), 'd MMM yyyy', { locale: idLocale })
                            : <span className="text-xs italic">Belum ditentukan</span>}
                        </td>
                      )}
                      {isOwner ? (
                        <>
                          <td className="px-4 py-3 text-right font-mono">
                            {formatRupiah(totalPesanan)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            <TagihanText tagihan={tagihan} />
                          </td>
                        </>
                      ) : (
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {diambilCount}/{totalItems}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <StatusBadge status={p.status} />
                      </td>
                      {isOwner && (
                        <td className="px-4 py-3 text-right">
                          <DeletePesananButton pesananId={p.id} />
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}
