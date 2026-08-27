'use client'

import { useMemo, useState } from 'react'
import { parseISO, startOfDay, endOfDay } from 'date-fns'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterBar } from '@/components/ui/filter-bar'
import { OrderRowCard, OrderRowTableRow } from './OrderListRow'
import { useSearchable } from '@/hooks/use-searchable'
import { usePagedList } from '@/hooks/use-paged-list'
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
}

const statusOptions: Array<{ value: StatusPesanan | 'semua'; label: string }> =
  [
    { value: 'semua', label: 'Semua status' },
    { value: 'diproses', label: 'Diproses' },
    { value: 'selesai', label: 'Selesai' },
    { value: 'dibatalkan', label: 'Dibatalkan' },
  ]

const PAGE_SIZE = 10

export function OrderList({ rows, isOwner }: OrderListProps) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusPesanan | 'semua'>(
    isOwner ? 'diproses' : 'semua',
  )
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

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

  // The row views are already derived (server-side, in `toOrderRows`), so
  // pagination is just the page slice.
  const { totalPages, pageRows, page, setPage } = usePagedList(
    filtered,
    PAGE_SIZE,
    JSON.stringify([query, status, dateFrom, dateTo]),
  )

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
              <button
                type="button"
                onClick={() => {
                  setDateFrom('')
                  setDateTo('')
                }}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Reset
              </button>
            )}
          </div>
        </>
      )}

      {filtered.length === 0 ? (
        <EmptyState message="Tidak ada pesanan yang cocok. Coba kata kunci lain atau ubah filter." />
      ) : (
        <>
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
