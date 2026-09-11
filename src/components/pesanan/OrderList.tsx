'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { parseISO, startOfDay, endOfDay } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterBar } from '@/components/ui/filter-bar'
import { OrderRowCard, OrderRowTableRow } from './OrderListRow'
import { useSearchable } from '@/hooks/use-searchable'
import { usePagedList } from '@/hooks/use-paged-list'
import { searchPesananGlobal } from '@/app/(app)/pesanan/search-actions'
import type { StatusPesanan } from '@/lib/types'
// Types only — erased at compile time, so importing them from the server-safe
// module does not drag it into the client bundle. The functions that live there
// must NOT be imported here: they are called during server render, which is
// exactly why they no longer sit in this `'use client'` file.
import type { OrderRow } from './order-row'

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
  /** Whether `rows` was capped below the true row count (PESANAN_LIST_LIMIT). */
  truncated: boolean
}

const statusOptions: Array<{ value: StatusPesanan | 'semua'; label: string }> =
  [
    { value: 'semua', label: 'Semua status' },
    { value: 'diproses', label: 'Diproses' },
    { value: 'selesai', label: 'Selesai' },
    { value: 'dibatalkan', label: 'Dibatalkan' },
  ]

const PAGE_SIZE = 10

export function OrderList({ rows, isOwner, truncated }: OrderListProps) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusPesanan | 'semua'>(
    isOwner ? 'diproses' : 'semua',
  )
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Results of "Cari di semua pesanan" — a full-table search past the 500-row
  // cap, offered only when the local filter above comes back empty. Reset
  // during render (not an effect) whenever any filter input changes, the same
  // pattern usePagedList uses for its own page reset.
  const [serverSearch, setServerSearch] = useState<OrderRow[] | null>(null)
  const [serverSearching, setServerSearching] = useState(false)
  const [serverSearchError, setServerSearchError] = useState<string | null>(null)
  // Bumped whenever a search fires or the filters change, so a response can
  // check it's still wanted before applying — a request in flight when the
  // user edits the query (or fires a second search before the first
  // resolves) must not resurrect stale results once it finally settles.
  // Refs can't be touched during render, so the filter-change bump lives in
  // an effect rather than alongside the render-time state reset below; it
  // still lands well before any real network response could arrive.
  const searchRequestId = useRef(0)
  const filterKey = JSON.stringify([query, status, dateFrom, dateTo])
  useEffect(() => {
    searchRequestId.current++
  }, [filterKey])
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey)
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey)
    setServerSearch(null)
    setServerSearching(false)
    setServerSearchError(null)
  }

  /**
   * Search text, lowercased once per order rather than once per order *per
   * keystroke*. Joined with NUL, which cannot appear in a typed query, so a
   * match can never span the boundary. That keeps the original 'kode matches
   * OR nama matches' semantics rather than quietly widening them.
   */
  const searchable = useSearchable(
    rows,
    (row) =>
      `${row.p.kode_pesanan}\u0000${row.p.pelanggan?.nama ?? row.p.nama_pelanggan ?? ''}`,
  )

  // Parsed once per order rather than once per order per keystroke.
  const createdAtByRow = useMemo(
    () =>
      new Map(
        rows.map((row) => [row.p.id, parseISO(row.p.created_at).getTime()]),
      ),
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
      .filter(({ item: row, haystack }) => {
        const { p } = row
        if (status !== 'semua' && p.status !== status) return false
        const createdAt = createdAtByRow.get(p.id)!
        if (fromMs !== null && createdAt < fromMs) return false
        if (toMs !== null && createdAt > toMs) return false
        // The NUL separator keeps a match from spanning kode and nama.
        return !q || haystack.includes(q)
      })
      .map(({ item }) => item)
  }, [searchable, createdAtByRow, query, status, dateFrom, dateTo])

  // Server search results replace the local filtered set entirely once
  // present; they already reflect the current query and status (the action
  // takes both), but not the date range, since date filtering is cheap to
  // redo client-side over whatever the server returned.
  const results = useMemo(() => {
    if (serverSearch === null) return filtered
    const fromMs = dateFrom ? startOfDay(parseISO(dateFrom)).getTime() : null
    const toMs = dateTo ? endOfDay(parseISO(dateTo)).getTime() : null
    if (fromMs === null && toMs === null) return serverSearch
    return serverSearch.filter((row) => {
      const createdAt = parseISO(row.p.created_at).getTime()
      if (fromMs !== null && createdAt < fromMs) return false
      if (toMs !== null && createdAt > toMs) return false
      return true
    })
  }, [serverSearch, filtered, dateFrom, dateTo])

  // The row views are already derived (server-side, in `toOrderRows`), so
  // pagination is just the page slice.
  const { totalPages, pageRows, page, setPage } = usePagedList(
    results,
    PAGE_SIZE,
    `${filterKey}:${serverSearch === null ? 'local' : 'server'}`,
  )

  async function handleServerSearch() {
    const requestId = ++searchRequestId.current
    setServerSearching(true)
    setServerSearchError(null)
    const result = await searchPesananGlobal(query, status)
    // A newer search (or a filter change, which also bumps this) has
    // superseded this request — its result is stale, drop it.
    if (searchRequestId.current !== requestId) return
    setServerSearching(false)
    if (result.error) {
      setServerSearchError(result.error)
      return
    }
    setServerSearch(result.rows ?? [])
  }

  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">Belum ada pesanan.</p>
  }

  return (
    <div className="space-y-3">
      {isOwner && (
        <>
          <FilterBar
            searchValue={query}
            onSearchChange={setQuery}
            searchPlaceholder="Cari kode pesanan atau nama pelanggan..."
            selectValue={status}
            onSelectChange={setStatus}
            selectOptions={statusOptions}
          />
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
              <Button
                type="button"
                variant="link"
                onClick={() => {
                  setDateFrom('')
                  setDateTo('')
                }}
                className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground underline"
              >
                Reset
              </Button>
            )}
          </div>
        </>
      )}

      {results.length === 0 ? (
        <div className="space-y-3">
          <EmptyState message="Tidak ada pesanan yang cocok. Coba kata kunci lain atau ubah filter." />
          {truncated && query.trim() !== '' && serverSearch === null && (
            <div className="text-sm text-center space-y-2">
              <p className="text-muted-foreground">
                Pencarian ini hanya mencakup 500 pesanan terbaru.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleServerSearch}
                disabled={serverSearching}
              >
                {serverSearching ? 'Mencari...' : 'Cari di semua pesanan'}
              </Button>
              {serverSearchError && (
                <p className="text-destructive text-xs">{serverSearchError}</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          {serverSearch !== null && (
            <p className="text-xs text-muted-foreground">
              Menampilkan hasil pencarian dari semua pesanan, bukan hanya 500 terbaru.
            </p>
          )}
          {/* Mobile: card list */}
          <div className="space-y-2 sm:hidden">
            {pageRows.map((row) => (
              <OrderRowCard key={row.p.id} row={row} isOwner={isOwner} />
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block border rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Kode</th>
                  <th className="text-left px-4 py-3 font-medium">Pelanggan</th>
                  <th className="text-left px-4 py-3 font-medium">
                    Tgl. Pesanan
                  </th>
                  {isOwner && (
                    <th className="text-left px-4 py-3 font-medium">
                      Tgl. Pengiriman
                    </th>
                  )}
                  {isOwner ? (
                    <>
                      <th className="text-right px-4 py-3 font-medium">
                        Total
                      </th>
                      <th className="text-right px-4 py-3 font-medium">Sisa</th>
                    </>
                  ) : (
                    <th className="text-right px-4 py-3 font-medium">
                      Diambil
                    </th>
                  )}
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  {isOwner && <th className="px-4 py-3 w-12" />}
                </tr>
              </thead>
              <tbody className="divide-y">
                {pageRows.map((row) => (
                  <OrderRowTableRow
                    key={row.p.id}
                    row={row}
                    isOwner={isOwner}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  )
}
