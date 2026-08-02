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
import type { Pesanan, ItemPesanan, Pembayaran, StatusPesanan } from '@/lib/types'

export type PesananWithRelations = Pesanan & {
  items: Array<Partial<Pick<ItemPesanan, 'subtotal'>> & Pick<ItemPesanan, 'diambil_oleh_helper'>>
  pembayaran?: Pick<Pembayaran, 'jumlah'>[]
  tanggal_pengiriman: string | null
}

interface OrderListProps {
  pesananList: PesananWithRelations[]
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

export function OrderList({ pesananList, isOwner }: OrderListProps) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusPesanan | 'semua'>(
    isOwner ? 'diproses' : 'semua'
  )
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return pesananList.filter((p) => {
      if (status !== 'semua' && p.status !== status) return false
      if (dateFrom || dateTo) {
        const created = parseISO(p.created_at)
        if (dateFrom && created < startOfDay(parseISO(dateFrom))) return false
        if (dateTo && created > endOfDay(parseISO(dateTo))) return false
      }
      if (!q) return true
      const nama = p.pelanggan?.nama ?? p.nama_pelanggan ?? ''
      return (
        p.kode_pesanan.toLowerCase().includes(q) ||
        nama.toLowerCase().includes(q)
      )
    })
  }, [pesananList, query, status, dateFrom, dateTo])

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

  // Derive once; both the mobile and desktop layouts read from this. The slice
  // happens inside the memo on purpose — `filtered` is itself memoized, whereas
  // slicing outside would hand useMemo a fresh array on every render and defeat
  // it entirely.
  const rows = useMemo(
    () =>
      filtered
        .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
        .map((p) => ({ p, view: deriveOrderRow(p, isOwner) })),
    [filtered, page, isOwner],
  )

  if (pesananList.length === 0) {
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
            {rows.map(({ p, view: { diambilCount, totalItems, tagihan } }) => {
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
                {rows.map(({ p, view: { diambilCount, totalItems, totalPesanan, tagihan } }) => {
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
