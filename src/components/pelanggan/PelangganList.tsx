'use client'

import { useMemo, useState } from 'react'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterBar } from '@/components/ui/filter-bar'
import { PelangganRowCard, PelangganRowTableRow } from './PelangganListRow'
import { useSearchable } from '@/hooks/use-searchable'
import { usePagedList } from '@/hooks/use-paged-list'
import { searchPelangganGlobal } from '@/app/(app)/pelanggan/search-actions'
import { Button } from '@/components/ui/button'
import type { Pelanggan, TipePelanggan } from '@/lib/types'

interface PelangganListProps {
  pelangganList: Pelanggan[]
  /** Whether `pelangganList` was capped below the true row count (PELANGGAN_LIST_LIMIT). */
  truncated: boolean
}

const PAGE_SIZE = 10

const tipeOptions: Array<{ value: TipePelanggan | 'semua'; label: string }> = [
  { value: 'semua', label: 'Semua tipe' },
  { value: 'retail', label: 'Retail' },
  { value: 'grosir', label: 'Grosir' },
]

export function PelangganList({ pelangganList, truncated }: PelangganListProps) {
  const [query, setQuery] = useState('')
  const [tipe, setTipe] = useState<TipePelanggan | 'semua'>('semua')

  // Results of "Cari di semua pelanggan" — a full-table search past the
  // 500-row cap, offered only when the local filter comes back empty. Reset
  // during render whenever a filter input changes, mirroring usePagedList's
  // own page-reset pattern.
  const [serverSearch, setServerSearch] = useState<Pelanggan[] | null>(null)
  const [serverSearching, setServerSearching] = useState(false)
  const [serverSearchError, setServerSearchError] = useState<string | null>(null)
  const filterKey = JSON.stringify([query, tipe])
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey)
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey)
    setServerSearch(null)
    setServerSearchError(null)
  }

  // NUL separators keep a query from matching across the
  // nama/telepon/alamat boundaries.
  const searchable = useSearchable(
    pelangganList,
    (p) => `${p.nama}\u0000${p.telepon ?? ''}\u0000${p.alamat ?? ''}`,
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return searchable
      .filter(({ item: p, haystack }) => {
        if (tipe !== 'semua' && p.tipe !== tipe) return false
        return !q || haystack.includes(q)
      })
      .map(({ item }) => item)
  }, [searchable, query, tipe])

  const results = serverSearch ?? filtered

  const {
    totalPages,
    pageRows: paged,
    page,
    setPage,
  } = usePagedList(results, PAGE_SIZE, `${filterKey}:${serverSearch === null ? 'local' : 'server'}`)

  async function handleServerSearch() {
    setServerSearching(true)
    setServerSearchError(null)
    const result = await searchPelangganGlobal(query, tipe)
    setServerSearching(false)
    if (result.error) {
      setServerSearchError(result.error)
      return
    }
    setServerSearch(result.pelangganList ?? [])
  }

  if (pelangganList.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Belum ada pelanggan.</p>
    )
  }

  return (
    <div className="space-y-3">
      <FilterBar
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Cari nama, telepon, atau alamat..."
        selectValue={tipe}
        onSelectChange={setTipe}
        selectOptions={tipeOptions}
      />

      {results.length === 0 ? (
        <div className="space-y-3">
          <EmptyState message="Tidak ada pelanggan yang cocok. Coba kata kunci lain atau ubah filter." />
          {truncated && query.trim() !== '' && serverSearch === null && (
            <div className="text-sm text-center space-y-2">
              <p className="text-muted-foreground">
                Pencarian ini hanya mencakup 500 pelanggan terdaftar.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleServerSearch}
                disabled={serverSearching}
              >
                {serverSearching ? 'Mencari...' : 'Cari di semua pelanggan'}
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
              Menampilkan hasil pencarian dari semua pelanggan, bukan hanya 500 terdaftar.
            </p>
          )}
          {/* Mobile: card list */}
          <div className="space-y-2 sm:hidden">
            {paged.map((p) => (
              <PelangganRowCard key={p.id} p={p} />
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block border rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Nama</th>
                  <th className="text-left px-4 py-3 font-medium">Telepon</th>
                  <th className="text-left px-4 py-3 font-medium">Tipe</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {paged.map((p) => (
                  <PelangganRowTableRow key={p.id} p={p} />
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
