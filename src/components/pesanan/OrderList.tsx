'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ClipboardList, Search, SearchX } from 'lucide-react'
import { parseISO, startOfDay, endOfDay } from 'date-fns'
import { formatRupiah, formatTanggal } from '@/lib/format'
import { StatusBadge } from './StatusBadge'
import { DeletePesananButton } from './DeletePesananButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import type { StatusPesanan } from '@/lib/types'
// Types only — erased at compile time, so importing them from the server-safe
// module does not drag it into the client bundle. The functions that live there
// must NOT be imported here: they are called during server render, which is
// exactly why they no longer sit in this `'use client'` file.
import type { OrderRow, TagihanState } from './order-row'

// Re-exported so existing importers keep working. Type-only, so this stays a
// compile-time alias and creates no runtime edge back into the client module.
export type {
  PesananWithRelations,
  PesananListItem,
  OrderRow,
  OrderRowView,
  TagihanState,
} from './order-row'

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

  const hasActiveFilters = Boolean(query.trim() || dateFrom || dateTo) || status !== 'semua'

  function resetFilters() {
    setQuery('')
    setStatus('semua')
    setDateFrom('')
    setDateTo('')
  }

  // Nothing in the database at all — distinct from "filters matched nothing"
  // below, and it needs the opposite advice: there is no filter to relax, so
  // point at the action that fixes it instead.
  if (rows.length === 0) {
    return (
      <div className="border rounded-lg py-12 px-4 flex flex-col items-center text-center">
        <ClipboardList className="size-10 text-muted-foreground/50" aria-hidden="true" />
        <p className="mt-3 font-medium">Belum ada pesanan</p>
        <p className="mt-1 text-sm text-muted-foreground max-w-xs">
          {isOwner
            ? 'Pesanan yang dibuat akan muncul di sini.'
            : 'Belum ada pesanan yang sedang diproses. Halaman ini akan otomatis diperbarui.'}
        </p>
        {/* Owner only. Helpers can be blocked by `pesanan_locked`, and this
            component is not told about the lock — offering them a button whose
            only outcome is an error toast is the fail-open UI the create flow
            already guards against. The page header shows their lock-aware CTA. */}
        {isOwner && (
          <Link href="/pesanan/baru" className="mt-4">
            <Button>+ Pesanan Baru</Button>
          </Link>
        )}
      </div>
    )
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
        <div className="border rounded-lg py-10 px-4 flex flex-col items-center text-center">
          <SearchX className="size-9 text-muted-foreground/50" aria-hidden="true" />
          <p className="mt-3 font-medium">Tidak ada pesanan yang cocok</p>
          <p className="mt-1 text-sm text-muted-foreground max-w-xs">
            Coba kata kunci lain, ubah status, atau perluas rentang tanggal.
          </p>
          {hasActiveFilters && (
            <Button variant="outline" className="mt-4" onClick={resetFilters}>
              Hapus semua filter
            </Button>
          )}
        </div>
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
                        {formatTanggal(p.created_at)}
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
                          ? formatTanggal(p.tanggal_pengiriman)
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
                        {formatTanggal(p.created_at)}
                      </td>
                      {isOwner && (
                        <td className="px-4 py-3 text-muted-foreground">
                          {p.tanggal_pengiriman
                            ? formatTanggal(p.tanggal_pengiriman)
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
